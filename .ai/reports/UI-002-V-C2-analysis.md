# UI-002-V-C2 Analysis

- Role: Analyzer（READ ONLY。コード・HTML・CSS・JS・テストは変更していない）
- Task: `.ai/tasks/UI-002-V.md`（Status: DRAFT）/ `.ai/tasks/UI-002-C2.md`（Status: DRAFT）。関連 `.ai/tasks/UI-002-E.md`（DRAFT）・`.ai/tasks/UI-002-D.md`（PLANNED）
- Date: 2026-09-29
- Session: UI-001 以降と同一の Claude Code セッション（独立性なし）
- Baseline: 作業ツリー HEAD `02ba8db0f5b3f677c4c074bb73fea1c67733bae2`（branch `claude/ui-002-c1-impl`）。`origin/main` = `40644f3`、tree 一致（UI-002-D §15.2.1 で確認済み。ソースの変更は無い）
- 表記: **FACT**（`path:line`）/ **INFERENCE**（推測）/ **RISK** / **HUMAN DECISION REQUIRED**
- 入力: Human の Visual Decision V-1〜V-7（2026-09-29、本セッションの会話）と、V / C2 の再整理指示

---

## 1. 現状（FACT）

| 対象 | 状態 | 根拠 |
| --- | --- | --- |
| UI-002-V | `Status: DRAFT`、Approval `[ ]`、Analysis 未作成、Implementation BLOCKED | `.ai/tasks/UI-002-V.md:3,9,12,17` |
| UI-002-C2 | `Status: DRAFT`、Approval `[ ]`、Analysis 未作成、Implementation BLOCKED。Title「Design System 適用（Visual Design の反映）」 | `.ai/tasks/UI-002-C2.md:3-17` |
| UI-002-E | `Status: DRAFT`、Title「Icon system（ゲーム専用ピクトグラムへの移行）」。先行 Task は C2 | `.ai/tasks/UI-002-E.md:3-5,44-47` |
| UI-002-D | `Status: PLANNED`。WI-D0 APPROVED（実測済み）、WI-D1 APPROVED（実装未着手）、WI-D2〜D6 WAITING_APPROVAL。変更は作業ツリーに未 commit | `.ai/tasks/UI-002-D.md`、`git status` |
| remote の全ブランチ | V・C2 はどのブランチでも DRAFT | `git show <branch>:.ai/tasks/UI-002-C2.md`（2026-09-29 確認） |
| Decision record | HD-1〜HD-5、UI-002-A / B / C1 の決定、UI-002-D の HD-D01〜D27（D の分は未 commit）。**V の Visual Decision は未記録** | `.ai/decisions/UI-002-human-decisions.md` |
| HD-5 | V は独立した Human Visual Decision Task。**V の判断が終わるまで C2 以降の本格的な visual implementation に進まない**。C2 は V の Human Decision を唯一の visual specification source とする | `.ai/decisions/UI-002-human-decisions.md:52-68` |

### 1.1 C1 の基盤（FACT）

- `src/styles/tokens.css`（99 行、`--ui-*` 58 個）: 現行値のみ。semantic 色（`--ui-text` / `--ui-text-muted` / `--ui-line` / `--ui-surface-*` / `--ui-hp-*` / `--ui-mp-*` / `--ui-stamina-*`）、書体、文字サイズ役割、radius・shadow の primitive、z-index 名、panel 部品 token。`main.css:2-3` で `@import`。
- V-7 の意味色のうち **Selected / Danger / Recovery / Special / Disabled に相当する token は無い**（INFERENCE: 58 個の名前を確認。`--ui-hp-*` は HP バー専用で Danger / Recovery の意味色ではない）。
- `src/core/ui-icons.js`（46 行）: 意味名 → 現在の emoji / 記号の対応表のみ。**どの画面からも参照されていない**（`src` と `tests` を検索。参照は unit test `tests/unit/ui-icons.test.js` だけ）。`attack` / `hp` は glyph なし（文字ラベル）、`skill` 💢、`ultimate` 💥、`potion` 🧪。
- ゲーム専用アイコンの資産は無い。`public/icons/` は PWA 用 PNG 2 点のみ。SVG は `12-progression-ui.js:2970` の球盤（インライン SVG 文字列）だけで、アイコン用の SVG 基盤は無い（FACT: `*.svg` / `<svg` / `createElementNS` を検索）。

