# Decision

## ID

UI-002-HD（UI-002 Human Decisions: HD-1〜HD-5、第一章ゲームデザイン境界、UI-002-A の HD-P1〜HD-P9 / AP-5 / AP-8 / AP-9 / AP-10）

ファイル名は Human の指定により `UI-002-human-decisions.md` とした（`.ai/decisions/README.md` の `DEC-00n-*` 命名とは異なる）。

## Date

- 2026-09-26: HD-1〜HD-5
- 2026-09-27: 第一章ゲームデザイン境界、HD-P1〜HD-P9、AP-5、AP-8、AP-9、AP-10

## Source

- Human が本セッションの会話で確定（UI-002 Planner report 確認後の指示、および UI-002 Task / Work Item Planning の指示）
- 判断の対象とした資料（参照のみ）:
  - UI-001 Analyzer report: `.ai/reports/UI-001-analysis.md`（branch `claude/ui-001-analysis-380kl5` @ `4830a3804ea0874ae803b951c01dabaad68cfe88`、blob `c976f1c3b3e0a0b089e6b7eacde2b39f6f07b10a`）
  - UI-002 Planner report: `.ai/reports/UI-002-plan.md`（branch `claude/ui-002-planner` @ `eadb5e3cac983cf90911610d6da3deadc0af34a5`、blob `a23563e8c481e97c9b01fd063407c357c8c7668e`）
  - UI-002-A Analyzer report: `.ai/reports/UI-002-A-analysis.md`（branch `claude/ui-002-a-analysis` @ `99f1fbd07c474625007a6f90a703d4f70224189d`、blob `583bd83e937b748fb5a17e330591f49897aeb8dd`）
  - UI-002-A Planner report v1: `.ai/reports/UI-002-A-plan.md`（branch `claude/ui-002-a-planner` @ `7ebea4f0db4e8d4f58479ad5e4ff6074e3f7a515`）
  - UI-002-A Planner report v2: `.ai/reports/UI-002-A-plan-v2.md`（branch `claude/ui-002-a-planner-v2` @ `2b00483943ab35af027af6b157a014e3a2fc6e61`、blob `e250c12da31bd6ead46126f1168988e3ba9d93f3`）
- 2026-09-27 の決定は、UI-002-A Planner report v1 / v2 確認後の Human の指示（会話）による

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

### 第一章のゲームデザイン境界（2026-09-27）

第一章では、以下をゲームシステムとして存在させない。

- Level
- XP
- XP 報酬
- 鑑定武器
- 細かな武器ドロップ
- 鑑定用素材
- 能力強化用ダイヤ
- スキル強化用ダイヤ
- ステータス強化
- スフィア盤ライクな成長システム
- スキル習得・変化システム
- 本格的な鍛冶・武器強化

第一章で存在するもの:

- 固定武器入手
- 宝箱
- Skill 1
- Skill 2
- Ult
- 通常の戦闘報酬
- アイテム購入
- 酒場
- 鍛冶屋は「準備中」という位置付け

第二章以降で解禁するもの:

- スフィア盤ライクな成長システム
- キャラクター強化
- スキル習得
- スキル変化
- 鑑定武器
- 武器ドロップ
- 鑑定素材
- 各種強化要素

第二章以降の詳細仕様は決定していない。

### 旧セーブを破壊しない原則（2026-09-27）

- 「第一章では存在しない」ことと「データとして存在してはいけない」ことは別である。
- 第一章（本編）: 表示・入力・使用・新規入手を抑制する。
- 第二章以降: 既存の成長 / 鑑定データを利用できる可能性を残す。
- 旧セーブ: 削除・破壊・勝手な正規化をしない。既存セーブデータの正規化は別 Task で扱う。

### UI-002-A: HD-P1〜HD-P9（2026-09-27）

