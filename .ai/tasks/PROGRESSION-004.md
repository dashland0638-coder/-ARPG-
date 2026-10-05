# PROGRESSION-004

Status: DONE

Analysis: .ai/reports/PROGRESSION-004-analysis.md（branch `claude/agent-autonomous-execution-ewtk87` @ `4ba5a1a99db576d792efb61cd145c9d8e6c6589a`、blob `05e29a5452fdc91008d7283dfe866f1073bf2335`）

## Approval
- [x] Approved
- Approval type: Agent Approval（`../AGENTS.md` §6.1。仕様は Human Decision 2026-10-04）
- Escalation Check: None（E-1: Human Decision どおり / E-2: 施設の登場タイミングは既存の確定仕様（docs/SCENARIOS.md「洋館クリア後に鍛冶屋が加入」= `smithJoined`）で決まる。新しいタイミングを作らない / E-3: 新しい仕様なし / E-4: セーブは消さない・変換しない / E-6・E-7・E-9: 該当なし）
- Approved by / date / where: Planner (Agent) / 2026-10-04 / branch `claude/agent-autonomous-execution-ewtk87`
- Scope of approval: 下の Files To Change
- Persistence: 許可（branch: `claude/agent-autonomous-execution-ewtk87`、根拠: セッション割当の開発ブランチ。AD-003）。PR は #32 を更新する（AGENTS.md §21）

Implementation: ALLOWED

## Goal

第一章序盤の施設アクセス仕様を、現在のゲームデザインに合わせて正式化・実装・テストする。剣士のみが登場している段階では、鍛冶師も鍛冶設備も酒場に無く、鑑定・装備変更・スキル変更などの施設機能へ到達できない（Human Decision、2026-10-04）。

## Facility Progression Rule（実装する規則）

| 状態 | 条件 | 酒場 | 施設 |
| --- | --- | --- | --- |
| 未登場 | 本編で `smithJoined` が false（剣士だけの段階 = 洋館クリア前） | 鍛冶士も作業台も無い | 入口なし（インタラクト・`KeyI`・チェックポイントのどれからも開かない） |
| 登場済み・利用可能 | 本編で `smithJoined` が true（洋館クリアで加入） | 鍛冶士・金床・炉（既存） | 既存どおり |
| テストモード | `state.testMode` | 既存どおり（加入前は仮設の作業台） | 既存どおり（どこでも開ける） |

「登場済み」と「利用可能」を分ける既存の状態は無い（鍛冶士が居れば使える）。今回も分けない。

## Implementation Plan

| Step | ファイル | 変更 |
| --- | --- | --- |
| 1 | `src/core/chapter1-rules.js` | `smithFacilityAvailable(progress)`（`testMode ‖ smithJoined`）。判定はここだけ |
| 2 | `src/legacy/concat-plugin.js` | import |
| 3 | `src/legacy/parts/03-dungeons-mansion-temple.js` | `buildTavern`: 加入前の仮設の作業台は、施設が使えるとき（= テストモード）だけ建てる |
| 4 | `src/legacy/parts/02-world-common.js` | `nearbySmith` は施設が使えるときだけ。チェックポイント: 回復は今まで通り、鑑定所は施設が使えるときだけ開く。施設が無ければ表示から「装備整理」を外し、使った後のチェックポイントは何もしないので拾わない |
| 5 | `src/legacy/parts/12-progression-ui.js` | `toggleAppraisal`（本編）: 施設が使えなければ開かない。影の旅人の初対面: 施設が無いときは作業台を指す 1 行を出さない（新しい台詞は書かない） |
| 6 | `index.html` | メニューの操作説明「鑑定所(鍛冶士／仮設の作業台の前で)」から、本編に無い「仮設の作業台」を外す |
| 7 | tests | 新規 E2E（剣士だけの段階で施設に到達しない・旧セーブ・加入後は使える・テストモード）、unit（判定・入口の構造）。加入前の本編で鑑定所を開いていた既存 E2E は、検証の中身を変えずに施設が使える状態へ移す |

