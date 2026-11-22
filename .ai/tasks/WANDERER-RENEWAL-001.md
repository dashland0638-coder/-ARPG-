# WANDERER-RENEWAL-001 — 影の旅人の全面刷新（バトルデザイン・戦闘モーション・外見/造形）

Status: REVIEWING

Analysis: .ai/reports/WANDERER-RENEWAL-001-analysis.md（branch `claude/wanderer-renewal-001-nhlxns` @ `d53532b6e9573ae683f835e8601698334d851e42`、blob `6f4d955a7aacaa6a7096d3993d13ca0209e5e431`）

**優先度: 最優先**（プレイヤーキャラクター全体の更新 CHARACTER-VIS-002 に先行する独立タスク）

## Approval
- [x] Approved
- Approval type: Agent Approval（AGENTS.md §6.1。着手そのものは Human 承認: 2026-11-22「WANDERER-RENEWAL-001 着手指示：影の旅人の全面刷新」）
- Escalation Check: None（E-1: docs の確定事項は変えない ―― 「未確定」の欄（専用の戦闘スタイル・Skill 1 / 2・素手のモーション）を埋めるだけ。E-2: DEC-004 N-4 / DEC-005 / DEC-030 / DEC-031 / CHARACTER-VIS-001 P-D8 と整合。E-3: 戦闘スタイルの設計は Goal §3 で Agent に委ねられている。E-4: 新しいゲームシステムではない（既存の判定保留・汎用スキル・ダメージの上に乗るキャラクター固有の性質。上位職の Back Attack / Soft Lock と同じ粒度）。E-5〜E-7 / E-9: 該当なし）
- Approved by / date / where: Planner (Agent) / 2026-11-22 / branch `claude/wanderer-renewal-001-nhlxns`
- Scope of approval: 本ファイルの Implementation Plan Step 1〜9 と Files To Change 全体（Task 全体で 1 承認単位）
- Persistence: 許可（branch: `claude/wanderer-renewal-001-nhlxns`、根拠: 本セッションの作業ブランチの割当（システム指示）と Human の着手指示 §9）

Implementation: 開始可

## Goal
第一章 5 人目の主人公「影の旅人」（`CLASSES.wanderer` / `CHAPTER_CAST[5]`）を、バトルデザイン・戦闘モーション・外見/造形の 3 領域で全面的に刷新し、剣士の kit を借りた暫定状態から、独立したプレイアブルキャラクターとして成立させる（Human 着手指示 2026-11-22 の全文が正）。

## Constraints
- 正体・過去を第一章で明かさない。加入前は名前を出さない（DEC-004 N-4）。加入前の影は 0.45 秒遅れる（DEC-030 / DEC-031）
- 斬撃の色は影の紫 0x8a5ad6（DEC-005 / HD-CR02-1 = a）。衣服の紫（#654F86）と影エフェクトの紫は別 Material・別色（CHARACTER-VIS-001 P-D8）
- 配色表の影の旅人の行と T-4 の衣服の構成（ショートコート × レイヤード、Human V-1 確認済み）は変えない
- 他のプレイヤーキャラクター・道のマップ・敵・BGM/SE は変えない。CHARACTER-VIS-002 とは分離
- 第一章の成長方針（レベル・パッシブ・スフィア盤を本編で使わない）と Skill のルール（Skill 1 固定・閃きで自動装備）を守る
- 既存セーブとの互換（新しいセーブ項目を作らない）

## Character Concept（AGENT DECISION）
**「影と半拍ずれて戦う旅人」** ―― 本人が斬り、足元の影が 0.45 秒遅れて同じ所をもう一度斬る。
- 本人は素手。戦っている間だけ、右手の影が細い刃になる（影の刃。影の VFX と同じ紫の、半透明の刃。収納先は無く、構えを解くと消える）
- 加入前の「本人より遅れてついていく影」（DEC-004 N-4、`PRE_JOIN_SHADOW_LAG = 0.45`）と同じ性質が、加入後は戦い方になる。言葉では説明しない（DEC-031）
- 立ち位置は「中間の間合い」: 剣士（広く重い薙ぎ）・盗賊（速さと背後）・魔法使い/弓師（遠隔）のどれでもなく、**一つの場所に二度当てる / 二つの場所から当てる**ことで戦場を支配する

