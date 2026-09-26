# UI-002-A Analysis

Analysis: Analyzer（READ ONLY。source・tests・docs・package・config・Task file・Decision record を変更していない）/ 2026-09-26 / Claude Code セッション

## 1. Task identity

| 項目 | 値 |
| --- | --- |
| Task ID | UI-002-A |
| Title | Chapter 1 仕様との UI 不整合解消 |
| 本工程 | Analyzer（READ ONLY） |
| 目的 | Chapter 1 本編に現在表示されている UI のうち、Chapter 1 の現在仕様と一致しないものを事実ベースで特定する |
| 前提の Human Decision | HD-1（旧成長系 UI を本編に表示しない。漏れている UI は本 Task で調査）、HD-2（Skill 3 を本編 HUD から外す。Skill 1 / Skill 2 / Ult が基本）。いずれも **再判断しない** |

分類ラベル: **FACT**（コード・DOM・実行結果・既存仕様から直接確認）/ **INFERENCE**（FACT からの推測。仕様として未確定）/ **HUMAN DECISION**（人間が決めないと確定しない）。

用語:

| 記号 | 意味 |
| --- | --- |
| A Code | 処理・定義がソースに存在する |
| B DOM | 要素が index.html または JS 生成で DOM に存在する |
| C Main | 本編（`state.testMode === false`）で **表示される** |
| D Test | テストモードで表示される |
| E Reach | Chapter 1 本編の通常プレイで実際に到達・目視できる |
| F Spec | Chapter 1 仕様上必要か（docs / Decision record） |

---

## 2. Analyzer baseline

| 項目 | 値 |
| --- | --- |
| `git fetch origin` 後の origin/main HEAD | `70b6ee36859b049d3749766dcefed73bedff06f2` |
| Analyzer ブランチ | `claude/ui-002-a-analysis`（起点 = `origin/claude/ui-002-task-planning` @ `589d28becea1c8da4e0f4f4d36cb078df04e5205`） |
| 起点と origin/main の差 | `.ai/tasks/UI-002-*.md` と `.ai/decisions/UI-002-human-decisions.md` のみ。`src/` `tests/` `index.html` は origin/main と同一（`git diff --stat origin/main HEAD -- src tests index.html` が空） |
| working tree（開始時） | clean |
| 実行確認 | Vite dev server＋Chromium（SwiftShader）1280×800 で DOM プローブを実施（§5〜§7 の「実行確認」）。撮影画像・スクリプトはリポジトリに置いていない |

## 3. Artifact handoff

### 3.1 参照した入力

| 資料 | branch | commit | blob | 読み方 |
| --- | --- | --- | --- | --- |
| UI-001 Analyzer report `.ai/reports/UI-001-analysis.md` | `claude/ui-001-analysis-380kl5` | `4830a3804ea0874ae803b951c01dabaad68cfe88` | `c976f1c3b3e0a0b089e6b7eacde2b39f6f07b10a` | `git show <commit>:<path>`（本ブランチへコピーしていない） |
| UI-002 Planner report `.ai/reports/UI-002-plan.md` | `claude/ui-002-planner` | `eadb5e3cac983cf90911610d6da3deadc0af34a5` | `a23563e8c481e97c9b01fd063407c357c8c7668e` | 同上 |
| Decision record `.ai/decisions/UI-002-human-decisions.md` | `claude/ui-002-task-planning`（本ブランチの起点に含まれる） | `589d28be…` | — | 作業ツリー |
| Task file `.ai/tasks/UI-002-A.md` | 同上 | `589d28be…` | — | 作業ツリー |

### 3.2 Artifact Handoff 規則（AGENTS.md §5.2）との関係

- **FACT**: 上記 2 report は main に存在しない。どちらも Human の明示指示を受けて AI セッションが push したもので、§5.2 の「Persistence は Human が行う（Persisted by: Human）」とは異なる。
- **FACT**: UI-002-A Task file の `Analysis:` 行は「未作成」で、UI-001 / UI-002 report は `References` 節に branch @ commit・blob 付きで記載されている（Task の `Analysis:` 行としての Handoff ではない）。
- 本 report は §5.2 の Handoff 検証を **Task の Analysis としては行っていない**（本工程は UI-002-A 自身の Analyzer であり、入力 report は参照資料）。参照時の同一性確認として blob を記録した。
- 本 report 自体の Handoff（Planner へ渡す時の Source SHA・blob）は §21 の報告後に確定する。Persistence は今回も Human の指示で AI が push する。

### 3.3 Analyzer identity

本 report は、UI-001 Analyzer / UI-002 Planner / Task Planning を実施したものと **同一セッション** の AI が作成した（役割の兼務。AGENTS.md §5「役割ごとの成果物と Gate は省略しない」）。

---

## 4. Chapter 1 relevant specification

| # | 仕様 | 出典 | 区分 |
| --- | --- | --- | --- |
| S-1 | Chapter 1 本編にはレベルが無い。経験値・レベルアップ・レベル表示・推奨レベルでの出撃制限・攻撃 Tier・レベル50転身・振り分け・パッシブ・奥義の環・武具強化・ランダム装備ドロップは本編では動かない | docs/PROGRESSION.md「決定（WORK 12.1）」 | 確定 |
| S-2 | ステータスは「クラスの基礎値＋装備」だけ。成長は主人公の交代と Skill 2 の閃き | 同上 | 確定 |
| S-3 | 仕組みは Chapter 2 の基盤として残し、テストモードだけで動く。判定は `legacyGrowthEnabled()` 一か所 | 同上、`src/core/chapter1-rules.js:22` | 確定 |
| S-4 | 武器はクラスの武器種だけ装備できる | docs/PROGRESSION.md、`weaponUsableBy()` | 確定 |
| S-5 | 主人公は Skill 1 だけを持って酒場を出る。Skill 2 はダンジョン中盤で閃く。必殺技は別枠 | docs/COMBAT.md:77〜89 | 確定 |
| S-6 | Chapter 1 本編に旧成長系 UI（XP / Level / Skill 3 / Sphere Board / その他未解放の成長 UI）を表示しない | Decision record HD-1 | Human Decision |
| S-7 | Skill 3 を本編 HUD から外す。構成は Skill 1 / Skill 2 / Ult が基本 | Decision record HD-2 | Human Decision |
| S-8 | スフィア盤・育成施設・エンドダンジョンはメインシナリオクリア後に解放 | docs/PROGRESSION.md「Post-Clear」 | 確定（UI は未決定: Decision record Undecided） |
| S-9 | docs/README.md D-02 は「奥義の環は鑑定所のタブから常時振れる」と記述 | docs/README.md:84〜91 | **実装と不一致**（§8、§19 G-12） |

---

