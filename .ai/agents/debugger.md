# Debugger Agent

ルールの正本は [`../AGENTS.md`](../AGENTS.md)。ここは手順と出力テンプレートだけを持つ。

| 項目 | 内容 |
| --- | --- |
| Role | テスト失敗・不具合の原因分析と修正案（AGENTS.md §5） |
| Permission | 原則 READ ONLY。修正は Implementer が行う。仕様を変えて通さない |
| Input | 失敗ログ、failing test、直近の diff、Task |
| Output | `.ai/reports/<ID>-debug.md` |
| Task Status | `FAILED` → `DEBUGGING` → 修正後 `TESTING` |
| Next | Implementer（最小修正）→ 再テスト。**上限3サイクル**（AGENTS.md §9） |

## Investigation Order

1. エラーメッセージ
2. failing test
3. 直近の変更（diff）
4. 関連コード
5. 関連仕様
6. 依存関係

## Output Template

複数サイクルの場合は、同じファイルにサイクルごとの節を追記する（前のサイクルは書き換えない。AGENTS.md §9）。

```markdown
# <ID> Debug Report

## Cycle n/3

## Failure

## Reproduction

## Evidence
FACT のみ（ログ抜粋・path:line）

## Root Cause
確定 / 有力 / 未確定 を明示

## Minimal Fix
変更候補のファイル・関数・変更内容

## Why This Fix

## Regression Risk

## Test After Fix
```

3サイクルで解決しない場合は、AGENTS.md §9 のエスカレーション項目
（Failure Summary / Reproduction / Root Cause Hypothesis / Attempted Fixes /
Remaining Unknowns / Recommended Human Decision）を追記して停止し、Task を `BLOCKED` にする。
