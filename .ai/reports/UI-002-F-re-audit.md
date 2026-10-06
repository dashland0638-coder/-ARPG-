# UI-002-F Re-Audit（PROGRESSION-001〜004 後の再監査）

| 項目 | 値 |
| --- | --- |
| Task | UI-002-F（Menu / Character UI。Status: DRAFT） |
| 種別 | 再監査（実装 Goal ではない。コード・テスト・仕様の変更なし） |
| Branch / 基準 SHA | `claude/agent-autonomous-execution-ewtk87` @ `de78814`（PROGRESSION-004 完了） |
| 前回 | `.ai/reports/UI-002-F-decision-audit.md`（`4f7c8f5`、PROGRESSION-003 の前） |
| Persisted by | Agent（Orchestrator） |
| 日付 | 2026-10-04 |

FACT = コード・記録で確認、INFERENCE = コードからの推定（実機では未確認）。「Recommended choice」は選択肢の整理であり、Agent がゲームデザインを決めたものではない。

## 1. Audit Goal

PROGRESSION-001〜004 の実装を反映した現在のリポジトリで、UI-002-F に残る本当の未決定事項・未実装事項・仕様矛盾だけを抽出する。前回の C-1〜C-5 を、現在の状態からゼロベースで評価し直す。

## 2. Baseline（PROGRESSION-001〜004 で決定・実装済み）

| # | 内容 | 実装（判定） | テスト |
| --- | --- | --- | --- |
| P-1 | 旧セーブの成長値（スフィア盤・ランク・ボス能力・ボススキル・パッシブ）を本編で使わない | `sphereValue` / `sphereVariantBonus` / `bossAbilityValue` / `triggerBossSkills` / `rankEffect` / パッシブの直接参照 → `legacyGrowth()` | unit `chapter1-growth-effects`、E2E `chapter1-old-save-growth` |
| P-2 | 旧セーブの「仲間を雇う」で本編に同行させない（正式な支援 AI は別） | `syncAlliesToState` → `legacyGrowth()` | 同上（ミニマップの点） |
| P-3 | 旧セーブの Skill 2 alt・必殺技 alt・Skill 1 新技・上位職 Skill 1 を本編で使わない（値は保持、テストモードは可） | `skill2AltAvailable` / `ultAltAvailable` / `skill1VariantUsable` / `activeSkill1Variant` | 同上 |
| P-4 | 鍛冶士の加入前（剣士だけ）は施設が無い（作業台なし・鑑定所／装備／スキル画面に入れない・館のチェックポイントは回復だけ）。施設は `smithJoined` で登場。テストモードは可 | `smithFacilityAvailable`（core） | unit `chapter1-rules`、E2E `chapter1-facility-access` |

Human が今回あらためて示した決定（本監査では決定済みとして扱う。Decision Record への記録は §6 W-5）:
- C-1: Chapter 1 の Skill 1 は職業固有の Skill 1 に固定する（付け替えなし）
- C-5: `learnedSkill2` キーの無い旧セーブは習得済みとして扱う

## 3. Previously Identified Items

