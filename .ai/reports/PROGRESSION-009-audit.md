# PROGRESSION-009 第一章 最終仕様監査（コード変更なし）

| 項目 | 値 |
| --- | --- |
| Task ID | PROGRESSION-009 |
| 種別 | 監査（Analyzer → Planner → Reviewer。実装なし） |
| 日付 | 2026-10-06 |
| 監査対象 | `main`（`c6d3259` = PROGRESSION-001〜005）に、未 merge の PR #33（006）・#34（007）・#35（008）を重ねた統合状態（ローカルの作業用 worktree。push していない） |
| 基準 | Human が本 Task で示した第一章の確定仕様（Skill 1 の各職の技を含む）、HD-1〜3、UI-002-F、PROGRESSION-001〜008 の Decision Record |

## 1. Executive Summary

- **第一章の通常プレイへ、第二章以降の成長・自由化要素が漏れる経路は見つからなかった。** 旧セーブ・直接の関数呼び出し・キー入力・ゲームパッド・NPC・UI・セーブ/ロードの各経路を、処理の入口まで追った。
- 第一章の判定はすべて `legacyGrowth()`（= `legacyGrowthEnabled(state.testMode)`）一本で、テストモードは `?dev=1` の URL でしか入れず、セーブもされない。境界は単純で一貫している。
- **ただし 3 件の PR（#33〜#35）が未 merge。** `main` 単体では、第一章でショップ購入・異空間（と、その報酬のランダム装備）が残っている。第一章を完成版として扱えるのは、3 件を merge した後。
- 統合状態: Build PASS、Unit 1644 PASS / 0 FAIL / 1 SKIP（既存）、第一章の E2E（§15）。
- 分類: A（PASS）多数、B（Agent Fix）4 件（すべて記録・merge・堅牢化。ゲームの挙動の漏れではない）、C（Human Decision）3 件、D（Known / Intentional）8 件。

## 2. First Chapter Rules Audit

| 規則 | 実装 | 判定 |
| --- | --- | --- |
| 第一章 = 固定された冒険（自由ビルドなし） | `core/chapter1-rules.js` 冒頭の一覧（レベル・スフィア・パッシブ・クラフト・ランダム装備・異空間なし）。判定は `legacyGrowthEnabled` 一か所 | A |
| キャラクター進行 剣士 → 魔法使い → 弓師 → 盗賊 | `CHAPTER_CAST`（`01-character-creation.js`）: mansion 剣士 / duskvillage 魔法使い（支援 剣士）/ ghostship 弓師（支援 魔法使い）/ clocktower 盗賊（支援 弓師）。前の主人公が支援 AI | A |
| シナリオで自然に解放 | `core/chapter1-progress.js` の `stageFor`（頭から連続でクリアした数）・`offeredScenarios`（次の 1 つだけ。飛び級・再訪なし） | A |
| 自由なキャラクター選択なし | クラスのカードはテストモードの画面（`testClassGrid`）にだけある。本編の主人公は `CHAPTER_CAST` から決まる | A |
| 上位職への転職なし | `checkJobPromotion` 冒頭で `if(!legacyGrowth()) return;`。旧セーブの `job` は `normalizeChapter1Load` が外し、`recomputeStats` も `jobActive = legacy && …` | A |
| 5 人目（影の旅人） | 道（road）で出会い主人公になる（`MET_INSIDE`、docs/SCENARIOS.md / CHARACTERS.md の確定仕様）。本 Task の 4 人の一覧には無い | D（§12 D-1）。Skill 1 は C-2 |

## 3. Skill Audit

