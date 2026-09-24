# MAGE-002 Analysis

Mage Skill 1 Phantom Decoy E2E Verification ―― Analyzer only / READ ONLY（このファイル以外は変更していない。テストは実行していない）

- Protocol: [`../AGENTS.md`](../AGENTS.md)
- 前提として参照（ただし現在のコードで再確認した）: [`MAGE-001-reanalysis.md`](MAGE-001-reanalysis.md)、[`../tasks/MAGE-001.md`](../tasks/MAGE-001.md)

## Request

既存の幻影歩法（魔法使い Skill 1 `phantom`）が、実際のゲームプレイで **宵待ちの村の敵を幻影のほうへ誘導できること** を、
小さく信頼できる E2E で示せるかを判断し、必要最小限の検証方法を特定する。

## Scope

| 検証する | 検証しない |
| --- | --- |
| 既存の敵1種（宵待ちの村の敵）が、幻影歩法の発動後に **幻影を基準に行動する** こと | 誘導の範囲拡大（他の敵・ボス） |
| その際、プレイヤー本人には攻撃が当たらないこと（命中判定が本人基準のままであることの帰結） | 幻影・敵 AI・命中判定・敵対 / leash の変更 |
| 既存のテストモード・Arena・E2E ヘルパーで実現できるか | 数値調整・同時数・docs |

## Search Record

| 対象 | 検索語 | 範囲 | 結果 |
| --- | --- | --- | --- |
| 宵待ちの村の E2E | `duskvillage` | `tests/*.spec.js` | `duskvillage.spec.js`（4件: 入口・住宅・船小屋・ボス地点。いずれも会話・場所名で検証）、`chapter1-dusk-basics.spec.js`、`scenario-test-mode.spec.js` |
| 魔法使い・Skill 1 の E2E | `mage` / `KeyL` / `btn-charge` | `tests/*.spec.js` | Skill 1 の入力は `KeyL`（`job-traits.spec.js:153`）。魔法使いの 👣 アイコン検査（`chapter1-progression.spec.js:197` / `scenario-test-mode.spec.js:51`）。**敵の誘導を検査する E2E は無い** |
| decoy / phantom のテスト | `decoy\|phantom\|幻影` | `tests/` | unit `tests/unit/decoy.test.js` のみ（選択ロジック・寿命）。E2E 無し |
| E2E から state を読む口 | `window\.__\|window\.\w*Debug\|__test` | `src/` | **該当なし**。ゲームの `state` / `enemies` は window に公開されていない |
| tests が使う window 変数 | `page.evaluate` 内の `window.*` | `tests/*.spec.js` | `__dmg` / `__dmgPops`（ダメージポップアップの DOM 監視）、`__testAudioCtx` のみ。いずれもテスト側で作るもの |
| 敵の生成（テスト用） | `ARENA_ROSTER` / `arenaSpawn` | `07-ai-combat.js:696-800` | Arena の登録に **宵待ちの村の敵がある**: `duskMirror`（Mirror Shade）/ `duskFoam` / `duskCopy` / `duskFisher` / `duskWarden`（`:755-`）。`arenaSpawn` は `state.testMode && currentWorldKey==='training'` の時だけ、プレイヤー正面 5.5 に置く（`:778-797`） |
| Arena の E2E 利用例 | `spawnFromArena` / `arena-enemy-info` | `tests/job-traits.spec.js`、`tests/combat-test-arena.spec.js` | `spawnFromArena(page, label)`（`job-traits.spec.js:31`、`#msg-log` の「〜 spawned」を待つ）、`#arena-info-toggle-btn` で Debug Info を ON にして `#arena-enemy-info` の innerText を読む（`:56-60`, `:133`, `:189`） |
| Debug Info の内容 | `function updateArenaEnemyInfo` | `14-training-ground.js:136-250` | プレイヤーに最も近い敵1体の HP / Tier / Stagger / **AI State** / Turn Rate / **Facing** / Hit Radius 等。mirror の AI State は `mirrorState` の大文字（CHASE / WINDUP / STRIKE）（`:175-176`）。**座標・距離・幻影は出ない** |
| Debug Info の表示条件 | `function updateArenaPanel` | `14-training-ground.js:252-` | `state.testMode` なら表示（ワールドを問わない）。Spawn はトレーニング空間のみ |
| プレイヤー HP の観測 | `hp-fill` / `barWidth` | `index.html`、`tests/auto-combo.spec.js` | `#hp-fill` が存在。`barWidth(page, '#mp-fill')` の前例（`auto-combo.spec.js`）。ダメージポップアップ監視 `countDamagePopups`（`:30-`） |
| 幻影歩法の実装 | `phantom` / `spawnPhantomDecoy` / `aggroPoint` | `src/` | `13-update-loop.js:369-374`、`11-combat-actions.js:1432-1476`、`07-ai-combat.js:2407-2410`（MAGE-001 再分析と一致） |
| Mirror Shade の AI | `function updateMirrorShadeAI` | `07-ai-combat.js:2470-2600` | 下の FACT |
| 時間の進み方 | `getDelta` / `Math.min(0.05` | `14-hud-boot.js:1089` | `dt = Math.min(0.05, clock.getDelta())` |
| スキル入力 | `KeyL` / `skillInputDown` | `09-save-load.js:332,355`、`13-update-loop.js:199-250` | `KeyL` 押下で `skillInputDown`、離して `skillInputUp` → `releaseSkill` |

