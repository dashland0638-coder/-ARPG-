/* PR ごとの実機確認プレビューの帯(DEV-PREVIEW-001、src/core/dev-preview.js)。
   プレビューのビルド(__PREVIEW__ に PR 番号と commit が入る)でだけ、画面の上端に「PR #N プレビュー・commit」を出し、
   タブの題名にも [PR #N] を付ける。main の公開版・手元の開発では何もしない。
   操作の邪魔をしないよう、押せない(pointer-events: none)細い帯にする */
import { previewInfo, previewBannerText } from './core/dev-preview.js';

const info = previewInfo(typeof __PREVIEW__ === 'object' ? __PREVIEW__ : null);
if (info) {
  const el = document.createElement('div');
  el.id = 'preview-banner';
  el.textContent = previewBannerText(info);
  el.setAttribute('role', 'status');
  Object.assign(el.style, {
    position: 'fixed', top: 'env(safe-area-inset-top, 0px)', left: '50%', transform: 'translateX(-50%)',
    zIndex: '2147483000', pointerEvents: 'none', padding: '2px 10px', borderRadius: '0 0 6px 6px',
    background: 'rgba(170, 40, 120, 0.85)', color: '#fff', font: '600 11px/1.4 system-ui, sans-serif',
    whiteSpace: 'nowrap', maxWidth: '96vw', overflow: 'hidden', textOverflow: 'ellipsis',
  });
  document.body.appendChild(el);
  document.title = `[PR #${info.pr}] ${document.title}`;
}
