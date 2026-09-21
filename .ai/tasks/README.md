# Tasks

AI開発タスクを管理する。

## Naming

`TASK-ID.md`

例：

```
COMBAT-001.md
MAGE-003.md
UI-012.md
```

## Task Template

```markdown
# Task

## ID

## Request

## Background

## Expected Behavior

## Constraints

## Acceptance Criteria

## Status

REQUESTED

## Related Files

## Notes
```

## Status

`REQUESTED` → `ANALYZING` → `PLANNED` → `IMPLEMENTING` → `TESTING` → `REVIEW` → `DONE`
（停止時は `BLOCKED`）

Taskには実装方法を決め打ちしすぎない。

「何を達成するか」を中心に書く。
