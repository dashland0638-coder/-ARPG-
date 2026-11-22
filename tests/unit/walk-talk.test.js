/* 歩きながらの掛け合いの共通部分と、第一章の横展開のデータ(WALK-TALK-CH1、DEC-029 / DEC-033) */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  newBanterState, queueBanter, stepBanter, dropCurrentBanter, walkTalkBlock, walkTalkPartyOk, walkTalkLines,
  BANTER_LINE_SEC, BANTER_GAP_SEC, WALK_TALK_STALE_SEC, WALK_TALK_COMBAT_BLOCK,
} from '../../src/core/walk-talk.js';
import { WALK_TALK_CH1, WALK_TALK_CH1_WORLDS } from '../../src/core/walk-talk-ch1.js';
import { CHAPTER1_ORDER } from '../../src/core/chapter1-progress.js';
import { DUSK_ROOMS } from '../../src/core/dusk-village-map.js';
import { GS_ROOMS } from '../../src/core/ghostship-map.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => fs.readFileSync(path.join(root, 'src/legacy/parts', f), 'utf8');
const walk = read('14-walk-talk.js');
const cc = read('01-character-creation.js');

/* 第一章の顔ぶれ(CHAPTER_CAST)を本物のソースから */
const CAST = {};
for (const m of cc.matchAll(/\{chapter:\d, classKey:'(\w+)',[^}]*guestClassKey:(?:'(\w+)'|null),\s*dungeonKey:'(\w+)'\}/g)) CAST[m[3]] = { lead: m[1], guest: m[2] || null };

const run = (st, sec, blocked, hard, step = 0.05) => { let last = null; for (let t = 0; t < sec; t += step) last = stepBanter(st, step, blocked, hard); return last; };

test('道(新)の状態(staleSec なし)は従来どおり: 止めている間はどれだけ長くても続きから', () => {
  const st = newBanterState();
  queueBanter(st, 'A', [['盗賊', '一'], ['弓師', '二']]);
  run(st, BANTER_GAP_SEC + 0.1, false);
  assert.equal(st.cur.text, '一');
  run(st, 30, true, true);
  assert.equal(st.cur.text, '一', '会話の窓で止めても捨てない');
  run(st, BANTER_LINE_SEC + BANTER_GAP_SEC + 0.2, false);
  assert.equal(st.cur && st.cur.text, '二');
});

test('横展開の状態: 会話の窓・演出で 3 秒より長く止まった話題は捨てる。戦闘・一時停止では捨てない', () => {
  const mk = () => { const st = newBanterState({ staleSec: WALK_TALK_STALE_SEC }); queueBanter(st, 'A', [['a', '一'], ['b', '二']]); queueBanter(st, 'B', [['a', '三']]); run(st, BANTER_GAP_SEC + 0.1, false); return st; };
  let st = mk();
  run(st, 20, true, false);   // 戦闘
  assert.equal(st.cur.text, '一');
  st = mk();
  run(st, WALK_TALK_STALE_SEC - 0.5, true, true);
  assert.equal(st.cur.text, '一', '短い演出なら続きから');
  run(st, 1, false);
  st = mk();
  run(st, WALK_TALK_STALE_SEC + 0.5, true, true);
  assert.equal(st.cur, null);
  assert.deepEqual(st.queue.map(q => q.id), ['B'], '今の話題(A)の残りだけを捨て、次の話題は残す');
  assert.equal(run(st, BANTER_GAP_SEC + 0.1, false).text, '三');
});

test('同じ話題はその出撃で 1 回だけ。dropCurrentBanter は今の話題だけ', () => {
  const st = newBanterState({ staleSec: 3 });
  assert.equal(queueBanter(st, 'A', [['a', '一']]), true);
  assert.equal(queueBanter(st, 'A', [['a', '一']]), false);
  queueBanter(st, 'B', [['b', '二']]);
  assert.equal(dropCurrentBanter(st), true);
  assert.deepEqual(st.queue.map(q => q.id), ['B']);
  assert.equal(queueBanter(st, 'A', [['a', '一']]), false, '捨てた話題も出し直さない');
});