## FACT

**E2E の基盤**

1. ゲームの `state`・`enemies`・`state.decoys` は window に公開されておらず、E2E から直接読む口は無い（Search Record）
2. テストモードではトレーニング空間の Arena から宵待ちの村の敵を出せる。`Mirror Shade`（`buildDuskMirrorShade`、HP 900 に増量、`07-ai-combat.js:755`）はプレイヤー正面 5.5 の位置に出る（`arenaSpawn`、`:778-797`）
3. `arenaSpawn` / `arenaClear` はトレーニング空間でしか動かない（`currentWorldKey!=='training'` で return）。宵待ちの村のワールド内では使えない
4. `#arena-enemy-info`（Debug Info）は、プレイヤーに最も近い敵1体の **AI State** と **Facing（rad）** を文字で出す。座標・距離・幻影の有無は出さない（`14-training-ground.js:136-250`）
5. 既存 E2E は `#arena-enemy-info` の innerText をポーリングして AI 状態を判定している（`job-traits.spec.js:133`, `:189`）
6. プレイヤー HP は `#hp-fill` の幅で観測できる。ダメージポップアップの監視ヘルパーの前例がある（`auto-combo.spec.js:30-`）
7. Skill 1 の入力は `KeyL`（`09-save-load.js:332,355`）。テストモードの魔法使いの既定 Skill 1 は `phantom`（T-1、`scenario-test-mode.spec.js:51` で検査済み）

**幻影歩法**

8. 発動すると発動前の位置に幻影を置き（`spawnPhantomDecoy(state.pos.x, state.pos.z)`、`13-update-loop.js:373`）、プレイヤーは `state.skillAnim`（retreat）で向いている方向の **逆へ 3.6** 下がる（`fwd = (sin facing, cos facing)`、`sign = -1`、`13-update-loop.js:264, 576-579`）
9. 幻影の寿命は 5.0 秒（ゲーム内時間）、引きつけ半径は `11.0 × pull`、Mirror Shade の pull は 1.0（`core/decoy.js`）

**Mirror Shade の AI（`07-ai-combat.js:2470-2600`）**

10. 向かう先は `aim = aggroPoint(en)`、索敵と命中は `distToPlayer = state.pos.distanceTo(...)`（`:2483-2488`）
11. 敵対の成立は `distToPlayer < 9` かつ視線（`:2491-2492`）。一度 `triggered` になると leash が解くまで続く
12. `chase` 中、`aim` までの距離が 1.9 より大きければ `aim` へ `speed × 0.8`（= 2.2 × 0.8 = 1.76/秒）で進む。1.9 以下で攻撃 CD が 0 なら `windup` に入る（`:2546-2560`）
13. `windup` → `strike`（0.22 秒）で、命中は **`distToPlayer < 2.4` のときだけ**（`:2582-2593`）。当たるとプレイヤー HP が減りダメージポップアップが出る
14. 命中時でも `state.invulnerable` / `paralyzeInvulnT` / 護りの魔球（`tryConsumeOrbShield`）があればダメージは入らない（`:2585-2587`）

**時間**

15. ゲーム内の `dt` は 1 フレーム最大 0.05 秒に切り詰められる（`14-hud-boot.js:1089`）。SwiftShader 環境（3〜7 fps、T-1 で確認）では壁時計 1 秒あたりゲーム内 0.15〜0.35 秒しか進まない

## INFERENCE

