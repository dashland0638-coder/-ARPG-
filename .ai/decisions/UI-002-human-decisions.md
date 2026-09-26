# Decision

## ID

UI-002-HD（UI-002 Human Decisions: HD-1〜HD-5）

ファイル名は Human の指定により `UI-002-human-decisions.md` とした（`.ai/decisions/README.md` の `DEC-00n-*` 命名とは異なる）。

## Date

2026-09-26

## Source

- Human が本セッションの会話で確定（UI-002 Planner report 確認後の指示、および UI-002 Task / Work Item Planning の指示）
- 判断の対象とした資料（参照のみ）:
  - UI-001 Analyzer report: `.ai/reports/UI-001-analysis.md`（branch `claude/ui-001-analysis-380kl5` @ `4830a3804ea0874ae803b951c01dabaad68cfe88`、blob `c976f1c3b3e0a0b089e6b7eacde2b39f6f07b10a`）
  - UI-002 Planner report: `.ai/reports/UI-002-plan.md`（branch `claude/ui-002-planner` @ `eadb5e3cac983cf90911610d6da3deadc0af34a5`、blob `a23563e8c481e97c9b01fd063407c357c8c7668e`）

本記録には Human が確定した内容だけを書く。AI の推奨・評価・推測は含めない。

## Decision

### HD-1 Chapter 1 本編の旧成長系 UI

- Chapter 1 本編に、現在のゲーム仕様に存在しない旧成長系 UI を表示しない。
- 対象例: XP / Level / Skill 3 / Sphere Board / その他 Chapter 1 未解放の成長 UI。
- 旧機能は Test Mode 等の開発用途に限定する。
- 実際にどの UI が Chapter 1 本編に漏れているかは、UI-002-A で調査して整理する。

### HD-2 Skill 3 ボタン

- Skill 3 ボタンを Chapter 1 本編 HUD から外す。
- Chapter 1 のスキル構成は Skill 1 / Skill 2 / Ult を基本とする。

### HD-3 開発用 UI の分離

- 開発用 UI を本番の通常操作から分離する。
- `?dev=1` は有力候補として扱うが、実装方式は現時点で固定しない。UI-002-B の Analyzer / Planner で既存 E2E への影響と安全性を確認した上で確定する。
- 既存 E2E の DOM id 依存を考慮し、本番 UI の変更と開発用 UI 入口の変更を不用意に同時実施しない。

### HD-4 正式な UI 確認サイズ

- 1280×800
- 844×390（iPhone 横持ち相当として扱う）

### HD-5 Task 分割と進め方

- UI-002 Planner report の Task 分割案 A〜I を基本方針として採用する。
- A〜I は独立した Task として起票する（Task ID: UI-002-A / UI-002-B / UI-002-C1 / UI-002-D / UI-002-V / UI-002-C2 / UI-002-E / UI-002-F / UI-002-G / UI-002-H / UI-002-I）。
- 各 Task は実装前に通常の Analyzer → Planner → Human Approval を行い、Implementer → Test → Reviewer のプロトコルを通す。
- UI-002-V は通常の実装 Task ではなく、独立した **Human Visual Decision Task** として扱う。
  - C1 で UI 構造と token の基盤を作った後、実画面を使った UI 見本を作り、Human が実画面を確認して判断する。
  - 判断対象（候補）: トゥーン感 / マット感 / 中世ファンタジー感 / 書体 / アイコン表現 / パネル / ボタン / 枠線 / 色 / 情報密度。
  - V では大量の画面を作らず、少数の代表画面・代表コンポーネントで方向性を判断できる形にする。
  - V の判断が終わるまで C2 以降の本格的な visual implementation には進まない。
  - C2 は V の Human Decision を唯一の visual specification source とする。
- 基本依存関係（Task の Analyzer で修正可能）:
  - A・B・C1 は互いに独立
  - D は A・C1 に依存
  - V は C1 に依存
  - C2 は V に依存
  - E / F / G / H は C2 を基本依存とする
  - I は D〜H の完了後
- 実機 iPhone 確認は、必要な時点で Human Decision として追加する。

## Undecided（未決定事項）

以下は現時点では決定しない。必要になった Task の Analyzer / Planner を通して改めて判断する。

- 支援 AI の HP 表示
- 目的表示
- Sphere Board UI
- 施設 UI
- 3 人パーティ HUD
- 影の旅人専用 HUD
- パッド表記
- 設定項目
- 通知履歴
- 実機 iPhone での最終調整

## Reason

Human による理由の記述は無い。UI-001 Analyzer report と UI-002 Planner report を確認した上での判断として記録する。

## Alternatives Considered

UI-002 Planner report §16 に Planner が提示した選択肢（例: HD-1 の「テストモード限定 / 削除 / 後半解放」、HD-3 の G1〜G3）がある。上記 Decision に書かれていない選択肢は採否を決定していない。

## Consequences

- Human の指示により、UI-002-A〜I の Task file を `.ai/tasks/UI-002-*.md` に起票する。
- UI-002 Planner report のうち、上記 Decision に書かれていない内容は Human Decision ではない。

## Related Tasks

UI-001 / UI-002 / UI-002-A / UI-002-B / UI-002-C1 / UI-002-D / UI-002-V / UI-002-C2 / UI-002-E / UI-002-F / UI-002-G / UI-002-H / UI-002-I
