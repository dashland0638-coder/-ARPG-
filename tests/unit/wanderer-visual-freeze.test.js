/* CHARACTER-VIS-002 T-0: 影の旅人の見た目を、4職の造形の改善から切り離して固定する。
   影の旅人(DEC-034)は以前、剣士の BUILD の行を共有し(buildPlayer のフォールバックと、加入前の姿
   buildRoadTravelerFigure の BUILD.warrior)、頭・髪・衣服の Loft も共通の関数の既定の結果を使う。
   CHARACTER-VIS-002 では「共通の関数の既定の結果は変えず、4職はオプションで改善を選ぶ」方針
   (.ai/tasks/CHARACTER-VIS-002.md T-0 Step 1b / AD-3)なので、ここでは:
     ・BUILD.wanderer が独立の行で、値が DEC-034 完成時(剣士の行の 2026-11-24 時点の写し)のまま
     ・加入後(buildPlayer)と加入前(buildRoadTravelerFigure)がどちらも BUILD.wanderer を使う
     ・共通の関数の既定値(頭の断面の比率・奥行き・目の板の点数)が今のまま
   をソースから確かめる。生成された形(頂点数・外接箱・Material)そのものの不変は
   tests/character-visual-budget.spec.js が実際のゲームで確かめる。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const rig = read('05-rendering-rig.js');
const player = read('06-player-enemy.js');
const road = read('14-dungeon-road.js');

/* BUILD のある行(キー: { ... })をオブジェクトとして取り出す */
function buildRow(key){
  const a = rig.indexOf('const BUILD = {');
  assert.ok(a >= 0, 'const BUILD');
  const k = rig.indexOf(`\n    ${key}: {`, a);
  assert.ok(k >= 0, `BUILD.${key}`);
  const open = rig.indexOf('{', k);
  const close = rig.indexOf('}', open);
  return Function(`return (${rig.slice(open, close + 1)});`)();
}

const WANDERER_FROZEN = {
  stature:2.54, headR:0.254, hairR:0.2735, headGap:0.29,
  height:0.796, hipY:1.20, thighLen:0.615, calfLen:0.585,
  upperLen:0.42, foreLen:0.40,
  chest:0.24, shoulderOut:0.060, hipR:0.20, pelvisH:0.30, pelvisDrop:0.27,
  stanceW:0.110, thigh:0.095, calf:0.075, upper:0.070, forearm:0.058, neck:0.065,
  strideAmp:1.00, armSwing:1.00, hipSway:0.55, shoulderRoll:1.15,
  bobAmp:1.05, kneeLift:1.00, idleShift:0.7,
};

test('BUILD.wanderer は独立の行で、値は DEC-034 完成時のまま(剣士の行を変えても変わらない)', () => {
  assert.deepEqual(buildRow('wanderer'), WANDERER_FROZEN);
  // 整合(checkBuild と同じ式)
  const B = WANDERER_FROZEN;
  assert.ok(Math.abs(B.hipY - (B.thighLen + B.calfLen)) < 1e-3);
  assert.ok(Math.abs(B.stature - (B.hipY + B.height + B.headGap + B.headR)) < 1e-3);
  // BUILD.warrior を参照・複製して作っていない(剣士の変更が伝わる書き方をしない)
  assert.doesNotMatch(rig, /wanderer\s*:\s*(BUILD\.warrior|Object\.assign|\{\s*\.\.\.)/);
});

test('加入後(buildPlayer)と加入前(buildRoadTravelerFigure)がどちらも BUILD.wanderer を使う', () => {
  assert.match(player, /const buildKey = classDef\.charKey === 'wanderer' \? 'wanderer' : classDef\.key;\n\s*const B = BUILD\[buildKey\] \|\| BUILD\.warrior;/);
  const fig = road.slice(road.indexOf('function buildRoadTravelerFigure('), road.indexOf('function buildRoadTravelerFigure(') + 400);
  assert.match(fig, /const B = BUILD\.wanderer;/);
  assert.doesNotMatch(fig, /BUILD\.warrior/);
});

test('共通の関数の既定値は今のまま(4職の改善はオプションで選ぶ。既定の結果を使う影の旅人は変わらない)', () => {
  // 頭の断面の比率(makeCharacterHead / headRatioAt / 髪の殻の既定)
  for (const line of [
    "chin:      { yFrac:0.00, widthMul:0.38, nosePush:0.03 }",
    "jaw:       { yFrac:0.22, widthMul:0.72, nosePush:0.08 }",
    "cheek:     { yFrac:0.52, widthMul:1.06, nosePush:0.04 }",
    "upperHead: { yFrac:0.80, widthMul:0.92, nosePush:0.00 }",
    "crown:     { yFrac:1.00, widthMul:0.60, nosePush:0.00 }",
  ]) assert.ok(rig.includes(line), line);
  assert.match(rig, /const DEPTH_TO_WIDTH_RATIO = 0\.80;/);
  assert.match(rig, /const HEAD_DEPTH_MUL = 0\.85;/);
  assert.match(rig, /const HEAD_BACK_Z = -0\.05;/);
  // 目の板の既定の点数(白目 8・瞳 6・ハイライト 4)。T-1 で4職は引数 n で点数を選ぶが、省略時は既定のまま
  assert.match(rig, /function makeEyeSclera\(rx, ry, halfDepth, n\)\{\n\s*return makePlate\(makeEyeOutline\(n \|\| 8, rx, ry\)/);
  assert.match(rig, /function makeEyePupil\(r, halfDepth, n\)\{\n\s*return makePlate\(makeEyeOutline\(n \|\| 6, r, r\)/);
  assert.match(rig, /function makeEyeHighlight\(r, halfDepth, n\)\{\n\s*return makePlate\(makeEyeOutline\(n \|\| 4, r, r\)/);
  // 4職だけが改善を選ぶ(影の旅人は既定の頭の断面・目の点数・首)
  assert.match(player, /const softHead = classDef\.charKey !== 'wanderer';/);
  assert.match(player, /const headSections = softHead \? HEAD_SECTIONS_V3 : undefined;/);   // T-2R-3: 4職の頭の表の名前(影の旅人は undefined = 既定のまま)
  assert.match(player, /const eyePts = softHead \? \{sclera:16, pupil:12, highlight:8\} : \{\};/);
  // 頭の断面の既定(HEAD_SECTION_RATIOS)を読む関数は、表を渡されなければ既定を使う
  assert.match(rig, /function headRatioAt\(yFrac, table\)\{\n\s*const secs = Object\.values\(table \|\| HEAD_SECTION_RATIOS\);/);
});