## Files To Change
上の表のファイル、`tests/chapter1-facility-access.spec.js`（新規）、`tests/unit/chapter1-rules.test.js`、`tests/unit/chapter1-growth-effects.test.js`、既存 E2E の前提の移し替え（`chapter1-skill2`・`mansion-escort`・`chapter1-legacy-ui`・`character-weapon-visual`）、`.ai/` の記録

## Files Not To Change
`basefile.html`、セーブの読み書き（`09-save-load.js`）、`smithJoined` を立てる処理、主人公の交代、Skill 1 / Skill 2 / Ult、テストモードの施設（Arena・どこでも `KeyI`）、鍛冶士加入後の鑑定所の中身（UI-002-F C-1〜C-5）、Chapter 2

## Test Plan
- 新規 E2E を実装前に追加し、変更前の src で FAIL することを確かめる
- build / unit 全体 / `ai-protocol` / E2E 全体（2 CPU）

## Acceptance Criteria
- AC-F1 本編の剣士だけの段階（`smithJoined: false`）では、酒場の鍛冶士の位置にインタラクトが出ず、`KeyI` でも鑑定所が開かない。作業台が建たない
- AC-F2 洋館のチェックポイントは回復だけで、鑑定所を開かない（本編の加入前）
- AC-F3 加入後（`smithJoined: true`）は鍛冶士の前で鑑定所が開き、装備・スキルの画面が従来どおり動く
- AC-F4 旧セーブの値（`smithJoined` 等）は変えない
- AC-F5 テストモードの施設は変わらない

## Risks
- 序盤（剣士だけの段階）に宝箱で拾った装備は、鍛冶士の加入まで付け替えられない（Human Decision どおり）
- 洋館をクリアしたのに `smithJoined` が無いセーブ（通常のプレイでは作られない）は施設が出ない（Known Limitation）

## Rollback
PROGRESSION-004 の実装 commit を revert する

## Out of Scope
- 施設を「登場済みだが利用不可」にする段階（既存仕様に無い）
- 鍛冶屋の「準備中」の扱い・施設の中身（UI-002-F C-4 / UI-002-G）
- 影の旅人の初対面で、加入前に何を案内するか（新しい台詞）

## Agent Decisions
| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |
| F-1 | 施設の登場 = `smithJoined` | docs/SCENARIOS.md（確定）「酒場へ帰還 → 鍛冶屋が加入」「鍛冶士（洋館クリア後）」。既存のフラグ | `scenarioClears.mansion` から導く（鍛冶士の見た目の条件と別の判定になる） |
| F-2 | 判定を core の 1 関数にまとめ、入口・建設・文言がそれを使う | 既存の `legacyGrowthEnabled` と同じ作法（`core/chapter1-rules.js`） | 入口ごとに条件を書く |
| F-3 | テストモードは施設あり（今まで通り） | Human の指示（Test Mode を壊さない）、既存 E2E | テストモードも `smithJoined` に従う |
| F-4 | チェックポイントは回復を残し、施設の入口だけ外す。表示は既存の文言から「+装備整理」を外した「🏕️ 休憩する(回復)」 | 回復はチェックポイントの既存機能で施設ではない。新しい文言を作らない（既存の括弧の中身を減らすだけ） | チェックポイントごと無くす（回復の仕様を変える） |
| F-5 | 影の旅人の作業台を指す 1 行は、施設が無いときに出さない | 存在しない物を指さない（同じ関数の既存の注記「居ない人物を指すことになるので、加入の前後で指す先を変える」と同じ理由）。新しい台詞は書かない | 台詞を書き換える（シナリオの文言を Agent が書くことになる） |
| F-6 | 既存 E2E のうち加入前の鑑定所を前提にしたものは、加入後のセーブ・テストモードへ移す（assertion は変えない） | 仕様変更（Human Decision）に伴う前提の変更。検証したい中身（崩し斬りの表示・Skill 2 の未習得表示・鑑定の操作が無いこと・武器の持ち替えの輪郭線）は施設が使える状態で同じように確かめられる | assertion を外す（禁止） |

## Implementation Result