## Battle Design（AGENT DECISION）
| 項目 | 影の旅人 | 比較（剣士 / 盗賊） |
| --- | --- | --- |
| 間合い / 扇（半角） | 3.2 / 60° / 貫通（cleave） | 3.6 / 106° / 貫通 ・ 2.8 / 39° / 単体 |
| 攻撃間隔 | 0.44 秒 | 0.52 ・ 0.38 |
| 体幹倍率 | 0.9 | 1.3 ・ 0.7 |
| コンボ | 3 段（払い → 返し → 踏み込みの逆袈裟 + 影の追撃） | 3 段 ・ 4 段 |
| 踏み込み | 0.30 m / 段 | 0.45 ・ 0 |
| 抜刀 / 納刀 | 0.12 / 0.30 秒（影が刃になる / ほどける） | 0.26 / 0.31 ・ 0.16 / 0.19 |

- **影の追撃**（性質の核）: 3 段目・Skill 1・Skill 2 は、0.45 秒後に影が同じ場所でもう一度当たる。待っている間は半透明の紫の残像が見えている（何がどこへ当たるかが読める）。追撃の正面耐性（守護型の正面 ±45°）とノックバックは **影の位置** から判定する
  - 3 段目の追撃: 同じ位置・同じ向き・同じ弧。威力 0.6 倍、体幹 1.0
- **Skill 1「影残し」**（第一章の固定 Skill 1 の枠 = 'retreat'）: 前へ一撃を入れて 2.8 m 後ろへ退き、元の場所に残像を残す。0.45 秒後、残像が周囲（半径 2.4）を薙ぐ（威力 0.8 倍、体幹 1.4）。追ってきた敵・突進してきた敵が自分のいた場所で斬られる ―― 退きながら場所を支配する技。溜めで威力 1.2 → 2.4
- **Skill 2「影渡り」**（道で閃く、クールダウン 9 秒）: 影を地面に走らせる（前方 6.5 m・幅 1.8 の線。通過で威力 1.0、体幹 1.2）。影は線の先（壁の手前で止まる）に立ち、0.45 秒後に **こちらへ向かって** 斬り返す（弧 3.4 / 半角 70°、威力 1.5、体幹 1.6）。敵を本人と影で挟む ―― 正面に盾を持つ守護型・強敵・ボスの背中へ当てられる
- **必殺技「影送り」**: 数値は既存のまま（半径 4.2・威力 3.2）。型だけ影の旅人のもの（低く沈み、両手で影を押し広げる）
- **回避**: 共通のロール（距離・無敵は既存）に、出だしの位置へ一瞬の残像（見た目だけ）。回避攻撃 = 低い突き。切り上げ = 左手で掬い上げる斬り上げ
- **距離ごとの戦い方**: 近い → 3 段で追撃まで入れて離れる / 中間 → Skill 2 で挟む / 迫られる → Skill 1 で退いて置いた影に斬らせる
- **支援と組んだ時**: 支援が敵の向きを引きつける（古き守り手の turnToAlly 等）間に、影の追撃・影渡りが背中へ当たる。支援の攻撃と影の追撃は干渉しない
- **ボス戦**: 追撃は巻き込みでなく「置き」なので、ボスの突進の通り道に置ける。影渡りで背面から体幹を削れる
- 第一章の成長方針: レベル・パッシブ・スフィア盤は使わない（追撃の倍率は固定値）

