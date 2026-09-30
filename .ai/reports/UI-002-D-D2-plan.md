# UI-002-D-D2 Planner Report（WI-D2 HUD レイアウト基盤）

- Role: Planner（READ ONLY。書いたのは本ファイルと Task の WI-D2 計画の追記のみ。コード・テストは変更していない）
- Task: `.ai/tasks/UI-002-D.md`（WI-D2 は **WAITING_APPROVAL** のまま）
- Date: 2026-09-30
- Session: UI-001 以降と同一の Claude Code セッション（独立性なし）
- 本計画は **提案**。Human Approval があるまで実装しない

## 0. 入力

| 入力 | 版 |
| --- | --- |
| Baseline main | `7f5e5cd4f538df134ffe34920bed73d677438a4b`（WI-D1 DONE） |
| D2 Analyzer report | `.ai/reports/UI-002-D-D2-analysis.md`（branch `claude/ui-002-d-planner-persistence` @ `399c2a9b6a48d3779d880649ae2b44679c61b022`、blob `ee16651b9b1dc434d798aea8917489eefdf69d1c`） |
| Human Decision | HD-D30〜HD-D35（`.ai/decisions/UI-002-human-decisions.md`、同 branch @ `03627382c4cbbaad7c148347746e48794ef51cc9`、blob `27529e73f07873444c0eb17f6db54a8ba260df82`）。既存の HD-D01〜D29 を前提とする |
| Implementation branch（案） | `claude/ui-002-d-impl`（HD-D20 / HD-D27。WI-D2 の Persistence は未許可） |

## 1. 方針（HD の反映）

- **HD-D30**: D2 の AC は「HUD **ゾーン**が中央 60%×60% に入らない」。ゾーン内の個別 UI（左上パネルの大きさ、Action ボタン）の侵入は D3 / D4。左上パネルは縮小しない
- **HD-D31**: ☰ の最終位置は固定しない。D2 では案を示す（§3 D2-6）
- **HD-D32**: 🧪（回復）は D3 の Quick-use Action Zone 完成まで削除しない
- **HD-D33 / HD-D29**: 🔷 と MP は変更しない
- **HD-D34**: body 属性ではなく CSS の viewport 条件。breakpoint 値は §3 D2-4 で提案
- **HD-D35**: safe-area は CSS で対応し、E2E はエミュレーション値で検証。実機確認済みとは扱わない
- 見た目（色・形・書体・影・角丸・文字サイズ）は変えない。新しい visual language・新しい token 値を作らない（HD-D28、C1 の token を参照するだけ）

## 2. 現状の要点（Analyzer から）

- 左上: `.hud-topleft`（254×130）と `#hud-loot` が `#hud` 直下で別々に `position:absolute`。`#hud-loot` は `margin-top:78px` の固定値（実際のパネル高 130px と不一致）で、パネルの内側に重なる（両 viewport）
- safe-area: `.hud-topleft` は inset を見ない。`#hud-loot`・ミニマップ・`.hud-gamepad-badge` は上だけ。左右 inset に追従する HUD 要素は無い
- viewport: HUD 用の `@media` は無い（`clamp()` と `env()` のみ）
- 中央 60%×60%: 844×390 で左上パネル（パネルの大きさが原因 → D4）と Action ボタン（D3）が侵入
- DOM の位置: `#minimap-wrap` / `#minimap-label` は `#hud` の外（z-index 14）。`#arena-toggle-btn` / `#arena-panel`（テストモード専用）も `#hud` の外で、`top:136px` / `178px` の固定値
- JS は HUD 要素を `getElementById` で取る。トースト等は `#hud` へ `appendChild`

## 3. Work Items（WI-D2 の中の作業単位。承認単位は WI-D2 全体）

### D2-1 HUD ゾーンの DOM 基盤