### 計画の更新（実装中、Agent 裁量。Goal の範囲内）
- 既存 E2E の前提の移し替えで、加入後の鍛冶士へ歩いて鑑定所を開く経路が run によって開かないことが分かった（変更前の src でも再現。炉の当たり判定で鍛冶士の範囲の縁に止まり、押している間は範囲の内外を毎フレーム行き来する）。共通の `openAppraisalAtSmith`（`tests/helpers.js`）を追加し、W+D を押したまま I キーを押す形にした。新規 spec・`chapter1-old-save-growth` も同じ歩き方にそろえた
- 文書（実装事実の記述）を新しい規則に合わせた: `docs/SCENARIOS.md`（酒場の表）、`docs/PROGRESSION.md`（チェックポイント）、`docs/CHARACTERS.md`（影の旅人の案内）、`MANSION_SCENARIO.md`（酒場の変化・鍛冶屋・チェックポイント）。Human Decision を `.ai/decisions/UI-002-human-decisions.md` に記録

### Changed Files
- `src/core/chapter1-rules.js`（`smithFacilityAvailable`）、`src/legacy/concat-plugin.js`（import）
- `src/legacy/parts/02-world-common.js`（`nearbySmith`・チェックポイント）、`03-dungeons-mansion-temple.js`（作業台の建設）、`12-progression-ui.js`（`toggleAppraisal`・影の旅人の 1 行）、`index.html`（メニューの操作説明）
- tests: `chapter1-facility-access.spec.js`（新規）、`helpers.js`（`openAppraisalAtSmith`）、`unit/chapter1-rules.test.js`、`unit/chapter1-growth-effects.test.js`、前提の移し替え（`chapter1-skill2`・`mansion-escort`・`chapter1-legacy-ui`・`character-weapon-visual`・`chapter1-old-save-growth`・`mansion-scenario` の注記）
- 文書・記録: 上の「計画の更新」

### Test Report
- Scope: Full（E2E 全体を 2 CPU = CI 相当で実行）

| テスト | 結果 | メモ |
| --- | --- | --- |
| Build | PASS | |
| Unit | PASS | 1627 件中 1626 PASS / 0 FAIL / 1 SKIP（既存）。新規は変更前の src で 2 件 FAIL |
| Protocol | PASS | 16 / 16 |
| 新規 E2E（変更前の src） | 加入前の 2 件 FAIL（期待どおり） | 「🧰 仮設の作業台(鑑定・強化)」が出て、I キーで鑑定所が開く |
| 新規 E2E（変更後） | 4 / 4 PASS | |
| 前提を移した既存 E2E（8 spec、39 件） | 39 / 39 PASS | |
| E2E 全体（2 CPU） | **233 passed** | |
| GitHub Actions（`b1afaa1`） | 232 passed / 1 failed | `base-class-identity:413`（テストモードの乱数の spec、今回の変更の経路に無い）。PR にコメントし、1 回再実行 |

## Status History
| Date | From → To | By | Note |
| --- | --- | --- | --- |
| 2026-10-04 | （新規）→ PLANNED → IMPLEMENTING | Orchestrator / Analyzer / Planner | Analysis `4ba5a1a`、Plan `68af531`（Agent Approval。仕様は Human Decision、登場タイミングは既存の確定仕様） |
| 2026-10-04 | IMPLEMENTING → TESTING → (Debugger) → TESTING → REVIEWING | Implementer / Tester | 実装 `c90514b`、E2E の歩き方 `8a3b0c7`、文書 `b1afaa1` |
| 2026-10-04 | REVIEWING（Reviewer PASS） | Reviewer | Round 1/3 PASS |
| 2026-10-04 | REVIEWING → DONE | Orchestrator（Completion commit） | PR #32 の本文を更新。Merge required: Human approval |

### Autonomy Metrics（PROGRESSION-004）
- Human Escalation Count: 0（施設の登場タイミングは既存の確定仕様で決まったため）
- Human Decision Count: 1（この Task の起点の Human Decision）
- Auto Fix Count: 2（前提を移した E2E の固定データの欠落（`CHIZOME`）の修正、加入後の鍛冶士への歩き方の修正）
- Reviewer Round Count: 1
- Test Retry Count: 1（GitHub Actions の失敗した job の再実行 1 回。ローカルの調査用の probe は含めない）
- PR Created: Yes (#32。同じブランチの既存 PR の本文を更新。AGENTS.md §21)

