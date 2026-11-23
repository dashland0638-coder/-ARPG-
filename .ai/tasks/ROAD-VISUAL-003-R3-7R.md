# ROAD-VISUAL-003 / R3-7R — 道シナリオのクリア時リセットの確認と固め

Status: REVIEWING

Analysis: .ai/reports/ROAD-VISUAL-003-R3-7R-analysis.md（branch `claude/wanderer-renewal-001-nhlxns` @ `fa251ff384ce10a77a5c5654c48dc79dfb3386b0`、blob `e7119ece6b57b2f619fda1ac9aa4a32d676831c0`）

## Approval
- [x] Approved
- Approval type: Agent Approval（Human 依頼「R3-7 最終必須対応：道シナリオのクリア時リセット」2026-11-23。範囲内の最小変更）
- Escalation Check: None（E-1: 仕様は変えない ―― R3-6 / DEC-028 で決めたリセットの確認と試験の補強だけ。E-6: セーブ形式は変えない）
- Approved by / date / where: Planner (Agent) / 2026-11-23 / branch `claude/wanderer-renewal-001-nhlxns`（`claude/road-visual-003-r3-7` の先端 `cbbece8` から）
- Persistence: 許可（branch: `claude/wanderer-renewal-001-nhlxns`（このセッションの作業ブランチ）。PR の base は `claude/road-visual-003-r3-7`。main へは merge しない。merge は Human）

Implementation: 開始可

## Goal
道シナリオのクリアから再出撃までの状態遷移を安定させ、R3-7 を完了可能な状態にする（Human 依頼の全文が正）。

## Implementation Plan
1. コード: 変更しない（Analyzer: `road2FinishRoad` のリセットは実装済みで、流れも正しい）。調査で不具合が見つかった場合だけ最小の修正
2. unit（`tests/unit/road2-clear-reset.test.js`）: 実物の `road2FinishRoad` を stub 付きで動かし、① 到達 0 ② 最後の酒場の合図 ③ ここでは保存しない ④ 結果画面を出す ⑤ 結果画面が失敗しても酒場へ戻る（到達は 0）を確かめる。`returnToTownNow` がクリアの後に保存し、その後に最後の酒場を出す順序、`road2RecordReach` が結末の場所で到達を戻さないこと、`road2FinishRoad` を呼ぶのが結末だけであることも見る
3. E2E（`tests/road2-clear-reset.spec.js`、本編のセーブで入る。iPhone 844×390）:
   - A: 到達 5・影の旅人の本編セーブ → 道へ出撃（エリア 5 の野営地・夜明けから）→ 高原の大角 → 結末 → 結果画面（到達 0・クリア 1）→ 酒場（最後の酒場）→ **保存されたセーブが到達 0・`scenarioClears.road` 1** → 読み直しても到達 0・第一章クリア（道は出撃先に出ない）
   - B: 到達 3・盗賊（加入前）の本編セーブ → 道へ出撃（谷の野営地・夕暮れから、未加入）→ 撤退で酒場へ → 保存は到達 3 のまま（リセットしない）→ 再出撃でも谷の野営地・夕暮れ・未加入
4. 回帰: 既存の道の E2E（road2-ending / road2-join / road2-finale / road2-daylight / chapter1-tower-to-road）、セーブ（save-load）、影の旅人（wanderer-renewal）、他シナリオ（chapter1-progression ほか）。可能なら全 E2E（CI）
5. 文書: `.ai/tasks/ROAD-VISUAL-003.md` の Work Items 表の R3-7 行を DONE へ（PR #142 / #144、R3-7R）

## Files To Change
`tests/unit/road2-clear-reset.test.js`（新規）、`tests/road2-clear-reset.spec.js`（新規）、`.ai/tasks/ROAD-VISUAL-003.md`（R3-7 行）

## Files Not To Change
ゲームの挙動（`src/`）。調査で不具合が見つかった場合だけ、その箇所を最小に

## Acceptance Criteria
- 道のクリアで到達が 0 になり、酒場へ戻った時の保存に到達 0 とクリアが同時に入る
- 道の途中の撤退・敗北・エリア移動では到達を戻さない。再出撃は到達した野営地と時間帯から
- 他のシナリオ・セーブ形式・影の旅人・時間帯・石環・高原の大角の仕様に変更なし

