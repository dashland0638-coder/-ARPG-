# T-1 Analysis

CHAPTER-STRUCTURE / T-1 ―― Scenario Test Mode の Skill 1 既定値を通常仕様に合わせる

Analyzer / READ ONLY。本レポート作成にあたりゲームコード・テスト・docs は一切変更していない。

- Task: [`../tasks/CHAPTER-STRUCTURE.md`](../tasks/CHAPTER-STRUCTURE.md)（Required Changes (2) T-1 / Implementation Plan Step 1）
- 前段の調査: [`CHAPTER-STRUCTURE-analysis.md`](CHAPTER-STRUCTURE-analysis.md)（履歴として保持。本レポートは上書きしない）
- Protocol: [`../AGENTS.md`](../AGENTS.md)（AI Agent Operating Protocol の最初の試験運用）
- 調査時点: `main` = `501a320` 以降、作業ブランチ `claude/chapter-structure-scenario-test-q6oj4l`

## Status

ANALYZED（Analyzer 完了）。Implementation Gate: **WAITING_APPROVAL**（末尾参照）。

## Objective

テストモード（`beginTestMode()`）で開始したときの Skill 1（`state.skillChoice`）の既定値を、
本編で同じ主人公が始まるときの既定値と一致させる。主目的は、魔法使いで宵待ちの村を
テストモード起動したとき、本編と同じ「幻影歩法」（MAGE-001 の検証対象）で始まること。

## Scope

| 対象 | 範囲 |
| --- | --- |
| IN | テストモード開始時の `state.skillChoice` の初期値の決め方、その影響範囲 |
| OUT | Skill 2 / Ult の既定値、テストモードの他の初期化、スキル UI の変更、本編の Skill 1 決定処理そのもの、MAGE-001 の中身、T-2〜T-4 |

## Search Record

調査順は AGENTS.md §11 に従い、検索 → 該当範囲の部分読み取りの順で行った。リポジトリ全体の通読はしていない。

| 検索対象 | 検索語 | 範囲 | 結果 |
| --- | --- | --- | --- |
| skillChoice（代入箇所） | `skillChoice\s*=`（`skill2Choice` を除外） | `src/` | **7件**: `09-save-load.js:230` / `14-hud-boot.js:1278` / `14-hud-boot.js:1375` / `14-hud-boot.js:1605` / `12-progression-ui.js:906` / `:3191`（比較） / `:3328` |
| defaultSkill1For | `defaultSkill1For\|CHAPTER1_SKILL1` | `src/` `tests/` | 定義 `core/chapter1-rules.js:50-52`、共有スコープへの公開 `concat-plugin.js:99`、**呼び出しは `14-hud-boot.js:1605` の1箇所のみ**、unit `tests/unit/chapter1-rules.test.js:54-58` |
| Mage Skill 1 | `'phantom'\|"phantom"` | `src/` `tests/` | 定義 `12-progression-ui.js:2215`（`CHARGE_VARIANTS_BY_CLASS.mage.phantom`）、挙動 `13-update-loop.js:369` / `11-combat-actions.js:1448`、スキル UI の一覧 `12-progression-ui.js:3186`、E2E `chapter1-progression.spec.js:203` |
| Test Mode（初期化） | `function beginTestMode` | `src/legacy/parts/14-hud-boot.js` | `:1326`。`skillChoice = 'retreat'` は `:1375`、`recomputeStats()` は `:1395` / `:1397` |
| Test Mode（状態） | `testMode *=` | `src/` | 書き換えは `14-hud-boot.js:1727`（`finishEnteringGame`）の1箇所のみ |
| 本編の交代経路 | `advanceChapter1Cast\|function switchProtagonist` | `src/legacy/parts/14-hud-boot.js` | `advanceChapter1Cast` は `:1468` で `state.testMode` なら即 return。`switchProtagonist` は `:1553`、Skill 1 設定は `:1605` |
| 本編の新規開始 | `function beginGame` | `14-hud-boot.js` | `:1235`。`skillChoice = 'retreat'` は `:1278`（直前の `applyChapterCast(1)` で常に剣士） |
| セーブ復元 | `skillChoice`（`09-save-load.js` 内） | `src/legacy/parts/09-save-load.js` | 保存 `:47`、復元 `:222-231`（保存値がクラスに存在し未解放でなければ復元、なければ `'retreat'`） |
| Scenario launch | `function launchScenarioNow` | `12-progression-ui.js` | `:1651`。`skillChoice` に触れない（同関数内に該当語なし） |
| HUD / skill UI | `function updateSkillButtonIcon` / `updateSkillButtonIcon()` | `src/legacy/` | 定義 `12-progression-ui.js:2471`（`state.skillChoice` の icon を `#btn-charge-icon` へ）。呼び出し `:1837`（`recomputeStats` 内）/ `14-hud-boot.js:1606` / `12-progression-ui.js:3329` |
| unlockKey による巻き戻し | `unlockKey` 付近（`:906`） | `12-progression-ui.js:898-910` | スフィア初期化時、`unlockKey` 付きの技だけ `'retreat'` へ戻す。`phantom` 定義（`:2215-2217`）に `unlockKey` は無い |
| CHAPTER_CAST / class | `CHAPTER_CAST` / `wanderer` | `src/` | 表 `01-character-creation.js:273`。`wanderer` は `hidden:true`（`:107`）でテストモードの職業選択に出ない |
| related tests（test mode 利用） | `open-testmode-btn` × `mage` | `tests/*.spec.js` | 10ファイル。うち Skill 1 を押す/アイコンを見るもの: `auto-combo.spec.js:161-205`（**剣士**、`dash` へ付け替えてから確認）、`job-traits.spec.js:115-153`（`barrier` へ明示的に付け替え）、`execution-break.spec.js`（`KeyE` = Skill 1 以外の操作。クラスは要確認 → UNKNOWN U-2） |
| related tests（Skill 1 の値） | `btn-charge-icon\|skillChoice\|retreat` | `tests/*.spec.js` | テストモードで **魔法使いの Skill 1 が `retreat` であることを前提にした E2E は見つからなかった**。本編の魔法使い `👣`/`phantom` は `chapter1-progression.spec.js:197,203` |
| テストモード×Skill 1 の意図的な分離の記述 | `beginTestMode` 周辺コメント、`skillChoice` の各行コメント | `14-hud-boot.js:1326-1430` | テストモードで `'retreat'` を選んだ理由のコメントは **無い**（`:1375` の行にコメント無し） |

