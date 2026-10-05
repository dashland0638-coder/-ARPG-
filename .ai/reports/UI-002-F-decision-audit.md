# UI-002-F Decision Audit（確定済み仕様と Human Decision が必要な事項の分離）

| 項目 | 値 |
| --- | --- |
| Task | UI-002-F（Menu / Character UI。Status: DRAFT） |
| 種別 | 仕様・Decision Record・実装の監査（実装 Goal ではない。UI-002-F の Analyzer report ではない） |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| 基準 SHA | `d84a12b`（PROGRESSION-002 完了） |
| Persisted by | Agent（Orchestrator） |
| 日付 | 2026-10-04 |
| コード変更 | なし |

本書は Human がゲームデザインを判断するための材料。Agent の推奨は書かない。FACT = コード・記録で確認、INFERENCE = コードからの推定（実機では未確認）。

## 1. 調査対象

- 規則: `CLAUDE.md`、`.ai/AGENTS.md`
- Decision Record: `.ai/decisions/UI-002-human-decisions.md`（HD-1〜5、第一章のゲームデザイン境界、旧セーブを破壊しない原則、HD-P1〜P9、AP-5、AP-8、HD-D01〜D29、Undecided）、`AGENT-DECISIONS.md`、`DEC-001〜003`
- Task / Report: `UI-002-A〜I`、`PROGRESSION-001 / 002`、`CHAPTER1-WORK9 / 10 / 11 / 12 / 12.1`、`UI-002-A-analysis` / `UI-002-A-plan-v2`
- 仕様: `docs/COMBAT.md`（Skill・Loadout Change Rule）、`docs/PROGRESSION.md`、`docs/GAME_DESIGN.md`、`docs/SCENARIOS.md`、`COMBAT_DESIGN.md`
- 実装: `src/core/chapter1-skills.js`・`chapter1-rules.js`、`src/legacy/parts/09-save-load.js`（保存・復元）、`12-progression-ui.js`（Skill 定義・`activeSkill2Def`・`recomputeStats` の ult・鑑定所の Skill 画面）、`14-hud-boot.js`（新規開始・テストモード・`normalizeChapter1Load`・主人公の交代）、`13-update-loop.js`（Skill 1 の発動）

## 2. 確定済みの仕様（根拠つき）

| # | 内容 | 根拠 |
| --- | --- | --- |
| S-1 | 第一章に存在しないもの: スキル習得・変化システム、スフィア盤ライクな成長、キャラクター強化 等 | UI-002-HD「第一章のゲームデザイン境界」 |
| S-2 | 第一章に存在するもの: Skill 1 / Skill 2 / Ult、鍛冶屋は「準備中」 | 同上 |
| S-3 | 第二章以降で解禁: スキル習得・スキル変化・スフィア盤 等。詳細は未決定 | 同上 |
| S-4 | 旧セーブ: 第一章（本編）では表示・入力・使用・新規入手を抑制する。削除・破壊・勝手な正規化をしない。第二章で使える可能性を残す | UI-002-HD「旧セーブを破壊しない原則」 |
| S-5 | Skill 3 は第一章では使えないゲーム機能（UI・入力・発動を停止）。旧セーブの装着状態は変更しない | HD-P2 / HD-P3（WI-A2 で実装済み） |
| S-6 | Chapter 1 の主人公は Skill 1 だけを持って出る。Skill 2 はダンジョン中盤で主人公自身が閃き、自動で装備される | docs/COMBAT.md「実装事実」、`core/chapter1-skills.js`、WORK 9 / 12.1 |
| S-7 | Skill 2 は主人公ごと。交代した主人公へ前の主人公の閃きを持ち越さない | WORK 12.1 §11、`14-hud-boot.js` の交代（`learnedSkill2 = false`） |
| S-8 | Skill 1 の既定は職業ごと（魔法使い = 幻影歩法）。剣士・盗賊・弓師は正式な指定が無いので `retreat` | WORK 12.1 §10 / §17-2、`defaultSkill1For` |
| S-9 | 上位職は Chapter 1 で使わない。ロード時に `job` を外す | WORK 12.1 §12、docs/PROGRESSION.md「決定（WORK 12.1）」、`normalizeChapter1Load` |
| S-10 | Loadout Change Rule: 探索中は変更可能、戦闘体勢・イベント・ボス演出中は変更不可 | docs/COMBAT.md「確定」、`loadoutChangeState` |
| S-11 | 同時に装備できるスキルは 2 つ（Chapter 2 でも同じ） | docs/COMBAT.md「確定」、`CHAPTER1_SKILL_SLOTS` |
| S-12 | AP-8 の送り先: N-1 Skill 1 の付け替え → UI-002-F、N-3「最強装備」「まとめて売却」「外す」→ UI-002-F、N-4 旧セーブの Skill 2・必殺技の付け替え → UI は UI-002-F／セーブ・ゲーム状態は別 Task 候補、N-2 鍛冶屋が装備・スキル・商店として機能 → UI-002-G、N-6「鑑定所」の名称 → UI-002-G | UI-002-HD AP-8（送り先の決定であり、内容の決定ではない） |
| S-13 | Undecided: 設定項目・通知履歴・Sphere Board UI・施設 UI・第二章以降の成長の詳細 | UI-002-HD「Undecided」 |

