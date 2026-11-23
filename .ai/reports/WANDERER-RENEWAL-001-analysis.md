# WANDERER-RENEWAL-001 Analysis

## Task
WANDERER-RENEWAL-001 / 第一章 5 人目の主人公「影の旅人」(`CLASSES.wanderer` / `CHAPTER_CAST[5]`)を、バトルデザイン・戦闘モーション・外見/造形の 3 領域で全面的に刷新する(Human 承認 2026-11-22「WANDERER-RENEWAL-001 着手指示」)。

## Summary
- FACT: 影の旅人は戦闘の骨格をすべて剣士から借りている(`kit:'warrior'`、`recomputeStats` が `state.classDef.key='warrior'` にする)。自前なのは名前・色・基礎値・必殺技名・斬撃の色(DEC-005)だけ。
- FACT: 武器メッシュは剣士の大剣を作って `visible=false` にしているだけ(`06-player-enemy.js:2020` / `:2212`)。構え・振り・スキル・必殺技・処刑・抜刀は大剣の両手持ちの型のまま ―― **見えない大剣を両手で振っている**(撮影 `img/WANDERER-RENEWAL-001/before-*.jpg`)。
- FACT: Skill 1 は剣士の「切り下がり」、Skill 2 は剣士の「崩し斬り」(`defaultSkill2Def('warrior')`)。道では交代のたびに `learnedSkill2=false` になり、道に閃きの場面が無いので **本編の影の旅人は Skill 2 を一度も持たない**(docs/SCENARIOS.md「⑤ 道は未実装」)。
- FACT: 加入前の姿 `buildRoadTravelerFigure` と酒場の隅の人物(`buildTavern` の shadowGuide、同じ作りの複製)は、円柱の胴 + 球の頭 + 半球の髪 + 円の影だまりだけ。加入後のリグ(コート × レイヤード・平たい毛束の髪・マフラー)と形の連続性が無い。
- 結論: 戦闘の型・モーション・武器表示・加入前の姿の 4 つが「剣士の流用」または「仮の造形」。色(配色表)と加入後の衣服の構成(T-4 / T-5、Human V-1 確認済み)は土台として残せる。