test('止める理由: 会話の窓・演出 = hard、一時停止、戦闘の緊張(0.35 以上)', () => {
  assert.equal(walkTalkBlock({ dialogue: true }), 'hard');
  assert.equal(walkTalkBlock({ cutscene: true }), 'hard');
  assert.equal(walkTalkBlock({ paused: true }), 'pause');
  assert.equal(walkTalkBlock({ combat: WALK_TALK_COMBAT_BLOCK }), 'combat');
  assert.equal(walkTalkBlock({ combat: 0.34 }), null);
  assert.equal(WALK_TALK_COMBAT_BLOCK, 0.35, '道(新)の R3-1 と同じ');
});

test('顔ぶれ: 主人公と、今そばにいる支援の職業が合う時だけ', () => {
  const t = { lead: 'mage', guest: 'warrior' };
  assert.equal(walkTalkPartyOk(t, { lead: 'mage', guest: 'warrior', guestHere: true }), true);
  assert.equal(walkTalkPartyOk(t, { lead: 'mage', guest: 'warrior', guestHere: false }), false, '合流前(木橋で待っている)');
  assert.equal(walkTalkPartyOk(t, { lead: 'mage', guest: null, guestHere: false }), false);
  assert.equal(walkTalkPartyOk(t, { lead: 'warrior', guest: 'mage', guestHere: true }), false, 'テストモードの別の組み合わせ');
});

test('もう一度出た時は retryLines。無い話題は初回と同じ。話す人の名前を引く', () => {
  const t = { lines: [['mage', 'a']], retryLines: [['mage', 'b']] };
  assert.deepEqual(walkTalkLines(t, false, k => k.toUpperCase()), [['MAGE', 'a']]);
  assert.deepEqual(walkTalkLines(t, true, k => k.toUpperCase()), [['MAGE', 'b']]);
  assert.deepEqual(walkTalkLines({ lines: [['x', 'c']] }, true), [['x', 'c']]);
});

test('対象は第一章の村・幽霊船・時計塔(洋館は主人公ひとりなので無い。道(新)は自分のデータ)', () => {
  assert.deepEqual([...WALK_TALK_CH1_WORLDS].sort(), ['clocktower', 'duskvillage', 'ghostship']);
  assert.equal(CAST.mansion.guest, null);
  WALK_TALK_CH1_WORLDS.forEach(w => assert.ok(CHAPTER1_ORDER.includes(w), w));
});

test('話題のデータ: 顔ぶれは第一章のその段のもの・話すのは二人だけ・2〜3 行・一行は短く・id は重ならない', () => {
  const ids = new Set();
  for (const w of WALK_TALK_CH1_WORLDS) {
    const cast = CAST[w];
    assert.ok(cast && cast.guest, w);
    assert.ok(WALK_TALK_CH1[w].length >= 4, `${w}: 話題は 4 つ以上`);
    for (const t of WALK_TALK_CH1[w]) {
      assert.ok(!ids.has(t.id), t.id); ids.add(t.id);
      assert.equal(t.lead, cast.lead, `${t.id} の主人公`);
      assert.equal(t.guest, cast.guest, `${t.id} の支援`);
      for (const lines of [t.lines, t.retryLines].filter(Boolean)) {
        assert.ok(lines.length >= 2 && lines.length <= 3, `${t.id}: 2〜3 行`);
        assert.ok(lines.some(l => l[0] === t.lead) && lines.some(l => l[0] === t.guest), `${t.id}: 二人が話す`);
        for (const [who, text] of lines) {
          assert.ok(who === t.lead || who === t.guest, `${t.id}: 話すのは二人だけ`);
          assert.match(text, /^「.+」$/, `${t.id}: 台詞の形`);
          assert.ok(text.length <= 22, `${t.id}: 一行は短く(${text.length})`);
        }
      }
      if (t.when) assert.match(walk, new RegExp(`\\b${t.when}:\\s*\\(\\)=>`), `${t.id}: 条件 ${t.when} が legacy にある`);
    }
  }
});

