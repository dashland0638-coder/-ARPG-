# T-1 Plan

CHAPTER-STRUCTURE / Work Item **T-1** ―― テストモードの Skill 1 既定値を本編に揃える

このファイルは親 Task [`CHAPTER-STRUCTURE.md`](CHAPTER-STRUCTURE.md) の Work Item T-1 の計画であり、独立した Task ではない。
T-1 の Status と Human Approval の正本は親 Task の Work Items 表と「T-1 Human Approval」欄。本ファイルの Status は常にそれと一致させる。

- Analysis: [`../reports/CHAPTER-STRUCTURE-T1-analysis.md`](../reports/CHAPTER-STRUCTURE-T1-analysis.md)（以下 T1A。F-n / I-n / D-n / U-n は T1A の番号）
- Protocol: [`../AGENTS.md`](../AGENTS.md)
- Planner: 本ファイル作成時点でゲームコード・テストは一切変更していない

## Status

**WAITING_APPROVAL**

## Objective

テストモード（`beginTestMode()`）開始時の Skill 1（`state.skillChoice`）の既定値を、本編で同じクラスが主人公になったときと同じ決定処理（`defaultSkill1For`）で決める。
これにより、魔法使いでテストモードを起動すると本編どおり「幻影歩法」（`phantom`、👣）で始まる。

## Background

- WORK 12.1 で、本編の主人公交代（`switchProtagonist()`）の Skill 1 が全職共通の `'retreat'` から `defaultSkill1For(selectedClass)` に直された（T1A F-2）
- テストモードは同じ修正を受けておらず、`'retreat'` 固定のまま（T1A F-1）。テストモードでは本編の交代経路を通らない（T1A F-7）
- その結果、MAGE-001（魔法使い Skill 1）の検証でテストモードを使うたびに、鑑定所で Skill 1 を付け替える必要がある

## Confirmed Facts

T1A の FACT に、Planner の追加調査（P- 番号）を加えたもの。**根拠を確認できたものだけ**を載せる。

| # | FACT | 根拠 |
| --- | --- | --- |
| T1A F-1 | テストモードは `state.skillChoice = 'retreat'` 固定 | `src/legacy/parts/14-hud-boot.js:1375`（`beginTestMode()` 内） |
| T1A F-2 | 本編の交代は `state.skillChoice = defaultSkill1For(selectedClass)` | `14-hud-boot.js:1605`（`switchProtagonist()` 内） |
| T1A F-3 | 本編の新規開始 `beginGame()` は `'retreat'` 固定（常に剣士） | `14-hud-boot.js:1278` |
| T1A F-4 | `defaultSkill1For(k) = CHAPTER1_SKILL1[k] \|\| 'retreat'`、`CHAPTER1_SKILL1 = {mage:'phantom'}`。unit で mage→phantom、他4種→retreat を固定済み | `src/core/chapter1-rules.js:50-52` / `tests/unit/chapter1-rules.test.js:54-58` |
| T1A F-5 | `defaultSkill1For` は共有スコープに公開済み | `src/legacy/concat-plugin.js:99` |
| T1A F-6 | `phantom` は `CHARGE_VARIANTS_BY_CLASS.mage` にあり `unlockKey` 無し | `src/legacy/parts/12-progression-ui.js:2215-2217` |
| T1A F-7 | `advanceChapter1Cast()` は testMode で即 return | `14-hud-boot.js:1468` |
| T1A F-8 | `beginTestMode()` は `:1375` の後に `recomputeStats()`（`:1395/:1397`）を呼び、その中で `updateSkillButtonIcon()` が走る | `12-progression-ui.js:1837` |
| T1A F-9 | `beginTestMode(classKey, …)` の第1引数は基礎クラスキー。`:1327` で `selectedClass = classKey` | `14-hud-boot.js:1326-1327` |
| P-1 | 上位職（転身）でも `state.classDef.key` は基礎クラス（warrior 等）のまま。上位職で変わるのは表示名・アイコン | `12-progression-ui.js:1814-1824`（`recomputeStats()` 内のコメントと `cdef` 構築） |
| P-2 | 上位職の専用 Skill 1（`smite` / `bloodrush` / `nova` / `skyPierce`）は `unlockKey:'job'` で、`state.job` があるときだけ **選択肢に出る** | 定義 `12-progression-ui.js:2158 / 2193 / 2239 / 2271`、一覧の条件 `:3184-3190` |
| P-3 | 転身（`applyPendingJobPromotion()`）は `state.job` を立てて `recomputeStats()` するだけで、`state.skillChoice` を変えない | `12-progression-ui.js:1954-1970` |
| P-4 | `state.skillChoice` への代入は全7箇所（T1A Search Record）。**上位職の技を既定値として代入する処理はどこにも無い** | `skillChoice\s*=` の検索結果（`src/`） |
| P-5 | 本編（Chapter 1）では上位職を使わない。交代時・ロード時に `state.job` を外す | `14-hud-boot.js:1613`（`if(!legacyGrowth()) state.job = null;`） |
| P-6 | テストモードの転身指定は `beginTestMode()` の `state.job = (jobKey && uj && uj.key===jobKey) ? jobKey : null`（`:1392`）で、`:1375` より後。`defaultSkill1For` は `classKey`（基礎クラス）だけを見る | `14-hud-boot.js:1391-1392` |
| P-7 | テストモードで Skill 1 を使う既存 E2E は、剣士（`auto-combo.spec.js:153-205`、既定を `retreat` として MP 消費を確認）と、明示的に付け替えるもの（`job-traits.spec.js` → `barrier`）。上位職の魔導士を起動する E2E（`job-traits.spec.js:65-`、`character-motion.spec.js`）は Skill 1 の入力・アイコンを検査していない | 各 spec の `KeyL` / `btn-charge` / `skill` 検索 |
| P-8 | テストモードの魔法使いで Skill 1 アイコン（`#btn-charge-icon`）を検査する既存 E2E は無い。本編の魔法使いの 👣 は `chapter1-progression.spec.js:197,203` だけが検査している | `btn-charge-icon` の検索（`tests/`） |
| P-9 | `scenario-test-mode.spec.js` の1件目は既に「魔法使い＋剣士で宵待ちの村」をテストモード起動している | `tests/scenario-test-mode.spec.js:47` |

