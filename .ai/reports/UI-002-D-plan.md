# UI-002-D Planner Report（Combat HUD 情報設計）

- Role: Planner（READ ONLY。書いたのは本ファイルのみ。Task file・Decision record・コード・テストは変更していない）
- Task: `.ai/tasks/UI-002-D.md`（Status: DRAFT のまま。Planner の Work Item を Task file へ反映するのは Human の指示後）
- Date: 2026-09-28
- Session: UI-001 以降と同一の Claude Code セッション（独立性なし）
- 本計画は **提案**。Human Approval があるまで実装しない。配置・情報量・見た目の「正解」は決めない。
- **2026-09-30 更新**: main `790bde0` 基準の Planner Update を §13 に追記した。§13 と矛盾する §0〜§12 の記述（baseline・C2 / V / E の状態・WI の Status・MP・旧 AP 番号）は §13 を優先する。§0〜§12 は 2026-09-28 時点の計画として残す。

## 0. 入力と前提の扱い

| 入力 | 状態 | 本計画での扱い |
| --- | --- | --- |
| Baseline main | `40644f3`（UI-002-A / B / C1 DONE） | 作業ツリーとの一致は **NOT_RUN**（Analyzer §15.1） |
| Analyzer report | `.ai/reports/UI-002-D-analysis.md`（未 commit・remote に無い） | AGENTS.md §5.2 の Artifact Handoff は **未成立**（Source SHA / Blob SHA が無い）。H-1〜H-8 は実行できない。**Task file に `Analysis:` 行を書く前に、Human による Persistence が必要** |
| 実画面の位置計測 | **NOT_RUN** | Analyzer §8.2 の数値は **CSS の値からの計算（INFERENCE）**。本計画は実測値として使わない |
| UI-002-C1 | DONE | `tokens.css`（現行値の token）と `ui-icons.js`（対応表のみ）を利用可能な基盤とする。値は変えない |

- 記号: **[F]** = Analyzer の FACT（コードで確認）、**[I]** = Analyzer の INFERENCE（CSS 計算・推測）、**[NR]** = NOT_RUN。
- 以下で「中央領域に入る」等と書く場合、根拠が [I] のものは実装前に実測で確認する（§8）。

## 1. 設計原則（依頼の 15 項目を本計画の判断基準として採用）

P-1 ゲーム画面を主役にする / P-2 HUD は常時覆わない / P-3 中央 60%×60% は Human Decision / P-4 常時・条件・一時を区別 / P-5 844×390 を実機相当として重視 / P-6 1280×800 との差を明示 / P-7 safe-area 考慮 / P-8 スティックと干渉しない / P-9 UI-002-A の Chapter 1 仕様を維持 / P-10 C1 の tokens を基盤にする（値は変えない）/ P-11 `ui-icons.js` は対応表のみ（絵柄を変えない）/ P-12 キャラ配色と UI の意味色を混ぜない / P-13 DOM id / class の変更は影響を明示 / P-14 E2E の依存を考慮 / P-15 ゲームロジックを変えない。

## 2. 現状の要点（Analyzer から。根拠の種別つき）

| 項目 | 内容 | 根拠 |
| --- | --- | --- |
| HUD 更新 | 毎フレーム `animate()` の通常プレイ分岐。表示開始は `finishEnteringGame()` | [F] `14-hud-boot.js:1105-1164, 1799` |
| 入力とボタン | タッチボタンは **id で入力に結び付く**（`bindHoldButton('btn-attack', …)` 等）。☰・🧪・🔷・インタラクト・処刑も id で listener | [F] `10-input.js:116-133`、`12-progression-ui.js:1724-1732` |
| PC の表示 | `.gamepad-min` で攻撃・Skill 1・必殺（習得後 Skill 2）を表示、押せない | [F] `main.css:753-758` |
| Chapter 1 の旧成長要素 | Level / XP / Skill 3 / 鑑定 / 💎🔩 は本編の戦闘 HUD に出ない | [F] Analyzer §5 |
| 重なり | `.hud-loot` が `.hud-topleft` の下部に重なる | [F] `main.css:640-678`（値の関係）/ UI-001 撮影 |
| safe-area | `.hud-topleft` は safe-area を使わない | [F] `main.css:640-645` |
| 中央領域 | 844×390 で左上パネル・必殺・Skill 2・攻撃の角が入る / トースト・インタラクト・処刑は両サイズで入る | **[I]**（CSS 計算。実測 [NR]） |
| ログとスティック | 左下ログ（最大 6 行）とスティックの範囲が縦に重なる | **[I]** |
| E2E 依存 | `#hud`（29 spec）、`#hud-name` 文言（完全一致）、`.dmg-pop`、`#msg-log` / `.item-pop`、`#execute-prompt`、ミニマップ地名、`#boss-bar-*`、`#interact-btn`、`#scenario-timer`、`#btn-charge` / `#btn-skill2` / `#btn-ult`、`#sta-fill` / `#mp-fill`、`ui-foundation`（見た目の値） | [F] Analyzer §10 |

