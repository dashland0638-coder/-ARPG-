# UI-002-A Plan v2 — Human Decision 反映・Work Item 固定（Planner / READ ONLY）

Plan: Planner（READ ONLY。source・tests・docs・config・Task file・Decision record・既存 report を変更していない）/ 2026-09-27 / Claude Code セッション

- 本書は `.ai/reports/UI-002-A-plan.md`（v1、commit `7ebea4f0db4e8d4f58479ad5e4ff6074e3f7a515`、blob `ccccf710ea78f1387870e82ffe4a04d842742b95`）の **更新版** である。v1 は変更していない。
- 本書の Human Decision は、Human が本セッションの会話で確定した内容（2026-09-27）を転記したもの。**Decision record（`.ai/decisions/UI-002-human-decisions.md`）にはまだ記録されていない**（本工程では Decision record を変更しない）。
- 記述の区別: **HUMAN DECISION**（Human が確定）/ **FACT**（Analyzer・コードで確認）/ **INFERENCE** / **PLANNER PROPOSAL** / **HUMAN APPROVAL REQUIRED**。

---

## 0. v1 からの変更点

| 項目 | v1（提案） | v2（Human Decision 反映後） |
| --- | --- | --- |
| 第一章の境界 | HD-1 / HD-2 の範囲内で個別に判断 | **第一章ゲームデザイン境界**を Human が確定（§2） |
| 💎 / 🔩 | A では扱わず別 Task T-MAT（HD-P1 (a) 推奨） | **A で扱う（WI-A5）**。第一章では入手・表示・消費・用途のいずれも不要。旧セーブの削除・変換はしない（HD-P1） |
| Skill 3 | WI-A2（UI）と WI-A3（入力・発動）を分け、同一承認単位を推奨 | **WI-A2 に統合**: UI・入力・トースト・警告・発動を第一章本編で停止（HD-P2） |
| 旧セーブの Skill 3 | セーブは変えず本編で使えないだけ（推奨） | 同左で確定（HD-P3） |
| 凡例「Lv不足」 | 「扱えない」への置換を推奨 | Level を意味しない表現に置換。**文言は Planner が候補提示し Human Approval**（HD-P4、§6.1） |
| 一括鑑定 | WI-A4（HD 次第） | **WI-A3 として確定**。第一章に存在しない鑑定導線を含む（HD-P5） |
| 操作説明 | WI-A5（事実誤りのみ、HD 次第） | **WI-A4 として確定**（HD-P6） |
| 撤退「XP+」 | WI-A1 内（HD-P7 推奨） | **確定**: XP 以外の実在報酬だけを表示（HD-P7） |
| 判定の集約 | A は個別修正、集約は T-ARCH（推奨） | 確定: 既存構造で最小限、集約は T-ARCH 等（HD-P8） |
| docs D-02 | T-DOCS（推奨） | 確定: A では修正しない（HD-P9） |
| WI 番号 | A1 XP/Lv、A2 Skill3 UI、A3 Skill3 入力、A4 一括鑑定、A5 操作説明 | **A1 XP/Lv、A2 Skill 3（全面）、A3 一括鑑定、A4 事実誤り、A5 素材** |
| 別 Task 候補 | T-MAT / T-SAVE / T-DOCS / T-ARCH | **T-SAVE / T-DOCS / T-ARCH**（T-MAT は WI-A5 に吸収） |
| 新規の論点 | — | 第一章境界と現行 UI の追加の食い違い（§10: スキル付け替え・鍛冶屋「準備中」等）。**WI には追加していない** |

## 1. Baseline / Artifact identity

| 項目 | 値 |
| --- | --- |
| origin/main HEAD（`git fetch origin` 後） | `70b6ee36859b049d3749766dcefed73bedff06f2` |
| ブランチ | `claude/ui-002-a-planner-v2`（起点 = `origin/claude/ui-002-a-planner` @ `7ebea4f0…`。v1 を含むため、本コミットの差分は v2 の 1 ファイルのみ） |
| working tree（開始時） | clean |
| UI-001 Analyzer | `4830a3804ea0874ae803b951c01dabaad68cfe88`（blob `c976f1c3…`） |
| UI-002 Planner | `eadb5e3cac983cf90911610d6da3deadc0af34a5`（blob `a23563e8…`） |
| UI-002-A Analyzer | `99f1fbd07c474625007a6f90a703d4f70224189d`（blob `583bd83e…`） |
| UI-002-A Planner v1 | `7ebea4f0db4e8d4f58479ad5e4ff6074e3f7a515`（blob `ccccf710…`） |