- **HD-P1**: 💎 / 🔩 等の第一章で不要な強化・鑑定系素材は、第一章のゲームシステムとして扱わない。第一章では入手・表示・消費・用途のいずれも必要としない。第二章以降で使用する可能性のあるデータを旧セーブから勝手に削除・変換してはいけない。既存セーブデータの正規化は別 Task で扱う。
- **HD-P2**: Skill 3 は、第一章では「UI だけ存在しない」のではなく、第一章では使用できないゲーム機能として扱う。HUD ボタン・U キー・十字キー左・タップ入力・Skill 3 関連トースト・Skill 3 関連警告・Skill 3 発動を第一章本編では停止する。既存セーブデータそのものを削除・書き換えることは UI-002-A では行わない。
- **HD-P3**: 旧セーブに Skill 3 装着状態が残っていても、セーブデータ自体は変更せず、第一章本編では Skill 3 を発動できない。旧セーブの正規化・移行処理は別 Task 候補として扱う。
- **HD-P4**: 第一章では Level が存在しないため、「Lv不足」「レベル未達」などの表現は使用しない。武器種など別の条件を伝える必要がある場合は、Level を意味しない表現に置き換える。具体的な文言は Implementer が決めず、Planner が候補を提示し Human Approval を受ける。
- **HD-P5**: 一括鑑定は第一章本編では不要。第一章では鑑定武器を扱わないため、本編 UI から除外する。第二章以降の鑑定システム自体の設計は別 Task。
- **HD-P6**（2026-09-27 改訂。WI-A4 の Human Approval と整合）: メニュー等に存在する、現在のゲーム仕様と食い違う説明文は UI-002-A（WI-A4）で修正対象として扱う。対象は、存在しない「鑑定ボタン」、存在しない「出撃ボタン」、Skill 1 を「溜め攻撃」とする旧仕様の説明、必殺技（Ult）を「リチャージ制」とする旧仕様の説明、Skill 2 の既存仕様に対する操作説明（存在しない・不足している場合）。
  - これは既存仕様と食い違っている説明文を修正する決定であり、Skill 1 / Skill 2 の新しい仕様を決定したものではない。Skill 1 / Skill 2 の機能そのものを変更しない。
  - 実装時は、現在実装されている実際の操作に合わせて既存の説明を修正する。新しい操作体系・新機能の追加は承認していない。「チャージ攻撃」を独立したシステムとして復活させない。
  - 処刑の説明・パッド注記・全体的な操作説明の再設計は後続 Task へ送る。
  - 改訂前の記述（「Skill 1 の呼称・Skill 2 の説明追加 … は後続 Task へ送る」）のうち、Skill 1 の旧仕様説明（溜め攻撃）の修正と Skill 2 の操作説明の修正を UI-002-F へ送る部分は、本改訂により取り消す。
- **HD-P7**: 第一章では XP が存在しないため、撤退時 XP+・XP 報酬表示・XP 関連トーストを本編では表示しない。撤退時に残す報酬情報がある場合は、XP 以外の実在する報酬だけを表示する。
- **HD-P8**: UI-002-A では表示可否判定の architecture を全面的に再設計しない。既存の構造を利用して最小限の変更を行う。表示可否判定の本格的な集約は T-ARCH 等の別 Task 候補として扱う。A の実装で必要になる最小限の判定変更は許可する。
- **HD-P9**: docs/README.md D-02 の記述差異は UI-002-A では修正しない。T-DOCS 等の別 Task で扱う。

### UI-002-A: AP-5（2026-09-27）

- 第一章では 💎 / 🔩 を新規入手させない。
- 旧セーブの所持数は変更しない。旧セーブを削除・変換しない。
- 宝箱報酬を別報酬へ自動置換しない。
- ボス報酬の固有名については、物語上の意味を確認してから別途判断する（未決定）。

### UI-002-A: AP-8 送り先（2026-09-27）

