// Pure-logic unit tests for src/core/route-combos.js. Run with `npm run
// test:unit` (node's built-in test runner - no extra dev dependency).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  groupsFromGraph, allCombos, comboKey, comboKeyFromPath, comboProgress, suggestUnseenCombo,
} from '../../src/core/route-combos.js';

// A small synthetic graph shaped like the real ROUTE_GRAPHS entries
// (see src/legacy/parts/03-dungeons-mansion-temple.js) - two branch groups
// of two nodes each, so there are 2*2=4 total combos.
const GRAPH = {
  start: 'hall',
  nodes: {
    hall:  { name: '玄関ホール', kind: 'common' },
    crypt: { name: '地下納骨堂', group: 'm1' },
    study: { name: '二階書斎', group: 'm1' },
    grand: { name: '本館大階段', group: 'm2' },
    court: { name: '荒れた中庭', group: 'm2' },
  },
};

test('groupsFromGraph', async (t) => {
  await t.test('groups nodes by their group field, ignoring ungrouped nodes', () => {
    assert.deepEqual(groupsFromGraph(GRAPH), { m1: ['crypt', 'study'], m2: ['grand', 'court'] });
  });

  await t.test('returns null for a missing/undefined graph', () => {
    assert.equal(groupsFromGraph(null), null);
    assert.equal(groupsFromGraph(undefined), null);
  });

  await t.test('returns an empty object for a graph with no branch groups', () => {
    assert.deepEqual(groupsFromGraph({ nodes: { hall: { name: 'x' } } }), {});
  });
});

test('allCombos', async (t) => {
  await t.test('returns the direct product across groups, sorted group names', () => {
    const { groupNames, combos } = allCombos(GRAPH);
    assert.deepEqual(groupNames, ['m1', 'm2']);
    assert.equal(combos.length, 4);
    // every combo picks exactly one node per group, in groupNames order
    for (const c of combos) {
      assert.ok(['crypt', 'study'].includes(c[0]));
      assert.ok(['grand', 'court'].includes(c[1]));
    }
    // and all 4 are distinct
    const keys = new Set(combos.map(c => comboKey(groupNames, c)));
    assert.equal(keys.size, 4);
  });

  await t.test('returns null for a graph with no branch groups at all', () => {
    assert.equal(allCombos({ nodes: { hall: { name: 'x' } } }), null);
  });

  await t.test('returns null for a missing graph', () => {
    assert.equal(allCombos(null), null);
  });
});

test('comboKey', () => {
  assert.equal(comboKey(['m1', 'm2'], ['crypt', 'grand']), 'm1:crypt|m2:grand');
});

test('comboKeyFromPath', async (t) => {
  await t.test('builds the key once every group has one node in the path', () => {
    assert.equal(comboKeyFromPath(GRAPH, ['hall', 'crypt', 'greathall', 'grand']), 'm1:crypt|m2:grand');
  });

  await t.test('ignores path order and extra ungrouped nodes', () => {
    assert.equal(comboKeyFromPath(GRAPH, ['grand', 'hall', 'study']), 'm1:study|m2:grand');
  });

  await t.test('returns null while a group is still unvisited', () => {
    assert.equal(comboKeyFromPath(GRAPH, ['hall', 'crypt']), null);
  });

  await t.test('returns null for an empty path', () => {
    assert.equal(comboKeyFromPath(GRAPH, []), null);
  });

  await t.test('returns null for a graph with no branch groups', () => {
    assert.equal(comboKeyFromPath({ nodes: { hall: { name: 'x' } } }, ['hall']), null);
  });
});

test('comboProgress', async (t) => {
  await t.test('counts how many of the 4 combos are marked seen', () => {
    const seen = { 'm1:crypt|m2:grand': true, 'm1:study|m2:court': true };
    assert.deepEqual(comboProgress(GRAPH, seen), { total: 4, done: 2 });
  });

  await t.test('treats a missing/undefined seen map as zero done', () => {
    assert.deepEqual(comboProgress(GRAPH, undefined), { total: 4, done: 0 });
  });

  await t.test('returns null for a graph with no branch groups', () => {
    assert.equal(comboProgress({ nodes: { hall: { name: 'x' } } }, {}), null);
  });
});

test('suggestUnseenCombo', async (t) => {
  await t.test('returns a combo not present in the seen map', () => {
    // mark 3 of the 4 combos seen, leaving exactly one
    const all = allCombos(GRAPH);
    const seen = {};
    all.combos.slice(0, 3).forEach(c => { seen[comboKey(all.groupNames, c)] = true; });
    const suggestion = suggestUnseenCombo(GRAPH, seen);
    assert.ok(suggestion);
    assert.equal(seen[comboKey(all.groupNames, suggestion)], undefined);
  });

  await t.test('returns null once every combo has been seen', () => {
    const all = allCombos(GRAPH);
    const seen = {};
    all.combos.forEach(c => { seen[comboKey(all.groupNames, c)] = true; });
    assert.equal(suggestUnseenCombo(GRAPH, seen), null);
  });

  await t.test('returns null for a graph with no branch groups', () => {
    assert.equal(suggestUnseenCombo({ nodes: { hall: { name: 'x' } } }, {}), null);
  });
});
