# UI-002-F Analysis — Menu / Character UI（世界観の統一）

| 項目 | 値 |
| --- | --- |
| Task | UI-002-F（Menu / Character UI。Status: DRAFT） |
| Phase | Analyzer（コード・テスト・仕様の変更なし） |
| 基準 | `main` `9e30e64`（#67 まで） |
| 日付 | 2026-10-09 |
| 前提資料 | `.ai/tasks/UI-002-F.md` / `UI-002-V.md` / `UI-002-C2.md` / `UI-002-E.md`、`.ai/decisions/UI-002-human-decisions.md`、`.ai/reports/UI-002-F-decision-audit.md` / `UI-002-F-re-audit.md`、`src/styles/tokens.css` / `main.css` / `ui-proto.css`、`index.html`、`src/legacy/parts/10-input.js` / `12-progression-ui.js` / `14-hud-boot.js` / `15-ui-proto.js`、`src/core/ui-icons.js` / `ui-proto-icons.js` |

FACT = コード・記録・撮影で確認 / INFERENCE = 推定（実機では未確認）/ DECISION = Human の判断が必要。

---

## 1. 結論（要約）

- 対象の画面は **2 つだけ**: ①メニュー（`#menu-overlay`。キャラクター情報・所持金・設定・操作説明・セーブ等を 1 枚に縦積み）②鍛冶屋（`#appraisal-overlay`。本編は「装備品」「スキル」の 2 タブ）。独立した「キャラクター画面」「ステータス画面」は無い（FACT）。
- 機能面（Chapter 1 の境界）は PROGRESSION-001〜010 でほぼ整っている。残る問題は **見た目と情報設計**:
  1. **世界観**: 全体が「暗い紫寄りの夜色＋オレンジのグラデーション＋細い 1px 線＋背景ぼかし」。HUD の C2 視覚文法（matte・厚い輪郭・小さな内縁・控えめな落ち影）と別の言語で、V-1 / V-2 の「古書・革・木・金属」「厚い輪郭」「blur 禁止」に合っていない。
  2. **Emoji 依存**: メニュー・鍛冶屋の意味表示の大半が Emoji（⚔️🎽👖🪄🧥⚙️🪙💾☄️👣 ほか）。V-5 は新規 UI アイコンに Emoji を使わないとしている。
  3. **844×390 でスクロール過多**: メニューは中身 1204px に対して見える高さ 341px（**3.5 画面分**）。鍛冶屋の装備品タブは 606px に対して 341px（約 1.8 画面）。最も使う「冒険に戻る」「セーブ」がメニューの最下部。
  4. **情報の混在**: メニューに「キャラクター情報」「設定 11 項目」「操作説明 14 行（テキスト）」「コントローラーの注意書き」「セーブ・撤退・タイトル」が 1 列で並ぶ。文字依存が強い（V-4 に反する）。
- 再利用できる基盤: C1 の token（`tokens.css`）・パネルの共通 selector（`.cc-frame, .menu-box, .event-box, .appraisal-box`）、C2 の視覚文法（`ui-proto.css` のプレート・輪郭・状態表現）、E の承認済み glyph 4 つ（剣士だけ）。**メニュー・鍛冶屋で新しく使えるゲーム固有アイコンはほぼ無い**（§7）。

---

## 2. 画面の現状（FACT）

撮影条件: Playwright Chromium 141（`/opt/pw-browsers/chromium`、SwiftShader）、`deviceScaleFactor: 1`、本編の加入後セーブ（魔法使い＋支援 剣士、`smithJoined: true`、外套 1 着を所持）。1280×800（PC）と 844×390（`hasTouch`）。撮影は scratchpad に保存（commit しない）。
**注意**: この環境では Google Fonts（Cinzel / Noto Serif JP / Noto Sans JP）が読み込めず、OS の代替フォントで撮れている（`document.fonts` に読み込み済みのものが 0）。実機では書体が異なる。