| # | 論点 | 送り先 |
| --- | --- | --- |
| N-1 | Skill 1 の付け替え | UI-002-F |
| N-2 | 鍛冶屋が装備・スキル・商店として機能している問題 | UI-002-G |
| N-3 | 「最強装備」「まとめて売却」「外す」 | UI-002-F |
| N-4 | 旧セーブの Skill 2・必殺技の付け替え | UI 部分は UI-002-F。セーブ / ゲーム状態部分は別 Task 候補 |
| N-5 | 旧セーブのスフィア解放・ボス能力が本編の戦闘値に影響 | T-SAVE / 別ゲーム状態 Task 候補 |
| N-6 | 「鑑定所」という画面名称 | UI-002-G |

### UI-002-A: AP-9（2026-09-27）

- ここまでに決定した Human Decision を `.ai/decisions/` に正式記録する（本記録の更新）。

### UI-002-A: AP-10（2026-09-27）

- UI-002-A は Work Item ごとに Human Approval する。
- Skill 3 については、WI-A2 の中で UI・入力・トースト / 警告・発動を一体として扱う。

### UI-002-A: Work Item 構成（2026-09-27）

- WI-A1: 第一章から Level / XP 関連 UI および XP 報酬表示を除去（XP bar、撤退時 XP+、XP 関連 toast、Lv不足、レベル未達）。撤退時に表示する報酬は第一章で実際に存在するものだけとする。具体的な文言は未確定。第二章以降の成長システム自体は変更しない。
- WI-A2: 第一章における Skill 3 の UI・入力・発動停止（Skill 3 HUD、Skill 3 操作ヒント、U キー、十字キー左、タップ入力、Skill 3 関連 toast、Skill 3 関連 warning、Skill 3 発動）。旧セーブデータ自体は変更しない。第一章でのみ使用不能とする。
- WI-A3: 第一章から一括鑑定を除去（「一括鑑定」UI、第一章に存在しない鑑定導線）。未鑑定品のデータそのものは削除・変換しない。第二章以降の鑑定システムは変更しない。
- WI-A4: 第一章 UI に存在する、現在のゲーム仕様と食い違う説明文を修正（存在しない鑑定ボタン、存在しない出撃ボタン、Skill 1 を溜め攻撃とする旧仕様の説明、必殺技をリチャージ制とする誤表記、Skill 2 の既存仕様に対する操作説明）。処刑の説明・パッド注記・全体的な操作説明の再設計は後続 Task へ送る（2026-09-27 改訂、HD-P6 参照）。
- WI-A5: 第一章で不要な鑑定・強化系素材について、本編 UI 上の表示・報酬導線を整理する（対象候補: 💎、🔩、鑑定素材、強化素材 / メニュー表示、鑑定所ヘッダ、宝箱報酬、ボス報酬）。既存セーブデータの削除・正規化は行わない。第二章以降の素材仕様は決定しない。
- UI-002-A の Scope 外: UI 全体の visual redesign、Combat HUD の全面再設計（D）、Character / Equipment 画面の全面再設計（F）、Tavern UI（G）、Notification / Result UI の visual redesign（H）、Design system（C1 / C2）、Icon system（E）、Final responsive（I）、第二章以降の成長システム設計、第二章以降の鑑定システム設計、旧セーブの正規化、docs/README.md の修正、architecture 全体の表示可否集約。

### UI-002-A: WI-A5 結果画面の 💎 / 🔩 報酬表示（2026-09-27 追加）

- Chapter 1 通常プレイでは、実際に付与されない 💎 / 🔩 報酬を結果画面に表示しない。
  - 「💎 主の袖飾り ×1」のような 💎 / 🔩 の報酬行を表示しない。
  - 実際に付与される報酬のみ結果画面に表示する。
  - 💎 / 🔩 の加算も行わない。
  - 報酬名そのものを別のアイテム名へ勝手に変更しない。
  - 宝箱・ボス報酬を別報酬へ自動置換しない。
