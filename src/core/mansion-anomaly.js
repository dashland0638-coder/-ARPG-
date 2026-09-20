/* 森の洋館の空間異常(D-01)と、鍛冶屋との分離(D-02)。

   狙いは迷路化ではない。仕様の言葉どおり

     「さっきまで普通だった洋館がおかしくなった」

   と感じさせること。だから作るのは「広くて複雑な異常空間」ではなく、
   **見覚えのある部屋に、違う繋がり方で出る**という一本道。

     使用人区画(練習戦)
      ↓ 出口の扉
     [分離] ―― 扉の先で剣士だけが別の場所に出る
      ↓
     玄関ホール……?  最初に通った部屋と同じ寸法・同じ壁紙。出口だけが違う
      ↓
     見覚えのない廊下  本来この館に存在しない通路
      ↓
     大広間……?      戦闘②の部屋と同じ寸法。ここに【鍵束の番人】
      ↓
     地下室へ        ここから先は元のままの洋館(中ボス→ボス)

   進行不能になる構造を作らないため、異常空間も既存区画と同じ一本道に
   してある ―― 分岐も、戻って探し直す要素も足していない。

   ■ 段階(仕様 5)
   異常は突然始まらない。部屋ごとに段階を持たせ、照明と環境音が
   少しずつ狂っていく。段階は「どの部屋にいるか」だけで決まるので、
   新しいタイマーも進行度カウンタも増やさない。

   state・three.js に依存しない(ARCHITECTURE.md の core/ の作法)。 */

/* 0 正常 / 1 痕跡 / 2 歪み / 3 異常空間 */
export const ANOMALY = { NORMAL:0, TRACES:1, WARPED:2, BROKEN:3 };

/* 部屋 id → 段階。MANSION_ROOMS の id をそのまま鍵にしてあるので、
   間取りを動かしても表を書き換える必要がない。

   前半(m*)=普通の洋館 / 二階(u*)=痕跡 / 一階奥(s*)=歪み /
   異常空間(x*)=完全に異常 / 地下とボス(b*)は元から異界なので歪み。 */
export const ROOM_ANOMALY_STAGE = {
  mEntry:ANOMALY.NORMAL, mFoyer:ANOMALY.NORMAL, mDining:ANOMALY.NORMAL,
  mKitchen:ANOMALY.NORMAL, mCor1:ANOMALY.NORMAL, mHall:ANOMALY.NORMAL,
  mStair:ANOMALY.NORMAL,
  uLand:ANOMALY.TRACES, uCor:ANOMALY.TRACES, uGuest:ANOMALY.TRACES,
  uStudy:ANOMALY.TRACES, uWork:ANOMALY.TRACES,
  sLand:ANOMALY.WARPED, sCor:ANOMALY.WARPED, sQuart:ANOMALY.WARPED,
  sDown:ANOMALY.WARPED,
  xFoyer:ANOMALY.BROKEN, xCor:ANOMALY.BROKEN, xHall:ANOMALY.BROKEN,
  bCellar:ANOMALY.WARPED, bCor:ANOMALY.WARPED, bStore:ANOMALY.WARPED,
  bDeep:ANOMALY.BROKEN, bAnte:ANOMALY.BROKEN, bLord:ANOMALY.BROKEN,
};

export function roomAnomalyStage(roomId){
  const s = ROOM_ANOMALY_STAGE[roomId];
  return s === undefined ? ANOMALY.NORMAL : s;
}

// 異常空間の部屋か(id の頭文字で判る ―― 部屋テーブルと同じ作法)
export function isAnomalyRoom(roomId){
  return typeof roomId === 'string' && roomId.charAt(0) === 'x';
}

/* ---- 照明の狂い ----
   段階が上がるほど、ランプが冷たく・暗く・届かなくなる。館そのものの
   材質や間取りには触れず、既存の registerMansionLamp へ渡す値だけを
   通す ―― 「同じ部屋なのに前と違って見える」を一番安く作れる場所。
   ボス撃破後は normalized=true で呼ばれ、すべて等倍へ戻る(仕様 10)。 */
export const ANOMALY_LAMP = [
  {intensity:1.00, dist:1.00, cool:0.00},   // 0 正常
  {intensity:0.88, dist:0.94, cool:0.18},   // 1 痕跡
  {intensity:0.72, dist:0.86, cool:0.42},   // 2 歪み
  {intensity:0.55, dist:0.78, cool:0.70},   // 3 異常空間
];

