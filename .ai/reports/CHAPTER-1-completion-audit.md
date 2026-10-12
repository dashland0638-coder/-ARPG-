# CHAPTER-1 Completion Audit — 第一章の現状監査（Analyzer）

| 項目 | 値 |
| --- | --- |
| 種別 | Analyzer（調査のみ。ゲームコード・テスト・docs の変更なし） |
| 日付 | 2026-10-12 |
| 対象 | `origin/main` `2089a88`（PR #71 まで）。ゲームのコード（`src/` `index.html` `basefile.html` `public/`）は `6ba05c8` から変更なし（差分は `tools/music-composer/` とそのテスト 2 本だけ） |
| ブランチ | `claude/chapter1-completion-audit`（`origin/main` から作成。成果物はこのファイルと `CHAPTER-1-completion-plan.md` だけ） |
| 目的 | 第一章を、新規セーブから最後まで自然に遊べる品質へ近づけるための現状把握 |

表記: **FACT** = コード・テスト・記録で確認した事実 / **INFERENCE** = コードから導いた推測（未再現） / **UNCONFIRMED** = 実機・人の操作でしか確かめられず、まだ誰も確かめていないもの。

---

## 1. 結論

- **CODE READY（自動テストで言える範囲）= YES に近い。** 5 段（洋館・村・幽霊船・時計塔・道）は本編から順に遊べる形で `main` にある。進行不能を起こす既知の不具合は無い（FACT: 既存の監査・CI・本監査のコード照合）。CI の E2E 全体は `6ba05c8` で 255 / 255 PASS（GitHub Actions run #104、2026-10-11）。
- **CONTENT READY = 未判定。** 新規セーブから最後までの実機（iPhone）の通しプレイは、**一度も行われていない**（FACT: `docs/CHAPTER1_PLAYTEST.md` の記録用紙は空、`.ai/tasks/CQ-01.md`・CM-07・CV-01・CV-02 は Human 待ち）。
- 「自然に遊べる品質」を妨げる、**仕様に対する欠け**が見つかった（下の P1）。
  1. **Skill 2 の閃きが剣士・魔法使いの 2 人にしか無い。** 弓師・盗賊・影の旅人は、第一章の間ずっと Skill 2 を持たない（FACT）。
  2. **第一章に無い「鑑定・強化」を案内する台詞**が、本編の酒場の会話に残っている（FACT）。
  3. **支援 AI の表現が簡易なまま。** 円柱と球だけの姿、攻撃の動きなし、壁との当たり判定なし、職業による違いなし。与ダメージは主人公の攻撃力から計算している（FACT）。
- 件数: **P0 1 件 / P1 3 件 / P2 7 件 / P3 8 件 / P4 6 件**（§6）。

---

## 2. 確認した根拠

| 区分 | 確認したもの |
| --- | --- |
| Git | `origin/main` `2089a88`。開いている PR は #72（MUSIC-AUDIO-004、`tools/` のみ。別セッション）。手元の作業ツリーは clean。他の作業ブランチは変更していない |
| 規則 | `.ai/AGENTS.md`、`CLAUDE.md`、`.ai/decisions/UI-002-human-decisions.md`（Undecided を含む）、`DEC-001`〜`DEC-005` |
| 仕様 | `docs/CHAPTER1_STORY.md`、`docs/SCENARIOS.md`、`docs/PROGRESSION.md`、`docs/CHAPTER1_PLAYTEST.md`、`MANSION_SCENARIO.md`、`docs/CHARACTERS.md`、`docs/COMBAT.md` |
| 過去の監査・計画 | `PROGRESSION-009-audit.md` / `PROGRESSION-010-final.md`、`CHAPTER1-CONTENT-analysis.md` / `-plan.md`、`CHAPTER1-WORK12-report.md` / `WORK12.1-report.md`、`CQ-01-analysis.md` / `CQ-01-report.md`、`CHAPTER1-GHOSTSHIP-balance.md`、`CHAPTER1-CLOCKTOWER-balance.md`、UI-002-F / H の report |
| Task | `.ai/tasks/` の全 Task の Status。UI-002-G / UI-002-I は本文まで確認 |
| コード | `core/chapter1-progress.js`、`core/chapter1-rules.js`、`core/chapter1-skills.js`、`01`（`CHAPTER_CAST`）、`08`（支援 AI）、`09`（セーブ）、`10`（入力・メニュー）、`12`（出撃・結果・戦闘不能・酒場の会話）、`14-hud-boot`（読み込みの正規化・交代）、`03`（時計塔の跳躍・島）、`07`（時計塔のボス）、`14-dungeon-road` |
| テスト | `tests/` の spec 51 本・unit 90 本の一覧。第一章の spec は `test()` の中身（何を検証しているか）まで読んだ: `chapter1-progression`、`chapter1-legacy-ui`、`chapter1-old-save-growth`、`chapter1-smith-shop`、`chapter1-facility-access`、`chapter1-skill2`、`chapter1-dusk-basics`、`chapter1-tower-to-road`、`save-load`、`guest-companion`、`road`、`mansion-escort` |
| 実行（今回） | `npm run build` PASS。`npm run test:unit` 1783 件中 1782 PASS / 0 FAIL / 1 SKIP（既存）。E2E は実行していない（ゲームのコードが CI で検証済みの `6ba05c8` と同じため。§5） |

