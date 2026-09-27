# UI-002-C1 Planner Report

- Role: Planner（READ ONLY。変更するのは本ファイルと Task file のみ。source / CSS / tests / Decision record は変更しない）
- Task: `.ai/tasks/UI-002-C1.md`
- Date: 2026-09-27
- Session: UI-001 以降と同一の Claude Code セッション（独立性なし）
- 本計画は **提案** であり、Human Approval があるまで実装しない。Approval Point（§16）は Human が決める事項で、AI は決めていない。

表記: **FACT**（コード・Analyzer で確認済み）/ **PROPOSAL**（Planner の提案）/ **V**（UI-002-V の Human Visual Decision で決める）/ **C2+**（C2 以降の各画面 Task で決める）

---

## 1. Baseline

| 項目 | 値 |
| --- | --- |
| baseline main | `63235ce34edcd1c42787f114d0e4ac43f300ad10` |
| Branch | `claude/ui-002-c1-planner`（`claude/ui-002-c1-analysis` @ `e8724a5` から作成） |
| 対象 | `index.html` / `src/styles/main.css` / `src/legacy/parts/*.js` / `src/core/*.js` / `src/legacy/concat-plugin.js` |

## 2. Analyzer Reference

| 項目 | 値 |
| --- | --- |
| Analyzer report | `.ai/reports/UI-002-C1-analysis.md` |
| Analyzer commit | `e8724a52221c4f0f0ade50624dfcea03c0ff9c7c`（`claude/ui-002-c1-analysis`） |
| report blob | `13b6d2e4132fcf41503cd9f008a20f96e79545c8` |
| 関連 Human Decision | HD-4（1280×800 / 844×390）、HD-5（C1 → V → 本格 visual。V の判断対象: トゥーン感 / マット感 / 中世ファンタジー感 / 書体 / アイコン表現 / パネル / ボタン / 枠線 / 色 / 情報密度） |
| 参照（Human Decision ではない） | UI-002 Planner report（`eadb5e3`）§8（token 階層）、§11（色の 3 分類）、§12（Panel / Button variants）、§14（段階的移行の層） |

本計画が前提とする Analyzer の FACT（番号は Analyzer §13）: F-02（token は色 10 個のみ）、F-10（PC / タッチ切替は入力判定）、F-11（button の既定書体）、F-12 / F-13（10px 未満の表示）、F-14（3D 配色は UI から非参照）、F-18〜F-20（JS / Canvas の直書き値）、F-21（開発 UI は独自色）、F-23（3D 上の要素はピクセル比較が不安定）、F-24 / F-25（E2E の class 依存）。

---

## 3. Design Token Strategy

### 3.1 原則（PROPOSAL）

1. **C1 の token はすべて現行値の別名**。新しい値を持ち込まない（Task の Planner requirements）。値の変更は V 以降。
2. token は「値の置き場所」を 1 か所にする作業で、見た目の判断を含まない。
3. 同じ値でも意味が違う箇所（Analyzer §4.2）は、C1 では **primitive（値の名前）までにとどめ、意味名（semantic）は 1 対 1 に対応しているものだけ** 付ける。意味の整理（例: ember を「押せる」専用にするか）は V の判断。
4. 既存の `:root` 10 変数（`--bg` 〜 `--text-dim`）の名前は残す（main.css の 259 箇所・`index.html` inline が参照）。

### 3.2 階層（PROPOSAL、命名は AP-C1-02）

```
primitive   現行の生の値。名前は値の系統を表す      例: --ui-p-ember-500（= #c9793f）
semantic    意味が 1 対 1 のものだけ                例: --ui-text, --ui-text-muted, --ui-hp, --ui-mp
component   部品固有（C1 では Panel のみ）          例: --ui-panel-bg, --ui-panel-border
```

- 既存の `--ember` 等は primitive / semantic の別名として維持（`--ember: var(--ui-p-ember-500)` のような置換は行わない。二重定義で値がずれる事故を避けるため、**既存 10 変数の値そのものは変更しない**）。

