/* テスト専用のホーム画面アプリ(TEST-PWA-ENTRY-001)。

   ■ 何のためか
   通常のホーム画面アプリ(manifest.webmanifest の start_url は "./")は ?dev=1 を持たないので、
   テストモードの入口が出ない。テスト専用の入口ページ(test/index.html)と別のマニフェスト
   (manifest-test.webmanifest)を用意し、そこからゲームを ?dev=1&app=test で開く。

   ■ URL の印
   ・dev=1 … 既存の開発用 UI の印(core/dev-ui.js)。テストモードの入口を出す
   ・app=test … テスト専用アプリから開いた印。dev=1 と一緒の時だけ効く。
     通常のプレイの開始(「はじめる」= 通常のセーブを消して始める、「つづきから」)を
     出さない ―― テスト用のアイコンから誤って通常のセーブを触らないため
   どちらも保存しない(URL にだけ持つ)。通常の URL で開き直せば通常版。

   state・THREE・DOM に依存しない(ARCHITECTURE.md の core/ の作法)。 */
import { devUiEnabled } from './dev-ui.js';

export const TEST_APP_PARAM = 'app';
export const TEST_APP_VALUE = 'test';
// 読み直しの印(core/build-check.js)。入口からゲームへ行く時は持ち越さない(新しく開くので)
const BUILD_MARK = 'build';

/* テスト専用アプリとして開いているか。dev=1 が無ければ app=test だけでは効かない */
export function isTestApp(search){
  return devUiEnabled(search) && new URLSearchParams(search || '').get(TEST_APP_PARAM) === TEST_APP_VALUE;
}

/* 入口ページ(…/test/ または …/test/index.html)から、ゲーム本体(1 つ上の階層)を
   テスト専用アプリとして開く URL。GitHub Pages のサブパス(/-ARPG-/)でも開発サーバー(/)でも、
   入口の場所から相対で決める。入口に付いていた他の検索条件は残し、dev / app は上書き、
   読み直しの印(build)と # は落とす */
export function testAppGameUrl(entryHref){
  const entry = new URL(entryHref);
  /* 末尾の / が無い …/test でも、入口のフォルダ(…/test/)として扱う(GitHub Pages は / を足して
     転送するが、開発サーバー・preview はそのまま返すため)。index.html などのファイル名はそのまま */
  const dir = new URL(entry);
  if(!dir.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(dir.pathname)) dir.pathname += '/';
  const u = new URL('../', dir);
  entry.searchParams.forEach((v, k)=>{ if(k !== BUILD_MARK) u.searchParams.append(k, v); });
  u.searchParams.set('dev', '1');
  u.searchParams.set(TEST_APP_PARAM, TEST_APP_VALUE);
  u.hash = '';
  return u.toString();
}

/* ホーム画面から起動されたか(Safari のタブで開いた入口ページでは false)。
   iOS は navigator.standalone、ほかは display-mode のメディアクエリ */
export function launchedFromHomeScreen({navigatorStandalone, displayStandalone, displayFullscreen} = {}){
  return !!(navigatorStandalone || displayStandalone || displayFullscreen);
}