### 2-1. メニュー（`#menu-overlay` / `.menu-box`、`index.html` 221〜315、`main.css` 1012〜1046、`10-input.js` `refreshMenuStats`）

| 区画 | 内容（本編） | 実装 |
| --- | --- | --- |
| 見出し | 「メニュー」（Cinzel 系 20px） | `.menu-title.display` |
| キャラクター情報 | 名前 / 職業 / HP / **MP** / 攻撃力 / 移動速度 / 必殺技（`☄️ メテオフォール`）。経験値の行は本編で非表示 | `.menu-stat-line` × 8（`#menu-xp` は `legacyGrowth()` で行ごと非表示） |
| 所持素材 | 🪙 100 のみ（💎 🔩 は本編で非表示）。見出しは「所持素材」 | `.menu-mats` |
| 設定 | 効果音 / 音楽 / 画面の揺れ / 影 / ヒットストップ / 明るさ / 画質 / ドット表現 / カメラ自動追従 / カメラ左右反転 / カメラの高さ（11 項目。ボタンを押すと値が順に切り替わる） | `.menu-setting-row` / `.menu-setting-btn#set-*` |
| 操作説明 | 14 行のテキスト（キーボード / パッド / タッチを 1 行に併記）＋コントローラーの注意書き | `.menu-controls`（インライン style あり） |
| ボタン | 冒険に戻る（primary）/ 💾 セーブ / 街に戻る / タイトルへ | `.menu-btn#menu-*`（`div`。`button` ではない） |
| バージョン | `ver -`（5 回叩くとデバッグモード） | `#menu-version` |

| 計測 | 1280×800 | 844×390 |
| --- | --- | --- |
| `.menu-box` の表示サイズ | 420×704 | 420×343 |
| 中身の高さ（scrollHeight） | 1204 | 1204 |
| スクロール量 | 約 1.7 画面 | **約 3.5 画面** |
| 最初に見える範囲 | キャラクター情報〜設定の途中 | キャラクター情報〜所持金まで |

### 2-2. 鍛冶屋（`#appraisal-overlay` / `.appraisal-box`、`index.html` 400〜476、`main.css` 1180〜1300 / 1390〜1420、`12-progression-ui.js` `refreshAppraisal` / `renderGearPanel` / `renderSkillPanel`）

| 区画 | 本編 | テストモード |
| --- | --- | --- |
| 見出し | 「鍛冶屋」＋ 🪙所持金 | 「鑑定所」＋ 🪙 💎 |
| タブ | 装備品 / スキル（`LEGACY_AP_TABS` で ステータス配分・奥義の環・商店を非表示） | 5 タブ |
| 装備品 | 装備枠 3 つ（⚔️武器 / 🎽上半身 / 👖下半身。名前・武器種タグ・性能・「外す」）、⚙️最強装備 / 🪙まとめて売却、凡例（装備可・装備できない・装備中）、所持品の一覧（Emoji・名前・性能・比較 ▲▼・装備する / 売却） | ＋一括鑑定・Lv 表示 |
| スキル | サブタブ スキル1 / スキル2 / 必殺技。各 1 枚の固定カード（Emoji・名前・説明文）。見出しに「(専用ボタン・固定)」 | ＋パッシブ・スキル3、付け替えカード |
| 閉じる | 「閉じる」ボタン（全幅） | 同じ |

| 計測 | 1280×800 | 844×390 |
| --- | --- | --- |
| `.appraisal-box` | 520×608 | 520×343 |
| 装備品タブの中身 | 606（スクロールなし） | 606（**約 1.8 画面**。装備枠と道具までで画面が埋まり、一覧は 1 行しか見えない） |
| スキルタブ | 341 | 341（スクロールなし） |

### 2-3. 入力（FACT）

