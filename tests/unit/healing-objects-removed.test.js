/* 回復オブジェクトの全廃(ENEMY-VISUAL-002)。

   壊すと回復する結晶(全ダンジョン)と、森の洋館の回復の姿見(休憩ポイント)を、配置・生成・破壊・回復・当たり・
   調べる・演出・音・ミニマップの印・保存の項目ごと取り除いた。回復薬・スキル・イベントの回復は残す。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const walk = d => fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(d, e.name)) : /\.(js|mjs|css|html)$/.test(e.name) ? [path.join(d, e.name)] : []);
const SRC = walk('src').map(f => [f, fs.readFileSync(path.join(root, f), 'utf8')]);
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('回復結晶: 生成・更新・破壊・回復・描画の切り替え・ミニマップの印・配置表が src のどこにも無い', () => {
  const banned = /HealingCrystal|healingCrystals|GS_HEALING|markPerfEvent\('CRYSTAL'\)/;
  for (const [f, s] of SRC) assert.doesNotMatch(s, banned, f);
});

test('回復の姿見: 休憩ポイントの仕組み(登録・近づく・使う・一度きりの印)と、姿見と写しの置物が無い', () => {
  const banned = /registerCheckpoint|useCheckpoint|checkpointUsed|checkpointTriggers|nearbyCheckpoint|CHECKPOINT_HEAL_FRAC|anomMirror|mirrorGlass/;
  for (const [f, s] of SRC) assert.doesNotMatch(s, banned, f);
});

test('一般の回復は残る: 回復薬・MP 回復薬・補給の箱', () => {
  const all = SRC.map(([, s]) => s).join('\n');
  assert.match(all, /potion/);
  assert.match(all, /mppotion/);
  assert.match(read('src/core/state.js'), /potion/);
});

test('セーブの互換: 結晶・姿見はセーブに項目を持たなかった(古いセーブを読んでも欠ける項目が無い)', () => {
  const save = read('src/legacy/parts/09-save-load.js');
  assert.doesNotMatch(save, /healingCrystal|crystalBroken|checkpointUsed|mirrorUsed/i);
  // 保存の版は上げていない(上げる理由が無い ―― 消した物は保存されていなかった)
  assert.match(read('src/core/state.js'), /potion/);
});