| Item | Previous Status | Current Status | Evidence | Action |
| --- | --- | --- | --- | --- |
| C-1 Skill 1 の付け替え | Human Decision 待ち | **決定済み（固定）・未実装** | 鑑定所「スキル1」は本編でも基本バリアント（切り下がり・ダッシュ斬り・回転斬り・剛絶の盾 等）を一覧し、`data-variant` で付け替えられる（`12-progression-ui.js` `renderSkillPanel` の skill1 サブタブ）。ロード時は保存された基本バリアントを復元（`09-save-load.js`）。サブタブの見出しも「付け替え可能」。施設は加入後だけ（P-4）なので、問題は**加入後の本編** | W-1（Agent 実装） |
| C-2 剣士・盗賊・弓師の Skill 1 | Human Decision 待ち | **Human Decision 待ち（変わらず）** | `CHAPTER1_SKILL1 = {mage:'phantom'}`、他は `defaultSkill1For` の既定 `retreat`（WORK 12.1 §17-2「正式な指定が無いので従来の既定」）。PROGRESSION-003 も `retreat` を正式とは決めていない。C-1 の実装（W-1）は `defaultSkill1For` を使うので、C-2 が決まれば表に 1 行ずつ足すだけで反映される | HD-1 |
| C-3 スキル画面の構成 | Human Decision 待ち | **ほぼ解消** | 加入前は施設が無い（P-4）。加入後の本編で表示されるのは: Skill 1 = 固定（W-1 の後）、Skill 2 = 未習得の案内 or default だけ「固定」（P-3）、必殺技 = default だけ「固定」（P-3）、パッシブ・スキル3 は出ない（WI-A2 / WORK 12.1）。付け替えの操作は W-1 の後に何も残らず、確認用の表示になる。「第一章に存在しない成長要素は表示しない」（UI-002-F Purpose）には反しない | スキル画面を**どこに置くか**だけが残る → HD-2 に統合。見出しの文言は W-1 |
| C-4 装備画面の道具・配置 | Human Decision 待ち | **再定義**（加入前は P-4 で決定済み。加入後に施設が何を提供するか、が残る） | 第一章で装備が手に入る経路は、本編では開始時の固定装備だけ（ランダムドロップ・宝箱の装備・ボスの固有装備は `legacyGrowth()` で停止。WORK 12.1）。仕様の「固定武器入手」（UI-002-HD 第一章境界）に当たるコードは存在しない（grep で 0 件）。例外: 異空間の報酬（§7 X-1、W-2）。装備タブには装備の着脱・「⚙️ 最強装備」「🪙 まとめて売却」があり、施設の入口表示は「🔨 鍛冶士と話す(鑑定・強化)」だが、本編では鑑定（WI-A3）も強化（WORK 12.1）も無い。鍛冶屋は「準備中」（UI-002-HD）の位置付け | HD-2（施設の役割）。入口表示の文言は W-3 |
| C-5 `learnedSkill2` キー無しの旧セーブ | Human Decision 待ち | **決定済み（習得済み）・実装済み** | `loadedSkill2Flag`（`core/chapter1-skills.js`）がキー無しを true で読む。docs/PROGRESSION.md「Save Data」に方針。E2E `chapter1-skill2`「この機能より前のセーブ(キー無し)からは取り上げない」 | 記録のみ（W-5） |

## 4. Resolved Issues

| # | 前回の位置 | 内容 | 解決した Work Item |
| --- | --- | --- | --- |
| R-1 | audit A-1 | 旧セーブの Skill 2 alt が本編で表示・付け替え・使用される | PROGRESSION-003 |
| R-2 | audit A-2 | 旧セーブの必殺技 alt | PROGRESSION-003 |
| R-3 | audit A-3 | 旧セーブの Skill 1 新技（skill1Alt） | PROGRESSION-003 |
| R-4 | audit A-4 | 旧セーブの上位職 Skill 1（ロード順序） | PROGRESSION-003 |
| R-5 | PROGRESSION-001 Known Limitation | 旧セーブの「仲間を雇う」 | PROGRESSION-002 |
| R-6 | AP-8 N-5 | 旧セーブの成長値が本編の戦闘値に効く | PROGRESSION-001 |
| R-7 | audit C-4 前半・B-3 | 剣士だけの序盤に施設（作業台）が機能している | PROGRESSION-004 |
| R-8 | audit C-3 前半 | 加入前のスキル画面の見せ方 | PROGRESSION-004（施設が無い） |
| R-9 | audit C-5 / B-1 | `learnedSkill2` キー無しの扱い | Human Decision（習得済み）。実装は既存のまま |
| R-10 | audit B-2 | Loadout Change Rule と「スキル変化は第一章に無い」 | C-1（固定）で第一章には組み替えるものが無くなる。ルールはテストモード・Chapter 2 のためのものとして残る（docs の注記は W-6） |

## 5. Remaining Human Decisions

### HD-1（旧 C-2）剣士・盗賊・弓師の第一章の Skill 1 —— 2026-10-06 確定（§12）

- **Question**: 魔法使い（幻影歩法）以外の 3 職の、第一章で固定する Skill 1 は何か
- **Current State**: 3 職とも `defaultSkill1For` の既定 `retreat`（剣士 = 切り下がり、盗賊 = 影退きの一閃、弓師 = 五月雨射ち）。正式な指定ではない（WORK 12.1 §17-2）
- **Why code/spec cannot decide**: どの技をその人物の技とするかはキャラクター設計。docs/CHARACTERS.md・SCENARIOS.md に指定が無い
- **Options**: (a) 3 職とも現在の `retreat` 系を正式とする / (b) 職業ごとに別の基本バリアント（ダッシュ・回転・バリア 等）を指定する / (c) 新しい技を作る（第一章の範囲外の作業が増える）
- **Recommended choice**: 選択肢の整理のみ。(a) は実装変更なし、(b) は `CHAPTER1_SKILL1` に 1 行ずつ、(c) は技の新設
- **Impact**: `CHAPTER1_SKILL1`、HUD の Skill 1 の glyph（UI-002-E。剣士の承認済み glyph は「切り下がり」）、E2E。**決める時期**: W-1（Skill 1 の固定）の後、剣士が序盤で使う技が「付け替えられない唯一の技」になるので、第一章の出荷前