## Motion Design（AGENT DECISION）
- 構え: 低く半身、重心は後ろ足。右手は腰の高さで影の刃を前下へ向け、左手は胸の前で開く（盾でも拳でもない「影に触れる手」）。前傾わずか
- 休め: 両手を下ろし、片足に重心。肩は落とし、顔だけ少し上げる
- 3 段: ① 右の刃で外へ払う（腰の回転が先、刃が後）② 左の掌で影を押し出してから、右で斬り上げる ③ 深く踏み込み逆袈裟に振り下ろして止まる（ここで残像が残る）
- Skill 1: 刃を前へ一閃 → 後ろへ滑る（足は床から離れない）
- Skill 2: しゃがみ込み、左の掌を床へ当てて影を送る（その場に留まる。影だけが走る）
- 回避攻撃: 低い突き。切り上げ: 左手で掬い上げる。必殺技: 沈み込み → 両手を広げる。溜め（ホールド）: 刃を後ろへ引き、左手を前へ
- 被弾・ダウン・ジャンプ・回避のロール・歩き/走り: 全キャラクター共通の型（剣士の流用ではない）。歩き/走りは BUILD（剣士）と休め・構えの差で見え方が変わる
- 判定の時刻: 影の旅人は Hit 遅延なし（入力と同時）＝ 各クリップの最初の振り抜きのキーフレームを 0.18〜0.24 に置く（盗賊と同じ作法）。追撃は 0.45 秒後
- 武器（影の刃）は握りの位置・向き（wep）・軌跡を既存の武器の仕組みで動かす

## Appearance Design（AGENT DECISION）
- **加入前**（`buildRoadTravelerFigure`、酒場の隅の人物も同じ関数へ統一）: フードを被った長い旅の外套（黒に近い紫がかった灰）。フードの陰から、加入後と同じ頭部（共通の Loft 頭部・同じ肌色）と、同じ平たい毛束の前髪が少し覗く。首に同じマフラー（暗いシルバーブルー）。外套の下から、同じ裾の長いワイドパンツとブーツ。目は描かない（フードの陰）。足元の影だまり（紫がかった円）と 0.45 秒の遅れは今のまま。球の組み合わせは使わない
- **加入後**: T-4 / T-5 の構成と配色はそのまま。加入前に被っていたフードが「背中のフード」として下りている（連続性）。追加は ① マフラーの両端を背中へ長く垂らす（剣士と並んだ時の背中のシルエットの差。配色表の accent）② 影の刃（影 VFX の Material。衣服の Material と共有しない）③ 残像（同じ影 VFX の紫の、半透明の単色）
- 色の分離: 衣服の紫 = 配色表 trim #654F86（変更なし）。影の演出の紫 = `CLASSES.wanderer.atkColorHex` #8A5AD6（刃・軌跡・残像・追撃の弧・足元の輪）。どちらも独立した Material で、片方を変えてももう片方は変わらない

## Implementation Plan
1. **core**: `src/core/wanderer-style.js`（新規・純関数）―― 数値（間合い・コンボ・踏み込み・抜刀・追撃の遅れと倍率・Skill 1 / 2 の定義）、追撃の計画と判定（弧・円・線）、影渡りの到達点、クリップのキーフレーム（構えを引数で受ける）、モーションの鍵 `wandererRigKey(classKey, charKey)`
2. **CLASSES.wanderer**（01）: 戦闘の数値（meleeRange / meleeAngle / cleave / atkCooldown / staggerMul / range）。kit は 'warrior' のまま（装備・配色・セーブの鍵）
3. **モーションの鍵**（05）: `rigKeyOf(cdef)` を作り、CLIPS / STANCE / 休め / ソケット / 握り / 抜刀時間 / Combat Idle の表引きをそれ経由にする（他の 4 人は今までと同じキーが返る）
4. **影の旅人のモーション一式**（新しい part `17-wanderer-style.js`）: STANCE / STANCE_RELAXED / GRIP_OFFSET / CLIPS.wanderer を core のキーフレームから組む
5. **影の刃**（06 / 17）: buildPlayer / swapPlayerWeaponVisual で影の旅人だけ影の刃を作る（輪郭線なし）。抜刀の進み具合で現れ・消える
6. **戦闘の配線**（11 / 12 / 13 / 07）: コンボの段数とクリップ・踏み込み・3 段目の追撃・Skill 1 / Skill 2 の定義の引き当て・影渡りの発動・回避の残像・`dealDamageToEnemy` の `opts.fromPos`（無ければ今までどおり `state.pos`）
7. **閃き**（14-dungeon-road2）: エリア 4「遺構の門」(F4-2) を片づけた後に、支援の一言を見て閃く（`grantChapter1Skill2`）。取りこぼしは峠の手前（z ≥ 626）で同じ場面。既に持っていれば起こさない
8. **外見**（14-dungeon-road / 03 / 06）: 加入前の姿の作り直しと酒場の隅の統一、加入後のマフラーの垂れ
9. **docs / Decision Record / テスト**: CHARACTERS / COMBAT / SCENARIOS / CHAPTER1_STORY / GAME_DESIGN、`.ai/decisions/DEC-034-wanderer-shadow-style.md`、unit（core）・E2E（影の旅人の戦闘・見た目・閃き）