## Existing System Search
| 探したもの | 検索語 / 範囲 | 結果 |
| --- | --- | --- |
| 影の旅人の定義 | `wanderer` / `src/` 全体 | `01-character-creation.js:106`(CLASSES)、`:297`(CHAPTER_CAST[5])、`player-palette.js:80`、`06-player-enemy.js:566,947,995,1175-1287,2020,2212`、`12-progression-ui.js:1832`、`road-party.js:17`、`road-rewards.js:44-47`、`ui-icons.js:112` |
| kit の解決 | `kitKeyFor` / `recomputeStats` | `01:131`、`12:1830-1840`(`Object.assign({}, CLASSES[kit], own, {key:kit, charKey})`) |
| モーションの表 | `CLIPS[` / `STANCE[` / `activeStance(` | `05:2324`(STANCE)、`05:2664`(CLIPS)、`05:3571,3628`(beginMove / applyCombatPose)、`05:3197`(ultClipName)、`11:1874`(executionClipName)。すべて `state.classDef.key` で引く |
| 構え・休め・収納 | `STANCE_RELAXED` / `WEAPON_SOCKET` / `GRIP_OFFSET` | `05:2471,2554,2378`。`weaponSocketFor` は表に無いキーで null(=収納しない、杖と同じ扱い) |
| コンボ | `COMBO_LENGTH` / `COMBO_CLIP_BY_STAGE` | `11:76-82`。剣士は 3 段(basic → basic2 → basic4 = 地裂斬の型) |
| 踏み込み | `attackLungeDistance` | `core/attack-lunge.js`(剣士 0.45、他 0) |
| Hit の時刻 | `impactFrac` / `JOB_SWING_IMPACT_FRAC` | `core/swing-timing.js`(戦騎士だけ遅延。他は入力と同時) |
| Skill 1 | `CHARGE_VARIANTS_BY_CLASS` / `defaultSkill1For` / `executeVariant` | `12:2231`、`core/chapter1-rules.js:84`(第一章は 'retreat'、魔法使いだけ 'phantom')、`13:259` |
| Skill 2 | `SKILL2_BY_CLASS` / `defaultSkill2Def` / `castSkill2` | `12:2378,2441`、`11:1014`。`mode` を持つ定義は `executeVariant` の汎用経路に乗る |
| 閃き | `grantChapter1Skill2` / `learnSkill2` / `hasSkill2` | `12:2418`、`core/chapter1-skills.js`。洋館・村・幽霊船・時計塔に場面あり。道は無し |
| 交代時の Skill 2 | `learnedSkill2 = false` | `14-hud-boot.js:1983`(switchProtagonist) |
| 時間差の判定保留 | `pendingSwing` / `pendingSkill2` / `pendingUlt` | `11:141,1227`、`13:520-526`。「一撃が届く瞬間まで保留する」型が既にある |
| 幻影(置き去りの分身) | `spawnPhantomDecoy` / `core/decoy.js` | `11:1431`(魔法使いの幻影歩法。敵の注意を引く囮。ダメージは持たない) |
| 遅れる影 | `PRE_JOIN_SHADOW_LAG` / `road-wall-shadow.js` | `14-dungeon-road.js:73`(0.45 秒)、`core/road-wall-shadow.js:20`(lag 0.45、DEC-030) |
| 正面耐性(守護型) | `guardianAbsorbs` | `07-ai-combat.js:5752`。攻撃者の位置は常に `state.pos` |
| 弧の判定 | `meleeHitTest` / `meleeHitCheck` | `core/melee-hit.js:49`(純関数)、`07:5354`(`state.pos` / `state.facing` 固定) |
| 加入前の姿 | `buildRoadTravelerFigure` | `14-dungeon-road.js:35`。呼び出し: 島の人影 `03:2231`、山道の出会い `14-dungeon-road2.js:872,896`、`:1526` |
| 酒場の隅の人物 | `shadowGuide` | `03:3291-3320`(buildRoadTravelerFigure と同じ形の複製 + 紫の PointLight) |
| 共通の造形部品 | `makeCharacterHead` / `makeCharacterHairShell` / `makeGarmentLoft` / `makeOpenGarmentLoft` / `makePlate` / `limbGeo` | `05:242-700`、`06:50-230`。純粋なジオメトリ生成(state を書かない) |
| リグの組み立て | `buildPlayer` | `06:546`。`playerMixerParts` を書くのでプレイヤー以外(加入前の姿)には使えない |
| 輪郭線の除外 | `userData.noOutline` | `05:2134` |
| 刀身の軌跡 | BLADE TRAIL | `13:943-`(武器の握りと切っ先から帯を引く。色は `atkColorHex`) |
| 勝利・戦闘終了の専用ポーズ | `victory` / `clearPose` | なし(確認済み: `src/legacy/parts/*.js`)。全員共通で、構え → 休めのクロスフェード(`applyRelaxedIdlePose`)だけ |
| 被弾・ダウン・回避・ジャンプの型 | `playerHitReactT` / `triggerPlayerDown` / `updateLocomotion` | 全キャラクター共通(剣士の型ではない)。`13:1240-` |
| 影の旅人専用のテスト | `wanderer` / `tests/` | `unit/wanderer-attack-color.test.js`、`unit/player-palette.test.js`、`character-palette.spec.js:70`、`road2-join.spec.js`、`road2-fights.spec.js` |

