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

test('コンボ(中央の領域の右下に少し入る固定位置)と、先に出た処刑の両方を避ける', () => {
  const vp = { w: 844, h: 390 };
  const size = { w: 135, h: 36 };
  // 844×390・safe-area(右 47 / 下 21)のコンボの矩形(main.css の値から)
  const combo = { left: 627, top: 287, right: 691, bottom: 305 };
  const rect = p => ({ left: p.left, top: p.top, right: p.left + size.w, bottom: p.top + size.h });
  // 対象が画面右下 → 領域の右下へ寄る位置がコンボに重なる
  const exec = placeAnchoredPrompt({ anchor: { x: 800, y: 380, onScreen: true }, size, viewport: vp, avoid: [combo] });
  assert.equal(overlaps(rect(exec), combo), false);
  assert.ok(inside(exec, size, gameplayZone(vp.w, vp.h)));
  // インタラクトは処刑とコンボの両方を避ける
  const isz = { w: 222, h: 35 };
  const it = placeAnchoredPrompt({ anchor: { x: 790, y: 370, onScreen: true }, size: isz, viewport: vp, avoid: [combo, rect(exec)] });
  const ir = { left: it.left, top: it.top, right: it.left + isz.w, bottom: it.top + isz.h };
  assert.equal(overlaps(ir, combo), false);
  assert.equal(overlaps(ir, rect(exec)), false);
  assert.ok(inside(it, isz, gameplayZone(vp.w, vp.h)));
});

/* TF-03: CI で記録された重なり(#64 / #66)。スティックの右端は 405.109 / 452.109(%指定の幅で端数が出る)。
   対象の点が少しずつ動くと、端数のある左端(例 452.3)は重ならないと判定され、返す位置の Math.round で
   452 になって 0.109px 重なっていた。返す(丸めた)位置で重ならないこと */
test('TF-03: 丸めた後の位置でもスティック領域(端数のある矩形)に重ならない', () => {
  const vp = { w: 844, h: 390 };
  const size = { w: 176, h: 35 };
  for (const joy of [{ left: 0, top: 210.609, right: 405.109, bottom: 390 }, { left: 47, top: 210.609, right: 452.109, bottom: 390 }]) {
    for (let x = joy.right + 80; x <= joy.right + 100; x += 0.05) {
      for (let y = 200; y <= 240; y += 0.5) {
        const p = placeAnchoredPrompt({ anchor: { x, y, onScreen: true }, size, viewport: vp, avoid: [joy] });
        const r = { left: p.left, top: p.top, right: p.left + size.w, bottom: p.top + size.h };
        assert.equal(overlaps(r, joy), false, `anchor ${x.toFixed(2)},${y} → ${JSON.stringify(r)} / ${JSON.stringify(joy)}`);
      }
    }
  }
});

/* legacy 側(14-hud-boot.js updateCombatPromptPositions)が、出ているコンボの矩形を処刑・インタラクトの
   avoid に渡していること(Review Round 1。位置の計算そのものは上の unit で確かめている) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
test('legacy: 処刑・インタラクトの配置がコンボ(と処刑)を避ける', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const src = fs.readFileSync(path.join(root, 'src/legacy/parts/14-hud-boot.js'), 'utf8');
  const start = src.indexOf('function updateCombatPromptPositions(');
  assert.ok(start >= 0);
  const body = src.slice(start, src.indexOf('\n  }\n', start)).replace(/\/\/.*$/gm, '');
  assert.match(body, /getElementById\('combo-indicator'\)/);
  assert.match(body, /classList\.contains\('show'\)[\s\S]*avoid\.push\(/, 'コンボが出ていれば avoid に入れる');
  assert.match(body, /placePromptOverWorld\(el, target\.group\.position, EXECUTE_PROMPT_LIFT, avoid/, '処刑はコンボを避ける');
  assert.match(body, /avoid\.push\(placePromptOverWorld\(el/, '処刑の矩形もインタラクトの avoid に入る');
  assert.match(body, /placePromptOverWorld\(it, interactTargetWorldPos\(\) \|\| state\.pos, INTERACT_PROMPT_LIFT, avoid\)/, 'インタラクトはコンボと処刑を避ける');
});

/* ---- UI-002-D WI-D7(統合監査): 入力領域を避ける・押している間は止める・ボスバーの左端 ---- */

