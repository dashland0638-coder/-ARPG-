# UI-002-A Plan — Chapter 1 仕様との UI 不整合解消（Planner / READ ONLY）

Plan: Planner（READ ONLY。source・tests・docs・config・Task file・Decision record・既存 report を変更していない）/ 2026-09-27 / Claude Code セッション

記述の区別:

| ラベル | 意味 |
| --- | --- |
| **FACT** | UI-002-A Analyzer report（以下「A-analysis」）またはコードで確認済みの事実。根拠は A-analysis の節・ID（F-A* / G-* / L-*） |
| **INFERENCE** | FACT からの推測。仕様として未確定 |
| **PLANNER PROPOSAL** | Planner の提案。Human Decision ではない |
| **HUMAN DECISION REQUIRED** | Human が決めないと確定しない事項（§15） |

Human Decision 済みの事項は Decision record（`.ai/decisions/UI-002-human-decisions.md`）の HD-1〜HD-5 だけである。本書の提案をそれと混同しない。

---

## 1. Task identity

| 項目 | 値 |
| --- | --- |
| Task ID | UI-002-A |
| Title | Chapter 1 仕様との UI 不整合解消 |
| 本工程 | Planner（READ ONLY） |
| 目的 | A-analysis で特定された本編の不整合 UI を、実装可能な Work Item に整理し、A / D / F / G / H / 別 Task の境界と、UI のみの変更 / ゲーム仕様・状態に関わる変更の境界を明確にする |
| 前提 | HD-1（本編に旧成長系 UI を表示しない）、HD-2（本編 HUD から Skill 3 を外す）。HD-2 の範囲に入力・トースト・操作ヒント・旧セーブ状態を含めるかは **未確定**（Human の指示） |
| Task file | `.ai/tasks/UI-002-A.md`（Status: DRAFT）。本工程では変更しない。Work Item 化の反映は Human Approval の工程で行う想定 |

## 2. Baseline / Artifact identity

| 項目 | 値 |
| --- | --- |
| origin/main HEAD（`git fetch origin` 後） | `70b6ee36859b049d3749766dcefed73bedff06f2` |
| Planner ブランチ | `claude/ui-002-a-planner`（起点 = `origin/claude/ui-002-task-planning` @ `589d28becea1c8da4e0f4f4d36cb078df04e5205`） |
| working tree（開始時） | clean |

| Artifact | branch | commit | blob | 読み方 |
| --- | --- | --- | --- | --- |
| UI-001 Analyzer `.ai/reports/UI-001-analysis.md` | `claude/ui-001-analysis-380kl5` | `4830a3804ea0874ae803b951c01dabaad68cfe88` | `c976f1c3b3e0a0b089e6b7eacde2b39f6f07b10a` | 参照のみ |
| UI-002 Planner `.ai/reports/UI-002-plan.md` | `claude/ui-002-planner` | `eadb5e3cac983cf90911610d6da3deadc0af34a5` | `a23563e8c481e97c9b01fd063407c357c8c7668e` | 参照のみ |
| UI-002-A Analyzer `.ai/reports/UI-002-A-analysis.md` | `claude/ui-002-a-analysis` | `99f1fbd07c474625007a6f90a703d4f70224189d` | `583bd83e937b748fb5a17e330591f49897aeb8dd` | `git show 99f1fbd:<path>`（本ブランチへコピーしていない） |
| Decision record / Task file | `claude/ui-002-task-planning`（本ブランチの起点） | `589d28be…` | — | 作業ツリー |

**Artifact Handoff の例外（A-analysis §3.2 を踏襲）**: 上記 3 report は main に無く、いずれも Human の指示で AI が push した（AGENTS.md §5.2 の「Persisted by: Human」と異なる）。UI-002-A Analyzer については、Planner として次を確認した: remote ブランチに存在（H-1）、Source commit の変更が report 1 件のみ（H-3、`git diff --name-only 99f1fbd^ 99f1fbd`）、1 行目 `# UI-002-A Analysis`（H-4）、blob 一致（H-6）、`git show` で読んだ（H-8）。

**Planner identity**: UI-001 以降と同一セッションの AI（役割の兼務。AGENTS.md §5）。

## 3. Analyzer summary（FACT）

| ID | 不整合（本編で表示・到達可能） | 所在（A-analysis §14.2） | 種別 |
| --- | --- | --- | --- |
| G-1 | HUD の XP バー（常時） | L-1 `updateHUD()` | UI 表示 |
| G-2 | 撤退の確認ダイアログ・トーストに「XP+n」（XP は増えない） | L-2 `menu-town` click / `performRetreat()` | UI 文言 |
| G-3 | 装備タブ凡例「Lv不足」、まとめて売却確認「レベル未達」 | L-3 / L-4 `renderGearPanel()` | UI 文言 |
| G-4 | Skill 3 ボタン（常時） | L-5 `#btn-skill3` / `updateCooldownRings()` | UI 表示 |
| G-5 | Skill 3 の入力（U / 十字キー左 / タップ）・空中警告・操作ヒント「U スキル3」 | L-6 / L-8 | 入力・文言 |
| G-6 | Skill 3 未装着トーストが本編に無い装着 UI を案内 | L-7 `castBossSkill3()` | 文言 |
| G-7 | 「🔍 一括鑑定」（本編で鑑定対象は新たに発生しない） | L-9 | UI 表示 |
| G-8 | 💎 / 🔩 が本編で入手・表示されるが使い道が無い | L-10 / L-11 | 表示＋ゲーム仕様 |
| G-9 | メニュー操作説明（存在しないボタン・呼称・記述欠落） | L-12 `.menu-controls` | 固定文言 |
| G-11 | 鑑定所「スキル2」サブタブが未習得時も存在 | `SKILL_SUBTABS` | UI 情報設計 |
| G-12 | docs/README.md D-02 の記述が実装と不一致 | docs | docs |
| G-13 | 旧セーブの Skill 3 装着・スフィア解放・ボス能力が本編で残る | 09 / 12 | 状態（UI 外） |
| — | 武器バッジ（本編で意味が薄い、所持品チップに隠れる） | L-13 | HUD 情報設計 |

