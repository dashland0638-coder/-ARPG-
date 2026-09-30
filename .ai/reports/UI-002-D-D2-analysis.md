# UI-002-D-D2 Analysis（WI-D2 HUD レイアウト基盤）

- Role: Analyzer（READ ONLY。書いたのは本ファイルのみ。コード・テスト・Task・Decision record は変更していない。commit / push していない）
- Task: `.ai/tasks/UI-002-D.md`（main `7f5e5cd` の版。WI-D0 DONE / WI-D1 DONE / WI-D2〜D6 WAITING_APPROVAL）
- Date: 2026-09-30
- Session: UI-001 以降と同一の Claude Code セッション（独立性なし）
- 表記: **FACT**（`path:line` / 実測で確認）/ **INFERENCE**（推測。根拠を示す）/ **HUMAN DECISION REQUIRED** / **OUT OF SCOPE（D2）**
- 本レポートは Planner ではない。変更の「候補」と判断材料を示すだけで、採否・具体値は決めない。

---

## 1. Baseline

| 項目 | 値 |
| --- | --- |
| Baseline main | `7f5e5cd4f538df134ffe34920bed73d677438a4b`（WI-D1 DONE の merge） |
| 読んだ内容 | main の `git archive` をリポジトリ外へ展開して読み・計測した。作業ツリーの未 commit 変更（`.ai/tasks/UI-002-C2.md` 等）は対象外 |
| 既存の実測 | `.ai/reports/UI-002-D-analysis.md` §15.2（WI-D0。基準 `40644f3`） |
| 再計測 | 本レポート §3（main `7f5e5cd`、headless Chromium、`executablePath: /opt/pw-browsers/chromium`。計測スクリプトはリポジトリ外） |

## 2. D2 の定義（FACT: `.ai/tasks/UI-002-D.md` WI-D2 と HD）

- Scope: HUD ゾーン用 DOM コンテナの新設（HD-D13）、responsive layout（HD-D04: 同じ部品を viewport サイズで配置替え、body 属性方式は使わない）、safe-area、中央 60%×60% 方針（HD-D02: 常時 UI は中央を避ける。一時・条件付き表示は中央可）、既存 UI を設計制約にしない（HD-D03）
- Allowed: ゾーン DOM の追加、既存 HUD 要素のゾーンへの移動、配置・responsive・safe-area の CSS、既存 token の参照
- Forbidden: 入力と結び付いた id の変更、見た目の値の決定（C2 / V）、新しい token の値、body 属性方式、C1 token 値の変更
- AC（Task の文言）: 両サイズで常時表示 UI が中央 60%×60% に入らない（実測）。HUD 要素同士が重ならない（実測）。iPhone safe-area を考慮した配置（実機は NOT_RUN と明記）
- HD-D28: 位置・寸法・viewport ごとのレイアウト・safe-area は D が決める。見た目は C2 / V を参照し再決定しない。C2 Prototype の DOM をコピーしない
- HD-D12: 通常の所持品チップは戦闘 HUD から除外。回復のクイック使用 UI は Action Zone（WI-D3）

## 3. 現状の実測（main `7f5e5cd`、本編・導入会話後 7 秒）

### 3.1 1280×800（非タッチ・PC）

| 要素 | x, y, w×h | 中央 60%×60% への侵入 |
| --- | --- | --- |
| `.hud-topleft` | 16,16, 254×130 | 0 |
| `#hud-portrait` / `#weapon-badge` | 27,59 44×44 / 56,88 18×18 | 0 |
| `#hud-loot`（☰ 🧪 🔷） | 16,94, 125×33 | 0 |
| `#minimap-wrap` / `#minimap-label` | 1152,8 112×112 / 1152,125 112×16 | 0 |
| `#btn-ult` | 1022,616, 52×52 | **48 px²** |
| `#btn-charge` / `#btn-attack` | 1140,644 / 1094,700 | 0 |
| 非表示（D1 の条件どおり） | `#sta-fill`（満タン）、`#hud-hint`（5 秒経過）、`#gamepad-badge`、`#btn-skill2`（未習得）、スティック類 | — |

### 3.2 844×390（タッチ）

