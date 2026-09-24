# MAGE-002

Mage Skill 1 Phantom Decoy E2E Verification（魔法使い Skill 1 幻影歩法の誘導を E2E で確かめる）

Status: REVIEWING

Analysis: [`../reports/MAGE-002-analysis.md`](../reports/MAGE-002-analysis.md)（Scope Decision A）
Related: [`MAGE-001.md`](MAGE-001.md)（既存実装で達成済みとした Task。本 Task はその検証を別に行う）

本 Task は Work Item を持たない Task（`../AGENTS.md` §7.1）。承認単位は Task 全体。

## Request

既存の幻影歩法（`phantom`）が、実際のゲームプレイで宵待ちの村の敵を幻影のほうへ誘導することを、
ゲームコードを変えずに E2E で示す。

## Objective

「Combat Test Arena で Mirror Shade を相手に魔法使いの Skill 1（幻影歩法）を使うと、
敵は **幻影に向けて攻撃動作に入り、本物のプレイヤーには当たらない**」ことを、1本の E2E で行動として確かめる。
内部状態（座標・`state.decoys`）ではなく、画面に出ている情報（Debug Info の AI 状態・HP バー）で判定する。

## Scope

| 対象 | 範囲外 |
| --- | --- |
| Mirror Shade 1体（宵待ちの村の敵、Arena の既存ロスター） | 残り4種・通常敵・ボス |
| 幻影歩法の発動 → 敵の攻撃動作 → 本人が被弾しない、という行動 | 幻影の座標・敵と幻影の距離・寿命 |
| 既存のテストモード・Arena・Debug Info・HP バーの再利用 | ゲームコード・観測用フック・Playwright 設定の変更 |

## Analyzer Reference

- [`MAGE-002-analysis.md`](../reports/MAGE-002-analysis.md): FACT 1〜15、I-1〜I-5、U-1〜U-5、Scope Decision **A**
- 本計画のために Planner が追加で確認したコード（P-番号）:

| # | FACT | 根拠 |
| --- | --- | --- |
| P-1 | Debug Info の Mirror Shade の `AI State` は `mirrorState` の大文字（`CHASE` / `WINDUP` / `STRIKE`）＋分身表記。`CHASE` は **敵対前（徘徊中）でも出る** ―― `mirrorState` は初期値 `'chase'` で、`triggered` でなければ `updateWanderAI` に回るだけ | `14-training-ground.js:175-176`、`07-ai-combat.js:2476-2477, 2546-2547` |
| P-2 | `WINDUP` に入るのは `triggered` かつ `aim` まで 1.9 以下のときだけ。したがって `WINDUP` を観測できれば敵対は成立している | `07-ai-combat.js:2546-2560` |
| P-3 | 本体の予兆（WINDUP）は 0.72 秒、`STRIKE` は 0.22 秒（ゲーム内時間）。STRIKE 後は `CHASE` に戻り、攻撃 CD 2.0 秒、`postAtkRecoveryT` が立つ（Debug Info の `Punish: RECOVERY`） | `core/mirror-shade.js:36`、`07-ai-combat.js:2575-2600`、`14-training-ground.js:188-189` |
| P-4 | Debug Info は `#arena-info-toggle-btn` で ON にすると、Arena パネルを畳んでも表示され続ける | `job-traits.spec.js:55-57`（既存テストのコメントと手順） |
| P-5 | プレイヤーへのダメージは `applyIncomingDamageMul` を通り、テストモードでも入る（テストモードは HP1 で踏み止まるだけ）。HP の自動回復は無い（`state.hp = Math.min(state.maxHp, state.hp +` の該当なし） | `07-ai-combat.js:4898`、`12-progression-ui.js:1168`、検索結果 |
| P-6 | `#hp-fill` の幅は `state.hp / state.maxHp` の割合（%）で毎フレーム更新 | `14-hud-boot.js:363` |
| P-7 | 被弾のダメージ表示は `.dmg-pop.incoming`（与ダメージの表示と区別できる） | `11-combat-actions.js:2165` |
| P-8 | テストモードの開始地点は `(455, -14)`、`state.facing = 0`（+Z 向き）。トレーニング空間のカカシは `(455, -4)` 付近。Arena は正面 5.5 ＋横ずれ（1体目は −2.6）に置く | `14-hud-boot.js`（`TESTMODE_SPAWN`、`finishEnteringGame`）、`auto-combo.spec.js:66-69` のコメント、`07-ai-combat.js:782-785` |
| P-9 | `playwright.config.js` に `retries` の指定は無い（既定 0）。`job-traits.spec.js` のタイミング依存テストだけが `describe.configure({ retries: 2 })` を持つ | `playwright.config.js`、`job-traits.spec.js:94-95` |