- **FACT**: 表示可否は `legacyGrowthEnabled()` 1 関数に由来し、`legacyGrowth()` の呼び出しは 21 箇所。上記の漏れはすべて判定を通らない箇所にある（F-A8）。
- **FACT**: 上記の不整合 UI を直接参照する E2E は無い。鑑定所「スキル2」サブタブ（2 spec）と撤退の確認ダイアログ（1 spec）は既存 E2E が操作する（A-analysis §15）。
- **FACT**: 未習得の Skill 2 は既存の `.action-btn.locked{display:none}`（main.css）＋ `classList.toggle('locked', !hasSkill2(state))`（14-hud-boot.js `updateCooldownRings()`）で HUD から消している。HUD ボタンを本編で消す既存パターンが存在する。

## 4. Scope boundary（PLANNER PROPOSAL）

**UI-002-A の範囲 = 「本編に表示されている、Chapter 1 に存在しない仕組みを示す UI・文言を、本編では表示しないようにする（テストモードは現状維持）」**

判定基準（Planner 提案）:

| 基準 | A に入れる | A に入れない |
| --- | --- | --- |
| 変更の種類 | 表示 / 非表示、誤った文言の削除・修正 | 配置・見た目・情報設計の変更、新規 UI |
| ゲーム状態 | 変えない（`state` の値・セーブ内容・入手・報酬・戦闘値を変えない） | 状態・入手・報酬・セーブを変えるもの → 別 Task |
| テストモード | 現状どおり表示・動作 | テストモードの挙動を変えるもの |
| 開発用 UI | 触れない | テストモード入口・デバッグキー（UI-002-B） |

## 5. Work Item decomposition（PLANNER PROPOSAL）

Work Item は AGENTS.md §7.2 の形（Task 内で承認単位を分ける）を想定する。ID は仮。

### WI-A1 XP / Level の本編表示

| 項目 | 内容 |
| --- | --- |
| Purpose | 本編で XP・Level を示す UI / 文言を表示しない（HD-1） |
| Scope | G-1 XP バー（HUD）、G-2 撤退ボーナスの「XP+」（確認ダイアログ・トースト）、G-3 凡例「Lv不足」・売却確認「レベル未達」 |
| Out of Scope | XP / Level の内部状態（`state.xp` 等）、`grantXP()` の挙動、撤退ボーナスのゴールド、装備行の色分けの再設計（凡例との対応は HD-P4 の結果に従う最小限のみ）、HUD の配置（D） |
| Dependencies | なし |
| Files likely involved | `src/legacy/parts/14-hud-boot.js`（`updateHUD()`）、`src/legacy/parts/10-input.js`（`menu-town` の確認文）、`src/legacy/parts/12-progression-ui.js`（`performRetreat()`、`renderGearPanel()`）、`index.html`（`.bar-track.xp`）、必要なら `src/styles/main.css` |
| Runtime behavior | 本編: XP バー非表示、撤退の文言からXPを除く（ゴールドは残る）、凡例・売却確認から Lv を除く。テストモード: 変化なし |
| Test impact | 既存 E2E の直接参照なし（`xp-fill` / `Lv不足` 0 件）。`mansion-scenario.spec.js` は確認ダイアログの存在だけを見るので、ダイアログを残す限り影響なし |
| Acceptance Criteria | §16 AC-A1 |
| Human Decision | HD-P4（凡例の扱い）、HD-P7（撤退ボーナス文言） |
| Risk | 共通部分を条件付けする際にテストモード側の表示を消す（R-4） |
| 種別 | **UI のみ**（状態を変えない） |

### WI-A2 Skill 3 の本編 HUD 表示と操作ヒント