| 要素 | x, y, w×h | 中央 60%×60% への侵入 |
| --- | --- | --- |
| `.hud-topleft` | 16,16, 254×130 | **6,882 px²（要素の 21%）**。うち `#mp-fill` 582 px² |
| `#hud-loot` | 16,94, 125×33 | 0 |
| `#minimap-wrap` / `#minimap-label` | 724,8 104×104 / 724,117 104×16 | 0 |
| `#btn-ult` | 586,206, 52×52 | **2,704 px²（100%）** |
| `#btn-attack` | 658,290, 82×82 | **378 px²（6%）** |
| `#btn-charge` / `#btn-dodge` / `#btn-jump` | 704,234 / 756,222 / 758,300 | 0 |
| `.joy-base` / `.joy-zone`（透明の操作域） | 56,222 112×112 / 0,211 405×179 | 0 / 23,960（見えない） |
| `#btn-cam-left` / `#btn-cam-right` | 380,342 / 430,342 | 0 |

- FACT: §3.1・§3.2 の座標は WI-D0（`40644f3`）の §15.2.2 / §15.2.3 と同じ。E（glyph の中身）・C2（Prototype は `?uiproto=1` の時だけ）・D1（表示条件）は配置を変えていない。D1 による差は、満タンのスタミナと 5 秒後の PC 操作ヒントが非表示になった点だけ。

### 3.3 常時 UI 同士の重なり（両サイズ共通、FACT）

| 重なり | 矩形 |
| --- | --- |
| `.hud-topleft` × `#hud-loot` | 125×33（`#hud-loot` が左上パネルの内側 y94〜127 に丸ごと入る） |
| `#hud-loot` × `#hud-portrait` | 44×9 |
| `#hud-loot` × `#weapon-badge` | 重なる（WI-D0 では 18×12。武器バッジの大部分と MP バーの左側が覆われる、UI-001 F-05） |

### 3.4 safe-area（CDP `Emulation.setSafeAreaInsetsOverride` 上 0 / 左 47 / 下 21 / 右 47。横向き iPhone を想定した仮の値）

| 要素 | inset への追従（FACT: 実測） | CSS（FACT） |
| --- | --- | --- |
| `.hud-topleft` | 追従しない（x16 のまま。左 inset 47 の内側に 31px 入る） | `top:16px; left:16px`（`main.css:643`）。**inset を 1 つも使っていない** |
| `#hud-loot` | 左右は追従しない | `top:calc(16px + env(safe-area-inset-top)); left:16px; margin-top:78px`（`main.css:673-675`） |
| `#minimap-wrap` / `#minimap-label` | 右は追従しない（右 inset に 31px 入る） | `top:calc(8px + env(top)); right:16px`（`main.css:822-823, 388-390`） |
| `.hud-gamepad-badge` | 未計測 | `top:calc(16px + env(top)); right:64px`（`main.css:736-737`） |
| `#hud-hint` | 未計測（PC のみ表示） | `bottom:14px`（inset なし、`main.css:710-711`） |
| Action ボタン・スティック・カメラ回転 | 下だけ追従（y が -21）。左右は追従しない | `bottom:calc(Npx + env(bottom))` |
| `#msg-log` | 下だけ | `bottom:calc(84px + env(bottom))` |

- 1280×800 でも同じ CSS なので、左右 inset を与えると同じく追従しない（FACT: 同条件で `.hud-topleft` / ミニマップの x が変わらないことを実測）。
- 上 inset（縦向き・ノッチ上）は今回エミュレートしていない（NOT_MEASURED）。CSS 上は `.hud-topleft` だけが上 inset を見ず、`#hud-loot` は見るため、上 inset があると両者の縦位置のずれ方が変わる（INFERENCE: `main.css:643, 674`）。

## 4. 問題と原因の切り分け

### A. 左上（Character 周辺）の重なり