| 操作 | PC | タッチ | パッド |
| --- | --- | --- | --- |
| メニューを開く / 閉じる | Esc / Tab（`09-save-load.js`） | HUD 左上の ☰ チップ（`#loot-menu-btn`）/ 「冒険に戻る」 | Start / Select（`13-update-loop.js`）/ B・○ で閉じる |
| 鍛冶屋を開く | 鍛冶士の前で I | インタラクト表示をタップ | 十字キー下 |
| 項目の移動・決定 | マウス | タップ | 十字キー・左スティックで **1 列の順送り**（`gpNavMove(±1)`、上下左右を区別しない）、A・× で決定、B・○ で戻る。対象は `button` / `.ap-tab` / `.menu-btn`（`GP_NAV_SELECTOR`）。**スキルのサブタブ（`div.skill-subtab`）は対象外でパッドから選べない**。フォーカスは `.gp-focused`（2px 輪郭＋ **10px の発光**） |
| スクロール | ホイール | `touch-action: pan-y` で縦スワイプ | フォーカス移動に追従（`scrollIntoView({block:'nearest'})`） |
| 鍛冶屋のタブ切り替え | クリック | タップ | 順送りの中にタブも含まれる（専用の L/R 切り替えは無い） |

---

## 3. 世界観（V-1〜V-7）との不一致

| # | 箇所 | 現状（FACT） | 合っていない方針 | 重さ |
| --- | --- | --- | --- | --- |
| M-1 | パネルの面 | 紫寄りの夜色のグラデーション（`#15111c → #100d16`）、1px の線 `#3a2f4a`、角丸 6px | V-1「古書・革装丁・木・金属」、V-2「厚い輪郭・小さな内縁」。HUD の C2 プレート（3px の輪郭＋2px の内縁＋落ち影 1 種）と別の言語 | **大** |
| M-2 | 背景 | `backdrop-filter: blur(3px)`（メニュー・鍛冶屋・結果画面とも） | V-2 は blur を禁止 | **大** |
| M-3 | 押せるもの・選択中 | オレンジの縦グラデーション（`var(--ember) → #9c5e2c`）。タブ・primary ボタン・Skill ボタンが同じ | V-2「excessive gradient」を避ける・大きな色面。V-7「Selected」の意味色を使っていない（`--ui-selected` は定義済みだが未参照） | 中 |
| M-4 | パッドのフォーカス | 2px 輪郭＋ **10px の発光**（`.gp-focused`） | V-2 / V-6「常時発光の禁止」 | 中 |
| M-5 | アイコン | Emoji（⚔️🎽👖🪄🧥⚙️🪙💾☄️👣 ほか。必殺技・技・職業のアイコンもゲームの定義の Emoji） | V-5「新規 UI アイコンに Emoji を使わない」。E は Emoji の表（`UI_ICONS`）を残したまま、正式 glyph は剣士の 4 つだけ | **大**（ただし新しい絵が要る → §7） |
| M-6 | 文字依存 | メニューの操作説明 14 行、スキルの説明文、凡例の色の小四角＋文字、ラベル「所持素材」 | V-4「形で意味が分かる。文字は補助」 | 中 |
| M-7 | 情報の重なり | 1 枚の縦長パネルに「キャラクター・お金・設定・操作説明・セーブ」が混在 | V-1「キャラクターと世界を主役に」、HD-4（844×390 で読みやすく） | **大** |
| M-8 | 書体 | 見出しだけ Cinzel 系、他は Noto Sans JP（細い）。文字サイズ 9〜13px が混在（鍛冶屋の 9〜9.5px が多い） | V-3「小さな画面でも判別可能」 | 中 |
| M-9 | ボタンの形 | `div` のボタン、角丸 4 / 5 / 6 / 16px が混在（`.ap-equip-btn` は 16px の丸み） | V-3 の統一された形・C2 の角丸（8px のプレート） | 小 |
| M-10 | 状態色 | 装備可 `#7ad08a` / できない `#c05a5a` / 装備中 `#e0b050` / レア `#b08aff` / 特殊 `#ff9a4a` が直書き | V-7 の意味色（Recovery・Danger・Selected・Special・Disabled）に乗っていない。色だけで意味を区別（V-6） | 中 |

