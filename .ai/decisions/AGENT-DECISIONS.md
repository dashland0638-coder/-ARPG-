# Agent Decisions

Task を越えて再利用される Agent の判断だけを追記する（規則は [`../AGENTS.md`](../AGENTS.md) §18）。
Task の中だけで効く判断は Task file の `## Agent Decisions` 節に書く。細かい実装判断は書かない。

Human Decision と矛盾した場合は Human Decision が優先する。上書きされた記録は消さず `Superseded by <ID>` を追記する。

## Template

```markdown
### AD-<nnn>: <判断の要旨（1行）>
- Date / Task: <YYYY-MM-DD> / <Task ID>
- Decision: <決めたこと>
- Basis: <AGENTS.md §17.2 のどのソースから導いたか（path / Decision ID）>
- Applies when: <将来どの状況でこの判断を再利用するか>
```

## Records

### AD-001: E2E のブラウザ revision 不一致はリポジトリ外の設定で回避する
- Date / Task: 2026-10-01 / AGENT-AUTONOMY
- Decision: Playwright の要求 revision と実行環境の Chromium が異なる場合、リポジトリの `playwright.config.js` を変えず、scratchpad に `executablePath` だけを上書きした設定を置いて実行する。Human に質問しない
- Basis: `.ai/AGENTS.md` §14（実行環境の問題）、UI-002-D WI-D1 の Test Report（`.ai/tasks/UI-002-D.md` Implementation Result）での同じ回避策
- Applies when: `npm test` がブラウザ起動前に失敗する実行環境

### AD-002: プロセス手順だけを定めた過去の Human Decision は DEC-002 に従って読み替える
- Date / Task: 2026-10-01 / AGENT-AUTONOMY
- Decision: 「report の push は Human が行う」「承認まで止まる」等、承認・Persistence の手順だけを定めた過去の Human Decision は、DEC-002 統合後の遷移では Agent Approval / Agent Persistence として扱う。ゲーム仕様・ゲームデザイン・ブランチ名・「AI が決めてはいけない」と明示された事項は従来どおり拘束する
- Basis: `.ai/decisions/DEC-002-autonomous-execution.md` Consequences
- Applies when: 移行前に始まった Task（例: UI-002-D）を再開するとき
