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
const ORCH = read('.ai/agents/orchestrator.md');
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
  for (const id of ['0', '4', '6', '6.1', '6.2', '9', '9.1', '14', '17', '17.1', '17.2', '17.3', '17.4', '18', '19', '20', '21', '22']) {
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
    '.ai/decisions/DEC-002-autonomous-execution.md', '.ai/decisions/DEC-003-agent-protocol-2.md', '.ai/decisions/AGENT-DECISIONS.md',
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

test('移行前の承認単位も再承認は Agent Approval(Human Approval は例外条件だけ)', () => {
  const gate = sectionBody('6');
  assert.doesNotMatch(gate, /追加前に Human Approval で運用していた承認単位の続き/);
  assert.match(gate, /移行前に始まった承認単位/);
  assert.doesNotMatch(sectionBody('5.2'), /Human Approval を取り直す/);
});

/* ---- Agent Protocol 2.0(DEC-003): Definition of Done を PR 作成まで。merge は Human ---- */

test('2.0 標準フロー: Reviewer PASS の後に Commit → Push → PR 作成 → DONE、merge は Human', () => {
  const flow = sectionBody('4');
  const order = ['Reviewer', 'PASS', 'Commit / Push', 'PR 作成', 'DONE', 'Final Report', 'Human: PR 確認', 'merge 判断'];
  let pos = -1;
  for (const name of order) {
    const i = flow.indexOf(name, pos + 1);
    assert.ok(i > pos, `${name} の順序`);
    pos = i;
  }
  assert.match(flow, /Agent は merge しない/);
});

test('2.0 Definition of Done: 13 項目で Commit・Push・PR 作成を含み、main への merge を含まない', () => {
  const dod = sectionBody('20');
  const rows = [...dod.matchAll(/^\| (\d+) \| ([^|]+)\|/gm)].map(m => [Number(m[1]), m[2].trim()]);
  assert.deepEqual(rows.map(r => r[0]), Array.from({ length: 13 }, (_, i) => i + 1));
  const names = rows.map(r => r[1]).join('\n');
  for (const k of ['Goal', 'Analyzer', 'Planner', 'Implementer', 'Tester', 'Reviewer PASS', '自動修正', 'Commit', 'Push', 'PR 作成', '最終報告']) {
    assert.ok(names.includes(k), `DoD に ${k}`);
  }
  assert.doesNotMatch(names, /merge/, 'DoD の項目に merge は無い');
  assert.match(dod, /`main` への merge は DONE の条件に含めない/);
  assert.match(dod, /Agent は `main` へ merge しない/);
  // 状態遷移の DONE 条件にも PR が入っている
  assert.match(sectionBody('7.3'), /作業ブランチの PR（`main` 向け）が存在し/);
});

test('2.0 Commit / Push の責務: Orchestrator が持ち、作業ブランチのみ・main への push と merge をしない', () => {
  const dod = sectionBody('20');
  assert.match(dod, /\| 10 \| Commit \| Orchestrator/);
  assert.match(dod, /\| 11 \| Push（作業ブランチ。§6\.1） \| Orchestrator/);
  assert.match(dod, /\| 12 \| PR 作成（§21） \| Orchestrator/);
  const gate = sectionBody('6.1');
  assert.match(gate, /`main` への push、force push/);
  assert.match(gate, /`main` への merge は行わない/);
  assert.match(ORCH, /\*\*`main` へ merge しない\*\*/);
  // 読み取り専用の役割は commit しない(Analyzer / Planner の persist は Orchestrator)
  assert.match(read('.ai/agents/planner.md'), /Planner は Task file を commit \/ push しない/);
});

test('2.0 PR 本文の必須項目と Merge required の明示(テンプレートと §21 が一致)', () => {
  const pr = sectionBody('21');
  const tpl = ORCH.slice(ORCH.indexOf('## PR Body Template'), ORCH.indexOf('## Final Report Template'));
  for (const k of ['Goal', 'Summary', 'Changed files', 'Agent decisions', 'Tests', 'Reviewer result',
    'Related Work Item', 'Known limitations', 'Human review points', 'Merge required: Human approval']) {
    assert.ok(pr.includes(k), `§21 に ${k}`);
    assert.ok(tpl.includes(k), `PR テンプレートに ${k}`);
  }
  assert.ok(pr.includes('Auto-fix count') && pr.includes('Human Escalation count'));
  assert.match(tpl, /Human Escalation: \d+ \/ Human Decision: \d+ \/ Auto Fix: n/);
  // PR 作成だけの失敗は巻き戻さず、権限外のときだけ Escalation
  assert.match(sectionBody('20'), /実装・commit・push を巻き戻さない/);
  assert.match(sectionBody('17.3'), /PR を作れない/);
});

test('2.0 Autonomy Metrics: 6 項目を実測値で記録する(Task テンプレート・Orchestrator と一致)', () => {
  const metrics = ['Human Escalation Count', 'Human Decision Count', 'Auto Fix Count', 'Reviewer Round Count', 'Test Retry Count', 'PR Created'];
  const m = sectionBody('22');
  const taskTpl = read('.ai/tasks/README.md');
  for (const k of metrics) {
    assert.ok(m.includes(`| ${k} |`), `§22 に ${k}`);
    assert.ok(taskTpl.includes(`- ${k}:`), `Task テンプレートに ${k}`);
    assert.ok(ORCH.includes(`- ${k}:`), `Orchestrator のテンプレートに ${k}`);
  }
  assert.match(m, /推測で埋めない/);
  assert.match(m, /評価するスコアではなく/);
});

test('2.0 最終報告の必須項目と、通常ケースで Human に確認を返さないこと', () => {
  const tpl = ORCH.slice(ORCH.indexOf('## Final Report Template'));
  for (const k of ['Goal', '実施内容', '主な Agent 判断', '変更ファイル', 'Test 結果', 'Reviewer 結果', 'Auto Fix Count',
    'Human Escalation Count', 'Human Decision Count', 'Commit', 'Branch', 'PR', 'Known limitations', 'Human が次に行うこと']) {
    assert.ok(sectionBody('19').includes(k), `§19 に ${k}`);
    assert.ok(tpl.includes(`- ${k}`), `最終報告テンプレートに ${k}`);
  }
  assert.match(tpl, /PR 確認 → main への merge 判断/);
  assert.match(tpl, /### Human Decision\nNone/);
  // Escalation に当たらない判断で確認を返さない
  for (const body of [sectionBody('17.1'), sectionBody('19')]) assert.match(body, /この判断でよいですか/);
  assert.match(ORCH, /「確認してください」「この判断でよいですか」等を書かない/);
});