### 1.2 開発用 UI ゲート（UI-002-B、FACT）

- `src/core/dev-ui.js`: `devUiEnabled(search)` は `?dev=1` の完全一致だけで true。保存しない（D-1）。
- `01-character-creation.js:130` `const DEV_UI = devUiEnabled(location.search)`。共有スコープの定数で、`:441`（テストモード入口）・`:578`・`02-world-common.js:1611`（`toggleDebugMode()`）が参照。
- 既存の開発用 UI: テストモード（`state.testMode`、訓練場）、デバッグモード（`state.debugMode`、`#debug-badge`）、Arena（`#arena-toggle-btn` / `#arena-panel`、訓練場でのみ `.show`、`14-training-ground.js:259`）、`#perf-panel`、`#motion-panel`（`index.html:140-161`）。
- E2E `tests/dev-ui-gate.spec.js`: 通常 URL で開発用 UI に到達できないこと、`?dev=1` で使えること、`?dev=1` が保存されないことを検証。

### 1.3 既存の Combat HUD 構造（FACT、詳細は `.ai/reports/UI-002-D-analysis.md` §3・§15.2）

- `#hud` 配下: `.hud-topleft`（肖像 `#hud-portrait` + `#weapon-badge`、名前、HP / MP / スタミナ / XP バー）、`#hud-loot`（☰ 🧪 🔷）、`#hud-hint`。
- `#touch-controls` 配下: `#btn-ult` / `#btn-charge`（Skill 1）/ `#btn-skill2` / `#btn-skill3` / `#btn-jump` / `#btn-dodge` / `#btn-attack`、スティック。入力の結び付けは id 依存（`10-input.js:116-133`）。
- 通知: `spawnToast()`（中央トースト `.item-pop`）と `pushMsgLog()`（`#msg-log`）が同じ文言を二重に出す（`11-combat-actions.js:2217-2251`、D0 実測 §15.2.6）。
- 現行アイコン: 必殺 💥 / Skill 1 💢（職業で置換）/ 攻撃は文字「攻撃」/ 武器バッジは `WEAPON_TYPES` の emoji（初期文字「M」）/ 回復 🧪。

## 2. V-1〜V-7 との整合性

| Decision | 現状との関係 | 整合 |
| --- | --- | --- |
| V-1 コンセプト（中世ファンタジー × トゥーン × マット × シンプル） | 現行は暗色パネル＋金系アクセント＋Cinzel / Noto Serif JP。トゥーン・プレート型・革装丁・魔導紋章の部品は無い | 矛盾なし（新規に作る） |
| V-2 マテリアル（matte、厚い輪郭、blur / glass / glow 禁止） | FACT: `#btn-ult.ready` は脈動、`.item-pop` 等に半透明背景。HUD パネルは `rgba(12,10,16,0.55)`（`--ui-surface-hud`） | 既存 UI の一部が V-2 と合わない（C2 Prototype では新部品で示す。既存 UI の置換は C2 の範囲外） |
| V-3 形状・判読性 | 現行ボタンは円形＋emoji | 矛盾なし（新規） |
| V-4 文字依存を減らす | 「攻撃」は文字だけ、HP / MP / スタミナは文字ラベル、通知は文字のみ | 既存と方向が異なる（C2 Prototype で示す） |
| V-5 ゲーム固有アイコン・Emoji 不使用 | 現行アイコンはすべて emoji / Unicode。`ui-icons.js` は置換前の対応表として既にある | 既存と方向が異なる。C2 は少数の Prototype、本置換は E |
| V-6 状態の視覚化 | FACT: cooldown はリング（`--cd-pct`）、必殺 ready は `.ready` の脈動、未習得は `.locked`（非表示）。pressed / disabled の見た目は部品ごとにばらばら | 常時脈動は V-6「常時発光・常時点滅は禁止」と合わない（C2 Prototype で代替を示す。既存の変更は範囲外） |
| V-7 意味色とキャラクター色の分離 | tokens.css に意味色の一部はあるが Selected / Danger / Recovery / Special / Disabled が無い。キャラクターパレットは CHARACTER-VIS で確定済み（T-5 / T-7） | 矛盾なし。**新しい意味色の値は未決定**（§13） |