## Existing System First

| 必要なもの | 既存 | 場所 |
| --- | --- | --- |
| テストモードで魔法使いとしてトレーニング空間に入る | `startTestMode(page, {classKey:'mage'})`（シナリオ未指定ならトレーニング空間） | `tests/helpers.js:132` |
| ページを開く・コンソールエラー監視 | `openGame` / `watchErrors` | `tests/helpers.js` |
| Mirror Shade を1体出す | Arena の手順（`#arena-toggle-btn` → `#arena-roster button:has-text("Mirror Shade")` → `#msg-log` の「Mirror Shade spawned」を待つ → 畳む） | 同手順が `job-traits.spec.js:31-38` の `spawnFromArena`（ファイル内のローカル関数） |
| 敵の状態を読む | `#arena-info-toggle-btn` で ON → `#arena-enemy-info` の `AI State:` | `job-traits.spec.js:55-60, 133, 189` |
| プレイヤーの被弾 | `#hp-fill` の `style.width`、`.dmg-pop.incoming` | P-6, P-7。幅の読み取りの前例 `auto-combo.spec.js`（`barWidth`） |
| Skill 1（幻影歩法） | `KeyL`。テストモードの魔法使いの既定は `phantom` | `09-save-load.js:332,355`、T-1 |

**新しいヘルパー・window 公開・観測用フック・ゲームコードの変更は不要。** Arena の Spawn 手順はファイルをまたいで共有されていないため、
新規テストに同じ数行を置くことになる（`tests/helpers.js` へ移す等の整理は本 Task では行わない）。

## Proposed Test

1本（＋ D-2 で承認された場合のみ対照1本）。retries は付けない（FLAKY を PASS に混ぜない。`../AGENTS.md` §14）。

**T-PH（本体）: 幻影歩法を使うと、Mirror Shade は幻影に攻撃し、本人は被弾しない**

1. `watchErrors` → `openGame` → `startTestMode(page, {classKey:'mage'})`（トレーニング空間）
2. Debug Info を ON にする（Arena パネルを開く → `#arena-info-toggle-btn` → 畳む）。先に ON にしておくのは、Spawn 後にクリックを挟む時間を減らすため（P-4）
3. Arena で Mirror Shade を1体 Spawn し、`#msg-log` の「Mirror Shade spawned」を待つ
4. **待たずに** `KeyL` を押して離す（幻影歩法）。以後、入力しない
   - `CHASE` を待たない理由: P-1 のとおり `CHASE` は敵対の証拠にならず、待つ間に敵が本人へ近づく（Analyzer R-4）
5. 被弾の基準を記録する: `#hp-fill` の幅（この時点で 100%）と `.dmg-pop.incoming` の数
6. `#arena-enemy-info` をポーリングし、`AI State: WINDUP` または `AI State: STRIKE` を観測する（タイムアウト 60 秒）
7. 続けて、攻撃の一巡が終わったことを観測する: `AI State: CHASE` に戻る（`Punish: RECOVERY` が出ていればそれも可）（タイムアウト 30 秒）
8. 判定: `#hp-fill` の幅が手順5から減っていない、`.dmg-pop.incoming` が増えていない
9. `console.error` が無い

判定の考え方（コードで確認済みの前提 ―― CODE VERIFIED の CV-3）:
Mirror Shade の攻撃開始の基準は `aggroPoint`（幻影があれば幻影）、命中はプレイヤー本人から 2.4 以内だけ。
本人を狙っていたなら `WINDUP` は本人から 1.9 以内でしか始まらず、続く `STRIKE` は当たる。
**「攻撃の一巡を終えたのに本人の HP が減っていない」＝「本人以外（幻影）を基準に攻撃した」**。

