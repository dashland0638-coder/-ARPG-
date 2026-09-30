# UI-002-C2 Plan

- Role: Planner（READ ONLY。書いたのは本ファイルのみ。コード・HTML・CSS・JS・テスト・Task file・Decision record は変更していない）
- Task: `.ai/tasks/UI-002-C2.md`（Status: DRAFT。Combat HUD Visual Prototype に再定義済み）
- Date: 2026-09-29
- Session: UI-001 以降と同一の Claude Code セッション（独立性なし）
- 本計画は **提案**。Human Approval があるまで実装しない。色・寸法の最終値は決めない（H-7）。

## 0. 入力

| 入力 | 値 |
| --- | --- |
| Analyzer report（Artifact Handoff） | `.ai/reports/UI-002-C2-analysis.md`、Source Branch `claude/ui-002-v-c2-analysis`、Source SHA `208e4beaa24eb78e405bf443fc87a67a65e7690b`、Blob SHA `5cc53c2b292005557b7edb8cb683b8d3ced4ead5`、Persisted by Human |
| Handoff 検証（Planner、2026-09-29） | H-1 到達可能 / H-2 Path 存在 / H-3 変更 1 件 / H-4 期待 Path 一致 / H-5 見出し `# UI-002-C2 Analysis` 一致 / H-6 Blob 一致 / H-7 同キーの既存記録なし（旧 `UI-002-V-C2-analysis.md` は別 Path・削除済み） / H-8 Source SHA の内容を読んだ — すべて PASS |
| Human Decision | V-1〜V-7（`.ai/tasks/UI-002-V.md`）、C2 再定義と H-1〜H-9（`.ai/tasks/UI-002-C2.md`）。いずれも `claude/ui-002-v-c2-analysis` @ `65016a1` |
| 追加で確認した FACT | 下記 §1 |

## 1. 計画の前提として追加で確認した FACT