### 3.3 分類（PROPOSAL）

| 種類 | C1 で token 化する（現行値のまま） | 個別 UI に残す | V で Human 判断 |
| --- | --- | --- | --- |
| background / surface | 背景 `#0c0a10`、パネル面（`--panel` → `#100d16` のグラデ 2 値）、HUD 面 `rgba(12,10,16,.55)` | タイトル / テストモードの radial グラデ | 面の明度・グラデを残すか（マット化） |
| text | `--text` / `--text-dim` の semantic 別名 | 画面固有の強調色 | 文字色の階層 |
| accent | ember 2 値（primitive） | — | ember の意味の割り当て（押せる / 選択 / フォーカス） |
| success / warning / danger / info | **C1 では semantic を作らない**（現行は 1 対 1 でないため）。primitive のみ | — | 各意味の色 |
| HP / MP / stamina | バーの 2 値グラデ（primitive + semantic `--ui-hp` 等、現行値） | — | 形・色（フラスコ等） |
| border | 幅 1px、`--panel-line` の別名 | dashed の区切り | 枠の扱い |
| font-family | 4 系統（sans / serif / display / mono）の別名 | — | 書体の最終決定 |
| font-size | §5 の role token（現行値） | 1 回しか使われない値 | 最小サイズ・階層 |
| font-weight | 400 / 700 | 600 / normal（各 1） | — |
| spacing | **C1 では token 化しない**（padding 60 種がほぼ固有。値の対応づけが見た目判断になる） | すべて | 余白の尺度（C2 で画面ごと） |
| radius | 現行の上位 4 値（6 / 4 / 50% / 8px）を primitive 化。役割名は付けない | 残り 9 値 | ボタン・パネルの形 |
| shadow | パネル外影（現行 5 種は値が異なる → 各 1 つずつ primitive、統合しない） | glow・内影・text-shadow | glow の扱い（マット） |
| z-index | 19 値を層の名前付きで token 化（値は変えない） | — | —（見た目ではない。§3.4） |
| opacity | **C1 では token 化しない**（disabled の表現統一は V / C2） | すべて | 無効状態の表現 |

### 3.4 z-index（PROPOSAL）

z-index は見た目の判断を含まず、重なり順の管理だけなので、C1 で **全 19 値を層名付きで token 化** する（値は変えない）。例: `--ui-z-hud: 16`、`--ui-z-menu: 30`、`--ui-z-dev: 31`、`--ui-z-modal: 120`。Arena（31）がメニュー（30）より前面になる現状（Analyzer F-22）も **値を変えずにそのまま記録**（変更は別判断、AP-C1-08）。

---

## 4. Semantic Color Strategy

### 4.1 2 系統の分離（PROPOSAL、現状の分離を維持）

| 系統 | 置き場所 | 参照元 |
| --- | --- | --- |
| UI semantic color | CSS 変数（`--ui-*`）。§3 の token | DOM / CSS のみ |
| Character palette | 現行どおり `CLASSES[*].color / trim` と `src/render/player-palette.js`（THREE 用の数値） | 3D のみ |

- C1 では **Character palette を CSS 変数にしない**。UI に職業色が必要になった時点（C2 以降、UI-002 Planner report §11.3 の job-accent 案）で、`--char-*` の別名前空間として追加することを候補に残す（C2+ / V）。
- `--ui-*` の中に職業名を含む token を作らない（命名規則として Task に記載）。

### 4.2 C1 で扱う semantic（PROPOSAL）

現行で意味と値が 1 対 1 のものだけ:

| semantic | 現行値の出所 |
| --- | --- |
| `--ui-text` / `--ui-text-muted` | `--text` / `--text-dim` |
| `--ui-surface-bg` / `--ui-surface-panel` / `--ui-surface-hud` | `--bg`、パネルグラデ、HUD 面 |
| `--ui-line` | `--panel-line` |
| `--ui-hp-*` / `--ui-mp-*` / `--ui-stamina-*` | `.bar-fill.hp / .mp / .sta` のグラデ 2 値 |