---

## 3. 完了済み（現行コードと照合して確認したもの）

| 領域 | 内容 | 根拠 |
| --- | --- | --- |
| 進行 | 5 段の一本道。再訪なし、寄り道なし、倒れたら同じ段を最初から。進行は `scenarioClears` だけから導き、新しいセーブ項目は無い | `core/chapter1-progress.js`（`stageFor` / `nextScenario` / `offeredScenarios`）、`12` `renderScenarioList`、E2E `chapter1-progression`（全 11 件） |
| 主人公交代 | 剣士 → 魔法使い → 弓師 → 盗賊 → 影の旅人。前の主人公は支援 AI | `CHAPTER_CAST`（`01:282`）、`resolveCast`、E2E `chapter1-progression`・`road`・`chapter1-tower-to-road` |
| 物語 | CHAPTER1_STORY §4 の全段（CG-02/03、CT-02/03、CR-01〜03） | `CHAPTER1_STORY.md` §7、unit `ghostship-*`・`clocktower-*`・`road-*` |
| 洋館 | 間取り・場面・閃き・撃破後の流れ・演出の照合・区間のつながり（CM-01〜06） | PR #38〜#43（2026-10-11 merge）、unit `mansion-*` |
| 村 | 負荷の上限、洋館からの継ぎ目、BGM（CV-01・CV-03・CA-01） | PR #45〜#48、unit `village-load`・`chapter1-mansion-to-village`・`procedural-bgm` |
| 禁止要素の遮断 | レベル・経験値・装備ドロップ・鑑定・強化・スフィア・パッシブ・商店・Skill 付け替え・Skill 3・異空間・転身 | `core/chapter1-rules.js` `legacyGrowthEnabled`、PROGRESSION-001〜010、E2E `chapter1-legacy-ui`・`chapter1-old-save-growth`・`chapter1-smith-shop` |
| 出撃画面 | 本編ではレベル・★・推奨レベルを出さない。出せるのは次の 1 つだけ。章を終えたら「この先の旅」（出撃不可） | `12` `renderScenarioList`、E2E `chapter1-progression` |
| 撤退 | 本編の確認文に XP を出さない | `10:174` |
| UI | メニュー・鍛冶屋（UI-002-F）、会話・通知・確認・結果・戦闘不能（UI-002-H） | PR #68 / #69、E2E `menu-character-layout`・`dialog-result-layout` |
| 目的の手がかり | まだ起きていないイベントの地点を、ミニマップに「!」で出す（全ダンジョン共通） | `14-hud-boot.js:735` |
| CI | E2E 全体 255 / 255 PASS | Actions run #104（`6ba05c8`） |

---

## 4. 未完了・指摘事項

### 4-1. P0 — 第一章の完成判定を止めているもの

#### P0-1 新規セーブから最後までの実機通しプレイが一度も無い（FACT）
- **根拠**:
  - `docs/CHAPTER1_PLAYTEST.md` §11 の記録用紙が空。
  - `CQ-01-report.md`: CONTENT READY = HUMAN DEVICE CHECK REQUIRED。
  - CM-07・CV-01・CV-02 が WAITING_HUMAN。
- **自動テストで見ていない区間**:
  - 本編で時計塔を登り切る E2E が無い（`CQ-01-analysis.md` §4）。
  - 屋上 → 跳躍 → 島は unit とスクリーンショットだけ。
  - 洋館のボスから酒場までを本編で通す E2E も無い（`WORK12.1-report` §16-1）。
