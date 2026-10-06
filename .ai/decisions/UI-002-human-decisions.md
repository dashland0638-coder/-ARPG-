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

### UI-002-B: テスト結果の扱いと Reviewer 移行（2026-09-27）

- `execution-break.spec.js` 通常敵 Break → EXECUTE は既存 FAIL として扱う（UI-002-A 時点の FLAKY から変更。変更前 `eadf993` でも 3/3 同じ理由で FAIL、UI-002-B は execution 処理を変更していない）。今後勝手に PASS / FLAKY へ戻さない。修正は UI-002-B の範囲外（別 Task 候補）。
- UI-002-B の Reviewer 移行を承認（Implementation SHA `714fdc748c86bac3f530ab7a7d1f2f2026e5f21e`）。main への merge / push は許可していない。

### UI-002-C1: Planner 承認と Persistence（2026-09-27）

- AP-C1-01〜AP-C1-12 を承認（内容は `.ai/tasks/UI-002-C1.md`「Human Approval 内容」）。WI-C1-1〜3 を承認、WI-C1-4（layout 属性フック）は不採用。
- C1 の最重要条件は「見た目が変わっていないこと」。意図しない見た目変更は FAIL として扱う。
- 実装ブランチ `claude/ui-002-c1-impl` への commit / push を許可。main への push / merge は許可していない。

### UI-002-D: HD-D01〜HD-D20（2026-09-28）

UI-002-D Analyzer report（`.ai/reports/UI-002-D-analysis.md`）と Planner report（`.ai/reports/UI-002-D-plan.md`）の確認後に Human が確定した。**実装の承認ではない**（各 Work Item は WAITING_APPROVAL のまま。実装開始の許可は別途）。