| 項目 | 実装 | 判定 |
| --- | --- | --- |
| Skill 1: 剣士 切り下がり / 盗賊 影退きの一閃 / 弓師 五月雨射ち / 魔法使い 幻影歩法 | `CHAPTER1_SKILL1 = {mage:'phantom'}`、他は `retreat`。各職の `retreat` の名前は 剣士「切り下がり」・盗賊「影退きの一閃」・弓師「五月雨射ち」（`CHARGE_VARIANTS_BY_CLASS`）。**確定仕様と一致** | A |
| Skill 1 は第一章では変更不可 | `skill1VariantUsable`: 本編は既定の技だけ（PROGRESSION-005）。鍛冶屋のスキル1 は「固定」・押せるカードなし。旧セーブの `skillChoice` は使われない（`activeSkill1Variant` が既定へ） | A |
| Skill 1 固定は第一章だけ | 判定が `legacyGrowth()` 側。`chapter1-rules.js`・Decision Record・docs に明記（PR #34） | A |
| Skill 2: 閃きで習得・固定 | `grantChapter1Skill2` → `learnSkill2`（シナリオのイベントから）。付け替えは `skill2AltAvailable()`（`legacyGrowth() && unlockedSkill2Alt`）で本編は不可 | A |
| Ult 固定 | `ultAltAvailable()` 同上。上位職の必殺技も `jobActive` が本編で false | A |
| Skill 3 未解禁 | 発動 `castBossSkill3`（U キー・十字キー左・タップの共通入口）冒頭で停止。サブタブ非表示（`LEGACY_SKILL_SUBTABS`）、HUD の案内も非表示（`applyLegacyHudVisibility`） | A |
| 上位職 Skill / スフィア盤の新技 | `skill1VariantUsable` が本編で既定以外を不可（PROGRESSION-003 / 005） | A |
| 第一章クリア後に自由編成へ戻る | 第二章の実行時の状態はまだ無い。クリア後も本編の判定のまま（第一章の制限が続く） | D（§12 D-2）、Risk R-1 |

## 4. Equipment Audit

装備を生み出す全呼び出し（`addEquipmentItem` / `rollEquipment` / `rollSpecialWeapon` / `rollBossSignatureGear` / `equipmentInventory.push` / `type:'equipment'`）を列挙した。

| 経路 | 本編（第一章） | 判定 |
| --- | --- | --- |
| 開始時の固定装備 `grantStarterGear` | 職業の武器・防具 3 点（固定）。続きから始めて武器が無い・扱えない時も補う | A |
| 通常敵・強モブのドロップ `maybeDropEquipmentAt` | 冒頭で停止（WORK 12.1） | A |
| 宝箱（通常・武具箱）`maybeGrantEquipmentInstant` | 冒頭で停止 | A |
| ボスの結果画面・撃破報酬の 3 択 `rollBossSignatureGear` | `if(legacy)` の中だけ（結果画面）・3 択パネルは `if(legacy) renderBossChoicePanel` | A |
| 異空間の報酬 `grantAnomalyReward` | 異空間そのものが第一章に無い（PR #35）。報酬の装備も本編ゲート経由（PR #33） | A（merge 後） |
| 拾ったドロップ `addItem(type:'equipment')` | ドロップ自体が本編で生まれない | A |
| 鑑定 `identifyEquipment` / `identifyAllEquipment` | 処理の冒頭で停止（WI-A3）・ボタンなし | A |
| 強化（`equipLevel`） | 画面の DOM なし。旧セーブの値は `recomputeStats` で本編 0（`forged = legacy ? … : 0`） | A |
| 武器種の制限 | `weaponUsableBy`（`allowAlt` はテストモードだけ） | A |
| 「シナリオ・宝箱による固定入手」 | **固定装備を入手する処理・定義が存在しない**（再監査 X-4）。第一章で手に入る装備は開始時の 3 点だけ | C（§11 C-1） |

## 5. Smith / Shop Audit