| 項目 | 内容 |
| --- | --- |
| 対象ファイル | `index.html`、`src/styles/main.css` |
| 対象 DOM | 左上ゾーン `#hud-zone-tl`（`#hud` 内。`.hud-topleft` と `#hud-loot` を要素ごと移す）、下中央ゾーン `#hud-zone-bc`（`#hud` 内。`#hud-hint` を移す）、右上ゾーン `#hud-zone-tr`（**`#hud` の外**の兄弟要素。`#minimap-wrap`・`#minimap-label`・`#gamepad-badge` を移す） |
| 右上を `#hud` の外に置く理由 | ミニマップは現在 `#hud` の外で z-index 14（タッチ操作 15・`#hud` 16 より下）。`#hud` の中へ入れると重なり順が変わるため、ゾーンを外に作り z-index は現行の `--ui-z-minimap` を使う。`#gamepad-badge` は 16 → 14 に下がる（パッド接続時のみ表示・操作不可の表示。R4） |
| CSS | ゾーン共通クラス `.hud-zone`（`position:absolute` / `fixed`、`pointer-events:none`、flex）。子の個別の `position:absolute` と固定座標をやめ、ゾーン内の並びで置く（D2-2） |
| JS 変更 | **不要の見込み**。HUD 要素は `getElementById` で取得（FACT: 検索）。`#hud` への `appendChild`（トースト・ダメージ数値・ログ・拾得ポップ）は変えない |
| id / class | すべて維持。新規はゾーン容器の id / class のみ |
| state 参照 | 変更なし（D1 の表示条件・E の glyph 更新は id で要素を取るので影響なし） |
| 移さないもの | Action ボタン群（`#touch-controls`、D3）、`#msg-log`（D5）、ボスバー・制限時間・処刑・インタラクト・コンボ（D6）、トースト等の追加先 |
| rollback リスク | 低。DOM の親を変えるだけで、index.html と main.css の差分を戻せば元に戻る |

### D2-2 左上ゾーンの構造的な配置（重なりの解消）

| 項目 | 内容 |
| --- | --- |
| 対象 | `#hud-zone-tl` の中の `.hud-topleft` と `#hud-loot` |
| CSS | ゾーンは `display:flex; flex-direction:column; align-items:flex-start; gap:5px`。`.hud-topleft` は `position:relative`（z-index 30 を保つため）で固定の `top` / `left` を外す。`#hud-loot` は `position:relative` にし、`top` / `left` / `margin-top:78px` / 個別の `env()` を外す |
| 値の根拠 | 外側の余白は現行の 16px を維持。パネルと所持品の間隔 5px は既存の値（ミニマップとラベルの間隔、`main.css:390`）を流用。新しい token は作らない |
| 見た目 | 背景・枠・角丸・影・文字は変えない（`ui-foundation.spec.js` の `.hud-topleft` の computed 値: 背景色・角丸 6px・z-index 30 を維持） |
| 結果（見込み） | 所持品パネルはパネルの直下（1280×800 / 844×390 とも y≈151〜184）に並び、武器バッジと MP バーを覆わなくなる（INFERENCE: 実測は実装後） |
| テストモードの Arena（開発用） | `#arena-toggle-btn`（`top:136px` 固定）が新しい所持品の位置と重なり、`combat-test-arena.spec.js` の「Arena と ☰ が重ならない」が失敗する見込み。**Arena ボタンとパネルを左上ゾーンの末尾（所持品の下）へ移す**案（開発用 UI。`14-training-ground.js` は id で取るので JS 変更は不要の見込み）。TM で既にある `.hud-topleft` × Arena の重なり（82×21、WI-D0）も解消する |
| rollback リスク | 低〜中。テストモードの Arena の見え方が変わる（開発用） |

### D2-3 safe-area 基盤

| 項目 | 内容 |
| --- | --- |
| ルール | inset はゾーンの基準点で 1 回だけ扱う。左上 = `top` / `left`、右上 = `top` / `right`、下中央 = `bottom`（横は中央寄せのまま） |
| CSS | 例: `#hud-zone-tl{ top:calc(16px + env(safe-area-inset-top)); left:calc(16px + env(safe-area-inset-left)); }`、`#hud-zone-tr{ top:calc(8px + env(safe-area-inset-top)); right:calc(16px + env(safe-area-inset-right)); }`、`#hud-zone-bc{ bottom:calc(14px + env(safe-area-inset-bottom)); }`。移した子要素の個別の `env()` は外す（二重加算を避ける） |
| 範囲外 | Action ボタン群・スティックの左右 inset（D3）、`#msg-log`（D5） |
| 検証 | CDP `Emulation.setSafeAreaInsetsOverride`（例 上 0 / 左 47 / 下 21 / 右 47。WI-D0・D2 Analyzer と同じ仮値）で、ゾーンの基準点が inset の内側へ移ることを実測（HD-D35: 実機確認済みとは扱わない） |

### D2-4 viewport の responsive 基盤

| 項目 | 内容 |
| --- | --- |
| breakpoint 案 | `@media (max-height: 500px)` を「高さの小さい横向き端末（844×390 相当）」の条件とする |
| 理由 | 正式対象の 2 つの viewport を分けるのは高さ（800 と 390）。制約になるのは縦方向（中央 60% の上下 20% 帯が 1280×800 では 160px、844×390 では 78px）。一般的な横向きスマートフォンの高さ（約 360〜430px）を含み、タブレット・PC（600px 以上）を含まない値として 500px を提案する。body 属性は使わない |
| D2 での使い方 | ゾーンの寸法（D2-5）を viewport 基準の単位（`vw` / `vh`）で決めるため、D2 の範囲では 2 つの viewport で**同じ規則**になる見込み。`@media (max-height: 500px)` はゾーンの余白・並びを 844×390 用に切り替えるための入口として用意し、D2 では現行の余白（16px）を変えない |
| Human 確認 | 844×390 で余白等を現行と変える（例: 16px → 12px）かどうかは見た目の寸法の判断を含むため、D2 では変えない案とする（変える場合は Human Decision） |