## 3. 要素の 4 分類（案。Human 確認が必要なものに印）

| 要素 | 現状 | 分類案 | Human 判断 |
| --- | --- | --- | --- |
| 名前（主人公 ｜ 支援） | 常時 | 常時 | — |
| 肖像 | 常時 | 常時 | — |
| 武器バッジ | 常時（初回は「M」） | 常時 / 非表示 | **HDR-13** |
| HP / MP / スタミナ | 常時（バー） | 常時 | 表示形式は **V** |
| 所持品（☰・🧪・🔷） | 常時 | 常時 | — |
| ミニマップ・地名 | 常時（会話等で非表示） | 常時 | — |
| 階層表示 | 条件（部屋名あり） | 条件 | — |
| 攻撃・JUMP・回避・スティック（タッチ） | 常時 | 常時 | — |
| 攻撃・Skill 1・必殺（PC、押せない） | 常時 | 常時 / 条件 / 非表示 | **HDR-12** |
| Skill 1 | 常時 | 常時 | — |
| Skill 2 | 習得後 | 条件 | — |
| 必殺（ゲージ％・準備完了） | 常時 | 常時 | 表示方法は **HDR-06 / V** |
| Skill 3 | 本編は非表示 | 非表示（本編） | 確定（HD-2） |
| PC 操作ヒント | 常時（PC のみ） | 常時 / 条件 / 非表示 | **HDR-09** |
| ボスバー | 条件 | 条件 | — |
| 制限時間 | 条件（周回のみ） | 条件 | — |
| 雑魚 HP / 体幹 | 条件（被弾後） | 条件 | — |
| インタラクト | 条件（近接） | 条件 | 位置は **HDR-07** |
| 処刑 | 条件（窓の間） | 条件 | 位置は **HDR-07** |
| コンボ | 条件（連撃中） | 条件 | 位置は **HDR-08** |
| ダメージ数値 | 一時 0.8 秒 | 一時 | — |
| 中央トースト | 一時 1.7 秒 | 一時 | 二重表示は **HDR-10** |
| 左下ログ | 一時 6.5 秒 | 一時 / 非表示 | **HDR-10 / HDR-11** |
| 画面フラッシュ | 一時 0.4 秒 | 一時 | — |
| ゲームパッドバッジ | 条件（接続時） | 条件 | — |
| XP バー | 本編は非表示 | 非表示（本編） | 確定（HD-1） |

## 4. 「既存仕様だけで実装できる」項目と「Human が決めないと実装できない」項目

### 4.1 既存仕様・既存 Task の受け入れ基準だけで実装できる（見た目の判断を含まない）

| # | 内容 | 根拠 |
| --- | --- | --- |
| E-1 | `.hud-loot` と `.hud-topleft` の重なりを解消する（重ならない位置へ。色・形・大きさは変えない） | Task の Acceptance Criteria「HUD 要素同士が重ならない」。[F] 重なり |
| E-2 | `.hud-topleft` を safe-area に対応させる（`env(safe-area-inset-top/left)` を位置に加える。PC・Playwright では env()=0 のため位置は変わらない見込み [I]） | P-7。[F] safe-area 未対応 |
| E-3 | 武器バッジの初期文字「M」を、HUD 表示開始時に正しいアイコンへ更新する（表示条件の修正。アイコン自体は現行） | [F] `index.html:86`、`14-hud-boot.js:353-360` |
| E-4 | 4 分類の表示条件を 1 か所の表（`src/core/` の純関数）に集約し、unit test で固定する（現状の条件をそのまま移すだけ。表示は変えない） | P-4。既存 `legacyGrowthEnabled()` を再利用（AGENTS §3） |

- E-1 は位置の変更を伴う。**移動先の具体的な位置は Human が確認する**（配置の判断。見た目の判断ではない）ため、Approval で位置を確定する（AP-D05）。

### 4.2 Human の情報設計・配置の判断（DECISION）が必要

HDR-01（中央 60%×60% 方針の採否・対象）、HDR-02（ゾーン配置）、HDR-03（常時表示の情報量）、HDR-05（ボタンの位置）、HDR-06（必殺の表示場所）、HDR-07（インタラクト・処刑の位置）、HDR-08（コンボの位置）、HDR-09（PC ヒント）、HDR-10（通知の二重表示）、HDR-11（ログ・会話とスティックの共存）、HDR-12（PC の押せないボタン）、HDR-13（武器バッジ）、HDR-14（Undecided のうち D で要るもの）、HDR-15（1280×800 / 844×390 の配置差の範囲）、HDR-16（D で許す変更の範囲）。一覧は §9。

