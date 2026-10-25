/* PR ごとの実機確認プレビュー(DEV-PREVIEW-001)。

   ■ 何をするか
   GitHub Pages の公開版(https://<owner>.github.io/-ARPG-/)は main を出す。PR のコードは、同じサイトの
   /-ARPG-/pr/<PR 番号>/ に「プレビュー」として別に建てる(.github/workflows/deploy.yml)。
   プレビューのビルドだけに、PR 番号と commit を埋め込む(vite.config.js の __PREVIEW__)。

   ■ main の公開版と混ざらないように
   ・画面の上端に「PR #N プレビュー・commit」の帯を出す(main の公開版には出ない)
   ・セーブ・設定の localStorage のキーに「preview-prN:」を付ける。GitHub Pages は同じ origin
     (<owner>.github.io)なので、付けないと PR のコードが main の公開版のセーブを読み書きしてしまう

   state・THREE・DOM に依存しない(ARCHITECTURE.md の core/ の作法)。DOM は呼び出し側(src/preview-banner.js)。 */

export const REPO_NAME = '-ARPG-';

/* ビルドに埋め込まれた値(__PREVIEW__)を確かめて返す。プレビューでなければ null */
export function previewInfo(raw){
  if(!raw || typeof raw !== 'object') return null;
  const pr = Number(raw.pr);
  const sha = typeof raw.sha === 'string' ? raw.sha.toLowerCase() : '';
  if(!Number.isInteger(pr) || pr <= 0) return null;
  if(!/^[0-9a-f]{7,40}$/.test(sha)) return null;
  return {pr, sha};
}

/* プレビューのセーブ・設定のキー。main の公開版(info が null)はキーをそのまま使う */
export function previewStorageKey(key, info){
  return info ? `preview-pr${info.pr}:${key}` : key;
}

/* 帯の文言。commit は 7 桁 */
export function previewBannerText(info){
  if(!info) return '';
  return `🔍 PR #${info.pr} プレビュー ・ ${info.sha.slice(0, 7)} ・ main の公開版ではありません`;
}

/* プレビューの base path(Vite の base)。末尾は / */
export function previewBase(pr, repo = REPO_NAME){
  const n = Number(pr);
  if(!Number.isInteger(n) || n <= 0) throw new Error(`bad PR number: ${pr}`);
  return `/${repo}/pr/${n}/`;
}

/* プレビューの URL。dev:true でテストモードの入口(?dev=1)付き */
export function previewUrl(owner, pr, {dev = false, repo = REPO_NAME} = {}){
  const host = `${String(owner).toLowerCase()}.github.io`;
  return `https://${host}${previewBase(pr, repo)}${dev ? '?dev=1' : ''}`;
}

/* main の公開版の URL */
export function mainUrl(owner, {dev = false, repo = REPO_NAME} = {}){
  return `https://${String(owner).toLowerCase()}.github.io/${repo}/${dev ? '?dev=1' : ''}`;
}
