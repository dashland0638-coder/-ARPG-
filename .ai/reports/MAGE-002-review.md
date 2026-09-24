# MAGE-002 Review

## Review Scope

MAGE-002「Mage Skill 1 Phantom Decoy E2E Verification」の再レビュー（READ ONLY）。

| 項目 | 値 |
| --- | --- |
| Branch | `claude/chapter-structure-scenario-test-q6oj4l` |
| Commit | `88fb6fc924bb5f7120401480a3874d45efd3c08b`「test(mage): verify phantom step lures Mirror Shade in E2E (MAGE-002)」 |
| MAGE-002 の差分 | `88fb6fc^..88fb6fc`（3ファイル、+615 / −0） |
| 承認済みスコープ | `tests/mage-phantom.spec.js` の新規追加（T-PH ＋ 対照 T-CTRL）。ゲームコード・観測用フック・Playwright 設定・共通ヘルパー・既存テストは変更しない |

前回レビュー（成果物不在による CHANGES_REQUIRED）の結論は引き継がず、上記コミットの実ファイルで再評価した。
テストは再実行していない（指示どおり）。テスト結果は MAGE-002.md の記録と実装内容の整合で評価した。

## Inputs Reviewed

| 入力 | 確認内容 |
| --- | --- |
| `.ai/tasks/MAGE-002.md`（@88fb6fc） | 計画（T-PH / T-CTRL、Acceptance Criteria TV-1〜5 / CV-1〜4）、Human Approval（D-1/D-2/D-3）、Status History、Implementation Result / Test Report |
| `.ai/reports/MAGE-002-analysis.md`（@88fb6fc） | FACT 1〜15、Search Record、READ ONLY の宣言 |
| `tests/mage-phantom.spec.js`（@88fb6fc） | 全 107 行 |
| `git diff 88fb6fc^ 88fb6fc --stat` | 変更ファイルの範囲 |
| `src/legacy/parts/07-ai-combat.js` | `updateMirrorShadeAI`（L2470-2600）、`aggroPoint`（L2407-2410） |
| `src/legacy/parts/13-update-loop.js` | `variant.mode==='phantom'`（L369-374）、無敵の設定箇所 |
| `src/legacy/parts/11-combat-actions.js` | `spawnPhantomDecoy`（L1432-）、`spawnDamagePopup` の `.incoming` / `dmg-pop-run`（L2157-2178） |
| `src/legacy/parts/14-training-ground.js` | `toggleArenaDebugInfo`（L102-106）、`updateArenaEnemyInfo`（L136-）の対象敵の選び方と mirror の AI State 表記 |
| `.ai/AGENTS.md` / `.ai/agents/reviewer.md`（@88fb6fc） | 独立性の記載要件（§5、L121-122）、Status 遷移 |
| `origin/main` との関係 | `git merge-base`、`git merge-tree` |

## Previous Findings

| ID | 前回の内容 | 今回 |
| --- | --- | --- |
| F-01（BLOCKER） | 成果物（spec / Task / Analysis / Test Report）がリポジトリに存在しない | **RESOLVED**。`88fb6fc` に `tests/mage-phantom.spec.js`・`.ai/tasks/MAGE-002.md`・`.ai/reports/MAGE-002-analysis.md` が存在することを確認した。Implementation Result / Test Report は `MAGE-002.md` 末尾に記録されている |
| F-02（MAJOR） | Status・承認記録を確認できない | **RESOLVED**。`MAGE-002.md` に `Status: REVIEWING`、Human Approval（2026-09-24、D-1/D-2/D-3 APPROVED）、Status History が記録されている |

どちらも成果物が受け渡されていなかったことが原因で、実装内容の不備ではなかった。

## Findings

BLOCKER / MAJOR / MINOR に当たる指摘は無い。記録のため NOTE を3件残す。

### N-1

- ID: N-1
- Severity: NOTE
- Evidence: `88fb6fc` のブランチは `origin/main`（`d93eb09`）を含まない（merge-base `501a320`）。`main` にだけ WORK 12.1 の `2d5dcf0`（テストモードで指定レベルのステータスを計算し直す、`14-hud-boot.js` `normalizeChapter1Load`）と `dd29ba5`（Support AI）がある。`git merge-tree` では衝突なし
- Impact: 記録されたテスト結果は WORK 12.1 を含まないベースでの結果。T-PH の判定（HP・被弾表示が変わらない）は被弾経路が同じなので影響しない。T-CTRL は HP の減少 **または** 被弾表示の増加で判定するので、ステータス値が変わっても判定は成り立つ。影響は小さいと判断する
- Required Action: なし（MAGE-002 の範囲外）。`main` への統合時に、通常の統合後テストで確認すれば足りる

### N-2

- ID: N-2
- Severity: NOTE
- Evidence: `spawnMirrorShadeWithInfo`（spec L44-50）は `job-traits.spec.js` の `spawnFromArena` と同じ操作を、ファイル内のローカル関数として置いている
- Impact: テスト内の手順が重複する。承認済み計画で「共通化は行わない」とされ、Follow-up FC-3 に記録済み
- Required Action: なし（承認済み。FC-3 のまま）

