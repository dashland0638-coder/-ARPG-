/* 水門守の残響 ―― 「過去の行動が、そのまま残っている」敵(WORK 6)。

   ■ 村の怪異の総まとめ
   水鏡の影は「本体と分身」、写し身は「現在とコピー」、記憶漁師は
   「現在と過去の位置」を見分けさせた。水門守は「**いま動いているもの**と
   **過去の動作を繰り返しているもの**」を見分けさせる ―― 同じ問いの、
   いちばん大きい形。

   ■ 水鏡の影の仕組みをコピーしない
   水鏡の影は「挙動の微妙な差」で見分けた。こちらは差ではなく **時間** で
   見分ける ―― 残響は、本体が少し前にやったことを、遅れてなぞるだけ。
   だから残響には予備動作が無く、必ず本体より遅れて始まる。

   ■ 残響は無害なエフェクトではない
   過去の動作に巻き込まれれば痛い。ただし残響は追ってこないし、狙っても
   こない ―― その場で同じ動作をなぞるだけなので、離れていれば当たらない。

   ■ 観測の灯
   残響が始まるまでの遅れが見やすくなるだけ。どれが本体かは言わない。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

// 実機調整前の暫定値
export const PROVISIONAL_ECHO_DELAY_SEC = 1.6;   // 本体の動作を、これだけ遅れてなぞる
export const PROVISIONAL_ECHO_LIFE_SEC = 2.2;    // 残響が見えている時間
export const PROVISIONAL_ECHO_WINDUP_SEC = 0.55; // 本体だけが持つ予備動作
export const PROVISIONAL_ECHO_RADIUS = 2.4;      // 巻き込まれる範囲
export const PROVISIONAL_OPERATE_SEC = 1.5;      // レバーを引いている時間
export const PROVISIONAL_MOVE_SEC = 2.4;         // 次の位置へ移るまで

// 観測の灯。残響が始まるまでの遅れが伸びて見分けやすくなる
export const OBSERVE_DELAY_MUL = 1.5;

/* フェーズ。HPで3段階だけ ―― 多段フェーズにはしない。
   この敵の役目は難易度ではなく「過去の行動を見る」ルールの集約。 */
export const PROVISIONAL_PHASE_2_HP = 0.66;
export const PROVISIONAL_PHASE_3_HP = 0.33;

export function phaseFor(hpFrac){
  if(hpFrac > PROVISIONAL_PHASE_2_HP) return 1;
  if(hpFrac > PROVISIONAL_PHASE_3_HP) return 2;
  return 3;
}

/* 同時に見えている残響の数。フェーズが進むほど増えるが、
   増えるのは数だけで、残響そのものの性質は変わらない。 */
export function echoCountFor(phase){
  return phase >= 3 ? 4 : phase === 2 ? 3 : 2;
}

/* 残響が始まるまでの遅れ。観測の灯が効いていれば長くなる ――
   「本体が先、残響が後」がはっきりするだけで、答えは出さない。 */
export function echoDelay(observing, opts){
  opts = opts || {};
  const base = opts.delay != null ? opts.delay : PROVISIONAL_ECHO_DELAY_SEC;
  return base * (observing ? OBSERVE_DELAY_MUL : 1);
}

/* 本体がやったことを1つ控える。残響はこれをなぞる。
   記録するのは「どこで」「何を」「いつ」だけ。 */
export function recordAction(kind, x, z, facing, at){
  if(!kind || !isFinite(x) || !isFinite(z) || !isFinite(at)) return null;
  return {kind, x, z, facing: facing || 0, at};
}

/* いま始めるべき残響。delay 秒前の記録が対象で、一度出したものは出さない。
   played は再生済みの記録(配列/Set)。 */
export function dueEchoes(records, now, delay, played){
  const out = [];
  const has = (r)=> played && (played.indexOf ? played.indexOf(r) >= 0 : played.has(r));
  for(let i=0;i<(records||[]).length;i++){
    const r = records[i];
    if(!r || has(r)) continue;
    if(now - r.at >= delay) out.push(r);
  }
  return out;
}

/* 古い記録を捨てる。残響として出し終えたものは、もう要らない。 */
export function pruneRecords(records, now, keep){
  if(!records) return;
  const limit = now - (keep != null ? keep : PROVISIONAL_ECHO_DELAY_SEC + PROVISIONAL_ECHO_LIFE_SEC + 2);
  let drop = 0;
  while(drop < records.length && records[drop].at < limit) drop++;
  if(drop > 0) records.splice(0, drop);
}

/* 残響の寿命を進める。progress は見た目の濃さに使う
   (出てすぐ濃く、消える間際に薄い)。 */
export function stepEcho(echo, dt){
  const life = Math.max(0, (echo && echo.life != null ? echo.life : 0) - dt);
  const max = (echo && echo.maxLife) || PROVISIONAL_ECHO_LIFE_SEC;
  return {life, expired: life <= 0, progress: max > 0 ? 1 - life/max : 1};
}

/* 残響に巻き込まれるか。

   **当たるのは、なぞっている動作の瞬間だけ**(harmAt を跨いだ1回)。
   出ている間ずっと当たり判定があると、残響が増えるほど立つ場所が
   無くなり、見分ける遊びではなく避ける遊びになってしまう。 */