- 現状: `.hud-topleft`（名前・肖像＋武器バッジ・HP・MP・スタミナ・階層・XP〈テストモード〉）と `#hud-loot`（☰ 🧪 🔷）が、どちらも `#hud` 直下の `position:absolute` で、**別々に座標を決めている**（FACT: `index.html:85-103`、`main.css:642-646, 673-680`）。
- 原因: `#hud-loot` の縦位置は `margin-top:78px` の固定値。CSS のコメント（`main.css:461-462`）は「`.hud-topleft` の高さ約 78px」を前提にしているが、実際の高さは 130px（FACT: 実測）。パネルの中身（MP・スタミナのラベルとバー）が増えた後も固定値が更新されていない。
- 切り分け: DOM 構造（兄弟の独立配置）＋ CSS の固定オフセットが原因。z-index は両方とも `--ui-z-hud-panel`（同じ層、後勝ち）。viewport・safe-area・D1 の表示条件は原因ではない（両サイズで同じ重なり。スタミナを visibility で隠しても高さは変わらない）。
- ミニマップは右上で、左上とは関係しない（FACT）。

### B. 所持品チップ（`#hud-loot`）

- FACT: DOM・CSS・JS とも残っている（`index.html:99-103`、`main.css:673-696`、`10-input.js:133`、`12-progression-ui.js:1731-1732`）。HD-D12 の「通常の所持品チップを戦闘 HUD から除外」は **未実装**（D1 の範囲外だった）。
- 3 つのチップは役割が違う:
  - ☰ `#loot-menu-btn`: 画面上からメニューを開く **唯一のボタン**（`10-input.js:133`。PC は Esc でも開く）。`combat-test-arena.spec.js:44-51` がこのボタンの矩形と押下を検証している。
  - 🧪 `#loot-potion-btn`: 回復薬を **タップで使う唯一の手段**（`12-progression-ui.js:1731`。PC は V キー、`09-save-load.js:331`）。
  - 🔷 `#loot-mppotion-btn`: `pointerdown` の処理はある（`12-progression-ui.js:1732`）が、`pointer-events:auto` の指定が無く（`#hud` が `pointer-events:none`）タップできない（FACT: `main.css:639, 688-689`）。キーボードの割り当ても無い（FACT: 検索 `KeyV` / `useMpPotion`）。MP は HD-D29 で別 Task。
- INFERENCE: チップを D2 で単純に消すと、タッチ端末でメニューを開く手段と回復薬を使う手段が無くなる。回復の置き場所（Action Zone のクイック使用）は WI-D3 の Scope。
- 不要コード: `#btn-menu-touch`（`main.css:833-838`）は DOM・JS に存在しない CSS だけのルール（FACT: 検索）。D2 のレイアウト問題とは別の整理対象（OUT OF SCOPE（D2）として記録のみ）。

### C. safe-area

- FACT（§3.4）: 下 inset は Action ボタン・スティック等が追従、左右 inset はどの HUD 要素も追従しない、上 inset は `.hud-topleft` だけ見ていない。
- D2 の対象になるのは、ゾーンの基準点（左上・右上・下中央）に inset を入れること。Action ボタン群の最終位置（左右 inset を含む）は WI-D3、`#msg-log` は WI-D5。

### D. HUD ゾーン（現状の分類、FACT に基づく整理）

| ゾーン（案の名前） | 現在の要素 | 常時 / 条件 | 担当 WI |
| --- | --- | --- | --- |
| 左上: Character | `.hud-topleft`（名前・肖像・武器バッジ・HP・MP・スタミナ・階層） | 常時（スタミナは条件） | 配置の基準 = D2、中身の設計 = D4 |
| 左上の下: 所持品 | `#hud-loot`（☰ 🧪 🔷） | 常時 | 除外方針 HD-D12。☰ と 🧪 の移し先が必要（§7） |
| 右上: Navigation | `#minimap-wrap` / `#minimap-label`、`.hud-gamepad-badge` | 条件（D1） | 配置の基準 = D2 |
| 上中央 | `#boss-bar-wrap`、`#scenario-timer` | 条件 | D6 |
| 中央 | トースト、`#execute-prompt`、`#interact-btn`、`#combo-indicator` | 一時 | D5 / D6（中央可、HD-D02） |
| 下中央 | `#hud-hint`（PC・5 秒） | 条件（D1） | 配置の基準 = D2（位置のみ） |
| 左下 | `#msg-log`、スティック | 条件 / タッチ時 | D5 / D3 |
| 右下: Action | 攻撃・Skill 1 / 2・必殺（・Skill 3 テストモード）・回避・JUMP | 常時 / タッチ時 | D3 |