### N-3

- ID: N-3
- Severity: NOTE
- Evidence: Analyzer・Planner・Implementer はいずれも同じセッション（`session_01N5dXBiKyW2vJNgTHU8daFD`、コミットの Claude-Session）で行われた
- Impact: Protocol が独立を求めるのは Reviewer だけで（AGENTS.md L121-122）、違反ではない。Analyzer・Planner の各段階でファイルを変更していないことは Status History と Analysis の宣言で確認した
- Required Action: なし

## Acceptance Criteria Review

判定の前提として、ゲームコードで次の事実を確認した。

- **WINDUP は途中で打ち切られない**: `windup` は `mirrorT<=0` で必ず `strike` へ、`strike` は `mirrorT<=0` で必ず `chase` へ移る（`07-ai-combat.js` L2563-2600）。他の遷移は無い。したがって「WINDUP|STRIKE を観測し、その後 CHASE を観測」すれば、STRIKE（0.22 秒）が最後まで実行されている
- **CHASE だけでは敵対の証拠にならない**: 非敵対の `chase` は `updateWanderAI` に回るだけ（L2545）。テストは CHASE を敵対の証拠に使わず、先に WINDUP|STRIKE を待っている（spec L52-59）。WINDUP は `triggered` かつ `aim` まで 1.9 以下のときだけ始まる（L2544-2555）
- **命中は本人基準**: STRIKE の命中は `distToPlayer < 2.4`（本人との距離）、向かう先は `aim = aggroPoint(en)`（幻影があれば幻影）（L2483-2488, L2581-2593）
- **位置関係**: 幻影歩法は本人を向きの逆へ 3.6 下げる（Analysis FACT 8）。Mirror Shade は正面 5.5・横ずれ −2.6 に出るので、幻影から 1.9 の地点で振った攻撃は本人から約 5.4 離れ、2.4 に届かない
- **偽の合格が起きにくい**: 幻影歩法（`mode==='phantom'`）は `state.invulnerable` を立てない（`13-update-loop.js` L369-374。無敵を立てるのはバリアとボススキルだけ）。`state.debugMode` を立てる経路はこの手順に無く、Debug Info の ON は表示の切り替えだけ（`14-training-ground.js` L102-106）。基準値は発動直後に取り、最後に比べるので、観測しそこねた攻撃で被弾していても検出される
- **Debug Info の対象**: プレイヤーに最も近い敵（L139-144）。カカシ（本人から約 10、後退後はさらに遠い）より Mirror Shade が近い。mirror の表記は `mirrorState` の大文字（L175-176）

### Phantom test（T-PH）

| 基準 | 判定 | 根拠 |
| --- | --- | --- |
| Mage Skill 1 が Phantom である | PASS | spec L69: `#btn-charge-icon` が 👣 であることを検査 |
| Mirror Shade が既存 Arena 経由で生成される | PASS | spec L44-50: `#arena-roster button:has-text("Mirror Shade")` → `#msg-log`「Mirror Shade spawned」 |
| 既存の KeyL 入力で発動する | PASS | spec L73: `page.keyboard.press('KeyL')`。ゲーム側に新しい入力口は無い |
| 発動後にプレイヤー操作を停止する | PASS | L73 以降に入力操作が無い（ポーリングと読み取りのみ） |
| 敵が WINDUP または STRIKE に到達する | PASS | spec L55-56: `/AI State: (WINDUP\|STRIKE)/` を待つ（`Punish: WINDUP` とは `AI State:` で区別される） |
| 攻撃サイクルが終了する | PASS | spec L57-58: その後 `AI State: CHASE` を待つ。上記のとおり STRIKE の完了と等しい |
| プレイヤー HP が減少しない | PASS | spec L80: `#hp-fill` の幅が基準値と同じ |
| 被弾表示が発生していない | PASS | spec L81: `.dmg-pop.incoming` に `dmg-pop-run` が付いた回数が増えていない（L23-37） |
| 自動 retry で失敗を隠していない | PASS | spec に `retries` / `describe.configure` が無く、`playwright.config.js` にも retries の指定が無い（計画 P-9） |
| 核となる判定が固定 sleep に依存していない | PASS | `waitForTimeout` は無く、待ちはすべて `expect.poll`（状態の遷移）だけ |

### Control test（T-CTRL）

| 基準 | 判定 | 根拠 |
| --- | --- | --- |
| 同じ Arena / Mirror Shade を使う | PASS | T-PH と同じ `spawnMirrorShadeWithInfo`（spec L93） |
| Phantom を発動しない | PASS | spec L94: 入力なし |
| 敵が攻撃状態に到達する | PASS | 同じ `waitForFirstAttackCycle`（L99） |
| プレイヤーが実際に被弾する | PASS | spec L103-104: HP 減少 **または** 被弾表示の増加。敵対中の Mirror Shade の攻撃は本人の 1.9 以内で始まり、無入力の本人に 2.4 以内で当たる |
| Phantom test とは独立したページ・状態 | PASS | 各テストが固有の `{ page }` fixture で `openGame` から起動し、状態を共有していない |