## Files To Change
- 新規: `src/core/wanderer-style.js`、`src/legacy/parts/17-wanderer-style.js`、`tests/unit/wanderer-style.test.js`、`tests/wanderer-renewal.spec.js`、`.ai/decisions/DEC-034-wanderer-shadow-style.md`、`.ai/reports/img/WANDERER-RENEWAL-001/*.jpg`
- 変更: `src/legacy/concat-plugin.js`（core の import 1 行）、`src/legacy/parts/01-character-creation.js`、`05-rendering-rig.js`、`06-player-enemy.js`、`07-ai-combat.js`、`11-combat-actions.js`、`12-progression-ui.js`、`13-update-loop.js`、`14-hud-boot.js`、`15-ui-proto.js`、`14-dungeon-road.js`、`14-dungeon-road2.js`、`03-dungeons-mansion-temple.js`、`docs/*.md`（上記）、`.ai/decisions/AGENT-DECISIONS.md`（索引）、`.ai/decisions/README.md`（索引があれば）

## Files Not To Change
`basefile.html`、`src/render/player-palette.js`（配色表）、他職の CLIPS / STANCE / 数値、`core/chapter1-skills.js`（Skill のルール）、`09-save-load.js`（セーブ形式）、道のマップ・敵・BGM/SE、`.ai/decisions/DEC-00x`（既存の決定）

## Test Plan
- `npm run build` / `npm run test:unit`（全件）
- E2E Targeted: 新規 `wanderer-renewal.spec.js`、影の旅人と共通基盤の回帰 `character-palette` / `character-clothing` / `character-motion` / `character-weapon-visual` / `weapon-stow` / `auto-combo` / `base-class-identity` / `road2-join` / `road2-fights` / `shadow-guide` / `chapter1-skill2` / `save-load` / `production-build`
- 撮影: 変更前後（並び・正面/側面/背面・構え/走り/3 段/Skill 1/Skill 2/回避・加入前）。844×390

## Acceptance Criteria
- 影の旅人の構え・3 段・Skill 1・Skill 2・回避攻撃・切り上げ・必殺技が、影の旅人のクリップで再生される（剣士のクリップ名を引かない）
- 3 段目・Skill 1・Skill 2 の追撃が 0.45 秒後に当たり、残像が見えている。会話・遷移で落ちる
- Skill 2 は道のエリア 4 で閃き、自動で装備される（テストモードは最初から使える）
- 影の刃・残像・追撃の弧は影の紫（#8A5AD6）の独立した Material。衣服の Material（配色表どおり、#8A5AD6 を含まない）と共有しない
- 加入前の姿に球の頭・半球の髪が無く、加入後と同じ頭部・髪・マフラー・パンツの裾を持つ。名前は出ない。影だまりは 0.45 秒遅れる
- 他の 4 人の構え・クリップ・数値が変わらない（既存の E2E / unit）
- 旧セーブが読める（新しいセーブ項目なし）

## Risks
Analyzer report §Risks（R-1〜R-6）のとおり。加えて R-7: 追撃の巻き込みで雑魚戦の火力が上がりすぎる → 3 段目の追撃 0.6 倍・同時 3 つまで。

## Rollback
このブランチの commit を revert する（セーブ形式の変更なし）。