Artifact Handoff の例外（Human の指示で AI が push、main 外）は A-analysis §3.2 / v1 §2 を踏襲する。

---

## 2. Human Decision（2026-09-27 確定。転記）

### 2.1 第一章のゲームデザイン境界

**第一章にゲームシステムとして存在させないもの**: Level / XP / XP 報酬 / 鑑定武器 / 細かな武器ドロップ / 鑑定用素材 / 能力強化用ダイヤ / スキル強化用ダイヤ / ステータス強化 / スフィア盤ライクな成長システム / スキル習得・変化システム / 本格的な鍛冶・武器強化

**第一章に存在するもの**: 固定武器入手 / 宝箱 / Skill 1 / Skill 2 / Ult / 通常の戦闘報酬 / アイテム購入 / 酒場 / 鍛冶屋は「準備中」という位置付け

**第二章以降で解禁するもの**: スフィア盤ライクな成長システム / キャラクター強化 / スキル習得 / スキル変化 / 鑑定武器 / 武器ドロップ / 鑑定素材 / 各種強化要素（詳細仕様は今回決定しない）

**原則**: 「第一章では存在しない」と「データとして存在してはいけない」は別。第二章以降のデータを削除しない。旧セーブを破壊しない。第一章の実行時だけ使用・表示を抑制する。

### 2.2 HD-P1〜HD-P9

| ID | Human Decision |
| --- | --- |
| HD-P1 | 💎 / 🔩 等の第一章で不要な強化・鑑定系素材は第一章のゲームシステムとして扱わない。入手・表示・消費・用途のいずれも不要。旧セーブから勝手に削除・変換しない。既存セーブの正規化は別 Task |
| HD-P2 | Skill 3 は第一章で使用できないゲーム機能として扱う。HUD ボタン・U キー・十字キー左・タップ入力・関連トースト・関連警告・発動を第一章本編で停止。既存セーブデータの削除・書き換えは行わない |
| HD-P3 | 旧セーブに Skill 3 装着状態が残っていても、セーブデータは変更せず、第一章本編では発動できない。正規化・移行は別 Task 候補 |
| HD-P4 | 第一章では「Lv不足」「レベル未達」などの表現を使わない。別の条件を伝える必要がある場合は Level を意味しない表現に置換。**具体的な文言は Planner が候補を提示し Human Approval を受ける**（Implementer が決めない） |
| HD-P5 | 一括鑑定は第一章本編では不要。本編 UI から除外。第二章以降の鑑定システムの設計は別 Task |
| HD-P6 | 明確な事実誤り（存在しない「鑑定ボタン」「出撃ボタン」、必殺技の「リチャージ制」）は UI-002-A で修正。Skill 1 の呼称・Skill 2 の説明追加・処刑の説明・パッド注記・操作説明全体の再設計は後続 Task |
| HD-P7 | 撤退時 XP+・XP 報酬表示・XP 関連トーストを本編で表示しない。撤退時に残す報酬情報は XP 以外の実在する報酬だけ |
| HD-P8 | 表示可否判定の architecture を全面的に再設計しない。既存構造で最小限。本格的な集約は T-ARCH 等の別 Task 候補。A に必要な最小限の判定変更は許可 |
| HD-P9 | docs/README.md D-02 は UI-002-A では修正しない（T-DOCS 等） |

---

## 3. Work Items（固定）

共通の境界（全 WI）:

- 対象は **第一章本編（`legacyGrowth()` が false）** の実行時の使用・表示だけ。テストモード（`legacyGrowth()` が true）の表示・挙動は変えない。
- `state` の既存フィールド・セーブ形式・保存内容を削除・変換しない（旧セーブを破壊しない）。
- 判定は既存の `legacyGrowth()`（`legacyGrowthEnabled()` のラッパー）を使う。新しい判定の仕組みは導入しない（HD-P8）。
- 見た目・配置・DOM id は変えない（非表示化のための既存パターンの利用は可）。
- ファイルパスは A-analysis で確認したものだけを記載。

### WI-A1 Level / XP 関連 UI・XP 報酬表示の除去

