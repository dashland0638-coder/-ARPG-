/* キャラクターのモーション状態機械(酒場 / 探索 / 戦闘 の姿勢と武器状態)

   これまでこのゲームには「今キャラクターが何をしている姿勢か」という概念が
   1つも無かった。姿勢は STANCE(05-rendering-rig.js)のクラス別 1 種類だけで、
   酒場でも・ダンジョンでも・敵の目の前でも、まったく同じ構えのまま立って
   いた。武器も同様で、buildPlayer() が手の位置に武器を置いたきりで、
   「収納 → 抜く → 構える → しまう」という段階が存在しなかった。

   ここはその段階だけを切り出した純粋な状態機械。three.js にも state にも
   触らないので、ゲームを起動せずに単体テストできる(core/punish-window.js と
   同じ方針。tests/unit/character-motion-state.test.js)。

   キャラクター状態:
     SOCIAL       酒場・会話・イベント。人物として自然に立っている
     EXPLORATION  ダンジョン探索。武器は収納、少し警戒している
     DRAWING      敵を認識し、職業ごとの抜刀を再生している最中
     COMBAT       戦闘中。職業固有の構え。攻撃・回避はこの状態の上で走る
     POST_COMBAT  最後の敵を倒した直後の余韻。武器はまだ抜いたまま
     SHEATHING    武器を収める動作の最中

   武器状態はキャラクター状態と同一視しない。POST_COMBAT + DRAWN のように、
   「戦闘は終わったが武器はまだ手にある」という組み合わせが正しく存在する。

   攻撃・回避はここでは状態を持たない ―― どちらも COMBAT の「上に乗る」
   一時的な動作で、終わればそのまま COMBAT に戻る(既存の state.swinging /
   state.dodging がそのまま担当する)。この状態機械が攻撃・回避を知るのは
   `busy` フラグ経由だけで、それも「戦闘終了処理でアクションを途中で
   切らない」ためにしか使わない。 */

export const CHARACTER_STATE = {
  SOCIAL: 'SOCIAL',
  EXPLORATION: 'EXPLORATION',
  DRAWING: 'DRAWING',
  COMBAT: 'COMBAT',
  POST_COMBAT: 'POST_COMBAT',
  SHEATHING: 'SHEATHING',
};

export const WEAPON_STATE = {
  SHEATHED: 'SHEATHED',
  DRAWING: 'DRAWING',
  DRAWN: 'DRAWN',
  SHEATHING: 'SHEATHING',
};

/* 武器の取り付け位置。「毎フレーム手の位置から計算する」しか無かった
   既存の updateGrip() に、収納位置という第二の基準点を与えるためのもの。
   実際の座標は core/pose-geometry.js の holsterAnchorLocal() が骨格寸法から
   導く ―― ここは「どの職業がどこへしまうか」という取り決めだけを持つ。 */
export const ATTACH = {
  HAND_RIGHT: 'HAND_RIGHT',
  HAND_LEFT: 'HAND_LEFT',
  HAND_BOTH: 'HAND_BOTH',
  BACK: 'BACK',
  HIP_RIGHT: 'HIP_RIGHT',
  HIP_LEFT: 'HIP_LEFT',
};

/* 職業ごとの抜刀・納刀の「間」。4職を同じ速度で抜かせないための表で、
   ここが職業の性格そのものになる:

     warrior 大剣を扱い慣れた大人。急がないが、もたつきもしない
     rogue   西部劇のガンマン。敵を見た瞬間に反射で両手が腰へ落ちる
     mage    杖はしまわない。両手持ち → 右手主体へ「持ち替える」だけ
     archer  射撃姿勢へ移る。納刀は残心を含むぶん4職で最も長い

   grabFrac : 抜刀クリップのどこで武器が収納位置から手へ移るか(0〜1)
   stowFrac : 納刀クリップのどこで武器が手から収納位置へ戻るか(0〜1)
   どちらも「手が既に収納位置に届いている」瞬間を指すので、見た目には
   武器が瞬間移動しない(05-rendering-rig.js の holsterBlend が実際の
   位置をこの前後で補間する)。 */