## 3. Skill 2 の整理

| 観点 | 状態（FACT） | 根拠（コード） |
| --- | --- | --- |
| 取得条件 | 本編: シナリオ中盤の閃きの一幕（剣士 = 洋館の瓦礫で崩し斬り、魔法使い = 宵待ちの村で観測の灯）。弓師・盗賊・影の旅人は閃きの一幕がまだ無い（WORK 12.1 §17-3）。テストモードは最初から使える | `grantChapter1Skill2` / `learnSkill2`、`hasSkill2`（`learnedSkill2 ‖ testMode`） |
| 保存 | `learnedSkill2`（bool）、`skill2Choice`（`default` / `alt`）、`unlockedSkill2Alt`（bool） | `09-save-load.js:47-48, 75` |
| 新規ゲーム | `learnedSkill2 = false`、`skill2Choice = 'default'`、`unlockedSkill2Alt = false` | `14-hud-boot.js:1470-1487` |
| 旧セーブ（`learnedSkill2` キー無し） | 習得済みとして読む（WORK 9 の方針。docs/PROGRESSION.md「実装事実」） | `loadedSkill2Flag` |
| 旧セーブ（alt 解放済み） | `unlockedSkill2Alt` と `skill2Choice:'alt'` をそのまま復元 | `09-save-load.js:181, 185` |
| 第一章での表示（鑑定所） | 未習得: 「まだ二つめの戦い方を持っていない」。習得後: default だけ「固定」。**旧セーブで alt 解放済みなら default / alt の 2 枚と「付け替え可能」** | `12-progression-ui.js:3212-3240` |
| 第一章での装備（付け替え） | **旧セーブで alt 解放済みなら、本編でも alt へ付け替えられる**（Loadout Change Rule の範囲で） | 同上（`data-skill2-choice`）、`bindSkillPanelHandlers` |
| 第一章での使用 | **`activeSkill2Def` は `skill2Choice==='alt' && unlockedSkill2Alt` なら alt を返す。本編の判定（`legacyGrowth()`）が無い** → 旧セーブでは本編でも alt の Skill 2 が出る | `12-progression-ui.js:2351-2353` |
| 交代後 | `learnedSkill2` は false に戻るが、`unlockedSkill2Alt` / `skill2Choice` は全職共通の値のまま。次の主人公が閃いた後、その職の alt（あれば）が出る（INFERENCE） | `14-hud-boot.js:1837`、`activeSkill2Def` |
| Chapter 2 の想定 | 「スキル習得・スキル変化」を解禁（S-3）。「習得済みから 2 つ選ぶ」（`chapter1-skills.js` の注記）。詳細は未決定 | UI-002-HD、`CHAPTER1_SKILL_SLOTS` |
| 鑑定所との関係 | Skill 2 の表示・付け替えは鑑定所の「スキル」タブ → 「スキル2」サブタブだけ | `renderSkillPanel` |