| 項目 | 内容 |
| --- | --- |
| Purpose | 本編 HUD から Skill 3 を外す（HD-2 の確定部分）。操作ヒント「U スキル3」を本編で出さない |
| Scope | G-4 `#btn-skill3` の本編非表示、G-5 のうち `#hud-hint` の「U スキル3」（本編） |
| Out of Scope | 入力（U / 十字キー左 / タップ）の無効化（WI-A3）、旧セーブ状態（別 Task 候補 T-SAVE）、Skill 1 / Skill 2 / Ult の表示、HUD の配置（D） |
| Dependencies | なし |
| Files likely involved | `src/legacy/parts/14-hud-boot.js`（`updateCooldownRings()`）、`index.html`（`#btn-skill3`、`#hud-hint`）、必要なら `src/styles/main.css`（既存の `.locked` パターン） |
| Runtime behavior | 本編: Skill 3 ボタンが表示されない（PC・タッチ・パッドとも）。テストモード: 現状どおり表示 |
| Test impact | 直接参照なし。`chapter1-skill2.spec.js`（`#btn-charge` / `#btn-ult` が locked でない）等は Skill 3 に触れない限り影響なし |
| Acceptance Criteria | §16 AC-A2 |
| Human Decision | HD-P2（入力を同時に止めるか。止めない場合 WI-A2 単独で「見えないが押せる」状態になる） |
| Risk | R-1（見えない入力） |
| 種別 | **UI のみ** |

### WI-A3 Skill 3 の本編入力・メッセージ（条件付き）

| 項目 | 内容 |
| --- | --- |
| Purpose | 本編で Skill 3 の入力とメッセージ（未装着トースト・空中警告）が出ないようにする |
| Scope | G-5 の入力（U / 十字キー左 / タップ）、G-6 未装着トースト「鑑定所で装着できます」、空中警告「SKILL 3」（本編） |
| Out of Scope | テストモードの Skill 3（現状維持）、旧セーブの装着状態の削除・変換（T-SAVE）、Skill 3 の戦闘効果・データ（`BOSS_ACTIVE_SKILLS` 等） |
| Dependencies | WI-A2 と同時に承認・実装することを推奨（§8） |
| Files likely involved | `src/legacy/parts/11-combat-actions.js`（`castBossSkill3()`）、`src/legacy/parts/09-save-load.js`（KeyU）、`src/legacy/parts/13-update-loop.js`（十字キー左）、`src/legacy/parts/10-input.js`（タップのバインド） |
| Runtime behavior | 本編: Skill 3 入力は何も起こさず、メッセージも出ない。**旧セーブで装着済みでも本編では発動しない**（これは「戦闘機能の停止」にあたる → HD-P2 / HD-P3） |
| Test impact | 直接参照なし |
| Acceptance Criteria | §16 AC-A3 |
| Human Decision | **HD-P2 / HD-P3（必須）**。承認されなければ WI-A3 は実施しない |
| Risk | 旧セーブ利用者の挙動が変わる（戦闘機能の変更） |
| 種別 | **入力・戦闘機能に関わる**（UI のみではない） |

### WI-A4 一括鑑定の本編表示（条件付き）

| 項目 | 内容 |
| --- | --- |
| Purpose | 本編に鑑定対象が新たに発生しないため、「🔍 一括鑑定」を本編で表示しない |
| Scope | G-7 `#gear-identify-all-btn` の本編非表示 |
| Out of Scope | 未鑑定品の行・個別の「鑑定」ボタン（旧セーブ所持品のみに出る。現状維持を提案）、画面名「鑑定所」（G）、装備画面の再設計（F / G）、旧セーブの未鑑定品の扱い（T-SAVE） |
| Dependencies | なし（WI-A1 と同じ `renderGearPanel()` を触るため同時実施が効率的） |
| Files likely involved | `src/legacy/parts/12-progression-ui.js`（`renderGearPanel()`） |
| Runtime behavior | 本編: 一括鑑定ボタンが出ない。旧セーブの未鑑定品は個別の「鑑定」ボタンで従来どおり鑑定できる。テストモード: 変化なし |
| Test impact | 直接参照なし（`identify` 0 件） |
| Acceptance Criteria | §16 AC-A4 |
| Human Decision | HD-P5 |
| Risk | 旧セーブで未鑑定品を多数持つ場合、一括操作が失われる（個別操作は残る） |
| 種別 | **UI のみ** |

### WI-A5 操作説明の事実誤り（条件付き）

| 項目 | 内容 |
| --- | --- |
| Purpose | 操作説明のうち「存在しない UI・機能を案内している記述」だけを本編で除く／正す |
| Scope | `.menu-controls`: 「鑑定ボタン」「出撃ボタン」の語、「リチャージ制」（実装はゲージ制）。`#hud-hint` の「U スキル3」は WI-A2 で扱う |
| Out of Scope | Skill 1 の呼称統一（溜め攻撃 / スキル / スキル1）、Skill 2・処刑の記述追加、パッド注記の書き直し、操作ガイドの再設計 → **UI-002-F**（§12） |
| Dependencies | なし。**UI-002-B と同時に実施しない**（HD-3。デバッグキー等の記述に触れない） |
| Files likely involved | `index.html`（`.menu-controls`） |
| Runtime behavior | 本編・テストモードとも文言のみ変わる（`.menu-controls` は両モード共通の固定文言。モード別にするかは HD-P6） |
| Test impact | 直接参照なし（`menu-controls` 0 件） |
| Acceptance Criteria | §16 AC-A5 |
| Human Decision | HD-P6 |
| Risk | 文言だけ先に直して F で再度書き直す二度手間 |
| 種別 | **UI 文言のみ** |

### 別 Task 候補（A の Work Item にしない）