export const MOTION_TIMING = {
  warrior: { draw: 0.90, sheathe: 1.05, postCombat: 0.60, grabFrac: 0.40, stowFrac: 0.70 },
  rogue:   { draw: 0.34, sheathe: 0.64, postCombat: 0.38, grabFrac: 0.34, stowFrac: 0.66 },
  mage:    { draw: 0.52, sheathe: 0.70, postCombat: 0.44, grabFrac: 0.00, stowFrac: 1.00 },
  archer:  { draw: 0.64, sheathe: 1.15, postCombat: 0.56, grabFrac: 0.34, stowFrac: 0.55 },
};

/* 収納時 / 抜刀時に武器がぶら下がる場所。魔法使いだけ「収納」が
   両手持ち(胸の前)であって、杖をどこかへ片付ける動作は作らない ――
   戦闘と探索の違いは杖の位置ではなく持ち方と姿勢、という設計のため。 */
export const WEAPON_ATTACH = {
  warrior: { sheathed: ATTACH.BACK,      drawn: ATTACH.HAND_BOTH  },
  rogue:   { sheathed: ATTACH.HIP_RIGHT, drawn: ATTACH.HAND_RIGHT,
             offSheathed: ATTACH.HIP_LEFT, offDrawn: ATTACH.HAND_LEFT },
  mage:    { sheathed: ATTACH.HAND_BOTH, drawn: ATTACH.HAND_RIGHT },
  archer:  { sheathed: ATTACH.BACK,      drawn: ATTACH.HAND_LEFT  },
};

/* 敵検知の距離。入る時より出る時を広く取る(ヒステリシス)―― 境界上を
   うろつくたびに抜刀と納刀を往復するのを防ぐため。updateCombatMusic()
   が使っている 8m / ボス 14m と近い値に揃えてある。 */
export const COMBAT_ENTER_RANGE = 11;
export const COMBAT_EXIT_RANGE = 15;

export function timingFor(classKey) {
  return MOTION_TIMING[classKey] || MOTION_TIMING.warrior;
}

export function attachFor(classKey) {
  return WEAPON_ATTACH[classKey] || WEAPON_ATTACH.warrior;
}

/* 杖のように「そもそもしまわない」武器か。抜刀/納刀の段階自体は
   他職と同じように進むが、収納先が手なので武器は消えも飛びもしない。 */
export function keepsWeaponInHand(classKey) {
  return attachFor(classKey).sheathed === ATTACH.HAND_BOTH;
}

export function createMotionState(classKey, opts) {
  const social = !opts || opts.social !== false;
  return {
    classKey: classKey || 'warrior',
    character: social ? CHARACTER_STATE.SOCIAL : CHARACTER_STATE.EXPLORATION,
    weapon: WEAPON_STATE.SHEATHED,
    t: 0,              // 現在の状態に入ってからの経過秒(時間で終わる状態のみ使う)
    engaged: false,    // 敵検知のヒステリシス用(一度捕捉したら広い距離まで維持)
  };
}

/* ワールドを切り替えた時のリセット。画面が暗転する切り替わりなので、
   ここだけは段階を踏まずに目的の状態へ直接置く(暗転の裏で納刀
   モーションを再生しても誰にも見えない)。 */
export function resetForWorld(ms, { social }) {
  ms.character = social ? CHARACTER_STATE.SOCIAL : CHARACTER_STATE.EXPLORATION;
  ms.weapon = WEAPON_STATE.SHEATHED;
  ms.t = 0;
  ms.engaged = false;
  return ms;
}

/* 敵との距離から「敵がいる」を判定する。一度捕捉したら COMBAT_EXIT_RANGE
   まで維持するので、柱の陰へ回り込んだ程度では戦闘が解けない。 */
export function isHostileNearby(nearestDist, engaged) {
  if (nearestDist == null || !(nearestDist >= 0)) return false;
  return nearestDist <= (engaged ? COMBAT_EXIT_RANGE : COMBAT_ENTER_RANGE);
}

function startDrawing(ms, t) {
  ms.character = CHARACTER_STATE.DRAWING;
  ms.weapon = WEAPON_STATE.DRAWING;
  ms.t = t || 0;
}

/* 攻撃入力が抜刀/納刀の途中で入った時の逃げ道。既存の攻撃入力を
   ブロックすると「敵の目の前で1秒間なにも出せない」ことになり、
   既存の戦闘バランスを勝手に変えてしまう。代わりに、抜きかけ・
   しまいかけの状態から即座に戦闘状態へ確定させる ―― プレイヤーの
   意思表示としては十分自然で、状態が途中で止まる事故も起きない。 */