- FACT: トースト・ダメージ数値・ログ・拾得ポップは JS が `#hud` に直接 `appendChild` する（`11-combat-actions.js:2167, 2201, 2223, 2242`、`12-progression-ui.js:1986`）。E2E が `#hud .item-pop` を読む（`dev-ui-gate.spec.js:41`、`character-weapon-visual.spec.js:84`、`chapter1-dusk-basics.spec.js:89`）。ゾーン DOM を足しても、これらの追加先（`#hud`）は D5 まで変えない前提にするのが安全（INFERENCE）。
- FACT: `#touch-controls` は `#hud` の外にある別の全画面レイヤ（`index.html`、`main.css:751`）。Action ボタン群は `#hud` のゾーンとは別の親を持つ。

### E. viewport

- FACT: HUD の配置に使っている responsive の仕組みは `clamp()`（ミニマップ）と `env()` だけで、HUD 用の `@media` は無い（検索: `@media` は `main.css:71` のキャラ選択グリッドのみ）。body 属性による分岐も無い（HD-D04 どおり）。
- INFERENCE: 1280×800 と 844×390 の配置差は、CSS の `@media (max-height: …)` / `(max-width: …)` か、`vmin` / `clamp()` で表せる。どの閾値で切り替えるか（高さ 390 付近の横向き端末）は Planner / Human の判断。

### F. 中央 60%×60%（常時 UI）

- 1280×800: 侵入は `#btn-ult` の 48 px² だけ（Action ボタン = D3）。
- 844×390: `.hud-topleft` 6,882 px²（パネルの大きさ 254×130 が中央の左上端 x168.8 / y78 を越える）、`#btn-ult` 2,704 px²、`#btn-attack` 378 px²（Action = D3）。safe-area の下 inset を入れると `#btn-attack` は 740 px² に増える（FACT）。
- 左上パネルの侵入の原因は **パネル自体の大きさ**（中身: 名前・HP・MP・スタミナのラベルとバー）。位置だけを変えても 254×130 のままでは、844×390 の左上に中央へ入らずに置ける範囲（x < 168.8 かつ y < 78、または縦に並ぶ高さ）に収まらない（INFERENCE: 幾何）。縮める手段（コンパクト表示・並べ替え）は Character Zone の設計 = WI-D4、MP の撤去は HD-D29 で別 Task。
- したがって Task の AC「両サイズで常時表示 UI が中央 60%×60% に入らない」は、D2 単独では満たせない（Action ボタン = D3、左上パネルの大きさ = D4）。**HUMAN DECISION REQUIRED**（§7）。

## 5. D2 で解決すべき範囲（候補）

1. **ゾーン DOM の新設**（HD-D13）: 少なくとも左上（Character + 所持品の置き場）・右上（Navigation）・下中央（ヒント）のゾーン容器を `#hud` の中に作り、既存要素を **要素ごと**（id・class・中身を変えずに）移す。ゾーン内は通常フロー（flex 等）で縦に並べ、`margin-top:78px` のような固定オフセットを無くす → §4.A の重なりが構造的に解消される。
2. **safe-area**: ゾーン容器の基準点に `env(safe-area-inset-top/left/right/bottom)` を入れる（左上 = top・left、右上 = top・right、下中央 = bottom）。個々の要素ではなくゾーンで一度だけ扱う。
3. **viewport**: 1280×800 と 844×390 でゾーンの基準点・余白を切り替える仕組み（`@media` または `clamp()`）。body 属性は使わない（HD-D04）。
4. **中央 60%×60% の検証基盤**: ゾーン容器が中央 60%×60% に入らないことを実測で確認する E2E（D3 / D4 が同じ検証を使えるように）。
5. **所持品チップ**: HD-D12 の除外は、☰ と 🧪 の移し先が決まるまで D2 で消さない（§7 の Human Decision に依存）。D2 では「ゾーン化で重なりを無くす」までを候補とする。