| 項目 | 内容 |
| --- | --- |
| Purpose | 第一章本編から Level / XP を示す UI・文言・報酬表示を除く（HD-1、HD-P4、HD-P7） |
| Scope | (1) HUD の XP バー（`.bar-track.xp` / `#xp-fill`）/ (2) 撤退の確認ダイアログの「XP+n」/ (3) 撤退後トーストの「XP+n」/ (4) 装備タブ凡例「Lv不足」/ (5) まとめて売却確認の「レベル未達」 |
| Out of Scope | `state.xp` / `level` / `xpToNext` の値とセーブ、`grantXP()` の挙動（本編では既に何もしない — FACT）、撤退ボーナスのゴールド計算、装備行の色分けの再設計、第二章以降の成長システム |
| Dependencies | なし |
| Files likely involved | `src/legacy/parts/14-hud-boot.js`（`updateHUD()`）、`src/legacy/parts/10-input.js`（`menu-town` の確認文）、`src/legacy/parts/12-progression-ui.js`（`performRetreat()`、`renderGearPanel()`）、`index.html`（`.bar-track.xp`）、必要なら `src/styles/main.css` |
| Runtime behavior（本編） | XP バーが出ない。撤退の確認とトーストはゴールド（実在する報酬）だけを示す。凡例・売却確認に Level を意味する語が出ない |
| Runtime behavior（テストモード） | 変化なし |
| 状態・セーブ | 変更なし |
| 文言 | §6.1 の候補から Human Approval で確定（HD-P4 / HD-P7） |
| E2E impact | 直接参照なし（`xp-fill` / `Lv不足` / `gear-lv` 0 件）。`mansion-scenario.spec.js:179〜185` は撤退の確認ダイアログの存在と `#confirm-ok` のみ → ダイアログを残す限り影響なし |
| Risk | 共通処理の条件付けでテストモード側の表示を消す（R-3） |

### WI-A2 第一章における Skill 3 の UI・入力・発動停止

| 項目 | 内容 |
| --- | --- |
| Purpose | Skill 3 を第一章本編で使用できないゲーム機能として扱う（HD-2、HD-P2、HD-P3） |
| Scope | (1) HUD ボタン `#btn-skill3` / (2) 操作ヒント `#hud-hint` の「U スキル3」/ (3) U キー / (4) 十字キー左 / (5) タップ入力 / (6) 未装着トースト「鑑定所で装着できます」/ (7) 空中警告「SKILL 3」/ (8) Skill 3 の発動（旧セーブで装着済みでも本編では発動しない） |
| Out of Scope | `learnedBossActiveSkills` / `equippedBossActiveSkill` 等の値とセーブ（削除・書き換えしない）、`BOSS_ACTIVE_SKILLS` の定義、テストモードの Skill 3、Skill 1 / Skill 2 / Ult の表示と挙動、HUD の配置（D） |
| Dependencies | なし |
| Files likely involved | `src/legacy/parts/14-hud-boot.js`（`updateCooldownRings()`）、`index.html`（`#btn-skill3`、`#hud-hint`）、`src/legacy/parts/11-combat-actions.js`（`castBossSkill3()`）、`src/legacy/parts/09-save-load.js`（KeyU）、`src/legacy/parts/13-update-loop.js`（十字キー左）、`src/legacy/parts/10-input.js`（タップのバインド）、必要なら `src/styles/main.css`（既存の `.action-btn.locked`） |
| Runtime behavior（本編） | Skill 3 ボタンが出ない。U / 十字キー左 / タップで何も起こらず、Skill 3 のトースト・警告も出ない。旧セーブで装着済みでも発動しない |
| Runtime behavior（テストモード） | 変化なし |
| 状態・セーブ | 変更なし（装着状態はセーブに残る — HD-P3） |
| 文言 | `#hud-hint` から「U スキル3」を除く（§6.3） |
| E2E impact | 直接参照なし（`btn-skill3` / `skill3` 0 件）。Skill 1 / 2 / Ult の既存アサーション（`chapter1-skill2` / `chapter1-progression` / `chapter1-dusk-basics` / `auto-combo`）は不変であること |
| Risk | `#hud-hint` は両モード共通の固定文言（R-4）。本編のみ変えるか両モード共通で変えるかは Approval 時に確定（§8） |

### WI-A3 一括鑑定の除去