export function forceCombat(ms) {
  ms.character = CHARACTER_STATE.COMBAT;
  ms.weapon = WEAPON_STATE.DRAWN;
  ms.engaged = true;
  ms.t = 0;
  return ms;
}

/* 毎フレームの更新。ctx:
     hostileNearby  近くに生きた敵がいるか(isHostileNearby の結果)
     busy           攻撃/回避/スキルなど、途中で切ってはいけない動作の最中か
     social         今いるワールドが酒場・イベント側か
   戻り値は状態が変わったかどうか(呼び出し側の演出フック用)。 */
export function updateMotionState(ms, dt, ctx) {
  const c = ctx || {};
  const T = timingFor(ms.classKey);
  const before = ms.character + '/' + ms.weapon;
  const hostile = !c.social && !!c.hostileNearby;
  ms.engaged = hostile;
  const step = dt > 0 ? dt : 0;

  switch (ms.character) {
    case CHARACTER_STATE.SOCIAL:
      // 酒場を出た(=ダンジョンへ入った)瞬間に冒険者の姿勢へ
      if (!c.social) ms.character = CHARACTER_STATE.EXPLORATION;
      else if (hostile) startDrawing(ms, 0);   // 酒場が襲われるイベント用の保険
      break;

    case CHARACTER_STATE.EXPLORATION:
      if (c.social) { ms.character = CHARACTER_STATE.SOCIAL; ms.t = 0; }
      else if (hostile) startDrawing(ms, 0);
      break;

    case CHARACTER_STATE.DRAWING:
      /* 敵検知が何度発火しても、既に DRAWING ならここへ来るだけで
         クリップは再開しない(二重開始の防止)。敵が居なくなっても
         抜き切ってから畳む ―― 途中で腕だけ戻ると武器が宙に浮く。 */
      ms.t += step;
      if (ms.t >= T.draw) {
        ms.character = CHARACTER_STATE.COMBAT;
        ms.weapon = WEAPON_STATE.DRAWN;
        ms.t = 0;
      }
      break;

    case CHARACTER_STATE.COMBAT:
      // 攻撃・回避の途中では戦闘を終わらせない(振り抜いてから畳む)
      if (!hostile && !c.busy) {
        ms.character = CHARACTER_STATE.POST_COMBAT;
        ms.t = 0;
      }
      break;

    case CHARACTER_STATE.POST_COMBAT:
      // 余韻の最中に新手が現れたら、武器は抜いたままなので即戦闘へ戻す
      if (hostile) { ms.character = CHARACTER_STATE.COMBAT; ms.t = 0; break; }
      ms.t += step;
      if (ms.t >= T.postCombat) {
        ms.character = CHARACTER_STATE.SHEATHING;
        ms.weapon = WEAPON_STATE.SHEATHING;
        ms.t = 0;
      }
      break;

    case CHARACTER_STATE.SHEATHING: {
      if (hostile) {
        /* しまいかけで敵が現れた。ゼロから抜き直すと武器が一度収納位置へ
           飛ぶので、「今の武器の位置(holsterBlend)がそのまま続く」抜刀の
           途中から始める ―― 抜刀側の同じ曲線を逆に解いた位置を使うので、
           切り替わったフレームで武器はまったく動かない。 */
        startDrawing(ms, T.draw * drawPhaseForBlend(ms.classKey, holsterBlend(ms)));
        break;
      }
      ms.t += step;
      if (ms.t >= T.sheathe) {
        ms.weapon = WEAPON_STATE.SHEATHED;
        ms.character = c.social ? CHARACTER_STATE.SOCIAL : CHARACTER_STATE.EXPLORATION;
        ms.t = 0;
      }
      break;
    }

    default:
      // 未知の値が入り込んだら安全側(探索)へ落とす
      resetForWorld(ms, { social: !!c.social });
      break;
  }

  return before !== (ms.character + '/' + ms.weapon);
}

/* 現在の状態の進行度 0〜1。時間で終わらない状態(SOCIAL/EXPLORATION/COMBAT)
   では常に 1 を返す ―― 「もう終わっている」という意味で扱えるため。 */