| 仮 ID | 内容 | 理由 |
| --- | --- | --- |
| **T-MAT** | 💎 / 🔩 の Chapter 1 での扱い（入手・所持・表示・用途） | 入手・報酬（ボス戦利品の固有名を含む）に関わるゲーム仕様の変更（§11） |
| **T-SAVE** | 旧セーブの正規化（Skill 3 装着・スフィア解放・ボス能力・未鑑定品・💎🔩 所持） | セーブ・状態・戦闘値の変更（G-13） |
| **T-DOCS** | docs/README.md D-02 と実装の差異の整理 | docs の変更は UI Task の範囲外（Task file の Out of Scope） |
| **T-ARCH**（候補） | 本編 / テストモードの UI 可視性判定の集約 | 21 箇所の分散（§13）。C1 に含めるか別 Task かは HD-P8 |

## 6. A / D / F / G / H boundary

| 項目 | A | D（HUD） | F（Menu / Character） | G（Tavern / 鑑定所） | H（Dialog / Notification / Result） | 別 Task |
| --- | --- | --- | --- | --- | --- | --- |
| XP バー | **非表示（WI-A1）** | 配置の再設計 | — | — | — | — |
| 撤退「XP+」 | **文言から XP を除く（WI-A1）** | — | — | — | 確認・トーストの見た目 | — |
| 凡例「Lv不足」・売却確認 | **Lv を除く（WI-A1）** | — | — | 装備画面の再設計 | 確認ダイアログの見た目 | — |
| Skill 3 ボタン | **本編非表示（WI-A2）** | 残る HUD ボタンの配置 | — | — | — | — |
| Skill 3 入力・トースト | **WI-A3（HD 次第）** | — | — | — | — | — |
| Skill 3 旧セーブ装着 | — | — | — | — | — | **T-SAVE** |
| 一括鑑定 | **本編非表示（WI-A4、HD 次第）** | — | — | 鑑定所の再設計・名称 | — | 未鑑定品の扱い T-SAVE |
| 💎 / 🔩 | 変更しない（提案） | — | 所持素材欄の再設計 | 鑑定所ヘッダ | 入手トースト・結果の戦利品行 | **T-MAT** |
| 操作説明（誤り） | **WI-A5（HD 次第）** | — | — | — | — | — |
| 操作説明（呼称・追記・再設計） | — | 操作ヒント帯の扱い | **F** | — | — | — |
| 武器バッジ | 変更しない | **D** | キャラクター画面の武器表示 | — | — | — |
| スキル2サブタブ（未習得時） | 変更しない | — | — | **G**（鍛冶士画面のスキル構成） | — | — |
| Skill 1 の付け替え可否（G-10） | 変更しない | — | — | G（仕様確認が先） | — | 仕様の明文化（docs） |
| legacyGrowth 判定の集約 | 最小限（§13） | — | — | — | — | **C1 または T-ARCH** |
| docs D-02 | 変更しない | — | — | — | — | **T-DOCS** |

## 7. UI-only vs game-logic changes

| 区分 | 項目 | 変わるもの | 変わらないもの |
| --- | --- | --- | --- |
| **UI 表示のみ** | XP バー、Skill 3 ボタン、一括鑑定 | 本編での表示 | 状態・入力・セーブ |
| **UI 文言のみ** | 撤退「XP+」、凡例「Lv不足」、売却確認「レベル未達」、操作ヒント「U スキル3」、操作説明の誤り | 表示される文字列 | 実際のボーナス（XP は元々本編で増えない — FACT）、売却対象の判定 |
| **入力・メッセージ** | Skill 3 の U / 十字キー左 / タップ、未装着トースト、空中警告 | 入力への反応 | 状態・セーブ |
| **戦闘機能** | 旧セーブで装着済みの Skill 3 が本編で発動しなくなる（WI-A3 の副作用） | 戦闘の可能な行動 | セーブ内容（消去しない場合） |
| **状態・セーブ** | 旧セーブの Skill 3 装着・スフィア・ボス能力・未鑑定品・💎🔩 の正規化 | セーブ・戦闘値 | — → **T-SAVE** |
| **入手・報酬** | 💎🔩 の宝箱・ボス報酬 | 入手・結果画面の戦利品 | — → **T-MAT** |

- **FACT**: 撤退ボーナスの XP は本編では `grantXP()` が何もしないため、文言から XP を除いても状態は変わらない。
- **FACT**: 一括鑑定ボタンを本編で隠しても、本編で未鑑定品が新たに発生しない（ドロップが本編で停止している）ため、新規プレイの挙動は変わらない。

## 8. Skill 3 handling

### 8.1 5 つの面（FACT → PLANNER PROPOSAL）

| 面 | 現状（FACT） | 本編で「ボタンだけ隠す」と | 提案 |
| --- | --- | --- | --- |
| A. UI 表示 | HUD ボタン常時、`#hud-hint`「U スキル3」 | 隠れる | WI-A2 で本編非表示（HD-2 の確定範囲） |
| B. 入力 | U / 十字キー左 / タップ（タップは要素が非表示なら押せない） | **U・十字キー左は残る** | WI-A3（HD-P2） |
| C. メッセージ | 未装着トースト（鑑定所案内）、空中警告 | **U を押すと、見えない技について「鑑定所で装着できます」と出る**（本編の鑑定所に装着 UI は無い） | WI-A3（HD-P2） |
| D. 保存状態 | `equippedBossActiveSkill` 等を読み込み・保持、本編で消去しない | 変化なし | T-SAVE（HD-P3） |
| E. 戦闘機能 | 装着済みなら本編でも発動 | **旧セーブ装着者は、見えないボタンの技を U / 十字キー左で出せる** | WI-A3 で本編の発動を止めるか（HD-P2 / HD-P3） |