- V-1〜V-7 は色・書体・具体寸法の **値** までは決めていない（INFERENCE: 本文に数値が無い）。HD-5 により C2 は V の Decision だけを visual specification source とするため、値が必要な箇所は Human に確認する必要がある（§13）。

## 3. V Task との関係

- Human の指示（2026-09-29）: V-1〜V-7 は Visual Decision として記録するが、**V を DONE にしない**。V の残作業は「実画面の Visual Sample を見て Human が方向性を確認する」こと。
- 既存 V Task の Purpose は「C1 の基盤で少数の代表画面・代表コンポーネントの UI 見本を作り、Human が実画面で判断する」（`.ai/tasks/UI-002-V.md:28-30`）。
- **構造上の問題（INFERENCE）**: 新しい C2 の目的「V の Visual Decision を実画面で確認できる Combat HUD Prototype として実装する」は、V の残作業（実画面の Visual Sample）とほぼ同じ成果物になる。
  - HD-5 は「V の判断が終わるまで C2 以降の本格的な visual implementation に進まない」。C2 Prototype を V 完了前に作ることが HD-5 に反しないかは Human の判断（§13 H-1）。
  - 候補:
    - (a) C2 Prototype を **V の Visual Sample として扱う**（C2 Prototype を見た Human の確認で V が DONE になる。HD-5 の「本格的な visual implementation」は E / F / G / H 等の本番適用を指すと解釈）
    - (b) V で別途簡易見本を作り、V DONE 後に C2 Prototype を作る（手戻りが増える）
    - (c) V と C2 を統合する

## 4. C2 Task の旧定義（FACT: `.ai/tasks/UI-002-C2.md`）

- Title: Design System 適用（Visual Design の反映）。Task Type: 実装 Task（visual change あり）
- Purpose: V で承認した Visual Design を Design System（token・共通部品）へ適用する
- Scope: V の Human Decision に基づく token 値・共通部品の見た目の適用。対象画面は Analyzer / Planner が決める
- Out of Scope: V に無い見た目の決定、**アイコンの置換（UI-002-E）**、画面ごとの情報設計（F / G / H）
- Dependencies: 先行 V（完了必須）、後続 E / F / G / H

## 5. C2 Task の新定義案（Human の指示 2026-09-29 に基づく）

| 項目 | 新定義 |
| --- | --- |
| 正式名称 | UI-002-C2 Combat HUD Visual Prototype |
| 目的 | V で決めた Visual Decision を、実際のゲーム画面上で確認できる Combat HUD Prototype として実装する |
| 性格 | デザインの試作品。Design System の全体適用ではない。見た目・アイコンの視覚言語・状態表現・HUD 部品の視覚的まとまりを実画面で確認する |
| 対象 | Character Status（肖像・名前・HP・HP バー）/ Weapon Badge / HP / Attack / Skill 1 / Skill 2 / Ultimate / Heal / 代表的な通知 1 種 / ゲーム固有アイコン 2〜3 種（Attack・Ultimate・Heal を視覚言語の代表例とする） |
| 状態 | normal / pressed / disabled / cooldown / Ultimate ready（V-6） |
| 表示場所 | `?dev=1` の開発用 UI ゲートの内側。本番には出さない。セーブ・gameplay state・通常進行に影響しない。テストモードと混同しない |
| D との関係 | 配置を決めない（「どこに置くか」ではなく「置いたときにどう見えるか」） |