export function echoStrikes(echo, prevLife, radius, px, pz){
  if(!echo || echo.harmAt == null) return false;
  const now = (echo.maxLife || PROVISIONAL_ECHO_LIFE_SEC) - echo.life;
  const before = (echo.maxLife || PROVISIONAL_ECHO_LIFE_SEC) - prevLife;
  if(!(before < echo.harmAt && now >= echo.harmAt)) return false;
  const r = radius != null ? radius : PROVISIONAL_ECHO_RADIUS;
  const dx = echo.x - px, dz = echo.z - pz;
  return dx*dx + dz*dz <= r*r;
}

/* いま動いているのはどちらか、を数字にしたもの(見分けの手がかり)。
   本体は必ず予備動作を持ち、残響は持たない ―― 表示側はこれを
   「沈み込み」や「水面の反応」に変えるだけで、文字にはしない。 */
export function actorTell(isEcho){
  return {
    windup: isEcho ? 0 : PROVISIONAL_ECHO_WINDUP_SEC,
    ripple: isEcho ? 0.45 : 1.0,   // 本体の足元だけ水面が強く応える
  };
}

/* =========================================================
   攻撃範囲の予兆(CH1-COMP W2-MB2)

   本体と、本体が出した「引いた」残響の足元に、当たる範囲(半径 2.4)の輪を出し、
   内側の円を当たる瞬間に満ちるように進める。数値は今のまま定数へ移しただけ。

   ・本体: 予備動作(0.55 秒)の始めから、引いている間の 45% の所(当たる瞬間)まで。
     合わせて 0.55 + 1.5 × 0.45 = 1.225 秒で満ちる
   ・残響: 出た瞬間から harmAt(寿命 2.2 × 0.45 = 0.99 秒)まで
   ・歩いた跡の残響(当たらない)と、水門守以外が出した残響(村の残響のボス)には出さない
   ========================================================= */
export const KEEPER_STRIKE_FRAC = 0.45;  // 引いている間の、この割合の所で 1 回だけ当たる(今の値)
export const ECHO_HARM_FRAC = 0.45;      // 残響の寿命の、この割合の所で 1 回だけ当たる(今の値)
export const KEEPER_ECHO_SOURCE = 'keeper';   // 水門守が出した残響の印
// 予備動作の始めから当たる瞬間まで
export const KEEPER_TELEGRAPH_LEAD_SEC = PROVISIONAL_ECHO_WINDUP_SEC + PROVISIONAL_OPERATE_SEC * KEEPER_STRIKE_FRAC;

/* 「引いた」残響が当たる時刻(出てからの秒)。歩いた跡は null(当たらない) */
export function echoHarmAt(kind){
  return kind === 'operate' ? PROVISIONAL_ECHO_LIFE_SEC * ECHO_HARM_FRAC : null;
}

const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;

/* 本体の予兆の進み具合(0 → 1)。出さない時は null。
   keeperState: 'move' | 'windup' | 'operate'、keeperT: その相の残り秒、hitDone: もう当たったか */
export function keeperTelegraphProgress(keeperState, keeperT, hitDone){
  const t = Number(keeperT);
  if(!isFinite(t)) return null;
  let elapsed;
  if(keeperState === 'windup'){
    elapsed = PROVISIONAL_ECHO_WINDUP_SEC - Math.max(0, t);
  } else if(keeperState === 'operate'){
    if(hitDone) return null;
    elapsed = PROVISIONAL_ECHO_WINDUP_SEC + PROVISIONAL_OPERATE_SEC - Math.max(0, t);
  } else {
    return null;
  }
  return clamp01(elapsed / KEEPER_TELEGRAPH_LEAD_SEC);
}

/* 残響に予兆を出すか。水門守が出した、当たる(harmAt のある)残響だけ */
export function echoHasTelegraph(echo){
  return !!echo && echo.source === KEEPER_ECHO_SOURCE && echo.harmAt != null && isFinite(echo.harmAt) && echo.harmAt > 0;
}

/* 残響の予兆の進み具合(0 → 1)。出さない時(対象外・当たった後・寿命切れ・壊れた値)は null */
export function echoTelegraphProgress(echo){
  if(!echoHasTelegraph(echo)) return null;
  const max = echo.maxLife || PROVISIONAL_ECHO_LIFE_SEC;
  const life = Number(echo.life);
  if(!isFinite(life) || life <= 0) return null;
  const elapsed = max - life;
  if(elapsed >= echo.harmAt) return null;
  return clamp01(elapsed / echo.harmAt);
}

/* 本体の予兆を出すか(出すなら進み具合、出さないなら null)。倒れている・ダウン中・
   敵対していない(再出現の直後・追うのをやめた後。AI が止まり、相の残りが途中のまま残る)間は出さない */
export function keeperTelegraphFor(en){
  if(!en || en.dead || en.knockedDown || !en.triggered) return null;
  return keeperTelegraphProgress(en.keeperState, en.keeperT, !!en.keeperHit);
}