### 8.2 「ボタンだけ隠して入力を残す」ことの評価

- **INFERENCE**: 新規プレイ（本編で Skill 3 を習得する経路が無い — FACT）では、影響は「U / 十字キー左を押すと、存在しない装着先を案内するトーストが出る」ことに限られる。
- **INFERENCE**: 旧セーブで装着済みの場合、「HUD に無い技が発動し、クールダウン表示も見えない」状態になる。HD-2 の意図（本編のスキル構成は Skill 1 / Skill 2 / Ult）と食い違う可能性が高い。
- **PLANNER PROPOSAL**: WI-A2 と WI-A3 を **同じ承認単位** にする（HUD と入力・メッセージを同時に本編から外す）。旧セーブ状態の削除・変換は行わず（T-SAVE）、本編で「使えない」ようにするだけに留める。この案は B・C・E を変えるため Human の承認が要る（HD-P2）。

## 9. XP / Level handling

| 項目 | 隠すだけ | 文言修正 | 状態変更が必要 | 提案 |
| --- | --- | --- | --- | --- |
| XP バー（HUD） | ○ | — | 不要 | WI-A1 |
| 撤退「XP+」（確認ダイアログ） | — | ○（XP の部分を本編で出さない。ゴールドは残す） | 不要（XP は本編で増えない — FACT） | WI-A1 |
| 撤退トースト「XP+」 | — | ○ | 不要 | WI-A1 |
| XP 関連トースト（レベルアップ等） | 既に本編で出ない（FACT） | — | — | 対象外 |
| 凡例「Lv不足」 | ○ または文言置換 | ○ | 不要 | WI-A1（HD-P4） |
| 売却確認「レベル未達で装備できない品は対象外」 | — | ○（本編では「扱えない品は対象外」等） | 不要 | WI-A1 |
| 装備行の `lv-high` 色 | — | — | 不要 | 本編では武器種で装備できない品に付く。凡例を HD-P4 に合わせるだけで、色の再設計は G |
| Level 関連の操作説明 | — | — | — | FACT: 操作説明に Level の記述は無い（A-analysis §10） |
| テストモードの XP / Lv | 変えない | 変えない | — | 対象外 |

## 10. Appraisal handling

| 項目 | 現状（FACT） | 提案 |
| --- | --- | --- |
| 一括鑑定ボタン | 本編で常時表示、新規プレイでは対象が発生しない | WI-A4（本編非表示、HD-P5） |
| 未鑑定品の行・個別「鑑定」ボタン・説明文 | 旧セーブの所持品がある時だけ表示 | A では変更しない（旧セーブ所持品を扱えなくなるため）。旧セーブの扱いは T-SAVE |
| 鑑定関連トースト | 一括鑑定の押下時のみ | WI-A4 に従う（ボタンが無ければ出ない） |
| 画面名「鑑定所」 | 本編・テストモード共通 | **G**（UI-002-G の名称判断） |
| 鑑定所の再設計（タブ構成・スキル2サブタブ・装備画面） | — | **G / F** |

## 11. 💎 / 🔩 handling

### 11.1 5 つの面（FACT）

| 面 | 💎 魔宝石 | 🔩 武具の欠片 |
| --- | --- | --- |
| 1. 表示 | メニュー「所持素材」、鑑定所ヘッダ、入手トースト、結果画面の戦利品行（ボス報酬の固有名） | メニュー「所持素材」、入手トースト |
| 2. 入手 | 宝箱（分岐なし）、全ボスの `rewardLoot`（`type:'gem'`） | 宝箱（分岐なし） |
| 3. 所持 | `state.inventory.gem`（セーブ対象） | `state.inventory.shard`（セーブ対象） |
| 4. 消費 | ランク上げ・パッシブ購入（本編非表示） | 武具強化（到達不可） |
| 5. ゲーム上の用途（本編） | 無い | 無い |

### 11.2 選択肢の比較（PLANNER PROPOSAL の材料）

| 案 | 内容 | 変わる面 | 問題 |
| --- | --- | --- | --- |
| M-0 | 現状維持（A では触れない） | なし | G-8 が残る |
| M-1 | A で「表示」だけ本編非表示（メニュー・鑑定所ヘッダ） | 1 の一部 | **入手トースト「💎 魔宝石を手に入れた!」と結果画面の戦利品行は残る**（表示を消すとトースト側に不整合、トーストも消すと宝箱を開けて何も得ていないように見える）。所持は増え続ける |
| M-2 | 入手を本編で止める | 2 | ゲーム仕様・報酬の変更。ボス報酬の固有名（「主の袖飾り」等）の意味づけに関わる |
| M-3 | 本編に用途を作る | 4 / 5 | 新機能。UI-002 の範囲外 |
| M-4 | 旧セーブ所持分の扱い（残す / 消す / 変換） | 3 | セーブ変更 |