## FACT

コード・テスト・仕様書から確認した事実（根拠つき）。

- **F-1** テストモードの Skill 1 既定値は固定値 `'retreat'`。`beginTestMode()` 内 `14-hud-boot.js:1375`: `state.skillChoice = 'retreat';`
- **F-2** 本編で主人公が交代するときは `defaultSkill1For(selectedClass)` を使う（`14-hud-boot.js:1605`、`switchProtagonist()` 内）。コメントに「以前は全職共通で 'retreat' に戻していたため、魔法使いが幻影歩法ではなく退避の魔陣を持って宵待ちの村へ出ていた」（WORK 12.1）
- **F-3** 本編の新規開始（`beginGame()`）は固定値 `'retreat'`（`14-hud-boot.js:1278`）。新規開始は常に剣士（`applyChapterCast(1)`）
- **F-4** `defaultSkill1For(classKey)` は `CHAPTER1_SKILL1[classKey] || 'retreat'`、`CHAPTER1_SKILL1 = {mage:'phantom'}`（`core/chapter1-rules.js:50-52`）。unit テストで mage→`phantom`、warrior/rogue/archer/wanderer→`retreat` が固定されている（`tests/unit/chapter1-rules.test.js:54-58`）
- **F-5** `defaultSkill1For` は `concat-plugin.js:99` で共有スコープへ公開済み。`14-hud-boot.js` から追加 import 無しで呼べる（`:1605` が既にそうしている）
- **F-6** 魔法使いの `phantom`（幻影歩法、👣）は `CHARGE_VARIANTS_BY_CLASS.mage` に定義済みで、`unlockKey` を持たない（`12-progression-ui.js:2215-2217`）。つまり解放条件なしで選択できる
- **F-7** テストモードでは `advanceChapter1Cast()` が `state.testMode` で即 return する（`14-hud-boot.js:1468`）。したがって本編の `switchProtagonist()`（F-2 の経路）はテストモードでは **一度も通らない**
- **F-8** `beginTestMode()` では `:1375` で `skillChoice` を設定した **後** に `recomputeStats()`（`:1395`/`:1397`）が走り、`recomputeStats` 内（`12-progression-ui.js:1837`）で `updateSkillButtonIcon()` が呼ばれる。アイコンは `skillChoice` を後から読む
- **F-9** `beginTestMode(classKey, …)` は第1引数 `classKey` を受け取り、`:1327` で `selectedClass = classKey` を設定している
- **F-10** `launchScenario` / `launchScenarioNow` は `skillChoice` に触れない（`12-progression-ui.js:1651-` に該当語なし）
- **F-11** テストモードで Skill 1 を実際に使う既存 E2E は、剣士（`auto-combo`）か、明示的に別の技へ付け替えるもの（`job-traits` → `barrier`）。魔法使いのテストモードで `retreat` を前提にした E2E は検索で見つからなかった
- **F-12** テストモードで `'retreat'` を選んでいる理由を説明するコメントは、`beginTestMode()` 内に存在しない
- **F-13** 影の旅人（`wanderer`）は `hidden:true` でテストモードの職業選択に出ない（`01-character-creation.js:107`、`setupTestModeScreen` の `if(c.hidden) return;`）
- **F-14** `.ai/tasks/MAGE-001.md:45` は「Skill 1 は 6択（dash/retreat/spin/barrier/chain/nova）」「デコイも幻影も無い」と記載しているが、現在のコードには `phantom` が存在する（F-6）。MAGE-001.md の現状記述は古い

