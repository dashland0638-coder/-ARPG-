# TEST-CHAPTER-SELECT-001 — テスト用チャプター／シナリオセレクター

Status: DONE（PR 作成済み。main への merge は Human の判断）

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

## Implementation Result（2026-10-21）

### 選べるもの

| チャプター（id） | シナリオ（key） | 開始地点 |
| --- | --- | --- |
| 第一章（`ch1`） | 囚われの洋館（`mansion`） | シナリオ開始 / ボス戦直前（当主の間の前室）/ ボス戦開始（当主の間） |
| | 宵待ちの村（`duskvillage`） | シナリオ開始 / ボス戦直前（水鏡の跡の手前）/ ボス戦開始（水鏡の跡）/ 途中の 9 地点 |
| | 幽霊船（`ghostship`） | シナリオ開始 / ボス戦直前（船倉の扉の前） |
| | 狂いの時計塔（`clocktower`） | シナリオ開始 / ボス戦直前（最上階の控えの間、y:36） |
| | 道（`road`） | シナリオ開始 / 途中の 3 地点（ボスはいない） |
| 章外のシナリオ（`extra`） | 古代神殿・埠頭の地下水路・硝子の温室 | シナリオ開始 / ボス戦直前 |

選べないもの: 砂漠のピラミッド・業火の火山（`unlocked:false`、ワールドが無い）。ボス戦開始は扉の無いボス（洋館・宵待ちの村）だけ。ボス戦の途中（HP や段階を進めた状態）からは始めない。

### セーブの保護

- `saveGame` は `canWriteNormalSave(state)`（テストモードでない・始まっている・職業がある）の時だけ書く。`deleteSaveGame` は `canDeleteNormalSave`（テストモードでない）の時だけ消す（core/test-scenario-select.js）
- テストモードはタイトルへ戻ったところで終わる（`returnToTitle` が `state.testMode = false`）。`started` も false なので、タイトルの間はどの経路でも書かない
- テストで変えた状態は「つづきから」（`applySaveData`）がセーブの値で全部置き直し、「はじめる」（`beginGame`）が初期化する
- メニューの「セーブ」はテストモードでは「テストモード中は通常のセーブに書き込みません」、「タイトルへ戻る」の確認文は「通常のセーブは変更されません」

### 変更ファイル

`src/core/test-scenario-select.js`（新規）、`src/core/scenario-waypoints.js`、`src/legacy/concat-plugin.js`（import）、`src/legacy/parts/01-character-creation.js`、`09-save-load.js`、`10-input.js`、`14-hud-boot.js`、`index.html`、`src/styles/main.css`、`tests/unit/test-scenario-select.test.js`（新規）、`tests/chapter-select-testmode.spec.js`（新規）、`tests/helpers.js`（シナリオのあるチャプターを選ぶ）、`tests/scenario-test-mode.spec.js`（仕様の変更に合わせた assert の更新。より厳しくした）。`basefile.html`・legacy の連結構成・セーブの形式は変えていない。

## Test Report（2026-10-21）

| 項目 | 結果 |
| --- | --- |
| `npm run build` | 成功 |
| `npm run test:unit` | 1939 pass / 0 fail（1 skip は既存） |
| E2E `chapter-select-testmode`（新規 7 本）＋ 回帰（`scenario-test-mode`・`dev-ui-gate`・`guest-companion`・`chapter1-dusk-basics`・`dusk-boss-phase-burst`・`dusk-fisher-telegraph`・`save-load`・`chapter1-progression`・`production-build`・`combat-test-arena`・`notifications`） | 48 passed |
| PR の CI（E2E 全件） | PR 作成後 |

E2E の注記: 幽霊船の船倉のような重い場所では、ヘッドレス（SwiftShader）の 1 フレームが数秒かかり、Playwright の実入力が描画待ちで打ち切られた（実測）。新規 spec の「会話を送る・メニューを開く」は同じ要素に同じイベントをページの中から送っている。タッチ操作そのものは iPhone の横画面のテストで `page.tap` を使って確かめている。

途中の失敗（記録）: 実行中にソースを編集して開発サーバーが再読み込みし、HUD が消えた 1 件（編集を止めて再実行で成功）。

## Reviewer

Round 1 CHANGES_REQUIRED（R1: `scenario-test-mode.spec.js` の洋館の地点の数 0 が新しい仕様と合わない）→ Round 2 **PASS**。

## Remaining Risks

- unit の `SCENARIO_DEFS` の写しは手で持っている（legacy を import できないため）。`SCENARIO_DEFS` を変えた時にずれうる
- ボス戦直前・開始は位置だけを運ぶ。洋館のボス戦開始は、本編の階段の `routeEnter('boss')`（HUD のルートの表示）を通らない
- 宵待ちの村のボス戦直前では、本編どおり村の奥の会話が始まる。地下水路では本編どおり 5 秒後に寒さの会話が出る
- 硝子の温室のボス戦直前は通路なので、地図の部屋の名前は直前の部屋（硝子の正門）のまま（本編の通路と同じ表示）
- テストモードは章の進行のセリフではなく旧来のセリフを使う（`legacyGrowth()`。今回の変更の前から）

## iPhone で確かめること（HUMAN DEVICE CHECK REQUIRED）

1. タイトル（`?dev=1`）→ テストモード → チャプター → シナリオ → 開始地点を、指で迷わず選べるか
2. 開始・戻るのボタンが、横画面で隠れずに押せるか
3. 各ボス戦直前から、扉を開けて／近づいてボス戦に入れるか（洋館・村・幽霊船・時計塔）
4. テストの後にタイトルへ戻り、「つづきから」で元のセーブが続くか

### Autonomy Metrics

Human Escalation: 0 / Human Decision: 0 / Auto Fix: 2（E2E の修正 1、Review Fix 1）/ Reviewer Rounds: 2 / Test Retry: 1