| 項目 | 実装 | 判定 |
| --- | --- | --- |
| 加入前: 施設・作業台なし、施設へ到達不可 | `smithFacilityAvailable`（`testMode ‖ smithJoined`）を入口（I キー・十字キー下・インタラクト・チェックポイント）・作業台の建設・案内文がすべて使う（PROGRESSION-004） | A |
| 加入後: 装備・解除・性能・売却・スキル確認 | 装備品タブ・スキルタブ（PR #34 の E2E で確認） | A（merge 後） |
| 加入後: Skill 1 / 2 の付け替え・Skill 3・強化・鍛造・クラフト・スフィア盤・ステータス配分なし | §3 / §4 / §6。鍛造・クラフトは処理自体が無い | A |
| 「鑑定・強化」等の誤解を招く表示 | 本編: 見出し「鍛冶屋」、インタラクト「🔨 鍛冶士と話す(装備の管理)」、メニュー「鍛冶屋(鍛冶士の前で)」（PR #34）。鑑定所・装着・強化を案内するトーストはすべて本編で出ない経路の中（ボスの 3 択・Skill 3 の発動・スフィアのリセット） | A（merge 後） |
| ショップ（HD-3） | 購入の経路は鑑定所の「商店」タブだけ。PR #34 で本編はタブ非表示・ボタン生成なし・クリック処理でも停止。NPC・メニュー・イベントからの購入経路は無い | A（merge 後）。**`main` 単体では購入できる** |
| ゴールドの消費 | 全 6 か所: 鑑定 2（本編停止）・スフィアのやり直し（タブ非表示）・強化（DOM なし）・撤退の損失（購入ではない）・商店（PR #34） | A |
| 第一章のゴールドの使い道 | 購入が無くなり、第一章でゴールドを使う場面が無い（入手: 宝箱・敵・ボス・売却） | C（§11 C-3） |

## 6. Growth / Old Save Audit

| 旧セーブの値 | 本編での扱い | 判定 |
| --- | --- | --- |
| `sphereValue` / `sphereVariantBonus` | 冒頭で 0（PROGRESSION-001） | A |
| `bossAbilityValue` / `triggerBossSkills` | 冒頭で 0 / 発動なし（001） | A |
| `rankEffect`（技の錬磨・必殺の奥義のランク） | `rankEffect = legacyGrowth() ? rankOf : 0`（001） | A |
| パッシブ（`state.skills`: atkUp / hpUp / ultUp / chargeUp） | `recomputeStats` の `passive = legacy ? … : 0`、直接の読み取り 2 か所も停止（001） | A |
| 雇った仲間（`skills.companion`） | `syncAlliesToState` で `legacyGrowth()` を要求（002） | A |
| Skill1 / Skill2 / Ult の Alt・上位職 Skill | 003 / 005 | A |
| レベル・経験値・ステータス配分・レベル成長・上位職 | `grantXP` 停止、`recomputeStats` で `levelGrowth` / `allocPoints` / `job` / 速度のレベル補正を本編 0 | A |
| 初制覇の「習得の証」 | `grantFirstClearRank` 冒頭で停止 | A |
| 💎 / 🔩 | 加算停止（WI-A5）、表示も隠す。値は保持 | A |
| スキル3 の装着（`equippedBossActiveSkill`） | 発動の入口で停止 | A |
| 保存データ | 削除・変換しない（全 PROGRESSION の方針どおり） | A |
| 育成系の処理関数そのもの（`unlockSphereNode` / `rankUpAbility` / 仲間の購入 / ボス能力の付け替え） | 本編では呼び出す UI・キー入力・ゲームパッドの経路が無い（タブ・サブタブが非表示、`sphereTabVisible()` はスフィアのタブが表示中の時だけ）。ただし関数の中には第一章の判定が無い | B（§10 B-4、低。堅牢化） |

## 7. Anomaly Audit

| 項目 | 実装（PR #35） | 判定 |
| --- | --- | --- |
| 40% の判定・裂け目の生成・ミニマップの点 | `spawnAnomalyRiftForWorld` 冒頭（乱数より前）で停止 | A（merge 後） |
| 侵入・戦闘・クリア・報酬・ログ・帰還 | すべて裂け目に入った後の処理。`enterAnomalyRoom` にも同じ判定 | A（merge 後） |
| 異空間の本体（第二章以降用） | 部屋・敵・報酬・帰還・出現率 0.4・場所 5 か所は残る（unit で固定） | A |
| PROGRESSION-006 の報酬ゲート | 残す（第二章以降の安全策） | A |
| 洋館の「歪んだ洋館」区画 | 物語上の別の仕組み（第一章の本編そのもの） | D |
| `main` 単体 | 第一章でも 40% で裂け目が出て、報酬にランダム装備が入る | **merge 待ち**（§10 B-1） |

## 8. Test Mode Boundary Audit