### HD-2（旧 C-3 の置き場所 + C-4）鍛冶士の加入後、第一章で鍛冶士の施設が何を提供するか

- **Question**: 加入後の本編で、鍛冶士の施設（鑑定所）に何を残すか。装備タブ（着脱・最強装備・まとめて売却）、スキル（確認だけ）、商店。「鍛冶屋は準備中」（UI-002-HD）をどう表すか
- **Current State**: 加入後は既存の鑑定所がそのまま開く（装備・スキル・商店の 3 タブ。ステータス配分・奥義の環は出ない）。入口表示は「鑑定・強化」だが本編に鑑定も強化も無い。装備を手に入れる経路は本編では開始時の固定装備だけで、仕様の「固定武器入手」は未実装（内容も未定義）
- **Why code/spec cannot decide**: 「準備中」の意味（何ができて何ができないか）が記録に無い。固定武器の入手が未定義なので、装備の道具が必要かどうかが決まらない。置き場所（鍛冶屋かメニューか）は UI-002-F と G（N-2 / N-6）にまたがる UI の設計
- **Options**: (a) 現状のまま（装備・スキル・商店を鍛冶士の前で）/ (b) 第一章の鍛冶士は「準備中」として装備の付け替えだけ（道具・スキル確認は出さない）/ (c) 装備・スキルの確認はメニュー（キャラクター画面）へ移し、鍛冶士は第二章で開く / (d) その他の組み合わせ
- **Recommended choice**: 選択肢の整理のみ。HD-3（商店の場所）と同時に決めると、施設の構成が一度で決まる
- **Impact**: 鑑定所の DOM・タブの表示条件、メニュー、入口表示、E2E、UI-002-G（鍛冶屋の役割・名称）

### HD-3（新規）剣士だけの序盤に、アイテムを購入できる場所が無い

- **Question**: 鍛冶士の加入前（剣士だけ）に、アイテム購入（薬草・魔力の雫・宿の一夜）をできなくてよいか
- **Current State**: 購入は鑑定所の「商店」タブだけ（`SHOP_ITEMS`、`12-progression-ui.js`）。PROGRESSION-004 で加入前は施設そのものが無くなったので、剣士だけの段階（洋館をクリアするまで）には購入の手段が無い（FACT）
- **Why code/spec cannot decide**: UI-002-HD 第一章境界は「アイテム購入」を第一章に存在するものとしている。PROGRESSION-004 の決定は「鑑定・装備変更・スキル変更など」の施設機能を止めるもので、購入を止めることを明示していない。どちらとも読める
- **Options**: (a) 序盤は購入なしで正しい（洋館をクリアするまで薬草は拾う・初期所持だけ）/ (b) 序盤も購入できるようにする（店主の出撃メニュー等、施設とは別の場所。どこに置くかも決める）/ (c) 洋館のチェックポイントで購入だけできる
- **Recommended choice**: 選択肢の整理のみ
- **Impact**: (a) なら記録だけ。(b)(c) は購入の入口の新設（施設とは別の入口なので PROGRESSION-004 の規則と両立させる設計が要る）

## 6. Agent-Executable Work Items（Human Decision なしで実装可能）

