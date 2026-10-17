# UI-002-J Analysis — 鍛冶屋の装備画面のモバイルレイアウト

Role: Analyzer（READ ONLY）
Base: `origin/main` `0079dc2`（PR #87 の squash merge 後）
Branch: `claude/chapter-1-comprehensive-audit-6cul2d`（PR #87 の merge 後に `origin/main` から作り直した。未 merge の作業は無かった）
依頼: Human「鍛冶屋の装備画面・モバイルレイアウト改善」（2026-10-17）。iPhone 実機で、武器の候補の文字が読みにくく、装備中の表示と候補の一覧の面積の配分が悪い。

## 1. 計測（FACT）

### 1.1 条件

- 道具: Playwright（Chromium 1194、SwiftShader）、`deviceScaleFactor: 1`
- 視点: 844×390（`hasTouch`）と 1280×800
- セーブ: 本編・鍛冶士の加入後（魔法使い＋支援 剣士）
- 持ち物: 装備品 10 点
  - 武器 4（杖 3、魔法の剣 1）
  - 上半身 3
  - 下半身 3
  - 初期の 3 点は自動で装備される
- 計測用の spec はリポジトリの外（scratchpad）に置いた。

### 1.2 結果（修正前、`0079dc2`）

| 計測 | 844×390 | 1280×800 |
| --- | --- | --- |
| パネル | 760×343 | 760×704 |
| 見出し / タブ | 28px / 36px | 34px / 36px |
| 装備枠の行（3 枠を横に並べる） | 59px | 63px |
| 道具（最強装備・まとめて売却・凡例） | 36px | 36px |
| 所持品の一覧 | **93px** | 約 430px |
| 閉じる | 36px | 36px |
| 一覧の 1 行 | 48px | 48px |
| 一覧の中で全体が見える行数 | **1 行** | 8 行 |
| 品名の文字 | 12px | 12px |
| 武器種・能力値の文字 | 11px | 11px |
| 最小の文字 | 11px（装備枠のラベル） | 11px |
| 最小のタッチ対象 | 36px | 36px |

撮影（844×390）では、一覧に見えるのは装備中の「古びた杖」だけで、次の「擦り切れたローブ」は半分で切れる。どちらも上の装備枠と同じ内容。

## 2. 原因（FACT と INFERENCE）

1. **縦に積みすぎている**（FACT）
   - パネルは高さ 343px の 1 列。上から次の順に縦に並ぶ。
     - 見出し 28px
     - タブ 36px
     - 装備枠 59px
     - 道具 36px
     - 閉じる 36px
   - 余白を含めて約 250px を固定部分が取り、一覧には 93px しか残らない。
   - `@media (max-height:480px)`（`src/styles/main.css:1660-1675`）は余白を詰めるだけで、並び方は変えていない。
2. **前回の文字の改善（UI-002-F の F-D3）は「下限」を決めただけ**（FACT）
   - トークンは本文 12px・補助 11px（`src/styles/tokens.css:127-128`）。品名は 12px、武器種・能力値は 11px と、下限そのものの大きさで出ている。
   - 文字を拡大・縮小する仕組みは無い（`<meta viewport>` は `width=device-width, initial-scale=1`、`zoom` や `scale` の指定も無い）。
   - そのため、CSS の 12px は iPhone でも 12px になる。
   - **INFERENCE**: iPhone の横持ち（CSS 幅 844px）では、12px の品名と 11px の補助表示は実寸でかなり小さい。今の構成のまま文字だけを大きくすると、一覧はさらに狭くなる（1 行も見えなくなる）。実機で効かなかった理由はここにある。
3. **一覧に全部位が混ざっている**（FACT）
   - `renderGearPanel`（`src/legacy/parts/12-progression-ui.js:2725-`）は、所持品の全部を 1 つの一覧に並べる。並び順は、装備中 → 鑑定済み → 部位 → 強さ。
   - 先頭の行は装備中の品で、上の装備枠と同じ内容になる。
   - 「武器を選ぶ」ときにも、上半身・下半身の行が間に挟まる。
4. **既知の課題として残っていた**（FACT）
   - `.ai/reports/UI-002-F-impl-report.md:61` に、「844×390 の鍛冶屋で、所持品の一覧が 2 行前後しか見えない。実機で十分か」と記録されている。

## 3. 既存の仕組み（Existing System First の調査）

| 探したもの | 結果 |
| --- | --- |
| 装備画面の描画 | `renderGearPanel()`（`12-progression-ui.js`）。`innerHTML` で毎回作り直し、`data-unequip` / `data-equip-idx` / `data-sell-idx` / `data-identify-idx`、`#gear-best-btn`・`#gear-sell-all-btn`・`#gear-identify-all-btn` にイベントを付ける |
| 部位を選ぶ仕組み | **無い**（検索語 `gearSlot` / `data-gear-slot` / `slotFilter` を `src` で検索して 0 件） |
| パッドの操作 | `GP_NAV_SELECTOR`（`10-input.js:265`）は `button:not([disabled])`・`.ap-tab` などを順に辿る。部位の選択を `<button>` にすれば、そのまま辿れる |
| 文字・タッチのトークン | `--ui-fs-body: 12px`、`--ui-fs-small: 11px`、`--ui-touch-min: 36px`（`tokens.css`） |
| 背の低い画面の詰め | `@media (max-height:480px)`（`main.css:1660-1675`） |
| 画面サイズのテスト | `tests/menu-character-layout.spec.js`（1280×800 と 844×390。見出し・タブ・装備枠・道具・閉じるが画面内、一覧だけがスクロール、文字 11px 以上、タッチ 36px 以上） |

## 4. 変更が影響する既存のテスト

| テスト | 依存しているもの | 影響 |
| --- | --- | --- |
| `menu-character-layout.spec.js` | `.gear-slot-row` が画面内にあること、装備枠の高さ 80px 以下、一覧だけがスクロールすること | 構成を変えるので、新しい構成の確認に書き換える |
| `chapter1-smith-shop.spec.js` | 武器の装備・外す、外套（上半身）の行の売却 | 部位で一覧を絞るなら、上半身を選んでから外套の行を探す |
| `chapter1-legacy-ui.spec.js` | 未鑑定の品（上半身）の行が 1 件あること、凡例の文言 | 同上 |
| `chapter1-facility-access.spec.js` | パネルに「古びた杖」があること | 武器が最初に選ばれていれば影響なし |
| `character-weapon-visual.spec.js` | `[data-equip-idx="0"]`（武器） | 同上 |
| `tests/unit/chapter1-smith-shop.test.js` | `renderGearPanel` の本体の文字列（`data-unequip=` など） | 文字列を残せば影響なし |

## 5. 制約

- 装備・外す・最強装備・売却・まとめて売却・鑑定（テストモード）・スキルのタブの動作は変えない。
- 装備のデータ、表示の条件（装備可・装備できない・装備中・Lv 不足）、セーブの形式、既存の ID は変えない。
- `basefile.html` と legacy の連結構造を変えない。対象は鍛冶屋の装備品タブだけ（メニューなど他の画面には広げない）。
- 文字を縮めて詰め込まない。本文 12px 以上、補助 11px 以上、主な操作 36px 以上（目標 44px）。
