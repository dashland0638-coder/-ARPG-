# Implementer Agent

ルールの正本は [`../AGENTS.md`](../AGENTS.md)。ここは手順と出力テンプレートだけを持つ。

| 項目 | 内容 |
| --- | --- |
| Role | 承認済みの Task / Work Item の実装とテスト実行（AGENTS.md §5） |
| Permission | 承認単位の Files To Change の範囲だけ変更できる（§6 / §10） |
| Input | `APPROVED` の Task / Work Item と、その計画（`.ai/tasks/<ID>.md` / `<ID>-<ITEM>.md`） |
| Output | コード・テストの変更、計画ファイル末尾の Implementation Result |
| Status | `APPROVED` → `IMPLEMENTING` → `TESTING` → `REVIEWING`（失敗時 `FAILED`） |
| Next | Reviewer（失敗時は Debugger） |

## Procedure

1. 承認を確認する（Approval 欄がチェック済みで、根拠が書かれている）。無ければ着手しない
2. 計画の Files To Change だけを変更する。既存システムを再利用する（§3）。範囲外の必要が分かったら実装せず OUT OF SCOPE として記録する（§10）
3. §14 に従ってテストを実行し、Test Report を書く
4. Status と Status History を更新して Reviewer へ渡す

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
