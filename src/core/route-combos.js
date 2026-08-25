// Pure route-branch-combination math, extracted from the routeXxx() family
// in src/legacy/parts/03-dungeons-mansion-temple.js so it can be unit
// tested without booting the game (see tests/unit/route-combos.test.js).
// Everything here takes the route graph and "seen" map as explicit
// arguments rather than reading ROUTE_GRAPHS/state directly - the legacy
// routeXxx() wrappers still do that state-reading, then delegate the
// actual math here. No dependency on THREE, state, or the DOM.

// graph.nodes: { [nodeKey]: { group?: string, name: string, ... } }
// -> { [group]: nodeKey[] }, or null for a graph-less scenario/undefined graph
export function groupsFromGraph(graph) {
  if (!graph) return null;
  const groups = {};
  Object.keys(graph.nodes).forEach(k => {
    const gr = graph.nodes[k].group;
    if (gr) (groups[gr] = groups[gr] || []).push(k);
  });
  return groups;
}

// groupNames (sorted) plus every combination (the direct product) of one
// node per group - i.e. every way to pick one path through each branch.
export function allCombos(graph) {
  const groups = groupsFromGraph(graph);
  if (!groups || !Object.keys(groups).length) return null;
  const groupNames = Object.keys(groups).sort();
  let combos = [[]];
  groupNames.forEach(gr => {
    const next = [];
    groups[gr].forEach(nodeKey => {
      combos.forEach(c => next.push(c.concat([nodeKey])));
    });
    combos = next;
  });
  return { groupNames, combos };
}

export function comboKey(groupNames, nodeKeys) {
  return groupNames.map((gr, i) => gr + ':' + nodeKeys[i]).join('|');
}

// Builds the combo key for whichever path was actually walked. Returns null
// for a scenario with no branch groups, or a path that hasn't completed
// every group yet (picked one node per group, in any order).
export function comboKeyFromPath(graph, path) {
  const groups = groupsFromGraph(graph);
  if (!groups || !Object.keys(groups).length) return null;
  const groupNames = Object.keys(groups).sort();
  const picked = groupNames.map(gr => (path || []).find(n => groups[gr].indexOf(n) >= 0) || null);
  if (picked.indexOf(null) >= 0) return null;
  return comboKey(groupNames, picked);
}

// seen: { [comboKeyString]: true }
export function comboProgress(graph, seen) {
  const all = allCombos(graph);
  if (!all) return null;
  const s = seen || {};
  const total = all.combos.length;
  const done = all.combos.filter(c => s[comboKey(all.groupNames, c)]).length;
  return { total, done };
}

// One not-yet-seen combo, as an array of node keys - or null if the
// scenario has no branch groups, or every combo has already been seen.
export function suggestUnseenCombo(graph, seen) {
  const all = allCombos(graph);
  if (!all) return null;
  const s = seen || {};
  for (const combo of all.combos) {
    if (!s[comboKey(all.groupNames, combo)]) return combo;
  }
  return null;
}