| 事項 | 内容 | 根拠 |
| --- | --- | --- |
| 開発用 UI ゲート | `devUiEnabled(search)`（`?dev=1` 完全一致、保存しない）。legacy 側は共有スコープ定数 `DEV_UI` | `src/core/dev-ui.js`、`01-character-creation.js:130` |
| 読める state | HP `state.hp` / `state.maxHp`、必殺 `state.ultGauge` / `ULT_GAUGE_MAX`（100）、Skill 1 CD `state.skillCD`（満了 1.6 秒）、Skill 2 CD `state.skill2CD` と `hasSkill2(state)`、回復の所持数 `state.inventory.potion`、武器 `weaponDefFor(classKey, usingAltWeapon)`、名前 `hudLabel()` 系 | `14-hud-boot.js:362-372, 720-745`、`12-progression-ui.js:2057, 1848-1854`、`11-combat-actions.js:128-131` |
| 現行の色（`:root`） | `--bg #0c0a10` / `--panel #15111c` / `--panel-line #3a2f4a` / `--ember #c9793f` / `--ember-bright #f0a05c` / `--hp #a4293d` / `--mp #2d6f8e` / `--gold #c9a24b` / `--text #e9e1d6` / `--text-dim #a99fb0`、スタミナ `#c9d94b` | `main.css:6-15`、`tokens.css:37-38` |
| tokens.css の決まり | 既存 10 変数は変えない。3D キャラクター配色を入れない（職業名を含む token を作らない）。**開発用 UI の CSS は token を参照しない（AP-C1-08）** | `tokens.css:1-22`、`.ai/tasks/UI-002-C1.md:29` |
| パーツの連結順 | `src/legacy/parts/*.js` はファイル名順に連結（最後は `14-training-ground.js`） | `ls src/legacy/parts`、`concat-plugin.js` |
| キー入力 | `window` の `keydown`（`09-save-load.js:309-335`、`` ` `` でデバッグモード） | 同左 |
| セーブ | `localStorage`（`SAVE_KEY`）へ `saveGame()` が書く | `09-save-load.js:93-107` |
| 開発用 UI の E2E | `tests/dev-ui-gate.spec.js`（通常 URL で到達不可 / `?dev=1` で可 / 保存されない） | 同左 |

## 2. V-1〜V-7 との対応

| Decision | C2 Prototype での表し方 | 確認方法 |
| --- | --- | --- |
| V-1 コンセプト | 部品の土台を「トゥーン・プレート」（厚い輪郭の平らな板）＋革・木を想起させる縁取り（内側の細い accent 線）＋必殺だけ魔導紋章の縁 | 撮影を Human が見る |
| V-2 マテリアル | 単色〜ごく弱い 2 色の面、厚い外輪郭、小さな内側 accent、弱い落ち影 1 種。blur・半透明パネル・光沢・常時 glow・neon を使わない | CSS に `backdrop-filter` / `filter: blur` / 常時 `animation` が無いことを unit か grep で確認 |
| V-3 形状 | 角の少し丸い板・円・盾形などの単純形状。アイコン内部の線は最小 | 16〜24px の縮小撮影 |
| V-4 文字依存を減らす | 操作ボタンに文字を置かない（アイコンのみ）。名前・HP 数値・所持数など既存仕様の文字は小さく補助として残す | 文字を消した撮影（下 §9）でも意味が分かるか |
| V-5 ゲーム固有アイコン | インライン SVG（H-5）。Emoji / Unicode を使わない | unit で SVG 文字列に emoji・非 ASCII 記号が無いことを確認 |
| V-6 状態 | normal / pressed / disabled / cooldown / Ultimate ready を形・塗り・進捗・overlay で区別。色だけにしない。ready は切り替わった瞬間だけ短い 1 回の反応、常時 glow・点滅なし | 状態の一覧を撮影。グレースケール撮影でも区別できるか |
| V-7 意味色 | 意味色 token（Selected / Danger / Recovery / Special / Disabled 等）を使い、職業色は icon の accent に限る。キャラクターパレットは変えない | token 一覧・撮影 |

## 3. Work Items

| ID | Summary | 依存 |
| --- | --- | --- |
| WI-C2-1 | Prototype の表示ゲートとオーバーレイの枠（`?dev=1` 限定、入力に接続しない、state を読むだけ） | — |
| WI-C2-2 | Prototype 用 token（意味色・寸法）の追加。**値は Human が決める**（H-7） | — |
| WI-C2-3 | 代表アイコン（インライン SVG）: Attack・Ultimate・Heal（＋同じ形を使う Weapon Badge） | WI-C2-2 |
| WI-C2-4 | 部品と状態の見本: Character Status / HP / Weapon Badge / Attack / Skill 1 / Skill 2 / Ultimate / Heal / 代表通知 | WI-C2-1〜3 |
| WI-C2-5 | テストと Visual 確認（unit・E2E・撮影） | WI-C2-1〜4 |

### WI-C2-1 表示ゲートとオーバーレイの枠（P-3）

- **Scope**:
  - 判定の純粋関数を `src/core/dev-ui.js` に追加（例 `uiProtoEnabled(search)`: `?dev=1` かつ Prototype 用クエリがある時だけ true。保存しない）
  - 新しい legacy part（例 `src/legacy/parts/15-ui-proto.js`。連結順で最後）に、オーバーレイの DOM を JS で生成して `document.body` に追加する処理を置く（`index.html` は変更しない）
  - オーバーレイは既存 HUD の上に重ねる「見本シート」。既存 HUD はそのまま見える（従来 UI との比較）
  - 更新は Prototype 専用の `requestAnimationFrame`（開いている間だけ）で既存 state を**読むだけ**。`animate()`・`updateHUD()` 等の既存関数には手を入れない
  - 開閉は閉じるボタン 1 つ（オーバーレイ自身の表示だけを切り替える）
- **Files（案）**: `src/core/dev-ui.js`、`src/legacy/concat-plugin.js`（HEADER の import に関数名を 1 つ追加）、`src/legacy/parts/15-ui-proto.js`（新規）
- **Allowed**: 新規ファイル、`dev-ui.js` への関数追加、HEADER の import への追記
- **Forbidden**: 既存 HUD の DOM・id・class・CSS の変更、`index.html`、`basefile.html`、ES module 化、入力の結び付け（`bindHoldButton`・`keydown` への追加）、state への書き込み、`localStorage` の読み書き、`state.testMode` への依存
- **Acceptance**: 通常 URL・`?dev=1` のみ・Prototype 用クエリのみでは生成されない。`?dev=1` + Prototype 用クエリで本編 Chapter 1 の画面上に表示される。表示中もゲーム操作・セーブが従来どおり。オーバーレイのボタン（閉じる以外）を押しても state が変わらない

### WI-C2-2 Prototype 用 token（H-7）

- **現状**: V-7 の意味色のうち tokens.css にあるのは Background / Surface / Border / Text / Muted 相当（`--ui-surface-*` / `--ui-line` / `--ui-text` / `--ui-text-muted`）。Selected / Danger / Recovery / Special / Disabled は無い（Analyzer §1.1）。
- **Planner の提案（値は候補。Human が選ぶ）**:

| 意味 | 候補 A（既存色を再利用） | 候補 B（新しい値） |
| --- | --- | --- |
| Selected | `--ember` / `--ember-bright` | Human が指定 |
| Danger | `--hp` #a4293d | Human が指定 |
| Recovery | スタミナ緑 #c9d94b（既存値） | 新しい緑（Human が指定） |
| Special | `--gold` #c9a24b | Human が指定 |
| Disabled | `--text-dim` #a99fb0 を面の暗色と組み合わせる | Human が指定 |
| 厚い輪郭の色 | `--bg` 系の暗色 | Human が指定 |

  - 寸法（輪郭の太さ・角丸・部品の大きさ）: 候補として現行 HUD の実寸（D0 実測: 攻撃 82px、必殺 52px、Skill 44 / 42px、肖像 44px、武器バッジ 18px）を基準にした Prototype 用の値を提示する。**最終配置・最終寸法ではない**（D が決める）
- **置き場所**: 案 1 `tokens.css` に「V / C2 追加」節として追加（参照は Prototype のみ）/ 案 2 Prototype 専用 CSS 内の `--uip-*` に閉じる。tokens.css の「新しい値を入れない」決まり（C1）を変えることになるため Human の判断（AP-C2-03）
- **AP-C1-08 との関係**: 「開発用 UI の CSS は token を参照しない」。C2 Prototype は開発用ツールではなく**本番 UI の見本**なので、token を参照する例外として扱う提案（AP-C2-04）
- **Files（案）**: `src/styles/tokens.css`（案 1 の場合）、`src/styles/ui-proto.css`（新規）、`src/styles/main.css`（`@import './ui-proto.css';` 1 行）
- **Forbidden**: 既存 token の値・名前の変更、既存 selector の変更、職業名を含む token

### WI-C2-3 代表アイコン（インライン SVG、H-5）

- **対象（代表 3 種＋派生 1）**:

| アイコン | 形 | 意図 |
| --- | --- | --- |
| Attack | 大剣のシルエット＋短い斬撃の弧 | 基本操作。最も単純で大きな形 |
| Ultimate | 魔導紋章（外周の輪＋中央の星形 / 剣の交差）のエンブレム | 通常 Skill と形そのものが違う |
| Heal | 薬瓶＋十字（回復記号） | 所持数は小さい数字で添える |
| Weapon Badge（派生） | Attack と同じ大剣シルエット（弧なし）を小型化 | V-5「同じ意味には同じ視覚言語」。剣士 = 大剣（docs/CHARACTERS.md:29） |

- Skill 1 / Skill 2 のアイコン: 代表アイコンの範囲外。**案 A** 単純な図形の仮アイコン（例: Skill 1 = 下向きの斬り、Skill 2 = 渦）を同じ規則で描く / **案 B** 番号入りのプレートにする（V-4 と合わない）。Human の判断（AP-C2-06）
- **形式**: 純粋データの core module（例 `src/core/ui-proto-icons.js`: 名前 → SVG 文字列、`viewBox="0 0 24 24"`、`fill="currentColor"` 主体、輪郭は `stroke` 1 種）。C2 Prototype 限定。E で正式方式を再検討する（H-5）
- **規則**: 24×24 のグリッド、輪郭の太さを全アイコンで統一、内部の線は 1〜2 本まで、16px で潰れる細部を入れない
- **Forbidden**: Emoji・Unicode 記号、外部アイコンセット、`ui-icons.js` の変更（E の範囲）、本番 HUD のアイコン差し替え

### WI-C2-4 部品と状態の見本

オーバーレイ（見本シート）に、次の区画を並べる。区画の並びは見本シート内の仮配置で、**HUD の配置案ではない**（D を先取りしない）。

| 区画 | 内容 | state |
| --- | --- | --- |
| A. Character Status | 肖像枠＋名前（小さく）＋HP バー＋HP 数値（小さく）＋Weapon Badge。MP は表示しない | **Live**: `state.hp` / `maxHp`、武器、名前を読む |
| B. Action（Live） | Attack / Skill 1 / Skill 2 / Ultimate / Heal を 1 組。Skill の cooldown 進捗、必殺のゲージと ready、回復の所持数、Skill 2 未習得は disabled 表示 | **Live**: `skillCD`・`skill2CD`・`hasSkill2`・`ultGauge`・`inventory.potion` を読む |
| C. 状態の一覧（Static） | 各ボタン × normal / pressed / disabled / cooldown（例 40%）/ ready（必殺）を固定値で並べる | 固定（state を読まない） |
| D. アイコンの縮小 | 3 アイコン × 16 / 20 / 24 / 48px | 固定 |
| E. 代表通知 1 種 | 例「体勢を崩した」を アイコン＋短い形で 1 つ表示（トースト / ログの二重表示にしない） | 固定（見本） |

- **状態の表し方（案）**:
  - pressed: 板が沈む（落ち影を消し 1〜2px 下げる）＋輪郭の内側が明るくなる
  - disabled: 面を暗い Disabled 色に、アイコンを輪郭だけ（塗りなし）に、斜線の overlay（色に頼らない）
  - cooldown: 残り時間ぶんの扇形 overlay（上から減る）＋アイコンを暗く
  - Ultimate ready: 紋章の外周が埋まり、Special 色の太い縁になる。**ready になった瞬間だけ** 1 回の短い反応（例 0.4 秒の拡大縮小）。常時 glow・点滅なし
- **代表通知の種類**: 候補「体勢を崩した」「撃破」「回復」から 1 つ（AP-C2-07）
- **Forbidden**: 既存 HUD の非表示・移動、MP の表示、Skill 3・Lv / XP・所持品チップ、実際の回復・攻撃の発動

### WI-C2-5 テストと Visual 確認

- **unit（新規）**:
  - ゲート関数: 通常 / `?dev=1` のみ / Prototype クエリのみ / 両方 / 値違い（`dev=true` 等）
  - アイコン module: 全アイコンが `<svg` で始まり `viewBox="0 0 24 24"` を持つ / Emoji・非 ASCII 記号を含まない / 名前一覧が固定
  - （状態の判定を純粋関数にする場合）state 値 → 表示状態（cooldown 率・ready・disabled）
- **E2E（新規 spec、例 `tests/ui-proto-gate.spec.js`）**:
  - 通常 URL + Prototype クエリ: オーバーレイが無い
  - `?dev=1` のみ: 無い
  - `?dev=1` + Prototype クエリ: 本編でオーバーレイが出る、既存 HUD（`#hud`・`#btn-attack` 等）はそのまま
  - 表示中に Prototype のボタンをクリックしても、HP・必殺ゲージ・所持数・`#msg-log` が変わらない（入力に接続していない）
  - `localStorage` のキー一覧が Prototype の有無で変わらない