export function motionPhase(ms) {
  const T = timingFor(ms.classKey);
  const dur = ms.character === CHARACTER_STATE.DRAWING ? T.draw
            : ms.character === CHARACTER_STATE.SHEATHING ? T.sheathe
            : ms.character === CHARACTER_STATE.POST_COMBAT ? T.postCombat
            : 0;
  if (!(dur > 0)) return 1;
  return Math.max(0, Math.min(1, ms.t / dur));
}

/* 武器が収納位置にどれだけ寄っているか(0=完全に手の中、1=完全に収納位置)。
   holsterBlend が 0 と 1 の間を必ず連続的に動くので、武器が背中から手へ
   瞬間移動することがない。

   受け渡しに掛ける時間は「クリップの割合」ではなく実時間で決める ――
   割合で持つと、盗賊のように抜刀が 0.34 秒しかない職では受け渡しが
   数フレームで終わってしまい、そこだけカクついて見えるため。 */
export const HOLSTER_CROSSOVER_SEC = 0.22;

function crossoverFrac(dur) {
  if (!(dur > 0)) return 0.30;
  return Math.min(0.5, HOLSTER_CROSSOVER_SEC / dur);
}

// 抜刀クリップ上で、武器が収納位置から手へ渡る区間 [a, b]
function drawHandoff(classKey) {
  const T = timingFor(classKey);
  const w = crossoverFrac(T.draw);
  const a = Math.max(0, Math.min(1 - w, T.grabFrac));
  return [a, a + w];
}

// 納刀クリップ上で、武器が手から収納位置へ戻る区間 [a, b]
function sheatheHandoff(classKey) {
  const T = timingFor(classKey);
  const w = crossoverFrac(T.sheathe);
  const b = Math.max(w, Math.min(1, T.stowFrac));
  return [b - w, b];
}

export function holsterBlend(ms) {
  const p = motionPhase(ms);
  switch (ms.weapon) {
    case WEAPON_STATE.SHEATHED: return 1;
    case WEAPON_STATE.DRAWN: return 0;
    case WEAPON_STATE.DRAWING: {
      const [a, b] = drawHandoff(ms.classKey);
      return 1 - smoothstepFrom(p, a, b);
    }
    case WEAPON_STATE.SHEATHING: {
      const [a, b] = sheatheHandoff(ms.classKey);
      return smoothstepFrom(p, a, b);
    }
    default: return 1;
  }
}

/* holsterBlend の逆引き: 「武器が今ここにある」状態をそのまま引き継げる
   抜刀クリップ上の位置を返す。納刀の途中から抜き直す時に使う。 */
export function drawPhaseForBlend(classKey, blend) {
  const [a, b] = drawHandoff(classKey);
  const k = invSmoothstep(1 - Math.max(0, Math.min(1, blend)));
  return Math.max(0, Math.min(1, a + k * (b - a)));
}

function smoothstepFrom(x, a, b) {
  if (!(b > a)) return x >= b ? 1 : 0;
  const k = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
}

// smoothstep(k) = y を k について解いたもの(0〜1)
function invSmoothstep(y) {
  const c = Math.max(0, Math.min(1, y));
  return 0.5 - Math.sin(Math.asin(1 - 2 * c) / 3);
}

/* 状態の組み合わせが破綻していないか。テストと、開発モードの表示から使う。
   「アニメーションの途中」以外で DRAWING/SHEATHING が残っていたり、
   EXPLORATION なのに武器が DRAWN のままだったりしたら false。 */
export function isConsistent(ms) {
  const C = CHARACTER_STATE, W = WEAPON_STATE;
  switch (ms.character) {
    case C.SOCIAL:
    case C.EXPLORATION:   return ms.weapon === W.SHEATHED;
    case C.DRAWING:       return ms.weapon === W.DRAWING;
    case C.COMBAT:        return ms.weapon === W.DRAWN;
    case C.POST_COMBAT:   return ms.weapon === W.DRAWN;
    case C.SHEATHING:     return ms.weapon === W.SHEATHING;
    default:              return false;
  }
}

/* 攻撃・回避を開始してよいか。DRAWING / SHEATHING の最中は本来
   「まだ構えていない」が、既存の入力を殺さないために呼び出し側は
   forceCombat() で確定させる方を選ぶ。ここは判定だけを提供する。 */
export function canAct(ms) {
  return ms.character === CHARACTER_STATE.COMBAT
      || ms.character === CHARACTER_STATE.POST_COMBAT;
}