C1 で作らない（V で意味を決める）: selected / focus / disabled / danger / warning / success / info / interactive / dmg-* / enemy-hp。理由: 現行は同じ色が複数の意味を持つ（Analyzer §4.2）か、意味ごとに表現がばらばら（Analyzer O-04 / O-05）で、名前を付けること自体が見た目の判断になる。

### 4.3 JS / Canvas の色（PROPOSAL）

トースト色（`spawnToast` の引数 10 箇所）、報酬ポップ、ドロップ色、ミニマップ（Canvas）は **C1 の対象外**（AP-C1-06）。token 化するには JS から CSS 変数を読む仕組みが必要で、見た目不変の検証範囲も広がる。C2 / D（HUD）で扱う候補として残す。

---

## 5. Typography Strategy

### 5.1 方針（PROPOSAL）

- C1 は **role token の枠を作り、現行値を入れる** だけ。10px 未満の文字は C1 では変更しない（見た目が変わるため）。
- 最小可読サイズは **V で Human が決める**（UI-002 Planner report §10.1 は 11 / 12px を候補として挙げている。PROPOSAL であり未決定）。C1 では「最小サイズを 1 か所の token で管理できる状態」を作る。

### 5.2 role（PROPOSAL。値は現行値、V で変更）

| role | 用途 | 現行値（C1 で入れる値） | 対象 selector 例 |
| --- | --- | --- | --- |
| `--ui-font-display` | タイトル・画面見出し | family: Cinzel + Noto Serif JP | `.display` |
| `--ui-font-body` | 本文 | family: Noto Sans JP | `html,body` |
| `--ui-font-serif` | 主ボタン・カード名 | family: Noto Serif JP | `#cc-start-btn` 等 |
| `--ui-font-mono` | 開発用パネル・数値 | family: ui-monospace … | PERF / Motion（dev、§9） |
| `--ui-fs-hud-label` | HUD のバーラベル | 8.5px | `.bar-label` |
| `--ui-fs-hud-badge` | HUD の小バッジ | 9.5px | `.weapon-badge` |
| `--ui-fs-caption` | 補足・注記 | 9.5〜10.5px が混在 → **C1 では role を作らず値ごとに primitive**（AP-C1-04） | — |
| `--ui-fs-heading` | 画面見出し | 20px（メニュー） | `.menu-title` |
| `--ui-fs-button` | ボタン | 12〜16px が混在 → primitive のみ | — |

- role は「同じ役割で現行値が 1 つに揃っている」もの（HUD ラベル・見出し等）だけ作る。値が混在する role（caption / button）は、どの値に揃えるかが見た目判断になるため V へ。
- `<button>` の既定書体（Analyzer F-11）は C1 では変えない（`font-family:inherit` を足すと見た目が変わる）。AP-C1-05。

---

## 6. Component Foundation

### 6.1 候補と C1 での扱い（PROPOSAL）

| component | 抽象化する理由 | 既存 DOM との互換 | C1 での扱い |
| --- | --- | --- | --- |
| **Panel** | 4 系統（`.cc-frame` `.menu-box` `.event-box` `.appraisal-box`）が同じ面・枠・角丸を個別に記述（Analyzer O-02） | selector を束ねるだけで DOM は変えない | **C1 で導入（パイロット）**: 共通部分（背景・枠・角丸）を component token + 1 つのグループ selector に集約。影・幅・padding は各 selector に残す（値が異なるため） |
| Button | 14 系統・形 3 種（O-03） | class 追加で共存可能 | C1 では **component token の枠のみ**（現行値の primitive 参照）。形の統一は V |
| Tab | `.ap-tab` / `.skill-subtab` が同じ active 表現 | 同上 | 同上（枠のみ） |
| Badge | `.weapon-badge` `#debug-badge` `.sc-next` 等、役割が別 | — | C1 では扱わない（C2+） |
| Header | `.display` で書体は共通化済み | — | typography role で対応（§5） |
| List / Row | 画面ごとに異なる | — | C2+ |
| Dialog | `#confirm-box` 1 つ | — | C2+ |
| Toast / Notification | JS 生成（`spawnToast` 192 呼び出し） | JS 変更が必要 | C2+（D / HUD） |
| Progress / Resource | HP / MP / スタミナの表示形は V の主題（フラスコ等） | — | **C1 は色 token のみ**。形は V |
| Icon container | §7 | — | §7 |
| Hint / Help | `#hud-hint` `.menu-controls` | — | C2+ |
| Overlay | 表示制御の `.active` / `.show` が E2E の依存対象 | class を変えない | C1 では扱わない |