- **影響**: 第一章を「完成」と判定する手段が無い。島の見え方、跳躍の間、テンポ、iPhone での負荷は、実機でしか判定できない。
- **修正コスト**: Human の通しプレイ 1 回（数時間）と、結果の整理。
- **依存関係**: 無し（いつでも実施できる）。P1 の修正の前と後の 2 回を推奨（plan §2）。

### 4-2. P1 — 普通に遊ぶと出会う、仕様に対する欠け

#### P1-1 弓師・盗賊・影の旅人に Skill 2 の閃きが無い（FACT）
- **仕様**: 「Skill 2 はシナリオ中盤で、その人が閃く」。
  - 根拠: `core/chapter1-skills.js` の冒頭、`14-hud-boot.js:1839`、`docs/PROGRESSION.md:74`「成長は主人公の交代と Skill 2 の閃きで表す」。
- **実装**:
  - 交代のたびに `state.learnedSkill2 = false`（`14-hud-boot.js:1842`）。
  - `grantChapter1Skill2()` を呼ぶのは 2 か所だけ。
    - 洋館の瓦礫（`12-progression-ui.js:449`）
    - 村の中盤（`14-dungeon-duskvillage.js:1129`）
- **結果**: 弓師（幽霊船）・盗賊（時計塔）・影の旅人（道）は、第一章の間ずっと Skill 2 のボタンが出ない。
- **記録**:
  - `CHAPTER1-WORK12.1-report.md` §17-3 に「各シナリオの制作時に足す」とある。
  - CG・CT・CR の各 Task では足されていない（`grantChapter1Skill2` の呼び出し元が 2 か所のまま）。
  - 一方で、幽霊船・時計塔の実機確認表（`CHAPTER1-GHOSTSHIP-balance.md` B-5、`CHAPTER1-CLOCKTOWER-balance.md` B-5）は「Skill 2 の手触り」を確認項目にしていて、記録同士が食い違っている。
- **影響**: 第一章後半の 3 人の成長表現（閃き）が無い。後半ほど操作の幅が狭くなる。
- **修正コスト**: 中。
  - 既存の閃きの一幕（`playCutscene`）・`grantChapter1Skill2`・`SKILL2_BY_CLASS` を再利用できる。
  - 新しいシステムは要らない。
  - ただし、台詞（誰の行動を見て何に気づくか）と置き場所は物語の追加になる。
- **依存関係**:
  - 影の旅人は剣士の型を借りている（C-2 未決定）ので、P2-5 と一緒に決める。
  - **Escalation 候補**（§7 E-1）: 物語の追加と、各職の Skill 2 の確認。

#### P1-2 本編の酒場の会話が、第一章に無い「鑑定・強化」を案内する（FACT）
- **場所**: `12-progression-ui.js:253`。酒場の隅の人物（加入前の影の旅人）の初回会話 `SHADOW_GUIDE_INTRO`。
- **内容**: `state.smithJoined` のとき「奥にいるのが鍛冶士。装備の鑑定や強化は、そちらで頼めます。」を出す。
- **仕様**: 第一章の鍛冶屋は装備の管理だけ（HD-2）。鑑定・強化は無い。
- **再現手順**:
  1. 新規開始で、隅の人物に話しかけずに洋館をクリアする。
  2. 魔法使いになった酒場で、隅の人物に初めて話しかける。
  3. 上の行が出る。
- **既存テストで見つからなかった理由**:
  - PROGRESSION-009 の監査は、トーストと案内文の経路を見ていて、この会話の行は対象外だった。
  - E2E `shadow-guide` は加入前のセーブで話しかけるので、この分岐を通らない。
- **影響**: 禁止要素を「案内」する文言。`CHAPTER1_PLAYTEST.md` の G-05 の趣旨に反する。
- **修正コスト**: 小（1 行と E2E 1 件）。
- **依存関係**: 台詞の文言の変更なので、文言は Human が確認する（§7 E-2。推奨文言を plan に記載）。

