// 攻撃タイムラインの同期(Combat Feel Phase 1)
//
// 「入力 → 静 → 剣が加速 → 刃が敵へ届く → Hit判定 + 範囲表示 + SE」という
// 一本の時間軸を、ここ一箇所の数値で定義する。
//
// 従来はこの3つが別々の場所で、別々の理屈で決まっていた:
//
//   SE   : beginMove() がクリップ再生と同時に moveSfx() を鳴らす → 実時間 0.00
//   判定 : JOB_HIT_DELAY_FRAC(11-combat-actions.js) → 実時間 0.45
//   見た目: JOB_SWING_ANTICIPATION による t^pow の歪み(05-rendering-rig.js)
//           → 刃がクリップ位置 0.14〜0.20 を通過するのは実時間 0.57〜0.60
//
// 戦騎士(battleKnight)は3つすべてが掛かる唯一の職なので、ズレがそのまま
// 「剣が振られる前に音が鳴る」という違和感になっていた(ユーザー報告)。
//
// 方針: 判定の実時間(0.45)は据え置き ―― 既に手触りが良いと確認済みで、
// ここを動かすと入力レスポンスそのものが変わってしまう。代わりに
//   ・SE を判定と同じ瞬間へ移す
//   ・見た目の歪み(anticipation)を緩めて、刃の通過をその瞬間へ寄せる
// ことで3つを1点に集める。anticipation は「静→動のメリハリ」を作るための
// 見た目専用の係数なので、緩めてもダメージ・射程・クールダウンには
// 一切影響しない(2.2 でも線形 1.0 とは程遠く、重量感は残る)。

/* 見た目の再生カーブ。大きいほど前半が静止に近くなり、後半で一気に振り抜く。
   3.2 → 2.2: 刃の通過を実時間 0.57 から 0.45 付近まで前へ引き戻すため。 */
export const JOB_SWING_ANTICIPATION = { battleKnight: 2.2 };

/* 刃が敵へ届く瞬間(クリップ長に対する実時間の割合)。Hit判定・範囲表示・
   攻撃SE がすべてこの1つの値を共有する。 */
export const JOB_SWING_IMPACT_FRAC = { battleKnight: 0.45 };

export function swingAnticipation(job) {
  return JOB_SWING_ANTICIPATION[job] || 0;
}

// 実時間の進行度 t(0〜1)→ 実際に再生しているクリップ内の位置(0〜1)
export function warpSwingT(t, pow) {
  const clamped = Math.max(0, Math.min(1, t || 0));
  if (!(pow > 0)) return clamped;
  return Math.pow(clamped, pow);
}

export function clipFracAt(t, job) {
  return warpSwingT(t, swingAnticipation(job));
}

// この職の「刃が届く」実時間割合。0 = 遅延なし(入力と同時に解決する職)
export function impactFrac(job) {
  return JOB_SWING_IMPACT_FRAC[job] || 0;
}

// 判定/SEが起きる瞬間に、クリップのどこを再生しているか。
// 3つが揃っているかを検証するための値(tests/unit/swing-timing.test.js)。
export function impactClipFrac(job) {
  return clipFracAt(impactFrac(job), job);
}

/* 通常攻撃コンボ(basic系)のクリップだけが対象。スキル・回避攻撃・
   必殺技の型には anticipation も遅延も掛かっていないため、SEも
   従来どおり即座に鳴らす。 */
export function isBasicComboClip(clip) {
  return /^(basic|altBasic)/.test(clip || '');
}

// SEを何秒遅らせるか。0 ならその場で鳴らす。
export function swingSfxDelay({ job, clip, swingDur }) {
  if (!isBasicComboClip(clip)) return 0;
  return impactFrac(job) * (swingDur > 0 ? swingDur : 0);
}
