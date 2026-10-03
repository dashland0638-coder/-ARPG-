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

### AD-003: 移行前 Task の実装ブランチ指定と実行環境の割当ブランチが異なる場合は割当ブランチで作業する
- Date / Task: 2026-10-01 / UI-002-D WI-D2
- Decision: Human Decision で指定された実装ブランチ（例: HD-D20 `claude/ui-002-d-impl`）へ実行環境が push できない場合、セッションに割り当てられた作業ブランチ（最新 main を含む）で作業し、Task の Approval / Status History にブランチと理由を書く。`main` への merge は行わず、Final Report で Human に残す
- Basis: `.ai/AGENTS.md` §6.1（作業ブランチ = Human がセッション設定で指定したブランチ）、AD-002（ブランチ名の HD は拘束するが、push できない環境では E-10 に当たる前に割当ブランチで代替できる）
- Applies when: 移行前の Task を別セッションで再開するとき

### AD-004: E2E のゲーム内時間は自動テストで実時間の 1/4 に固定する。待ちは決め打ちではなく状態を読み直す
- Date / Task: 2026-10-02 / CI-001
- Decision: 自動テストで操作されているブラウザ(`navigator.webdriver === true`)では、ゲーム内の時間を実時間の 1/4 に固定する(`src/core/sim-time.js`)。E2E の描画の解像度は `deviceScaleFactor: 0.5`。新しい E2E は、ゲーム内の出来事を「決め打ちの実時間の待ち → 1 回だけ読む」で確かめず、`expect.poll` 等で状態が満たされるまで読み直す。デバッグ表示(Motion Preview・Arena の情報)はゲーム内 0.5 秒ごとの書き換えであることを前提にする
- Basis: `.ai/reports/CI-001-analysis.md`、`.ai/tasks/CI-001.md`(実測: 2 CPU で 23 FAIL → 0)。実時間へ追いつかせる案は入力のタイミングの spec が成り立たず不採用
- Applies when: E2E を書く・直す・CI の失敗を調べるとき。比を変える場合は E2E 全体を 2 CPU で流し直す
