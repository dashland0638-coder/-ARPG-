/* 公開中のビルドと、いま動いているビルドが違うかを判定する(UI-002-H 追補 2)。

   実機(iPhone のホーム画面アプリ・Safari)は、新しいビルドを公開した後も古い index.html と
   その JS を使い続けることがある。古いビルドが動いていると、直したはずの表示が残って見える。
   起動時に version.json(キャッシュを使わずに読む)の build と、JS に埋め込んだ build を
   比べ、違えばタイトル画面のうちに 1 回だけ再読み込みする。読み直す先の URL に
   ?build=<新しい build> を付ける。読み直した後もまだ古いビルドだった時は、URL の印を見て
   繰り返さない(sessionStorage が使えない端末でも止まる)。印の付いた URL は HTTP キャッシュとも
   別になるので、新しい index.html を読みやすい */

/** 'reload' か 'none' */
export function buildCheckAction({ localBuild, remoteBuild, reloadedFor, started } = {}) {
  if (!localBuild || localBuild === 'dev') return 'none';            // 開発サーバーでは見ない
  if (typeof remoteBuild !== 'string' || !remoteBuild) return 'none'; // 読めなかった
  if (remoteBuild === localBuild) return 'none';
  if (reloadedFor === remoteBuild) return 'none';                     // 既に 1 回読み直した
  if (started) return 'none';                                         // プレイ中は読み直さない
  return 'reload';
}

/** メニューに出すバージョンの文字列 */
export function versionLabel(version, build) {
  const v = 'ver ' + (version || '0.0.0');
  return build && build !== 'dev' ? `${v} (${build})` : v;
}

const MARK = 'build';

/** URL の検索文字列にある「この build へ読み直した」の印(無ければ null) */
export function reloadMarker(search) {
  return new URLSearchParams(search || '').get(MARK);
}

/** 読み直す先の URL。ほかの検索条件(?dev=1 等)と # はそのまま残す */
export function reloadUrl(href, remoteBuild) {
  const u = new URL(href);
  u.searchParams.set(MARK, remoteBuild);
  return u.toString();
}
