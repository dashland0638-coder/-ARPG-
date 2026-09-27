# UI-002-A Review（WI-A1〜WI-A5）

## 1. Reviewer

| 項目 | 値 |
| --- | --- |
| Reviewer | Claude Code セッション（Reviewer 役） |
| 独立性 | **同一セッションで兼務**（UI-001 Analyzer 〜 UI-002-A Implementer と同じセッション。AGENTS.md §5）。判断は Implementation SHA 時点の Task / Decision record / diff / 再実行したテスト結果だけに基づいて行った |
| 推奨 | 兼務のため、**人間による差分確認を推奨する**（特に §14 の F-1〜F-3） |
| 日付 | 2026-09-27 |

## 2. Implementation SHA

| 項目 | 値 |
| --- | --- |
| Implementation SHA | `aa29d4c9c8d137b92423b9099ba3f525aaa2e7c4`（判定対象として固定） |
| Branch | `claude/ui-002-a-impl` |
| Diff range | `7d4afa79864fbc3be55b47e7c3df8bace6c83b56..aa29d4c9c8d137b92423b9099ba3f525aaa2e7c4` |
| Handoff 後の commit | `f38e50665799e78278200d4f07c89de09b5cde0f`（Handoff 文書・Task file の Status のみ。**実装内容として扱っていない**。`git diff --name-only aa29d4c f38e506` = `.ai/reports/UI-002-A-review-handoff.md`、`.ai/tasks/UI-002-A.md`） |

Review Handoff の検証（AGENTS.md §5.1、Reviewer が再計算）:

| # | 結果 |
| --- | --- |
| V-1 | OK: `git merge-base --is-ancestor aa29d4c origin/claude/ui-002-a-impl` 成功 |
| V-2 | OK: `aa29d4c:.ai/tasks/UI-002-A.md` が存在。Implementation Result に Plan Handoff（Kind `plan`）の記録は無い（V-2a 対象外） |
| V-3 | OK: Task file の Work Items と各 WI の Approval（計画の正本） |
| V-4 | OK: V-4a `git rev-parse aa29d4c:.ai/reports/UI-002-A-analysis.md` = `583bd83e937b748fb5a17e330591f49897aeb8dd`（`Analysis:` 行の blob と一致）。V-4b `99f1fbd` は `origin/claude/ui-002-a-analysis` から到達可能 |
| V-5 | OK: Task file の「Implementation Result（WI-A1〜WI-A5）」 |
| V-6 | OK: 10 files changed、終点 = Implementation SHA |

## 3. Review 対象範囲

- 正本: `.ai/tasks/UI-002-A.md`（`aa29d4c` 時点）の各 WI の Human Approval（WI-A3 の承認範囲の明確化、WI-A5 の結果画面の追記を含む）、`.ai/decisions/UI-002-human-decisions.md`（第一章境界、HD-P1〜HD-P9（HD-P6 改訂後）、AP-5 / AP-8 / AP-10、WI-A5 結果画面、Persistence）
- 実装差分: `index.html`、`src/legacy/parts/08-loot-equipment.js`、`10-input.js`、`11-combat-actions.js`、`12-progression-ui.js`、`14-hud-boot.js`、`tests/chapter1-legacy-ui.spec.js`
- 関連する既存ソース（`aa29d4c` 時点）: `legacyGrowth()`（01）、`castBossSkill3()` の呼び出し元（09 KeyU、13 十字キー左、10 タップ）、`applyBossActiveSkillEffect()`、`addItem()` / `grantItem()` の全呼び出し元（02 異空間報酬、07 撃破・ミミック、08 宝箱・床ドロップ、12 ボス報酬）、`identifyEquipment()` / `identifyAllEquipment()` の呼び出し元、酒場の鍛冶士 / 仮設作業台（03 `buildTavern()`、02 `updateBartenderProximity()`）、`main.css` の `.action-btn.locked` / `#touch-controls.gamepad-min`
- 再実行したテスト: §12