失敗の現れ方: 敵対しない・幻影に届かない場合は手順6がタイムアウトして **失敗** する（偽の合格にならない）。
本人を狙って当たった場合は手順8で **失敗** する。

**T-CTRL（対照・D-2 で承認された場合のみ）: 幻影歩法を使わなければ、同じ敵の最初の攻撃は本人に当たる**

- T-PH の手順4を行わない（何も入力しない）。手順6〜7の後、`#hp-fill` の幅が減っている、または `.dmg-pop.incoming` が増えていることを確認
- 目的: T-PH の判定手段（HP バー・被弾表示）が、実際に当たったときに変化することをテストで示す

### 対照テストの要否（Planner の評価）

- T-PH 単独でも判別はできる: 偽の合格が起きるのは「本人に当たったのにダメージが画面に出ない」場合だけで、
  コード上それが起きるのは無敵・護りの魔球・`debugMode` のとき（いずれも本手順では発生させない、Analyzer R-6）
- ただし、その前提（「本人を狙った攻撃なら当たり、HP バーが減る」）自体は CODE VERIFIED に留まる。T-CTRL はそれを TEST VERIFIED にする
- コスト: 1テスト分の実行時間（低 fps 環境で数十秒）。ゲームコードの変更は無い
- **推奨: 含める**（判定の感度をテストで担保するため）。ただし必須ではないので D-2 で人間が決める

### タイムアウトの根拠

- 必要なゲーム内時間: 幻影まで約 3.6 進む（1.76/秒で約 2.0 秒）＋ WINDUP 0.72 秒＋ STRIKE 0.22 秒 ≈ 3 秒（Analyzer I-1、P-3）
- `dt` は 1 フレーム最大 0.05 秒（Analyzer FACT 15）。3 fps でもゲーム内 0.15 秒 / 壁時計 1 秒 → 約 20 秒。手順6は 60 秒、手順7は 30 秒で余裕を持たせる
- 幻影の寿命（ゲーム内 5.0 秒）はゲーム内時間なので fps に依存しない
- テスト全体の `test.setTimeout` は 120 秒（起動・テストモード入場を含む。既存 `scenario-test-mode.spec.js` と同程度）
- 位置の許容誤差は不要（座標を判定に使わない）

## Acceptance Criteria

**TEST VERIFIED（提案テストを実行して PASS したときに初めて主張できる。現時点ではすべて未検証）**

| # | 条件 | 観測 |
| --- | --- | --- |
| TV-1 | 幻影歩法の発動後、Mirror Shade が攻撃動作（`WINDUP` または `STRIKE`）に入る | `#arena-enemy-info` の `AI State` |
| TV-2 | その攻撃の一巡の間、プレイヤーの HP が減らず、被弾表示も出ない | `#hp-fill` の幅、`.dmg-pop.incoming` の数 |
| TV-3 | 敵はその後 `CHASE`（攻撃でない状態）に戻る | `#arena-enemy-info` の `AI State` |
| TV-4 | テスト中にコンソールエラーが無い | `watchErrors` |
| TV-5（D-2 承認時のみ） | 幻影歩法を使わない場合、同じ敵の最初の攻撃でプレイヤーの HP が減る | `#hp-fill` / `.dmg-pop.incoming` |

**CODE VERIFIED（コードで確認済み。テストでは直接示さない）**

| # | 条件 | 根拠 |
| --- | --- | --- |
| CV-1 | Arena の Mirror Shade は既存の `buildDuskMirrorShade`（宵待ちの村と同じ AI、pull 1.0）で、テストモードのトレーニング空間でプレイヤー正面 5.5 に出る | `07-ai-combat.js:755, 778-797`、Analyzer FACT 2 |
| CV-2 | Debug Info は Mirror Shade の攻撃状態（CHASE / WINDUP / STRIKE）を文字で出す | P-1 |
| CV-3 | Mirror Shade の攻撃開始の基準は `aggroPoint`、命中はプレイヤー本人から 2.4 以内のときだけ ―― 幻影への攻撃と本人への攻撃を、被弾の有無で区別できる | `07-ai-combat.js:2483-2593`、Analyzer FACT 10〜13 |
| CV-4 | 幻影は発動前の位置に置かれ、`state.decoys` に登録される（座標は E2E では示さない） | Analyzer CV-1〜CV-2 |