## Out of Scope
他のプレイヤーキャラクター（CHARACTER-VIS-002）、道のマップ・敵・BGM・SE、必殺技の数値、正体に関わる設定・台詞

## Agent Decisions
| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |
| WR-1 | コンセプト「影と半拍ずれて戦う」。遅れは 0.45 秒（加入前の影と同じ値） | docs/CHARACTERS.md（素手・影による攻撃）、DEC-004 N-4 / DEC-030（0.45 秒）、DEC-031（説明しない） | 影の分身が自動で戦う（演出過多・操作の主体が曖昧）／ 剣士の数値調整（Goal に反する） |
| WR-2 | 素手 + 戦闘中だけの「影の刃」。既存の武器の仕組み（握り・向き・軌跡・抜刀）で動かし、収納先は持たない | docs/CHARACTERS.md「最終的に素手」、DEC-005（影の紫）、杖の「収納しない」作法 | 完全な素手（斬撃が見えず、攻撃の視認性が落ちる） |
| WR-3 | kit は 'warrior' のまま。モーション・コンボ・Skill だけ `charKey` を鍵にする | WORK 11 の kit 設計（装備・配色・セーブの鍵）、上位職の作法 | 独立した基礎職キー（WEAPON_TYPES・装備・配色・セーブまで波及。不要な再設計） |
| WR-4 | Skill 1「影残し」は第一章の固定枠 'retreat' のキーで定義 | UI-002 HD-1（各職の 'retreat'）、chapter1-rules.js defaultSkill1For | 新しいキー（C-1 の固定の仕組みに分岐が要る） |
| WR-5 | Skill 2「影渡り」。閃きはエリア 4「遺構の門」の後（守護型 2 体 = 正面が硬い敵を、支援が横から崩すのを見て）。取りこぼしは峠の手前 | 他の 4 人の閃きの作法（戦闘の後・同行者を見て・本人の一言・取りこぼしの場所）、docs/COMBAT.md | エリア 5（最終戦の直前で試す場が無い） |
| WR-6 | 追撃の正面耐性・ノックバックは影の位置から判定（`opts.fromPos`。省略時は従来どおり） | `guardianAbsorbs` が攻撃者位置を引数で受ける設計 | 常にプレイヤー位置（影渡りの「挟む」が成立しない） |
| WR-7 | 加入前の姿は共通の造形部品で作り直し、酒場の隅の人物も同じ関数にする。フードを被った姿 → 加入後は背中のフード | Goal §5（加入前後の連続性・球の組み合わせを避ける）、docs/CHARACTERS.md（黒ずくめ・影だまり） | 加入後のリグをそのまま使う（buildPlayer は playerMixerParts を書くので不可） |
| WR-8 | 必殺技の数値・ゲージは変えない（型だけ） | Goal の範囲（Skill 1 / 2 が対象）、R-7 | 必殺技にも追撃（火力の再調整が要る） |

## Escalation
None

## Autonomy Metrics
（完了処理で記入。`../AGENTS.md` §22。推測で埋めない）
- Human Escalation Count:
- Human Decision Count:
- Auto Fix Count:
- Reviewer Round Count:
- Test Retry Count:
- PR Created:

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-11-22 | Task | — → DRAFT | Agent | WI「第一章・移動中会話システムの横展開」の §8 残件として登録（Human の指示） |
| 2026-11-22 | Task | DRAFT → ANALYZING | Orchestrator | Human 着手指示（2026-11-22）。Analyzer report を persist（`d53532b6e9573ae683f835e8601698334d851e42`） |
| 2026-11-22 | Task | ANALYZING → APPROVED | Planner (Agent) | Artifact Handoff（analysis）H-1〜H-8 確認。Escalation Check: None → Agent Approval |
| 2026-11-22 | Task | APPROVED → IMPLEMENTING → TESTING | Implementer | Plan Handoff（plan）H-1〜H-8 確認。Debugger サイクル 0 |
| 2026-11-22 | Task | TESTING → REVIEWING | Implementer | build / unit PASS、E2E Targeted 97 中 96 PASS + 1 FLAKY（auto-combo、再実行で PASS）。Review Handoff を Reviewer へ |