### 6.2 導入方式（PROPOSAL、AP-C1-03）

- **方式 A（推奨）**: 既存 selector をグループ化して component token を参照させる（`.cc-frame, .menu-box, .event-box, .appraisal-box { background: var(--ui-panel-bg); border: …; border-radius: … }`）。DOM・id・class を一切変えない。
- 方式 B: `ui-panel` class を DOM に追加する。部品名が DOM から見えるが、`index.html` と JS テンプレートの変更が必要。
- C1 は方式 A、共通 class（`ui-*`）の DOM 付与は V 後の C2 で判断、を提案。

---

## 7. Icon Foundation

### 7.1 現状（FACT、Analyzer §7.1 / UI-001 §6.5）

emoji・Unicode 記号のテキスト、CSS 疑似要素、Canvas（ミニマップ）が混在。定義オブジェクト（`CLASSES`、`WEAPON_TYPES`、スキル定義、`LOOT_TABLE`、`SCENARIO_DEFS` 等）の `icon:` 文字列に散在。画像・SVG アイコンは無い。

### 7.2 C1 の基盤（PROPOSAL、AP-C1-07）

- 新規 `src/core/ui-icons.js`（純粋モジュール。DOM・THREE・state に依存しない。`chapter1-rules.js` / `dev-ui.js` と同じ作り）に **意味名 → 現行グリフ** の表を置く。
  - 初期の意味名（候補）: `hp` `mp` `stamina` `attack` `skill` `ultimate` `equipment` `item` `potion` `gold` `tavern` `dialogue` `save` `sortie` `menu`。
  - 値は現行の emoji / 記号のまま（例: `potion: '🧪'`、`menu: '☰'`）。**新しい絵柄は作らない**。
- C1 では **既存の描画箇所を置き換えない**（DOM が変わらない = 見た目不変）。表と unit test（意味名の一覧・全エントリが文字列）だけを入れ、置き換えは UI-002-E（アイコン）で行う。
- 将来の差し替え口（SVG / 画像 / sprite）の形式は E で決める（V で絵柄の方向性を判断した後）。

### 7.3 C1 で決めないもの（V / E）

アイコンの絵柄・スタイル（線 / 塗り、トゥーン表現）、HP フラスコ等の形、配信形式（SVG sprite / 画像 / フォント）。

---

## 8. Responsive Strategy

### 8.1 現状（FACT）

- PC / タッチ切替は `isTouchDevice`（10-input.js:7）の入力判定で、ビューポートでは切り替えない。`@media` は 1 件。
- 部品は `min()` / `clamp()` / `vw` で比率縮小するだけ（Analyzer O-06）。

### 8.2 C1 の基盤（PROPOSAL、AP-C1-09）

- 入力とビューポートを **別の属性** として `<body>` に出す（CSS から参照できる「フック」だけ作る）:
  - `data-ui-input="touch|pointer"` … 既存の `isTouchDevice` をそのまま反映（判定ロジックは変えない）
  - `data-ui-viewport="regular|compact"` … 判定基準は AP-C1-09 で Human が選ぶ（候補: 高さ ≤ 500px / 幅 ≤ 900px / 両方）。1280×800 = regular、844×390 = compact になる基準にする
