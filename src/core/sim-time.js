/* メインループのシミュレーションの時間(CI-001)。state・THREE・DOM に依存しない純粋関数。

   animate() はシミュレーションの 1 歩を 50ms(SIM_STEP_MAX)で頭打ちにしている(すり抜け・
   大きな飛びを防ぐため。COMBAT_DESIGN.md)。1 フレーム 1 歩なので、20fps を下回るとゲーム内の
   時間は実時間より遅れる。GPU の無い CI では描画が 3〜8fps しか出ず、その遅れ方が機械の速さ
   (CPU の数・混み具合)しだいで run ごとに変わっていた ―― 実時間で待つ E2E が、ある run では
   通り、別の run では落ちる原因になっていた。

   自動テストで操作されているブラウザ(isAutomatedBrowser)だけ、ゲーム内の時間を実時間の
   AUTOMATION_TIME_SCALE 倍に固定する。描画が AUTOMATION_MIN_FPS 以上出ていれば、機械の速さに
   関係なく同じ倍率で進む(1 歩は 50ms 以下のまま)。倍率は既存の E2E が書かれた環境
   (ヘッドレスで 1/3〜1/5 程度。各 spec の注記)に合わせてある。
   通常のプレイ(timeScale 1)はこれまでどおり min(0.05, フレーム間隔) */

export const SIM_STEP_MAX = 0.05;
export const AUTOMATION_TIME_SCALE = 0.25;
/* この fps 以上なら timeScale 倍がそのまま保たれる(1 歩 = フレーム間隔 × 0.25 ≦ 50ms) */
export const AUTOMATION_MIN_FPS = AUTOMATION_TIME_SCALE / SIM_STEP_MAX;

/* 自動テストで操作されているか。WebDriver の仕様で、Playwright・Selenium 等が操作する
   ブラウザでは navigator.webdriver が true になる(通常のブラウザでは false / undefined) */
export function isAutomatedBrowser(nav){
  return !!(nav && nav.webdriver === true);
}

/** シミュレーションの時間の倍率。自動テストだけ AUTOMATION_TIME_SCALE、通常は 1 */
export function simTimeScale(nav){
  return isAutomatedBrowser(nav) ? AUTOMATION_TIME_SCALE : 1;
}

/** frameDt(秒、前のフレームからの実時間)→ このフレームで進めるシミュレーションの時間(秒) */
export function simDeltaSeconds(frameDt, timeScale = 1){
  const f = Number.isFinite(frameDt) && frameDt > 0 ? frameDt : 0;
  const s = Number.isFinite(timeScale) && timeScale > 0 ? timeScale : 1;
  return Math.min(SIM_STEP_MAX, f * s);
}