### Discrimination

PASS。2つのテストは、幻影歩法を使うかどうか以外は同じ手順・同じ敵・同じ配置である。

- 対照：攻撃の一巡で本人が被弾する
- 本体：同じ一巡で被弾しない

この組み合わせで「幻影の後、敵の攻撃は本人以外を基準に行われた」ことを行動として示している。
対照によって、HP バーと被弾表示が実際の被弾に反応することもテストで確かめられている。座標レベルの検証は範囲外として扱った。

## Test Result Review

MAGE-002.md の記録（変更していない）:

| テスト | 記録された結果 |
| --- | --- |
| mage-phantom Phantom test（T-PH） | 2/2 PASS（35.3s / 31.7s） |
| mage-phantom Control test（T-CTRL） | 2/2 PASS（31.9s / 31.3s） |
| combat-test-arena.spec.js | PASS（1件） |
| scenario-test-mode.spec.js | PASS（4件） |
| npm run build | PASS |
| npm run test:unit | PASS（1490 / 1490） |
| full npm test | NOT_RUN（ゲームコード無変更のため。計画の Test Scope どおり） |
| FLAKY | なし |
| FAIL | なし |

実装内容との整合:

- 実行時間は `test.setTimeout(120_000)` の範囲内
- retries が無いので、2回とも初回 PASS という記録と矛盾しない
- 実行コマンドは計画の Test Scope（新規 spec ＋ 回帰2ファイル ＋ build ＋ unit）と一致
- NOT_RUN（全体の `npm test`）は承認済みの Targeted スコープ外で、失敗とはみなさない

Environment: Playwright 1.62.1 が要求するブラウザのリビジョン（1234）が無いため、スクラッチ領域にリビジョン 1194 へのシンボリックリンクを置き、`PLAYWRIGHT_BROWSERS_PATH` で回避したと記録されている。リポジトリ外の回避で、`playwright.config.js` は変更されていない（下の Scope Review）。実行環境の問題として扱われていることを確認した。

Reviewer はテストを再実行していない（指示による）。上の結果は記録と実装の整合を確認したもので、Reviewer が再現したものではない。

## Scope Review

**スコープ内。** MAGE-002 のコミット `88fb6fc` の変更は次の3ファイルの新規追加だけ。

| ファイル | 変更 |
| --- | --- |
| `tests/mage-phantom.spec.js` | 新規（+107） |
| `.ai/tasks/MAGE-002.md` | 新規（+298） |
| `.ai/reports/MAGE-002-analysis.md` | 新規（+210） |

このコミットで、`src/`、`basefile.html`、`playwright.config.js`、`tests/helpers.js`、既存の spec、`docs/` は変更されていない。
ゲーム側に新しいフック・window への公開・観測口は追加されていない。spec 内の `window.__incomingPops` はテストの init script が作る変数で、既存の `auto-combo.spec.js` と同じ方式。

補足: 同じブランチの先行コミットには `src/legacy/parts/14-hud-boot.js`（`92a79bc`）と `tests/scenario-test-mode.spec.js` の変更があるが、どちらも CHAPTER-STRUCTURE T-1 のもので、MAGE-002 の差分ではない。

## Protocol Compliance

| 項目 | 判定 | 根拠 |
| --- | --- | --- |
| Analyzer: READ ONLY | PASS | Analysis の冒頭に「このファイル以外は変更していない。テストは実行していない」とある。コミットにゲームコードの変更は無い |
| Planner: READ ONLY | PASS | Status History の ANALYZING → WAITING_APPROVAL の時点で「テストは未実装・未実行」とある |
| Human Approval が実装前に行われた | PASS | Status History で WAITING_APPROVAL → APPROVED（Human）が APPROVED → IMPLEMENTING より前にある。D-1/D-2/D-3 の承認とその範囲が記録されている |
| Implementer が承認範囲内だけを実装した | PASS | Scope Review のとおり |
| テスト結果が記録されている | PASS | Implementation Result / Test Report |
| Status が REVIEWING | PASS | `MAGE-002.md` の `Status: REVIEWING`、`Reviewer gate: pending` |
| Implementer が自分で DONE にしていない | PASS | DONE への遷移は記録されていない |

## Reviewer Independence

別 Agent・別セッション。このレビューは Implementer（`session_01N5dXBiKyW2vJNgTHU8daFD`）とは別の Reviewer セッション（`session_01CZ2cLcXbSKR9gUtE4Ru8Fu`）で行った。
入力は Task / Plan / `git diff` / Test Report / 関連するゲームコードだけで、Implementer の判断過程は入力にしていない。Reviewer はゲームコード・テスト・設定を変更していない。

## Final Review Decision

Final Review Decision: PASS

承認済みの Acceptance Criteria はすべて、実際のコードと記録されたテスト結果から確認できた。BLOCKER / MAJOR / MINOR の指摘は無い（NOTE 3件、対応不要）。
MAGE-002 を DONE にする操作は、このレビューでは行わない。

## Status

Reviewer Decision: PASS
Task Status: REVIEWING
Implementation: COMPLETE