export function anomalyLampMods(stage, normalized){
  if(normalized) return ANOMALY_LAMP[ANOMALY.NORMAL];
  const i = Math.max(0, Math.min(ANOMALY_LAMP.length - 1, stage | 0));
  return ANOMALY_LAMP[i];
}

/* 暖色を冷たい側へ寄せる。cool=0 で元の色、1 で青灰へ振り切る。
   色は 0xRRGGBB の整数のまま扱う(three.js を core へ持ち込まない)。 */
export const ANOMALY_COOL_TARGET = 0x6a7a96;

export function coolShift(color, cool){
  const c = Math.max(0, Math.min(1, cool || 0));
  if(c <= 0) return color;
  const r = (color >> 16) & 0xff, g = (color >> 8) & 0xff, b = color & 0xff;
  const tr = (ANOMALY_COOL_TARGET >> 16) & 0xff;
  const tg = (ANOMALY_COOL_TARGET >> 8) & 0xff;
  const tb = ANOMALY_COOL_TARGET & 0xff;
  const mix = (a, t)=> Math.round(a + (t - a) * c);
  return (mix(r,tr) << 16) | (mix(g,tg) << 8) | mix(b,tb);
}

/* ---- 鍛冶屋との分離(D-02) ----
   進行状態。セーブには残さない ―― 一度の出撃の中だけの状態で、
   洋館を出れば鍛冶屋は酒場にいる(state.smithJoined の担当)。 */
export const ESCORT = {
  NONE:'none',            // まだ出会っていない
  JOINED:'joined',        // 作業室で合流して同行中
  SEPARATED:'separated',  // 扉の向こうで引き離された
  REUNITED:'reunited',    // ボス撃破後、正常化した館で再会した
};

/* 分離が成立する条件。「扉をくぐった」ことだけでは足りない ――
   同行していて、まだ分離しておらず、その扉に着いたときだけ。
   二重発火と、同行前に扉へ戻ったときの誤爆を同じ1箇所で防ぐ。 */
export function shouldSeparate(ctx){
  ctx = ctx || {};
  if(ctx.escort !== ESCORT.JOINED) return false;
  if(!ctx.atSplitDoor) return false;
  return true;
}

/* 再会が成立する条件。ボスを倒して、分離したままであること。 */
export function shouldReunite(ctx){
  ctx = ctx || {};
  return !!ctx.bossDefeated && ctx.escort === ESCORT.SEPARATED;
}

/* 鍛冶屋が今プレイヤーに付いて歩くか。分離後は付いてこない ――
   「無理に同行NPCとして維持しない」(仕様 6)をここで決める。 */
export function escortFollows(escort){
  return escort === ESCORT.JOINED;
}

/* ---- 同行の追従 ----
   戦闘には一切関与しない(索敵も攻撃判定も持たない)ので、要るのは
   「近づきすぎず、離れすぎない」だけ。guestCompanion の戦闘AIは
   使わない ―― 鍛冶屋は戦闘キャラクターではない(仕様 8)。

   戻り値は移動量 {dx, dz, moving, facing}。座標の反映は呼び出し側。 */
export const ESCORT_STOP_DIST = 2.6;    // これより近ければ止まる
export const ESCORT_RUN_DIST  = 6.0;    // これより遠ければ駆け足
export const ESCORT_WARP_DIST = 26.0;   // 階段テレポート等。追いつけないので飛ぶ
export const ESCORT_SPEED     = 3.4;    // m/s(プレイヤーの歩きよりわずかに遅い)

export function escortFollowStep({dx, dz, dt, speed = ESCORT_SPEED} = {}){
  const dist = Math.hypot(dx || 0, dz || 0);
  if(dist >= ESCORT_WARP_DIST) return {dx:0, dz:0, moving:false, warp:true, facing:null, dist};
  if(dist <= ESCORT_STOP_DIST || !(dt > 0)) {
    return {dx:0, dz:0, moving:false, warp:false, facing: dist > 0.001 ? Math.atan2(dx, dz) : null, dist};
  }
  const run = dist > ESCORT_RUN_DIST ? 1.55 : 1;
  // 止まる距離を超えたぶんだけ詰める。行き過ぎない
  const step = Math.min(dist - ESCORT_STOP_DIST, speed * run * dt);
  const k = step / dist;
  return {dx:(dx||0)*k, dz:(dz||0)*k, moving:true, warp:false, facing:Math.atan2(dx, dz), dist};
}