- **既存テスト**: 変更しない。回帰確認は Targeted（`dev-ui-gate` / `ui-foundation` / `chapter1-legacy-ui` / `save-load` / 新規 spec）＋ build ＋ unit 全件。Full Regression を行うかは Human の判断（AP-C2-09）。既存 FAIL（mansion-escort、execution-break）・FLAKY（job-traits）の分類は変えない
- **Visual 確認（撮影）**:
  - `/?dev=1&<Prototype クエリ>` の本編 Chapter 1（H-4）で、1280×800（非タッチ）と 844×390（タッチ）
  - 撮るもの: (1) オーバーレイ全体（既存 HUD と同じ画面） (2) 状態一覧の拡大 (3) アイコン縮小の拡大 (4) グレースケール版（色に頼っていないかの確認） (5) 文字を隠した版（V-4 の確認。撮影スクリプトで文字の要素だけ透明にする）
  - 撮影スクリプトはリポジトリ外（D0 と同じ方式）
  - 自己チェック 3 点を report に書く: 文字を読まずに何のボタンか分かるか / 16〜24px で判別できるか / 既存 UI との差が一目で分かるか。**判定は Human が撮影を見て行う**（AI の自己チェックは参考）

## 4. C2 と E の境界

| | C2（本計画） | E |
| --- | --- | --- |
| アイコン | Attack / Ultimate / Heal（＋Weapon Badge 派生、Skill の仮アイコンは AP-C2-06 次第） | アイコンセット全体の体系化 |
| 形式 | インライン SVG（C2 Prototype 限定） | 正式方式を再検討（H-5） |
| 適用先 | `?dev=1` の見本オーバーレイのみ | 全主要 UI・各画面 |
| `ui-icons.js` | 変更しない | icon mapping の本実装 |
| emoji 置換 | しない | Unicode / Emoji からの本格置換 |

