/* 戦闘中の一時表示(処刑・インタラクト)の画面上の位置(UI-002-D WI-D6。HD-D16 / HD-D02)。
   state・THREE・scene に依存しない純粋関数(ARCHITECTURE.md)。

   対象(敵・扉など)を画面に投影した点の少し上に、表示の下端中央が来るように置く。
   置き場所は画面中央 60%×60% の領域(Gameplay Zone)の中に限る ―― 一時表示は中央に
   出てよく(HD-D02)、周りの Character / Mini-map / Action Zone(WI-D2〜D4)は中央の
   外にあるので、中央に収めればそれらのボタンを覆わない。
   avoid に渡した矩形(先に出ている表示・コンボ)とは重ならないよう、上か下(どちらも無理なら横)へずらす。 */

export const GAMEPLAY_ZONE_RATIO = 0.2;   // 中央 60%×60% = 各辺から 20%
export const PROMPT_ANCHOR_GAP = 10;      // 対象の点と表示の下端の間(px)

/** 画面中央 60%×60% の領域 */
export function gameplayZone(viewportW, viewportH){
  const r = GAMEPLAY_ZONE_RATIO;
  return { left: viewportW * r, top: viewportH * r, right: viewportW * (1 - r), bottom: viewportH * (1 - r) };
}

/* three.js の Vector3.project() の結果(NDC: x,y は -1..1、z > 1 はカメラの後ろ)を画面座標へ。
   画面に映っていない(カメラの後ろ・NDC の外)ときは onScreen=false */
export function ndcToScreen(ndc, viewportW, viewportH){
  const n = ndc || {};
  const onScreen = Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z)
    && n.z <= 1 && Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1;
  return { x: (n.x * 0.5 + 0.5) * viewportW, y: (-n.y * 0.5 + 0.5) * viewportH, onScreen };
}

const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* anchor: { x, y, onScreen }(画面座標)/ size: { w, h } / viewport: { w, h } / avoid: 矩形の配列
   → { left, top, anchored }(anchored: 対象の位置に追従できたか)。
   対象が映っていなければ、中央の領域の下寄り(以前の下中央の位置に近い所)に出す */
export function placeAnchoredPrompt({ anchor, size, viewport, avoid = [], gap = PROMPT_ANCHOR_GAP }){
  const zone = gameplayZone(viewport.w, viewport.h);
  const w = Math.min(size.w, zone.right - zone.left);
  const h = Math.min(size.h, zone.bottom - zone.top);
  const anchored = !!(anchor && anchor.onScreen);
  const ax = anchored ? anchor.x : viewport.w / 2;
  const ay = anchored ? anchor.y - gap : zone.bottom;
  let left = clamp(ax - w / 2, zone.left, zone.right - w);
  let top = clamp(ay - h, zone.top, zone.bottom - h);
  // 避ける矩形が複数あると、1 つを避けた結果が別の 1 つに重なりうるので、重なりが無くなるまで
  // 数回見直す(表示は 2〜3 個なので回数は小さくてよい)
  const list = avoid.filter(Boolean);
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const a of list) {
      // 返すのは丸めた位置なので、重なりも丸めた位置で見る(TF-03: 端数のある矩形の端から 0.5px 未満
      // 離れた位置が、丸めで矩形の内側へ入っていた)
      const rect = { left: Math.round(left), top: Math.round(top), right: Math.round(left) + w, bottom: Math.round(top) + h };
      if (!overlaps(rect, a)) continue;
      moved = true;
      const above = a.top - gap - h;
      const below = a.bottom + gap;
      if (above >= zone.top) top = above;
      else if (below + h <= zone.bottom) top = below;
      else left = a.right + gap + w <= zone.right ? a.right + gap : clamp(a.left - gap - w, zone.left, zone.right - w);
    }
    if (!moved) break;
  }
  return { left: Math.round(left), top: Math.round(top), anchored };
}