## 4. 必殺技 alt の整理

| 観点 | 状態（FACT） | 根拠（コード） |
| --- | --- | --- |
| 保存 | `ultChoice`（`default` / `alt`）、`unlockedUltAlt`（bool） | `09-save-load.js:47-48` |
| 解放条件 | スフィア盤のノード（`unlock:'ultAlt'`）だけ。本編ではスフィア盤のタブが出ないので新規には解放できない | `12-progression-ui.js:836, 866`、`LEGACY_AP_TABS` |
| 新規ゲーム | `ultChoice = 'default'`、`unlockedUltAlt = false`。テストモードは `unlockedUltAlt = true` | `14-hud-boot.js:1470-1471 / 1574-1575` |
| 旧セーブ | 解放済みなら `ultChoice:'alt'` を復元 | `09-save-load.js:182, 186` |
| 第一章での表示 | **旧セーブで解放済みなら、鑑定所の「必殺技」サブタブに default / alt の 2 枚と「付け替え可能」** | `12-progression-ui.js:3285-3300` |
| 第一章での使用（戦闘への影響） | **`recomputeStats` の ult は `ultChoice==='alt' && unlockedUltAlt` なら `ULT_ALT_BY_CLASS`（阿修羅・処刑人の一撃・絶対零度 等）。本編の判定が無い**（上位職の ult は `jobActive` で本編判定あり） → 旧セーブでは本編でも alt の必殺技（形・倍率・処刑ボーナス）が出る | `12-progression-ui.js:1786-1789` |
| 上位職の ult | 本編では出ない（`jobActive` が `legacy` で判定、ロード時に `job = null`） | `recomputeStats`、`normalizeChapter1Load` |
| Chapter 2 | 未決定（「スキル変化」の一部と読めるが、alt の扱いは記録に無い） | — |

## 5. Skill 1（参考: N-1 も UI-002-F へ送られている）

| 観点 | 状態（FACT） | 根拠 |
| --- | --- | --- |
| 本編の付け替え | 鑑定所「スキル1」で、その職の基本バリアント（ダッシュ斬り・切り下がり・回転斬り・剛絶の盾 等）を自由に選べる | `12-progression-ui.js:3187-3209` |
| スフィア盤の新技（`unlockKey:'skill1Alt'`） | **旧セーブで `unlockedSkill1Alt` なら、本編でも一覧に出て選べる。ロード時もその選択を復元する** | `12-progression-ui.js:3200`、`09-save-load.js:225-230` |
| 上位職専用の技（`unlockKey:'job'`） | ロード時の復元は `state.job` が立っている時点で判定され（`savedOk`）、その後 `normalizeChapter1Load` が `job = null` にする。`skillChoice` は戻されない → **旧セーブで上位職の Skill 1 を選んでいた場合、主人公の交代が起きないロードでは本編でもその技が出る**（INFERENCE: 実機未確認。次のセーブで `job:null` が書かれ、その次のロードでは `retreat` に戻る） | `09-save-load.js:199-230`、`14-hud-boot.js:1728, 2007-2008`、`13-update-loop.js:247` |
| 交代時 | `defaultSkill1For(class)` に戻す | `14-hud-boot.js:1832` |
| 仕様 | 付け替えの可否は docs に記述なし（UI-002-A Analyzer G-10）。Loadout Change Rule（S-10）は「変更可能」を前提に書かれている | — |

## 6. 鑑定所の整理