## 5. D との非干渉

- D の Task file・Decision・未 commit 変更に触れない。
- 既存 HUD の DOM / CSS / 更新関数（`updateHUD` / `updateCooldownRings` / `finishEnteringGame` / `refreshTouchControls`）を変更しない → D1 の実装対象ファイルと重ならない。
- 例外として `src/legacy/concat-plugin.js` の HEADER（import 行）は D1 も追記する予定。行の追加どうしなので衝突は小さいが、同時進行時は merge で解消する（RISK）。
- 見本シート内の並びは HUD の配置案ではない（D2〜D6 の入力にしない）。

## 6. production / save / gameplay への非干渉

| 条件 | 方法 | 確認 |
| --- | --- | --- |
| production に出さない | `DEV_UI`（`?dev=1`）かつ Prototype クエリの時だけ DOM を生成 | E2E |
| save に影響しない | `localStorage` に触れない。state に書かない | E2E（キー一覧）・コード |
| gameplay に影響しない | 入力に接続しない。閉じるボタン以外は `pointer-events:none`。既存関数に手を入れない | E2E（クリックしても値が変わらない） |
| テストモードと混同しない | `state.testMode` に依存しない。本編で確認（H-4） | コード・撮影 |
| コードは本番ビルドに含まれる | D-1（開発コードの除去は採用しない）と同じ扱い | — |

