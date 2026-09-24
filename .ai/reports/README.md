# Reports

Analyzer / Debugger / Reviewer の成果物を保存する。
書き方のルール（FACT / INFERENCE / DECISION の分離、検索記録）は
[`../AGENTS.md`](../AGENTS.md) §3 / §8、テンプレートは `../agents/<role>.md`。

## Naming

```
TASK-ID-analysis.md   Analyzer
TASK-ID-debug.md      Debugger
TASK-ID-review.md     Reviewer
TASK-ID-WORKn-report.md  実装作業の結果報告（既存の慣例）
TOPIC-retrospective.md   プロセスの振り返り（例: AI-AGENT-PROTOCOL-T1-retrospective.md）
```

Work Item 専用のレポートは `TASK-ID-<ITEM>-analysis.md` など（規則は `../AGENTS.md` §7.2）。

## Rule

長大なログ全文を保存しない。重要なエラー・原因・判断だけを残す。