### 4.3 Human Visual Decision（UI-002-V）が必要（D では実装しない）

| 項目 | 理由 |
| --- | --- |
| HP / MP / スタミナの表示形式（バー / フラスコ / 数値 / アイコン） | 形・色の判断 |
| ボタンの大きさ・形・アイコン | 形・大きさの判断（位置は D） |
| 必殺の準備完了表現（脈動・リング） | glow・動きの判断（マット方針） |
| パネルの面・枠・blur | 質感の判断 |
| 最小文字サイズ（HUD ラベル 8.5px 等） | 文字の階層 |
| 新しい token（大きさ・余白・ゾーンの寸法） | C1 に無い値。**新規 token は Human Visual Decision Required** |
| アイコンの絵柄（`ui-icons.js` の差し替え） | E の範囲 |

## 5. Work Items

独立性を優先し、6 件にした（WI-D0 は実装前の計測。コードを変えない）。

### WI-D0 実測ベースライン（前提）

| 項目 | 内容 |
| --- | --- |
| Scope | 1280×800（非タッチ）/ 844×390（タッチ）× 通常戦闘・ボス戦・処刑・コンボ・制限時間・中央トースト・インタラクト・会話で、HUD 各要素の bounding box を計測し、中央領域・スティック・safe-area・相互の重なりを記録する。git で baseline と作業ツリーの一致を確認する |
| Files | 追記: `.ai/reports/UI-002-D-analysis.md`（計測結果の節）。計測スクリプトはリポジトリ外 |
| Allowed changes | Analyzer report への追記のみ |
| Forbidden changes | コード・CSS・テスト・Task・Decision record |
| Dependencies | なし（最優先） |
| E2E / unit impact | なし |
| Visual Decision dependency | なし |
| Acceptance criteria | 上記の全画面 × 2 サイズの計測値が記録される。計測できない画面は NOT_RUN と理由を記録（ボス戦・処刑・制限時間はテストモードのシナリオ直行で到達可能か確認する） |

### WI-D1 HUD 表示条件の整理（Chapter 1 情報）

| 項目 | 内容 |
| --- | --- |
| Scope | E-3（武器バッジ初期表示）、E-4（表示条件の集約表・unit test）。HDR-09 / 12 / 13 の決定があればその表示条件の変更 |
| Files | `src/core/combat-hud-visibility.js`（新規・純関数、案）、`tests/unit/combat-hud-visibility.test.js`（新規）、`src/legacy/concat-plugin.js`（HEADER import 1 行）、`src/legacy/parts/14-hud-boot.js`（`updateHUD` / `finishEnteringGame` の表示分岐）、`src/legacy/parts/10-input.js`（`refreshTouchControls`、HDR-12 採用時のみ） |
| Allowed changes | 表示・非表示の条件。表の追加。現行の表示結果を変えない移し替え |
| Forbidden changes | DOM id / class の変更・削除、入力の結び付け（`bindHoldButton` 等）、見た目の値、ゲームロジック、UI-002-A の本編非表示（XP / Skill 3 / Lv） |
| Dependencies | WI-D0（HDR の判断材料）。HDR-09 / 12 / 13 |
| E2E / unit impact | 表示を変えない移し替えは影響なし。HDR-12（PC ボタン非表示）採用時は `chapter1-skill2` / `chapter1-progression` / `chapter1-dusk-basics` / `auto-combo` の `#btn-charge` / `#btn-skill2` の判定に影響しうる（PC で非表示にすると locator の可視判定が変わる） |
| Visual Decision dependency | なし（E-3・E-4）。HDR-09 / 12 / 13 は情報設計の判断 |
| Acceptance criteria | 集約表が現行の表示条件と一致（unit）。本編で XP / Skill 3 / Lv が出ない（既存 `chapter1-legacy-ui` PASS）。武器バッジが開始直後から正しい |

### WI-D2 レイアウト基盤（ゾーン・safe-area・重なり解消）

| 項目 | 内容 |
| --- | --- |
| Scope | E-1（所持品チップの重なり解消）、E-2（左上パネルの safe-area）。HDR-02 / 15 の決定後に、HUD のゾーン配置（左上 / 右上 / 右下 / 下中央）の位置調整 |
| Files | `src/styles/main.css`（HUD の位置指定のみ）。ゾーン容器を足す場合は `index.html`（**AP-D03 で判断**） |
| Allowed changes | `top` / `left` / `right` / `bottom` / `margin` / `env(safe-area-*)`。既存 token の参照 |
| Forbidden changes | 色・書体・角丸・影・文字サイズ・z-index の値（`ui-foundation.spec.js` が固定）、DOM id / class の変更、新しい token の値 |
| Dependencies | WI-D0。E-1 の移動先は AP-D05、ゾーン配置は HDR-02 / 15 |
| E2E / unit impact | `combat-test-arena` が Arena ボタンと `#loot-menu-btn` の **boundingBox の重なり** を検査（`.hud-loot` を動かすと再確認が要る）。ゾーン容器を足すと `#hud` 直下の構造が変わり、トースト等の追加先と `#hud .item-pop` 等の selector に影響（I-05） |
| Visual Decision dependency | 位置は D。ゾーンの寸法を新しい token にする場合は **Human Visual Decision Required** |
| Acceptance criteria | 1280×800 / 844×390 で HUD 要素同士が重ならない（実測）。1280×800 / Playwright で E-2 前後の位置が変わらない（computed / 実測）。`ui-foundation` PASS |