## 7. Acceptance Criteria（C2 全体）

1. 通常 URL と、Prototype クエリの無い `?dev=1` では、Prototype の DOM が存在しない（E2E）。
2. `?dev=1` + Prototype クエリで、本編 Chapter 1 の画面上に見本オーバーレイが出て、既存 HUD も同時に見える（撮影）。
3. 区画 A〜E が表示される。A・B は既存 state の値に追従する（読むだけ）。MP・Skill 3・Lv / XP・所持品チップは出ない。
4. 5 つの状態が形・塗り・進捗・overlay で区別でき、グレースケールでも区別できる（撮影）。常時 glow・点滅が無い（CSS）。
5. アイコンは インライン SVG で、Emoji / Unicode を使わない（unit）。16〜24px の撮影がある。
6. Prototype を開いても、操作・HP・ゲージ・所持数・セーブが変わらない（E2E）。
7. 既存の見た目・DOM・id・class・既存 token の値が変わっていない（`ui-foundation` 等の既存 spec が PASS）。
8. build / unit 全件 PASS。Targeted E2E の結果を Test Report に記録（FAIL / FLAKY / NOT_RUN は区別して記録）。
9. D / E の Task・Decision・未 commit 変更に触れていない。

## 8. Out of Scope

- D1〜D6 のレイアウト・最終配置・最終寸法、中央 60% 侵入・重なり・safe-area の解消
- 本番 HUD の見た目変更・アイコン置換（E）
- MP の表示・廃止、Skill 3・Level / XP・所持品チップの復活
- 攻撃モーション・武器形状・キャラクターモデル・VFX・combat logic・damage / balance
- menu / tavern / save / シナリオ画面、新しいゲームシステム
- 全職業分のアイコン（剣士以外の武器バッジ・技アイコン）
- V の DONE 判定（Human が撮影を見て行う — H-1）