| 境界 | 実装 | 判定 |
| --- | --- | --- |
| テストモードへの入口 | `DEV_UI = devUiEnabled(location.search)`（`?dev=1` の時だけ入口の行を出し、開く処理も弾く） | A |
| `state.testMode` を書く場所 | `14-hud-boot.js` の `state.testMode = (world==='training')` の 1 か所だけ | A |
| テストモードは保存しない | `saveGame` 冒頭 `if(state.testMode) return false;` | A |
| 第一章の判定 = テストモードかどうか | `legacyGrowth()` は名前と違い旧セーブ判定ではない（新規プレイの本編でも false） | A（名前の誤解は Risk R-2） |
| テストモードで異空間・商店・強化・スキル自由編成が使える | 仕様違反ではない（本 Task の指示どおり） | D |

## 9. Findings 一覧

| ID | 分類 | 内容 |
| --- | --- | --- |
| F-1 | B | PR #33 / #34 / #35 が未 merge。`main` 単体では第一章でショップ購入・異空間・異空間のランダム装備が残る |
| F-2 | B | PR #34 と #35 が `.ai/decisions/UI-002-human-decisions.md` の同じ場所（Undecided の直前・Decision History の末尾）へ追記しているため、2 つ目の merge で競合する（両方を残すだけの解消。監査用の worktree で確認済み） |
| F-3 | B | HD-1 は本 Task の確定仕様で決まった（4 職の Skill 1）が、記録（`UI-002-F-re-audit.md`、PR #34 の `chapter1-rules.js` のコメント「HD-1 未決定」・PR 本文・Decision Record）は未決定のまま。コードは既に一致 |
| F-4 | B（低） | 育成系の処理関数の中に第一章の判定が無い（UI・入力の経路が無いので漏れは無い。PROGRESSION-007 の「処理側でも止める」方針に揃えるなら堅牢化の候補） |
| F-5 | C | 第一章の固定装備の入手（シナリオ・宝箱）が未定義・未実装。装備画面・売却は開始時の 3 点にしか使えない |
| F-6 | C | 影の旅人（5 人目）の第一章の Skill 1。戦闘の骨格は剣士を借りているので、いまは剣士と同じ「切り下がり」 |
| F-7 | C | 第一章でゴールドの使い道が無い（購入なし・鑑定なし・強化なし） |
| F-8〜 | D | §12 |

## 10. Agent Fix 候補（Human 判断不要。今回は修正しない）

| ID | 内容 | 規模 |
| --- | --- | --- |
| B-1 | PR #33 → #34 → #35 の順に merge する（Human の判断）。順番は任意だが、#34 と #35 の 2 つ目で B-2 の解消が要る | merge |
| B-2 | Decision Record の追記の競合の解消（両方を残す。挿入の順は日付順） | 数行 |
| B-3 | HD-1 を確定として記録する: Decision Record、`UI-002-F-re-audit.md`、`chapter1-rules.js` のコメント（「HD-1 未決定」→ 確定の 4 職）。コードの変更は不要（既に一致）。必要なら unit で 4 職の技名を固定 | 記録 + unit 1 件 |
| B-4（任意） | `unlockSphereNode` / `respecSphere` / `rankUpAbility` / パッシブ・仲間の購入 / `toggleEquippedBossAbility` / `setEquippedBossActiveSkill` の入口に第一章の判定を足す（いまは UI 側だけで止まっている） | 小。挙動は変わらない |

## 11. Human Decision 候補

| ID | Question | Options | 推奨 |
| --- | --- | --- | --- |
| C-1 | 第一章で、開始時の装備以外の固定装備（武器・防具）を入手させるか。させるなら、どのシナリオ・宝箱で何を | (a) 第一章は開始時の装備だけ（装備画面は確認用）/ (b) シナリオ報酬・特定の宝箱に固定装備を置く（内容をシナリオ側で決める） | 選択肢の整理のみ。(a) は記録だけ、(b) は装備の定義とシナリオの追加作業 |
| C-2 | 影の旅人の第一章の Skill 1 | (a) 剣士と同じ「切り下がり」で確定 / (b) 専用の技を指定 | 選択肢の整理のみ。(a) は記録だけ |
| C-3 | 第一章でゴールドを持たせる意味 | (a) 第二章へ持ち越す貯金として残す（表示も残す）/ (b) 第一章ではゴールドを出さない・表示しない / (c) 第一章内の使い道を作る（新しい仕組み） | 選択肢の整理のみ。(a) は変更なし |

