/* テスト専用の入口ページ(test/index.html)の動き(TEST-PWA-ENTRY-001)。
   ・「テストモードを開く」のリンク先を、入口の場所から正しく作り直す(サブパスでも、他の検索条件があっても)
   ・ホーム画面から起動された時は、案内を出さずにすぐゲーム(テストモード)へ移る。
     マニフェストの start_url を使わずにこのページ自身の URL で起動する端末でも、テストモードで開くため */
import { testAppGameUrl, launchedFromHomeScreen } from './core/pwa-entry.js';

const gameUrl = testAppGameUrl(location.href);
const link = document.getElementById('open-test');
if (link) link.href = gameUrl;

const mq = q => (typeof matchMedia === 'function' ? matchMedia(q).matches : false);
if (launchedFromHomeScreen({
  navigatorStandalone: navigator.standalone === true,
  displayStandalone: mq('(display-mode: standalone)'),
  displayFullscreen: mq('(display-mode: fullscreen)'),
})) {
  document.body.classList.add('launching');
  location.replace(gameUrl);
}