- **I-1**（FACT 2, 8, 10〜13）Arena で Mirror Shade を出した直後に幻影歩法を使うと、幻影はプレイヤーと敵の間（敵から約 5.5）、プレイヤーは敵から約 9.1 に位置する。敵は幻影まで約 3.6 進んだ所（ゲーム内約 2.0 秒）で `WINDUP` に入り、その時プレイヤーは敵から約 5.5 以上離れている
- **I-2**（FACT 12, 13）`aim` がプレイヤーだった場合、`WINDUP` に入るのはプレイヤーから 1.9 以内に近づいた時だけで、続く `STRIKE` は必ずプレイヤーに当たる（無敵等が無い限り）。したがって **「敵が WINDUP → STRIKE を終えたのに、プレイヤーの HP が減っていない」ことは、敵がプレイヤー以外（＝幻影）を基準に攻撃したことを意味する**。これは「幻影へ誘導された」ことの行動上の証拠になり、時間の長さに依存しない
- **I-3**（FACT 8）プレイヤー・幻影・敵がほぼ一直線に並ぶため、敵の **移動方向や Facing では** 幻影とプレイヤーを区別できない。向きによる検証は、プレイヤーを横へずらす追加操作が必要になり不安定
- **I-4**（FACT 1, 4）「幻影が発動前の位置に存在する」「敵と幻影の距離」は現在の E2E からは直接観測できない。これらは CODE VERIFIED に留まる
- **I-5**（FACT 3）宵待ちの村のワールド内で配置済みの敵を使う方法は、敵が複数（泡沫の増殖、水鏡の分裂等）で位置も固定、Arena も使えないため、トレーニング空間＋Arena より不確定要素が多い

## UNKNOWN

- **U-1** 実際に E2E を書いて実行した場合に、Arena の Mirror Shade が即座に敵対（視線成立）するか。前例（`job-traits.spec.js` の Charge / Windup Enemy がトレーニング空間で攻撃してくる）はあるが、Mirror Shade での実行記録は無い
- **U-2** スキル発動時にプレイヤーの向きが敵から外れる要因（ソフトロック・自動向き直り）の有無。`executeVariant` は発動時点の `state.facing` を使う（FACT 8）が、発動前に向きが変わるかは未確認。向きがずれても I-2 の判定は成り立つが、幻影が引きつけ半径外になる配置は起こりうる
- **U-3** 低 fps 環境で `WINDUP`（ゲーム内 0.5〜1 秒程度）をポーリングで取りこぼさないか。ゲーム内時間が遅いので壁時計では長く見える見込みだが未実行
- **U-4** Debug Info の「最も近い敵」がトレーニング空間の既存のカカシ（約 14 離れている）に切り替わる可能性。Mirror Shade が近い間は起きない見込み
- **U-5** この実行環境で E2E を動かすにはブラウザのリビジョン不一致の回避が必要（T-1 の Environment Note）。リポジトリの問題ではない

## Existing System First

| 既存 | 使い方 | 根拠 |
| --- | --- | --- |
| テストモード（`startTestMode` / `enterTestMode`） | 魔法使いでトレーニング空間に入る。既定 Skill 1 = phantom | FACT 7 |
| Combat Test Arena の `Mirror Shade` | 宵待ちの村の敵を1体だけ、決まった位置（正面 5.5）に出す | FACT 2 |
| `spawnFromArena` の手順（`job-traits.spec.js:31`） | `#arena-toggle-btn` → `#arena-roster` の「Mirror Shade」ボタン → `#msg-log` の「Mirror Shade spawned」を待つ → パネルを畳む | FACT 5 |
| `#arena-info-toggle-btn` / `#arena-enemy-info` | AI State（CHASE / WINDUP / STRIKE）をポーリング | FACT 4, 5 |
| `#hp-fill` / ダメージポップアップ監視 | プレイヤーに当たっていないことの確認 | FACT 6 |
| `KeyL` | Skill 1（幻影歩法）の発動 | FACT 7 |

新しい debug フック・window 公開・テスト専用 API は **不要**（下の Scope Decision）。

## E2E Feasibility

| 観測したいもの | 現在の E2E で観測できるか | 方法 / 代替 |
| --- | --- | --- |
| プレイヤー位置 | ✕ | 不要（I-2 の論理で代替） |
| 敵の位置 | ✕ | 不要（AI State で代替） |
| 幻影の存在 | ✕ | 行動（I-2）から間接的に示す。直接は CODE VERIFIED |
| 幻影の位置 | ✕ | 同上 |
| 敵の移動方向 | △（Facing のみ） | 一直線に並ぶため区別に使えない（I-3） |
| 敵と幻影の距離 | ✕ | 同上 |
| 敵の攻撃状態 | ○ | `#arena-enemy-info` の `AI State: WINDUP / STRIKE` |
| プレイヤーの被弾 | ○ | `#hp-fill` の幅・ダメージポップアップ |