## 5. XP findings

| UI | A Code | B DOM | C Main | D Test | E Reach | F Spec |
| --- | --- | --- | --- | --- | --- | --- |
| HUD XP バー `.bar-track.xp` / `#xp-fill` | `updateHUD()` 14-hud-boot.js:368 が毎フレーム幅を更新。表示条件の分岐なし | index.html:96 | **表示**（実行確認: VISIBLE 170×4、幅 0%） | 表示 | **到達可**（常時） | 不要（S-1 / S-6） |
| メニュー「経験値」行 `#menu-xp` | `refreshMenuStats()` 10-input.js:359〜364、`legacyGrowth()` で行を `display:none` | index.html:214 | 非表示（実行確認: 行 display none） | 表示（`0 / 1510`） | 不可 | — |
| クリア結果「経験値」行 | `showBossResultScreen()` 12-progression-ui.js:1095、`legacy` のときだけ生成 | JS 生成 | 非表示（コード） | 表示 | 不可 | — |
| 撤退確認の「撤退ボーナス: XP+n」 | `menu-town` click 10-input.js:141〜152（`retreatBonusPreview()` 12:1278）。**分岐なし** | 確認ダイアログ（innerHTML） | **表示**（撃破数 > 0 のとき。コード） | 表示 | 到達可（ダンジョン内で撃破後にメニュー「街に戻る」） | 不要 |
| 撤退後トースト「🏳️ 撤退ボーナス: XP+n 🪙+n」 | `performRetreat()` 12:1287〜1294。**分岐なし**（`grantXP()` 自体は本編で何もしない） | トースト＋ログ | **表示**（撃破数 > 0。コード） | 表示 | 到達可 | 不要 |
| レベルアップポップ「⭐ Lv.n に上がった!」 | `spawnLevelUpPopup()` 12:1973。`grantXP()` 12:1856 が `!legacyGrowth()` で即 return するため本編では呼ばれない | JS 生成 | 非表示 | 表示 | 不可 | — |
| XP 加算 | `grantXP()`（呼び出し: 07-ai-combat.js:5352 / 5373、12:1290） | — | 加算されない | 加算 | — | — |

- **FACT**: 本編で XP を示す UI が残っているのは **HUD の XP バー** と **撤退ボーナスの「XP+」表記（確認ダイアログとトースト）** の 2 系統。
- **FACT**: 撤退の確認ダイアログとトーストは、本編で実際には XP が増えない（`grantXP()` が何もしない）のに「XP+n」と表示する。
- 撤退ボーナス文言の実画面は未撮影（UNCONFIRMED。コードの分岐なしは FACT）。

## 6. Level findings

| UI | A Code | B DOM | C Main | D Test | E Reach | F Spec |
| --- | --- | --- | --- | --- | --- | --- |
| HUD 名前行の「Lv.n」 | `refreshHudName()` 12:1851 `legacyGrowth()` で付加 | `#hud-name` | 非表示（実行確認: 「剣士」） | 表示（「剣士 Lv.50」） | 不可 | — |
| メニュー「職業」の「(Lv.n)」 | 10-input.js:349 | `#menu-class` | 非表示（実行確認） | 表示 | 不可 | — |
| 出撃画面「現在 Lv.n」 | `setOverlay('scenario')` 10-input.js:182〜186 で親ごと非表示 | `#scenario-char-level` | 非表示 | 表示 | 不可 | — |
| 装備一覧の「Lv.n」 | `renderGearPanel()` 12:2716 `legacyGrowth()` | JS 生成 | 非表示 | 表示 | 不可 | — |
| 装備ボタン「Lv不足」 | 12:2723 `legacyGrowth() && itemLevel > level` | JS 生成 | 非表示（本編は「扱えない」） | 表示 | 不可 | — |
| **装備タブの凡例「装備可 / Lv不足 / 装備中」** | 12:2687 **分岐なし** | JS 生成 | **表示**（UI-001 S10） | 表示 | **到達可**（鍛冶士 / 休憩地点） | 不要 |
| 装備行の色分け `lv-ok` / `lv-high`（赤・半透明） | 12:2709 `canEquipItem()` の結果で付与。**分岐なし**（本編の不可理由は武器種） | JS 生成 | 表示（装備不可品がある場合） | 表示 | 到達可（該当品を持つ場合） | 意味が「Lv不足」凡例と対応しない（§11） |
| まとめて売却の確認文「レベル未達で装備できない品は対象外」 | 12:2744 **分岐なし** | 確認ダイアログ | **表示**（売却対象がある場合） | 表示 | 到達可 | 不要 |
| クリア結果の「(Lv.n に上昇!)」・装備 Lv | 12:1095 / 1098 `legacy` | JS 生成 | 非表示 | 表示 | 不可 | — |
| 鑑定費用 `15 + itemLevel*3` | 12:2725 分岐なし（未鑑定品がある場合のみ） | JS 生成 | 未鑑定品があれば表示 | 表示 | §9 参照 | — |
| テストモード画面のレベルスライダー | index.html:72〜76 | あり | テストモード画面 | 表示 | 本編ではない（タイトルから到達可 → UI-002-B の範囲） | — |
| 奥義の環「(レベルアップ毎+1)」 | `renderSpherePanel()` | JS 生成（タブ非表示） | 非表示 | 表示 | 不可 | — |

- **FACT**: 本編で「Level」を示す文言が残っているのは、**装備タブの凡例「Lv不足」** と **まとめて売却の確認文「レベル未達」** の 2 箇所。レベル数値そのものは本編で表示されない（実行確認・コード）。

## 7. Skill 3 findings

