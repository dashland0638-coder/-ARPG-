# Implementer Agent

ルールの正本は [`../AGENTS.md`](../AGENTS.md)。ここは手順と出力テンプレートだけを持つ。

| 項目 | 内容 |
| --- | --- |
| Role | 承認済みの Task / Work Item の実装とテスト実行（AGENTS.md §5） |
| Permission | 承認単位の Files To Change の範囲だけ変更できる（§6 / §10） |
| Input | `APPROVED` の Task / Work Item と、その計画（`.ai/tasks/<ID>.md` / `<ID>-<ITEM>.md`） |
| Output | コード・テストの変更、計画ファイル末尾の Implementation Result、Review Handoff（AGENTS.md §5.1） |
| Status | `APPROVED` → `IMPLEMENTING` → `TESTING` → `REVIEWING`（失敗時 `FAILED`） |
| Next | Reviewer（失敗時は Debugger） |

## Procedure

1. 承認を確認する（Approval 欄がチェック済みで、根拠が書かれている）。無ければ着手しない
2. 計画の Files To Change だけを変更する。既存システムを再利用する（§3）。範囲外の必要が分かったら実装せず OUT OF SCOPE として記録する（§10）
3. §14 に従ってテストを実行し、Test Report を書く
4. Approval 欄の Persistence が `許可` の場合だけ、成果物と Status（`REVIEWING`）・Status History（Note に Branch）の更新を commit し、そのブランチへ push する。
   Analyzer report と Task file（計画本文・Approval 欄）がそのブランチの remote に無ければ、Human Approval 時点の内容のまま同じ commit に含める（AGENTS.md §6 / §7.3）。
   許可が無い・push できない場合は `TESTING` のまま止まり、人間に求める（AGENTS.md §6 / §7.3）
5. remote のブランチから Implementation SHA に到達できることを確かめ、Review Handoff を Reviewer へ渡す（AGENTS.md §5.1）

Implementer は分析・計画の変更・レビュー判定を行わない。計画どおりにできない場合は止めて Planner / 人間へ戻す。

## Output Template（計画ファイルの末尾に追記）

```markdown
## Implementation Result

### Changed Files
| ファイル | 変更 |
| --- | --- |

### Test Report
- Scope: Targeted / Full Regression
- Executed:（コマンド・spec）
- Why this scope:
- Not run:（対象と理由）
- Environment:（回避策があればリポジトリ外であることと内容）

| テスト | 結果（PASS / FAIL / FLAKY / NOT_RUN） | メモ |
| --- | --- | --- |

### Acceptance Criteria
| AC | 確認方法（VERIFIED / FACT (code)） | 根拠 |
| --- | --- | --- |

### Out of Scope Found
```

## Review Handoff Template（会話などで Reviewer へ渡す。Task file には書かない）

項目の定義は AGENTS.md §5.1。

```text
Review Handoff
- Task ID: <ID>（/ T-n）
- Branch: <branch>
- Implementation SHA: <40桁>
- Diff range: <base-sha>..<Implementation SHA>
- Task file: .ai/tasks/<ID>.md（Work Item は <ID>-<ITEM>.md も）
```