**結論**: 「幻影に誘導されて、幻影を攻撃し、本人には当たらない」は、既存の観測手段だけで **行動として** 示せる見込み（I-2）。
「幻影がどこにあるか」「敵がどこへ動いたか」の座標レベルの主張は、現状では示せない。

## Candidate Test Design

最小構成（1テスト・敵1体・既存ヘルパーのみ）。

1. テストモードで魔法使い（基礎職）を選び、トレーニング空間で開始する（シナリオ未選択）
2. Arena を開き、`Mirror Shade` を1体 Spawn（正面 5.5）。`#msg-log` の「Mirror Shade spawned」を待つ
3. Debug Info を ON にし、`#arena-enemy-info` に `AI State: CHASE` が出るのを待つ（敵対の成立）。Arena パネルは畳む
4. HP が満タン（`#hp-fill` 100%）であることを記録し、ダメージポップアップ数を記録する
5. 直ちに `KeyL` を押して離す（幻影歩法）。以後プレイヤーは操作しない
6. `#arena-enemy-info` をポーリングし、`AI State: WINDUP` または `STRIKE` を観測する（タイムアウトは壁時計で長め、例: 60 秒 ―― FACT 15）
7. 続けて `AI State: CHASE` に戻るまで待つ（STRIKE が終わった＝命中判定が済んだ）
8. 判定: **この時点でプレイヤー HP が減っておらず、ダメージポップアップが増えていない**
9. `console.error` が無い

対照（任意・推奨）: 手順5で幻影歩法の代わりに何もしない（または通常回避で下がる）と、最初の STRIKE でプレイヤー HP が減ることを同じ手順で確認する。
これで「HP が減らなかったのは敵が届かなかっただけ」ではないことを補強できる（Flakiness Risks R-5）。

## Flakiness Risks

| # | リスク | 影響 | 見込みと対策（設計上） |
| --- | --- | --- | --- |
| R-1 | 低 fps（ゲーム時間が壁時計より遅い） | 固定待ち時間で判定すると失敗 | 固定 `waitForTimeout` で判定せず、AI State のポーリング＋長めのタイムアウトにする（FACT 15） |
| R-2 | 敵の移動速度・距離 | 幻影に届く前に寿命（ゲーム内 5 秒）が切れる | 必要時間はゲーム内約 2.0 秒（I-1）。寿命はゲーム内時間なので fps に依存しない |
| R-3 | WINDUP / STRIKE の取りこぼし | ポーリング間隔より短い状態を見逃す | WINDUP と STRIKE のどちらかを見ればよい。低 fps ではむしろ長く見える（U-3） |
| R-4 | 発動前に敵が近づきすぎる | 幻影歩法の前に敵がプレイヤーを攻撃 | Spawn 直後（5.5 離れ、到達にゲーム内約 2 秒）に発動する。手順3の待ちを短くする |
| R-5 | 偶然の合格（本人に届かなかっただけ） | 誘導が無くても HP が減らない可能性 | I-2 により、WINDUP はプレイヤー基準なら 1.9 以内でしか起きず STRIKE は当たる。対照テストで補強 |
| R-6 | 無敵・護りの魔球でダメージが消える | 誘導が無くても HP が減らない | 回避・Skill 2 を使わない。幻影歩法（retreat 移動）自体は無敵を付けない（MAGE-001 再分析 F-11） |
| R-7 | Debug Info の対象がカカシに切り替わる | 別の敵の状態を読む | Mirror Shade が近い間は起きない見込み（U-4）。`AI State` の値（CHASE / WINDUP / STRIKE）はカカシでは出ない |
| R-8 | 向きのずれで幻影が引きつけ半径外 | 誘導が起きない | 半径 11 に対し距離約 5.5 で余裕がある（U-2） |
| R-9 | 攻撃 CD・分裂 | 分裂（HP 閾値）で状態が変わる | ダメージを与えないので分裂しない。初回は攻撃 CD 0 |
| R-10 | 実行環境（ブラウザのリビジョン） | 起動前に全失敗 | リポジトリ外で回避（`AGENTS.md` §14）。U-5 |
| R-11 | 既存の flaky（T-1 の `job-traits.spec.js:162`） | 同じ Arena・タイミング依存の型 | 本設計は時間ではなく状態遷移＋HP で判定するため、同型の揺れには比較的強い見込み |