## 4. WI-A1 判定: **PASS**

| 確認項目 | 結果 | 根拠 |
| --- | --- | --- |
| XP バーが表示されない | OK | `finishEnteringGame()` で `state.testMode` 確定後に `#xp-fill` の親を本編のみ非表示。新規 E2E で確認（再実行 PASS） |
| 撤退確認に XP+ が出ない | OK（コード） | 10-input.js `menu-town`: 本編では `XP+n` を出さず `🪙+n` のみ |
| 撤退トーストに XP+ が出ない | OK（コード） | 12 `performRetreat()`: 本編は `🏳️ 撤退ボーナス: 🪙+n` |
| 「Lv不足」が修正 | OK | 凡例は本編で「装備できない」。装備ボタンの「Lv不足」は元から `legacyGrowth()` 時のみ（本編は「扱えない」） |
| 「レベル未達」が本編に残らない | OK | まとめて売却確認から本編のみ「レベル未達で」を除去。他の Lv 表記は `legacyGrowth()` ガード済み、または本編で非表示の DOM（ステ振り・出撃の Lv）内（`aa29d4c` を grep） |
| 実在する報酬のみ | OK | 本編のゴールドは `grantGold()` で実際に付与される |
| XP +0 等を追加していない | OK | 追加なし |
| Level / XP の state を削除・変換していない | OK | 差分に state の代入なし。`grantXP()` は未変更（本編では元から何もしない） |
| 旧セーブを変更していない | OK | 新規 E2E（旧セーブ）で保存後も `xp: 30` を確認 |
| Chapter 2 以降の成長システム | 変更なし | 成長系の定義・計算に差分なし |
| Test Mode | 変更なし | 全分岐が `legacyGrowth()` true 側で従来処理。新規 E2E（テストモード）で XP バー表示を確認 |

## 5. WI-A2 判定: **PASS**

| 経路 | 結果 | 根拠 |
| --- | --- | --- |
| HUD | OK | `updateCooldownRings()` で本編のみ既存 `.locked`（`display:none`）を付与。`#touch-controls.gamepad-min .action-btn` は display を指定しないため上書きされない（main.css 確認） |
| 操作ヒント | OK | `#hud-hint-skill3` を本編のみ非表示 |
| U キー / 十字キー左 / タップ | OK | 3 経路とも `castBossSkill3()`（09:334、13:54、10:130）を呼び、関数冒頭の `if(!legacyGrowth()) return;` で停止 |
| activation | OK | `applyBossActiveSkillEffect()` と `bossSkill3CD` の設定は `castBossSkill3()` 内のみ（`aa29d4c` を grep） |
| Toast / warning | OK | 未装着トーストと `blockedInAir('SKILL 3')` はいずれもガードより後。新規 E2E で U 押下後に「スキル3」が出ないことを確認 |
| 旧セーブの Skill 3 state | OK | state / セーブ処理に差分なし |
| Test Mode | 維持 | 新規 E2E（テストモード）でボタン・ヒント表示、U でトースト到達を確認 |
| HUD デザイン | 変更なし | CSS 差分なし。既存クラスの付与のみ |

## 6. WI-A3 判定: **PASS**（F-2 を Human 確認推奨）

| 確認項目 | 結果 | 根拠 |
| --- | --- | --- |
| 一括鑑定を利用できない | OK | 本編ではボタンを描画しない。`identifyAllEquipment()` も本編で `{total:0,…}` を返す |
| 個別鑑定操作を利用できない | OK | 本編では行内の「鑑定 🪙n」ボタンを描画しない |
| 鑑定処理自体が実行されない | OK | `identifyEquipment()` 冒頭で本編なら `false`（呼び出し元はパネルの 2 箇所のみ） |
| 未鑑定品データを破壊しない | OK | 新規 E2E（旧セーブ）で保存後も `identified:false` のまま残る |
| 未鑑定品の表示行は維持 | OK（解釈は F-2） | 行（`未鑑定の装備`・`鑑定するまで効果は分からない`・アイコン・行の枠）は維持。新規 E2E で行 1 件を確認 |
| 「鑑定所」の画面名 | 変更なし | `index.html` の見出し未変更 |
| 鍛冶士画面の名称・構成 | 変更なし | タブ構成・装備 / スキル / 商店に差分なし |
| UI-002-G の先取り | なし | |
| Test Mode | 維持 | 新規 E2E（テストモード）で一括鑑定ボタンの存在を確認 |