### WI-D3 操作ボタン（タッチ・PC）

| 項目 | 内容 |
| --- | --- |
| Scope | 844×390 のタッチボタン群（攻撃・JUMP・回避・Skill 1・Skill 2・必殺）とスティック・カメラ回転の位置。PC の押せないボタンの扱い（HDR-12 と連動） |
| Files | `src/styles/main.css`（`#touch-controls` 配下の位置） |
| Allowed changes | 位置（`right` / `bottom` / safe-area）。HDR-05 で許された場合のみ大きさ |
| Forbidden changes | ボタンの id（入力の結び付けが id 依存 [F]）、入力処理、アイコン・形・色、`.joy-zone` の当たり判定の変更（HDR-11 の決定が無い限り） |
| Dependencies | WI-D0、WI-D2（ゾーン）、HDR-01 / 05 / 11 / 15 |
| E2E / unit impact | ボタンの id / class は変えないため判定への影響は小さい見込み [I]。タップ位置を座標で指定する spec は検索して確認（WI-D0 と同時） |
| Visual Decision dependency | 大きさを変える場合は **V**（HDR-05 / 16） |
| Acceptance criteria | 844×390 でボタン同士・スティック・会話ボックス・ログと重ならない（実測）。中央領域の扱いが HDR-01 の決定どおり。タッチ操作が従来どおり（E2E + 手動 NOT_RUN は明記） |

### WI-D4 キャラクター状態パネル（左上）

| 項目 | 内容 |
| --- | --- |
| Scope | 左上パネルの情報の並び（名前・肖像・武器バッジ・HP / MP / スタミナ・階層）と 844×390 での占有 |
| Files | `src/styles/main.css`、`index.html`（並び替えが必要な場合のみ。AP-D03） |
| Allowed changes | 配置・並び。表示形式は現行（バー） |
| Forbidden changes | `#hud-name` の文言形式（E2E 完全一致 [F]）、`#hp-fill` / `#mp-fill` / `#sta-fill` の id、HP 等の表示形式（V） |
| Dependencies | WI-D2。HDR-03 / 04。**表示形式を変える場合は V の後** |
| E2E / unit impact | `#hud-name`（多数の spec が完全一致）、`#sta-fill` / `#mp-fill`（auto-combo）、`ui-foundation`（`.hud-topleft` / `.bar-*` の見た目） |
| Visual Decision dependency | **HP / MP / スタミナの形式は V**。D では位置・並びのみ |
| Acceptance criteria | 情報が HDR-03 の決定どおり。844×390 の占有が WI-D0 の計測値から縮小または HDR-01 の基準を満たす（実測）。E2E PASS |

### WI-D5 通知と戦闘フィードバック

| 項目 | 内容 |
| --- | --- |
| Scope | 中央トースト・左下ログ・ダメージ数値・拾得ポップの位置と二重表示の扱い（HDR-10 / 11） |
| Files | `src/styles/main.css`（`#msg-log` / `.item-pop` の位置）、`src/legacy/parts/11-combat-actions.js`（`layoutToasts()` の位置、`spawnToast()` の二重表示を変える場合のみ） |
| Allowed changes | 位置、ログの表示条件（HDR-10 の決定範囲） |
| Forbidden changes | `.item-pop` / `.msg-log-line` / `#msg-log` / `.dmg-pop` の class・id（E2E 約 15 spec が依存 [F]）、追加先（`#hud` 直下）、通知の文言、`spawnToast` の呼び出し元（192 箇所） |
| Dependencies | WI-D0。HDR-01 / 10 / 11 |
| E2E / unit impact | ログを非表示にすると `#msg-log .msg-log-line` を読む spec（air-actions / base-class-* / job-traits / chapter1-legacy-ui / mansion-scenario 等）が壊れる → **ログを残すか、spec の読み先を変える承認が要る** |
| Visual Decision dependency | なし（位置と表示条件）。見た目は V / H |
| Acceptance criteria | HDR-10 / 11 の決定どおり。844×390 でログがスティック・ボタンと重ならない（実測）。E2E PASS |