- **HD-D01（実測ゲート）**: 実装開始前に WI-D0 の実測を必須とする。対象: 1280×800 / 844×390、戦闘 HUD 各要素の位置・大きさ、中央 60%×60% への侵入、virtual stick との干渉、safe-area、他 UI との重なり。実測できていない値を実測値として扱わない。CSS から計算した値は参考値に留める。
- **HD-D02（中央 60%×60%）**: 常時表示 UI は画面中央 60%×60% を避ける。ただし処刑・インタラクト・トーストなどの一時・条件付き表示は中央への表示を許可する。
- **HD-D03（既存 UI の扱い）**: 既存 UI を設計上の制約にしない。既存 UI は実装依存関係・既存仕様・テスト依存を確認するための資料として扱うが、「現在そうなっているから残す」「変更量が少ないから残す」という理由だけで新 HUD の設計を制約しない。**D の設計方針であり、既存仕様を無視してコードを変更してよいという意味ではない。**
- **HD-D04（レスポンシブ）**: 1280×800 と 844×390 では同じ HUD コンポーネントを使用しつつ、viewport サイズに応じて配置を変更する（画面サイズに応じた responsive layout）。UI-002-C1 で不採用となった body 属性方式を復活させない。
- **HD-D05（D で扱わないもの）**: 支援 AI HP / 目的表示 / 3 人パーティ HUD / 影の旅人専用 HUD / パッド表記は UI-002-D で扱わない。将来の別 Task / Game Design Decision として保留する（Undecided の記載は変更しない）。
- **HD-D06（武器バッジ）**: 武器バッジは Chapter 1 戦闘 HUD でも表示する。現在の「M」誤表示は修正する。
- **HD-D07（PC 操作ヒント）**: PC 操作ヒントは常時表示しない。初回・新しい操作の解禁時などに短時間だけ表示する方式へ変更する。
- **HD-D08（PC のタッチ用ボタン）**: PC ではタッチ操作用の攻撃・Skill 1・Ultimate ボタンを常時表示しない。戦闘操作自体や必要な戦闘情報を廃止する決定ではない。PC 用の操作表示は別途設計する。
- **HD-D09（常時表示）**: 戦闘 HUD ではキャラクター名・肖像・HP・武器バッジを常時表示する。
- **HD-D10（MP 廃止）**: MP を廃止する。単なる HUD 非表示ではなく、ゲーム内リソースとしての MP を廃止する方針である。実装時には combat logic / skill / item / state / save / old save など MP 参照箇所への影響を Analyzer で確認する。旧セーブデータの MP 値を無断で削除・変換しない。影響範囲が大きい場合は別 Task へ分離する。
- **HD-D11（スタミナ）**: スタミナは残す。戦闘 HUD では常時表示せず、必要時のみ表示する。
- **HD-D12（所持品）**: 通常の所持品チップは戦闘 HUD から除外する。戦闘中の回復アイテム使用は維持し、回復アイテム専用のクイック使用 UI を Action Zone に配置する。回復以外の通常所持品は戦闘 HUD に表示しない。
- **HD-D13（ゾーン DOM）**: HUD を役割別のゾーンに分けるため、必要な DOM コンテナを新設する。既存 DOM 構造を維持することを目的にしない。既存 E2E への影響は実装時に整理する。
- **HD-D14（Action Zone）**: Action Zone を再設計する。対象: 通常攻撃 / Skill 1 / Skill 2 / Ultimate / 回復アイテム。5 つを同格にすることは決定していない。具体的なサイズ・形・アイコン・色・階層は V / C2 で決定する。
- **HD-D15（Ultimate）**: Ultimate のチャージ情報は Action Zone 内に集約する。別 HUD に同じ Ultimate ゲージを重複表示しない。％・リング・READY など具体的な視覚表現は V / C2 で決定する。
- **HD-D16（インタラクト・処刑・コンボ）**: 現在の下中央単一列から分離する。インタラクト: 対象との関係が分かる位置。処刑: 対象との関係が分かり、操作可能であることが分かる位置。コンボ: 戦闘を邪魔しない位置。具体的な位置・サイズ・デザインは V / C2 で決定する。
- **HD-D17（通知）**: 同じ通知を中央トーストとログの 2 か所へ重複表示する方式を廃止する。情報の種類ごとに適切な 1 つの表示先へ統合する。単純にログを削除するのではなく、通知の役割と表示先を再設計する。既存 E2E の変更が必要になった場合は、D 実装の範囲として必要な変更を許可する。
- **HD-D18（表示条件の集約）**: HUD の表示条件を 1 か所の純粋関数モジュールに集約し、unit test を作成する。実際の DOM 更新処理は legacy 側に残してよい。C1 の legacy concat 構造を維持し、`basefile.html` を変更しない。
- **HD-D19（レポートの Persistence）**: Analyzer / Planner report の commit / push は Human が行う。Claude Code は今回の Task / Decision record 更新では commit / push しない。
- **HD-D20（実装ブランチ名）**: D の実装ブランチ名は `claude/ui-002-d-impl` とする。ただし実装開始の許可はまだ与えていない（Persistence も未許可）。

#### UI-002-D: HD-D21〜HD-D27（WI-D1、2026-09-28）

WI-D1（HUD 表示条件の整理）の実装計画の再確認（READ ONLY）を受けて Human が決定した。**WI-D1 の実装承認ではない**（WI-D1 は WAITING_APPROVAL のまま。Persistence も未許可のまま）。

- **HD-D21（ミニマップ）**: D1 ではミニマップの「必要な状態」を決定しない。pure function には必要条件を入力できる構造だけ用意し、Human Decision が確定するまでは現行の表示条件を維持する。ゲームデザイン上の必要条件を AI が決定してはいけない。
- **HD-D22（PC タッチボタン）**: D1 では PC のタッチ用ボタンを実際には非表示化しない。表示条件の pure function と unit test までを D1 で実施し、実際の PC 用 UI 変更は D3 で行う。これにより D3 の PC 操作 UI が存在しない状態で操作・情報表示手段を失うことを防ぐ。
- **HD-D23（PC 操作ヒントの表示済み状態）**: 初回または新しい操作の解禁時に表示する。「表示済み」の状態はセッション内だけ保持し、セーブデータには保存しない。セーブ形式・旧セーブ互換性への影響を発生させない。
- **HD-D24（PC 操作ヒントの表示時間）**: 表示時間は 5 秒とする。初回または新しい操作の解禁時に表示し、5 秒経過後に非表示とする。
- **HD-D25（スタミナ表示）**: スタミナが満タンかつ直近の消費がない場合は非表示。スタミナの消費中・回復中、および最後の消費から 3 秒間は表示する。D1 ではこの表示条件だけを扱い、スタミナのゲームロジック自体は変更しない。
- **HD-D26（E2E）**: D1 の仕様変更に伴う既存 E2E の修正および必要な E2E の追加を許可する。ただし既存検証を弱めたり、単に assert を削除して PASS させたりしてはいけない。新しい仕様を明示的に検証すること。既存 FAIL（mansion-escort、execution-break）および FLAKY（job-traits）の分類は変更しない。
- **HD-D27（Persistence）**: D1 実装は `claude/ui-002-d-impl` で行う。実装後に build / unit / E2E を実行し、Reviewer の独立レビューを経た後に commit / push することを許可する。ただし、現時点ではまだ実装承認ではない（WI-D1 の Approval 欄の Persistence は、WI-D1 の Human Approval 時に記入する）。