**「行内の鑑定ボタンだけを削除」の承認整合（独立判断）**:

- 承認範囲の明確化 (3) は「WI-A3 が変更するのは次のみ: … Chapter 1 で鑑定操作へ直接進む導線 / Chapter 1 で鑑定操作を実行できる状態」。行内の「鑑定 🪙n」ボタンは、未鑑定品から鑑定操作へ **直接** 進む唯一の導線であり、(3) に該当する。
- 明確化 (2) は「未鑑定品の『表示行そのもの』は WI-A3 では変更せず、既存の表示を維持する（**表示する／しないの新たな仕様判断は行わない**）」。括弧書きから、(2) が保護しているのは「行を表示するか否か」および行の表示内容と読める。実装は行の表示可否・名前・説明を変えていない。
- したがって本実装は (2)(3) の両方に整合すると判断する。ただし、行のアクション欄が空になる（見た目の一部が変わる）ため、(2) の「既存の表示を維持」をより厳密に読む余地がある（F-2）。

## 7. WI-A4 判定: **FAIL**（CHANGES_REQUIRED、F-1）

| 確認項目 | 結果 | 根拠 |
| --- | --- | --- |
| 「鑑定ボタン」の修正 | 修正済み | 「画面下のメッセージをタップ」（`#interact-btn`。実在の導線、10-input.js / 02 `interact()` → `toggleAppraisal()`） |
| 「出撃ボタン」の修正 | 修正済み | 同上（`interact()` → `toggleScenarioSelect()`）。「(店主の前で)」は店主から 3m 以内の条件と一致 |
| Skill 1「溜め攻撃」 | 修正済み | 「スキル1: L / Y・△ / スキルボタン」。L=`skillInputDown`、Y=`gp.buttons[3]`、タッチ=`#btn-charge`（実装と一致） |
| Ult「リチャージ制」 | 修正済み | 「戦ってゲージを溜めると使える」（`ultGauge` の充填と一致） |
| Skill 2 | 追加 | 「スキル2: O / L2・LT / スキル2ボタン(閃いた後に使える)」。O=`castSkill2`、L2=`gp` 6、`#btn-skill2` は `hasSkill2()` まで非表示（一致） |
| 架空のボタン名 | なし | 「スキルボタン」「スキル2ボタン」は実在の `#btn-charge` / `#btn-skill2` を、既存の「必殺ボタン」（アイコンのみのボタン）と同じ呼び方で指している |
| Skill 1 / Skill 2 の機能 | 変更なし | 入力処理に差分なし |
| 新しい操作体系 | 追加なし | |
| 「チャージ攻撃」 | 復活なし | |
| 「鑑定所でタイプ変更可」の削除 | 承認範囲内と判断 | 承認 (3)「Skill 1 を『溜め攻撃』と説明している旧文言 → 現在の Skill 1 の実際の仕様に合わせた説明へ修正」の対象行に含まれる付記。第一章境界（スキル変化は存在しない）とも整合。Skill 1 付け替えの機能は未変更（N-1 → UI-002-F） |
| Test Mode | 挙動の変更なし | `.menu-controls` は両モード共通の固定文言で、文言のみ変わる。Test Mode 専用の説明・デバッグ UI は未変更 |
| **現在実装されている操作と説明が一致** | **不一致（F-1）** | 下記 |