- **PLANNER PROPOSAL**: UI-002-A では 💎 / 🔩 を **変更しない（M-0）**。表示・入手・所持・用途をまとめて **別 Task T-MAT** で扱う（入手と表示を分けて一部だけ直すと、M-1 の通り新たな不整合が生じるため）。
- 入手処理の変更は、本書では **決定しない**（Human の指示どおり）。

## 12. Menu instruction handling

| 記述 | 分類 | 提案先 | 理由 |
| --- | --- | --- | --- |
| 「鑑定所(街の近くで): I / 十字キー下 / **鑑定ボタン**」 | 存在しない UI の案内（事実誤り） | **A（WI-A5）** | 本編で押すものが無い |
| 「出撃メニュー(街で): F / 十字キー上 / **出撃ボタン**」 | 同上 | **A（WI-A5）** | 同上 |
| 「必殺技: … 必殺ボタン(**リチャージ制**)」 | 仕組みの誤記（実装はゲージ制） | **A（WI-A5）** | 事実と異なる |
| 「溜め攻撃: L(長押し) / … 溜めボタン(長押し・鑑定所でタイプ変更可)」 | 呼称の不一致（Skill 1 を「溜め攻撃」と呼ぶ）。入力自体は存在する | **F** | 呼称統一は用語設計（Skill 1 の呼び名をどこで統一するか）で、メニュー再設計と一体 |
| Skill 2（O / L2・LT）の記述なし | 記述欠落 | **F** | 追記は情報設計 |
| 処刑（E / R）の記述なし | 記述欠落 | **F**（処刑プロンプトの扱いは D） | 同上 |
| パッド注記「タッチボタンが自動的に隠れます」 | 実挙動より広い表現（INFERENCE） | **F** | 同上 |
| `#hud-hint`「U スキル3」 | HD-2 | **A（WI-A2）** | Skill 3 の本編非表示と一体 |
| `#hud-hint`「Q・E カメラ回転」（E は処刑と兼用） | 記述欠落 | **D**（操作ヒント帯の扱い） | ヒント帯自体の扱いが D の論点 |
| デバッグキー `` ` `` 等 | 記載なし | **B** | HD-3 |

## 13. legacyGrowthEnabled handling

### 13.1 現状（FACT）

`legacyGrowthEnabled(testMode)`（`src/core/chapter1-rules.js`）→ legacy ラッパー `legacyGrowth()`（01-character-creation.js）→ 呼び出し 21 箇所。UI に関わる判定は 7 系統（A-analysis §14.1）。漏れはすべて判定を通らない箇所。

### 13.2 比較（PLANNER PROPOSAL の材料）

| 案 | 内容 | 利点 | 欠点 |
| --- | --- | --- | --- |
| Z-1 現状のまま個別修正 | WI-A1〜A5 の各箇所に既存の `legacyGrowth()` 分岐を追加 | 最小変更、既存パターン、テストモード側の挙動を 1 箇所ずつ確認できる | 呼び出しが 21 → 約 26〜30 に増える（INFERENCE） |
| Z-2 A で部分的に整理 | A で触る箇所だけ、既存の `legacyGrowth()` の結果を 1 回で DOM に反映する仕組み（例: 1 つの class 切替）へ寄せる | A の漏れ箇所がまとまる | A の範囲が「仕組みの導入」に広がる。方式を A で決めることになる |
| Z-3 C1 で整理 | UI foundation（C1）の一部として可視性の扱いを設計 | UI 基盤とまとめて設計できる | C1 は「見た目を変えない基盤」で、可視性ロジックは目的外の可能性 |
| Z-4 別 architecture Task（T-ARCH） | 本編 / テストモードの可視性判定の集約を独立 Task に | 範囲が明確、単体テストを設計できる | Task が 1 つ増える |

- **PLANNER PROPOSAL**: A は **Z-1**（既存の `legacyGrowth()` を使った個別修正、新しい仕組みを入れない）。集約は **Z-4（T-ARCH）** を推奨し、C1 との関係は T-ARCH の Analyzer で判断する。
- 「`src/core` の純粋関数の表へ集約する」案（UI-002 Planner）は **未確定のまま** とし、A では採用しない。

## 14. E2E impact

| WI | 参照している既存テスト（A-analysis §15） | 影響 | 提案する確認 |
| --- | --- | --- | --- |
| WI-A1 | なし（`xp-fill` / `Lv不足` / `gear-lv` 0 件）。`mansion-scenario.spec.js:179〜185` は撤退の確認ダイアログの存在のみ | 低 | 本編とテストモードでの表示差を確認する検証を追加（下記） |
| WI-A2 | なし（`btn-skill3` 0 件）。Skill 1 / 2 / Ult の既存アサーション（`chapter1-skill2` / `chapter1-progression` / `chapter1-dusk-basics` / `auto-combo`）は不変 | 低 | 同上 |
| WI-A3 | なし | 低 | 本編で U を押しても Skill 3 のトーストが出ない確認 |
| WI-A4 | なし（`identify` 0 件）。`character-weapon-visual.spec.js:81` は装備タブを開く | 低 | 本編 / テストモードで一括鑑定の有無 |
| WI-A5 | なし（`menu-controls` 0 件） | 低 | 文言の目視または文字列確認 |
| 範囲外 | スキル2サブタブ（`chapter1-skill2.spec.js:132`、`mansion-escort.spec.js:68`） | A で触らないため影響なし | — |
| unit | `tests/unit/chapter1-rules.test.js`（`legacyGrowthEnabled`、`hudLabel`） | Z-1 なら影響なし | — |

- **PLANNER PROPOSAL（テスト）**: 本編とテストモードの両方で「対象 UI の有無」を確かめる E2E を追加する（既存 spec への追記か新規 spec かは Implementer の Planner 詳細化で決める）。テストの追加は Human Approval の Files To Change に含める必要がある。
- 撮影: 1280×800 / 844×390（HD-4）、本編・テストモードの両方。

## 15. Human Decision candidates

### 15.1 HUMAN DECISION REQUIRED

| ID | 事項 | 選択肢 | Planner 推奨 | 影響 WI |
| --- | --- | --- | --- | --- |
| **HD-P1** | 💎 / 🔩 を A で扱うか | (a) A では触れず別 Task T-MAT で表示・入手・所持・用途をまとめて扱う / (b) A で表示だけ本編非表示 / (c) A で入手も止める | (a) | — / T-MAT |
| **HD-P2** | HD-2 の範囲に Skill 3 の入力・メッセージ・本編での発動を含めるか | (a) HUD ＋ 操作ヒントのみ（WI-A2）/ (b) HUD ＋ 操作ヒント ＋ 入力・メッセージ・本編での発動停止（WI-A2＋A3、同一承認単位） | (b) | WI-A2 / A3 |
| **HD-P3** | 旧セーブの Skill 3 装着状態をどう扱うか | (a) セーブは変えず、本編で使えないだけにする（HD-P2 (b) の場合）/ (b) 読み込み時に本編では外す（セーブ変更）/ (c) 現状維持 | (a)。セーブの正規化は T-SAVE で他の旧状態と一緒に判断 | WI-A3 / T-SAVE |
| **HD-P4** | 装備タブの凡例「Lv不足」を本編でどう扱うか | (a) 本編では凡例を「扱えない」（武器種）に置き換える / (b) 本編では凡例から Lv を消すだけ | (a)（本編の `lv-high` 色は武器種で付くため、凡例と意味を一致させる） | WI-A1 |
| **HD-P5** | 一括鑑定を A で本編非表示にするか | (a) A で本編非表示（個別の鑑定は残す）/ (b) G（鑑定所の再設計）へ送る | (a) | WI-A4 |
| **HD-P6** | メニュー操作説明の事実誤り（鑑定ボタン・出撃ボタン・リチャージ制）を A で直すか。呼称統一・追記は F | (a) 誤りだけ A、他は F / (b) すべて F | (a) | WI-A5 |
| **HD-P8** | legacyGrowth 判定の集約をどこで扱うか | (a) A は個別修正（Z-1）、集約は別 Task T-ARCH / (b) C1 / (c) A で部分整理（Z-2） | (a) | 全 WI / T-ARCH |
| **HD-P9** | docs/README.md D-02 の記述差異 | (a) 別 Task T-DOCS / (b) A で修正（docs 変更を A の範囲に含める） | (a) | T-DOCS |
| **HD-P7** | 撤退ボーナスの文言 | (a) 本編では XP を出さずゴールドのみ表示 / (b) 現状維持 | (a) | WI-A1 |

### 15.2 Planner で決定可能（Human は異議があれば差し戻し）

| # | 内容 | 根拠 |
| --- | --- | --- |
| P-1 | 武器バッジは A で変更せず **D** へ送る（HUD 情報設計の論点。Chapter 1 仕様に「表示してはならない」旨の記述は無く、HD-1 の旧成長系 UI にも該当しない） | A-analysis §11、Task 境界 |
| P-2 | スキル2サブタブは A で変更せず **G** へ送る（鍛冶士画面のスキル構成の論点。変更すると既存 E2E 2 spec の手順に影響するため、G の Analyzer で E2E と合わせて扱う） | A-analysis §15、G-11 |
| P-3 | Skill 1 の付け替え可否（G-10）は A で扱わない（仕様の明文化が先。G / docs） | A-analysis G-10 |
| P-4 | 見た目・配置は変えない。既存 DOM id を維持する | Task file、HD-5 |
| P-5 | テストモードの表示・挙動は変えない（HD-1: 旧機能はテストモード等に限定） | HD-1 |
| P-6 | 検証は E2E（本編・テストモード）＋両サイズ撮影 | HD-4 |
| P-7 | Work Item の承認単位は WI ごと（WI-A2 と WI-A3 は HD-P2 (b) の場合に同一単位） | AGENTS.md §7.2 |

### 15.3 次に Human が決める事項（最小限）

HD-P1、HD-P2、HD-P3 が Skill 3 と 💎🔩 の境界を決めるため、最初に必要。HD-P4〜HD-P6、HD-P7 は WI ごとの承認時に決めればよい。HD-P8 / HD-P9 は別 Task の起票判断。

## 16. Acceptance Criteria proposal

| ID | 基準（本編 = Chapter 1 通常プレイ） |
| --- | --- |
| AC-A1 | 本編: HUD に XP バーが表示されない。撤退の確認ダイアログとトーストに XP が表示されない（ゴールドは表示）。装備タブの凡例・まとめて売却の確認文に Level / Lv が表示されない。テストモード: いずれも従来どおり |
| AC-A2 | 本編: Skill 3 ボタンが HUD に表示されない（1280×800 / 844×390、PC・タッチ）。`#hud-hint` に Skill 3 の記述が無い。Skill 1 / Skill 2 / Ult の表示条件は変わらない。テストモード: Skill 3 ボタンが従来どおり表示される |
| AC-A3（承認時のみ） | 本編: U / 十字キー左を押しても Skill 3 が発動せず、Skill 3 のトースト・空中警告が出ない。セーブ内容は変更されない。テストモード: 従来どおり |
| AC-A4（承認時のみ） | 本編: 装備タブに一括鑑定ボタンが無い。旧セーブの未鑑定品は個別に鑑定できる。テストモード: 従来どおり |
| AC-A5（承認時のみ） | メニュー操作説明に存在しない UI（鑑定ボタン・出撃ボタン）の記述が無く、必殺技の仕組みの記述が実装（ゲージ）と一致する |
| AC-A0 | 見た目・配置・DOM id・ゲーム状態・セーブ内容・入手・報酬が変わっていない（WI-A3 承認時の本編 Skill 3 発動停止を除く）。既存 E2E / unit が全件通る |