### WI-D6 戦闘中の条件表示（処刑・インタラクト・コンボ・制限時間・ボスバー）

| 項目 | 内容 |
| --- | --- |
| Scope | 下中央の縦列（インタラクト・処刑・コンボ）と上中央（ボスバー・制限時間）の位置 |
| Files | `src/styles/main.css` |
| Allowed changes | 位置のみ |
| Forbidden changes | 表示条件のロジック（`currentExecutionTarget()`・`updateInteractPrompt()` の判定）、`.show` class、id、文言、処刑の入力（R キー / タップ） |
| Dependencies | WI-D0、WI-D2。HDR-01 / 07 / 08 |
| E2E / unit impact | `#execute-prompt`（5 spec が `.show` を判定）、`#interact-btn`（2 spec が文言・表示）、`#scenario-timer`、`#boss-bar-wrap`。位置だけなら影響は小さい見込み [I] |
| Visual Decision dependency | なし（位置）。脈動・glow は V |
| Acceptance criteria | HDR-01 / 07 / 08 の決定どおり。インタラクトと処刑が同時に出ても重ならない（実測）。ボスバーと制限時間が重ならない（実測） |

## 6. Work Item の依存関係

```
WI-D0（実測・git 確認）
  ├─→ WI-D1（表示条件）        ← HDR-09/12/13
  └─→ WI-D2（ゾーン・safe-area・重なり） ← HDR-02/15、AP-D05
         ├─→ WI-D3（操作ボタン）   ← HDR-01/05/11/15（大きさは V）
         ├─→ WI-D4（状態パネル）   ← HDR-03/04（形式は V の後）
         ├─→ WI-D5（通知）         ← HDR-01/10/11
         └─→ WI-D6（条件表示）     ← HDR-01/07/08
UI-002-V ──→ WI-D4 の表示形式変更、WI-D3 の大きさ変更（D の範囲外）
```

- 並行可能: WI-D1 と WI-D2（触るファイルが分かれる。D1 は JS / core、D2 は CSS）。D3〜D6 は D2 の後なら互いに独立（CSS の別 selector）。

## 7. C1 との接続

| C1 の基盤 | D での使い方 | 制約 |
| --- | --- | --- |
| z-index token（`--ui-z-hud` 等） | 層の整理に参照 | 値は変えない |
| 色 token（`--ui-hp-*` 等、`--ui-surface-hud`） | 参照のみ | 値は変えない。キャラ配色（`CLASSES.trim` / `player-palette.js`）を HUD に使わない（P-12） |
| 文字サイズ token（`--ui-fs-hud-*`） | 参照のみ | 最小文字は V |
| `ui-icons.js` | D では使わない（表示を置き換えない） | 絵柄の変更は E |
| `ui-foundation.spec.js` | D の回帰確認に使う | 見た目の値を変えないため期待値は更新しない。変える必要が出たら Human 承認 |
| 新しい token（ゾーン寸法・余白・ボタンの大きさ） | 必要なら **Human Visual Decision Required** として V に回す | C1 の既存値を変えない |

## 8. 実測 NOT_RUN による残リスク

| # | リスク |
| --- | --- |
| NR-1 | 中央領域への侵入（§2 の [I]）が実画面と違う可能性。HDR-01 の判断材料が推測のまま |
| NR-2 | ボス戦・処刑・制限時間・コンボの実画面での重なりが未確認（UI-001 から UNCONFIRMED のまま） |
| NR-3 | 左下ログとスティックの重なりが推測のまま（WI-D5 の必要性が未確定） |
| NR-4 | baseline（`40644f3`）と作業ツリーの一致、`git status` が未確認。Analyzer report が remote に無く Artifact Handoff が未成立 |
| NR-5 | iPhone 実機の safe-area・親指の届く範囲はこの環境で確認できない（Undecided「実機 iPhone での最終調整」） |

## 9. Human Decision 候補（Approval Points）