- 旧定義から変わる点: 「Design System への適用」→「Prototype」、「アイコン置換は Out of Scope」→「代表アイコン 2〜3 種を Prototype として作る」、先行 V の「完了必須」→ §3 の判断次第。

## 6. C2 / E の境界

| | C2（デザインの試作品） | E（アイコンシステムの本実装） |
| --- | --- | --- |
| アイコン数 | 代表 2〜3 種（Attack・Ultimate・Heal） | アイコンセット全体 |
| 適用先 | `?dev=1` の Prototype 表示のみ | 全主要 UI・各画面 |
| 対応表 | 使わない / 参照のみ | `ui-icons.js` の icon mapping を本実装 |
| emoji 置換 | しない（本番 UI は現行のまま） | Unicode / Emoji からの本格置換 |
| 成果 | icon visual language の基準（線幅・角度・シルエット・状態） | 規則の体系化と展開 |

- 既存 E の Out of Scope「見本にない新しい visual 方向性の決定（V / C2）」（`.ai/tasks/UI-002-E.md:40`）とは整合する。E の先行 Task が C2 である点も変わらない。
- RISK: C2 の Prototype アイコンの形式（インライン SVG / SVG ファイル / CSS 描画）を C2 で決めると、E の「icon の形式は Analyzer / Planner で調査・設計する」（`UI-002-E.md:36`）を先取りしうる。C2 の形式は Prototype 限定であり E で再検討する、と明記する必要がある（§13 H-5）。

## 7. `?dev=1` Prototype 方式の候補（実装はしない）

| 案 | 内容 | 利点 | 懸念 |
| --- | --- | --- | --- |
| P-1 | `?dev=1&ui=proto` などの追加クエリで、戦闘画面上に Prototype HUD を**既存 HUD と並べて**重ねる（既存 HUD はそのまま） | 実画面で従来 UI と新 UI を同時比較できる。既存 HUD の id・E2E に触れない | 画面が混む。クエリ判定の追加（`dev-ui.js` に純粋関数を 1 つ）。既存 HUD と重なる |
| P-2 | `?dev=1` 時だけ出る開発用トグル（Arena ボタンに似た小ボタン）で、Prototype HUD の表示を切り替える | 実プレイ中に ON / OFF で比較できる | 新しい開発用ボタンが増える。通常 URL で出ないことの E2E 追加が要る |
| P-3 | `?dev=1` 時だけ開ける独立した「Prototype 見本」オーバーレイ（ゲーム画面の上に部品を並べる。操作不可） | 状態（normal / pressed / disabled / cooldown / ready）を一覧で見せやすい。gameplay に影響しない | 「実際のゲーム画面上で」の要件に対して、実戦闘中の見え方の確認が弱い |
| P-4 | P-1 または P-2 に P-3 の状態一覧を組み合わせる | 実戦闘の見え方と状態一覧の両方 | 規模が大きい |

共通条件（Human の指示）: production では表示しない / save data・gameplay state・通常進行に影響しない / テストモードと混同しない。

- INFERENCE: テストモード（訓練場）上で Prototype を表示すると「テストモードと混同しない」に反しうる。Prototype の表示条件は `DEV_UI` と独立したフラグ（追加クエリまたはトグル）にし、`state.testMode` に依存させないのが素直。
- 戦闘中の見え方を確かめるには敵が要る。通常 URL + `?dev=1` の本編には敵がいる場面へ行くまで時間がかかる（D0 実測で本編の戦闘は NOT_RUN）。訓練場の Arena を使う場合はテストモードとの区別を表示で明示する必要がある（§13 H-4）。
- Prototype の値（ゲージ・cooldown・ready）は既存 state を**読むだけ**にする（書かない）。既存の入力には結び付けない（Prototype のボタンを押しても攻撃しない）か、結び付けるかは Human の判断（§13 H-6）。

## 8. D との依存関係