## INFERENCE

FACT からの推測。確定ではない。

- **I-1**（F-1, F-2, F-7 より）Skill 1 の初期化経路は「本編の交代」「本編の新規開始」「テストモード」「セーブ復元」の4系統に分かれており、`defaultSkill1For` を使っているのは本編の交代だけ。テストモードの `'retreat'` は、WORK 12.1 で交代経路を直したときに同じ修正がテストモードへ波及しなかった **取り残し** である可能性が高い（F-12: 意図を示すコメントが無い）
- **I-2**（F-4, F-9, F-5 より）`:1375` の `'retreat'` を `defaultSkill1For(classKey)` に置き換えれば、本編の交代時と同じ値になる。新規関数・新規システムは不要と推測される
- **I-3**（F-4, F-13 より）結果が変わるのは魔法使いだけ。剣士・盗賊・弓師は `'retreat'` のまま、影の旅人はテストモードで選べないため影響しない
- **I-4**（F-8 より）Skill 1 ボタンのアイコンは既存の `recomputeStats()` → `updateSkillButtonIcon()` で自動的に `👣` になる。`updateSkillButtonIcon()` の追加呼び出しは不要と推測される
- **I-5**（F-11 より）既存 E2E の期待値は変わらない見込み。ただし全件を実行して確かめたわけではない（U-2）
- **I-6**（F-3 より）`beginGame()` の `'retreat'` も値としては `defaultSkill1For('warrior')` と同じ。書き方を揃えるかは T-1 の範囲外（OUT OF SCOPE）

## DECISION

人間が判断する事項。AI は決めない。

- **D-1** テストモードでも本編の Skill 1 決定処理（`defaultSkill1For`）を再利用するか
  - A: 再利用する（Task の T-1 の案。魔法使いは `phantom` で始まる）
  - B: テストモードは `'retreat'` 固定のままにする（MAGE-001 検証のたびに鑑定所で付け替える）
- **D-2** 適用範囲
  - A: テストモードの全起動（トレーニング空間も含む）で `defaultSkill1For(classKey)` にする
  - B: シナリオを選んだ起動だけ本編に揃え、トレーニング空間は `'retreat'` のまま
  - 影響: A はコード1行。B は分岐が増え、トレーニング空間で魔法使いの既定が本編と食い違ったまま残る
- **D-3** 上位職（転身）を選んだテストモード起動も同じ既定でよいか（`defaultSkill1For` は `classKey` のみを見る。上位職の Skill 1 仕様はこのタスクで確認していない → U-3）
- **D-4** T-1 用に新しい E2E（魔法使いで起動 → `#btn-charge-icon` が `👣`）を追加するか。Task の Test Plan #5 は追加を想定している
- **D-5**（Protocol 運用）CHAPTER-STRUCTURE は T-1〜T-4 を1つの Task に含み、`Status` は1つしか持てない。T-1 を別 Task（例: `CHAPTER-STRUCTURE-T1`）として分けて承認するか、CHAPTER-STRUCTURE の中で T-1 だけを承認するか

## Existing System Reuse

| 既存 | 場所 | 再利用 | 根拠 |
| --- | --- | --- | --- |
| `defaultSkill1For(classKey)` | `core/chapter1-rules.js:51` | **そのまま使える** | 共有スコープに公開済み（F-5）、unit で値が固定済み（F-4） |
| `CHAPTER1_SKILL1` | `core/chapter1-rules.js:50` | 変更不要 | 魔法使い = `phantom` が既に定義済み |
| `recomputeStats()` → `updateSkillButtonIcon()` | `12-progression-ui.js:1735` / `:1837` / `:2471` | そのまま使える | 既に `:1375` の後に呼ばれている（F-8） |
| `CHARGE_VARIANTS_BY_CLASS.mage.phantom` | `12-progression-ui.js:2215` | 変更不要 | `unlockKey` 無し（F-6） |
| `tests/helpers.js` の `startTestMode` | `tests/helpers.js:132` | 新規 E2E を書く場合にそのまま使える | 既存ヘルパーで職業・シナリオ指定が可能 |