## Test Scope

- **Targeted**（`../AGENTS.md` §14）
- 実行するもの: 追加するテスト（T-PH、承認時は T-CTRL）
- 回帰として実行するもの: 追加先の spec ファイル全体、`combat-test-arena.spec.js`、`scenario-test-mode.spec.js`（テストモードの起動を共有するため）
- `npm run build` / `npm run test:unit`: 実行する（コード変更は無いが、Protocol の手順として）
- 実行しないもの: 全体の `npm test`（ゲームコードを変更しないため。実行しなかった旨を Test Report に書く）
- 実行環境: ブラウザのリビジョン不一致がある場合は、リポジトリ外（スクラッチ領域）で回避し、その内容を Test Report に書く。`playwright.config.js` は変更しない

## Test Evidence

| 項目 | 状態 |
| --- | --- |
| 提案テストの実装 | 未実装 |
| 提案テストの実行 | NOT_RUN |
| TEST VERIFIED の項目 | なし |
| 既存の関連テスト | 魔法使いの既定 Skill 1 = 👣（`scenario-test-mode.spec.js:51`、T-1 で PASS）、`decoy.test.js`（unit）。**誘導の E2E は存在しない** |

## Risks

| # | リスク | 対策（計画上） |
| --- | --- | --- |
| RK-1 | 低 fps でゲーム時間が遅い | 固定待ちではなく状態のポーリング＋長めのタイムアウト |
| RK-2 | Spawn 直後に敵対が成立しない（視線・距離）| 失敗はタイムアウトとして現れ、偽の合格にならない。原因は Debugger で調べる（Analyzer U-1） |
| RK-3 | 発動前にプレイヤーの向きが変わり、幻影の位置がずれる | 引きつけ半径 11 に対し距離約 5.5 で余裕（Analyzer U-2） |
| RK-4 | Debug Info が別の敵（カカシ）を読む | Mirror Shade のほうが近い配置（P-8）。`WINDUP` / `STRIKE` はカカシでは出ない |
| RK-5 | 無敵・護りの魔球で被弾が消える | 回避・Skill 2 を使わない。幻影歩法の移動は無敵を付けない |
| RK-6 | 分身の出現で状態が変わる | ダメージを与えないため分裂しない |
| RK-7 | 実行環境のブラウザ不一致 | リポジトリ外で回避（Test Scope） |
| RK-8 | 2回目以降の攻撃（幻影が消えた後）で本人が被弾 | 判定は最初の攻撃の一巡が終わった時点（手順7〜8）で行い、その後は見ない |

## Out of Scope

- 幻影の正確な座標・敵と幻影の距離
- 幻影の寿命
- 宵待ちの村の5種すべての検証
- ボス・通常敵への誘導
- 命中判定・敵対・leash の変更
- 幻影の同時数上限
- バランス調整
- ドキュメントの整理
- ゲームコード・観測用フック・`playwright.config.js` の変更
- Arena の Spawn 手順の共通ヘルパー化（`tests/helpers.js` の整理）

## Follow-up Candidates

- **FC-1** 座標レベルの検証が必要になった場合の観測口（Debug Info への1行など。`src/` 変更を伴う）（Analyzer FC-1）
- **FC-2** E2E 実行環境のブラウザリビジョン不一致の解消（Analyzer FC-2 / Retrospective DC-4）
- **FC-3** Arena の Spawn 手順が複数の spec にローカル関数として重複している件の整理（本 Task で重複が1つ増える場合）

## Human Decisions

実装前に人間が決める事項。

| # | 問い | 選択肢 | Planner の推奨 |
| --- | --- | --- | --- |
| **D-1** | この行動 E2E（T-PH）を追加してよいか | 承認 / 却下 | 承認（ゲームコード無変更で、誘導の実挙動を初めてテストで示せる） |
| **D-2** | 対照テスト T-CTRL を含めるか | 含める / 含めない | 含める（判定手段の感度を TEST VERIFIED にするため。上記「対照テストの要否」） |
| **D-3** | テストの置き場所 | A: 新規 `tests/mage-phantom.spec.js` / B: `tests/job-traits.spec.js` / C: `tests/combat-test-arena.spec.js` | **A**。`job-traits.spec.js` は上位職の Job Trait 専用とファイル冒頭で定義されており、幻影歩法（基礎職の Skill 1）は該当しない。`combat-test-arena.spec.js` は Arena 自体の機能テスト。新規ファイルなら既存テストの目的を崩さず、retries 付きの describe とも混ざらない |