**F-1（WI-A4、仕様不一致）**: 新しい文言「鑑定所(**鍛冶士の前で**): I / 十字キー下 / 画面下のメッセージをタップ」は、Chapter 1 の序盤（森の洋館をクリアして鍛冶士が加入するまで、`state.smithJoined === false`）の実装と一致しない。この間、同じ位置には鍛冶士ではなく **「仮設の作業台」** が置かれ（03 `buildTavern()`、`state.smithJoined` 分岐）、インタラクトの表示も「🧰 仮設の作業台(鑑定・強化)」になる（02 `updateInteractPrompt()`）。新規ゲームの開始時点（剣士・洋館前）がまさにこの状態であるため、本編の最初に読む操作説明が実際の案内と食い違う。WI-A4 の承認条件「実際の UI / 操作方法に対応する説明を使う」「旧 UI 文言を現在のゲーム仕様に合わせて修正する」に照らし、新たな事実不一致を持ち込んでいると判断する。（修正方法の決定は Implementer / Human。例: 鍛冶士と仮設の作業台の両方を含む表現にする、場所の注記を元の粒度に戻す等。Reviewer は新しい仕様を決めない）

## 8. WI-A5 判定: **PASS**

| 確認項目 | 結果 | 根拠 |
| --- | --- | --- |
| 通常 UI に 💎 / 🔩 が出ない | OK | メニュー「所持素材」の 💎 / 🔩（`refreshMenuStats()`）と鑑定所見出しの 💎（`#ap-gem-wrap`）を本編のみ非表示。新規 E2E で確認 |
| 新規取得されない | OK（コード） | `grantItem()` / `addItem()` の冒頭で本編かつ `LEGACY_LOOT_TYPES`（shard / gem）なら何もしない。呼び出し元は宝箱（08 `rollCommonChestLoot()` は本編で素材抽選自体を行わない）、ボス報酬（12）、ミミック撃破（07）、通常撃破（07、`pickLoot()` は元から本編で素材 0）、床ドロップ（08）、異空間報酬（02）――すべてこの 2 関数を通る |
| 強化導線が出ない | OK | パッシブ・ランク上げ・ステ振り・スフィアは既存の `LEGACY_AP_TABS` / `LEGACY_SKILL_SUBTABS` で本編非表示（未変更） |
| 既存セーブの所持数 | 保持 | 新規 E2E（旧セーブ）で保存後も `gem: 7` / `shard: 5` |
| 自動置換なし | OK | 宝箱の素材分岐は本編で丸ごと行わないだけで、別報酬を足していない |
| ミミック・異空間 | 承認範囲と整合 | 承認「新規取得する処理を発生させない」に対し、全取得経路で加算されない。ミミック・異空間ではトースト「異空間の宝を手に入れた!」や金貨・装備は従来どおり（素材以外は未変更） |
| 付与されない報酬行を結果画面に出さない | OK（コード） | `showBossResultScreen()`: 本編かつ素材型の `loot` は行を出さない。全ボスの `rewardLoot` が `type:'gem'` のため本編ではボス報酬行が出ない |
| 報酬名を変更していない | OK | `rewardLoot` の定義に差分なし |
| Test Mode | 維持 | 全分岐が `legacyGrowth()` true 側で従来処理。新規 E2E（テストモード）でメニューの 💎 / 🔩 表示を確認 |

## 9. 仕様適合性

- WI-A1 / A2 / A3 / A5: Human Approval（Task file）と Decision record（第一章境界、HD-P1〜P9、AP-5、WI-A5 結果画面）に適合。
- WI-A4: F-1 の不一致あり。その他の 4 項目は適合。
- 判定方式: すべて既存の `legacyGrowth()` を使用（HD-P8「既存構造で最小限」に適合）。新しい判定の仕組み・モジュールの追加なし。

## 10. Scope 逸脱