| 観点 | 本編（第一章）で今出ているもの（FACT） |
| --- | --- |
| タブ | 装備品・スキル・商店（ステータス配分・奥義の環は出ない） |
| スキルのサブタブ | スキル1・スキル2・必殺技（パッシブ・スキル3 は出ない） |
| 変更できるもの | Skill 1 の付け替え、（旧セーブのみ）Skill 2 / 必殺技の alt への付け替え、装備の着脱・最強装備・まとめて売却、商店での購入 |
| 開く場所 | 酒場の鍛冶士（加入前は仮設の作業台）、洋館の大広間のチェックポイント。テストモードはどこでも |
| 第一章の仕様との関係 | (1) 旧セーブの alt の表示・付け替え・使用は S-1 / S-4（スキル変化は第一章に無い、旧セーブは表示・入力・使用を抑制）と食い違う。(2) Skill 1 の付け替えが「スキル変化システム」に当たるかは決まっていない（N-1）。(3) 鍛冶屋は「準備中」（S-2）だが、鑑定所は装備・スキル・商店として機能している（N-2、UI-002-G） |
| 旧セーブの値が表示されることの問題 | alt 解放済みの旧セーブだけ、本編のスキル画面に「付け替え可能」と alt のカードが出る。新規ゲームでは出ない。プレイヤーによって第一章の画面と戦闘が変わる |

## 7. 旧セーブ（「保存されていること」と「本編で使用されること」）

| 値 | 保存 | 本編での使用（現状） | 決定済みの扱い（S-4） | 差 |
| --- | --- | --- | --- | --- |
| `learnedSkill2` | 保存 | 使う（第一章に存在する Skill 2） | — | なし（キー無しの扱いは §8 B-1） |
| `unlockedSkill2Alt` / `skill2Choice` | 保存 | **表示・付け替え・使用される** | 抑制 | **あり（A-1）** |
| `unlockedUltAlt` / `ultChoice` | 保存 | **表示・付け替え・使用される** | 抑制 | **あり（A-2）** |
| `unlockedSkill1Alt` / `skillChoice`（skill1Alt） | 保存 | **表示・付け替え・使用される** | 抑制 | **あり（A-3）** |
| `skillChoice`（上位職の技） | 保存 | 交代の無いロードの直後だけ使用される（INFERENCE） | 上位職は使わない（S-9） | **あり（A-4）** |
| `job` | 保存（本編のロード後のセーブで `null` が書かれる。WORK 12.1 の既存の挙動） | 使わない | S-9 | なし |
| `learnedBossActiveSkills` / `equippedBossActiveSkill`（Skill 3） | 保存 | 使わない（WI-A2） | S-5 | なし |
| スフィア・ランク・ボス能力・ボススキル・パッシブ・雇った仲間 | 保存 | 使わない（PROGRESSION-001 / 002） | S-4 | なし |

どれも、値を消す・変換する必要はない（PROGRESSION-001 / 002 と同じく、本編で読む所だけを止める形で足りる）。

## 8. A〜D 分類

### A. 仕様は決定済みで、実装だけが不足している

| # | 項目 | 決定（根拠） | 現在のコード |
| --- | --- | --- | --- |
| A-1 | 旧セーブの Skill 2 alt が本編で表示・付け替え・使用される | S-1（スキル変化は第一章に無い）、S-4（旧セーブは本編で表示・入力・使用を抑制）、AP-8 N-4 | `activeSkill2Def`（12:2351）、スキル2 サブタブ（12:3226-3235） |
| A-2 | 旧セーブの必殺技 alt が本編で表示・付け替え・使用される | 同上 | `recomputeStats` の ult（12:1786-1789）、必殺技サブタブ（12:3285-3300） |
| A-3 | 旧セーブのスフィア盤の Skill 1 新技（skill1Alt）が本編で表示・付け替え・使用される | S-1、S-4 | ロード時の復元（09:225-230）、スキル1 サブタブ（12:3200） |
| A-4 | 旧セーブの上位職の Skill 1 が、交代の無いロードの直後に本編で使われる（INFERENCE） | S-9（上位職は Chapter 1 で使わない） | 09:225-230 と `normalizeChapter1Load`（14:1728）の順序 |