| 項目 | 内容 |
| --- | --- |
| Purpose | 第一章本編の UI から一括鑑定と、第一章に存在しない鑑定導線を除く（HD-P5） |
| Scope | (1) 装備タブの「🔍 一括鑑定」ボタン（`#gear-identify-all-btn`）とその結果トースト / (2) 第一章に存在しない鑑定導線（下表で確定） |
| Out of Scope | 第二章以降の鑑定システム、未鑑定品のデータ、画面名「鑑定所」（G）、装備画面の再設計（F / G） |
| Dependencies | WI-A1 と同じ `renderGearPanel()` を変更する（同時実施・同時レビューが効率的） |
| Files likely involved | `src/legacy/parts/12-progression-ui.js`（`renderGearPanel()`） |
| 状態・セーブ | 変更なし |
| E2E impact | 直接参照なし（`identify` 0 件）。`character-weapon-visual.spec.js:81` は装備タブを開くだけ |
| Risk | 旧セーブの未鑑定品の扱い（下表） |

「第一章に存在しない鑑定導線」の候補（**HUMAN APPROVAL REQUIRED**）:

| 導線 | 現状（FACT） | 候補 |
| --- | --- | --- |
| 一括鑑定ボタン | 本編で常時表示 | 除外（HD-P5 で確定） |
| 旧セーブ所持の未鑑定品の行・個別「鑑定 🪙n」ボタン・「鑑定するまで効果は分からない」 | 旧セーブの所持品がある時だけ表示。本編では新たに発生しない | (a) 本編では未鑑定品の行ごと表示しない（データは残す）/ (b) 行は残し、鑑定ボタンだけ出さない / (c) 現状維持（旧セーブの互換として残す） |
| Planner 推奨 | — | **(a)**。第一章に鑑定武器は存在しないため。データは残り、テストモード・第二章以降で扱える |

### WI-A4 第一章 UI の明確な事実誤りの修正

| 項目 | 内容 |
| --- | --- |
| Purpose | 存在しない UI・誤った仕組みを案内している記述を正す（HD-P6） |
| Scope | メニュー操作説明 `.menu-controls` の (1)「鑑定ボタン」/ (2)「出撃ボタン」/ (3) 必殺技の「リチャージ制」 |
| Out of Scope | Skill 1 の呼称（溜め攻撃）、Skill 2 の説明追加、処刑の説明、パッド注記、操作説明全体の再設計（→ F）、`#hud-hint` の「Q・E」（→ D）、デバッグキー（→ B） |
| Dependencies | なし。**UI-002-B の入口変更と同じコミットにしない**（HD-3） |
| Files likely involved | `index.html`（`.menu-controls`） |
| 状態・セーブ | 変更なし |
| 文言 | §6.2 の候補から Human Approval で確定 |
| E2E impact | 直接参照なし（`menu-controls` 0 件） |
| Risk | `.menu-controls` は両モード共通の固定文言（R-4） |

### WI-A5 鑑定・強化系素材の本編 UI 表示・報酬導線の整理

| 項目 | 内容 |
| --- | --- |
| Purpose | 第一章で不要な 💎 魔宝石 / 🔩 武具の欠片を、第一章本編で入手・表示しない（HD-P1） |
| Scope | 下表の表示箇所と入手導線（本編のみ） |
| Out of Scope | `state.inventory.gem` / `shard` の値とセーブ（削除・変換しない）、テストモードの入手・表示・消費、第二章以降の素材仕様、LOOT_TABLE 等の定義の削除 |
| Dependencies | なし（WI-A1 と同じ結果画面・宝箱処理に触れないが、`12-progression-ui.js` は共通） |
| Files likely involved | `src/legacy/parts/08-loot-equipment.js`（`rollCommonChestLoot()`、`addItem()`）、`src/legacy/parts/12-progression-ui.js`（`showBossResultScreen()`、`refreshAppraisal()`）、`src/legacy/parts/10-input.js`（`refreshMenuStats()`）、`index.html`（`.menu-mats`、`.appraisal-currency`） |
| 状態・セーブ | 所持数・セーブ内容は変更しない。本編で **増えなくなる**（入手停止）ことは HD-P1 の範囲内のゲーム挙動の変更 |
| E2E impact | UI 参照なし（`menu-gem` / `ap-gem` / `魔宝石` / `result-loot` の E2E 参照 0 件）。セーブ fixture の `gem` / `shard` フィールドは値として残るのみ |
| Risk | ボス報酬の戦利品行（固有名）の扱い（R-5）、宝箱の中身が減ることの体験（R-6） |