| 項目 | 結果 |
| --- | --- |
| CSS | 変更なし（差分に `*.css` なし） |
| 既存 DOM ID | 変更・削除なし（`#hud-hint`、`#ap-gem`、`#xp-fill`、`#btn-skill3` などは維持） |
| 新規 DOM | `#hud-hint-skill3`（WI-A2 の操作ヒント非表示用）、`#ap-gem-wrap`（WI-A5 の見出し非表示用）の囲み span 2 つ。いずれも承認範囲の目的に必要な最小限 |
| セーブデータ形式 | 変更なし（`09-save-load.js` に差分なし） |
| Chapter 2 以降 | 影響する差分なし（成長・鑑定・素材の定義・計算は未変更） |
| Test Mode | 影響なし（§11 参照） |
| UI-002-F / G 等の先取り | なし（鑑定所の名称・タブ構成、Skill 1 付け替え、装備操作は未変更） |
| 同梱の `.ai/reports/UI-002-A-analysis.md` / `UI-002-A-plan-v2.md` | blob 一致、内容変更なし（Artifact Handoff I-1） |

## 11. Regression

- 本編以外の経路: 追加した分岐はすべて `legacyGrowth()`（= `state.testMode`）で、テストモードでは変更前と同じ処理を通る。
- 既存 FAIL（`mansion-escort` Relaxed Stance）は変更前後で同じ値・同じ頻度で失敗する（§12）ため、本実装による回帰とは判断しない。
- FLAKY 2 件は変更前後の両方で PASS・FAIL の両方が出る / 出うる挙動で、本実装に起因する一貫した失敗は確認されなかった（§12）。

## 12. Test 結果の評価

Reviewer は `aa29d4c`（実装）と `7d4afa7`（変更前）をそれぞれ別の git worktree（リポジトリ外の scratchpad）に展開して再実行した。Playwright は Handoff と同じく、リポジトリ外の設定でブラウザ実行パスのみ差し替えた（`playwright.config.js` は未変更）。

| 対象 | Handoff の記録 | Reviewer の再実行 |
| --- | --- | --- |
| Build | PASS | PASS（`aa29d4c`） |
| Unit | 1527 PASS / 0 FAIL | 1527 PASS / 0 FAIL（`aa29d4c`） |
| 新規 E2E 3 件 | PASS（変更前は失敗） | PASS 3 / 3（`aa29d4c`） |
| E2E 全体 | 156 PASS / 既存 FAIL 1 / FLAKY 2 | 全体は再実行していない（Handoff の値を記録として扱う） |
| mansion-escort Relaxed Stance | 既存 FAIL | `aa29d4c`: 3 回中 3 回 FAIL、6 回中 5 回 FAIL（計 9 回中 8 回、すべて 0.88）。`7d4afa7`: 3 回中 2 回 FAIL、6 回中 5 回 FAIL（計 9 回中 7 回、すべて 0.88）。失敗の値・頻度が同等 |
| execution-break 通常敵 Break → EXECUTE | FLAKY | `aa29d4c`: 1 回 FAIL の後、3 回連続 PASS。`7d4afa7`: 4 回 PASS |
| job-traits 鷹の目 Turn Assist | FLAKY | `aa29d4c`: 初回 FAIL・リトライで PASS（Playwright 判定 flaky）。`7d4afa7`: 1 回 PASS |

評価:

- Build / Unit / 新規 E2E の PASS は再現した。
- 既存 FAIL は変更前コードでも同じ値（0.88）・同等の頻度で再現し、失敗するテストはテストモードのモーション時間依存で、差分はテストモードの処理を変えていない。**本実装による回帰ではない**と判断する（FACT: 変更前でも再現 / INFERENCE: 原因が本差分に無い）。**FAIL 自体は未解消**。
- FLAKY 2 件は、実装側で FAIL と PASS の両方が出た。変更前コードでは今回の少数回では FAIL が出なかったため、「変更前でも失敗する」ことまでは Reviewer は確認できていない。差分がテストモードの戦闘・照準処理を変えていないこと（FACT (code)）から、本実装とは無関係である可能性が高い（INFERENCE）。Risks に残す。