| # | 論点 | 関連 WI |
| --- | --- | --- |
| AP-D01 | WI-D0 を実装前の必須条件にするか | 全体 |
| AP-D02 | 中央 60%×60% 方針の採否と対象（常時 UI のみ / 条件・一時表示も含む）（HDR-01） | D3 / D5 / D6 |
| AP-D03 | ゾーン容器などの DOM 追加を許すか（許す場合、`#hud` 直下構造と E2E への影響を受け入れるか） | D2 / D4 |
| AP-D04 | 1280×800 と 844×390 の配置差の範囲（同じ部品で位置だけ / 表示要素も変える）と判定基準（入力 / ビューポート）（HDR-15） | D2 / D3 |
| AP-D05 | 所持品チップの移動先（E-1） | D2 |
| AP-D06 | 常時表示する情報（HDR-03）、武器バッジ（HDR-13）、PC ヒント（HDR-09）、PC の押せないボタン（HDR-12） | D1 / D4 |
| AP-D07 | 操作ボタンの位置、大きさを D で変えてよいか（HDR-05 / 16） | D3 |
| AP-D08 | 必殺の表示場所（HDR-06） | D3 |
| AP-D09 | インタラクト・処刑・コンボの位置（HDR-07 / 08） | D6 |
| AP-D10 | 通知の二重表示・ログとスティックの共存（HDR-10 / 11）。ログを消す場合の E2E 変更の許可 | D5 |
| AP-D11 | Undecided（支援 AI HP・目的表示・3 人 HUD・影の旅人 HUD・パッド表記）で D が扱うもの（HDR-14） | 全体 |
| AP-D12 | 表示条件の集約表（E-4）を新規 core モジュールにするか | D1 |
| AP-D13 | 各 WI の Persistence（ブランチ・commit / push） | 全体 |

## 10. 実装前に最低限確認すべき事項

1. WI-D0 の実測（両サイズ × 対象画面）と `git status` / baseline 一致の確認
2. Analyzer report と本 Planner report の Persistence（Human）と Artifact Handoff の成立（AGENTS §5.2）
3. Task file への Work Item・Approval Point の反映（Human の指示後）
4. AP-D01〜D13 のうち、着手する WI に必要なものの決定
5. 各 WI の E2E 影響 spec の再確認（特にタップ座標を使う spec の有無）
6. CI の E2E が不安定なこと（UI-002-C1 PR #31）を前提に、回帰確認はローカル全件 + 変更前後比較を主とする

## 11. Scope Boundary

- D で行わない: 色・書体・形・アイコンの変更（V / C2 / E）、HP 等の表示形式の変更（V）、新しい token の値、ゲームロジック・入力処理・戦闘判定の変更、DOM id の変更、通知文言の変更、開発用 UI（UI-002-B）、酒場 UI（G）、通知の見た目（H）、Undecided の機能の実装（決定が無い限り）。
- UI-002-A の本編非表示（XP / Skill 3 / Lv / 鑑定 / 💎🔩）と UI-002-C1 の token 値は変えない。

## 12. 変更したファイル

- `.ai/reports/UI-002-D-plan.md`（新規）のみ。Task file・Decision record・コード・テストは変更していない。commit / push はしていない。

## 13. Planner Update（2026-09-30、main `790bde0` 基準）

- Role: Planner。本節で更新したのは Planner report・Task file（`.ai/tasks/UI-002-D.md`）・Decision record（`.ai/decisions/UI-002-human-decisions.md`）の記述だけ。コード・テスト・Analyzer report は変更していない。commit / push はしていない（HD-D19・AGENTS.md §5 / §6）。
- 決定の正本は Decision record の HD-D01〜HD-D29。以前の依頼文で使われた AP-D06-1 等の番号と、本 report §9 の AP-D01〜05（計画時点の問い）は正本ではない。番号・名称が食い違う場合は HD-D を優先する。

### 13.1 Baseline と統合状態

| 項目 | 値 |
| --- | --- |
| Baseline main | `790bde05283414234c6c53c951b72c6f29d52f91` |
| Analyzer の計測基準 | `40644f3`（Analyzer report §1 / §15.2.1）。以降の main の変更は E と C2 / V |
| E（Production Integration） | main 統合済み（merge `c9fe33c`、DONE `6c4a53e`）。承認済み glyph 4 つ（`weapon.greatsword` / `attack.greatsword` / `skill.warrior.retreat` / `skill.warrior.crushSlash`）。Ultimate・影の旅人・上位職は既存表示 |
| C2 / V | main 統合済み（merge `790bde0`、DONE `3e54909`）。V-1〜V-7、`tokens.css` の semantic token（`--ui-selected` / `--ui-danger` / `--ui-recovery` / `--ui-special` / `--ui-disabled` / `--ui-outline`）、`?dev=1&uiproto=1` の Prototype |
| Implementation branch | `claude/ui-002-d-impl`（HD-D20 / HD-D27。未作成。作成時は main `790bde0` を起点にする） |

### 13.2 今回の Human Decision の反映

- **HD-D28**: D は C2 / V の視覚方針（中世ファンタジー × トゥーン × マット × シンプル、matte、thick outline、graphic-first、Emoji を新しく追加しない、状態を色だけで表さない、semantic color と職業パレットの分離、semantic UI token）を参照し、再決定しない。HUD の具体的な位置・寸法・viewport ごとのレイアウト・safe-area・表示条件は D が決める。C2 / V は具体的な位置・寸法を決めていない（C2 AP-C2-05「最終的なサイズ感は Human が判断」、V の引き継ぎ条件「844×390 での最終配置問題は D の責務」）。C2 Prototype の DOM を本番へコピーすることを前提にしない。
- **HD-D29**: MP 廃止は D の対象外（別 Task として分離）。D では MP を非表示にする実装もしない。WI-D4 の「MP の表示削除」「MP が戦闘 HUD に出ない」は D から外れる。
- **WI-D0 DONE**: 既存の実測（Analyzer report §15.2）を正式な D0 成果物とする。再測定しない。E で変わった Weapon Badge / Attack glyph の中身と既存 HUD 構造との干渉は WI-D1 の実装前確認とする。

