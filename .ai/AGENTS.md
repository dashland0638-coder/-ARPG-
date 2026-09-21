# AI Agent Operating Rules

## 1. Purpose

`.ai/` はAIによる開発作業の状態・分析・計画・判断記録を管理する。

ゲーム本体の仕様は `docs/` が正とする。

`.ai/` はゲーム仕様そのものを置き換えない。

補足（現状）: 本リポジトリには現時点で `docs/` ディレクトリが存在せず、正式仕様はリポジトリ直下の
`ARCHITECTURE.md` / `ARPG_INTEGRATION.md` / `COMBAT_DESIGN.md` / `MANSION_SCENARIO.md` / `ASSETS.md` /
`README.md` / `tests/README.md` が担っている。`docs/` が新設されるまでは、これらを「正式仕様」と読み替える。

## 2. Source of Truth

優先順位：

1. 現在の実装
2. `docs/` の正式仕様（未整備の間は上記のルート直下Markdown）
3. `.ai/decisions/` の明示的な決定事項
4. `.ai/tasks/` の作業指示
5. AI自身の推測

不明点を推測で埋めない。

矛盾を発見した場合は報告する。

## 3. Task Lifecycle

基本フロー：

```
REQUEST
  ↓
ANALYZE
  ↓
PLAN
  ↓
IMPLEMENT
  ↓
TEST
  ↓
REVIEW
  ↓
DONE
```

失敗時：

```
TEST FAIL
  ↓
DEBUG
  ↓
MINIMAL FIX
  ↓
TEST
```

自動修正は最大3サイクルまで。

3回失敗した場合は停止して人間へ判断を求める。

## 4. Minimal Change Rule

既存コードを理解してから変更する。

目的達成に必要な最小変更だけを行う。

「ついでの改善」はしない。

不要なリファクタリングは禁止。

## 5. Legacy Rule

`src/legacy/parts/` は共有スコープで動作している。

通常のES Moduleとして勝手に分離しない。

共有変数や関数を不用意に変更しない。

module化が必要な場合は、別Taskとして分析・計画を行う。

## 6. Frozen File

`basefile.html` は凍結。

変更禁止。

## 7. Testing Rule

変更後は可能な範囲で、

```sh
npm run build
npm run test:unit
npm test
```

を実行する。

テストできない場合は理由を明記する。

## 8. Documentation Rule

仕様変更を伴う場合は `docs/` の更新が必要。

ただし今回のAI基盤構築ではゲーム仕様を変更しない。

## 9. Communication Rule

各Agentは以下を優先する。

- 事実
- 根拠
- 対象ファイル
- 最小変更案
- テスト結果
- 未確認事項

長い一般論は禁止。

## 10. Token Efficiency

既知の情報を何度も再説明しない。

必要なファイルだけ読む。

巨大ファイルを毎回全文取得しない。

まず検索・部分読み取りを行う。

問題箇所が特定できた場合のみ周辺コードを読む。

## 11. Agent Roles

| Role | 担当 | 権限 |
| --- | --- | --- |
| Director / 設計 | ChatGPT | 指示・設計 |
| Analyzer | `.ai/agents/analyzer.md` | READ ONLY |
| Planner | `.ai/agents/planner.md` | READ ONLY |
| Implementer | Claude Code | 実装 |
| Debugger | `.ai/agents/debugger.md` | 原則READ ONLY |
| Reviewer | `.ai/agents/reviewer.md` | READ ONLY |

共有情報はGitHub上の小さなMarkdownファイル（`.ai/tasks/` `.ai/reports/` `.ai/decisions/` `docs/`）で受け渡す。
巨大な会話履歴をAI間で共有しない。