- 「主の袖飾り」等の名称自体は UI-002-A では変更・削除・置換しない。本決定は「実際に付与されない 💎 / 🔩 報酬を Chapter 1 の結果画面に表示しない」という UI 上の扱いだけである。報酬名や報酬そのもののゲームデザイン変更が必要になった場合は、別途シナリオ／ゲームデザイン側で Human Decision を取る。

### UI-002-A: 実装開始と Persistence（2026-09-27 追加）

- WI-A1〜A5 の Implementer 実装を開始してよい。
- 実装結果の commit / push を、専用実装ブランチ `claude/ui-002-a-impl` に限り許可する。
- 許可範囲: WI-A1〜A5 の承認済み内容の実装 / 必要なテストコードの追加・期待値更新 / build・unit・E2E による検証 / 上記ブランチへの commit / 上記ブランチへの push。
- 許可しないもの: main への直接 push / main への merge / 他の Task の実装 / UI-002-F / G 等の先行実装 / 承認されていない仕様変更 / Artifact Identity の変更 / セーブデータの削除・変換・初期化 / Test Mode の変更。

### UI-002-B: D-1〜D-7 と追加方針（2026-09-27）

UI-002-B Analyzer report（`.ai/reports/UI-002-B-analysis.md`、branch `claude/ui-002-b-analysis` @ `7595db4`）§6 の論点に対する Human Decision。