- D は変更しない。D1 は APPROVED のまま保持（実装は未着手・保留）。D2〜D6 は WAITING_APPROVAL のまま。
- C2 は配置を決めない。Prototype の配置は「確認用の仮配置」であり、D2 以降のゾーン設計の入力にしない（明記が必要）。
- 接点:
  - Weapon Badge: C2 は見た目の基準だけを作る。「M」誤表示の修正は D1（HD-D06 / WI-D1）。
  - Ultimate: HD-D15 は「チャージ情報は Action Zone 内に集約、％・リング・READY 等の表現は V / C2」。C2 の ready 表現は D3 の入力になる。
  - Heal: HD-D12 は「回復アイテム専用のクイック使用 UI を Action Zone に配置」。C2 は見た目のみ、配置・機能は D3。
  - Notification: HD-D17 は「中央トーストとログの二重表示を廃止」。C2 の代表通知は二重表示の設計にしない（Human の指示）。最終設計は D5。
  - MP: C2 では新規表示しない。MP の廃止（HD-D10）は C2 で扱わない。
- RISK: D1 の実装（表示条件の pure function、`finishEnteringGame()` の同期）と C2 の Prototype 表示が同じ `14-hud-boot.js` に触れる場合、同時進行で衝突しうる。C2 は既存 HUD の更新関数に手を入れない形（Prototype 専用の描画を別に持つ）が望ましい（INFERENCE）。

## 9. 実装対象候補（提案。Planner が確定する）

| 対象 | 候補 | 備考 |
| --- | --- | --- |
| 表示ゲート | `src/core/dev-ui.js` に Prototype 表示の判定関数を追加（例 `uiProtoEnabled(search)`）+ unit test | 既存 `devUiEnabled` を再利用し、`?dev=1` 以外で false |
| アイコン | Prototype 用のアイコン 2〜3 種（Attack・Ultimate・Heal）。形式は インライン SVG 文字列（例: `src/core/` の純粋データ）または `public/` の SVG ファイル | 形式は §13 H-5 |
| Prototype HUD | 新しい legacy part（例 `src/legacy/parts/15-ui-proto.js`）または既存 part への小さな追加。DOM は JS で生成（`index.html` を触らない案）または `index.html` に容器 1 つ | `basefile.html` は変更しない。ES module 化しない |
| スタイル | `src/styles/` に Prototype 専用 CSS（例 `ui-proto.css`、class を `.uip-*` 等で分離）。C1 token を参照し、新しい意味色 token を追加する場合は値の Human Decision が必要 | 既存 selector を変えない |
| テスト | unit（ゲート判定・状態→表示の純粋関数）、E2E（通常 URL で Prototype が出ない / `?dev=1` + 指定で出る / セーブに影響しない） | 既存 spec は変更しない想定 |

## 10. Out of Scope（C2）

- D1〜D6 のレイアウト・最終配置・ゾーン設計、中央 60% 侵入・重なり・safe-area の解消
- 既存本番 HUD の見た目変更、既存アイコンの置換（E）
- MP の廃止・表示削除、Skill 3・Level / XP・所持品チップの復活
- 攻撃モーション・武器形状・キャラクターモデル・VFX・戦闘ロジック・ダメージ / バランスの変更
- メニュー・酒場・セーブ・シナリオ画面など C2 対象外の UI
- 全職業分のアイコンセット、Emoji の新規採用
- 新しいゲームシステムの追加

## 11. リスク