素材の表示・入手箇所（FACT → 候補）:

| # | 箇所 | 現状（FACT） | 候補（**HUMAN APPROVAL REQUIRED** の項目に ★） |
| --- | --- | --- | --- |
| M-1 | メニュー「所持素材」の 💎 / 🔩 | 本編で表示（`#menu-gem` / `#menu-shard`） | 本編では 💎 / 🔩 を表示しない（🪙 は残す） |
| M-2 | 鑑定所ヘッダの 💎 | 本編で表示（`#ap-gem`） | 本編では表示しない（🪙 は残す） |
| M-3 | 宝箱の中身（`rollCommonChestLoot()` の 55% 分岐） | 本編でも 💎 / 🔩 を 1〜2 付与、トースト | 本編では付与せずトーストも出さない。★ その分を別の報酬（ゴールド等）に置き換えるか否か |
| M-4 | ボス撃破報酬 `rewardLoot`（全ボス `type:'gem'`、固有名「主の袖飾り」等） | 本編でも 💎+1、結果画面に「💎 主の袖飾り ×1」の行、取得ポップ | ★ (a) 本編では付与せず行も出さない / (b) 付与せず、結果画面に固有名の行だけを「記念の品」として残す（所持・用途なし）/ (c) 付与しないが別の報酬に置き換える |
| M-5 | 通常ドロップ（`pickLoot()`） | 本編では既に出ない（`LEGACY_LOOT_TYPES`、FACT） | 変更なし |
| M-6 | 消費（ランク上げ・パッシブ・武具強化） | 本編では既に到達不可（FACT） | 変更なし |
| Planner 推奨 | — | — | M-1〜M-3 は表の通り。M-3 の置き換えは **なし**（ゴールド・薬の既存抽選はそのまま）。M-4 は **(a)**（第一章に素材が存在しないため）。ただし固有名が物語上の意味を持つかは Human の判断が要る |

---

## 4. Scope / Out of Scope（Task 全体）

**Scope**: WI-A1〜WI-A5（§3）。第一章本編の実行時の使用・表示の抑制。

**Out of Scope**:

- UI 全体の visual redesign、Combat HUD の全面再設計（D）、Character / Equipment 画面の全面再設計（F）、Tavern UI（G）、Notification / Result の visual redesign（H）、Design system（C1 / C2）、Icon system（E）、Final responsive（I）
- 第二章以降の成長・鑑定・素材システムの設計
- 旧セーブの正規化（T-SAVE）
- docs/README.md の修正（T-DOCS）
- 表示可否判定の全体的な集約（T-ARCH）
- 武器バッジ（D）、スキル2サブタブ（G）
- §10 の新規論点（WI に追加していない）

## 5. Dependencies

```
WI-A1 ──┐（renderGearPanel を共有）
WI-A3 ──┘
WI-A2（独立）
WI-A4（独立。UI-002-B とは別コミット）
WI-A5（独立。12-progression-ui.js は A1 と共有）
```

- 他 Task への依存なし（UI-002-B / C1 と独立。Decision record HD-5 の依存関係どおり）。
- UI-002-D は A の結果を前提にする（Skill 3 が HUD から消えた状態で配置を設計）。

## 6. 文言候補（HUMAN APPROVAL REQUIRED。Implementer は決めない）

### 6.1 WI-A1（HD-P4 / HD-P7）

| 箇所 | 現在 | 候補 A | 候補 B |
| --- | --- | --- | --- |
| 装備タブ凡例（本編） | 装備可 / Lv不足 / 装備中 | 装備可 / **装備できない** / 装備中 | 装備可 / **この職では使えない** / 装備中 |
| 装備ボタン（本編、既存） | 扱えない（本編は既にこの文言 — FACT） | 変更なし | 凡例に合わせる |
| まとめて売却の確認（本編） | 「⭐特殊効果武器・レベル未達で装備できない品は対象外です。」 | 「⭐特殊効果武器・装備できない品は対象外です。」 | 「⭐特殊効果武器と、今の職で使えない品は対象外です。」 |
| 撤退の確認（本編） | 「撤退ボーナス: XP+n 🪙+n(このダンジョンでの撃破数から算出)」 | 「撤退ボーナス: 🪙+n(このダンジョンでの撃破数から算出)」 | 「持ち帰れる金貨: 🪙+n」 |
| 撤退後トースト（本編） | 「🏳️ 撤退ボーナス: XP+n 🪙+n」 | 「🏳️ 撤退ボーナス: 🪙+n」 | 「🏳️ 金貨 n 枚を持ち帰った」 |