## Decisions Required

### コード調査で解決したもの

| D | 結論 | 根拠 |
| --- | --- | --- |
| **D-3** 上位職を選んだ起動も同じ既定でよいか | **同じ既定（基礎クラスの `defaultSkill1For`）で既存挙動と整合する。追加の仕様判断は T-1 には不要** | P-1〜P-5: 上位職でも Skill 1 の技表は基礎クラスのもの、転身は Skill 1 を変えない、上位職の技を既定にする処理は存在しない、本編に上位職は無い。上位職で起動すると現状は `retreat`、変更後は魔導士だけ `phantom`（転身前の魔法使いと同じ）になる。**上位職の技を既定にする**のは現存しない仕様の新設なので OUT OF SCOPE |
| **D-5** 承認単位 | T-1 を独立した承認単位として扱う | `../AGENTS.md` §6 / §7.2（Work Item 方式） |

### 人間の判断として残るもの

| D | 問い | 選択肢 | Planner の推奨と根拠 |
| --- | --- | --- | --- |
| **D-1** | テストモードでも本編の Skill 1 決定処理（`defaultSkill1For`）を使うか | A: 使う / B: `'retreat'` 固定のまま | **A**。F-1/F-2/F-12 から、固定値は WORK 12.1 の修正の取り残しと推測される（INFERENCE: T1A I-1。意図を示すコード上の根拠は無い＝U-1） |
| **D-2** | 適用範囲 | A: テストモードの全起動（トレーニング空間を含む） / B: シナリオを選んだ起動だけ | **A**。`beginTestMode()` はトレーニング空間とシナリオ起動で同じ初期化を通る（F-9, `:1402` の `finishEnteringGame({world:'training'})` の後で分岐）。B はテストモード側に分岐を足すことになり最小変更に反し、トレーニング空間の魔法使いだけ本編と食い違う状態が残る |
| **D-4** | テストモードの魔法使いで Skill 1 アイコンを確認する E2E を追加するか | A: 既存 E2E に検査を1つ足す / B: 新しいテストを作る / C: 追加しない（既存で十分とする） | **A**。既存テストでは「テストモードの魔法使いの Skill 1」が検査されていない（P-8）ので C では T-1 の受け入れ条件を自動確認できない。一方、既に魔法使いで起動している `scenario-test-mode.spec.js:47` の既存テスト（P-9）に `#btn-charge-icon` の検査を1行足せば足り、新しい起動（1回数十秒）を増やさずに済むので B は不要 |

## Proposed Implementation

**変更は1行。新規関数・新規システム・リファクタリングは無し。**

| 項目 | 内容 |
| --- | --- |
| ファイル | `src/legacy/parts/14-hud-boot.js` |
| 関数 | `beginTestMode(classKey, jobKey, level, guestKey, scenarioKey, waypointId)` |
| 変更箇所 | `:1375` の `state.skillChoice = 'retreat';`（同じ行の `state.skillCharging = false; state.skillChargeT = 0;` は変えない） |
| 変更内容 | `'retreat'` を `defaultSkill1For(classKey)` に置き換える |
| 理由 | 本編の交代経路（`:1605`）と同じ既存関数で既定値を決める（Existing System First）。`classKey` は基礎クラスで、`defaultSkill1For` の入力と一致する（F-9, P-1） |
| 不要なこと | `updateSkillButtonIcon()` の追加呼び出し（後続の `recomputeStats()` が呼ぶ、F-8）、import の追加（共有スコープに公開済み、F-5）、`defaultSkill1For` / `CHAPTER1_SKILL1` の変更 |