- C1 では **この属性を参照する CSS を書かない**（見た目不変）。各画面の layout 変更は D / C2 以降。
- 属性の付与は `refreshTouchControls()` / `resize` の既存経路に 1 か所追加する案（10-input.js）。

代替（AP-C1-09 の選択肢）: C1 では responsive を扱わず、D（HUD）の Planner に回す。

---

## 9. Production / Dev UI Boundary

### 9.1 方針（PROPOSAL、AP-C1-08）

- **C1 は production UI だけを token 化の対象にする**。dev UI（Arena / DEBUG バッジ / PERF / Motion Preview / `.testmode-job-card` / `#arena-*`）の CSS は **変更しない**。
- 理由: 開発 UI の見た目刷新は C1 の目的ではない（依頼）。dev UI は `:root` 変数をほぼ使っていない（Analyzer F-21）ため、触らなければ影響も無い。
- 共有している部品（テストモード画面の `.cc-frame` / `.class-card`、鑑定所、メニュー、確認）は production 側の変更に追従する（値不変なので見た目も不変）。
- z-index token（§3.4）は dev 層も含めて名前を付ける（値は変えない）。Arena がメニューより前面に出る件（F-22）は **C1 で直さない**（記録のみ。修正するかは Human）。

---

## 10. Legacy Architecture Strategy

### 10.1 置き場所（PROPOSAL、AP-C1-10）

| 内容 | 置き場所（案） | 理由 |
| --- | --- | --- |
| token | 新規 `src/styles/tokens.css` | 値の一覧を 1 ファイルで見られる。`main.css` から分離 |
| Panel の共通 rule | `main.css` 内（既存 panel selector の近く） | 既存の cascade 順を保つ |
| icon 表 | 新規 `src/core/ui-icons.js` | core の純粋モジュールの前例に従う |
| layout 属性 | `src/legacy/parts/10-input.js`（既存の入力判定の隣） | 判定ロジックを動かさない |

- `tokens.css` の読み込み方（候補）: ① `main.css` 先頭の Google Fonts `@import` の直後に `@import './tokens.css';`（Vite が解決）② `index.html` に `<link>` を追加。①は `index.html` を変えない。どちらでも cascade 上は `main.css` より前に定義される。
- `src/legacy/parts` は ES module 化しない。`ui-icons.js` を使う段階（E）では、既存の core モジュールと同じく `concat-plugin.js` の HEADER に import を追加する（C1 では使わないので HEADER 変更も不要、AP-C1-07）。
- `basefile.html` は変更しない。

---

## 11. Existing DOM / E2E Compatibility

### 11.1 方針（PROPOSAL）

- **C1 は既存の DOM id・class・状態 class（`.active` `.show` `.selected` `.locked` 等）を 1 つも変更・削除しない**。
- 追加するのは CSS 変数・グループ selector・`<body>` の data 属性（AP-C1-09 採用時）・新規 core モジュールのみ。
- CSS にのみ存在する 40 selector（Analyzer F-17）は **削除しない**（C1 の範囲外。別 Task 候補）。

### 11.2 影響の見込み（INFERENCE）

| 変更 | E2E への影響 |
| --- | --- |
| token 化（値不変） | computed style が同じなら影響なし。`getComputedStyle` を使う spec は 1 件（表示判定） |
| Panel のグループ selector | DOM 不変。影響なし |
| `<body>` data 属性 | 既存 spec は `<body>` の属性を見ていない（grep で確認予定、実装時） |
| `ui-icons.js` | DOM 不変。影響なし |

---

## 12. Migration Strategy

### 12.1 段階（PROPOSAL）

| 段階 | 内容 | Task |
| --- | --- | --- |
| 1 | token foundation（現行値の別名、z-index、typography role の一部） | **C1** |
| 2 | Panel パイロット（グループ selector） | **C1** |
| 3 | icon 表（意味名 → 現行グリフ）、layout 属性フック | **C1**（AP 次第） |
| 4 | Visual Sample（代表画面・部品）で見た目を判断 | **V** |
| 5 | token の値の変更、semantic の追加（selected / danger 等）、Button / Tab / Resource display の component 化 | C2 |
| 6 | 画面ごとの適用（HUD / メニュー / 酒場 / 会話 / 鑑定所 / 出撃） | D / F / G / H 等 |
| 7 | アイコンの絵柄と置き換え | E |