## 6. D3〜D6 へ送る範囲（OUT OF SCOPE（D2））

| 項目 | 送り先 |
| --- | --- |
| Action ボタン（必殺・攻撃・Skill 2）の中央侵入と最終位置、左右 inset、PC のタッチボタンの実際の非表示化、回復のクイック使用 UI | WI-D3 |
| 左上パネルの中身・大きさ（コンパクト化・並べ替え）、MP 表示の扱い、スタミナの行の詰め方（D1 N-1） | WI-D4（MP は別 Task、HD-D29） |
| `#msg-log` の位置・下 inset、トースト・ログの重複、`#hud` への追加先 | WI-D5 |
| 処刑・インタラクト・コンボ・制限時間・ボスバー | WI-D6 |
| `#btn-menu-touch` の使われていない CSS | 別の整理（D2 のレイアウト問題と混ぜない） |
| 🔷 チップがタップできない件（MP） | MP の別 Task |
| `ui-proto-gate.spec.js:92` の BASELINE FAIL | C2 側の既存問題 |

## 7. HUMAN DECISION REQUIRED

1. **D2 の AC「両サイズで常時表示 UI が中央 60%×60% に入らない」の解釈**: 844×390 の侵入は Action ボタン（D3）と左上パネルの大きさ（D4）が原因で、D2 のゾーン配置だけでは満たせない。選択肢:
   - (a) D2 の AC を「ゾーン容器（とゾーンの基準点）が中央に入らない」に限定し、要素の侵入の解消は D3 / D4 の AC とする
   - (b) D2 で左上パネルの 844×390 向けの縮小（コンパクト表示）まで行う（D4 の範囲に踏み込む）
   - (c) その他
2. **☰（メニュー）の置き場所**: 所持品チップを除外するとき、画面上のメニューボタンをどのゾーンに置くか（例: 左上ゾーン内に残す / 右上ゾーンへ移す）。タッチ端末で唯一のメニュー入口のため、除外の前に決める必要がある。
3. **🧪（回復）の除外時期**: 回復のクイック使用 UI は WI-D3。D2 で 🧪 チップを消すと、D3 までの間タッチで回復できない。選択肢: D2 では残す（ゾーン内へ移すだけ）/ D2 と D3 を同時に出す / その他。
4. **🔷（MP ポーション）チップ**: HD-D29（D では MP を非表示にしない）との関係。所持品チップとして D2 で除外するか、MP の別 Task まで残すか。
5. **viewport の切り替え閾値**: 844×390 相当をどの条件（高さ・幅・縦横比）で判定するか。Human Visual Decision を要する具体値（余白・ゾーン寸法）は C2 / V の方針に従う前提で、D の判断範囲を確認したい。
6. **safe-area の実機確認**: iPhone 実機は NOT_RUN。エミュレーションの仮値（0 / 47 / 21 / 47）で受け入れるか。

## 8. 変更候補（Planner への材料。採否は未決定）

| 区分 | 候補 |
| --- | --- |
| ファイル | `index.html`（`#hud` 内のゾーン容器と既存要素の移動）、`src/styles/main.css`（ゾーンの配置・safe-area・viewport） |
| 変えない候補 | `src/legacy/parts/*.js`（id で要素を取るため、要素ごとの移動なら JS は変更不要の見込み。INFERENCE: `getElementById` 利用、FACT: 検索）、`src/core/combat-hud-visibility.js`（D1。D2 は表示条件を変えない） |
| DOM | 例: `#hud` 直下に左上・右上・下中央のゾーン容器。`.hud-topleft` と `#hud-loot` を左上ゾーンへ、`#minimap-wrap` / `#minimap-label` / `#gamepad-badge` を右上ゾーンへ、`#hud-hint` を下中央ゾーンへ。id・class は変えない |
| CSS | ゾーン容器に `position:absolute` と inset 込みの基準点、ゾーン内は flex の縦並び。子要素の `position:absolute` / 固定オフセットの解除（`#hud-loot` の `margin-top:78px` 等） |
| 既存 token | C1 の `--ui-z-hud-panel` 等、C2 の `--ui-*`（色）。新しい寸法 token が必要なら Human Visual Decision |
| D1 との関係 | D1 のスタミナ表示は `#sta-fill` の親と直前の見出しを隠す（D1 N-1）。D2 は `.hud-topleft` を丸ごと移すだけなら影響しない。パネル内部の並べ替えは D4 |

