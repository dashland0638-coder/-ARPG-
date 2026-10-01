/* AI エージェント運用プロトコル(.ai/AGENTS.md)の構造検証。
   Autonomous Execution + Human Escalation(DEC-002)の必須要素と、§ 参照の整合を確かめる。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const AGENTS = read('.ai/AGENTS.md');
const ROLES = ['orchestrator', 'analyzer', 'planner', 'implementer', 'tester', 'debugger', 'reviewer'];

// "## 6. Approval Gate" → "6"、"### 6.1 Agent ..." → "6.1"
const sectionIds = new Set(
  [...AGENTS.matchAll(/^#{2,3} (\d+(?:\.\d+)?)[.\s]/gm)].map((m) => m[1]),
);

function sectionBody(id) {
  const lines = AGENTS.split('\n');
  const start = lines.findIndex((l) => new RegExp(`^#{2,3} ${id.replace('.', '\\.')}[.\\s]`).test(l));
  assert.ok(start >= 0, `§${id} が無い`);
  const level = lines[start].match(/^#+/)[0].length;
  let fenced = false; // コードブロック内の見出し(テンプレート)では節を閉じない
  const end = lines.findIndex((l, i) => {
    if (l.startsWith('```')) fenced = !fenced;
    return i > start && !fenced && /^#+ /.test(l) && l.match(/^#+/)[0].length <= level;
  });
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
}

test('Autonomous Execution の必須節がある', () => {
  for (const id of ['0', '4', '6', '6.1', '6.2', '9', '9.1', '14', '17', '17.1', '17.2', '17.3', '17.4', '18', '19']) {
    assert.ok(sectionIds.has(id), `§${id}`);
  }
});

test('標準フローは Orchestrator から Reviewer まで Human Approval の GATE を挟まない', () => {
  const flow = sectionBody('4');
  const order = ['Orchestrator', 'Context Loader', 'Analyzer', 'Planner', 'Implementer', 'Tester', 'Reviewer'];
  let pos = -1;
  for (const name of order) {
    const i = flow.indexOf(name, pos + 1);
    assert.ok(i > pos, `${name} の順序`);
    pos = i;
  }
  assert.doesNotMatch(flow, /Human Approval\s+◆ GATE/);
});

test('Escalation トリガー E-1〜E-10 と回答形式の必須項目がある', () => {
  const triggers = sectionBody('17.3');
  for (let n = 1; n <= 10; n++) assert.match(triggers, new RegExp(`\\| E-${n} \\|`), `E-${n}`);
  const format = sectionBody('17.4');
  for (const key of ['Trigger', 'Facts', 'Why Agent cannot decide', 'Options', 'Recommendation', 'Minimal answer']) {
    assert.ok(format.includes(key), key);
  }
});

test('Review Fix Loop は自動差し戻しで上限 3 Round', () => {
  const loop = sectionBody('9.1');
  assert.match(loop, /CHANGES_REQUIRED → IMPLEMENTING → TESTING → REVIEWING/);
  assert.match(loop, /通算3 Round/);
  assert.match(loop, /Escalation/);
});

test('Final Report は Human Decision: None を明示する', () => {
  assert.match(sectionBody('19'), /Human Decision: None/);
  assert.match(read('.ai/agents/orchestrator.md'), /### Human Decision\nNone/);
});

test('役割ファイルがすべて存在し、正本の AGENTS.md を参照する', () => {
  for (const role of ROLES) {
    const p = `.ai/agents/${role}.md`;
    assert.ok(fs.existsSync(path.join(root, p)), p);
    assert.match(read(p), /\(\.\.\/AGENTS\.md\)/, p);
    assert.ok(sectionBody('16').includes(role), `File Map に ${role}`);
  }
});

test('プロトコル文書の § 参照はすべて AGENTS.md に存在する節を指す', () => {
  const files = [
    '.ai/AGENTS.md', 'CLAUDE.md',
    ...ROLES.map((r) => `.ai/agents/${r}.md`),
    '.ai/tasks/README.md', '.ai/decisions/README.md', '.ai/reports/README.md',
    '.ai/decisions/DEC-002-autonomous-execution.md', '.ai/decisions/AGENT-DECISIONS.md',
  ];
  for (const f of files) {
    for (const m of read(f).matchAll(/§(\d+(?:\.\d+)?)/g)) {
      assert.ok(sectionIds.has(m[1]), `${f}: §${m[1]}`);
    }
  }
});

test('Planner は承認待ちで停止せず、Escalation Check で Agent Approval する', () => {
  const planner = read('.ai/agents/planner.md');
  assert.match(planner, /Escalation Check/);
  assert.match(planner, /Human を待たない/);
  assert.doesNotMatch(planner, /AI が決めない/);
});