## Agent Decisions
| # | 決定 | 根拠 | 代替案 |
| --- | --- | --- | --- |
| R7R-1 | コードは変えず、試験で固める | Analyzer（実装済み・流れが正しい）、依頼「既存実装を確認する前に修正しない」「不要な変更をしない」 | クリア時に保存を足す（結果画面で閉じた時に「クリア無し・到達 0」が残る。R3-6 で避けた形） |
| R7R-2 | PR は作業ブランチ → `claude/road-visual-003-r3-7` | 依頼 §6（R3-7 を基準・既存の R3-7 用 PR が無ければ作る・base を変えない）、作業ブランチの割当 | r3-7 へ直接 push（割当外のブランチ） |

## Escalation
None

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-11-23 | Work Item | — → ANALYZING → APPROVED | Orchestrator / Planner | r3-7 先端 `cbbece8`（#145 を含む）を確認。Analyzer report `fa251ff`。H-1〜H-8 確認 |
| 2026-11-23 | Work Item | APPROVED → IMPLEMENTING → TESTING → REVIEWING | Implementer | Plan Handoff（`c243b1f`、blob `749ceb0`）H-1〜H-8 確認。コード変更なし。build / unit 2337 / E2E 38 PASS |

## Implementation Result

### Artifact Handoff
| Kind | Path | Source | Blob SHA | 確認 |
| --- | --- | --- | --- | --- |
| analysis | `.ai/reports/ROAD-VISUAL-003-R3-7R-analysis.md` | `claude/wanderer-renewal-001-nhlxns` @ `fa251ff384ce10a77a5c5654c48dc79dfb3386b0` | `e7119ece6b57b2f619fda1ac9aa4a32d676831c0` | H-1〜H-8 OK |
| plan | `.ai/tasks/ROAD-VISUAL-003-R3-7R.md` | `claude/wanderer-renewal-001-nhlxns` @ `c243b1f8f7325ce32edf090886dca62037501dc9` | `749ceb0cbb63faddf0e25413c29afe14286897c7` | H-1〜H-8 OK |

### Changed Files
| ファイル | 変更 |
| --- | --- |
| `tests/unit/road2-clear-reset.test.js`（新規） | 実物の `road2FinishRoad` / `road2RecordReach` を stub で動かす: 到達 0・最後の酒場の合図・結果画面はリセットの後・ここでは保存しない・結果画面の失敗でも到達 0 で酒場へ・保存の順序（クリアを数える → 酒場で保存 → 最後の酒場）・到達を 0 に書くのは新しい冒険/テストモード開始/道のクリアの 3 か所だけ・結末の場所で到達が戻らない |
| `tests/road2-clear-reset.spec.js`（新規） | 本編のセーブで A（到達 5 → クリア → 保存は到達 0・クリア 1 → 読み直しても到達 0・第一章クリア・道は出撃先に出ない）と B（到達 3 → 撤退 → 保存は到達 3 のまま → 再出撃で谷の野営地・夕暮れ・加入前） |
| `.ai/tasks/ROAD-VISUAL-003.md` | Work Items 表の R3-7 行を DONE へ（実態に合わせる） |
| `src/` | **変更なし**（クリア時のリセットは R3-6 で実装済み・流れが正しいことを確認） |

### Test Report
- Scope: Targeted（ローカル）+ 全 E2E は CI
- Executed: `npm run build`、`npm run test:unit`（2337。AI プロトコルの試験 `tests/unit/ai-protocol.test.js` を含む）、E2E: road2-clear-reset（2）/ road2-ending / road2-join / road2-finale / road2-daylight / chapter1-tower-to-road / save-load / wanderer-renewal / chapter1-progression / chapter1-late-scenarios（計 38）

| テスト | 結果 |
| --- | --- |
| build | PASS |
| unit（2337） | PASS |
| E2E 38 件 | PASS |
| 全 E2E | CI（PR に記載） |

### Acceptance Criteria
| AC | 確認 |
| --- | --- |
| 道のクリアで到達 0、酒場へ戻った時の保存に到達 0 とクリアが同時に入る | VERIFIED（spec A、unit） |
| 途中の撤退・エリア移動では戻さない。再出撃は到達した野営地・時間帯から | VERIFIED（spec B、unit の 0 を書く箇所の検査、road2-join の到達の記録） |
| 他シナリオ・セーブ形式・影の旅人・時間帯・石環・高原の大角に変更なし | VERIFIED（`src/` 変更なし、回帰 E2E） |