### 13.3 Work Item の状態（2026-09-30）

| WI | Status | 備考 |
| --- | --- | --- |
| WI-D0 | DONE | 上記 |
| WI-D1 | WAITING_APPROVAL（再承認待ち） | 2026-09-29 に APPROVED・Persistence 許可だったが、AC を E 統合後の仕様に更新したため承認範囲が変わる（AGENTS.md §6）。旧 Approval record は Task に履歴として残す |
| WI-D2〜D6 | WAITING_APPROVAL | 未承認 |

### 13.4 E との整合（D の全 WI に共通の制約）

- Weapon Badge / Attack / Skill1 / Skill2 の表示は E の既存経路を使う: `updateWeaponBadge()`（`14-hud-boot.js:399`）、`updateAttackGlyph()`（`:410`）、`updateSkillButtonIcon()`（`12-progression-ui.js:2473`）、Skill2 は `recomputeStats` / `grantChapter1Skill2` 内の `setGlyphOrText` 呼び出し（`12-progression-ui.js:1842, 2329`）。
- D は `#weapon-badge` / `#btn-attack-glyph` / `#btn-charge-icon` / `#btn-skill2-icon` に `textContent` / `innerHTML` を直接書かない。要素を移すときは要素ごと移動し、id・親子関係・`data-glyph` を消さない。
- `src/core/ui-icons.js`（`UI_GLYPHS` / `resolveSwordsmanGlyphIds`）と `setGlyphOrText` は変更しない。新しい semantic glyph（Ultimate・影の旅人・上位職・Heal を含む）を追加しない。上位職は `state.classDef.key === 'warrior'` だけで剣士の glyph を出さない現行仕様のまま。
- 影響を受ける既存テスト（追加分）: `tests/ui-production-glyphs.spec.js`（`#weapon-badge svg` 18×18px・`data-glyph`・「攻撃」・影の旅人 / 戦騎士 / Ultimate の fallback）、`tests/unit/ui-glyphs.test.js`、`tests/ui-proto-gate.spec.js`（C2。通常 URL で Prototype の DOM が無いこと）。D の変更でこれらを変える必要が出た場合は、仕様変更として HD-D26 の範囲で理由を記録する。

### 13.5 WI-D1 の更新（Task の「WI-D1 計画更新」が正本）

- D1 は glyph を実装する作業ではなく、E の glyph を壊さずに表示条件と初期同期を正しくする作業。
- 旧 AC「武器バッジの文字が現在の武器（剣士 🗡️）」を、E 統合後の 10 項目の AC に置き換えた（初期表示で「M」を出さない / 表示内容が `weaponDefFor`・主人公・上位職の状態と一致 / 剣士本人 + 大剣は E 経由の `weapon.greatsword` / 影の旅人・上位職・持ち替え武器・他職業に剣士の glyph を適用しない / `title` = `weaponDefFor(...).name` / 主人公交代後に前の状態を引きずらない / glyph 子要素・`data-glyph`・SVG を壊さない / Attack・Skill の icon DOM を直接書き換えない / E の glyph 仕様を変えない / 新規 FAIL なし・既存分類の維持）。
- 実装の方向（案）: 初期表示と主人公交代の時点で既存の `updateWeaponBadge()`（必要なら `updateAttackGlyph()`）を呼ぶ。`index.html:86` の初期文字 `M` は、HUD 表示時点で上書きされるなら変更不要か、空にするかを実装時に判断し、Task の AC で確認する。
- その他の D1 Scope（表示条件の純粋関数化、Chapter 1 の表示条件、PC 操作ヒント 5 秒・セッション内保持、スタミナ HD-D25、ミニマップ現行条件 HD-D21、PC タッチボタンは条件のみ HD-D22、E2E HD-D26、Test Report HD-D27）は維持。

### 13.6 WI-D2〜D6 の更新