#### P1-3 支援 AI の表現・挙動が簡易なまま（FACT）
- **場所**: `08-loot-equipment.js:1028`（`buildGuestCompanion`）、`:1066`（`updateGuestCompanion`）。
- **見た目**: 円柱と球に、小さな棒が 1 本。主人公のリグではない。前の段まで主人公だった剣士・魔法使い・弓師・盗賊が、支援になった途端にこの姿になる。
- **攻撃**:
  - 間合い（`meleeRange`、無ければ 1.8m）に入ると、動きも演出も無いまま `dealDamageToEnemy` でダメージが入る。
  - 弓師・魔法使いも近づいて殴る（遠隔攻撃なし）。
- **与ダメージ**: `state.classDef.atk`、つまり**主人公の**攻撃力を使っている（`:1113`）。支援の職業の値ではない。
- **移動**: 壁との当たり判定を通していない（`:1112`・`:1126` は位置を直接動かすだけ）。追従中に壁を抜ける可能性がある（INFERENCE: 実際に抜ける様子は未確認）。
- **HP・被弾**: 無い。表示は Undecided の「支援 AI の HP 表示」。
- **記録**:
  - 見た目の寄せ（CHARACTER-VIS-001 T-6）は 2026-09-25 に Human 判断で取り下げ。
  - 挙動の仕様は docs に無い（`docs/SCENARIOS.md` Companion は「敵の選択・追従・攻撃を行う」だけ）。
- **影響**: 「仲間と一緒に進む」第一章の構造が、見た目と手触りの両方で伝わりにくい。
- **修正コスト**: 中〜大（範囲しだい）。
- **依存関係**: **Escalation 候補**（§7 E-3）。範囲（当たり判定と攻撃力の修正だけ／職業ごとの攻撃／リグの流用）を Human が決める。

### 4-3. P2 — 体験を損なう、または検証が足りないもの

#### P2-1 時計塔の撃破後〜島の間に保存が走ると、島の場面を見ずに道へ進む（INFERENCE）
- **根拠**:
  - 時計塔のボスは `endsRun:false, afterDefeat:'towerCollapse'`（`07-ai-combat.js:480`）。
  - 結果画面の時点で `scenarioClears.clocktower` が 1 になる（`12-progression-ui.js:1069`）。
  - その後の崩壊 → 見晴台 → 跳躍 → 島（`03:854` `showIslandStranger`、N-4 の人影）は、同じ出撃の中の演出。
  - `visibilitychange`（iPhone の画面ロック・アプリ切り替え）で `saveGame()` が走る（`09-save-load.js:284`）。
- **再現手順（推定）**:
  1. 時計塔のボスを倒す。
  2. 崩壊の途中で、ホームに戻ってアプリを閉じる。
  3. 開き直すと酒場から始まり、次の行き先は道になる。
- **結果**: 島の場面（第一章の物語の要「影が遅れる人影」、PLAYTEST の D-14〜D-16）を見ないまま進む。進行不能ではない。
- **途中で倒れた場合**: 崩壊の間に倒れたときも、同じく酒場へ戻る（`triggerPlayerDown` → `returnToTown(true)`）。
- **修正コスト**: 中。直し方によっては進行の記録の時点（凍結対象）に触れる。
- **依存関係**:
  - まず再現の確認（state を注入する E2E）。
  - 直し方は **Escalation 候補**（§7 E-4）。
  - 同じ形の場面は、幽霊船の撃破後の船長の一言（結果画面の後）にもある（影響は小）。

#### P2-2 PC のキーボードで会話を送れない（FACT）
- **根拠**:
  - `keydown` は `state.dialogueActive` の間は何もしない（`09-save-load.js:316`）。
  - 会話を送れるのは、画面のクリック（`12-progression-ui.js:1374`）とパッドの A（`10-input.js:368`）だけ。
  - UI-002-H では、この仕様のまま表記だけ「クリックして続ける」にそろえた（H-D5）。
- **影響**: キーボードで遊ぶ PC プレイヤーは、会話のたびにマウスへ持ち替える。iPhone（タップ）には影響しない。
- **修正コスト**: 小。
- **依存関係**: 入力仕様の変更なので **Escalation 候補**（§7 E-5）。

#### P2-3 E2E の空白: 幽霊船・時計塔の本編経路、本物の戦闘不能（FACT）
- **幽霊船・時計塔**: 本編経路の E2E が 1 本も無い（unit の `ghostship-*`・`clocktower-*` だけ）。台詞の配置は unit で固定しているが、画面に出るか・順番どおりに出るかは自動で見ていない（PLAYTEST の 🧪 の項目）。
- **戦闘不能**: `chapter1-progression.spec.js:246` は `#down-return-btn` を直接押していて、HP 0 → 戦闘不能の画面 → 所持金 30% の喪失、の本物の経路は通らない。
  - 戦闘不能の画面の見た目は `dialog-result-layout`（Test Mode の入口）で確認済み。