## 9. テスト方法・実測方法（候補）

- 実測: 本レポート §3 と同じ方法（headless Chromium、1280×800 非タッチ / 844×390 タッチ、本編・導入会話後、CDP の safe-area エミュレーション）で、ゾーン容器と常時 UI の矩形・中央侵入・重なりを変更前後で比較する。
- E2E 候補: ゾーン容器が中央 60%×60% に入らない / 左上パネルと所持品（またはその代替）が重ならない / 武器バッジが覆われない / safe-area エミュレーション下で左右上の基準点が inset の内側に入る。
- 影響を受ける既存テスト（FACT: 検索）:
  - `ui-foundation.spec.js:40-44`（`.hud-topleft` の背景色・角丸・z-index 30。ゾーン化しても computed 値は変えない前提）
  - `combat-test-arena.spec.js:44-51`（`#arena-toggle-btn` と `#loot-menu-btn` の矩形が重ならない・☰ でメニューが開く。Arena ボタンは `.arena-toggle-btn` の `top:136px` 固定で左上パネルの下を前提、`main.css:461-467`）
  - `ui-production-glyphs.spec.js`（`#weapon-badge` の 18×18px）、`combat-hud-display-conditions.spec.js`（常時表示・スタミナ・ヒント）
  - `#hud .item-pop` を読む spec（追加先を変えない限り影響しない）

## 10. リスク

- R1: ゾーン化で `.hud-topleft` の座標が変わると、テストモードの `#arena-toggle-btn`（固定 top:136px）と重なりうる（FACT: `main.css:466`。開発用 UI だが E2E がある）。
- R2: 所持品チップの除外は、メニュー・回復のタッチ操作経路を失わせうる（§7-2, 3）。
- R3: 844×390 の中央侵入は D2 だけでは解消しない（§4.F）。AC の解釈を決めないまま D2 を実装すると、受け入れ判定ができない。
- R4: safe-area は仮値のエミュレーションだけで、実機（ノッチ・角丸・ホームインジケータ）は未確認。
- R5: ゾーン容器が新しい stacking context を作ると、既存の z-index（`--ui-z-hud-panel` 等）の前後関係が変わりうる（INFERENCE）。

## 11. D2 では変更しないもの

- 入力と結び付いた id（`#loot-menu-btn` 等）、`src/legacy/parts/*.js` の入力・戦闘・表示条件のロジック、D1 の表示条件、E の glyph、C2 / V の見た目の値・token 値、`basefile.html`、concat 構造、body 属性方式の導入、MP、Action ボタン・通知・D6 の要素の位置

## 12. NOT_RUN / NOT_MEASURED

| 項目 | 状態 | 理由 |
| --- | --- | --- |
| iPhone 実機（safe-area・ノッチ・角丸・親指の届く範囲） | NOT_RUN | 実機なし。エミュレーションは仮値 |
| 上 inset（縦向き・ノッチ上）のエミュレーション | NOT_MEASURED | 今回は上 0 のみ |
| `.hud-gamepad-badge` の位置（パッド接続時） | NOT_MEASURED | パッド未接続。CSS 上はミニマップ（右 16px・幅 104〜112px）と `right:64px` の badge が横方向で重なりうる（INFERENCE: `main.css:737, 823-824`） |
| `#hud-hint` の safe-area 追従 | NOT_MEASURED | 5 秒表示のため今回の計測時点では非表示 |
| 縦向き（portrait） | NOT_RUN | 回転オーバーレイ（`#rotate-overlay`）で横向きを求める仕様 |
| テストモード（`.hud-topleft` 254×141、XP 行あり）の左上 | 既存値のみ | WI-D0 §15.2.2 の値を参照（今回は本編のみ再計測） |
| build / unit / E2E | NOT_RUN | Analyzer はコードを変えていない |

## 13. 変更したファイル

- `.ai/reports/UI-002-D-D2-analysis.md`（新規・未 commit）のみ。