### 12.2 共存（PROPOSAL）

- 旧変数（`--ember` 等）と新 token（`--ui-*`）は並存させる。C1 で既存参照を新 token に置き換えるのは、値が完全に一致する宣言だけ。
- 置き換えは「宣言単位」で行い、同じ selector の他の宣言は触らない。途中で止めても表示は変わらない。

---

## 13. Visual Decision Boundary

| 区分 | 内容 |
| --- | --- |
| **A: C1 で実装仕様として確定可能** | token のファイル配置・読み込み方、token の階層と命名規則、現行値の別名化、z-index の層名、Panel のグループ化（値不変）、icon 表の構造（意味名の一覧・現行グリフ）、layout 属性の名前と判定基準、見た目不変の検証方法、既存 DOM / class を変えない規則、Character palette を `--ui-*` に混ぜない規則 |
| **B: V で Human の Visual Decision** | HP のフラスコ表示、MP・スタミナの表示形、アイコンの絵柄・スタイル、ボタンの形、パネルの形・枠・装飾・面の質感（グラデ / フラット、blur の有無）、glow の扱い、色の具体値と意味の割り当て（ember / 赤 / selected / focus / disabled / danger 等）、書体の最終決定、文字の階層と最小サイズ、トゥーン / マット / 中世ファンタジーの具体表現、情報密度 |
| **C: C2 以降の各画面 Task** | spacing の尺度と各画面への適用、各画面の layout（1280×800 / 844×390）、会話 UI・メニュー・酒場・鑑定所・出撃画面の構成、Toast / Dialog / List の component 化、JS / Canvas の色の token 化、dev UI の見た目、CSS のみの selector の整理、Arena の重なり順 |

---

## 14. Work Items

Work Item は 4 つ（細分化しすぎない。V の判断を含むものは入れない）。

### WI-C1-1 Token foundation（色・typography role・radius・shadow・z-index）

- 内容: `src/styles/tokens.css` を新規作成し、§3 / §4 / §5 の token を **現行値** で定義。`main.css` の該当宣言のうち、値が完全に一致するものを `var(--ui-*)` に置き換える（dev UI の selector は除く）。既存 10 変数は変更しない。
- 見た目: 変わらない（変わった場合は不具合）。
- Files To Change（案）: `src/styles/tokens.css`（新規）、`src/styles/main.css`（読み込み 1 行 + 宣言の置換）
- Approval: AP-C1-01, 02, 04, 05, 06, 08, 10, 11

### WI-C1-2 Panel component pilot

- 内容: 4 つの panel selector の共通部分（背景・枠・角丸）を component token + 1 つのグループ selector に集約。幅・padding・影は各 selector に残す。
- Files To Change（案）: `src/styles/tokens.css`（component token）、`src/styles/main.css`
- 依存: WI-C1-1
- Approval: AP-C1-03, 11

### WI-C1-3 Icon registry

- 内容: `src/core/ui-icons.js`（意味名 → 現行グリフの表、純粋モジュール）と unit test。既存の描画箇所は置き換えない。
- Files To Change（案）: `src/core/ui-icons.js`（新規）、`tests/unit/ui-icons.test.js`（新規）
- 依存: なし
- Approval: AP-C1-07

### WI-C1-4 Layout attribute hooks（任意）

- 内容: `<body>` に `data-ui-input` / `data-ui-viewport` を付与（既存の入力判定を反映、resize で更新）。CSS からは参照しない。
- Files To Change（案）: `src/legacy/parts/10-input.js`、（判定を純関数にする場合）`src/core/ui-layout.js`（新規）+ `tests/unit/ui-layout.test.js`（新規）+ `concat-plugin.js` の HEADER 1 行
- 依存: なし
- Approval: AP-C1-09（不採用なら本 WI は削除し D へ送る）