- **影響**: 後半 2 段の退行を CI で拾えない。
- **修正コスト**: 中（state を注入する E2E。この環境は 3〜7fps なので、各場面へは state の注入で入る）。
- **依存関係**: 無し（Agent Approval の範囲。テストのみ）。

#### P2-4 酒場・出撃の UI が旧来の見た目のまま（UI-002-G 未着手、UI-002-I 未着手）（FACT）
- **見た目**: 出撃画面（`#scenario-overlay`）は、ぼかし 3px とグラデーションの旧来のまま。
  - F（メニュー・鍛冶屋）と H（会話・結果）はプレートにそろったので、酒場の主人の出撃画面だけ見た目が違う。
  - `tests/ui-foundation.spec.js` がこの旧来の値を固定している。
  - `tests/dialog-result-layout.spec.js` の最後の 1 件は、`.event-btn` の変更が出撃のボタンに及ばないことを固定している。
- **Task の状態**:
  - UI-002-G は DRAFT（Analyzer 前）。
  - UI-002-I は D・E・F・G・H の完了が前提で、DRAFT。
- **影響**: 酒場は毎回通る画面なので、見た目の不統一が目に付く。
- **修正コスト**: 中（G）、中（I）。
- **依存関係**: G → I の順。H の実機確認（UI-002-H report の未確認項目）を I の前に済ませる。

#### P2-5 影の旅人の第一章の Skill 1（C-2）と、剣士の型の借用（FACT / 未決定）
- **根拠**:
  - `docs/CHARACTERS.md:133`「今は剣士の kit を借りた暫定」。
  - `.ai/decisions/UI-002-human-decisions.md` の Undecided C-2。
  - 斬撃の色だけ影の紫（DEC-005）。
- **影響**: 第一章の最後の主人公が、剣士と同じ操作感のまま終わる。
- **依存関係**: **Escalation 候補**（§7 E-1 と一緒に）。

#### P2-6 結果画面がゴールド 1 行だけで、ゴールドに使い道が無い（FACT / 未決定）
- **事実**: 第一章のボスの報酬品は 5 体すべて `type:'gem'`（`06:4352`、`07:450/505`、`14-dungeon-duskvillage.js:1285` ほか）。第一章では 💎 を出さない（WI-A5）ので、結果画面は「🪙 ゴールド +N」の 1 行だけ。
- **未決定**:
  - ゴールドの使い道（C-3）
  - ボス報酬の固有名（「主の袖飾り」「狂った時針」など）の扱い（UI-002-A の Undecided）
- **影響**: ボスを倒した手応えが結果画面に出ない。ゴールドは戦闘不能で 30% 失う（`12:1177`）が、使う場面が無い。
- **依存関係**: **Escalation 候補**（§7 E-6）。

#### P2-7 実機（iPhone）の負荷・読みやすさ・音が未測定（UNCONFIRMED）
- **未確認の範囲**:
  - CV-01（村の負荷の上限の実測）
  - CV-02（村の手触り・ボス戦の長さ）
  - CG-05 / CT-05（幽霊船・時計塔の数値と H-1〜H-12）
  - UI-002-F / H（正式な書体・タッチ）
  - CA-01（BGM の聞こえ方）
- **影響**: 低 fps・発熱・読みにくさがあっても、まだ分からない。
- **依存関係**: P0-1 の通しプレイと同時に記録できる（plan §4）。

### 4-4. P3 — 小さな食い違い・判断待ち