## Implementation Result

### Artifact Handoff
| Kind | Path | Source（branch @ SHA） | Blob SHA | 確認（I-1 / H-1〜H-8） |
| --- | --- | --- | --- | --- |
| analysis | `.ai/reports/WANDERER-RENEWAL-001-analysis.md` | `claude/wanderer-renewal-001-nhlxns` @ `d53532b6e9573ae683f835e8601698334d851e42` | `6f4d955a7aacaa6a7096d3993d13ca0209e5e431` | H-1〜H-8 OK（単独 commit・見出し一致・blob 一致） |
| plan | `.ai/tasks/WANDERER-RENEWAL-001.md` | `claude/wanderer-renewal-001-nhlxns` @ `eebf0244c26d80fdf44d7daa86f4989addb414f2` | `452810a63236b23a7999edd03d47f380baf3708f` | H-1〜H-8 OK |

### Changed Files
| ファイル | 変更 |
| --- | --- |
| `src/core/wanderer-style.js`（新規） | 数値（間合い・コンボ・踏み込み・抜刀・追撃の遅れと倍率）、Skill 1「影残し」/ Skill 2「影渡り」の定義、追撃の予定・判定（弧・円・線）・影渡りの到達点、構え・休め・キーフレーム一式、`wandererRigKey` |
| `src/legacy/parts/17-wanderer-style.js`（新規） | STANCE / 休め / 握り / CLIPS / MOVE_SFX / 回避・滞空・低HP の型の wanderer 行、影の刃（生成・抜刀で伸び/ほどけ）、残像、影の追撃の待ち行列と解決、影渡りの発動 |
| `src/legacy/concat-plugin.js` | core の import 1 件 |
| `01-character-creation.js` | CLASSES.wanderer に戦闘の数値（WANDERER_COMBAT）。コメント更新。kit は 'warrior' のまま |
| `05-rendering-rig.js` | `rigKeyOf()` を追加し、CLIPS / 構え / 休め / 収納 / 効果音の表引きをそれ経由に |
| `06-player-enemy.js` | 構え・握り・収納の鍵を rigKey に。影の旅人の武器の枠を影の刃へ（大剣の非表示をやめる）。マフラーの両端を背中へ |
| `07-ai-combat.js` | `dealDamageToEnemy` の `opts.fromPos`（正面耐性・ノックバック・火花の向き。省略時は従来どおり state.pos） |
| `10-input.js` | 回避の出だしの残像（影の旅人だけ） |
| `11-combat-actions.js` | コンボの段数・クリップ・踏み込みを rigKey で。3 段目の追撃。Skill 2 の影渡り分岐。処刑のクリップ名 |
| `12-progression-ui.js` | Skill 1 の候補表・Skill 2 の既定を rigKey で（影残し / 影渡り） |
| `13-update-loop.js` | 抜刀時間・構え・回避/滞空/低HP の表を rigKey で。executeVariant の追撃予約。毎フレームの追撃更新。影の刃の更新 |
| `14-hud-boot.js` / `15-ui-proto.js` / `02-world-common.js` | Skill 2 の表引き・収納表示を rigKey で。ワールド移動・地点移動で追撃を落とす |
| `14-dungeon-road.js` | `buildRoadTravelerFigure` を共通の造形部品で作り直し（フードの外套・Loft の頭部・同じ髪・マフラー・ワイドパンツ。球を使わない） |
| `03-dungeons-mansion-temple.js` | 酒場の隅の人物を `buildRoadTravelerFigure(true)` に統一 |
| `14-dungeon-road2.js` | 影の旅人の閃き（F4-2 の後 / z ≥ 626、支援ごとの一言、`grantChapter1Skill2`） |
| `src/core/weapon-state.js` | 抜刀時間の表に wanderer 行（WANDERER_DRAW_TIME） |
| `tests/unit/wanderer-style.test.js`（新規）・`tests/wanderer-renewal.spec.js`（新規） | core・差し込み・E2E（戦闘・色・閃き） |
| `tests/unit/wanderer-attack-color.test.js` / `road-stranger.test.js` / `mansion-insight.test.js` | 新しい仕様（自前の数値・新しい加入前の姿・rigKeyOf の stub）に合わせて更新 |
| `docs/CHARACTERS.md` / `COMBAT.md` / `SCENARIOS.md` / `CHAPTER1_STORY.md` / `GAME_DESIGN.md` | 戦い方・武器・加入前後の見た目・閃きを実装事実として記載。「未確定」から専用の戦闘スタイルを外す |
| `.ai/decisions/AGENT-DECISIONS.md` | AD-005（計画の DEC-034 から変更: `DEC-` は Human Decision の記録のため） |
| `.ai/reports/img/WANDERER-RENEWAL-001/*.jpg` | 変更前後の撮影 |