**新規関数・新規システムが必要か**: 検索の結果、必要とする根拠は見つからなかった（I-2）。

## Affected Files

想定（Planner で確定する。ここでは実装手順を確定しない）。

| ファイル | 関係 | 想定される変更の有無 |
| --- | --- | --- |
| `src/legacy/parts/14-hud-boot.js` | `beginTestMode()` `:1375` | 変更対象の候補（Task の Step 1 と一致） |
| `src/core/chapter1-rules.js` | `defaultSkill1For` | 変更不要（参照のみ） |
| `src/legacy/concat-plugin.js` | 公開一覧 | 変更不要（既に公開済み） |
| `tests/scenario-test-mode.spec.js` | テストモードの E2E | D-4 次第で追加 |
| `tests/unit/chapter1-rules.test.js` | 既定値の unit | 変更不要（既存で値を固定済み） |

影響範囲（挙動）: テストモードで魔法使いを選んだ起動の初期 Skill 1 と、そのアイコン（🛡️ → 👣）。
セーブ（テストモードは `saveGame()` が即 return）・本編の新規開始・つづきから・本編の交代には影響しない見込み（F-7、`finishEnteringGame` 非変更）。

## Risks

| # | リスク | 深刻度 | 根拠 / 緩和 |
| --- | --- | --- | --- |
| RK-1 | 魔法使いのテストモードで Skill 1 を押し、`retreat` の挙動（ダメージあり・MP 消費）を前提にしている既存テストがあると壊れる | 低 | 検索では見つからなかった（F-11）。未実行のため U-2 として残す。実装時に関連 E2E を実行する |
| RK-2 | `phantom` はダメージ 0（`baseMult:0`）。テストモードで魔法使いの Skill 1 をダメージ検証に使っていた手動手順があれば結果が変わる | 低 | テスト外の運用は確認不能（U-4） |
| RK-3 | 上位職の Skill 1 既定が本来別仕様だった場合、同じ値を当てるのが誤りになる | 低 | U-3 / D-3 |
| RK-4 | 変更を `beginTestMode` の外（`finishEnteringGame` や `launchScenario`）へ広げると、本編やセーブ保護へ波及する | 中 | Task の Files Not To Change に従い、`beginTestMode` 内に限定する |
| RK-5 | T-1 と T-2〜T-4 が同じ Task にあり、T-1 の承認が T-3/T-4 の承認と誤解される | 中 | D-5。承認の範囲を Task に明記する |

## Unknowns

- **U-1** テストモードで `'retreat'` を採用した当初の意図（コード・コミットコメントからは確認できなかった。`git log -S` による履歴調査は未実施）
- **U-2** 既存 E2E を実行した場合に期待値が変わらないこと（今回は Analyzer のため未実行）。`execution-break.spec.js` の対象クラスと `KeyE` の割り当ては未確認
- **U-3** 上位職（魔導士など）の Skill 1 既定に関する仕様（`docs/` は今回未調査）
- **U-4** テストモードを使った手動検証の運用で `retreat` 既定に依存しているものがあるか（リポジトリ外の情報）

## Recommendation

- T-1 は Existing System First の条件を満たす: 既存の `defaultSkill1For` をそのまま再利用でき、新規関数・新規システムは不要（Search Record / FACT で確認）
- 変更候補は `beginTestMode()` の1行に限られる見込みで、Task の Step 1 の記述と一致する
- 実装前に D-1・D-2 の人間判断が必要。D-3・D-4・D-5 は承認時にあわせて決めることを推奨する
- 別件（OUT OF SCOPE）: `.ai/tasks/MAGE-001.md` の現状記述が古い（F-14）。MAGE-001 の再分析は別 Task として扱う

## Implementation Gate

**WAITING_APPROVAL**

| 開始条件（AGENTS.md §6） | 状態 |
| --- | --- |
| Analyzer report が存在する | ✅ 本レポート |
| Planner task が存在する | ✅ `CHAPTER-STRUCTURE.md` T-1 / Step 1 |
| 未確定事項が整理されている | ✅ D-1〜D-5 / U-1〜U-4 |
| 実装範囲が明確 | ✅ `beginTestMode()` 内に限定（Planner 確定待ち） |
| Human Approval が明示されている | ❌ **未承認** |

Implementation: **BLOCKED until approval**