共通の検証 WI は立てず、各 WI の Test（§17）に含める。見た目不変の確認用 E2E（AP-C1-11）は WI-C1-1 に含める。

---

## 15. Dependencies

| 項目 | 依存 |
| --- | --- |
| WI-C1-2 | WI-C1-1（component token が token ファイルを使う） |
| WI-C1-3 / WI-C1-4 | 独立 |
| 後続 | UI-002-V（C1 の token / Panel / icon 表を Visual Sample の足場にする）、UI-002-D（layout 属性を使う場合） |
| 先行 Task | なし（UI-002-A / B は DONE。A / B の実装は変更しない） |

---

## 16. Approval Points

| # | 論点 | 選択肢 | Planner の推奨（参考） |
| --- | --- | --- | --- |
| AP-C1-01 | C1 で token 化する種類 | ①色・typography role・radius・shadow・z-index（§3.3 の「C1 で token 化する」列）②色と z-index のみ ③色のみ | ① |
| AP-C1-02 | token の命名と階層 | `--ui-p-*`（primitive）/ `--ui-*`（semantic）/ `--ui-<component>-*`（component）の 3 層、既存 10 変数は名前・値とも維持 | 提案どおり |
| AP-C1-03 | Panel の導入方式 | A: グループ selector（DOM 不変）/ B: `ui-panel` class を DOM に追加 | A |
| AP-C1-04 | typography role の範囲 | 現行値が 1 つに揃う role（HUD ラベル・HUD バッジ・見出し・family 4 系統）だけ作り、値が混在する caption / button は primitive のみ | 提案どおり |
| AP-C1-05 | `<button>` の既定書体 | 現状維持（C1 では `font-family` を足さない）/ C1 で継承に揃える（見た目が変わる） | 現状維持 |
| AP-C1-06 | JS / Canvas の直書き色（トースト・報酬ポップ・ドロップ・ミニマップ） | C1 対象外 / C1 で対象 | 対象外 |
| AP-C1-07 | icon 表 | 導入する（置き換えはしない）/ C1 では導入しない（E で） | 導入する |
| AP-C1-08 | dev UI | C1 で変更しない（z-index の名前付けのみ。Arena の前面表示も変えない）/ dev UI も token 化 | 変更しない |
| AP-C1-09 | layout 属性フック（WI-C1-4） | 採用（viewport 判定基準: 高さ ≤ 500px / 幅 ≤ 900px / 両方 から選ぶ）/ 不採用（D へ） | 採用・基準は Human が選択 |
| AP-C1-10 | token の置き場所と読み込み | `src/styles/tokens.css` を `main.css` から `@import` / `index.html` に `<link>` 追加 / `main.css` 内に置く | `tokens.css` + `@import` |
| AP-C1-11 | 見た目不変の判定方法とテスト追加 | 新規 E2E `tests/ui-foundation.spec.js`（主要要素の computed style を現行値と比較）+ タイトル画面のピクセル比較（実装者のローカル確認）+ 1280×800 / 844×390 撮影比較（目視）/ 既存 E2E のみ | 新規 E2E + 撮影比較 |
| AP-C1-12 | Persistence | 実装ブランチ名（案 `claude/ui-002-c1-impl`）と commit / push の許可 | Human が指定 |

Approval Point 数: **12**

---

## 17. Test Strategy

### 17.1 実行するもの（PROPOSAL）