## 17. Risks

| # | リスク | 対策（提案） |
| --- | --- | --- |
| R-1 | Skill 3 のボタンだけ隠すと「見えないが押せる」状態 | WI-A2 と WI-A3 を同一承認単位にする（HD-P2） |
| R-2 | 判定の分散が増える（Z-1） | 追加箇所を Implementation Result に列挙し、T-ARCH の入力にする |
| R-3 | テストモード側で旧 UI が消える退行 | 本編・テストモードの両方を検証する E2E を追加 |
| R-4 | 共通の DOM（`#hud-hint`・`.menu-controls` は両モード共通の固定文言） | 本編のみ変えるのか、両モード共通で変えるのかを HD-P6 / WI-A2 の承認時に明示 |
| R-5 | 💎🔩 を部分的に直して新たな不整合 | A では触れない（HD-P1 (a)） |
| R-6 | UI-002-B との同時実施 | WI-A5 と `#hud-hint` の変更は、B の入口変更と別の承認・別のコミットにする（HD-3） |
| R-7 | 旧セーブ利用者の体験変化（WI-A3 の発動停止） | HD-P3 で明示的に判断 |
| R-8 | F で操作説明を再度書き直す二度手間 | A は事実誤りの最小修正に限定 |

## 18. Out of Scope

