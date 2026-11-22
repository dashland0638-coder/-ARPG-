# WALK-TALK-CH1 — 第一章・移動中会話システムの横展開

Status: PR_OPEN（独立 Reviewer の後。main へは Human の明示の承認なしにマージしない）

Analysis: 本ファイルの「## Current Implementation」（branch `claude/walk-talk-ch1`、base `claude/road-visual-003-r3-7` = PR #142）

## Approval
- [x] Approved
- Approval type: Agent Approval（Human の依頼の範囲の中の Work Item 分割と実装仕様）
- Escalation Check: None（重大な設計上の問題は見つからなかった。DEC-029 が想定していた「二つ目のシナリオで共通化」の形で収まる）
- Approved by / date / where: Planner (Agent) / 2026-11-22 / `claude/walk-talk-ch1`
- Scope of approval: 下の Work Items
- Persistence: 許可（branch: `claude/walk-talk-ch1`、根拠: Human の依頼「WI：第一章・移動中会話システムの横展開」2026-11-22）

## Goal
「道 — その先へ」で完成させた移動中会話システムを第一章の他シナリオへ横展開し、探索中にキャラクターの個性・関係性・物語の進展が感じられる状態にする。マップ・敵・音・キャラクターデザインは別作業。

## Current Implementation（Analyzer）
| 項目 | 事実 |
| --- | --- |
| 道の仕組み | 流し方 `src/core/road-banter.js`（一行 2.8 秒・行の間 0.35 秒・話題は出撃中 1 回・止めている間は進めない）。話題 `ROAD2_BANTER`（場所の帯 `registerProximityEvent` の onEnter で積む）と、出来事の後の話題（R2-04・R3-05 など）。条件は本編のルールだけ（`!legacyGrowth()`） |
| 止める条件 | 会話の窓・演出・一時停止・戦闘の緊張 `combatIntensity >= 0.35`。止めた所から続きを流す。会話の窓の更新（14-hud-boot の会話中の分岐）では掛け合いを更新しないので、前の行が画面に残っていた |
| 加入・同行 | 道は一行全員が歩くので、加入前後で話す人を変えている（`road2Joined`）。他のシナリオは主人公＋支援一人（`selectedClass` / `state.guestClassKey` / `guestCompanion`）。宵待ちの村の剣士だけ木橋で合流（`guestCompanion.waitAt`） |
| 保存 | 話題の済みは保存しない（出撃のたびに作り直す）。道の到達 `roadArea` だけ保存 |
| 他シナリオ | 宵待ちの村・幽霊船・時計塔は会話の窓の出来事が多い（帯・済みの印を調べ、重ならない場所を選んだ）。時計塔は階が積み重なるので帯に高さが要る（`area.y0/y1`）。幽霊船は段階 `gsFlags.phase` で同じ場所の意味が変わる |
| 対象外 | 洋館（剣士ひとり）、水路・神殿・温室（第一章の本編の外）。DEC-033 |

## Work Items
| # | 内容 | 状態 |
| --- | --- | --- |
| W1 | 共通化: `road-banter.js` → `walk-talk.js`（止める理由・顔ぶれ・もう一度出た時の台詞・古い話題を捨てる）、表示・止める条件・帯の登録 `14-walk-talk.js`。道は表示と止める条件だけ共通のものへ | DONE |
| W2 | 宵待ちの村の話題 D-1〜D-6 | DONE |
| W3 | 幽霊船の話題 G-1〜G-6 | DONE |
| W4 | 時計塔の話題 T-1〜T-4（`towerStoppedSeen` を足す） | DONE |
| W5 | 単体試験 `tests/unit/walk-talk.test.js`、E2E `tests/walk-talk-ch1.spec.js`、道の掛け合いの試験の id の付け替え | DONE |
| W6 | 文書: DEC-033・`docs/WALK_TALK.md`・本ファイル。§8 の残件の登録 | DONE |

## Agent Decisions
| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |
| 1 | シナリオごとの個別実装は持たず、データ（`walk-talk-ch1.js`）と条件の名前（`WALK_TALK_WHEN`）だけをシナリオごとにする | WALK_TALK W-4 | シナリオのファイルに帯を書く（ばらつく） |
| 2 | 会話の窓・演出で 3 秒より長く止まった話題は捨てる（横展開だけ。道は従来どおり） | 依頼「中断・終了処理を適切に」、DEC-029「道の動きは変えない」 | 全部続きから（重要な出来事の後に前の話が続く） |
| 3 | 再訪問は「同じ出撃先へもう一度出た時」とし、遊んでいる間だけ数える | 依頼「不要な保存項目を追加しない」、第一章は再訪なし（SCENARIOS） | 保存に回数を足す（互換の影響が出る） |
| 4 | 状態の変数は `var`（起動の途中の最初の酒場の buildWorld がこのファイルより先に呼ぶため） | 連結の順（concat-plugin） | ファイルを前に置く（前のファイルのコメントの中に入ってしまう） |

## Escalation
None

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-11-22 | Task | — → IMPLEMENTING | Agent | Human の依頼 |