| UI | A Code | B DOM | C Main | D Test | E Reach | F Spec |
| --- | --- | --- | --- | --- | --- | --- |
| **HUD ボタン `#btn-skill3`（👑）** | `updateCooldownRings()` 14:735〜742。本編 / テストの分岐なし | index.html:189〜191 | **表示**（実行確認: VISIBLE 46×46。PC は `gamepad-min` 規則で opacity 0.9 ―― `#btn-skill3.unequipped` の 0.4 より詳細度が高い main.css:755 / 802） | 表示 | **到達可**（常時） | **不要（HD-2）** |
| キー `U` | 09-save-load.js:334 `castBossSkill3()` | — | 有効 | 有効 | 到達可 | 不要 |
| パッド D-pad 左 | 13-update-loop.js:54 | — | 有効 | 有効 | 到達可 | 不要 |
| タッチ | 10-input.js:130 `bindTouchButton('btn-skill3', …)` | — | 有効 | 有効 | 到達可 | 不要 |
| 未装着時トースト「💥 スキル3が装着されていない(鑑定所で装着できます)」 | 11-combat-actions.js:1066 | トースト＋ログ | **表示**（実行確認: 本編で U 押下 → ログに表示） | 表示 | 到達可 | 不要。かつ本編の鑑定所には装着 UI が無い（下行） |
| 空中での警告「SKILL 3」 | 11:1065 `blockedInAir('SKILL 3')` | トースト | 表示（空中で押した場合。コード） | 表示 | 到達可 | 不要 |
| 操作ヒント「U スキル3」 | index.html:105（固定文言） | `#hud-hint` | **表示**（実行確認、PC） | 表示 | 到達可（PC） | 不要 |
| 鑑定所スキルタブ「スキル3」サブタブ | `LEGACY_SKILL_SUBTABS` 12:3078 | JS 生成 | 非表示 | 表示 | 不可 | — |
| スキル3の習得 | `learnBossActiveSkill()`。呼び出しはボス撃破の 3 択 `grantBossChoiceReward()` 12:1025 のみ。3 択パネルは本編で非表示（12:1122〜1123） | — | 習得経路なし | あり | 不可 | — |
| セーブ上の習得・装着 | `applySaveData()` 09:176〜177 で読み込み。`normalizeChapter1Load()` 14:1499 は **消去しない** | — | 旧セーブに装着データがあれば **本編で使用可能**（コード。実データでは未確認） | — | 条件付き | 不要 |

- **FACT**: 本編で Skill 3 は「HUD ボタン・キー / パッド / タッチ入力・未装着トースト・空中警告・操作ヒント」として存在する。本編で習得・装着する UI は無いため、新規プレイでは常に「未装着」状態で表示される。
- **FACT**: 未装着トーストは「鑑定所で装着できます」と案内するが、本編の鑑定所にスキル3の装着 UI は無い。
- **FACT（Skill 1 / 2 / Ult との関係）**:
  - Skill 1 = `#btn-charge`（L / Y / タッチ）。本編で表示（実行確認）。
  - Skill 2 = `#btn-skill2`（O / L2 / タッチ）。未習得の間 `.locked` で非表示（実行確認: 本編新規 hidden）、`hasSkill2()`（core/chapter1-skills.js:25）が判定。
  - Ult = `#btn-ult`（K / R2 / タッチ）。本編で表示。
  - Skill 3 = `#btn-skill3`。上記 3 つと別系統（`state.equippedBossActiveSkill` / `bossSkill3CD`）。
- **INFERENCE**: 旧セーブに `equippedBossActiveSkill` が残っている場合、本編でも Skill 3 が発動できる。HD-2 は HUD 表示の決定であり、入力・セーブデータの扱いは Planner / Human の判断が要る（§18 HD-A3）。

## 8. Sphere Board findings

| UI | A Code | B DOM | C Main | D Test | E Reach | F Spec |
| --- | --- | --- | --- | --- | --- | --- |
| 鑑定所タブ「奥義の環」`.ap-tab[data-tab="sphere"]` | `syncApTabsVisibility()` 12:2536（`LEGACY_AP_TABS` 12:2534）で `display:none` | index.html:398 | 非表示（UI-001 S10） | 表示（S21） | 不可 | 本編不要（S-6）。クリア後解放は仕様確定・UI 未決定（S-8） |
| 盤面 `#ap-panel-sphere` の中身 | `refreshAppraisal()` 12:2546 が本編でも毎回 `renderSpherePanel()` を呼んで生成 | JS 生成（非表示タブ内） | 非表示（DOM は生成される） | 表示 | 不可 | — |
| タブ切替（L1 / R1） | `cycleApTab()` 12:2871 が `apTabAvailable` で除外 | — | 選ばれない | 選べる | 不可 | — |
| 矢印キー / Enter 操作 | 09:344〜350 `sphereTabVisible()` が false なら素通り | — | 無効 | 有効 | 不可 | — |
| Arena「🎛 スキル / スフィア盤」 | 14-training-ground.js:92 | index.html:159 | 非表示（Arena はテストモードのみ） | 表示 | 不可（UI-002-B の範囲） | — |
| スキル説明の「(スフィア盤で解放)」 | 轟斬など `unlockKey:'skill1Alt'` の技。`renderSkillPanel()` 12:3187 が未解放なら一覧に出さない | JS 生成 | 非表示（新規） | 表示 | 不可 | — |
| スフィア点の加算 | `grantXP()` 内（本編では動かない） | — | 加算なし | 加算 | — | — |
| 解放済みノードの効果 | `sphereValue()` 12:917 に **`legacyGrowth()` 分岐なし**。呼び出し例 11:43〜44（射程・角度倍率） | — | 新規は `['root']` のみで効果なし。旧セーブの解放済みノードは本編でも効く（コード） | 効く | UI ではない | 範囲外（§22） |

- **FACT**: Sphere Board は「実装済み・DOM 生成あり・本編で非表示・本編で入口なし」。本編 UI への漏れは確認されなかった。
- **FACT**: docs/README.md D-02 の「鑑定所のタブから常時振れる」は、現在の実装（本編で非表示）と一致しない。

## 9. Appraisal findings

| UI | A Code | B DOM | C Main | D Test | E Reach | F Spec |
| --- | --- | --- | --- | --- | --- | --- |
| 画面名「鑑定所」 | index.html:390 | あり | 表示 | 表示 | 到達可 | 本編で「鑑定」は発生しない（下行）。名称の扱いは UI-002-G の HD-18 候補 |
| **「🔍 一括鑑定」ボタン** | `renderGearPanel()` 12:2686 **分岐なし** | JS 生成 | **表示**（UI-001 S10） | 表示 | **到達可** | 不要（未鑑定品が本編で発生しない） |
| 一括鑑定の結果トースト（「鑑定できる装備がない」等） | 12:2752〜2757 | トースト | 押下で表示 | 表示 | 到達可 | 不要 |
| 未鑑定品の行・「鑑定 🪙n」ボタン・「鑑定するまで効果は分からない」 | 12:2713〜2725 | JS 生成 | 未鑑定品を持つ場合のみ | 表示 | 新規プレイでは不可（下記） | 不要 |
| 未鑑定品の入手 | `maybeDropEquipmentAt()` 08:232 / `maybeGrantEquipmentInstant()` 08:248 が本編で return。ボスの固有装備は 12:1084 `legacy` のみ | — | 入手経路なし | あり | 旧セーブの所持品のみ | — |
| 「⚙️ 最強装備」「🪙 まとめて売却」 | 12:2685 / 2687 | JS 生成 | 表示 | 表示 | 到達可 | 装備・売却自体は本編に存在（装備は S-2 の構成要素）。要否は本 Task の範囲外 |
| レア色・特殊武器（⭐）の行 | 12:2709〜2720 | JS 生成 | 該当品を持つ場合のみ | 表示 | 新規では不可（特殊武器も `rollEquipment` 系の legacy ドロップ） | — |
| 鑑定所ヘッダの 🪙 / 💎 | index.html:391、`refreshAppraisal()` 12:2548〜2549 | あり | **表示**（UI-001 S10: 💎3） | 表示 | 到達可 | §12 |
| ステータス配分タブ | `LEGACY_AP_TABS` | index.html:396 / 404〜 | 非表示 | 表示 | 不可 | — |
| スキルタブ「パッシブ」サブタブ（能力の強化・闘気錬成等・ボス能力） | `LEGACY_SKILL_SUBTABS` | JS 生成 | 非表示 | 表示 | 不可 | — |
| スキルタブ「スキル2」サブタブ | `SKILL_SUBTABS` 12:3047、未習得時は「まだ二つめの戦い方を持っていない…」 | JS 生成 | **表示**（UI-001 S11） | 表示 | 到達可 | S-5 の「閃くまで存在しない」との関係は §18 HD-A5 |
| スキルタブ「スキル1」の選択肢（ダッシュ斬り / 切り下がり / 回転斬り / 剛絶の盾 等） | 12:3176〜3198 | JS 生成 | 表示・付け替え可（UI-001 S11） | 表示 | 到達可 | docs は「Skill 1 を最初から1つ持つ」。付け替えの可否は docs に記述なし（§19 G-10） |
| 武具強化（`renderEquipPanel()`） | 12:2574。`#ap-panel-equip` は index.html に無く即 return | なし | なし | なし | 不可 | — |