test('帯の置き場所: 部屋の中・同じシナリオの帯は重ならない・村の奥(会話にしない所)には置かない・時計塔は階の高さを持つ', () => {
  const inside = (r, R) => r.x0 >= R.x0 - 1e-9 && r.x1 <= R.x1 + 1e-9 && r.z0 >= R.z0 - 1e-9 && r.z1 <= R.z1 + 1e-9;
  for (const t of WALK_TALK_CH1.duskvillage) {
    assert.ok(DUSK_ROOMS.some(R => inside(t.rect, R)), `${t.id} は村の部屋の中`);
    assert.ok(t.rect.z1 <= 462, `${t.id} は村の奥より前`);
  }
  for (const t of WALK_TALK_CH1.ghostship) assert.ok(GS_ROOMS.some(R => inside(t.rect, R)), `${t.id} は船の部屋の中`);
  for (const t of WALK_TALK_CH1.clocktower) {
    assert.ok(Number.isFinite(t.rect.y0) && Number.isFinite(t.rect.y1) && t.rect.y1 > t.rect.y0, `${t.id} は階の高さの帯`);
    assert.ok(t.rect.x0 >= -280 && t.rect.x1 <= -244 && t.rect.z0 >= 22 && t.rect.z1 <= 72, `${t.id} は塔の中`);
  }
  for (const w of WALK_TALK_CH1_WORLDS) {
    const L = WALK_TALK_CH1[w];
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i].rect, b = L[j].rect;
      const yOver = a.y0 === undefined || b.y0 === undefined || (a.y0 < b.y1 && b.y0 < a.y1);
      assert.ok(!(a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1 && yOver), `${L[i].id} と ${L[j].id} が重なる`);
    }
  }
  // 宵待ちの村: 商店街(戦闘・記憶・閃きが続く所)と水門守の登場の帯には置かない
  const market = DUSK_ROOMS.find(R => R.id === 'market');
  for (const t of WALK_TALK_CH1.duskvillage) assert.ok(!(t.rect.z0 < market.z1 && market.z0 < t.rect.z1 && t.rect.x0 < market.x1 && market.x0 < t.rect.x1), `${t.id} は商店街の外`);
});

test('legacy: ワールドを建てるたびに作り直し、第一章の本編だけ帯を登録。会話の窓・演出の間は隠す。保存しない', () => {
  const world = read('02-world-common.js'), boot = read('14-hud-boot.js'), road2 = read('14-dungeon-road2.js'), save = read('09-save-load.js');
  assert.match(world, /spawnAnomalyRiftForWorld\(key\);\s*setupWalkTalkForWorld\(key\);/);
  assert.match(walk, /if\(legacyGrowth\(\)\) return false;/, '旧成長のルールでは出さない');
  assert.match(walk, /marker:false/, 'ミニマップに「!」を出さない');
  assert.match(boot, /updateRoad2\(dt\);[^\n]*\n\s*updateWalkTalk\(dt\);/);
  assert.equal((boot.match(/updateWalkTalkBlocked\(dt\);/g) || []).length, 2, '演出の間と会話の窓の間');
  assert.match(road2, /walkTalkShow\(stepBanter\(road2Banter, dt \|\| 0, !!walkTalkBlockNow\(\)\)\)/, '道(新)は同じ表示・同じ止める条件(続きから流す動きはそのまま)');
  assert.doesNotMatch(road2, /road2-banter/, '表示の id はシナリオの名前を持たない');
  assert.match(walk, /el\.id = 'walk-talk';/);
  assert.doesNotMatch(save, /walkTalk/, '保存項目は増やさない');
});