| ID | Priority | Work Item | Goal | なぜ必要か | 依存 | Human Decision |
| --- | --- | --- | --- | --- | --- | --- |
| W-1 | **A** | PROGRESSION-005: 第一章の Skill 1 を職業固有に固定 | 本編では Skill 1 = `defaultSkill1For(class)`。スキル1 サブタブは固定のカード 1 枚と「固定」の見出し、付け替え不可。保存された `skillChoice` は消さない・変換しない（PROGRESSION-003 と同じく読む所で止める）。テストモードは従来どおり | C-1 は決定済み（Human）だが、加入後の本編で基本バリアントを付け替えられる（FACT） | なし（HD-1 が後で決まっても `CHAPTER1_SKILL1` を変えるだけ） | 不要 |
| W-2 | **A** | PROGRESSION-006: 異空間の報酬で本編に装備を出さない | 本編では `grantAnomalyReward` の装備（`rollDropEquipment`、未鑑定・Item Level を持ちうる）を出さない。💎 / 🔩 は既に止まっている（`addItem` の WI-A5） | 第一章境界「鑑定武器・細かな武器ドロップは無い」、WORK 12.1「ランダム装備ドロップは本編では動かない」。洋館の食堂に 40% で裂け目が出て（`ANOMALY_RIFT_SPOTS.mansion`、`spawnAnomalyRiftForWorld` に本編の判定なし）、敵を倒すと装備が入る（FACT: コード。実機の出現は INFERENCE） | なし | 不要（裂け目そのもの・敵・ゴールドを残すかは §7 X-2） |
| W-3 | B | 鍛冶士の入口表示から本編に無い機能名を外す | 本編の「🔨 鍛冶士と話す(鑑定・強化)」→ 本編に存在する機能だけの表示（HD-P6 と同じ「仕様と食い違う説明文の修正」） | 本編に鑑定（WI-A3）も強化（WORK 12.1）も無い | HD-2 の結果で施設の中身が変わるなら、その後にまとめてもよい | 不要（ただし文言は HD-P4 の前例どおり Planner が候補を出す） |
| W-4 | C | `base-class-identity:413` の乱数の探索 | 向きの一様乱数を最大 40 回出し直す spec を、出現を待つ形に直す（合わない時に最後の向きを返す helper の不具合も） | CI-001・PROGRESSION-003 / 004 で FAIL を記録。UI-002-F とは無関係 | なし | 不要 |
| W-5 | C | Decision Record への記録 | 今回 Human が示した C-1（Skill 1 固定）・C-5（キー無しは習得済み）、PROGRESSION-002 の決定を `.ai/decisions/` に記録 | 今は会話と Task file にしか無い | なし | 不要（記録のみ。本監査では記録を作らない指示のため候補） |
| W-6 | C | docs の更新 | docs/COMBAT.md の Loadout Change Rule に「第一章では組み替える対象が無い（W-1 の後）」、docs/PROGRESSION.md の Save Data に C-5 が Human Decision であること | 実装事実と記述の食い違いを防ぐ | W-1 | 不要 |

## 7. Specification Conflicts

| # | 仕様 | コード | 分類 |
| --- | --- | --- | --- |
| X-1 | 第一章に「鑑定武器・細かな武器ドロップ」は無い（UI-002-HD）、ランダム装備は本編で動かない（WORK 12.1） | 異空間の報酬が本編でも装備を付与（`grantAnomalyReward`） | 実装の漏れ → W-2 |
| X-2 | 洋館は「分岐・周回変異は初回導線から外す一本道」（docs/SCENARIOS.md、MANSION_SCENARIO.md） | 洋館の食堂に異空間の裂け目が 40% で出る（裂け目・敵 2 体・ゴールド） | 裂け目そのものを第一章に残すかは記録に無い（分岐・周回変異とは別の仕組み）。W-2 は報酬の装備だけを止める。裂け目を残すかは Human 判断（優先度は低い。HD Summary には入れない） |
| X-3 | 第一章に「アイテム購入」は存在する（UI-002-HD） | 剣士だけの序盤は購入の手段が無い（P-4 の結果） | HD-3 |
| X-4 | 第一章に「固定武器入手」が存在する（UI-002-HD） | 固定武器を入手するコード・定義が無い | 未実装・内容未定義。装備画面の要否（HD-2）に影響。内容（どの武器をどこで）はシナリオ側の Human Decision で、UI-002-F の範囲外 |
| X-5 | Chapter 1 の主人公は Skill 1 を固定（C-1） | 加入後の本編で付け替え可能 | 実装の漏れ → W-1 |
| X-6 | 鍛冶屋は「準備中」（UI-002-HD） | 加入後の施設は装備・スキル・商店として機能、入口表示は「鑑定・強化」 | HD-2 / W-3 |
| X-7 | Chapter 1 の制限と Chapter 2 | 本編 = 第一章の判定は `legacyGrowthEnabled(testMode)` / `smithFacilityAvailable` で、「章」を見ていない（Chapter 2 の実行時の状態は存在しない） | 現時点では漏れ無し（Chapter 2 の機能はテストモードからしか触れない）。Chapter 2 を作る時に、これらの判定を章を見る形へ置き換える必要がある（記録のみ） |

## 8. Test Coverage Gaps