A-1〜A-3 の抑制後の表示は、新規ゲームの本編と同じ表示（default だけの「固定」）になる。新しい画面・文言は要らない。ただし Skill 1 の一覧そのもの（基本バリアントの付け替え）は C-1 の決定に依存する。

### B. 仕様は存在するが、現在の実装との整合性確認が必要

| # | 項目 | 仕様 | 実装 | 確認が必要な点 |
| --- | --- | --- | --- | --- |
| B-1 | `learnedSkill2` キー無しの旧セーブは習得済み | S-6（Skill 1 だけで出発し、閃いて Skill 2） | `loadedSkill2Flag`（WORK 9。docs/PROGRESSION.md「実装事実」の「既に使えていた要素を取り上げない」） | WORK 9 より前のセーブで洋館未クリアなら、閃く前から Skill 2 を持っている。S-4（2026-09-27）より前の方針で、S-4 は「第一章に存在しないもの」についての原則なので直接は当たらない → C-5 |
| B-2 | Loadout Change Rule（確定）と「スキル習得・変化システムは第一章に無い」 | S-10 と S-1 | 鑑定所で Skill 1 を付け替えられる | 第一章で「何を」組み替えられるのかが決まっていない → C-1 |
| B-3 | 鍛冶屋は「準備中」 | S-2 | 鑑定所（鍛冶士）が装備・スキル・商店として機能 | UI-002-G（N-2）の範囲。Skill / 装備の画面をどこに置くかは F と G の境界 → C-4 |
| B-4 | `unlockedSkill2Alt` / `unlockedUltAlt` / `unlockedSkill1Alt` は全職共通の値 | S-3（第二章の詳細は未決定） | 主人公が替わっても解放状態が残る | 第二章の設計で扱う（第一章は A-1〜A-3 の抑制で影響しない） |

### C. Human Decision が必要なゲームデザイン

§9 に詳細。C-1 Skill 1 の付け替え／C-2 剣士・盗賊・弓師の第一章の Skill 1／C-3 第一章のスキル画面の役割／C-4 装備画面の道具（最強装備・まとめて売却・外す）／C-5 `learnedSkill2` キー無しの旧セーブ。

### D. 現時点では変更不要

| # | 項目 | 理由 |
| --- | --- | --- |
| D-1 | Skill 3（スキル3 サブタブ・入力・発動） | WI-A2 で停止済み（S-5） |
| D-2 | パッシブ・ステータス配分・奥義の環 | 本編では出ない（`LEGACY_AP_TABS` / `LEGACY_SKILL_SUBTABS`）。効果も PROGRESSION-001 で停止 |
| D-3 | 上位職の必殺技（「転身により固定」の表示・効果） | ロード時に `job = null`、効果は `jobActive` で本編判定 |
| D-4 | 閃きの流れ（剣士・魔法使い）と交代時のリセット | S-6 / S-7 どおり（WORK 9 / 12.1 の E2E あり） |
| D-5 | Loadout Change Rule の判定 | S-10 どおり |
| D-6 | テストモード | alt を全解放（開発用）。S-1 は本編についての決定 |
| D-7 | Skill 2 未習得時の表示 | S-6 どおり（「そのうち手に入る枠」を先に見せない） |

## 9. Human Decision 一覧

選択肢は事実と影響だけを並べる（順序に意味は無い）。

### C-1 第一章の本編で Skill 1 を付け替えられるか（AP-8 N-1）

- **決める必要があること**: 鑑定所で Skill 1 を職業の基本バリアントから選び直せる現状を、第一章でも残すか
- **Agent だけで決められない理由**: 「スキル習得・変化システムは第一章に無い」（S-1）と、「Loadout Change Rule: 探索中は変更可能」（S-10、確定）が両方あり、Skill 1 の付け替えがどちらに当たるかは記録に無い（UI-002-A G-10、N-1 は送り先だけ決定）
- **選択肢**:
  - (a) 現状のまま、基本バリアントの付け替えを第一章でも残す
  - (b) 第一章では付け替えを無くし、職業ごとの既定の Skill 1 に固定する（表示だけ残すか、画面から外すかは C-3）
  - (c) 第一章でも付け替えるが、選べる範囲を職業・シナリオごとに決めた一部に絞る