**維持すべきもの**（世界観に合っている、または仕様）:
- 暗い背景に明るい文字という基本の明暗（ゲーム画面の上に重ねるため）
- ember（`#c9793f` / `#f0a05c`）を「選択・押せる」の色として使う考え方（C2 で `--ui-selected = --ember` と既に定義）
- gold `#c9a24b` を特別・金の意味で使う（`--ui-special`）
- Cinzel ＋ Noto Serif JP の見出し（古書・碑文の印象。V-1 に合う）
- 本編の情報量（PROGRESSION-001〜010 で絞り込み済み。増やさない）

---

## 4. Chapter 1 の制約との関係（FACT）

| 項目 | 現状 | F で変えないこと |
| --- | --- | --- |
| Level / XP / スフィア盤 / パッシブ / スキル3 / 商店 / ステータス配分 / 鑑定 | 本編で非表示（`legacyGrowth()`、`LEGACY_AP_TABS`、`skillSubTabAvailable`） | 表示条件はそのまま。デザインだけを変える |
| Skill 1 / Skill 2 / 必殺技 | 本編は固定のカード 1 枚ずつ（PROGRESSION-005 / 007 / 010） | 付け替えの UI を作らない |
| 鍛冶屋 | 加入前は無い（PROGRESSION-004）。加入後は「装備の管理・確認」（HD-2） | 役割を変えない |
| MP | メニューに「MP 90 / 90」が出ている。MP 廃止は決定（HD-D10）だが **別 Task**（HD-D29） | F で MP の行を消さない（別 Task の範囲）。デザインは行がある前提で作る |
| ゴールド | 使い道が無い（Undecided C-3）。見出しは「所持素材」 | 表示は残す。見出しの文言は §8 で整理 |
| Test Mode | 5 タブ・パッシブ・付け替えが出る | 同じ部品で崩れずに表示されること（テストモードは開発用。見た目の作り込みは本編を優先） |
| セーブ | 変更しない | — |

---

## 5. 既存の基盤と再利用の範囲

| 基盤 | 中身 | F での再利用 |
| --- | --- | --- |
| C1 token（`tokens.css`） | 文字色・線・面・書体・角丸・影・z-index・`--ui-panel-*` | **そのまま使う**。新しい値は C2 の流儀（既存値の再利用を優先、AP-C2-02）で最小限 |
| C2 意味色 | `--ui-selected` / `--ui-danger` / `--ui-recovery` / `--ui-special` / `--ui-disabled` / `--ui-outline` | 既存の直書きの色（§3 M-10）をここへ寄せる。**今は ui-proto.css しか参照していない** |
| C2 視覚文法（`ui-proto.css`） | プレート = 面＋3px 輪郭（`--ui-outline`）＋2px 内縁（`--ui-line`）＋落ち影 1 種。状態 = 形・塗り・進捗・overlay（色だけにしない）。常時発光なし | **メニュー・鍛冶屋のパネル・ボタン・タブの元にする**（同じ視覚言語、V 確定済み）。DOM はコピーしない（HD-D28 と同じ扱い） |
| E の正式 glyph（`UI_GLYPHS`） | `weapon.greatsword` / `attack.greatsword` / `skill.warrior.retreat` / `skill.warrior.crushSlash` の 4 つ（inline SVG、24×24）。描画は `setGlyphOrText()`（`14-hud-boot.js`） | 剣士の武器・Skill 1 / 2 のカードで使える。他の職業・装備枠・道具には **使える絵が無い**（§7） |
| E の Emoji 表（`UI_ICONS`） | 意味名 → 現在の Emoji の対応 | 置き換え先の一覧として使う（意味名は既にある） |
| 共通のパネル selector | `.cc-frame, .menu-box, .event-box, .appraisal-box` | パネルの見た目を変えると **結果画面・出撃画面（`.event-box` / `.appraisal-box` を共有）にも及ぶ**（§9） |

---