## Scope Decision

**A. 既存の基盤だけで E2E を追加できる**（ただし、証明できるのは「行動」まで）。

理由:
- 宵待ちの村の敵（Mirror Shade）を、1体・決まった位置に出す既存手段（Arena）がある（FACT 2）
- 攻撃の開始（AI State）とプレイヤーの被弾（HP・ポップアップ）を、既存 E2E と同じ方法で観測できる（FACT 4〜6）
- 命中判定がプレイヤー基準であること（FACT 13）から、「攻撃したのに本人に当たらない」＝「幻影を基準に攻撃した」と結論できる（I-2）

B を選ばない理由: 幻影の座標・敵の座標を直接示すには観測口の追加が要るが、要求（誘導が実際に起きること）の証明には不要。
追加すると `src/` の変更（Debug Info への1行など）が必要になり、検証タスクの範囲を超える。必要なら別途判断する（Follow-up）。

C を選ばない理由: 上記のとおり、信頼できる観測手段が既にある。ただし **テストは未実行** のため、実行して U-1〜U-3 が解消されるまで「実現可能」は INFERENCE。

## Proposed Acceptance Criteria

**TEST VERIFIED（提案テストを実行して PASS した場合に初めて主張できる。現時点ではすべて未検証）**

| # | 条件 | 観測 |
| --- | --- | --- |
| TV-1 | 魔法使いがテストモードで幻影歩法（既定 Skill 1）を発動できる | `KeyL` 後にエラー無し（既定値 👣 は既存テストで検証済み） |
| TV-2 | 幻影歩法の発動後、Mirror Shade が攻撃動作（WINDUP / STRIKE）に入る | `#arena-enemy-info` の AI State |
| TV-3 | その攻撃がプレイヤーに当たらない | `#hp-fill` 不変・ダメージポップアップ不増 |
| TV-4（対照・任意） | 幻影歩法を使わない場合、同じ敵の最初の攻撃はプレイヤーに当たる | 同上 |

**CODE VERIFIED（コードで確認済み。E2E では示さない）**

| # | 条件 | 根拠 |
| --- | --- | --- |
| CV-1 | 幻影は発動前のプレイヤー位置に置かれる | `13-update-loop.js:373` |
| CV-2 | 幻影は `state.decoys` に登録され、ゲーム内 5.0 秒で消える | `11-combat-actions.js:1447-1467`（寿命ロジックは unit でも検証済み） |
| CV-3 | Mirror Shade の移動・攻撃開始の基準は `aggroPoint`、命中判定は本人の位置 | `07-ai-combat.js:2483-2593` |
| CV-4 | 敵対の成立・leash は本人の位置 | `07-ai-combat.js:2491-2492`、`:893-899` |

## Out of Scope

- 幻影の誘導を他の敵（通常敵）へ広げること
- ボスへの誘導
- 幻影歩法の挙動の変更
- 敵 AI の変更
- 命中判定の変更
- 敵対 / leash の変更
- 幻影の寿命などの数値調整
- 幻影の同時数上限
- ドキュメントの整理
- 宵待ちの村の残り4種（foam / copy / fisher / keeper）の個別 E2E（1種で行動を示せれば足りる。I-5）

## Follow-up Candidates

- **FC-1**（I-4 / Scope Decision B の理由）座標レベルの検証（幻影の位置・敵が幻影へ近づいた距離）が必要と判断された場合、Debug Info に幻影と敵座標の1行を足す等の観測口の追加（`src/` 変更を伴うので別判断）
- **FC-2**（R-10 / U-5）E2E 実行環境のブラウザリビジョン不一致の解消（Retrospective DC-4 と同じ）

## Recommendation

- Scope Decision **A** で Planner へ進めることを推奨する。変更は E2E の追加だけ（`tests/` に1テスト、既存ヘルパー `startTestMode` / Arena 操作 / `#arena-enemy-info` の読み取りの再利用）で、`src/` は変更しない
- 人間が決めること: (1) 対照テスト TV-4 を含めるか、(2) テストの置き場所（`scenario-test-mode.spec.js` / `job-traits.spec.js` の Arena 系 / 新規ファイル）、(3) 座標レベルの検証（FC-1）を今回は求めないことの確認
- 実装後は Test Report で U-1〜U-3 の解消を記録し、PASS した項目だけを TEST VERIFIED とする

## Protocol Status

Status: ANALYZING
Human Approval: NOT REQUIRED YET
Implementation: NOT AUTHORIZED
Tests: NOT RUN