- **影響範囲**:
  - (a) コードの変更なし。Loadout Change Rule は第一章でも Skill 1 に使われる
  - (b) スキル1 サブタブ、ロード時の `skillChoice` の扱い、Loadout Change Rule の第一章での対象（Skill 2・必殺技も第一章では付け替え対象が無くなる）。C-2 が前提になる
  - (c) 職業ごとの選択肢の定義（新しい仕様）が要る
  - いずれも、スキルのカードを操作する既存 E2E（`chapter1-skill2`・`auto-combo`・`job-traits`・`ui-production-glyphs`）の確認が要る
- **関係する仕様**: S-1、S-8、S-10、UI-002-A G-10、WORK 12.1 §10 / §17-2
- **決定後の実装**: (a) なし（A-3 / A-4 は別途）。(b) スキル1 サブタブの表示条件、ロード時の `skillChoice` を `defaultSkill1For` で読む処理（セーブは変えない）、テスト。(c) 選択肢の定義と一覧の絞り込み、テスト

### C-2 剣士・盗賊・弓師の第一章での Skill 1（WORK 12.1 §17-2）

- **決める必要があること**: 魔法使い（幻影歩法）以外の 3 職の、第一章の正式な Skill 1
- **Agent だけで決められない理由**: 正式な指定が無く、従来の既定（`retreat` = 切り下がり）が入っているだけ。どの技をその人物の技にするかはキャラクターの設計
- **選択肢**: (a) 3 職とも現状の `retreat` を正式とする / (b) 職業ごとに別の基本バリアントを指定する
- **影響範囲**: `CHAPTER1_SKILL1`（1 行ずつ）、交代時・新規開始時の Skill 1、HUD の Skill 1 の glyph（UI-002-E）、E2E
- **関係する仕様**: S-8、docs/CHARACTERS.md
- **決定後の実装**: `CHAPTER1_SKILL1` への追加とテスト。C-1 で (b) を選ぶ場合の前提

### C-3 第一章の本編のスキル画面（鑑定所「スキル」タブ）の役割

- **決める必要があること**: A-1〜A-3 の抑制後（および C-1 の結果）、第一章の本編でスキル画面に何を残すか
- **Agent だけで決められない理由**: 画面構成は UI-002-F の Planner が「Human Approval で確定」する事項（UI-002-F Task）。付け替えが無くなる場合、確認だけの画面を残すかは UI の設計
- **選択肢**:
  - (a) 現状の 3 サブタブ（スキル1・スキル2・必殺技）を残し、付け替えられない項目は「固定」と表示する
  - (b) 付け替えが無い項目は確認用の表示だけにまとめる（サブタブの数・構成を変える）
  - (c) 第一章の本編ではスキルタブを出さない（技の確認は別の画面 = メニュー等に置く／置かない）
- **影響範囲**: 鑑定所の DOM・タブの表示条件、メニュー（UI-002-F の対象）、E2E（サブタブを開く `chapter1-skill2`・`mansion-escort`）、844×390 での表示
- **関係する仕様**: UI-002-F Purpose（「Chapter 1 に存在しない成長要素は表示しない」）、HD-1、C-1、C-4、UI-002-G（N-2 / N-6）
- **決定後の実装**: UI-002-F の Planner が画面構成を提示 → Human Approval → 実装

### C-4 装備画面の道具（「最強装備」「まとめて売却」「外す」）と画面の置き場所（AP-8 N-3、N-2 との境界）

