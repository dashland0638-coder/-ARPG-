# TEST-CHAPTER-SELECT-001 — テスト用チャプター／シナリオセレクター

Status: TESTING

Analysis: `.ai/reports/TEST-CHAPTER-SELECT-001-analysis.md`

## Approval
- [x] Approved
- Approval type: Agent Approval（`../AGENTS.md` §6.1）
- Escalation Check: None（ゲームの数値・本編の進行・セーブの形式は変えない。変更はテストモード（`?dev=1`）の中と、通常セーブへの書き込みの門番だけ）
- Approved by / date: Planner (Agent) / 2026-10-21
- Persistence: branch `claude/test-chapter-select-001`

## Goal（Human、2026-10-21）

テスト時にチャプター・シナリオを直接選んで始められるようにする。第一章の戦闘の検証が主な用途。将来のチャプターの追加に対応できる構造。iPhone の画面で操作できること。通常プレイと通常セーブを壊さないことが最優先。

## 方針

既存の Scenario Test Mode（WORK 1 / WORK 4。`beginTestMode` → 本編と同じ `launchScenario` → 開始地点へ位置だけ運ぶ）を土台にし、別の開始経路は作らない（Rule 0）。

1. `src/core/test-scenario-select.js`（新規）: チャプターの表（id と表示名を分ける）、チャプターごとのシナリオ（表示名は `SCENARIO_DEFS` の name）、開始地点の一覧と種類、開始の可否の判定、通常セーブへの書き込みの可否
2. `src/core/scenario-waypoints.js`: ボス戦直前（`kind:'boss-pre'`）・ボス戦開始（`kind:'boss-start'`）の地点を足す。上の階は `y`
3. `beginTestMode`: core の判定を通った組み合わせだけ始める。`teleportTestModeTo`: y と落下の時計を階段と同じく置き直す
4. セーブ: `saveGame` / `deleteSaveGame` の門番、`returnToTitle` でテストモードを終える、メニューの文言
5. UI: チャプターの欄、開始地点の種類の印、選択の要約、開始・戻るを画面の下に留める