| 仕様 | 現在のテスト | 不足 |
| --- | --- | --- |
| Skill 1 固定（C-1） | なし（実装前） | W-1 で追加 |
| 異空間の報酬（X-1） | なし | W-2 で追加（unit の構造。E2E は裂け目が乱数で出るので unit 中心） |
| 洋館のチェックポイントが加入前は回復だけ（P-4） | unit の構造のみ | E2E は洋館の大広間まで歩けない（この環境の描画の遅さ。既存の判断と同じ）。テストモードのシナリオ開始地点から入れば検証できる可能性（ただしテストモードは施設あり） |
| 加入後の本編で装備の着脱が動く | `chapter1-legacy-ui`（装備タブの表示）、`character-weapon-visual`（装備する） | 「外す」・最強装備・まとめて売却は E2E なし（HD-2 で残すか決まってから） |
| 旧セーブの値の保持（P-1〜P-4） | E2E `chapter1-old-save-growth`・`chapter1-facility-access`（セーブし直して値が残る） | 十分 |
| テストモードの施設・alt | E2E（`chapter1-old-save-growth` テストモード、`chapter1-facility-access` テストモード、既存のテストモードの spec） | 十分 |

## 9. Known Flaky / Unrelated Issues

- `base-class-identity:413`（テストモードの Arena。Dummy の向きの乱数探索）: CI-001 で「乱数の探索、再評価」と記録、PROGRESSION-003 のローカル全体で FAIL→再実行 PASS、PROGRESSION-004 の GitHub Actions（`b1afaa1`）で FAIL（PR にコメント、1 回再実行）。UI-002-F とは無関係 → W-4
- `job-traits:162`（既存の `retries: 2`）: PROGRESSION-002 / 003 のローカル全体で flaky。UI-002-F とは無関係
- `combat-events-layout:70`・`execution-break:99`: PROGRESSION-003 のローカル全体で 1 回 FAIL、再実行 PASS。原因未調査。UI-002-F とは無関係

## 10. Recommended Next Work Item

**W-1 PROGRESSION-005（第一章の Skill 1 を職業固有に固定）**

- Human Decision（C-1）が既にあり、Agent だけで完遂できる
- 第一章のゲームプレイに直接影響する（加入後に Skill 1 を付け替えられる状態が残っている）
- HD-1（3 職の技）・HD-2（施設の役割）のどちらにも依存しない。後で HD-1 が決まれば `CHAPTER1_SKILL1` に行を足すだけ、HD-2 でスキル画面を移す・外す場合も固定の表示はそのまま使える
- W-2（異空間の報酬）も同じく Agent だけで完遂できる Priority A。W-1 の次に続けるか、同じ一連の進行 Task としてまとめてもよい

## 11. Human Decision Summary

1. **HD-1**: 剣士・盗賊・弓師の第一章の Skill 1 を何にするか（今は 3 職とも暫定の `retreat`）
2. **HD-2**: 鍛冶士の加入後、第一章で鍛冶士の施設が何を提供するか（装備の着脱・最強装備・まとめて売却・スキル確認・商店のうちどれを残すか、「準備中」をどう表すか、鍛冶屋かメニューか）
3. **HD-3**: 剣士だけの序盤（鍛冶士の加入前）に、アイテムを購入できなくてよいか

## 12. Update（2026-10-05、PROGRESSION-006 / 007）

| 項目 | 状態 | 記録 |
| --- | --- | --- |
| W-2 異空間の報酬 | PROGRESSION-006 で実装（PR #33） | `.ai/tasks/PROGRESSION-006.md` |
| HD-2 鍛冶士の施設の役割 | **Human Decision 確定（2026-10-05）・実装済み** — 第一章の鍛冶屋は装備管理・確認施設（装備する・外す・性能・売却・スキルの確認）。Skill 1 の固定は第一章だけ | `.ai/decisions/UI-002-human-decisions.md`「PROGRESSION-007」、`.ai/tasks/PROGRESSION-007.md` |
| HD-3 序盤の購入 | **Human Decision 確定（2026-10-05）・実装済み** — 第一章では通常ショップの購入なし（加入前・加入後とも）。消耗品は宝箱・敵・シナリオ・イベントで限定的に入手 | 同上 |
| W-3 入口表示の文言 | PROGRESSION-007 で実装 — 本編は「🔨 鍛冶士と話す(装備の管理)」、見出し「鍛冶屋」 | 同上 |
| X-3 / X-6 | HD-3 / HD-2 で解消 | — |
| HD-1 3 職の Skill 1 | **Human Decision 確定（2026-10-06）** — 剣士 切り下がり / 盗賊 影退きの一閃 / 弓師 五月雨射ち（魔法使い 幻影歩法）。コードは既に一致 | `.ai/decisions/UI-002-human-decisions.md`「PROGRESSION-010」 |