### D2-5 中央 60%×60% のゾーン単位の検証

| 項目 | 内容 |
| --- | --- |
| ゾーンの寸法（HD-D30 の解釈案） | 各ゾーンを「画面外周の帯（中央 60%×60% の外側）」の中に収まる寸法で定義する。例: 左上ゾーン `width:calc(20vw - 16px - env(safe-area-inset-left)); height:calc(20vh - 16px - env(safe-area-inset-top))`、中身は `overflow:visible`。右上・下中央も同様に外周の帯に収める |
| 子要素のはみ出し | 844×390 では左上パネル（254×130）がゾーンの外へはみ出し、中央に入る（現状と同じ見た目。D4 で解決）。**E2E は、ゾーンの侵入を assert し、子要素の侵入量は数値として記録する**（黙って通さない） |
| 代替案 | ゾーンを中身の大きさに合わせる（寸法を持たせない）と、844×390 の左上ゾーンは D4 まで AC-D2-5 を満たせない |
| 推奨 | 上の「外周の帯」案。HD-D30 の「ゾーン内部の個別 UI の侵入は各担当 WI」と一致する。ただし見た目の上では侵入が残ることを Human が確認する必要がある（§6-1） |
| 再利用 | 中央侵入の計算（要素の矩形と中央 60%×60% の交差面積）を `tests/helpers.js` の小さな関数として追加し、D3 / D4 の E2E でも使う（HD-D26 の範囲の E2E 追加） |

### D2-6 所持品チップの扱い

| チップ | D2 | D3 以降 |
| --- | --- | --- |
| ☰ `#loot-menu-btn`（メニュー） | 所持品の行ごと左上ゾーンへ移すだけ（削除しない・id と押下処理を維持） | 最終位置は、所持品の行を撤去するとき（D3 の回復 UI の後）に決める。案: (A) 左上ゾーンに残す（キャラクターの近く、現在と同じ操作感）/ (B) 右上ゾーンのミニマップの近くへ移す（ナビゲーションとしてまとめる）。Planner は D2 では (A) の状態（現在と同じ）を維持し、最終案の選択は Human に委ねる |
| 🧪 `#loot-potion-btn`（回復） | 削除しない（HD-D32）。行ごと移すだけ | D3 の Quick-use Action Zone 完成後に撤去 |
| 🔷 `#loot-mppotion-btn`（MP） | 変更しない（HD-D33）。行ごと移すだけで、要素・表示・押せない状態もそのまま | MP の別 Task |

## 4. Acceptance Criteria（案。Human Approval で確定）

| AC | 内容 | 確認方法 |
| --- | --- | --- |
| AC-D2-1 | 左上の HUD と所持品（loot）が構造的に重ならない（1280×800 / 844×390）。武器バッジが所持品に覆われない | E2E（矩形の交差なし） |
| AC-D2-2 | 既存の要素 id と JS の state 参照が有効（D1 の表示条件・E の glyph・メニュー / 回復の押下・Arena） | 既存 E2E（`combat-hud-display-conditions`・`ui-production-glyphs`・`combat-test-arena`・`chapter1-legacy-ui`）が変更なしで通る |
| AC-D2-3 | HUD ゾーンが safe-area の基盤に従う（エミュレーション値で、ゾーンの基準点が inset の内側） | E2E（CDP エミュレーション） |
| AC-D2-4 | 1280×800 / 844×390 を body 属性なしの CSS viewport 条件で扱う | コード確認（body 属性の追加なし）・E2E（両 viewport） |
| AC-D2-5 | 常時表示の HUD ゾーンが中央 60%×60% に入らない（ゾーン単位。子要素の侵入量は記録） | E2E（両 viewport、safe-area エミュレーションあり / なし） |
| AC-D2-6 | D3 / D4 の責務に触れない（Action ボタン・PC タッチボタン・パネルの中身・通知・D6 の要素） | 差分確認 |
| AC-D2-7 | MP に触れない（🔷 を含む） | 差分確認 |
| AC-D2-8 | 既存の見た目の token を使い、新しい visual language を作らない（`ui-foundation.spec.js` が変更なしで通る） | E2E・差分確認 |
| AC-D2-9 | 🧪 と ☰ がタッチで使える状態を保つ（削除しない） | E2E（☰ でメニューが開く・🧪 が表示される） |

## 5. テスト計画

