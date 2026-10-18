/* 公開中のビルドと、いま動いているビルドが違うかを判定する(UI-002-H 追補 2)。

   実機(iPhone のホーム画面アプリ・Safari)は、新しいビルドを公開した後も古い index.html と
   その JS を使い続けることがある。古いビルドが動いていると、直したはずの表示が残って見える。
   起動時に version.json(キャッシュを使わずに読む)の build と、JS に埋め込んだ build を
   比べ、違えばタイトル画面のうちに 1 回だけ再読み込みする。同じ build への再読み込みは
   1 セッションに 1 回まで(読み直しても古いままだった時に繰り返さない) */

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