- **決める必要があること**: 第一章の本編の装備画面に、「⚙️ 最強装備」「🪙 まとめて売却」「外す」を残すか。装備・スキルの画面を鍛冶屋（鑑定所）に置くか、メニュー等に置くか
- **Agent だけで決められない理由**: 第一章は「固定武器入手」「細かな武器ドロップは無い」「鍛冶屋は準備中」（S-1 / S-2）。これらの道具は複数の装備を管理するためのもので、第一章で持つ装備の数・入手経路の設計に依存する。置き場所は UI-002-G（N-2 / N-6）と重なる
- **選択肢**（道具）: 各ボタンごとに (a) 残す / (b) 第一章では出さない
- **選択肢**（置き場所）: (a) 鍛冶屋の鑑定所のまま / (b) メニュー（キャラクター画面）へ移す / (c) 両方から開ける
- **影響範囲**: 装備タブの DOM（`gear-best-btn` / `gear-sell-all-btn` / `data-unequip` を使う E2E は現在ない）、鍛冶屋の役割（UI-002-G）、宝箱・固定武器の入手後の装備の流れ
- **関係する仕様**: S-1、S-2、AP-8 N-2 / N-3 / N-6、HD-P5（一括鑑定は本編から除外済み）
- **決定後の実装**: UI-002-F（装備画面）と UI-002-G（鍛冶屋・名称）の Planner で分担を決める

### C-5 `learnedSkill2` キーの無い旧セーブ（WORK 9 より前）の Skill 2

- **決める必要があること**: キーの無い旧セーブを、今まで通り「習得済み」として読むか
- **Agent だけで決められない理由**: WORK 9 の方針（既に使えていたものを取り上げない、docs では「実装事実」）と、第一章の流れ（Skill 1 だけで出発し閃く、S-6）のどちらを優先するかの判断。S-4（旧セーブの原則）は「第一章に存在しないもの」についての原則で、Skill 2 は第一章に存在するので、直接は決まらない
- **選択肢**: (a) 現状のまま習得済みとして読む / (b) 未習得として読み、閃きの一幕で習得させる / (c) 進行（例: 洋館クリア済みか）から決める
- **影響範囲**: WORK 9 より前に作られたセーブだけ（新規ゲーム・WORK 9 以降のセーブは影響なし）。`loadedSkill2Flag`、閃きの一幕（二重に起きないこと）、E2E
- **関係する仕様**: S-6、S-7、docs/PROGRESSION.md「Save Data」、WORK 9
- **決定後の実装**: (a) なし。(b)(c) `loadedSkill2Flag` の変更とテスト（セーブの値そのものは変えない）

## 10. 次に必要な実装

| 順 | 内容 | 前提 |
| --- | --- | --- |
| 1 | A-1〜A-4: 本編で旧セーブの Skill 2 alt・必殺技 alt・Skill 1 の新技・上位職の Skill 1 を表示・付け替え・使用させない（セーブの値は残す。テストモードは今まで通り） | 決定済み（S-1 / S-4 / S-9）。PROGRESSION-001 / 002 と同じ形（読む所で `legacyGrowth()` を見る）。別の進行 Task（例: PROGRESSION-003）として実施できる |
| 2 | UI-002-F の Analyzer（現行画面の構成・入力・844×390 の実測） | UI-002-F Task の Analyzer requirements |
| 3 | UI-002-F の Planner（画面構成の提示） | C-1・C-3・C-4 の Human Decision |
| 4 | C-2 の反映（`CHAPTER1_SKILL1`） | C-2 の Human Decision |
| 5 | C-5 の反映 | C-5 の Human Decision（(a) なら不要） |

## 11. Known Limitations

- A-4 と §3 の「交代後」の挙動はコードの読み取り（INFERENCE）。実機では確認していない
- 844×390 での鑑定所・メニューの表示量・入力（PC / タッチ / パッド）は確認していない（UI-002-F の Analyzer の範囲）
- 第二章での alt・付け替えの扱いは、第二章の仕様が未決定（S-3）なので整理していない
- 剣士の Skill 2 の旧版「地裂斬」（`SKILL2_BY_CLASS.warrior`）は枠として残っている（WORK 9）。本書の判断対象外