| ID | 内容 | 根拠 | 区分 |
| --- | --- | --- | --- |
| P3-1 | 旧セーブの上位職 `job` は、本編で読み込むと `null` になり、次の保存で消える。docs の「旧セーブの値は保存したまま使わない（D-5）」と食い違う | `14-hud-boot.js:1733` `normalizeChapter1Load`、`09-save-load.js:61`。PROGRESSION-009 はこれを A と判定し、同時に D-5 を掲げている | FACT。Human 判断（§7 E-7） |
| P3-2 | 出撃前の会話の最後に、性格の決まり文句が付く。魔法使い（cheerful）は「これは胸が躍る!さあ、行こう!」。第一章の人物像（慎重・真面目）と温度が違う | `12-progression-ui.js:22`・`:339`、`WORK12-report.md` §16-2（未解決のまま） | FACT。台詞は Human 判断 |
| P3-3 | MP バーと 🔷（魔力の雫）が本編の HUD に出る。MP を使うのは必殺技の照準を保つ間だけ（`11:1652`） | HD-D29「MP 廃止は別 Task」（Task 未起票） | FACT。別 Task |
| P3-4 | 戦闘不能の文「見知った街の外れに倒れていた」の後、実際は酒場から再開する。所持金 30% の喪失は、ゴールドに使い道が無いので意味が薄い | `index.html` の `#down-overlay`、`12:1177`、`returnToTown(true)` | FACT。文言は Human 判断（P2-6 と一緒に） |
| P3-5 | 開始時の装備以外の固定装備（C-1）が未決定。鍛冶屋の装備画面・売却は、開始時の 3 点にしか使えない | Undecided C-1、PROGRESSION-009 F-5 | 未決定 |
| P3-6 | 鍛冶士との再会の台詞は、交代と重なるので本編では出ない | `WORK12.1-report.md` §17-5（未解決） | 未決定 |
| P3-7 | 既知の不安定なテスト。`mansion-enemies:220`（TF-02、未調査）、`job-traits:97 / :162`、`base-class-identity:413`、`chapter1-tower-to-road:111`（TF-04、ローカルの低 fps でだけ時間切れ）、`music-sample-engine` の聞き比べ（MUSIC-AUDIO-001）。いずれも第一章の本編の経路外か、環境由来 | PROGRESSION-010 §6、`CHAPTER1_PLAYTEST.md` §12、UI-002-F / H の report | FACT |
| P3-8 | `menu-character-layout` などの撮影スクリプトは、Google Fonts が読めない環境で撮っている。正式な書体での見え方は未確認 | UI-002-F / H の report | UNCONFIRMED |

### 4-5. P4 — 記録の整理・第二章へ送るもの

| ID | 内容 | 根拠 |
| --- | --- | --- |
| P4-1 | docs の古い記述。①`docs/SCENARIOS.md:126`「CM-05 で訂正予定」（訂正済み）②`docs/CHAPTER1_PLAYTEST.md:33`「テストが未 merge の PR（#39〜#43）」（merge 済み）③同 §4 の注・§11「CA-01 #45 が main に入っていたか」（2026-10-11 merge 済み） | 本監査で照合 |
| P4-2 | Task の Status が実態と違う。`UI-002-D.md` は `Status: PLANNED` だが、WI-D0〜D7 はすべて DONE。`MAGE-001.md` は PLANNED（未着手）だが、幻影歩法は実装済み（`12:2238`、`core/decoy.js`）。`CHAPTER-STRUCTURE.md` は「Chapter 進行の実装は未着手」だが、WORK 10 / 11 で実装済み | 各 Task file |
| P4-3 | 育成系の関数（`unlockSphereNode` など）の中に第一章の判定が無い（UI 側でだけ止めている） | PROGRESSION-009 B-4（第二章の設計時に扱うと Human 決定済み） |
| P4-4 | `legacyGrowth()` が「テストモードか」と同じ。第二章で章の判定へ置き換えが要る | PROGRESSION-009 R-1 / R-2（第二章） |
| P4-5 | アイコンの置換（UI-002-F の F6）は保留中 | UI-002-F の Task |
| P4-6 | 未決定の UI 項目（目的表示・3 人パーティ HUD・影の旅人専用 HUD・パッド表記・設定項目・通知履歴） | Decision record の Undecided |

---

## 5. build / unit / E2E / CI の現状

| 項目 | 結果 | 対象 |
| --- | --- | --- |
| build | PASS | `2089a88`（今回） |
| unit | 1783 件中 1782 PASS / 0 FAIL / 1 SKIP（既存） | `2089a88`（今回） |
| E2E 全体（CI） | **255 / 255 PASS**（1.1 時間） | `6ba05c8`、Actions run #104。以降の main の変更は `tools/music-composer/` とそのテストだけで、ゲームのコードは同じ |
| E2E（PR #70 / #71 の CI） | PASS | `56be579` / `0f44a90`（run #121 / #123） |
| ローカル E2E | 全体は 2 時間を超えるので実行していない。この環境の低 fps（3〜7fps）による時間切れ（TF-04）は、不具合と区別して記録する | — |