- 実装、source / tests / docs / config / Task file / Decision record / 既存 report の変更（本工程）
- HD-1 / HD-2 の再判断
- 💎 / 🔩 の入手・所持・用途の変更（T-MAT）
- 旧セーブの正規化（T-SAVE）
- docs D-02 の修正（T-DOCS）
- 可視性判定の集約（T-ARCH / C1）
- 武器バッジ（D）、HUD の配置・情報設計（D）
- スキル2サブタブ、鑑定所の名称・再設計（G）
- 操作説明の呼称統一・追記・再設計（F）
- 開発用 UI（B）、見た目（C1 / C2 / E）

## 19. Implementation order（PLANNER PROPOSAL）

```
1. WI-A1  XP / Level（UI のみ）               ← HD-P4 / HD-P7
2. WI-A2 + WI-A3  Skill 3（同一承認単位）     ← HD-P2 / HD-P3
3. WI-A4  一括鑑定                            ← HD-P5（WI-A1 と同じ renderGearPanel のため、A1 と同時でも可）
4. WI-A5  操作説明の事実誤り                  ← HD-P6（UI-002-B とは別コミット）
（別 Task）T-MAT / T-SAVE / T-DOCS / T-ARCH は起票の判断を Human が行う
```

- 各 WI の完了ごとに E2E（Targeted）と撮影を行い、最後に Full Regression（AGENTS.md §14 の判断は各 WI の Planner 詳細化で確定）。

## 20. Open questions

1. 本計画を Task file（`.ai/tasks/UI-002-A.md`）の Work Items 表へ反映する作業は、Human Approval と同時に行うか、その前に Planner が Task file を更新するか（本工程では Task file を変更していない）。
2. `.menu-controls` と `#hud-hint` はテストモードとも共通の固定文言。本編だけ変えるのか、両モードで同じ文言に直すのか。
3. 本編・テストモードの表示差を確かめる E2E を、既存 spec（例: `chapter1-progression.spec.js`）に追記するか、新規 spec にするか。
4. T-MAT / T-SAVE / T-DOCS / T-ARCH を起票する場合、UI-002 の子 Task とするか、独立した Task ID にするか。
5. T-SAVE で扱う旧セーブの範囲（Skill 3・スフィア・ボス能力・未鑑定品・💎🔩）を 1 Task にまとめるか。