test('844×390: スティック領域(中央の領域の左下に入る)を避ける。対象が映っていない時の下中央も', () => {
  const vp = { w: 844, h: 390 };
  const z = gameplayZone(vp.w, vp.h);
  const size = { w: 222, h: 35 };
  for (const joy of [{ left: 0, top: 211, right: 405, bottom: 390 }, { left: 47, top: 211, right: 452, bottom: 390 }]) {
    for (const anchor of [{ x: 0, y: 0, onScreen: false }, { x: 300, y: 300, onScreen: true }, { x: 200, y: 260, onScreen: true }, { x: 420, y: 330, onScreen: true }]) {
      const p = placeAnchoredPrompt({ anchor, size, viewport: vp, avoid: [joy] });
      const r = { left: p.left, top: p.top, right: p.left + size.w, bottom: p.top + size.h };
      assert.equal(overlaps(r, joy), false, `${JSON.stringify(anchor)} / ${JSON.stringify(joy)}`);
      assert.ok(inside(p, size, z));
    }
  }
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const hudBoot = fs.readFileSync(path.join(root, 'src/legacy/parts/14-hud-boot.js'), 'utf8');
const fnBody = (src, name) => {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  return src.slice(start, src.indexOf('\n  }\n', start)).replace(/\/\/.*$/gm, '');
};

test('legacy: 処刑・インタラクトは見えていて押せる入力領域(スティック・Action ボタン)を避ける', () => {
  const rects = fnBody(hudBoot, 'promptInputAvoidRects');
  assert.match(rects, /#joy-zone, \.action-btn/);
  assert.match(rects, /pointerEvents === 'none'/, '押せない表示専用(PC の能力表示)は除く');
  assert.match(fnBody(hudBoot, 'updateCombatPromptPositions'), /const avoid = promptInputAvoidRects\(\);/);
});

test('legacy: 押している間はプロンプトの位置を書き換えない(押した指が離れるまで)', () => {
  assert.match(hudBoot, /\['execute-prompt', 'interact-btn'\]\.forEach[\s\S]*?addEventListener\('pointerdown', e=>\{ heldPrompts\.set\(el, e\.pointerId\); \}\)/);
  assert.match(hudBoot, /\['pointerup', 'pointercancel'\]\.forEach[\s\S]*?heldPrompts\.delete\(el\)/);
  const place = fnBody(hudBoot, 'placePromptOverWorld');
  assert.ok(place.indexOf('heldPrompts.has(el)') >= 0 && place.indexOf('heldPrompts.has(el)') < place.indexOf('el.style.left'), '書く前に押しているかを見る');
});

test('TF-03 legacy: 置く幅は実際の幅を切り上げる(offsetWidth の切り捨てで右側の矩形に食い込まない)', () => {
  const place = fnBody(hudBoot, 'placePromptOverWorld');
  assert.match(place, /w: Math\.max\(el\.offsetWidth, Math\.ceil\(br\.width\)\)/);
  assert.match(place, /h: Math\.max\(el\.offsetHeight, Math\.ceil\(br\.height\)\)/);
});

test('CSS: 844×390 のボスバー・制限時間の左端は Character パネルの実際の右端(--hud-tl-right)+ 8px', () => {
  const css = fs.readFileSync(path.join(root, 'src/styles/main.css'), 'utf8');
  const left = 'left:calc(var(--hud-tl-right, calc(16px + 348px + env(safe-area-inset-left))) + 8px)';
  for (const sel of ['#boss-bar-wrap{', '#scenario-timer{']) {
    const blocks = css.split(sel).slice(1).map(b => b.slice(0, b.indexOf('}')));
    assert.ok(blocks.some(b => b.includes(left)), sel);
  }
  assert.match(hudBoot, /new ResizeObserver\(writePanelRight\)\.observe\(panel\)/);
  assert.match(hudBoot, /setProperty\('--hud-tl-right', r\.right \+ 'px'\)/);
});