WI-D1 の受入条件の整理（Human の指示）: D1 での「常時表示」は DOM 上の表示状態を意味する。名前・肖像・HP・武器バッジは HUD が有効な間、表示状態であること。実際の画面上での位置・サイズ・他 UI との重なり・safe-area・中央 60%×60% への侵入・視認性は D2 / D3 / D4 の受入条件とする。

### UI-002-D: HD-D28〜HD-D29（2026-09-30）

- 決定者: Human（本セッションの会話「UI-002-D Planner Update」）。記録は AI（Planner）。WI-D1〜D6 の実装承認・Persistence ではない
- **HD-D28（C2 / V の参照）**: C2 / V は Human 承認・DONE・main 統合済み（main `790bde05283414234c6c53c951b72c6f29d52f91`）。D では C2 / V で確定した視覚方針（V-1〜V-7、C2 の semantic UI token と Prototype の視覚文法）を参照し、同じ視覚方針を D で再決定しない。HUD の具体的な位置・寸法・viewport ごとのレイアウト・safe-area・表示 / 非表示条件は D の責務。C2 Prototype の DOM を本番 HUD へそのままコピーすることを前提にしない
- **HD-D29（MP）**: MP 廃止は D では実装しない。ゲームシステム変更を含む別 Task として扱う。D では MP を単純に非表示にする実装も行わない（HD-D10 の D 内での扱いを置き換える。HD-D10 の「旧セーブの MP 値を無断で削除・変換しない」は別 Task でも維持する前提）
- 併せて Human が決定: WI-D0 は既存の実測（`.ai/reports/UI-002-D-analysis.md` §15.2）をもって DONE。再測定しない。E で変わった Weapon Badge / Attack glyph の内容は WI-D1 の実装前確認事項

### PROGRESSION-004: 第一章序盤の施設アクセス（2026-10-04）

- 決定者: Human（本セッションの会話「UI-002-F 施設アクセス仕様の確定・実装」）。記録は AI（Orchestrator）
- 剣士のみが登場している段階では、鍛冶師は酒場に登場していない。鍛冶設備も存在しない。
- 鑑定・装備変更・スキル変更などの施設機能にはアクセスできない。仮設の作業台などから施設画面へ到達できない。
- 「施設は存在するがボタンだけ無効」という扱いにはしない。ゲーム世界上、まだ施設が解放・登場していないため利用できない、という進行条件で扱う。
- 施設の具体的な解放タイミングは、既存仕様から確定できない場合は新しく決めない（Human の指示）。→ 既存の確定仕様（docs/SCENARIOS.md「酒場へ帰還 → 鍛冶屋が加入」= `smithJoined`、洋館クリア）を使う（Agent の記録。新しいタイミングは決めていない）。
- Test Mode は既存のテスト用途を壊さない。

### PROGRESSION-007: 第一章の鍛冶屋施設（HD-2）とショップ（HD-3）（2026-10-05）