**区別**: 今回の監査ではコードを変えていないので、新しく起きた失敗は無い。既知の失敗はすべて P3-7（環境由来か、第一章の本編の経路外）。

---

## 6. 優先度の一覧

| 優先度 | 件数 | ID |
| --- | --- | --- |
| P0 | 1 | P0-1 |
| P1 | 3 | P1-1、P1-2、P1-3 |
| P2 | 7 | P2-1〜P2-7 |
| P3 | 8 | P3-1〜P3-8 |
| P4 | 6 | P4-1〜P4-6 |

| ID | 影響 | 修正コスト | 依存関係 | Human 判断 |
| --- | --- | --- | --- | --- |
| P0-1 | 完成判定ができない | Human の通し 1 回 | 無し | 実施は Human |
| P1-1 | 後半 3 人に Skill 2 が無い | 中 | P2-5 と一緒に | 要（E-1） |
| P1-2 | 禁止要素の案内 | 小 | 無し | 文言の確認（E-2） |
| P1-3 | 仲間の表現が弱い | 中〜大 | 無し | 要（E-3） |
| P2-1 | 島の場面を見ずに進むことがある | 中 | 再現の確認が先 | 直し方は要（E-4） |
| P2-2 | PC で会話を送りにくい | 小 | 無し | 要（E-5） |
| P2-3 | 後半の退行を CI で拾えない | 中 | 無し | 不要 |
| P2-4 | 酒場の見た目の不統一 | 中 | G → I | G・I の承認 |
| P2-5 | 最後の主人公の操作感 | 中 | P1-1 | 要（E-1） |
| P2-6 | 撃破の手応え | 小〜中 | 無し | 要（E-6） |
| P2-7 | 実機の負荷・読みやすさ | Human の計測 | P0-1 と同時 | 実施は Human |

---

## 7. Escalation 候補（既存の docs・decisions・tests で解決できないもの）

| ID | 判断すること | 選択肢の例（詳細は plan） |
| --- | --- | --- |
| E-1 | 弓師・盗賊・影の旅人の Skill 2 の閃きと、影の旅人の Skill 1（C-2） | (a) 既存の `SKILL2_BY_CLASS` の技を、各段の中盤の一幕で閃く ／ (b) 第一章では閃きを 2 人だけにして、仕様の記述を直す ／ (c) 影の旅人だけ別扱い |
| E-2 | P1-2 の台詞の差し替え文言 | 推奨: 「奥にいるのが鍛冶士。装備のことは、そちらで。」 |
| E-3 | 支援 AI の範囲 | (a) 当たり判定と、支援の職業の攻撃力への修正だけ ／ (b) (a) に加えて弓師・魔法使いの遠隔攻撃（既存の弾の仕組みを流用）／ (c) (b) に加えて見た目を主人公のリグに寄せる（T-6 の再開） |
| E-4 | 時計塔の撃破後の保存の扱い | (a) 島の場面を見ていない時計塔のクリアを、酒場で短く補う（新しい純追加のフラグ 1 つ）／ (b) 崩壊〜島の間は保存しない ／ (c) 現状のまま（記録だけ） |
| E-5 | キーボードで会話を送る | (a) Space / Enter で送る ／ (b) 現状のまま |
| E-6 | 第一章の結果画面とゴールド（C-3・ボス報酬の固有名・戦闘不能の喪失） | (a) 現状のまま ／ (b) ボスの品を「記念の品」として結果に出す（成長要素なし）／ (c) 第一章ではゴールドを出さない |
| E-7 | 旧セーブの上位職 `job` の扱い | (a) 読み込み時に消さず、使わないだけにする（D-5 に合わせる）／ (b) 現状のまま（docs の D-5 に例外を書く） |

---

## 8. 調査の限界

- 実機（iPhone）とこの環境以外のブラウザでは確認していない。
- この環境は 3〜7fps なので、本編を最初から最後まで自動で通すことはしていない（区間ごとの state の注入に頼る）。
- P2-1 は、コードを読んで導いた推測。実際の再現は plan のタスク CH1-T2 の最初の手順で行う。
- P1-3 の「壁を抜ける」は、コードに当たり判定が無いことからの推測。実際に抜ける様子は見ていない。