- **FACT**: 本編で装備できない理由は武器種だけ（`canEquipItem()` の Level 条件は `legacyGrowth()` 時のみ）。
- 候補の emoji（🪙 🏳️）は現行の表記を踏襲したもので、アイコン化は E の範囲。

### 6.2 WI-A4（HD-P6）

| 箇所 | 現在 | 候補 A（語を削除） | 候補 B（実在の導線に置換） |
| --- | --- | --- | --- |
| 鑑定所の行 | 鑑定所(街の近くで): I / 十字キー下 / 鑑定ボタン | 鑑定所(街の近くで): I / 十字キー下 | 鑑定所(鍛冶士の前で): I / 十字キー下 / 画面下のメッセージをタップ |
| 出撃の行 | 出撃メニュー(街で): F / 十字キー上 / 出撃ボタン | 出撃メニュー(街で): F / 十字キー上 | 出撃メニュー(店主の前で): F / 十字キー上 / 画面下のメッセージをタップ |
| 必殺技の行 | 必殺技: K / R2・RT / 必殺ボタン(リチャージ制) | 必殺技: K / R2・RT / 必殺ボタン(ゲージ制) | 必殺技: K / R2・RT / 必殺ボタン(ゲージが溜まると使用可) |

- **FACT**: 鑑定所・出撃はいずれも NPC から 3m 以内でのみ開き、タッチでは `#interact-btn`（画面下のメッセージ）から開ける。候補 B はこの実在の導線を記述するもの。候補 A は語を消すだけで、タッチ利用者向けの導線が記述から無くなる。

### 6.3 WI-A2

| 箇所 | 現在 | 候補 |
| --- | --- | --- |
| `#hud-hint` | … / O スキル2 / U スキル3 / Shift 回避 / … | 「U スキル3 /」を削除（他は変更しない） |

## 7. E2E impact（まとめ）

| WI | 既存 E2E / unit の直接参照 | 影響 |
| --- | --- | --- |
| A1 | なし。`mansion-scenario.spec.js` は撤退の確認ダイアログの存在のみ | 低 |
| A2 | なし。Skill 1 / 2 / Ult のアサーションは不変 | 低 |
| A3 | なし | 低 |
| A4 | なし | 低 |
| A5 | なし（fixture の値のみ） | 低 |
| unit | `chapter1-rules.test.js` 等は判定関数を変えない限り影響なし | 低 |

- **PLANNER PROPOSAL（検証）**: 本編とテストモードの両方で対象 UI の有無・Skill 3 入力の無反応・素材の非表示を確かめる E2E を追加する。追加先（既存 spec への追記 / 新規 spec）は Approval 時に Files To Change として確定する（**HUMAN APPROVAL REQUIRED**）。撮影は 1280×800 / 844×390、本編・テストモード。
- ボス撃破・宝箱開封を E2E で再現する既存手段は、Implementer 段階の確認対象（INFERENCE: 既存 spec にボス撃破まで進むものは限られる）。

## 8. Legacy save boundary

| 旧セーブに残りうるもの | 本 Task での扱い | 正規化 |
| --- | --- | --- |
| Skill 3 の習得・装着 | 残す。第一章本編では発動・表示しない（WI-A2） | T-SAVE |
| 💎 / 🔩 の所持数 | 残す。第一章本編では表示しない・増えない（WI-A5） | T-SAVE |
| 未鑑定品・Lv 付き装備 | 残す。本編での表示は WI-A3 の Approval 結果に従う | T-SAVE |
| XP / Level / 振り分け / スフィア解放 / ボス能力 | 残す（本 Task は表示のみ扱う） | T-SAVE |

