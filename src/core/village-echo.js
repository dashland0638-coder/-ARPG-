/* 村の残響 ―― 宵待ちの村の終わりに立つもの(WORK 7)。

   ■ 誰でもない
   一人の怨念ではない。魚を獲ったこと、家で過ごした時間、舟を出したこと、
   商いをしたこと、水門を開け閉めしたこと、誰かを待った時間 ――
   忘れられた村の記憶が混ざったもの。だから「黒幕」はいないし、
   倒しても誰かが帰ってくるわけでもない。

   ■ 新しいルールを持たない
   この戦いに新しい仕掛けは1つも無い。出てくるのは、プレイヤーが
   WORK 3〜6 で覚えた4つだけ:

     水鏡の影   本体と分身を見分ける      (core/mirror-shade.js)
     泡沫の群れ 増える前に散らす          (core/foam-swarm.js)
     写し身     自分の一撃が返ってくる    (core/attack-snapshot.js)
     残響       過去の行動が時間差で重なる(core/warden-echo.js)

   このモジュールが決めるのは「どの段階で、どれが、いくつ出るか」だけ。
   それぞれの振る舞いは元のモジュールのまま ―― ここでは何も変えない。

   ■ 段階で難しくしない
   フェーズが進んでも、敵の性質は変わらない。変わるのは**組み合わせ**だけ。
   HP を盛って長引かせることもしない。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

// フェーズ閾値。既存ボスと同じ位置にしてある(他のボスと読み方が変わらない)
export const PHASE_2_HP = 0.65;
export const PHASE_3_HP = 0.30;

export function phaseFor(hpFrac){
  if(hpFrac > PHASE_2_HP) return 1;
  if(hpFrac > PHASE_3_HP) return 2;
  return 3;
}

/* 各段階で場に出ているものの上限。上限であって、ノルマではない ――
   倒せば減り、減ったぶんだけ間を置いて戻る。

   合計を抑えてあるのは、4つの現象が同時に見えても**読めるように**するため。
   数で押す戦いにはしない。 */
export const PROVISIONAL_PHASE_PLAN = {
  // 1: 記憶がまだ整理されていない ―― 見分けることだけを覚え直す
  1: {clones: 2, foam: 2, copy: 0, echoes: 0},
  // 2: 誰かの記憶を真似している ―― そこへ写し身が加わる
  2: {clones: 2, foam: 3, copy: 1, echoes: 0},
  // 3: 過去そのものが現在に重なる ―― 残響が出る。増やすのは種類で、数ではない
  3: {clones: 1, foam: 2, copy: 1, echoes: 3},
};

export function planFor(phase){
  return PROVISIONAL_PHASE_PLAN[phase] || PROVISIONAL_PHASE_PLAN[1];
}

// 出し直すまでの間。散らされた直後に湧き直すと、見分ける時間が無くなる
export const PROVISIONAL_REFILL_SEC = 6.0;
// 残響(過去の行動)を残す間隔と、遅れ。遅れは水門守と同じ読み方にしてある
export const PROVISIONAL_ECHO_EVERY_SEC = 2.6;

/* いま足りないものを返す。alive は {clones, foam, copy} の現在数。
   足りないぶんを一度に全部は出さない ―― 1回につき1体だけ。 */
export function nextSummon(phase, alive, timer, dt, opts){
  opts = opts || {};
  const refill = opts.refill != null ? opts.refill : PROVISIONAL_REFILL_SEC;
  const t = (timer || 0) + dt;
  const plan = planFor(phase);
  const a = alive || {};
  const want = ['clones', 'foam', 'copy'].find(k => (a[k] || 0) < plan[k]);
  if(!want) return {timer: 0, summon: null};      // 揃っている間は溜めない
  if(t < refill) return {timer: t, summon: null};
  return {timer: 0, summon: want};
}

/* 残響を残すか。過去の行動を置くのは第3段階だけ ―― それまでは、
   「今そこにいるもの」を見分けることに集中させる。 */
export function shouldLeaveEcho(phase, timer, dt, opts){
  opts = opts || {};
  const every = opts.every != null ? opts.every : PROVISIONAL_ECHO_EVERY_SEC;
  if(planFor(phase).echoes <= 0) return {timer: 0, leave: false};
  const t = (timer || 0) + dt;
  if(t < every) return {timer: t, leave: false};
  return {timer: 0, leave: true};
}

/* 撃破した瞬間に結果画面を出すかどうか。

   宵待ちの村は出さない ―― 記憶が水面へ戻り、最後の一言があって、夜が
   明けるまでが「倒したあと」だから。ここを true にすると、結果画面が
   その上に割り込む。

   純粋な判定にしてあるのは、**この一点がユニットテストで固定できる**
   ようにするため(洋館の shouldReunite と同じ考え方)。 */
export const DEFERRED_RESULT_SCENARIOS = ['duskvillage'];

export function defersResultScreen(scenarioKey){
  return DEFERRED_RESULT_SCENARIOS.indexOf(scenarioKey) >= 0;
}