- **D-1（分離方式）**: `?dev=1` 方式を採用する。通常 URL では開発用 UI を表示・操作できない。`?dev=1` が付いている場合のみ開発用 UI を有効化する。`?dev=1` の状態を localStorage 等へ永続保存して覚える方式は採用しない。本番ビルドから開発コードそのものを除去する方式も今回は採用しない。目的は開発機能の完全秘匿ではなく、通常プレイと開発用 UI の明確な分離とする。
- **D-2（実機確認）**: 実機確認は今後も GitHub Pages の本番 URL を使用する。通常 URL と `?dev=1` の両方を確認対象とする。
- **D-3（デバッグモード入口）**: `` ` `` キーと、メニュー下のバージョン表記 5 回連打も分離対象とする。通常 URL からこれらの操作によって開発用 UI へ到達できないようにする。`?dev=1` の場合は従来どおり利用可能とする。
- **D-4（ホーム画面起動）**: ホーム画面から起動した場合も通常 URL と同じ本番扱いとする。ホーム画面起動時に開発用 UI を使える必要はない。開発確認時は明示的に `?dev=1` を使用する。
- **D-5（テスト変更）**: 今回の開発 UI 分離によって必要になる範囲のテスト修正を許可する。テストの意味や検証内容を変える修正、不要なテスト改変、機能追加は行わない。既存 FAIL / FLAKY / NOT_RUN は勝手に PASS 扱いしない。
- **D-6（テストモード中の設定保存）**: 現状維持。UI-002-B では設定保存の仕様変更やセーブ形式変更を行わない。
- **D-7（タイトルのテストモードボタン）**: 「🛠 テストモード」ボタンは通常 URL では非表示とする。`?dev=1` の場合は従来どおり表示・利用可能とする。UI デザイン変更ではなく、開発機能の可視性制御として UI-002-B の範囲に含める。
- **追加方針**:
  - 通常 URL で開発用 UI へ到達できる別経路が残らないことを確認する。
  - `?dev=1` では既存の Test Mode / DEBUG / Arena / PERF / Motion Preview 等を従来どおり利用できることを確認する。
  - CSS や通常 UI のデザイン刷新は行わない。
  - Chapter 1 のゲーム仕様変更は行わない。
  - UI-002-A の完了済み仕様には手を入れない。
  - 実装前に Planner へ進み、Task / Work Item を提示する。
  - Human 承認なしに Implementer へ進まない。

### UI-002-B: Planner 承認と Persistence（2026-09-27）

- AP-B1〜AP-B7 をすべて承認（内容は `.ai/tasks/UI-002-B.md`「Human Approval 内容」）。
- 実装ブランチ `claude/ui-002-b-impl` への commit / push を許可。main への push / merge、Reviewer への移行は許可していない。

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
- 第二章以降の成長・鑑定・素材システムの詳細仕様
- UI-002-A: ボス報酬の固有名（「主の袖飾り」等）の扱い（物語上の意味の確認後に判断）
- UI-002-A: 各 Work Item の Human Approval（Scope・Files To Change・Persistence）、WI-A1 / WI-A4 の具体的な文言、旧セーブ未鑑定品の本編での扱い、固定文言を本編だけ変えるか両モード共通か、検証用 E2E の追加先と tests 変更の可否

## Reason

Human による理由の記述は無い。UI-001 Analyzer report・UI-002 Planner report（2026-09-26）、UI-002-A Analyzer report・Planner report v1 / v2（2026-09-27）を確認した上での判断として記録する。

## Alternatives Considered

UI-002 Planner report §16 に Planner が提示した選択肢（例: HD-1 の「テストモード限定 / 削除 / 後半解放」、HD-3 の G1〜G3）がある。UI-002-A Planner report v1 / v2 にも Planner が提示した選択肢・推奨・文言候補がある。上記 Decision に書かれていない選択肢・推奨・文言候補は採否を決定していない。

## Consequences

- Human の指示により、UI-002-A〜I の Task file を `.ai/tasks/UI-002-*.md` に起票する。
- UI-002 Planner report のうち、上記 Decision に書かれていない内容は Human Decision ではない。
- Human の指示により、`.ai/tasks/UI-002-A.md` に上記 Decision を反映し、WI-A1〜WI-A5 を Work Item として記載する（いずれも未承認）。

## Related Tasks

UI-001 / UI-002 / UI-002-A / UI-002-B / UI-002-C1 / UI-002-D / UI-002-V / UI-002-C2 / UI-002-E / UI-002-F / UI-002-G / UI-002-H / UI-002-I

## Decision History

| Date | 内容 | Where |
| --- | --- | --- |
| 2026-09-26 | HD-1〜HD-5、Undecided を記録 | 本セッションの会話（UI-002 Planner report 確認後）。branch `claude/ui-002-task-planning` |
| 2026-09-27 | 第一章ゲームデザイン境界、旧セーブを破壊しない原則、HD-P1〜HD-P9、AP-5、AP-8、AP-9、AP-10、UI-002-A の Work Item 構成を追記 | 本セッションの会話（UI-002-A Planner report v1 / v2 確認後）。branch `claude/ui-002-a-task-update` |
| 2026-09-27 | HD-P6 と WI-A4 の構成記述を、WI-A4 の Human Approval（5 項目）と整合するよう改訂。Skill 1 の旧仕様説明（溜め攻撃）と Skill 2 の操作説明の修正を WI-A4 で扱う（新しい Skill 1 / Skill 2 の仕様決定ではない）。改訂前の「UI-002-F へ送る」部分を取り消し | 本セッションの会話（WI-A4 承認後の Human 指示）。branch `claude/ui-002-a-task-update` |
| 2026-09-27 | UI-002-A WI-A5 の結果画面における 💎 / 🔩 報酬表示の扱い、実装開始と Persistence（`claude/ui-002-a-impl`）を追記。既存の Human Decision は変更していない | 本セッションの会話（実装開始前の Human 指示）。branch `claude/ui-002-a-task-update` |
| 2026-09-27 | UI-002-B の D-1〜D-7 と追加方針を追記。既存の Human Decision は変更していない | 本セッションの会話（UI-002-B Analyzer report 確認後）。branch `claude/ui-002-b-planner` |
| 2026-09-27 | UI-002-B の AP-B1〜AP-B7 承認と Persistence（`claude/ui-002-b-impl`）を追記 | 本セッションの会話（UI-002-B Planner 確認後）。branch `claude/ui-002-b-impl` |