- 決定者: Human（本セッションの会話「HD-2：鍛冶屋施設の役割 / HD-3：ショップの扱い」）。記録は AI（Orchestrator）。UI-002-F 再監査の HD-2 / HD-3 を確定する
- **HD-2**: 第一章の鍛冶屋は本格的な育成施設ではなく「装備管理・確認施設」。加入前は PROGRESSION-004 のまま（施設なし）。加入後に使えるのは、装備する・装備を外す・装備性能を見る・不要装備を売却する・スキルの習得状況と説明を見る、だけ。Skill 1 / Skill 2 の自由な付け替え、Skill 3 の解禁、装備強化、鍛造、クラフト、ランダム装備生成、スフィア盤、パッシブ育成、その他の第一章後の育成機能は使えない
- **Skill 1 の固定は第一章だけ**: 職業ごとの初期 Skill 1 に固定するのは第一章の規則で、ゲーム全体の Skill 仕様ではない。第一章クリア後は、習得済みの Skill から Skill 1 / Skill 2 を自由に編成する本来のシステムへ戻る。Skill 2 は第一章ではシナリオ中の「閃き」で習得し、自由に変更しない。Ult は職業固定。Skill 3 は第一章では未解禁
- **HD-3**: 第一章では通常ショップによるアイテム購入を解禁しない。第一章の消耗品・アイテムは宝箱・敵・シナリオ報酬・イベント等で限定的に入手する。「お金を稼ぐ → ショップで大量購入する」育成ループを第一章に作らない。ショップの本格利用は第一章クリア後の自由進行側。既存のショップ処理は第一章だけ利用不能にし、第二章以降の仕様は壊さない
- 第一章後（自由育成: Skill 1 / 2 の自由編成・ランダム装備・強化・鍛造・クラフト・ショップ・スフィア盤）の機能は今回新規に実装しない。既存実装は壊さず第一章から切り離す（Human の指示）
- 実装（Agent の記録）: 第一章の判定は既存の `legacyGrowth()`。商店は `LEGACY_AP_TABS` に加え、購入処理も同じ判定で止める。施設の表示は本編「鍛冶屋」「🔨 鍛冶士と話す(装備の管理)」（UI-002-F 再監査 W-3 を兼ねる）。装備・売却・スキル画面は既に HD-2 を満たしていたので変更していない

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
| 2026-09-27 | UI-002-B: execution-break を既存 FAIL として扱う決定、Reviewer 移行の承認を追記 | 本セッションの会話（UI-002-B 実装報告後）。branch `claude/ui-002-b-impl` |
| 2026-09-27 | UI-002-C1 の AP-C1-01〜12 承認（WI-C1-4 不採用）と Persistence（`claude/ui-002-c1-impl`）を追記 | 本セッションの会話（UI-002-C1 Planner 確認後）。branch `claude/ui-002-c1-impl` |
| 2026-09-28 | UI-002-D の HD-D01〜HD-D20 を追記（実装承認・Persistence ではない）。既存の Human Decision・Undecided は変更していない | 本セッションの会話（UI-002-D Analyzer / Planner report 確認後）。作業ツリー（未 commit） |
| 2026-09-28 | UI-002-D WI-D0（実装前実測・確認ゲート）の Human Approval（履歴のみ。承認内容の正本は `.ai/tasks/UI-002-D.md` の WI-D0 Human Approval）。WI-D1〜D6 の承認・Persistence ではない。既存の Human Decision 本文は変更していない | 本セッションの会話（WI-D0 承認指示）。作業ツリー（未 commit） |
| 2026-09-28 | UI-002-D の HD-D21〜HD-D27（WI-D1）を追記（WI-D1 の実装承認・Persistence の発効ではない）。既存の Human Decision・Undecided は変更していない | 本セッションの会話（WI-D1 実装計画の再確認後）。作業ツリー（未 commit） |
| 2026-09-30 | UI-002-D の HD-D28（C2 / V の視覚方針を参照）・HD-D29（MP 廃止は別 Task）と WI-D0 DONE の決定を追記（WI-D1〜D6 の実装承認・Persistence ではない）。既存の Human Decision・Undecided は変更していない | 本セッションの会話（UI-002-D Planner Update） |
| 2026-10-04 | PROGRESSION-004 の施設アクセスの決定を追記。既存の Human Decision・Undecided は変更していない | 本セッションの会話（施設アクセス仕様の確定・実装の指示） |
| 2026-10-05 | PROGRESSION-007: HD-2（第一章の鍛冶屋施設）・HD-3（第一章のショップ）と「Skill 1 の固定は第一章だけ」を追記。既存の Human Decision・Undecided は変更していない | 本セッションの会話（HD-2 / HD-3 の確定・実装の指示） |