## 13. FAIL / FLAKY / NOT_RUN の扱い

| 区分 | 対象 | Reviewer の扱い |
| --- | --- | --- |
| 既存 FAIL（未解消） | `mansion-escort.spec.js`「非戦闘・停止中は Relaxed Stance」 | **PASS として数えない**。本実装の回帰ではない（§12）が、FAIL として残る。UI-002-A の WI 判定には用いない（Human Decision 2026-09-27 に従い Review は進める） |
| FLAKY | `execution-break.spec.js` 通常敵 Break → EXECUTE、`job-traits.spec.js` 鷹の目 Turn Assist | **PASS として数えない**。Risks に残す |
| NOT_RUN | 撤退ボーナス実画面、ボス結果画面実画面、宝箱実画面 | **PASS として数えない**。Reviewer はコードで分岐を確認した（§4 / §8）が、実画面は未確認のまま |

## 14. 指摘事項

| # | 重大度 | WI | 内容 | 対応の要否 |
| --- | --- | --- | --- | --- |
| **F-1** | **要修正（仕様不一致）** | WI-A4 | 「鑑定所(鍛冶士の前で)」が、鍛冶士加入前（Chapter 1 開始〜洋館クリア）の「仮設の作業台」と一致しない（§7） | **CHANGES_REQUIRED**。Implementer が文言を修正（文言の決定は承認範囲内で。必要なら Human に確認） |
| F-2 | 確認推奨（解釈） | WI-A3 | 未鑑定品の行は維持しつつ、行内の「鑑定」ボタンを本編で出さない実装。承認 (2)(3) に整合すると判断したが、行のアクション欄が空になる点を Human が意図どおりと確認することを推奨（§6） | 任意（Human 確認） |
| F-3 | 情報（既存・範囲外） | WI-A3 / 第一章境界 | 異空間報酬（02 `grantAnomalyReward()`）は本編でも `rollDropEquipment()` による装備（レア＝未鑑定品を含む）を付与する既存挙動。本実装で本編の鑑定ができなくなったため、この経路で入手した未鑑定品は本編では鑑定できないまま残る。第一章境界（細かな武器ドロップ・鑑定武器は存在しない）との関係は UI-002-A の範囲外（本実装の変更ではない） | 範囲外。必要なら別 Task / Human Decision |
| F-4 | 情報 | WI-A4 | `.menu-controls` は両モード共通のため、テストモードでも新しい文言が表示される（「鍛冶士の前で」「閃いた後に使える」はテストモードの実挙動＝どこでも鑑定所を開ける・Skill 2 が最初から使える場合がある、とも一致しない）。承認はテストモード専用の説明を対象外としており、挙動は変わっていないため違反とはしない | 任意 |
| F-5 | 情報（テスト） | — | 新規 E2E は本編の撤退・ボス結果画面・宝箱を通らない（NOT_RUN）。§13 のとおり実画面は未確認 | 記録のみ |

## 15. 最終 Reviewer 判定

| WI | 判定 |
| --- | --- |
| WI-A1 | **PASS** |
| WI-A2 | **PASS** |
| WI-A3 | **PASS**（F-2 は Human 確認推奨） |
| WI-A4 | **FAIL**（CHANGES_REQUIRED: F-1） |
| WI-A5 | **PASS** |

**Task 全体の Reviewer 判定: CHANGES_REQUIRED**（全 WI が PASS ではないため、Task 全体を PASS としない）。

- Test 状態（WI 判定とは別）: Build PASS / Unit 1527 PASS / 新規 E2E 3 PASS / E2E 全体は Handoff 記録で 156 PASS・既存 FAIL 1（未解消、回帰ではない）・FLAKY 2 / NOT_RUN 3（実画面）。
- Task file の Status は本レビューでは変更していない（Human の指示により DONE 等へ変更しない。AGENTS.md §7.3 の Status 更新は Human の判断を待つ）。
- 同一セッションでの兼務のため、人間による差分確認を推奨する。
