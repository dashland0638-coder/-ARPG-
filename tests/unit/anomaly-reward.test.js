/* 異空間の報酬(PROGRESSION-006)。第一章の本編では、異空間をクリアしても
   ランダム装備を付与しない(装備は固定・少数。ランダム装備は第一章クリア後)。
   本編/テストモードの切り替えは legacyGrowth()(= core/chapter1-rules.js の
   legacyGrowthEnabled。旧セーブ判定ではなく、新規プレイでも本編なら false)。

   異空間は 40% の乱数で出て、洋館の食堂はこの環境(software rendering)では歩いて
   着かない(tests/mansion-scenario.spec.js のメモ)ので、E2E ではなく
   grantAnomalyReward の実物のソースを stub 付きで動かして確かめる */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const world = fs.readFileSync(path.join(root, 'src/legacy/parts/02-world-common.js'), 'utf8');
const loot = fs.readFileSync(path.join(root, 'src/legacy/parts/08-loot-equipment.js'), 'utf8');

function fn(src, signature){
  const a = src.indexOf(signature);
  assert.ok(a >= 0, signature);
  return src.slice(a, src.indexOf('\n  }\n', a) + 4);
}

/* 本物の grantAnomalyReward と、それが通る 08 の入口(装備・素材・金貨)を
   同じスコープに並べる。乱数で選ぶ装備の中身(rollDropEquipment)だけ stub */
function run({ testMode, equipmentInventory = [], inventory = { gold: 0, gem: 0, shard: 0 } }){
  const state = { testMode, equipmentInventory, inventory };
  const logs = [];
  const code = [
    fn(loot, 'function addEquipmentItem(item){'),
    fn(loot, 'function maybeGrantEquipmentInstant(chance, rareChance){'),
    fn(loot, 'function grantGold(amount){'),
    fn(loot, 'function addItem(loot){'),
    fn(world, 'function grantAnomalyReward(){'),
    'grantAnomalyReward();',
  ].join('\n');
  const deps = {
    state,
    legacyGrowth: () => !!state.testMode,
    LEGACY_LOOT_TYPES: ['shard', 'gem'],
    rollDropEquipment: rare => ({ name: 'ランダムな剣', icon: '🗡️', identified: true, rarity: rare >= 0.4 ? 'rare' : 'normal' }),
    bossAbilityValue: () => 0,
    spawnLog: m => logs.push(m),
    spawnPickupPopup: () => {},
    sfx: () => {},
    document: { getElementById: () => null },
  };
  new Function(...Object.keys(deps), code)(...Object.values(deps));
  return { state, logs };
}

const STARTER = { name: '鉄の大剣', icon: '⚔️', starter: true, identified: true };

test('本編(新規プレイ): 異空間をクリアしても装備は増えない', () => {
  const { state } = run({ testMode: false });
  assert.equal(state.equipmentInventory.length, 0);
});

test('本編(旧セーブ): 既存の装備はそのまま残り、新しい装備は増えない', () => {
  const owned = [STARTER, { name: '旧セーブの未鑑定品', identified: false, itemLevel: 12 }];
  const { state } = run({ testMode: false, equipmentInventory: owned.slice() });
  assert.deepEqual(state.equipmentInventory, owned);
});

test('本編: 残る報酬は既存の金貨(20〜39)と演出だけ。💎 / 🔩 は既存の WI-A5 どおり出ない', () => {
  for (let i = 0; i < 20; i++) {
    const { state, logs } = run({ testMode: false });
    assert.ok(state.inventory.gold >= 20 && state.inventory.gold <= 39, String(state.inventory.gold));
    assert.equal(state.inventory.gem, 0);
    assert.equal(state.inventory.shard, 0);
    assert.ok(logs.includes('✨ 異空間の宝を手に入れた!'));
  }
});

test('テストモード: 変更前どおり装備が 1 つ(レア率 40% の抽選)付与される', () => {
  const { state } = run({ testMode: true, equipmentInventory: [STARTER] });
  assert.equal(state.equipmentInventory.length, 2);
  assert.equal(state.equipmentInventory[1].name, 'ランダムな剣');
  assert.equal(state.equipmentInventory[1].rarity, 'rare');
  assert.ok(state.inventory.gem + state.inventory.shard >= 2);
});

test('装備は本編ゲート付きの入口(maybeGrantEquipmentInstant)を通り、直接は付与しない', () => {
  const body = fn(world, 'function grantAnomalyReward(){');
  assert.match(body, /maybeGrantEquipmentInstant\(1\.0, 0\.4\)/);
  assert.doesNotMatch(body, /addEquipmentItem\(/);
  assert.match(fn(loot, 'function maybeGrantEquipmentInstant(chance, rareChance){').split('\n')[1], /if\(!legacyGrowth\(\)\) return;/);
});

test('異空間そのもの(出現率・呼び出し元)は変えない', () => {
  assert.match(world, /const ANOMALY_SPAWN_CHANCE = 0\.4;/);
  assert.equal(world.split('grantAnomalyReward()').length - 1, 2);   // 定義と、クリア時の 1 か所
  assert.match(fn(world, 'function updateAnomalyRifts(dt){'),
    /if\(!anomalyRoomState\.rewardGiven && anomalyRoomState\.mons\.every\(m=>m\.dead\)\)\{\s*anomalyRoomState\.rewardGiven = true;\s*grantAnomalyReward\(\);/);
});
