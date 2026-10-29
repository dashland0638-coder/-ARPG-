/* 酒場 BGM の加入段階の選び方(MUSIC-BGM-TAVERN-002、core/tavern-bgm.js)。

   作曲アプリの 6 段階(剣士 → 魔法使い → 弓師 → 盗賊 → 影の旅人 → 完成版)を、第一章の進行のどこで鳴らすか。
   新しい進行状態は作らず、セーブ済みの scenarioClears と、いまの主人公(selectedClass)だけで決まる。
   キャストの表は 01-character-creation.js の CHAPTER_CAST を実物のまま読む。
   酒場への組み込み(buildWorld と毎フレームの見直し)はソースの形で確かめる。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tavernBgmStage, TAVERN_BGM_STAGES } from '../../src/core/tavern-bgm.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const parts = name=>fs.readFileSync(path.join(root, 'src/legacy/parts', name), 'utf8');
const CAST = (()=>{
  const src = parts('01-character-creation.js');
  const a = src.indexOf('const CHAPTER_CAST = [');
  const b = src.indexOf('\n  ];', a);
  return new Function(`return ${src.slice(src.indexOf('[', a), b + 4).replace(/\/\*[\s\S]*?\*\//g, '')}`)();
})();
const stage = (clears, classKey, finaleActive = false)=>tavernBgmStage({ clears, classKey, cast:CAST, finaleActive });
const C = (...keys)=>Object.fromEntries(keys.map(k=>[k, 1]));

test('第一章の流れ: 加入の会話の後で次の段階へ。道を終えた最後の会話の間は影の旅人、その後は完成版', () => {
  // はじめる(剣士ひとり)
  assert.equal(stage({}, 'warrior'), 'swordsman');
  // 洋館から戻った直後: 進行は魔法使いの段だが、交代の会話が終わるまで主人公は剣士 → 剣士の段のまま
  assert.equal(stage(C('mansion'), 'warrior'), 'swordsman');
  // 交代の会話の後
  assert.equal(stage(C('mansion'), 'mage'), 'mage');
  assert.equal(stage(C('mansion', 'duskvillage'), 'mage'), 'mage');
  assert.equal(stage(C('mansion', 'duskvillage'), 'archer'), 'archer');
  assert.equal(stage(C('mansion', 'duskvillage', 'ghostship'), 'archer'), 'archer');
  assert.equal(stage(C('mansion', 'duskvillage', 'ghostship'), 'rogue'), 'thief');
  // 時計塔の後も道の前は盗賊(影の旅人とは道の途中で会う)
  assert.equal(stage(C('mansion', 'duskvillage', 'ghostship', 'clocktower'), 'rogue'), 'thief');
  // 道で影の旅人と会ってから撤退・全滅して酒場へ: 進行は盗賊の段 → 盗賊の段(影の旅人の段に先走らない)
  assert.equal(stage(C('mansion', 'duskvillage', 'ghostship', 'clocktower'), 'wanderer'), 'thief');
  // 道を終えて戻った: 第一章の最後の会話の間は影の旅人の段、閉じたら完成版
  const all = C('mansion', 'duskvillage', 'ghostship', 'clocktower', 'road');
  assert.equal(stage(all, 'wanderer', true), 'shadow');
  assert.equal(stage(all, 'wanderer', false), 'complete');
  // ロード(最後の会話は持ち越さない)
  assert.equal(stage(all, 'wanderer'), 'complete');
});

test('セーブ・ロード: 同じ進行と主人公なら、いつ読んでも同じ段階。表に無い主人公は進行だけで決める', () => {
  for (const [clears, cls] of [[{}, 'warrior'], [C('mansion'), 'mage'], [C('mansion', 'duskvillage'), 'archer']]) {
    assert.equal(stage(clears, cls), stage(JSON.parse(JSON.stringify(clears)), cls));
  }
  // 古いセーブ(主人公が CHAPTER_CAST に無い職業)・主人公が未設定
  assert.equal(stage(C('mansion', 'duskvillage'), 'knight'), 'archer');
  assert.equal(stage(C('mansion'), null), 'mage');
  assert.equal(stage({}, undefined), 'swordsman');
  assert.equal(stage(undefined, 'warrior'), 'swordsman');
  // 飛び級の記録があっても、頭から連続でクリアした数で数える(core/chapter1-progress.js と同じ)
  assert.equal(stage(C('ghostship'), 'warrior'), 'swordsman');
  // 返すのは 6 段階のどれか
  for (const cls of ['warrior', 'mage', 'archer', 'rogue', 'wanderer', 'knight']) {
    for (let n = 0; n <= 5; n++) {
      const clears = C(...['mansion', 'duskvillage', 'ghostship', 'clocktower', 'road'].slice(0, n));
      for (const f of [false, true]) assert.ok(TAVERN_BGM_STAGES.includes(stage(clears, cls, f)), `${cls} ${n} ${f}`);
    }
  }
});

test('組み込み: 酒場を組むときにこの段階で鳴らし、酒場にいる間は毎フレーム見直す(交代の会話・最後の会話の後で切り替わる)', () => {
  const world = parts('02-world-common.js');
  assert.match(world, /playBgm\(key, bgmVariantForWorld\(key\)\);/);
  const hud = parts('14-hud-boot.js');
  const fn = hud.slice(hud.indexOf('function bgmVariantForWorld(key){'), hud.indexOf('function updateChapter1JoinFigure(dt){'));
  assert.match(fn, /if\(key !== 'tavern'\) return undefined;/);
  assert.match(fn, /clears: state\.scenarioClears, classKey: selectedClass, cast: CHAPTER_CAST,/);
  assert.match(fn, /finaleActive: roadPendingFinale \|\| state\.dialogueKind === 'chapter1Finale',/);
  assert.match(fn, /function updateTavernBgmStage\(\)\{\s*if\(currentWorldKey !== 'tavern'\) return;\s*setBgmVariant\('tavern', bgmVariantForWorld\('tavern'\)\);/);
  // 操作中と演出・会話中の両方のループから呼ぶ
  assert.equal((hud.match(/updateTavernBgmStage\(\);/g) || []).length, 2);
  // 最後の会話: 戻った酒場を組む(buildWorld)ときはまだ roadPendingFinale、その後すぐ chapter1Finale の会話になる
  const ui = parts('12-progression-ui.js');
  const ret = ui.slice(ui.indexOf('function returnToTownNow(isDefeat){'));
  assert.ok(ret.indexOf("buildWorld('tavern')") < ret.indexOf('consumeChapter1Finale()'));
  const road = parts('14-dungeon-road.js');
  assert.match(road.slice(road.indexOf('function playChapter1Finale(){')), /state\.dialogueKind = 'chapter1Finale';/);
});