（D-4 = A の場合のみ）

| 項目 | 内容 |
| --- | --- |
| ファイル | `tests/scenario-test-mode.spec.js` |
| テスト | 1件目「魔法使い＋剣士同行で宵待ちの村へ直接出撃でき…」（`:44-`） |
| 変更内容 | HUD がアクティブになった後に `await expect(page.locator('#btn-charge-icon')).toHaveText('👣');` を1つ追加。既存の検査・期待値は変えない |
| 理由 | 既存の起動を再利用し、新しいテストを増やさずに受け入れ条件 AC-2 を自動確認する |

## Files To Change

| ファイル | 変更 | 条件 |
| --- | --- | --- |
| `src/legacy/parts/14-hud-boot.js` | `beginTestMode()` 内の1行のみ | D-1 = A かつ D-2 = A |
| `tests/scenario-test-mode.spec.js` | 既存テスト1件に検査を1行追加 | D-4 = A |

D-2 = B が選ばれた場合は本計画を適用せず、Planner が計画を作り直して再度 WAITING_APPROVAL にする。

## Files Not To Change

| 対象 | 理由 |
| --- | --- |
| `src/core/chapter1-rules.js`（`defaultSkill1For` / `CHAPTER1_SKILL1`） | 再利用するだけ。値は unit で固定済み |
| `src/legacy/concat-plugin.js` | 公開済み |
| `14-hud-boot.js` の `beginGame()`（`:1278`） | 本編の新規開始。値は既に `defaultSkill1For('warrior')` と同じ（T1A I-6）。書き方の統一は OUT OF SCOPE |
| `14-hud-boot.js` の `switchProtagonist()` / `advanceChapter1Cast()` / `finishEnteringGame()` | 本編の交代経路と testMode の唯一の書き換え箇所 |
| `14-hud-boot.js` の `beginTestMode()` の他の行 | T-1 の範囲外 |
| `12-progression-ui.js`（`CHARGE_VARIANTS_BY_CLASS` / `updateSkillButtonIcon` / `recomputeStats` / 転身処理 / スキル UI） | 挙動は既存のまま使う |
| `09-save-load.js` | テストモードは `saveGame()` が即 return。セーブ復元の Skill 1 処理は本編のもの |
| `01-character-creation.js`（テストモード画面・`CHAPTER_CAST`） | UI・本編データは T-1 の範囲外 |
| `tests/helpers.js`、`tests/unit/*`、その他の spec | 既存のまま再利用 |
| `index.html` / `basefile.html` / `docs/` / `package.json` / `.github/` | 変更不要 |

## Test Plan

「テストを増やすこと」は目的にしない。既存テストで確認できるものは既存テストで確認する。

| # | 確認項目 | 方法 | 既存 / 追加 |
| --- | --- | --- | --- |
| 1 | 魔法使いのテストモード起動 | `scenario-test-mode.spec.js` 1件目（魔法使い＋剣士・宵待ちの村）がそのまま PASS | 既存 |
| 2 | Skill 1 アイコンが 👣 | 同テストに `#btn-charge-icon` = `👣` の検査を追加（D-4 = A） | 追加（1行） |
| 3 | 既存のテストモード・シナリオ起動 | `scenario-test-mode.spec.js` 全件、`duskvillage.spec.js`、`road.spec.js`（テストモードでシナリオ起動） | 既存 |
| 4 | 剣士・盗賊・弓師への回帰 | 値の不変は unit（`chapter1-rules.test.js:58`: 3職とも `retreat`）で担保。挙動は `auto-combo.spec.js`（剣士、既定 `retreat` の MP 消費）、`job-traits.spec.js`（盗賊・弓師・上位職のテストモード起動） | 既存 |
| 5 | 上位職のテストモード | `job-traits.spec.js`（魔導士・バーサーカー等）、`character-motion.spec.js`（魔導士）が PASS。これらは Skill 1 の入力を検査していないため（P-7）、魔導士の既定が `phantom` になっても期待値は変わらない見込み | 既存 |
| 6 | 本編への非影響 | `chapter1-progression.spec.js`（本編の交代と 👣）、`save-load.spec.js`（新規開始・つづきから） | 既存 |
| 7 | 既定値ロジック | `npm run test:unit`（`chapter1-rules.test.js`） | 既存 |

実行コマンド（Implementer / Reviewer）:

```sh
npm run build
npm run test:unit
npx playwright test tests/scenario-test-mode.spec.js tests/auto-combo.spec.js tests/job-traits.spec.js tests/chapter1-progression.spec.js tests/save-load.spec.js
npm test   # 全体回帰（時間が許す範囲で。未実行ならその理由を記録）
```