## 6. 1280×800 と 844×390 の問題点

| # | 画面 | 1280×800 | 844×390 |
| --- | --- | --- | --- |
| R-1 | メニュー | 1 画面に収まらない（設定の途中で切れる）。中央に 420px の細い柱。左右が空く | **3.5 画面分のスクロール**。開いた直後に見えるのはキャラクター情報だけ。「冒険に戻る」は一番下 |
| R-2 | 鍛冶屋・装備品 | 収まる | 1.8 画面。装備枠（3 枚の縦長カード）と道具で画面が埋まり、所持品は 1 行しか見えない |
| R-3 | 鍛冶屋・スキル | 余白が多い（固定カード 1 枚） | 収まる |
| R-4 | 文字 | 9〜9.5px の補助文字（性能・凡例・説明）が多い | 同じ値のまま（縮小は無い）。読める大きさの下限に近い（INFERENCE。実機未確認） |
| R-5 | 横長の活用 | 未使用（縦 1 列） | 横長の画面で縦スクロールになっている |
| R-6 | タッチの的 | — | 設定ボタン 76×26px、`.gear-item-btn` 約 28px の高さ。指には小さい（INFERENCE） |
| R-7 | safe-area | パネルは中央配置で影響なし | 同じ（パネル幅 420 / 520 < 844 − 両側の inset） |

---

## 7. 実装済み / 未実装 / 仕様未決定

| 区分 | 項目 |
| --- | --- |
| **実装済み** | Chapter 1 の表示条件（成長要素・商店・鑑定を出さない）、鍛冶屋の役割（HD-2）、Skill 1 固定、C1 token、C2 視覚文法（Prototype として）、E の剣士 glyph 4 つ（HUD に適用済み） |
| **未実装** | メニュー・鍛冶屋への C2 視覚文法の適用、意味色（`--ui-selected` 等）の参照、Emoji から正式 glyph への置き換え（剣士以外は絵が無い）、メニューの区画分け、パッドの 2 次元移動 |
| **仕様未決定（Undecided）** | 設定項目の取捨、通知履歴、施設 UI、パッド表記、影の旅人専用 HUD・技仕様（HDE-E14）、ゴールドの使い道（C-3）、MP 廃止の実施（別 Task） |
| **Human の判断が要る（F の範囲）** | §8 |

アイコンについて（FACT）: メニュー・鍛冶屋で必要な意味（装備枠 3 種・最強装備・売却・セーブ・設定・閉じる・戻る・所持金・HP・攻撃力・移動速度）に、承認済みのゲーム固有 glyph は **1 つも無い**。C2 の仮アイコン（`ui-proto-icons.js`: portrait / hp / attack / skill1 / skill2 / ultimate / heal / board / close）は Prototype 用で、正式採用は E の判断（AP-C2-06、HDE-3）。

---

## 8. Human の判断が必要な事項（候補。Planner で選択肢と推奨を示す）

| ID | 内容 | なぜ決められないか |
| --- | --- | --- |
| F-D1 | メニューの区画分け（タブで分けるか、1 枚のまま整えるか） | 画面構成の変更は Human の承認事項（指示 §2 の禁止事項「画面構成を勝手に確定しない」） |
| F-D2 | パネルの素材感の具体（革・羊皮紙・木・金属のどれを主にするか、どの程度か） | V-1 は方向（古書・革装丁型＋トゥーン・プレート型）までで、値は未決定 |
| F-D3 | 新しい色・寸法の値 | AP-C2-02 / 05: 既存値を優先、新規値は Human が実画面で判断 |
| F-D4 | アイコン: Emoji を正式 glyph に置き換えるか（E の追加作業）、F では形のプレート＋文字に留めるか | 正式 glyph の追加は E の承認範囲（HDE-E*）。F で新しい絵を作ると E の決定を先取りする |
| F-D5 | 操作説明（14 行）の扱い | 設定項目と同じく Undecided に近い（情報の取捨）。消す・畳む・別区画 |
| F-D6 | 「所持素材」という見出し（本編では金だけ） | 文言の変更（UI-002-A の前例では Planner が候補を出し Human が選ぶ） |
| F-D7 | パッドの 2 次元移動（タブを LB/RB で切り替える等） | パッド表記は Undecided。操作仕様の追加になる |
| F-D8 | 共通のパネル selector を共有する結果画面（H）・出撃画面（G）へ見た目が及ぶことを許すか | H / G の範囲に触れる |