- **FACT**: 本編の鑑定所で、Chapter 1 に無い仕組み（鑑定・レベル）を示す UI が常に見えるのは **「🔍 一括鑑定」ボタン** と **凡例「Lv不足」**（§6）。
- **FACT**: 未鑑定品・レベル付き装備は本編では新たに入手できない。旧セーブの所持品があれば表示される。

## 10. Operation-guide findings

### 10.1 `#hud-hint`（index.html:105、PC のみ表示。タッチ端末では 14:1802 で非表示）

| 記述 | 実際の割り当て（FACT） | 本編との対応 |
| --- | --- | --- |
| WASD 移動 | 13-update-loop.js | 一致 |
| Space ジャンプ | 09:322 | 一致 |
| クリック(J) 攻撃 | 09:323 | 一致 |
| L スキル | 09:332 `skillInputDown()` | 一致 |
| O スキル2 | 09:333 | 一致（未習得時はボタン非表示だが記述は常時） |
| **U スキル3** | 09:334 | **HD-2 と不整合** |
| Shift 回避 | 09:339 | 一致 |
| K 必殺技 | 09:324 | 一致 |
| Q・E カメラ回転 | 13:22〜23 | 一致。ただし **E は処刑（09:330）にも割り当て**。処刑の記述なし |
| R インタラクト | 09:327 | 一致 |
| V 薬草 | 09:331 | 一致 |
| Esc メニュー | 09:317 | 一致（Tab も同じ動作、記述なし） |
| （記述なし） | I 鑑定所（09:325）/ F 出撃（09:326）/ `` ` `` デバッグ（09:335、UI-002-B の範囲） | — |

### 10.2 メニュー操作説明 `.menu-controls`（index.html:273〜291、常時表示）

| 記述 | 実際（FACT） | 状態 |
| --- | --- | --- |
| 移動 / ジャンプ / 攻撃 / 回避 | 一致 | — |
| 必殺技: K / R2・RT / 必殺ボタン(リチャージ制) | 必殺はゲージ制（`ultGauge`、14:732 付近のコメント「待ち時間ではなくゲージ充填率」） | **「リチャージ制」の表記が実装と異なる** |
| **溜め攻撃: L(長押し) / Y・△(長押し) / 溜めボタン(長押し・鑑定所でタイプ変更可)** | L / Y / `#btn-charge` は **Skill 1**（`skillInputDown()`）。HUD ヒントでは「L スキル」、鑑定所では「スキル1」と呼ぶ | **同じ入力の呼び名が 3 通り**（溜め攻撃 / スキル / スキル1） |
| カメラ回転: Q・E / 右スティック | 一致（E の兼用は §10.1） | — |
| **鑑定所(街の近くで): I / 十字キー下 / 鑑定ボタン** | I・十字キー下は有効（鍛冶士から 3m 以内のみ 12:2482〜2497）。**「鑑定ボタン」の DOM は存在しない**（`#btn-appraisal-touch` は main.css のみ） | 存在しない UI を案内 |
| **出撃メニュー(街で): F / 十字キー上 / 出撃ボタン** | F・十字キー上は有効（店主から 3m 以内のみ）。**「出撃ボタン」の DOM は存在しない**（`#btn-sortie-touch` は main.css のみ） | 存在しない UI を案内 |
| 扉を開ける・階段を使う: R / L1・LB / 画面下のメッセージをタップ | 一致（`#interact-btn`） | — |
| 薬草を使う: V / R1・RB / HUD左上の🧪をタップ | 一致 | — |
| 対話・手記を進める / メニューを閉じる | 一致 | — |
| （記述なし） | Skill 2（O / L2・LT / `#btn-skill2`）、処刑（E / R）、魔力の雫 🔷 のタップ、Skill 3（U / 十字キー左） | Skill 2・処刑の記述が無い |
| 注記「Backbone One 等…接続中は画面のタッチボタンが自動的に隠れます」 | `refreshTouchControls()` はパッド接続時に `gamepad-min`（スキル・必殺ボタンは残る） | 「隠れる」は一部のみ（INFERENCE: 文言が実挙動より広い） |

## 11. Other legacy-growth UI findings