## Status

Status: REVIEWING
Human Approval: APPROVED（下記）
Implementation: COMPLETE（末尾の Implementation Result）
Tests: recorded（Targeted。全件 PASS、FLAKY なし）
Reviewer gate: pending

## Human Approval

- [x] Approved
- Approved by / date / where: ユーザー（人間）/ 2026-09-24 / Claude Code セッションでの明示的な承認メッセージ
- Decisions: D-1 APPROVED（E2E を追加）/ D-2 APPROVED（対照テストを含める）/ D-3 APPROVED（新規 `tests/mage-phantom.spec.js`）
- Scope of approval: `tests/mage-phantom.spec.js` の新規追加のみ。`src/` / `basefile.html` / ゲームロジック / Playwright 設定 / 既存テスト / テストヘルパーは変更しない。自動 commit・push はしない

## Implementation

**AUTHORIZED**（2026-09-24 承認。範囲は Human Approval の Scope of approval）

承認後に Implementer が行うこと（範囲）:
- D-3 で選んだファイルに T-PH（D-2 承認時は T-CTRL も）を追加する
- `src/` / `docs/` / `playwright.config.js` / `tests/helpers.js` / 他の spec は変更しない
- Test Scope どおりに実行し、`../agents/implementer.md` の Implementation Result（Test Report を含む）を本ファイル末尾に追記する

## Status History

| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-09-24 | Task | － → ANALYZING | Analyzer | `MAGE-002-analysis.md`（Scope Decision A）。未コミット |
| 2026-09-24 | Task | ANALYZING → WAITING_APPROVAL | Planner | 本計画を作成。テストは未実装・未実行。未コミット |
| 2026-09-24 | Task | WAITING_APPROVAL → APPROVED | Human | D-1 / D-2 / D-3 すべて承認 |
| 2026-09-24 | Task | APPROVED → IMPLEMENTING | Implementer | `tests/mage-phantom.spec.js` の追加に着手 |
| 2026-09-24 | Task | IMPLEMENTING → TESTING | Implementer | テスト追加完了。Targeted 実行 |
| 2026-09-24 | Task | TESTING → REVIEWING | Implementer | 新規2件・関連 spec・build・unit すべて PASS（下の Implementation Result）。Reviewer 待ち。未コミット |

## Implementation Result

記入: Implementer（2026-09-24）。テンプレートは `../agents/implementer.md`。

### Changed Files

| ファイル | 変更 |
| --- | --- |
| `tests/mage-phantom.spec.js` | **新規**。T-PH（幻影歩法あり）と T-CTRL（対照）の2件 |
| `.ai/tasks/MAGE-002.md` | Status・Human Approval の記録、本節の追記（承認済みの計画本文は変更していない） |

`src/` / `basefile.html` / `playwright.config.js` / `tests/helpers.js` / 既存の spec / `docs/` は変更していない。
新しいゲーム側のフック・座標の公開・window への露出は追加していない。

### 実装の要点

- 既存の `startTestMode`（`tests/helpers.js`）で魔法使いとしてトレーニング空間へ入る
- Debug Info を ON にしてから Arena で Mirror Shade を1体出す（`job-traits.spec.js` の `spawnFromArena` と同じ操作をファイル内の関数に置いた ―― 共通化はしていない。Follow-up FC-3）
- T-PH は Spawn の直後に `KeyL`（CHASE は敵対の証拠にならないので待たない）
- 待ちはすべて状態の遷移で行う: `AI State: WINDUP|STRIKE` を観測 → `AI State: CHASE` を観測（`expect.poll`、60 秒 / 30 秒、100ms 間隔）。**固定の `waitForTimeout` は使っていない**
- 被弾の観測は2つ: `#hp-fill` の幅と、`.dmg-pop.incoming` に表示アニメーション（`dmg-pop-run`）が付いた回数（`auto-combo.spec.js` の `countDamagePopups` と同じ MutationObserver 方式を、被弾表示に絞って使う）
  - T-PH: 両方とも変化しないこと
  - T-CTRL: どちらかが変化すること（HP バーは被弾で必ず減り、テストモードは HP1 で踏み止まるだけなので、通常は両方変わる。片方だけに依存しないよう OR にした）