| 区分 | 内容 |
| --- | --- |
| Build | `npm run build`（`tokens.css` の `@import` が本番ビルドで解決されること、`dist` の CSS に token が含まれること） |
| Unit | `npm run test:unit`（WI-C1-3 / 4 の新規 unit を含む） |
| E2E | **Full Regression**（CSS 全体に関わるため）。既存 FAIL（mansion-escort / execution-break）・FLAKY 記録（job-traits）は従来どおり記録し PASS に数えない |
| computed style 比較 | 変更前（baseline `63235ce`）と変更後で、代表要素の computed style（color / background-image / border / border-radius / box-shadow / font-family / font-size / font-weight / z-index）を取得し完全一致を確認。対象: タイトル `.cc-frame` `#cc-start-btn`、HUD `.hud-topleft` `.bar-fill.*` `.bar-label` `.weapon-badge`、メニュー `.menu-box` `.menu-btn.primary` `.menu-setting-btn`、確認 `#confirm-box` `.confirm-btn`、会話 `.dialogue-box`、鑑定所（テストモード経由）`.appraisal-box` `.ap-tab.active`、dev UI `.arena-panel` `#debug-badge` |
| ピクセル比較 | 3D を含まない画面（タイトル、テストモード画面）のみ完全一致を確認（Analyzer F-23 で再現性確認済み） |
| 撮影 | 1280×800 / 844×390（タッチ）× 本編（タイトル・会話・酒場 HUD・メニュー・確認）/ テストモード（鑑定所・Arena）。変更前後を並べて目視比較 |
| DOM / class 互換 | `index.html` の id / class の一覧が変更前後で同一であること（diff で確認） |

- 3D 上の要素（HUD・メニュー）はピクセル完全一致を判定基準にしない（Analyzer F-23）。computed style 比較を主基準にする。
- Web フォントはこの環境で読み込めないため、撮影は変更前後とも同条件（フォールバック書体）で比較する。GitHub Pages での実機確認は NOT_RUN として記録（Human 確認）。

### 17.2 visual regression の候補（記録のみ）

Playwright `toHaveScreenshot` による恒常的な比較は、3D の非決定性とフォント環境の差で不安定になる見込み（INFERENCE）。導入は C1 では提案しない。V / C2 で再検討。

---

## 18. Scope Boundary

C1 で実装しない（V / C2 / D / E / F / G / H 等で扱う）:

- HP フラスコ等の最終 Visual、MP・スタミナの表示形
- 自作アイコンの絵柄・完成デザイン、既存アイコンの置き換え
- 戦闘 HUD 全体の刷新、メニュー全体の刷新、酒場 UI、会話 UI、鑑定所 UI、シナリオ（出撃）画面の刷新
- 実際のゲーム画面のレイアウト変更、各画面のレスポンシブ実装
- 色・サイズ・角丸・影・余白の値の変更、10px 未満の文字の拡大
- semantic の意味の再割り当て（selected / focus / disabled / danger / warning / success / info）
- dev UI の見た目変更、Arena の重なり順の変更
- CSS のみの selector の削除、`<button>` の書体変更
- JS / Canvas の直書き色の token 化
- `src/legacy/parts` の ES module 化、`basefile.html` の変更
- UI-002-A / UI-002-B の実装の変更、既存 DOM id / class の変更

## 19. Open Questions

| # | 質問 | 関連 |
| --- | --- | --- |
| OQ-1 | V の Visual Sample は、C1 の token を差し替える形（token の値だけ変えた見本）で作るか、別の見本ページを作るか | V の Planner |
| OQ-2 | V で決めた値を C2 で反映する際、旧 10 変数（`--ember` 等）を新 token の別名に切り替える時期 | C2 |
| OQ-3 | Web フォントが読み込める環境での撮影（書体の判断用）をどこで行うか（GitHub Pages / 実機） | V |
| OQ-4 | CSS のみの 40 selector を整理する Task を別に起票するか | Human |
| OQ-5 | Arena がメニューより前面に出る件（dev のみ）を修正するか | Human |

---

## 変更したファイル（本 Planner）

- `.ai/reports/UI-002-C1-plan.md`（新規）
- `.ai/tasks/UI-002-C1.md`（Status、Analysis / Plan 参照、Work Items と Approval Points の一覧（すべて未承認）、Status History）
- source / CSS / tests / Decision record は変更していない。