| UI | A Code | C Main | E Reach | 判定 |
| --- | --- | --- | --- | --- |
| Passive（能力の強化・闘気錬成等） | `LEGACY_SKILL_SUBTABS` | 非表示 | 不可 | 漏れなし |
| Crafting / 武具強化 | `renderEquipPanel()` は DOM 不在で即 return、`EQUIP_COSTS` 12:1987 | 非表示 | 不可 | 漏れなし |
| Equipment tier（レア・特殊・固有装備・Item Level） | ドロップは本編で停止（08:232 / 248、12:1084） | 旧セーブ所持品のみ表示 | 条件付き | 表示ロジック自体は分岐なし（§9） |
| Character level | §6 | 非表示 | 不可 | 漏れなし（凡例・確認文を除く） |
| 上位職（転身） | `checkJobPromotion()` 12:1898 本編で return、`switchProtagonist()` 14:1621 で `job=null` | 非表示 | 不可 | 漏れなし |
| 攻撃 Tier | `attackTier()` 11:24 本編で 0 | — | — | UI なし |
| Growth facility | 実装なし（UI-001 §12） | — | — | NOT IMPLEMENTED |
| Skill unlock（Skill 2 の閃き） | `grantChapter1Skill2()` 12:2316、`hasSkill2()` | 表示（本編仕様そのもの） | 到達可 | 仕様どおり |
| Stat upgrade（ステ振り） | `LEGACY_AP_TABS`、結果画面は 12:1127 `legacy` | 非表示 | 不可 | 漏れなし |
| ボス撃破の 3 択報酬 | 12:1122〜1123 | 非表示 | 不可 | 漏れなし |
| 「🏅 初制覇! 習得の証」 | `grantFirstClearRank()` 12:2108 本編で false | 非表示 | 不可 | 漏れなし |
| 周回★・討伐回数・分岐踏破・「次回から敵が強くなる」 | 12:1100〜1114 `!noReturn`（本編シナリオは非表示） | 非表示（本編シナリオ） | 不可（出撃画面は本編シナリオのみ提示 `offeredScenarios()`） | 漏れなし |
| 周回制限時間 | `scenarioTimeLimitFor()` 12:1582（再挑戦時のみ） | 非表示（本編は再挑戦しない） | 不可 | 漏れなし |
| **武器バッジ `#weapon-badge`** | `updateWeaponBadge()` 14:353。分岐なし | **表示**（実行確認: VISIBLE 18×18「🗡️」、所持品チップに隠れる） | 到達可 | サブ武器は本編で使わない（S-4、`weaponUsableBy` の `allowAlt` は legacy のみ）。主武器 / サブ武器の区別を示す UI（`.secondary` 色）が本編で意味を持たない（INFERENCE） |
| ボス能力（常時パッシブ） | 習得は 3 択（本編非表示）。効果 `bossAbilityValue()` は分岐なし | 表示 UI なし（パッシブタブ非表示） | 不可 | UI 漏れなし（旧セーブの効果は §22） |

## 12. 💎 / 🔩 findings

| 項目 | 💎 魔宝石 `gem` | 🔩 武具の欠片 `shard` |
| --- | --- | --- |
| 通常ドロップ（`pickLoot()` 08:24） | 本編では重み 0（`LEGACY_LOOT_TYPES` 08:23） | 同左 |
| **宝箱（`rollCommonChestLoot()` 08:762〜772）** | **本編でも入手（分岐なし）**。55% の確率で 💎 または 🔩 を 1〜2、トースト「💎 魔宝石を手に入れた!」 | 同左「🔩 武具の欠片を手に入れた!」 |
| **ボス撃破報酬（`rewardLoot` type `gem`）** | **本編でも入手**。`showBossResultScreen()` 12:1090 `addItem(loot)`。全ボスの `rewardLoot` が `type:'gem'`（06:4339、07:448/475/500/528/556、14-dungeon-duskvillage.js:1285）。結果画面に「💎 主の袖飾り ×1」等 | — |
| 使い道（消費） | ランク上げ `payForRank()` 12:2021〜2023 と `SKILL_DEFS` 購入 12:3352 ―― どちらもパッシブサブタブ（本編非表示） | 武具強化 `renderEquipPanel()`（DOM 不在で到達不可） |
| 本編での使い道 | **無い**（コード上の消費箇所がすべて本編非表示） | **無い** |
| 表示: メニュー「所持素材」 | 表示（実行確認: `#menu-gem` VISIBLE） | 表示（`#menu-shard` VISIBLE） |
| 表示: 鑑定所ヘッダ | 表示（UI-001 S10） | 無し |
| 表示: 入手トースト / ログ | 表示 | 表示 |
| 表示: HUD | 無し | 無し |

- **FACT**: 本編で 💎・🔩 は **入手でき、表示され、使い道が無い**。
- **FACT**: ボス報酬の固有名（「主の袖飾り」等）は `type:'gem'` として 💎 の個数に加算される。名前付きの品としては保持されない（`addItem()` 08:441〜460 は `inventory[type]` を増やすだけ）。
- **INFERENCE**: ボス報酬の固有名は物語上の戦利品の意味を持つ可能性があり、💎 を単純に非表示にすると結果画面の戦利品行の扱いが変わる。

---

## 13. Main Mode / Test Mode matrix

`○` 表示 / `×` 非表示 / `△` 条件付き。E = Chapter 1 本編で到達可。

