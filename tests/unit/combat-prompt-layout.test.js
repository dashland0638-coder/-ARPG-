/* 処刑・インタラクトの表示位置(UI-002-D WI-D6、core/combat-prompt-layout.js) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { gameplayZone, ndcToScreen, placeAnchoredPrompt, GAMEPLAY_ZONE_RATIO } from '../../src/core/combat-prompt-layout.js';

const inside = (p, size, z) => p.left >= z.left && p.top >= z.top && p.left + size.w <= z.right && p.top + size.h <= z.bottom;
const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test('中央 60%×60% の領域', () => {
  assert.equal(GAMEPLAY_ZONE_RATIO, 0.2);
  assert.deepEqual(gameplayZone(1000, 500), { left: 200, top: 100, right: 800, bottom: 400 });
});

test('NDC → 画面座標。カメラの後ろ・画面外は onScreen=false', () => {
  assert.deepEqual(ndcToScreen({ x: 0, y: 0, z: 0.5 }, 800, 400), { x: 400, y: 200, onScreen: true });
  assert.deepEqual(ndcToScreen({ x: -1, y: 1, z: 0.9 }, 800, 400), { x: 0, y: 0, onScreen: true });
  assert.equal(ndcToScreen({ x: 0, y: 0, z: 1.2 }, 800, 400).onScreen, false);
  assert.equal(ndcToScreen({ x: 1.5, y: 0, z: 0.5 }, 800, 400).onScreen, false);
  assert.equal(ndcToScreen(null, 800, 400).onScreen, false);
});

test('対象の上に下端中央が来る(中央の領域の中なら、そのまま)', () => {
  const p = placeAnchoredPrompt({ anchor: { x: 640, y: 400, onScreen: true }, size: { w: 136, h: 36 }, viewport: { w: 1280, h: 800 } });
  assert.deepEqual(p, { left: 572, top: 354, anchored: true });
});

test('中央の領域の外の対象でも、表示は領域の中へ収まる(周りのゾーンを覆わない)', () => {
  const vp = { w: 844, h: 390 };
  const z = gameplayZone(vp.w, vp.h);
  for (const anchor of [{ x: 10, y: 10 }, { x: 840, y: 385 }, { x: 420, y: 20 }, { x: 830, y: 200 }]) {
    const size = { w: 222, h: 35 };
    const p = placeAnchoredPrompt({ anchor: { ...anchor, onScreen: true }, size, viewport: vp });
    assert.ok(inside(p, size, z), JSON.stringify({ anchor, p }));
  }
});

test('対象が映っていなければ、中央の領域の下寄り・左右中央', () => {
  const p = placeAnchoredPrompt({ anchor: { x: 0, y: 0, onScreen: false }, size: { w: 136, h: 36 }, viewport: { w: 1280, h: 800 } });
  assert.deepEqual(p, { left: 572, top: 604, anchored: false });
});

test('avoid(先に出ている処刑)と重ならない。上が空いていなければ下、どちらも無理なら横へ', () => {
  const vp = { w: 1280, h: 800 };
  const size = { w: 222, h: 35 };
  const exec = { left: 572, top: 354, right: 708, bottom: 390 };
  const p = placeAnchoredPrompt({ anchor: { x: 640, y: 400, onScreen: true }, size, viewport: vp, avoid: [exec] });
  assert.equal(overlaps({ left: p.left, top: p.top, right: p.left + size.w, bottom: p.top + size.h }, exec), false);
  // 上端に貼りついた処刑 → 下へ
  const execTop = { left: 529, top: 160, right: 751, bottom: 196 };
  const q = placeAnchoredPrompt({ anchor: { x: 640, y: 170, onScreen: true }, size, viewport: vp, avoid: [execTop] });
  assert.equal(overlaps({ left: q.left, top: q.top, right: q.left + size.w, bottom: q.top + size.h }, execTop), false);
  assert.ok(q.top >= execTop.bottom);
  // 844×390: 処刑が領域の高さをほぼ埋めていても、横へずらして重ならない
  const small = { w: 844, h: 390 };
  const tall = { left: 300, top: 78, right: 440, bottom: 312 };
  const r = placeAnchoredPrompt({ anchor: { x: 370, y: 200, onScreen: true }, size: { w: 135, h: 36 }, viewport: small, avoid: [tall] });
  assert.equal(overlaps({ left: r.left, top: r.top, right: r.left + 135, bottom: r.top + 36 }, tall), false);
  assert.ok(inside(r, { w: 135, h: 36 }, gameplayZone(844, 390)));
});
