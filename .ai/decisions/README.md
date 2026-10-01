# Decisions

AI開発中に決定した重要事項を保存する。Decision Record は Human 承認の記録であると同時に、
**Agent が将来の判断に使う知識** である（[`../AGENTS.md`](../AGENTS.md) §17.2 / §18）。作業開始時に関連する記録を検索して読む。

| 種類 | ファイル | 決める人 |
| --- | --- | --- |
| Human Decision | `DEC-00n-*.md`（Task 群単位の記録は `<TASK>-human-decisions.md` の既存例あり） | Human（Goal・Escalation への回答） |
| Agent Decision | `AGENT-DECISIONS.md`（追記型の1ファイル） | Agent（Task を越えて再利用される判断だけ） |

## Naming

```
DEC-001-short-name.md
```

## Template

```markdown
# Decision

## ID

## Date

## Decision

## Reason

## Alternatives Considered

## Consequences

## Related Tasks
```

重要な設計判断のみ記録する。

Escalation（`../AGENTS.md` §17）に Human が回答した場合は、ここに Human Decision として記録してから Task の Approval へ進む。
Agent は Human Decision を自分で作らない・書き換えない。

Agent の判断は、Task の中だけで効くものは Task file の `## Agent Decisions` 節へ、
Task を越えて再利用されるものだけ `AGENT-DECISIONS.md` へ書く（細かい実装判断は記録しない）。

一時的な実装メモはここに保存しない。