### Test Report
- Scope: Targeted
- Executed: `npm run build`、`npm run test:unit`（全件 2329）、`npx playwright test` で wanderer-renewal / character-palette / character-clothing / character-motion / character-weapon-visual / weapon-stow / auto-combo / base-class-identity / road2-join / road2-fights / shadow-guide / chapter1-skill2 / save-load / production-build / clocktower-rogue-skill2 / ghostship-archer-skill2 / chapter1-tower-to-road（97 件）。最終変更後に wanderer-renewal / shadow-guide を再実行
- Why this scope: 影の旅人の経路と、変更した共通基盤（構え・クリップ・武器・収納・コンボ・閃き・加入・セーブ・公開ビルド）を通る spec
- Not run: 残りの E2E（ダンジョン個別のシナリオ等。今回触れていない経路。全件は 2 CPU の SwiftShader で数時間かかるため）
- Environment: プロジェクトの Playwright 1.62.1 が要求するブラウザ（chromium-1234）が無く、事前導入の chromium-1243 を `/opt/pw-browsers/*-1234` へシンボリックリンク（リポジトリ外）

| テスト | 結果 | メモ |
| --- | --- | --- |
| build | PASS | |
| unit（2329） | PASS | |
| wanderer-renewal.spec（2） | PASS | 3 段・影残し・影渡り・追撃・盾を抜ける・刃の色・衣服の色・他職の型・閃き |
| 上記 E2E 計 97 | 96 PASS / 1 FLAKY | auto-combo「押しっぱなしで連撃」: 初回 0 回（サーバ起動直後の 1 本目、剣士）→ 再実行で 4/4 PASS。影の旅人の経路を通らない（INFERENCE: 起動直後の負荷）。変更前コードでの比較はしていない |

### Acceptance Criteria
| AC | 確認方法 | 根拠 |
| --- | --- | --- |
| 影の旅人のクリップで再生 | VERIFIED | wanderer-renewal.spec（clip 名 basic/basic2/basic3/retreat/shadowPass、CLIPS.wanderer）、unit（CLIPS を classDef.key で直接引かない） |
| 追撃が 0.45 秒後・残像・会話等で落ちる | VERIFIED / FACT (code) | spec（HP が後から減る）、unit（stepEchoes）、`updateWandererEchoes` の打ち切り条件 |
| Skill 2 が道で閃き自動装備 | VERIFIED | spec「閃き」 |
| 影の紫の独立 Material / 衣服に #8A5AD6 なし | VERIFIED | spec（blade / clothColors）、character-palette.spec |
| 加入前の姿に球なし・同じ部品・名前なし・遅れる影 | VERIFIED | unit（road-stranger / wanderer-style）、shadow-guide.spec、road2-join.spec、撮影 after-4 |
| 他の 4 人が変わらない | VERIFIED | spec（rogue 4 段・warrior 3 段・刃なし）、character-motion / weapon-stow / base-class-identity |
| 旧セーブ | VERIFIED | save-load.spec。新しいセーブ項目なし |

### Out of Scope Found
- 剣士・盗賊などの回避や被弾の共通の型は全キャラクター共通の仕組みのまま（今回は影の旅人の行だけ足した）
- 影の追撃の効果音は既存のキュー（slashLight）の流用。専用の SE は MUSIC-AUDIO-003 の範囲