- T-PH は冒頭で既定の Skill 1 が 👣（幻影歩法）であることも確かめる
- 2件は独立（それぞれ新しいページで起動）。自動リトライは付けていない

### Test Report

- Scope: **Targeted**
- Executed:
  1. `npx playwright test tests/mage-phantom.spec.js`（1回目）
  2. `npx playwright test tests/mage-phantom.spec.js tests/combat-test-arena.spec.js tests/scenario-test-mode.spec.js`（新規 spec の2回目を含む）
  3. `npm run build`
  4. `npm run test:unit`
- Why this scope: 追加はテスト1ファイルのみでゲームコードの変更が無い。テストモードの起動（`scenario-test-mode`）と Arena の操作（`combat-test-arena`）を共有するため、その2つを回帰として実行
- Not run: 全体の `npm test`（ゲームコード無変更のため。計画の Test Scope どおり）
- Environment: この環境の Playwright 1.62.1 が要求するブラウザのリビジョン（1234）が無いため、スクラッチ領域に既存ブラウザ（1194）へのシンボリックリンクを置いた `PLAYWRIGHT_BROWSERS_PATH` で実行した（リポジトリ外。T-1 と同じ回避。リポジトリの問題ではない）

| テスト | 結果 | メモ |
| --- | --- | --- |
| `mage-phantom` T-PH（1回目） | PASS | 35.3s |
| `mage-phantom` T-CTRL（1回目） | PASS | 31.9s |
| `mage-phantom` T-PH（2回目） | PASS | 31.7s |
| `mage-phantom` T-CTRL（2回目） | PASS | 31.3s |
| `combat-test-arena.spec.js`（1件） | PASS | 2.0m |
| `scenario-test-mode.spec.js`（4件） | PASS | |
| `npm run build` | PASS | |
| `npm run test:unit` | PASS | 1490 / 1490 |

FLAKY: なし（いずれも初回で PASS。リトライ設定なし）。FAIL: なし。
リポジトリ起因の失敗: なし。実行環境起因の問題: ブラウザのリビジョン不一致（上記の回避で実行、テスト結果には影響なし）。

### Acceptance Criteria

| AC | 確認方法 | 根拠 |
| --- | --- | --- |
| TV-1 幻影歩法の発動後、Mirror Shade が攻撃動作（WINDUP / STRIKE）に入る | **VERIFIED**（T-PH ×2） | `AI State` の遷移を観測 |
| TV-2 その攻撃の一巡の間、本人の HP が減らず被弾表示も出ない | **VERIFIED**（T-PH ×2） | `#hp-fill` 不変・`.dmg-pop.incoming` 0 増 |
| TV-3 敵はその後 CHASE に戻る | **VERIFIED**（T-PH / T-CTRL ×2） | `AI State: CHASE` を観測 |
| TV-4 コンソールエラーが無い | **VERIFIED**（全件） | `watchErrors` |
| TV-5 幻影歩法を使わなければ、同じ敵の最初の攻撃で本人が被弾する | **VERIFIED**（T-CTRL ×2） | HP 減少または被弾表示 |
| CV-1〜CV-4 | FACT (code) のまま | 計画の Acceptance Criteria 参照。座標・`state.decoys`・寿命は E2E で示していない |

### 行動としての結論（テストで確認）

T-PH と T-CTRL は、幻影歩法を使うかどうか以外は同じ手順・同じ敵・同じ配置である。
- 幻影歩法なし → 最初の攻撃は本人に当たる（T-CTRL）
- 幻影歩法あり → 最初の攻撃の一巡を終えても本人は被弾しない（T-PH）

したがって、幻影歩法の後の Mirror Shade の攻撃は本人以外（幻影）を基準に行われた、と行動から言える。
幻影の座標・敵が幻影へ近づいた距離は **示していない**（範囲外。CODE VERIFIED のみ）。

### Out of Scope Found

なし（ゲームコード・ヘルパー・設定の変更を必要とする問題は出なかった）。