---

## 9. 既存 DOM・テストへの影響（FACT: tests を grep）

メニュー・鍛冶屋の id / class を参照する E2E / unit: **26 ファイル**（`helpers.js` を含む）。主なもの:

| 参照 | spec |
| --- | --- |
| `#menu-overlay` の開閉・`#menu-save` / `#menu-town` / `#menu-title` / `#menu-resume` | `save-load`、`chapter1-smith-shop`、`notifications`、`helpers.js`、`mansion-scenario`、`mansion-escort` |
| `.menu-stat-line` / `#menu-xp` / `#menu-gem` 等の表示条件 | `chapter1-legacy-ui`、`chapter1-old-save-growth` |
| `#set-*`（設定ボタン） | `settings`（ドット表現の切り替え） |
| `#menu-version`（5 回でデバッグ） | `perf-diagnostic`、`dev-ui-gate` |
| `.ap-tab[data-tab]` / `.ap-panel` / `.gear-slot` / `.gear-item-row` / `[data-equip-idx]` / `[data-sell-idx]` / `[data-unequip]` / `[data-skill-subtab]` / `.ap-charge-title` / `.ap-charge-card` / `[data-variant]` | `chapter1-smith-shop`、`chapter1-facility-access`、`chapter1-skill2`、`chapter1-old-save-growth`、`character-weapon-visual`、`combat-test-arena` |
| `#appraisal-overlay .appraisal-title` の文言（「鍛冶屋」） | `chapter1-smith-shop` |
| computed style の固定（色・枠・角丸・影・文字・重なり順） | **`ui-foundation`**（C1 で「token 化の前後で見た目が同じ」を確かめる spec。見た目を変えると必ず失敗する） |
| `.gp-focused` | 参照する spec は無い（grep 0 件） |

- 見た目だけを変え、**id・`data-*`・文言・表示条件を変えなければ**、影響は `ui-foundation`（computed style の固定値）に限られる見込み（INFERENCE）。
- 区画分け（F-D1）でメニューの DOM 構造を変える場合、`#menu-*` の id を残せば多くの spec は通る。開いた直後に見えない区画のボタンを押す spec（`#menu-save` を押す `chapter1-smith-shop` 等）は、区画の切り替えが要るなら修正が要る。

---

## 10. 依存関係（他 Task）

| Task | 関係 |
| --- | --- |
| UI-002-H（会話・通知・結果画面） | `.event-box` / `.event-overlay`（blur・パネル）を共有。F でパネルの共通部分を変えると結果画面の見た目も変わる |
| UI-002-G（酒場・施設） | 出撃画面（`#scenario-overlay`）が `.appraisal-box` / `.appraisal-header` / `.ap-close-btn` を共有。鍛冶屋の「施設 UI」は Undecided |
| UI-002-E（アイコン） | 正式 glyph の追加は E の範囲。F は「アイコンの入る場所（プレート）」を用意し、絵は E の承認待ち |
| UI-002-D（HUD） | HUD の ☰ チップ（メニューの入口）は D の範囲。F はメニューの中だけ |
| UI-002-I（統合） | F の後 |
| MP 廃止（別 Task、HD-D29） | メニューの MP の行は、その Task が消す |

---

## 11. Autonomy Metrics（Analyzer）
- Human Escalation Count: 0（判断事項は §8 として Planner へ）
- Human Decision Count: 0
- Auto Fix Count: 0
- Test Retries: 0（撮影用の一時 spec 2 本: 2 passed、commit しない）
