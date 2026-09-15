// 通常攻撃の踏み込み(STEP 5)
//
// STEP 4 の実機計測で、通常攻撃コンボが途中から空振りする原因は
// 「リーチ不足」ではなく「1段目が最大間合いで発火した後、敵のノックバック
// によって次段までに間合いが開くこと」だと確定した(訓練空間・剣士Lv1):
//
//   P1  開始 4.177m・その場で長押し → 0/2 命中(surf 3.745 > range 3.6)
//   P2  開始 4.001m・前進しながら   → 3/3 命中
//   P1b 開始 1.667m・その場で長押し → 4/4 命中(1撃ごとに +0.466m ずつ開く)
//
// つまり「近ければ棒立ちでも繋がる / 遠いと前進しない限り繋がらない」。
// そこで、攻撃リーチもノックバックも触らずに、振るたびプレイヤーが
// 攻撃方向へ少しだけ前へ出るようにして差を埋める。
//
// 設計上の制約(敵に吸い付かせないこと):
//   ・敵の座標を一切参照しない。踏み込む向きは「振り始めに固定した
//     プレイヤーの向き」(state.swingLockFacing)だけで決まる
//   ・毎フレーム距離を測り直して詰めるホーミングにしない
//   ・瞬間移動にしない ―― 振りの長さに沿って少しずつ進む
//   ・通常移動を置き換えない。既存の移動ベクトルに足すだけなので、
//     攻撃中もWASDはそのまま効く(既存のスキル移動 state.skillAnim は
//     移動を丸ごと奪う形なので、通常攻撃には流用しない)

/* 1段あたりの踏み込み量(メートル)。今回確定させたのは剣士だけで、
   他職は 0 のまま = 挙動を変えない。将来ここへ値を入れるだけで
   職業ごとに調整できるようにテーブルとして分けてある。

   剣士の値は STEP 5(0.30m)→ STEP 6(0.45m)。0.30m では訓練カカシの
   後退量 0.466m/撃 に対して毎撃 0.166m ずつ開き続け、最大間合い付近では
   1/4 しか当たらなかった(実測)。0.45m は「カカシの後退量とほぼ等価」で、
   その場で振り続けても間合いがほぼ維持される値。
   ただし実戦ザコの後退量は Lv1 で 0.967m あり、こちらは 0.45m でも
   埋めきらない ―― 敵に吸い付かせないため、埋めきることは狙わない。 */
export const ATTACK_LUNGE_BY_CLASS = {
  warrior: 0.45,
  rogue: 0,
  mage: 0,
  archer: 0,
};

export function attackLungeDistance(classKey) {
  return ATTACK_LUNGE_BY_CLASS[classKey] || 0;
}

/* 踏み込みの進み具合(0→1)。イーズアウト(1-(1-t)^2)にしてあるのは、
   踏み込みは「振り始めに体重が前へ乗って、振り終わりで止まる」動きで、
   等速で滑らせると地面を滑っているように見えるため。 */
export function lungeProgress(t, duration) {
  if (!(duration > 0)) return 1;
  const p = Math.min(1, Math.max(0, t / duration));
  return 1 - (1 - p) * (1 - p);
}

/* このフレームで進む距離。呼び出し側は戻り値を「振り始めに固定した向き」へ
   掛けて移動ベクトルへ足すだけでよい。合計はちょうど anim.dist になる
   (進捗の差分を返しているので、フレームレートに依存しない)。 */
export function lungeStep(anim, dt) {
  if (!anim || !(anim.dist > 0)) return 0;
  const before = lungeProgress(anim.t, anim.duration);
  const after = lungeProgress(anim.t + dt, anim.duration);
  return (after - before) * anim.dist;
}

export function lungeFinished(anim, dt) {
  if (!anim) return true;
  return anim.t + dt >= anim.duration;
}