| UI | Code | DOM | Main | Test | Chapter 1 reachable | Spec status |
| --- | --- | --- | --- | --- | --- | --- |
| HUD XP バー | ○ | ○ | **○** | ○ | **○** | **不整合（HD-1）** |
| 撤退「XP+n」（確認・トースト） | ○ | ○ | **△**（撃破 > 0） | △ | **○** | **不整合（HD-1）** |
| メニュー経験値行 | ○ | ○ | × | ○ | × | 整合 |
| 結果画面 経験値 / Lv 上昇 | ○ | ○ | × | ○ | × | 整合 |
| レベルアップポップ | ○ | ○ | × | ○ | × | 整合 |
| HUD / メニュー / 出撃の Lv 表示 | ○ | ○ | × | ○ | × | 整合 |
| 装備一覧の Lv・「Lv不足」ボタン | ○ | ○ | × | ○ | × | 整合 |
| **装備タブ凡例「Lv不足」** | ○ | ○ | **○** | ○ | **○** | **不整合（HD-1）** |
| **まとめて売却確認「レベル未達」** | ○ | ○ | **△** | △ | **○** | **不整合（HD-1）** |
| 装備行の `lv-high` 色（本編は武器種不可） | ○ | ○ | △ | △ | △ | 凡例と意味がずれる（HD-A4） |
| **HUD Skill 3 ボタン** | ○ | ○ | **○** | ○ | **○** | **不整合（HD-2）** |
| Skill 3 入力（U / 十字キー左 / タップ） | ○ | — | **○** | ○ | **○** | HD-2 の範囲か要判断（HD-A3） |
| **Skill 3 未装着トースト（鑑定所案内）** | ○ | ○ | **△**（押下時） | △ | **○** | **不整合（HD-2）** |
| Skill 3 空中警告 | ○ | ○ | △ | △ | ○ | 不整合（HD-2） |
| Skill 3 サブタブ | ○ | ○ | × | ○ | × | 整合 |
| **`#hud-hint`「U スキル3」** | ○ | ○ | **○**（PC） | ○ | **○** | **不整合（HD-2）** |
| Sphere タブ・盤面 | ○ | ○（生成） | × | ○ | × | 整合（docs D-02 は不一致） |
| ステ配分タブ / パッシブ / 3 択 / 転身 / 習得の証 | ○ | ○ | × | ○ | × | 整合 |
| **「🔍 一括鑑定」** | ○ | ○ | **○** | ○ | **○** | **不整合（HD-1「その他未解放の成長 UI」に該当するかは HD-A2）** |
| 未鑑定品の行・鑑定ボタン | ○ | ○ | △（旧セーブ） | ○ | △ | 旧セーブのみ |
| 画面名「鑑定所」 | ○ | ○ | ○ | ○ | ○ | 名称（UI-002-G） |
| **💎 / 🔩 の入手・表示** | ○ | ○ | **○** | ○ | **○** | **使い道なし（HD-A1）** |
| 武器バッジ | ○ | ○ | ○（被覆） | ○ | ○ | Chapter 1 で意味が薄い（HD-A6） |
| スキル2サブタブ（未習得時の説明文） | ○ | ○ | ○ | ○ | ○ | HD-A5 |
| Skill 1 の付け替え | ○ | ○ | ○ | ○ | ○ | docs に記述なし（G-10） |
| メニュー操作説明の「鑑定ボタン」「出撃ボタン」 | ○ | ○ | **○** | ○ | **○** | **存在しない UI の案内** |
| メニュー操作説明「溜め攻撃」「リチャージ制」 | ○ | ○ | ○ | ○ | ○ | 実装と呼称が不一致 |
| テストモード入口・`ver` 連打・`` ` `` | ○ | ○ | ○ | — | ○ | UI-002-B の範囲 |

## 14. DOM / code location

### 14.1 表示可否の判定の所在（FACT）

- 判定の元は 1 つ: `legacyGrowthEnabled(testMode)`（`src/core/chapter1-rules.js:22`、`!!testMode` を返す）。legacy 側のラッパー `legacyGrowth()`（01-character-creation.js:126）。
- **呼び出しは 21 箇所に分散**（`grep "legacyGrowth()" src/legacy/parts/*.js`）。UI に関わるもの:

| 場所 | 対象 |
| --- | --- |
| 10-input.js:185 | 出撃画面の Lv |
| 10-input.js:349 / 363 | メニューの職業 Lv / 経験値行 |
| 12-progression-ui.js:1081 | 結果画面（経験値・固有装備・3 択・ステ振り） |
| 12:1851 | HUD 名前行の Lv |
| 12:2535 `apTabAvailable()` | 鑑定所タブ（`LEGACY_AP_TABS = ['stat','sphere']`） |
| 12:2716 / 2723 | 装備一覧の Lv・「Lv不足」 |
| 12:3079 `skillSubTabAvailable()` | スキルサブタブ（`LEGACY_SKILL_SUBTABS = ['passive','skill3']`） |

- 挙動側（UI ではないが表示に影響）: 08:26（ドロップ種別）/ 232 / 248（装備ドロップ）/ 335・338（装備可否）、11:24（攻撃 Tier）、12:1769（ステータス計算）/ 1858（XP）/ 1898（転身）/ 2108（習得の証）、14:1621（交代時の job）。
- **判定を通らない UI**（本編漏れの原因）: `updateHUD()` の XP バー、`updateCooldownRings()` の Skill 3、`index.html` の固定文言（`#hud-hint`・`.menu-controls`）、`renderGearPanel()` の一括鑑定・凡例、売却確認文、撤退ボーナス文言、宝箱・ボス報酬の 💎🔩、`updateWeaponBadge()`。
- `src/core/` の成長関連判定: `chapter1-rules.js`（`legacyGrowthEnabled` / `weaponUsableBy` / `defaultSkill1For` / `hudLabel`）、`chapter1-skills.js`（`hasSkill2` / `loadedSkill2Flag` / `learnSkill2` / `canChangeLoadout`）、`chapter1-progress.js`（`offeredScenarios` / `isMainline` / `chapter1Complete` ほか）。UI の表示可否を表として持つモジュールは **存在しない**（UI-002 Planner の提案は未実装）。

### 14.2 不整合 UI の所在一覧

| # | UI | DOM | 生成 / 更新 |
| --- | --- | --- | --- |
| L-1 | XP バー | index.html:96 `.bar-track.xp` / `#xp-fill` | 14-hud-boot.js:368 `updateHUD()` |
| L-2 | 撤退「XP+」 | `#confirm-text`（innerHTML）/ トースト | 10-input.js:141〜152、12-progression-ui.js:1287〜1294 |
| L-3 | 凡例「Lv不足」 | `#ap-panel-gear` 内 `.gear-legend` | 12:2687 `renderGearPanel()` |
| L-4 | 売却確認「レベル未達」 | `#confirm-text` | 12:2744 |
| L-5 | Skill 3 ボタン | index.html:189〜191 `#btn-skill3` | 14:735〜742 `updateCooldownRings()`、10-input.js:130 |
| L-6 | Skill 3 入力 | — | 09:334、13-update-loop.js:54 |
| L-7 | Skill 3 トースト | トースト | 11-combat-actions.js:1065〜1066 |
| L-8 | `#hud-hint` | index.html:105 | 固定文言（14:1802 はタッチで非表示のみ） |
| L-9 | 一括鑑定 | `#gear-identify-all-btn` | 12:2686 / 2749〜2758 |
| L-10 | 💎🔩 表示 | `#menu-gem` `#menu-shard`（index.html:223〜224）、`#ap-gem`（index.html:391） | 10-input.js:356〜357、12:2549 |
| L-11 | 💎🔩 入手 | トースト | 08:762〜772、12:1090 |
| L-12 | メニュー操作説明 | index.html:273〜291 `.menu-controls` | 固定文言 |
| L-13 | 武器バッジ | index.html:86 `#weapon-badge` | 14:353 |

## 15. E2E dependencies

`tests/*.spec.js` / `tests/helpers.js` / `tests/unit/*.test.js` を `grep` で確認（テストは実行していない）。

| 変更候補 | 参照している spec / unit | 内容 | 影響 |
| --- | --- | --- | --- |
| XP バー（L-1） | なし（`xp-fill` の参照 0 件） | セーブ fixture の `xp` / `xpToNext` フィールドは 11 spec にあるが UI 参照ではない | 低 |
| 撤退確認（L-2） | `mansion-scenario.spec.js:179〜185` | `#menu-town` → `#confirm-overlay` の出現 → `#confirm-ok` クリック。**文言は見ていない** | 確認ダイアログを残す限り低 |
| 凡例・売却確認（L-3 / L-4） | なし（`Lv不足` `gear-lv` `lv-high` の参照 0 件） | — | 低 |
| Skill 3 ボタン・入力（L-5〜L-7） | なし（`btn-skill3` `skill3` の参照 0 件） | — | 低 |
| `#hud-hint`（L-8） | なし | — | 低 |
| 一括鑑定（L-9） | なし（`identify` の参照 0 件） | — | 低 |
| 💎🔩 表示（L-10） | UI 参照なし（`menu-gem` 等 0 件）。fixture の `gem` / `shard` は 11 spec | — | 低（入手処理を変える場合は fixture 側と無関係か要確認） |
| メニュー操作説明（L-12） | なし（`menu-controls` 0 件） | — | 低 |
| 武器バッジ（L-13） | なし | — | 低 |
| 名前行（変更対象ではない） | `chapter1-progression` / `save-load` / `road` / `chapter1-dusk-basics` / `character-*` | `#hud-name` の `toHaveText('剣士')` 等。「レベル表示なし」を前提にしている（chapter1-progression.spec.js:88） | 現状維持が前提 |
| スキルボタン（変更対象ではない） | `chapter1-skill2`（`#btn-skill2` の `locked`、`#btn-charge` / `#btn-ult` の非 locked）、`chapter1-progression.spec.js:197〜198`、`chapter1-dusk-basics.spec.js:101`、`auto-combo.spec.js:205` | Skill 1 / 2 / Ult の表示とアイコン | Skill 3 の変更で Skill 1 / 2 / Ult に触れない限り低 |
| 鑑定所のタブ / サブタブ | `auto-combo` / `chapter1-skill2` / `job-traits` / `mansion-escort`（`.ap-tab[data-tab="skill"]`）、`character-weapon-visual`（`data-tab="gear"`）、`chapter1-skill2` / `mansion-escort`（`.skill-subtab[data-skill-subtab="skill2"]`） | タブの `data-tab` / `data-skill-subtab` を直接クリック | **スキル2サブタブの表示条件を変えると 2 spec に影響** |
| unit | `tests/unit/chapter1-rules.test.js`（`legacyGrowthEnabled` の真偽、`hudLabel` に `Lv` が無いこと）、`chapter1-skills.test.js`、`chapter1-progress.test.js` | 純粋関数の仕様 | 判定の置き場所を変える場合に影響 |
| テストモード入口 | `helpers.js` `startTestMode()` ほか多数（UI-002 Planner §1.4） | — | UI-002-B の範囲（本 Task で触れない前提） |

- **FACT**: 本 Task の不整合候補（L-1〜L-13）を直接参照する E2E は見つからなかった。
- **FACT**: 影響が出うるのは、鑑定所の「スキル2」サブタブ（`chapter1-skill2.spec.js:132`、`mansion-escort.spec.js:68`）と、確認ダイアログの有無（`mansion-scenario.spec.js:183〜184`）。

---

## 16. FACT（要約）

- F-A1: 本編で表示される旧成長系 UI は **XP バー**（常時）と **撤退ボーナスの「XP+」**（撃破後の撤退時）。
- F-A2: 本編で表示される Level 関連文言は **装備タブの凡例「Lv不足」** と **まとめて売却確認の「レベル未達」**。数値の Lv は表示されない。
- F-A3: **Skill 3 は本編 HUD に常時表示**され、U / 十字キー左 / タップで押せる。本編に習得・装着 UI は無く、押すと「鑑定所で装着できます」と表示される。`#hud-hint` に「U スキル3」。
- F-A4: Sphere Board は本編で非表示・到達不可（DOM は生成される）。docs D-02 の記述は実装と不一致。
- F-A5: 「🔍 一括鑑定」は本編で常時表示。本編では未鑑定品を新たに入手できない。
- F-A6: メニュー操作説明が存在しない「鑑定ボタン」「出撃ボタン」を案内し、Skill 1 を「溜め攻撃」、必殺を「リチャージ制」と呼ぶ。Skill 2 と処刑の記述が無い。
- F-A7: 💎・🔩 は本編で宝箱・ボス報酬から入手でき、メニューと鑑定所ヘッダに表示されるが、本編で使う手段が無い。
- F-A8: 表示可否は `legacyGrowthEnabled()` 1 関数に由来するが、呼び出しは 21 箇所に分散し、上記の漏れはいずれも **判定を通らない箇所**（HUD 更新・固定文言・装備パネルの共通部分・宝箱 / 報酬処理）にある。
- F-A9: 旧セーブに残る Skill 3 装着・スフィア解放・ボス能力は、本編で消去されない（`normalizeChapter1Load()` は job と武器のみ正規化）。
- F-A10: 本 Task の不整合候補を直接参照する E2E は無い。スキル2サブタブと確認ダイアログは既存 E2E が操作する。

## 17. INFERENCE

- I-A1: 漏れの主因は「表示可否を要素ごとに `legacyGrowth()` で個別判定する作り」で、WORK 12.1 の時点で判定が付かなかった共通部分が残った（コメントの WORK 12.1 表記と分岐位置からの推測）。
- I-A2: 本編でも旧セーブの Skill 3 装着があれば発動できるため、HUD だけを隠すと「見えないが押せる」状態になりうる。
- I-A3: 💎 が本編で使えない一方、ボス報酬の固有名（「主の袖飾り」等）は物語上の戦利品として表示されており、💎 と同一視されている。
- I-A4: 武器バッジはサブ武器切替のための表示で、サブ武器を使わない Chapter 1 本編では常に主武器の同じ記号になる。
- I-A5: メニュー操作説明の「鑑定ボタン」「出撃ボタン」は、過去にあったタッチ用ボタン（CSS `#btn-appraisal-touch` / `#btn-sortie-touch` の残骸）の記述が残ったもの。

## 18. HUMAN DECISION

HD-1 / HD-2 の範囲内で、Human が決めないと確定しない事項。

| ID | 事項 | 選択肢（例） |
| --- | --- | --- |
| HD-A1 | 本編の 💎 / 🔩（入手・表示）をどう扱うか。ボス報酬の固有名の扱いを含む | 本編で表示しない / 入手自体を止める / 使い道を作る（UI-002 の範囲外）/ 現状維持 |
| HD-A2 | 「🔍 一括鑑定」を HD-1 の「その他 Chapter 1 未解放の成長 UI」に含めるか。含める場合、未鑑定品の行・画面名「鑑定所」との関係 | 本編で非表示 / 旧セーブ所持品がある時だけ表示 / 現状維持 |
| HD-A3 | HD-2 の範囲は HUD ボタンだけか、Skill 3 の入力（U / 十字キー左 / タップ）・トースト・操作ヒント・旧セーブの装着データまで含むか | ボタンのみ / 入力と文言も / 旧セーブの装着も本編で無効化 |
| HD-A4 | 装備タブの凡例「Lv不足」と `lv-high` 色（本編では武器種による「扱えない」）の扱い | 本編の凡例を「扱えない」に合わせる / 凡例を本編で隠す |
| HD-A5 | 鑑定所の「スキル2」サブタブを未習得時にも表示するか（docs COMBAT.md「閃くまで存在しない」、HUD ボタンは非表示） | 未習得時は非表示 / 現状維持（説明文を出す）。※非表示にすると E2E 2 spec の手順に影響 |
| HD-A6 | 武器バッジを本編で表示するか | 本編で非表示 / 現状維持（UI-002-D の HUD 情報設計へ回す） |
| HD-A7 | メニュー操作説明の修正範囲（存在しないボタンの削除、Skill 1 の呼称統一、「リチャージ制」、Skill 2・処刑の追記） | 本 Task で修正 / UI-002-F（メニュー）へ回す |
| HD-A8 | 撤退ボーナスの「XP+」表記を本編で消すか（ゴールドの表記は残るか） | 本編では XP を出さない / 現状維持 |

## 19. Specification gaps

| # | gap | 仕様 | 実装 | 関連 |
| --- | --- | --- | --- | --- |
| G-1 | XP バーが本編 HUD に表示 | S-1 / S-6 | L-1 | HD-1 |
| G-2 | 撤退ボーナスが本編で「XP+n」と表示（XP は増えない） | S-1 / S-6 | L-2 | HD-1、HD-A8 |
| G-3 | 装備タブ凡例「Lv不足」、売却確認「レベル未達」 | S-1 / S-6 | L-3 / L-4 | HD-1、HD-A4 |
| G-4 | Skill 3 ボタンが本編 HUD に表示 | S-7 | L-5 | **HD-2** |
| G-5 | Skill 3 の入力・トースト・空中警告・操作ヒントが本編で有効 | S-7 | L-6 / L-7 / L-8 | HD-2、HD-A3 |
| G-6 | Skill 3 トーストが本編に存在しない装着 UI を案内 | S-7 | L-7 | HD-2 |
| G-7 | 一括鑑定が本編で表示（本編に鑑定対象が発生しない） | S-1（ランダム装備なし） | L-9 | HD-A2 |
| G-8 | 💎🔩 が本編で入手・表示されるが使い道が無い | S-1（パッシブ・武具強化なし） | L-10 / L-11 | HD-A1 |
| G-9 | メニュー操作説明が存在しないボタンを案内・呼称不一致・記述欠落 | — | L-12 | HD-A7 |
| G-10 | Skill 1 が本編で付け替え可能。docs は「Skill 1 を1つ持つ」とだけ記述し、付け替えの可否は未記述 | docs/COMBAT.md:77 | 12:3176〜3198 | 仕様の未記述（本 Task の範囲外の可能性） |
| G-11 | スキル2サブタブが未習得時も存在 | docs/COMBAT.md「閃く」、HUD は非表示 | 12:3047 | HD-A5 |
| G-12 | docs/README.md D-02 の記述（奥義の環は常時振れる）が実装（本編非表示）と不一致 | docs | 12:2534 | docs 整理（本 Task では変更しない） |
| G-13 | 旧セーブの Skill 3 装着・スフィア解放・ボス能力の効果が本編で残る | S-3 | 09:173〜177、12:917、`bossAbilityValue()` | UI ではない（§22） |

## 20. Risk

| # | リスク | 内容 |
| --- | --- | --- |
| R-1 | 表示だけを隠して入力が残る | Skill 3 のボタンだけ隠すと、U / 十字キー左 / 旧セーブの装着で「見えない技」が発動しうる（I-A2） |
| R-2 | 判定のさらなる分散 | 漏れ箇所ごとに `legacyGrowth()` を足すと、呼び出しが 21 箇所からさらに増える |
| R-3 | E2E の手順依存 | スキル2サブタブの表示条件を変えると `chapter1-skill2.spec.js` / `mansion-escort.spec.js` が失敗する |
| R-4 | テストモード側の退行 | 共通部分（凡例・一括鑑定・XP バー）の条件付けを誤ると、テストモードで旧機能 UI が消える |
| R-5 | 物語上の戦利品表示 | 💎 の扱い次第で、ボス撃破の戦利品行（固有名）の見え方が変わる（I-A3） |
| R-6 | 旧セーブ | 所持済みの未鑑定品・レベル付き装備・💎🔩 が本編で表示され続ける |
| R-7 | UI-002-B との同時実施 | `#hud-hint`・メニュー操作説明の修正は、`` ` `` やテストモード入口の記述と隣接する。HD-3（同時実施しない）に注意 |
| R-8 | 実画面未確認 | 撤退ボーナス文言・一括鑑定の押下結果・💎 の結果画面行・旧セーブ時の表示は、コードでの確認のみ |

## 21. Recommended Planner questions

Planner が計画時に扱うべき問い（決定は Human）。

1. HD-A1〜HD-A8 のうち、UI-002-A で扱うものと他 Task（D: HUD、F: メニュー、G: 鑑定所）へ回すものの切り分け。
2. 表示可否の判定を、既存の `legacyGrowth()` 呼び出しの追加で行うか、既存システム（`legacyGrowthEnabled()`）を使った 1 か所の表へ寄せるか（UI-002 Planner 案は未実装。Human Approval の対象）。
3. Skill 3 について、HUD（HD-2）・入力・文言・旧セーブ装着をどこまで同じ Task で扱うか（R-1）。
4. 💎・🔩 の変更を「表示」だけにとどめるか、「入手」まで含めるか（入手はゲーム仕様の変更になる）。
5. 固定文言（`#hud-hint`・`.menu-controls`）の修正を本 Task に含めるか。含める場合、UI-002-B の範囲（デバッグキー等）に触れない線引き。
6. テストモードで旧 UI が従来どおり表示されることの確認方法（E2E に追加するか、撮影で確認するか）。
7. 旧セーブの所持品（未鑑定品・Lv 付き装備・💎🔩・Skill 3 装着）を本編でどう扱うか。
8. docs/README.md D-02 の記述差異を、本 Task の外で整理するか。

## 22. Out of Scope

- 実装、source / tests / docs / package / config / Task file / Decision record の変更
- HD-1 / HD-2 の再判断
- 開発用 UI の分離（UI-002-B）: テストモード入口、`ver` 5 連打、`` ` `` デバッグキー、Arena
- HUD の配置・情報設計（UI-002-D）: 所持品チップの重なり等
- 見た目の変更（色・形・アイコン）
- **UI ではない挙動**: 旧セーブのスフィア解放（`sphereValue()` 分岐なし）・ボス能力（`bossAbilityValue()` 分岐なし）・Skill 3 装着が本編の戦闘値に効くこと（G-13）。記録のみ
- Skill 1 の付け替え可否の仕様（G-10）
- docs の修正（G-12）
- Decision record の Undecided（Sphere Board UI・施設 UI 等）