D-4 = C（追加しない）が選ばれた場合の根拠の不足: 既存テストに「テストモードの魔法使いの Skill 1」を検査するものは無い（P-8）ため、AC-2 は手動確認（テストモードで魔法使いを起動し Skill 1 ボタンが 👣 であることを目視）で代替し、その結果を Review に記録する。

## Acceptance Criteria

| # | 条件 |
| --- | --- |
| AC-1 | `beginTestMode()` の Skill 1 既定値が、固定値ではなく既存の `defaultSkill1For(classKey)` で決まっている |
| AC-2 | テストモードで魔法使い（基礎職）を起動すると `state.skillChoice === 'phantom'`、Skill 1 ボタンのアイコンが 👣（トレーニング空間・シナリオ起動の両方） |
| AC-3 | テストモードで剣士・盗賊・弓師を起動したときの Skill 1 既定は従来どおり `retreat`（挙動・アイコンとも不変） |
| AC-4 | 上位職を選んだテストモード起動では、既定値は基礎クラスの `defaultSkill1For` に従う（魔導士 → `phantom`、他の上位職 → `retreat`）。上位職専用技は従来どおり一覧から選べる |
| AC-5 | テストモード以外（新規開始・つづきから・本編の交代）の Skill 1 既定値と挙動に差分が無い |
| AC-6 | 実セーブがテストモードの前後で変化しない（`scenario-test-mode.spec.js` の既存検査） |
| AC-7 | 差分が Files To Change の範囲だけ（`14-hud-boot.js` 1行、D-4 = A なら spec 1行） |
| AC-8 | `npm run build` / `npm run test:unit` / Test Plan の E2E が PASS |

## Regression Risks

| # | リスク | 深刻度 | 根拠 / 緩和 |
| --- | --- | --- | --- |
| RR-1 | 魔法使い（魔導士含む）のテストモードで Skill 1 の `retreat` 挙動（ダメージ・MP 消費）を前提にした既存テストが壊れる | 低 | 検索では該当なし（P-7）。Test Plan #1, #3, #5 を実行して確認 |
| RR-2 | `phantom` はダメージ 0。テストモードの魔法使いで Skill 1 のダメージを見ていた手動手順の結果が変わる | 低 | リポジトリ外の運用は確認不能（T1A U-4）。鑑定所で `retreat` へ付け替えれば従来どおり |
| RR-3 | 魔導士（上位職）の既定が `retreat` → `phantom` に変わる | 低 | 既存挙動（転身は Skill 1 を変えない）と整合（D-3）。AC-4 で明文化 |
| RR-4 | 変更が `beginTestMode()` の外へ広がり本編やセーブ保護に波及 | 中 | Files Not To Change を厳守。AC-5 / AC-7 で縛る |

## Rollback / Recovery

- 変更は `14-hud-boot.js` の1行（＋ spec の1行）だけなので、該当コミットの revert で完全に戻る
- セーブ形式・state のフィールドに変更が無いため、マイグレーションは不要
- テストが失敗した場合は `../AGENTS.md` §9（Debugger 3-Cycle Rule）に従う。T-1 の範囲で直せない原因なら修正を広げず `BLOCKED` にして人間へ戻す

## Out of Scope

- 魔法使い Skill 1 自体の仕様変更（`phantom` の性能・挙動）
- 幻影 / デコイシステムの新規実装・改修
- 敵 AI の変更
- Chapter 1 本編の進行・交代・`beginGame()` の書き換え
- Scenario Test Mode 全体の再設計・テストモード画面（UI）の変更
- 上位職の専用技を既定値にする仕様の新設（D-3 参照）
- T-2 / T-3 / T-4
- MAGE-001（その Task 記述が古い件＝T1A F-14 を含む）

作業中に上記が必要だと分かった場合は実装せず、OUT OF SCOPE として報告する（`../AGENTS.md` §10）。

## Approval Gate

**WAITING_APPROVAL**

| 開始条件（`../AGENTS.md` §6、承認単位 = T-1） | 状態 |
| --- | --- |
| T-1 を扱う Analyzer report | ✅ `CHAPTER-STRUCTURE-T1-analysis.md` |
| T-1 の計画 | ✅ 本ファイル |
| 実装に必要な DECISION の決定 | ❌ D-1 / D-2 / D-4 が人間の判断待ち（D-3 / D-5 は解決済み） |
| 実装範囲の明確化 | ✅ Files To Change / Files Not To Change |
| Human Approval | ❌ 未承認（親 Task の「T-1 Human Approval」欄） |

Implementation (T-1): **BLOCKED until approval**

承認時に人間が決めること: D-1 / D-2 / D-4 の選択。推奨どおり（A / A / A）であれば、本計画をそのまま Implementer へ渡せる。