## 9. 実装の順序

WI-C2-2（token の値の決定）→ WI-C2-1 → WI-C2-3 → WI-C2-4 → WI-C2-5。WI-C2-1 と WI-C2-3 は並行可能。

## 10. リスク

| # | リスク | 対策 |
| --- | --- | --- |
| R-1 | 見本シートの並びが HUD の配置案と受け取られる | オーバーレイに「Prototype 見本（配置は未定）」の小さな表示を入れる / report に明記 |
| R-2 | 色・寸法の値を AI が決めてしまう | WI-C2-2 は Human が値を決めてから実装（AP-C2-02） |
| R-3 | オーバーレイが既存 E2E の可視判定・クリックに影響 | Prototype クエリがある時だけ生成。既存 spec はクエリを付けない |
| R-4 | concat HEADER の import 行で D1 と衝突 | 行の追加のみ。merge 時に解消 |
| R-5 | 見本の出来で V の方向性が判断されるため、手戻りが大きい | V の判断を Human が撮影で行い、差し戻しは C2 の再実装として扱う |
| R-6 | AP-C1-08（開発用 UI は token を参照しない）との不整合 | AP-C2-04 で例外として承認を得る |

## 11. Human Approval が必要な事項（AP）

| # | 判断事項 | 候補 |
| --- | --- | --- |
| AP-C2-01 | Work Item 構成（WI-C2-1〜5）の承認 | 本計画どおり / 修正 |
| AP-C2-02 | 意味色の値（Selected / Danger / Recovery / Special / Disabled / 輪郭色） | 候補 A（既存色の再利用）/ 候補 B（Human が値を指定）/ 混在 |
| AP-C2-03 | Prototype 用 token の置き場所 | 案 1 `tokens.css` に追加 / 案 2 Prototype 専用 CSS 内に閉じる |
| AP-C2-04 | AP-C1-08 の例外（Prototype は token を参照する） | 例外として承認 / 承認しない（Prototype 専用の値で書く） |
| AP-C2-05 | Prototype の寸法の基準 | 現行 HUD の実寸を基準にした仮の値 / Human が指定 |
| AP-C2-06 | Skill 1 / Skill 2 のアイコン | 案 A 単純図形の仮アイコン（同じ規則）/ 案 B 番号プレート |
| AP-C2-07 | 代表通知の種類 | 体勢を崩した / 撃破 / 回復 |
| AP-C2-08 | Prototype を開く方法 | 例 `?dev=1&uiproto=1` で自動表示（iPhone でも URL だけで開ける）/ `?dev=1` 時の開発用ボタン |
| AP-C2-09 | テスト範囲 | Targeted（§WI-C2-5）/ Full Regression |
| AP-C2-10 | Files To Change の確定 | `src/core/dev-ui.js`、`src/core/ui-proto-icons.js`（新規）、`src/legacy/concat-plugin.js`、`src/legacy/parts/15-ui-proto.js`（新規）、`src/styles/ui-proto.css`（新規）、`src/styles/main.css`（import 1 行）、`src/styles/tokens.css`（AP-C2-03 案 1 の場合）、`tests/unit/`（新規 2〜3）、`tests/ui-proto-gate.spec.js`（新規） |
| AP-C2-11 | Persistence | ブランチ `claude/ui-002-c2-impl`（H-9）。Implementer → build / unit / E2E → commit → push → Reviewer → Human 確認 → merge |
| AP-C2-12 | V の DONE の判定方法 | 撮影（§WI-C2-5）を Human が確認して V を DONE にする（H-1） |

## 12. 変更したファイル

- `.ai/reports/UI-002-C2-plan.md`（新規、本ファイル）のみ。commit / push はしていない。
