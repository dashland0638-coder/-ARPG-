/* 水鏡の影 ―― 宵待ちの村の最初の怪異(WORK 3)。

   ■ この敵が教えるもの
   倒し方ではなく「この村の怪異は、観察すると挙動に規則がある」というルール。
   一定まで削ると同じ姿へ分裂し、そこからは **どれが本体か** を自分で見つける。
   本体を示す印(色を変える/マーカーを出す)は出さない ―― 代わりに、本体と
   分身で「観察できる差」を持たせる:

     1. 水面の波紋が立つ間隔      … 本体のほうが遅い(分身は水面を細かく叩く)
     2. プレイヤーの動きへの追従   … 本体のほうが一拍遅れて向き直る
     3. 攻撃前の予兆の長さ・深さ   … 本体だけ大きく引く

   どれも「言われれば分かる」程度の差で、慣れると見えるようになる。

   ■ 観測の灯(魔法使いの Skill 2)
   答えを表示するスキルにはしない。上の3つの差を **広げる** だけで、
   最後にどれを攻撃するかはプレイヤーが決める。だから観測の灯が無くても
   (＝他職でも)同じ情報は観察できる ―― 魔法使いは「観察しやすい」だけ。

   ■ 数値は暫定
   PROVISIONAL_ 接頭辞のものは実機調整前の仮値(core/crush-slash.js と同じ扱い)。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

// ---- 分裂 ----
export const PROVISIONAL_SPLIT_HP_FRAC = 0.62;   // これを下回ったら分裂する
export const PROVISIONAL_CLONE_COUNT = 2;        // 本体のほかに出る分身の数
export const PROVISIONAL_SPLIT_RADIUS = 3.2;     // 分身が現れる距離
export const PROVISIONAL_REFORM_SEC = 7.0;       // 散らした分身が戻るまで

// ---- 観察できる差(本体 / 分身) ----
export const PROVISIONAL_RIPPLE_REAL_SEC = 2.1;   // 本体: 水面がゆっくり応える
export const PROVISIONAL_RIPPLE_CLONE_SEC = 1.15; // 分身: 細かく波立つ
export const PROVISIONAL_TURN_REAL = 3.0;         // 本体: 向き直りが鈍い(rad/s)
export const PROVISIONAL_TURN_CLONE = 7.5;        // 分身: 鏡のように即応する
export const PROVISIONAL_WINDUP_REAL_SEC = 0.72;  // 本体: 大きく引いてから来る
export const PROVISIONAL_WINDUP_CLONE_SEC = 0.34; // 分身: 浅く、すぐ来る

// ---- 観測の灯 ----
export const OBSERVE_LIGHT_SEC = 7.0;         // 効いている時間
export const OBSERVE_CONTRAST = 1.8;          // 差を何倍に広げて見せるか
export const OBSERVE_RADIUS = 14;             // 届く範囲

/* 分裂してよいか。一度分裂したら、同じ個体では二度と分裂しない
   ―― 削るたびに増えると「観察する」前に画面が埋まる。 */
export function shouldSplit(hpFrac, alreadySplit){
  if(alreadySplit) return false;
  return hpFrac <= PROVISIONAL_SPLIT_HP_FRAC;
}

/* 観察できる差の倍率。観測の灯が効いている間だけ、差が広がる。
   1 を下回らせない ―― 灯りを使うと分かりにくくなる、はあり得ない。 */
export function tellContrast(observing){
  return observing ? OBSERVE_CONTRAST : 1;
}

/* 波紋の間隔。本体は遅く、分身は細かい。観測の灯はこの差を広げる
   (本体はさらに遅く、分身はさらに細かく)。 */
export function rippleInterval(isReal, observing){
  const k = tellContrast(observing);
  const base = isReal ? PROVISIONAL_RIPPLE_REAL_SEC : PROVISIONAL_RIPPLE_CLONE_SEC;
  const mid = (PROVISIONAL_RIPPLE_REAL_SEC + PROVISIONAL_RIPPLE_CLONE_SEC) / 2;
  return mid + (base - mid) * k;
}

/* 向き直りの速さ(rad/s)。本体だけ一拍遅れる。 */
export function turnRate(isReal, observing){
  const k = tellContrast(observing);
  const base = isReal ? PROVISIONAL_TURN_REAL : PROVISIONAL_TURN_CLONE;
  const mid = (PROVISIONAL_TURN_REAL + PROVISIONAL_TURN_CLONE) / 2;
  return Math.max(0.5, mid + (base - mid) * k);
}

/* 攻撃前の予兆。長さと「引きの深さ」を返す ―― 見た目側(モーション)が
   depth を使って腕を引く量を決める。本体だけ大きく引く。 */
export function windupPlan(isReal, observing){
  const k = tellContrast(observing);
  const base = isReal ? PROVISIONAL_WINDUP_REAL_SEC : PROVISIONAL_WINDUP_CLONE_SEC;
  const mid = (PROVISIONAL_WINDUP_REAL_SEC + PROVISIONAL_WINDUP_CLONE_SEC) / 2;
  const dur = Math.max(0.12, mid + (base - mid) * k);
  return {dur, depth: isReal ? 1 : 0.45};
}

/* 波紋のタイマーを進める。間隔を跨いだら fire:true を返し、余りを残す
   ―― 呼び出し側は「今フレーム波紋を出すか」だけを見ればよい。 */
export function stepRipple(timer, dt, isReal, observing){
  const interval = rippleInterval(isReal, observing);
  let t = (timer || 0) + dt;
  if(t < interval) return {timer: t, fire: false};
  // 溜まりすぎた分は捨てる(一時停止から戻った直後に連発させない)
  return {timer: Math.min(t - interval, interval), fire: true};
}

/* 分身を散らされてから、本体がもう一度分身を出せるまで。 */
export function stepReform(timer, dt){
  const t = Math.max(0, (timer || 0) - dt);
  return {timer: t, ready: t <= 0};
}

/* 観測の灯が、その位置に届いているか。距離だけで決める ――
   「どれが本体か」には一切関与しない。 */
export function observeReaches(distance){
  return distance <= OBSERVE_RADIUS;
}