| WI | 位置・構造（D） | 見た目（C2 / V） | glyph（E） | 更新点 |
| --- | --- | --- | --- | --- |
| D2 Layout Foundation | ゾーン DOM・viewport ベースの responsive（body 属性なし）・safe-area・1280×800 / 844×390・PC / touch | token と V-1〜V-7 を参照 | 4 要素を移す場合は要素ごと | 所持品チップ除去後の HUD、回復のクイック使用は Action Zone、ミニマップは現行条件を維持（「必要」の意味を D で定義しない） |
| D3 Action Zone | Attack / Skill1 / Skill2 / Ultimate / Heal の位置・構造。Ultimate のチャージ情報は Action Zone 内だけ | ボタンの見た目・Ultimate Ready（常時発光ではなく状態差＋一回の反応）は V | Attack / Skill は E の glyph。Ultimate・Heal は既存表示（新しい glyph を作らない） | PC ではタッチ用 Attack / Skill / Ultimate を常時表示しない（ゲームアクションは維持、ヒントは別扱い） |
| D4 Character Status | 名前・肖像・HP は常時、スタミナは必要時（HD-D25）、所持品チップは除去 | Character Status の見本を参照 | Weapon Badge は E の経路 | **MP は D で扱わない（HD-D29）**。非表示にもしない |
| D5 Notifications | トーストとログの重複をなくし、役割ごとに統合（ログを単純に削除しない） | 代表通知の見本・semantic な視覚言語 | なし | 既存の通知の意味を維持 |
| D6 Combat Events | 処刑・インタラクト・コンボ・制限時間・ボスバーの分離 | 見た目は V | なし | 常時 UI は中央 60%×60% を避け、一時・条件付き表示は中央可（HD-D02）。既存の Human Decision（5 秒等）を維持 |

### 13.7 MP（別 Task）

- 別 Task として分離する（Task 名は未確定。Human が決める）。
- 根拠（Analyzer 相当の確認、main `790bde0`）: `state.mp` / `maxMp`（`recomputeStats`）、スキルのコスト `resCost` / `hasRes` / `spendRes`（`11-combat-actions.js:1560-1565`）、必殺技の照準中の毎秒消費（`:1639-1659`）、自然回復（`13-update-loop.js:527` ほか）、魔力の薬 `mppotion`（ドロップ・使用、`08-loot-equipment.js:496-503`）、ショップ（`12-progression-ui.js:3399-3400`）、save の `inventory.mppotion`（`09-save-load.js:240`）、表示（`#mp-fill` / `#mp-label`）、テスト（`auto-combo.spec.js` の `#mp-fill`、save データに `mppotion` を持つ spec 十数本）。
- D は MP のゲームロジック・state・save・表示を変えない。ゲームシステムを壊す暫定実装を作らない。

### 13.8 テスト結果の分類（変更しない）

- 既存 FAIL: mansion-escort、execution-break。FLAKY: job-traits。standard Playwright（`npm test`）は Chromium revision mismatch により NOT_RUN（PASS 扱いにしない）。
- D0 の NOT_RUN / UNCONFIRMED（Analyzer report §15.2.9）は維持する。
- 本 Planner Update ではテストを実行していない（計画の更新のみ）。

### 13.9 Traceability

| 項目 | 記録先 |
| --- | --- |
| HD-D01〜HD-D29 | `.ai/decisions/UI-002-human-decisions.md`（正本）、`.ai/tasks/UI-002-D.md` の Human Decisions 表 |
| WI-D0 DONE | Task「WI-D0 完了」・Status History |
| WI-D1 の AC 更新・再承認待ち | Task「WI-D1 計画更新」・Status History |
| WI-D2〜D6 の更新注記 | Task の各 WI の「2026-09-30 更新」 |
| E / C2 / V の統合状態 | 本節 13.1（main の commit） |

### 13.10 Artifact Handoff / Persistence（未成立）

- D の Analyzer report・Planner report・Task・Decision record の追記は、いずれも remote に無い。AGENTS.md §5.2 の Artifact Handoff は未成立。
- HD-D19 により、Analyzer / Planner の成果物の commit / push は Human が行う。§5.2 の Kind `analysis` は Analyzer report だけの commit、Kind `plan` は Human が承認を記入した Task file の承認済み版を対象にする。
- 注意: working tree の `.ai/tasks/UI-002-C2.md` / `.ai/tasks/UI-002-V.md` の未 commit 版は、main の DONE 版より古い DRAFT 版で、main に無い内容を持たない。Persistence の対象にすると main の DONE 記録を戻してしまう。

### 13.11 次に Human が承認・決定する項目

1. 本 Planner Update（HD-D28 / HD-D29 の反映・WI-D0 DONE・WI-D1 の AC 更新・WI-D2〜D6 の更新注記）の確認
2. WI-D1 の再承認（更新後の AC・Files To Change・Persistence `claude/ui-002-d-impl` の確認）
3. D の成果物の Persistence（branch、対象ファイル、順序）と Artifact Handoff
4. WI-D2〜D6 の個別 Approval（各 WI の Files To Change・Persistence を含む）
5. MP 廃止の別 Task の起票（Task 名を含む）
6. V-1〜V-7 の Decision record への転記の時期（V の Task では D の Persistence 後）
