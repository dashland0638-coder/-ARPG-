/* CH1-COMP-W3-GHOST: 宵待ちの村の怪異を「幽霊・人型の影」にそろえる(見た目だけ)。
   1. 歩く怪異(記憶漁師・水門守の残響)は、脚が透ける影・裾から薄布・足元に霧の映り込み
   2. 泡沫は、泡から半身を起こす透ける人影(頭と肩)。塊の広がりの内側で、当たりの半径は変えない
   3. 透ける部品はマットで自発光なし、光源なし、新しい色を足さない(既存の配色だけ)
   4. ゾンビ・腐敗・骨の造形を持ち込まない。数値・判定・予兆の定数は変えない
   5. 変えない種類(水鏡の影・写し身・ボス)の作りは今のまま */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VILLAGE_GHOST, FOAM_FIGURE, foamFigureExtent, foamVisualRadius, foamHitRadius, FOAM_CLUSTER, VILLAGE_PALETTE,
  VILLAGE_PROPORTIONS, villageHitRadius, WARDEN_SCALE, MIRROR_STRIKE_RADIUS, FOAM_CONTACT_RADIUS, FOAM_SCALE,
} from '../../src/core/dusk-enemies.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const village = fs.readFileSync(path.join(root, 'src/legacy/parts/14-dungeon-duskvillage.js'), 'utf8');
function fn(name){
  const start = village.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `function ${name} が無い`);
  const next = village.indexOf('\n  function ', start + 10);
  return village.slice(start, next < 0 ? undefined : next);
}

test('歩く怪異: 脚は透ける影、裾から薄布、足元に霧の映り込み', () => {
  assert.deepEqual(VILLAGE_GHOST.ghostKinds, ['fisher', 'warden']);
  for(const v of [VILLAGE_GHOST.legOpacity, VILLAGE_GHOST.hemOpacity, VILLAGE_GHOST.poolOpacity]) assert.ok(v > 0.2 && v < 0.6, `透けるが消えない (${v})`);
  for(const [kind, f] of [['fisher', 'dressVillageFisher'], ['warden', 'dressVillageWarden']]){
    const src = fn(f);
    assert.match(src, new RegExp(`const ghostLeg = vGhostMat\\('${kind}\\.ghostLeg', pal\\.shade, VILLAGE_GHOST\\.legOpacity\\)`));
    assert.equal((src.match(/villageLimb\(g, x, [^\n]*ghostLeg/g) || []).length, 1, `${kind}: 脚は透ける材質`);
    assert.match(src, /villageGhostHem\(g, /, `${kind}: 薄布`);
    assert.match(src, /villageGhostPool\(g, /, `${kind}: 霧の映り込み`);
    assert.match(src, /walk:true/, `${kind}: 歩き方は今のまま`);
  }
  const helpers = fn('vGhostMat') + fn('villageGhostHem') + fn('villageGhostPool');
  assert.match(helpers, /transparent:true, opacity, depthWrite:false/);
  assert.doesNotMatch(helpers, /emissive|PointLight|SpotLight|MeshBasicMaterial/, '発光・光源で表さない');
  assert.match(fn('villageGhostPool'), /VILLAGE_PALETTE\.mirror\.water/, '水鏡の影と同じ素材の色(新しい色を足さない)');
});

test('泡沫: 泡から半身を起こす透ける人影。塊の内側で、当たりの半径は変えない', () => {
  assert.ok(foamFigureExtent() < foamVisualRadius(FOAM_CLUSTER), '人影の水平の広がりは塊の内側');
  assert.equal(foamHitRadius(FOAM_SCALE).toFixed(3), '0.337', '当たり 0.337(W3-E のまま)');
  const top = Math.max(...FOAM_CLUSTER.map(b => b.y + b.r));
  assert.ok(FOAM_FIGURE.head.y > top - 0.1 && FOAM_FIGURE.head.y < 1.1, '頭は塊の上から少し出る');
  assert.ok(FOAM_FIGURE.opacity >= 0.35 && FOAM_FIGURE.opacity <= 0.6);
  const src = fn('dressVillageFoam');
  assert.match(src, /vMatte\('foam\.figure', pal\.shade, VILLAGE_FINISH\.foam, \{transparent:true, opacity:F\.opacity, depthWrite:false\}\)/);
  assert.match(src, /M\.foamFigure = \{shoulders, head\}/);
  assert.match(fn('poseVillageFoam'), /M\.foamFigure/, '人影は呼吸とずれて揺れ、弾けた直後に沈む');
});

test('数値・判定・当たり・配色は今のまま、ゾンビ・骨の造形は無い', () => {
  assert.equal(MIRROR_STRIKE_RADIUS, 2.4);
  assert.equal(FOAM_CONTACT_RADIUS, 1.5);
  assert.equal(WARDEN_SCALE, 1.18);
  assert.equal(villageHitRadius('fisher', 1), 0.4);
  assert.equal(villageHitRadius('warden', WARDEN_SCALE).toFixed(3), (0.46 * 1.18).toFixed(3));
  assert.deepEqual(Object.keys(VILLAGE_PALETTE), ['mirror', 'foam', 'copy', 'fisher', 'warden', 'echoBoss'], '配色の種類は増やさない');
  assert.equal(VILLAGE_PROPORTIONS.fisher.hunch, 0.28, '漁師の背の丸みは個性として残す');
  const dress = ['dressVillageMirror', 'dressVillageFoam', 'dressVillageCopy', 'dressVillageFisher', 'dressVillageWarden', 'buildDuskEchoBody', 'buildEchoFigure'].map(fn).join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');   // コメントは除く
  assert.doesNotMatch(dress, /\b(skull|bones?|ribs?|rott\w*|gore|flesh|zombie|ghoul|corpse)\b|ゾンビ|腐|骸骨|肋骨|屍/i);
  assert.doesNotMatch(dress, /PointLight|SpotLight|new THREE\.\w*Light/);
});