## 12. Known / Intentional

| ID | 内容 |
| --- | --- |
| D-1 | 5 人目（影の旅人）は道で出会い主人公になる（確定仕様）。本 Task の 4 人の一覧の後ろに続く |
| D-2 | 第一章クリア後の自由編成・ランダム装備・強化等は第二章の実装で解禁（いまは未実装。クリア後も第一章の制限のまま） |
| D-3 | 第一章の消耗品は宝箱（通常 12%・補給箱 2 個）・イベントで入手できる（購入なし） |
| D-4 | テストモードでは異空間・商店・鑑定・強化・スフィア盤・スキルの自由編成が動く |
| D-5 | 旧セーブの値は保存したまま使わない（削除・変換しない） |
| D-6 | 上位職のスキル・装備データはテストモード用に残る |
| D-7 | 異空間の裂け目そのものの E2E は無い（40% の乱数・CI で食堂へ歩いて到達できない）。実物の関数の unit で代替 |
| D-8 | 既知の flaky: `job-traits:162`・`base-class-identity:413`・`mansion-enemies:220`（いずれもテストモードの Arena。第一章の経路外） |

## 13. Remaining Risks

| ID | 内容 |
| --- | --- |
| R-1 | 第一章の判定が「テストモードか」と同じ（`legacyGrowth()`）。第二章を作る時は、これらの判定を章を見る形へ置き換える必要がある（再監査 X-7）。置き換えを忘れると、第二章でも第一章の制限が続く |
| R-2 | `legacyGrowth()` の名前が「旧セーブの成長」と読める。実際は本編/テストモードの判定。Human の指示にも誤解が出た（PROGRESSION-006）。名前の変更は今回の範囲外 |
| R-3 | PR #33〜#35 が未 merge の間は、`main` から作る branch に第一章の制限の一部が無い |
| R-4 | 育成系の処理関数は UI 側でだけ止まっている（B-4）。将来 UI を作り直す時に入口が増えると漏れうる |

## 14. PROGRESSION-001〜008 との対応

| Work Item | 内容 | 状態 | 監査 |
| --- | --- | --- | --- |
| 001 | 旧セーブの成長値（スフィア・ボス能力・ランク・パッシブ）を本編で使わない | main | A |
| 002 | 雇った仲間を本編で同行させない | main | A |
| 003 | Skill 2 / Ult / Skill 1 の Alt・上位職 Skill を本編で使わない | main | A |
| 004 | 鍛冶士の加入前は施設なし | main | A |
| 005 | Skill 1 を職業の既定に固定 | main | A（技名は確定仕様と一致） |
| 006 | 異空間の報酬でランダム装備を出さない | PR #33（未 merge） | A（merge 後） |
| 007 | 鍛冶屋は装備管理だけ・ショップなし（HD-2 / HD-3） | PR #34（未 merge） | A（merge 後） |
| 008 | 第一章の異空間を全面廃止 | PR #35（未 merge） | A（merge 後） |
| UI-002-F | 再監査の W-1〜W-3・HD-2 / HD-3 | 上記で実装 | HD-1 の記録だけ残る（B-3） |

## 15. 「第一章完成」と判断できるか

- **統合状態（main + #33 + #34 + #35）: 仕様からの漏れなし。** 第一章の「本来ないもの」が通常プレイに出る経路は見つからなかった。残る C-1〜C-3 は「足りないもの・意味づけ」の判断で、第二章以降の要素の漏れではない。
- **`main` 単体: 未完成。** ショップ購入・異空間（とランダム装備の報酬）が残る。
- 統合状態の検証: Build PASS、Unit 1644 PASS / 0 FAIL / 1 SKIP、第一章の E2E は下記。

E2E（統合状態、2 CPU）: 結果は §16 に追記する。

**Chapter 1 Ready: NO**（現在の `main`）
**Chapter 1 Ready（PR #33・#34・#35 を merge し、B-2 の競合を解消した後）: YES** — C-1〜C-3 は第一章の完成を妨げない判断事項として残る