- Unit: 追加しない（D2 に純粋な layout helper は無い見込み。中央侵入の計算は E2E 側の helper）
- E2E（新規 1 spec 案、例 `tests/hud-zones-layout.spec.js`）: 1280×800（非タッチ）/ 844×390（タッチ）× 本編の導入会話後で、
  - 左上パネルと所持品の重なりなし、武器バッジが覆われない（AC-D2-1）
  - ゾーンの境界（矩形）と中央 60%×60% の交差がゼロ。子要素の侵入量を記録（AC-D2-5）
  - safe-area エミュレーション下で、左上・右上・下中央ゾーンの基準点が inset 分だけ内側（AC-D2-3）
  - 常時表示の要素（名前・肖像・HP・武器バッジ・ミニマップ）が表示されたまま（D1 の条件を変えない）
- 既存 E2E（変更なしで通ることを確認）: `ui-foundation`・`combat-test-arena`・`combat-hud-display-conditions`・`ui-production-glyphs`・`chapter1-legacy-ui`・`scenario-test-mode`・`dev-ui-gate`（`#hud .item-pop`）・`ui-proto-gate`（C2。`:92` は既存の BASELINE FAIL のまま）
- 既存の分類は変えない: FAIL = mansion-escort・execution-break、FLAKY = job-traits・mansion-scenario:70、BASELINE FAIL = ui-proto-gate:92。通常の `npm test` は Chromium revision mismatch で NOT_RUN、iPhone 実機は NOT_RUN
- 実行方法: repo 外の Playwright 設定で `executablePath` だけを指定（これまでと同じ）

## 6. Human Decision / 確認が必要な点

1. **AC-D2-5 の「ゾーン」の寸法**（HD-D30 の解釈）: 推奨案は、ゾーンを外周の帯に収まる寸法にして子要素のはみ出しを許す（844×390 の左上パネルは D4 まで中央に入ったまま、E2E で数値を記録）。代替は、ゾーンを中身の大きさにして 844×390 の左上ゾーンを D4 まで未達とする
2. **テストモードの Arena ボタン・パネルの移動**（開発用 UI）: 左上ゾーンの末尾へ移す案で良いか
3. **`#gamepad-badge` を右上ゾーン（`#hud` の外、z-index 14）へ移す**: 重なり順が 16 → 14 に下がる。パッド接続時のみの表示で操作は無い
4. **breakpoint `@media (max-height: 500px)`** と、D2 では 844×390 の余白を変えない方針
5. **☰ の最終位置**（D3 で決める前提）: (A) 左上 / (B) 右上 のどちらを基本にするか（D2 では (A) の現状維持）
6. **Persistence**: WI-D2 の実装ブランチ（案 `claude/ui-002-d-impl`）と commit / push の許可

## 7. Scope Exclusion（D2 では変えない）

- Action ボタンの最終位置・PC タッチボタンの非表示化・回復のクイック使用 UI（D3）
- 左上パネルの縮小・再設計・MP 行・スタミナ行の詰め方（D4、MP は別 Task）
- 通知（トースト・ログ）の位置・重複・追加先（D5）
- 処刑・インタラクト・コンボ・制限時間・ボスバー（D6）
- MP、戦闘ロジック、VFX、アイコン、C2 / V の見た目、E の glyph、D1 の表示条件
- 既存 FAIL / FLAKY / BASELINE FAIL の修正、`#btn-menu-touch` の使われていない CSS の整理

## 8. リスク

- R1: `.hud-topleft` を `position:relative` にすると、ゾーン（flex 容器）の中で z-index 30 が有効なまま前後関係が保たれる見込みだが、`#hud` の中の重なり順を実測で確認する必要がある（INFERENCE）
- R2: Arena（開発用）の位置が変わる。`combat-test-arena.spec.js` の前提（Arena と ☰ が重ならない）は満たす見込み
- R3: 「外周の帯」案では、ゾーンの矩形と見た目（はみ出した子要素）が一致しない。AC の読み違いを防ぐため、E2E で子要素の侵入量を必ず記録する
- R4: `#gamepad-badge` の重なり順が下がる（パッド接続時の表示のみ）
- R5: safe-area は仮値のエミュレーションだけ。実機は NOT_RUN
- R6: ミニマップの DOM の親が変わる。`drawMinimap` / `updateMinimapLabel` は id で取るため影響は無い見込み（`chapter1-dusk-basics` のキャンバス画素の読み取りも id）

## 9. 変更したファイル

- 本ファイル（新規）と `.ai/tasks/UI-002-D.md`（WI-D2 計画の追記・HD-D30〜35 の表への追加・Status History の 1 行）。いずれも未 commit。コード・テスト・Analyzer report・Decision record は本 Planner では変更していない