- セーブの書き込み（`buildSaveData()`）は、読み込んだ値をそのまま書き戻す現行動作を変えない（INFERENCE: 本編で値を参照しなくなるだけで、保存時に消えることはない — Implementer で確認）。
- **FACT（v1 から継続）**: 旧セーブのスフィア解放・ボス能力は本編の戦闘値に効く（`sphereValue()` / `bossAbilityValue()` に分岐なし）。第一章境界（ステータス強化・スフィア盤は存在しない）と食い違うが、UI ではなく状態・戦闘値の問題のため **本 Task の範囲外**（§10 N-5、T-SAVE または別 Task）。

## 9. 第二章以降との境界

| 仕組み | 第一章本編（本 Task 後） | テストモード | 第二章以降 |
| --- | --- | --- | --- |
| Level / XP | 表示・報酬表示なし | 現状どおり | 解禁予定（詳細未定） |
| Skill 3 | 使用不可（表示・入力・発動なし） | 現状どおり | 未定（Decision record に解禁の記述なし） |
| 鑑定 | 一括鑑定なし（未鑑定品の扱いは WI-A3） | 現状どおり | 鑑定武器を解禁予定 |
| 💎 / 🔩 | 入手・表示なし | 現状どおり | 鑑定素材・強化要素として解禁予定 |
| 判定 | `legacyGrowth()` による既存判定 | 同左 | 第二章用の判定は未定。`legacyGrowth()` が「テストモード＝旧仕様」と等価である現状は変えない（T-ARCH で検討） |

- **INFERENCE**: 現在の判定は「テストモードかどうか」だけで、「第二章かどうか」は表現できない。第二章解禁時は判定の再設計が必要になる可能性が高い（T-ARCH の論点）。

## 10. 第一章境界と現行 UI の追加の食い違い（新規論点。WI には追加していない）

Human が確定した第一章境界（§2.1）に照らすと、WI-A1〜A5 以外にも次の食い違いがある。Human が固定した WI 構成を変えないため、**判断を Human に委ねる**（本 Task に WI を追加する / 後続 Task へ送る）。

| # | 論点 | 現状（FACT） | 第一章境界との関係 | 送り先候補 |
| --- | --- | --- | --- | --- |
| N-1 | Skill 1 の付け替え | 鑑定所スキルタブで Skill 1 を複数の技から選べる（A-analysis §9、G-10） | 「スキル習得・変化システム」は第一章に存在しない | WI-A6 追加 / G |
| N-2 | 鍛冶屋の位置付け | 酒場の鍛冶士（加入前は仮設作業台）から、装備・スキル・商店の 3 タブが本編で機能する | 「鍛冶屋は準備中」「アイテム購入は存在する」 | G（鍛冶士画面・商店の置き場所の再設計）/ WI 追加 |
| N-3 | 装備タブの操作（最強装備・まとめて売却・外す） | 本編で表示。本編では武器ドロップが無く、所持品は初期装備と旧セーブ所持品 | 「固定武器入手」のみ、細かな武器ドロップなし | G / F |
| N-4 | スキル2・必殺技の選択肢（alt） | `unlockedSkill2Alt` / `unlockedUltAlt` が立っている旧セーブでは本編でも付け替え可（新規では固定） | 「スキル変化」は存在しない | T-SAVE / G |
| N-5 | 旧セーブのスフィア解放・ボス能力の戦闘効果 | 本編でも効く（§8） | 「ステータス強化」「スフィア盤」は存在しない | T-SAVE / 別 Task |
| N-6 | 画面名「鑑定所」 | 本編でも「鑑定所」 | 鑑定は第一章に存在しない | G（UI-002 Planner の HD-18 候補） |

## 11. Human Approval が必要な項目

| # | 項目 | 該当 |
| --- | --- | --- |
| AP-1 | 各 WI の承認（Scope / Files To Change / Persistence） | WI-A1〜A5 |
| AP-2 | WI-A1 の文言（凡例・売却確認・撤退の確認・撤退トースト） | §6.1 |
| AP-3 | WI-A4 の文言（候補 A / B） | §6.2 |
| AP-4 | WI-A3 の旧セーブ未鑑定品の扱い（(a) / (b) / (c)） | §3 WI-A3 |
| AP-5 | WI-A5 の宝箱の置き換え有無、ボス報酬の固有名行の扱い（(a) / (b) / (c)） | §3 WI-A5 M-3 / M-4 |
| AP-6 | 固定文言（`#hud-hint`・`.menu-controls`）を本編だけ変えるか、両モード共通で変えるか | WI-A2 / A4 |
| AP-7 | 検証用 E2E の追加先（既存 spec 追記 / 新規 spec）と tests の変更許可 | §7 |
| AP-8 | §10 N-1〜N-6 の送り先（WI 追加か後続 Task か） | §10 |
| AP-9 | 本日の Human Decision（§2）を Decision record に記録するか（本工程では未記録） | §2 |
| AP-10 | 承認単位（WI ごと、または A1＋A3 など組み合わせ） | §5 |