| # | リスク |
| --- | --- |
| R-1 | HD-5（V 完了前に C2 以降の visual implementation に進まない）と、V を DONE にしないまま C2 Prototype を作る方針が衝突する（§3） |
| R-2 | V-1〜V-7 に色・寸法の値が無いため、Prototype で AI が値を補うと HD-5（C2 は V を唯一の visual specification source）に反する |
| R-3 | Prototype 表示を既存 HUD に重ねると、既存 E2E の可視判定・boundingBox 検査に影響しうる（`combat-test-arena` の重なり検査など） |
| R-4 | Prototype のアイコン形式が E の形式設計を先取りする（§6） |
| R-5 | D1 の実装と同じファイル（`14-hud-boot.js`）を触ると衝突する（§8） |
| R-6 | テストモード上で表示すると「テストモードと混同しない」に反しうる（§7） |
| R-7 | Prototype のボタンを入力に結び付けると gameplay に影響する（§7） |
| R-8 | 作業ツリーに UI-002-D の未 commit 変更があり、C2 / V の文書を同じファイル（Decision record）に書くと D の変更と混ざる |

## 12. Unknowns

- Prototype の表示方式（P-1〜P-4）と、追加クエリ・トグルの形
- 戦闘中の見え方をどの場面で確認するか（本編 / 訓練場 + Arena）
- アイコンの形式（SVG / CSS）と置き場所
- V-7 の新しい意味色（Selected / Danger / Recovery / Special / Disabled）の値
- Ultimate ready の「短い視覚フィードバック」の具体（長さ・回数）
- 代表通知の種類（例: 撃破・回復・体勢崩し のどれか）
- 代表アイコン 2〜3 種に Weapon Badge（剣士の大剣）を含めるか
- V の Visual Sample を C2 Prototype で兼ねるか（§3）

## 13. Human Decision Required（AI は決めていない）

| # | 判断事項 | 候補 |
| --- | --- | --- |
| H-1 | V と C2 の関係（HD-5 との整合） | (a) C2 Prototype を V の Visual Sample とし、Prototype を見た Human の確認で V を DONE にする / (b) V の見本を先に作る / (c) V と C2 を統合 |
| H-2 | C2 の再定義は 2026-09-29 の Human 指示で決定済みとして `.ai/tasks/UI-002-C2.md` に反映した（旧定義は同ファイルに履歴として残した）。反映内容の確認 | 反映内容で良いか |
| H-3 | Prototype の表示方式 | P-1 / P-2 / P-3 / P-4（§7） |
| H-4 | 戦闘中の確認場面 | 本編（`?dev=1`）/ 訓練場 + Arena（テストモードとの区別の表示つき） |
| H-5 | アイコンの形式と、E での再検討の扱い | インライン SVG / SVG ファイル / CSS。C2 の形式は Prototype 限定と明記 |
| H-6 | Prototype のボタンを入力に結び付けるか | 結び付けない（見た目だけ。既存 state を読むだけ）/ 結び付ける |
| H-7 | V-7 の意味色・寸法等の値 | Human が値を決める / Planner が候補を出し Human が選ぶ |
| H-8 | Decision record（`.ai/decisions/UI-002-human-decisions.md`）への V-1〜V-7 の記録の時期 | UI-002-D の未 commit 変更が同じファイルにあるため、D の Persistence 後に記録する / 今すぐ同じファイルに追記する（D と混ざる）/ 別ファイルに記録する |
| H-9 | C2 の Persistence（ブランチ名・commit / push の許可） | C2 の Human Approval 時に決める |

## 14. Planner に進めるか

- `.ai/AGENTS.md` §5.2 により、Analyzer → Planner の受け渡しは Artifact Handoff（Human が本 report を remote に置き、Source SHA・Blob SHA を記録）が前提。本 report は未 commit のため **Planner の着手条件を満たしていない**。
- 加えて H-1（V と C2 の関係）・H-2（C2 の再定義）が決まらないと、Planner は Work Item を確定できない。

## 15. 変更したファイル

- `.ai/reports/UI-002-V-C2-analysis.md`（新規、本 report）
- `.ai/tasks/UI-002-V.md` / `.ai/tasks/UI-002-C2.md` / `.ai/tasks/UI-002-E.md`: V-1〜V-7 の記録と再定義の参照を最小限追記（Status・Approval は変更していない）
- ソース・HTML・CSS・JS・テスト・Decision record は変更していない。build / unit / E2E は実行していない。commit / push はしていない。