## Relevant Files
- `src/legacy/parts/01-character-creation.js` — CLASSES.wanderer(kit・色・基礎値・ult・atkColorHex)
- `src/legacy/parts/05-rendering-rig.js` — STANCE / CLIPS / 休め / ソケット / beginMove / applyCombatPose
- `src/legacy/parts/06-player-enemy.js` — buildPlayer(影の旅人の衣服・髪・武器非表示)、swapPlayerWeaponVisual
- `src/legacy/parts/11-combat-actions.js` — tryAttack(コンボ・踏み込み)、tryDodgeAttack、castSkill2
- `src/legacy/parts/12-progression-ui.js` — CHARGE_VARIANTS_BY_CLASS、SKILL2_BY_CLASS、defaultSkill2Def、grantChapter1Skill2、recomputeStats
- `src/legacy/parts/13-update-loop.js` — executeVariant、updatePlayer、updateGrip、抜刀時間
- `src/legacy/parts/07-ai-combat.js` — dealDamageToEnemy(正面耐性・ノックバックの基準位置)
- `src/legacy/parts/14-dungeon-road.js` — buildRoadTravelerFigure / trackPreJoinShadow
- `src/legacy/parts/03-dungeons-mansion-temple.js` — 酒場の隅の人物
- `src/legacy/parts/14-dungeon-road2.js` — 加入・エリア 4 の戦闘(F4-1〜F4-S・古き守り手)
- `src/render/player-palette.js` — 影の旅人の配色(衣服の紫 #654F86 と影 VFX の紫 #8A5AD6 は既に別の値)
- `docs/CHARACTERS.md` / `COMBAT.md` / `SCENARIOS.md` / `CHAPTER1_STORY.md` / `GAME_DESIGN.md`

## Current Behavior(FACT)
1. 通常攻撃: 剣士の 3 段(袈裟 → 逆袈裟 → 地裂斬の型)、間合い 3.6・半角 106°・cleave、CD 0.52、踏み込み 0.45。見た目は見えない大剣を両手で振る。紫の軌跡だけが空中に出る(before-attack2)。
2. 構え: 大剣の両手持ち(grip BOTH)。素手なので、胸の前で両手を合わせた姿勢に見える(before-lineup-back)。
3. 抜刀/納刀: 大剣の 0.26 / 0.31 秒。見えない大剣を背中のソケットへ出し入れしている。
4. Skill 1: 切り下がり(single + 後退 1.8)。Skill 2: 崩し斬り。本編では閃かないので Skill 2 ボタンは出ない。
5. 必殺技「影送り」: 名前と色だけ自前。型は剣士の渾身の斬撃(大剣を担いで振り下ろす)。
6. 加入前の姿: 円柱 + 球 + 半球(SphereGeometry の組み合わせ)。顔・髪・衣服の形が無い(before-prejoin-front)。酒場の隅の人物は同じ形の別実装。
7. 加入後の姿: 剣士の BUILD に、ショートコート・白いシャツ・マフラー・背中のフード・平たい毛束の髪・裾の長いワイドパンツ。配色表どおり(T-5)。剣士と並ぶとシルエットが近い(コートの形・背丈が同じ)。

## Expected Behavior
- Human Goal(本 Task): 独立したプレイアブルキャラクターとしての戦闘スタイル・モーション・外見。剣士の流用の解消。Skill 1 / Skill 2 を設計し、Skill 2 の閃きを整合させる。
- docs/CHARACTERS.md: 「最終的に素手の想定」「素手専用のモーションと本格的な影による攻撃は、戦闘スタイルの決定後の別 Work Item」。
- DEC-005: 斬撃・軌跡・着地の光は影の紫 0x8a5ad6。
- CHARACTER-VIS-001 P-D8: 衣服と影エフェクトの紫は別 Material・別色。全身黒にしない。
- DEC-004 N-4 / CHAPTER1_STORY.md §3: 加入前は名前を出さない(「？？？」)。正体は第一章で明かさない。
- DEC-030 / DEC-031: 加入前の影は 0.45 秒遅れる。AREA 4 の加入イベントに露骨な伏線回収を足さない。
- docs/COMBAT.md / chapter1-skills.js: 第一章は Skill 1 固定で出発し、同行者の行動を見て主人公自身が Skill 2 を閃き、自動で装備される(教わるのではない)。
- docs/PROGRESSION.md: 第一章はレベル・パッシブ・スフィア盤を使わない。

## Differences
| 領域 | いま | あるべき姿 |
| --- | --- | --- |
| 戦闘の型 | 剣士と同一(数値・段数・判定) | 影の旅人だけの間合い・テンポ・判定の形 |
| Skill 1 / 2 | 剣士の技 / 本編で Skill 2 無し | 影の旅人の技。道で閃く |
| モーション | 見えない大剣の両手持ち | 素手 + 影で戦う型(構え・3 段・スキル・回避攻撃・切り上げ・必殺技・処刑) |
| 武器表示 | 大剣を非表示 | 影でできた刃(VFX 扱い)。戦闘の間だけ手に現れる |
| 加入前の姿 | 球と円柱 | 加入後と同じ人物に見える造形(髪・マフラー・パンツの裾・フード) |

## Root Cause
- FACT: WORK 11 で「専用の戦闘システムは作らない。kit を借りる。どの職を借りるかは暫定」と決めた(`01:88-103`)。CHARACTER-VIS-001 T-4 では見た目だけ素手にした(武器 `visible=false`)。その後、戦闘スタイルを決める Work Item が起きていない。
- FACT: 加入前の姿は WORK 11 / CR-02 の演出用メッシュのまま、CHARACTER-VIS-001(プレイヤーのリグだけが対象)の外にあった。
- INFERENCE: モーション系の表(CLIPS / STANCE / コンボ / スキル)がすべて「基礎職キー」で引かれていて、`charKey` で分岐する入口が無いことが、剣士流用が残った構造上の理由。

## Reusable Systems
- `charKey`(recomputeStats が既に付ける)を「モーションの鍵」として読めば、上位職と同じく基礎職キー(warrior)に紐づく装備・配色・必殺技ゲージ・セーブはそのまま動く。
- CLIPS / STANCE / STANCE_RELAXED / GRIP_OFFSET の表にキーを 1 つ足すだけで、構え・休め・クロスフェード・Combat Idle・Hit の連動は既存のまま動く。
- `executeVariant` の汎用モード(single / line / movement:'retreat')で Skill 1 / Skill 2 の判定と移動を賄える。
- 時間差の一撃は `pendingSwing` / `pendingSkill2` と同じ「保留して時刻が来たら解決」の型。会話・遷移で落とす作法も同じ。
- 武器の握り・向き(`wep`)・軌跡・抜刀/納刀の状態機械(`core/weapon-state.js`)は、刃のメッシュを差し替えればそのまま使える。ソケットが無いキー(杖と同じ)は「収納しない」扱いになる。
- 閃きは `grantChapter1Skill2()`(習得 = 自動装備・トースト・ボタン表示)をそのまま呼ぶ。
- 加入前の姿は共通の造形部品(`makeCharacterHead` / `makeCharacterHairShell` / `makeGarmentLoft` / `makePlate`)で組める。
- 正面耐性は `guardianAbsorbs(en, yaw, pos, attackerPos)` が攻撃者の位置を引数で受けるので、位置を差し替えるだけで「影の側からの一撃」を表せる。

## Risks
- R-1: CLIPS / STANCE の引き方を変える箇所(約 20)が漏れると、影の旅人だけ構えと振りが食い違う。→ 引き方を 1 つの関数に集め、E2E でクリップ名を確認する。
- R-2: 他の 4 人の挙動を変える回帰。→ 新しい関数は `charKey` を持たない時に今までと同じキーを返す。既存の E2E(キャラクター・モーション・収納・コンボ)を回す。
- R-3: 時間差の一撃が会話・遷移・死亡の後に飛ぶ。→ 既存の保留と同じ条件(started / dialogueActive)で落とし、ワールド遷移で消す。
- R-4: 残像(分身)の描画負荷(iPhone)。→ 頂点を作らない(ジオメトリ共有のクローン + 1 枚の Material)。同時数に上限。
- R-5: 加入前の姿を作り直しても、遅れる影(影だまり `userData.pool`)の扱い(trackPreJoinShadow)を壊さない。
- R-6: 旧セーブ。→ 新しいセーブ項目は作らない。`learnedSkill2` は既存の項目。

## Constraints
- `basefile.html` 凍結。`src/legacy/parts/` は共有スコープ(ファイル名順に連結)。`src/core/` は純関数(AGENTS.md §13)。
- 他のプレイヤーキャラクターは変更しない。CHARACTER-VIS-002 とは分離。道のマップ・敵・BGM・SE 制作は対象外。
- 配色表の影の旅人の行(Human V-1 確認済み)と T-4 の衣服の構成(ショートコート × レイヤード)は変えない。足すのは、構成を変えない部品と影の VFX。
- 第一章の成長方針(レベル・パッシブ・スフィア盤を本編で使わない)を守る。Skill のルール(Skill 1 固定・閃きで自動装備・付け替えの可否)は変えない。
- 加入前に名前を出さない。正体・影の旅人と遅れる影の関係を言葉で説明しない(DEC-031)。

## Scope of Change
1. CLASSES.wanderer に戦闘の数値(間合い・扇・CD・cleave・体幹)を持たせる。kit は 'warrior' のまま(装備・配色・セーブの鍵)。
2. 「モーションの鍵」関数を 1 つ作り、CLIPS / STANCE / 休め / ソケット / 握り / コンボ / Skill の表引きをそれ経由にする。
3. 影の旅人の構え・休め・クリップ一式(3 段・Skill 1・Skill 2・回避攻撃・切り上げ・必殺技・溜め)。
4. 武器を「影の刃」へ(影の VFX の Material。抜刀で現れ、納刀で消える。輪郭線なし)。
5. 時間差の「影の追撃」(3 段目・Skill 1・Skill 2)と残像の表示。正面耐性は影の位置から判定。
6. Skill 1「影残し」・Skill 2「影渡り」の定義と、道(エリア 4)での閃きの場面。
7. 加入前の姿の作り直し(酒場の隅の人物も同じ関数へ)と、加入後の姿への小さな追加(シルエットの差・影の色の分離)。
8. docs(CHARACTERS / COMBAT / SCENARIOS / CHAPTER1_STORY / GAME_DESIGN)と Decision Record。
9. テスト: core の unit、影の旅人の E2E(戦闘・見た目・閃き)。

## Unknowns
- 戦闘スタイルの中身(どんな技か)は docs に無い。Human は本 Task で設計を Agent に委ねている(Goal §3「影の旅人に適した独自の戦闘スタイルを設計する」)→ AGENT DECISION(§17.2: docs の「影による攻撃」「素手」、DEC-030 の 0.45 秒、DEC-005 の紫から導く)。
- 閃きの場所と台詞 → AGENT DECISION(他の 4 人の閃きの作法: 戦闘の後・同行者の行動を見て・本人の一言で終える)。支援は野営地で選び直せるので、支援の台詞は支援ごとに 1 行ずつ用意する。
- ESCALATION 候補: なし。E-1(docs の挙動を変える)には当たらない ―― docs が「未確定」としている欄を埋めるだけで、確定事項(Skill のルール・顔ぶれ・加入の時期)は変えない。E-2: DEC-005(色)・P-D8(Material 分離)・DEC-030/031(遅れる影)とは整合する設計にできる。E-4(新しいゲームシステム)にも当たらない ―― 既存の判定保留・ダメージ・汎用スキルの上に、このキャラクターの個性として乗せる(上位職の Back Attack / Soft Lock / 予測射撃と同じ粒度)。

## Recommended Next Step
Planner: 上の Scope of Change を 1 つの承認単位(Task 全体)として計画し、Agent Approval で進める。撮影の比較は `.ai/reports/img/WANDERER-RENEWAL-001/` に置く。