## 12. Acceptance Criteria 案

| ID | 基準（本編 = 第一章通常プレイ、テストモード = 現状維持） |
| --- | --- |
| AC-A1 | 本編: HUD に XP バーが無い。撤退の確認・トーストに XP が無く、実在する報酬（ゴールド）だけが出る。装備タブ・売却確認に Level を意味する語が無く、AP-2 で承認された文言が表示される。テストモード: 従来どおり |
| AC-A2 | 本編: Skill 3 ボタンが無い（1280×800 / 844×390、PC・タッチ）。`#hud-hint` に Skill 3 の記述が無い。U / 十字キー左で何も起こらず、Skill 3 のトースト・警告が出ない。旧セーブで装着済みでも発動しない。セーブ内容は変わらない。Skill 1 / Skill 2 / Ult の表示・挙動は変わらない。テストモード: 従来どおり |
| AC-A3 | 本編: 一括鑑定ボタンが無い。旧セーブ未鑑定品は AP-4 で承認された扱いになる。未鑑定品のデータは残る。テストモード: 従来どおり |
| AC-A4 | メニュー操作説明に「鑑定ボタン」「出撃ボタン」が無く、必殺技の記述がゲージ制と一致する（AP-3 の文言） |
| AC-A5 | 本編: メニュー・鑑定所ヘッダに 💎 / 🔩 が無い。宝箱・ボス撃破で 💎 / 🔩 が増えず、入手トーストも出ない（ボス報酬行は AP-5 の扱い）。所持数・セーブ内容は変わらない。テストモード: 入手・表示・消費が従来どおり |
| AC-A0 | 見た目・配置・DOM id が変わらない。旧セーブの値が削除・変換されない。既存 E2E / unit が全件通る。1280×800 / 844×390 で本編・テストモードの撮影が揃う |

## 13. Risks

| # | リスク | 対策（PLANNER PROPOSAL） |
| --- | --- | --- |
| R-1 | Skill 3 の入力停止の漏れ（入力経路が 3 系統＋発動関数） | 発動関数（`castBossSkill3()`）の入口で本編を止め、入力側はそれに委ねる形を Implementer の Planner 詳細化で検討。全経路を E2E で確認 |
| R-2 | 判定の分散が増える（HD-P8 により個別修正） | 追加した分岐の一覧を Implementation Result に残し、T-ARCH の入力にする |
| R-3 | テストモード側の退行 | 本編・テストモードの両方を E2E で確認 |
| R-4 | 固定文言が両モード共通 | AP-6 で明示 |
| R-5 | ボス報酬の固有名（物語上の戦利品）の見え方が変わる | AP-5 |
| R-6 | 宝箱の中身が減り、開封時の報酬が少なく感じる | AP-5（置き換えの有無） |
| R-7 | 旧セーブの値は残るため、第二章解禁時・テストモードで再び表示される | 仕様どおり（HD-P1 / HD-P3）。T-SAVE で扱いを決める |
| R-8 | §10 の新規論点が未決のまま A が完了し、「第一章境界」が部分的にしか満たされない | AP-8 で送り先を決める |
| R-9 | UI-002-B との同時実施 | WI-A2（`#hud-hint`）・WI-A4 は B と別コミット（HD-3） |

## 14. 次に行うべき工程（提案）

1. Human: AP-9（本日の Human Decision を Decision record に記録するか）と AP-8（§10 の送り先）を判断。
2. Planner: Human の判断を受けて、Task file `.ai/tasks/UI-002-A.md` に Work Items 表（WI-A1〜A5、各 Approval 欄は未チェック）と `Analysis:` 行（A-analysis の branch @ SHA・blob）を反映する（Task file の更新は Human の指示を受けてから）。
3. Human: WI ごとに AP-1〜AP-7、AP-10 を決めて Human Approval（Persistence を含む）。
4. Implementer: 承認された WI だけを実装 → Test → Reviewer。
