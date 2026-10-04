# PROGRESSION-004 Analyzer report（第一章序盤の施設アクセス）

| 項目 | 値 |
| --- | --- |
| Task ID | PROGRESSION-004 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| 基準 SHA | `878df1a`（PROGRESSION-003 完了） |
| Persisted by | Agent（Orchestrator。AGENTS.md §5.2） |
| 日付 | 2026-10-04 |
| Human Decision（2026-10-04） | 剣士のみが登場している段階では、鍛冶師は酒場に登場していない・鍛冶設備も存在しない・鑑定／装備変更／スキル変更などの施設機能にはアクセスできない・仮設の作業台などから施設画面へ到達できない。「施設は存在するがボタンだけ無効」にはしない |

## 1. 施設の登場タイミング（既存仕様）

| 出典 | 記述 |
| --- | --- |
| docs/SCENARIOS.md「Chapter 1-①: 囚われの洋館」（確定） | 体験の骨格の最後が「酒場へ帰還 → **鍛冶屋が加入**」 |
| docs/SCENARIOS.md「Tavern」（確定） | 酒場はシナリオ進行に伴って人や施設が増える。序盤のシナリオをクリアすると、救出した人物などが酒場へ加わる。常駐 NPC: 鍛冶士（**洋館クリア後**） |
| コード | `state.smithJoined`。洋館のボスを倒すと立つ（`12-progression-ui.js` の撃破処理、`scKey === 'mansion'`）。セーブ対象（`09-save-load.js`）。新規開始は false |
| docs/SCENARIOS.md「Tavern」の表（**実装事実**） | 「（なし） 仮設の作業台＋道具4本＋木箱。鑑定・強化は最初から使える」 ← 今回の Human Decision で置き換わる |

→ **施設が現れる = 鍛冶士が酒場に加わる = `smithJoined`（洋館クリア）**。既存の確定仕様で決まっている。新しいタイミングは作らない。剣士だけの段階（洋館をクリアする前）は `smithJoined` が false で、洋館クリア後は主人公が魔法使いに交代する（`CHAPTER_CAST`）ので、「剣士のみの段階」と「鍛冶士の加入前」は一致する。

## 2. 施設への入口（FACT）

| # | 入口 | 場所 | 現在の条件（本編） |
| --- | --- | --- | --- |
| E-1 | 酒場の鍛冶士の位置（`SMITH_POS`）。加入前は「仮設の作業台」 | `updateBartenderProximity`（`nearbySmith`）→ interact → `toggleAppraisal` | 距離 3m だけ。`smithJoined` を見ない |
| E-2 | `KeyI` / パッドの十字キー下 → `toggleAppraisal` | `09-save-load.js`・`13-update-loop.js` | 酒場で `SMITH_POS` から 3m 以内（`smithJoined` を見ない） |
| E-3 | ダンジョンのチェックポイント（洋館の大広間、`registerCheckpoint` は洋館だけ） | `useCheckpoint` → `setOverlay('appraisal')`（回復の後に直接開く） | 条件なし。洋館は剣士だけの段階なので、本編ではここが剣士の施設になっている |
| E-4 | テストモードの Arena「ロードアウト」ボタン、テストモードの `KeyI` | `14-training-ground.js`、`toggleAppraisal` | テストモードだけ（今回は変えない） |

仮設の作業台の見た目（台・道具・木箱）は `buildTavern`（`03-dungeons-mansion-temple.js`）が `!state.smithJoined` のときに建てる。

## 3. 施設を指す文言（FACT）

| 場所 | 文言 |
| --- | --- |
| インタラクトの表示（`02-world-common.js`） | 加入前「🧰 仮設の作業台(鑑定・強化)」、加入後「🔨 鍛冶士と話す(鑑定・強化)」 |
| チェックポイントの表示 | 「🏕️ 休憩する(回復+装備整理)」、使った後「🏕️ 休憩ポイント(装備を整える)」 |
| 影の旅人の初対面の会話（`SHADOW_GUIDE_FIRST_MEET`） | 加入前「奥の隅に、間に合わせの作業台があります。鑑定や研ぎは、あそこで自分で。」 |
| メニューの操作説明（`index.html`） | 「鑑定所(鍛冶士／仮設の作業台の前で): I / 十字キー下 / …」 |

## 4. 根本原因

施設に入る条件が「場所（`SMITH_POS` の 3m・チェックポイント）」だけで、「施設が酒場に現れているか（鍛冶士の加入）」を見ていない。加入前も同じ場所に仮設の作業台を建て、同じ入口へ繋いである（WORK 期の設計: 「鑑定・強化は序盤から必要な機能」）。今回の Human Decision と食い違う。

## 5. 旧セーブ

- 関係する値: `smithJoined`・`smithGreeted`・`smithToolsRecovered`（`smithJoined` から導く）。セーブの値は変えない
- 剣士だけの段階の旧セーブ（`smithJoined: false`）は、今回の判定で施設に入れなくなる（Human Decision どおり）。値はそのまま
- `smithJoined` は `scenarioClears` と同じ commit から存在し（このリポジトリの履歴の最初）、洋館クリアで必ず立つ。洋館をクリアしたのに `smithJoined` が無いセーブは、通常のプレイでは作られない（それ以前の版のセーブは確認できない → Known Limitation）

## 6. テストモード

`toggleAppraisal` はテストモードならどこでも開ける。テストモードの開始時は `smithJoined = false`（`14-hud-boot.js`）。テストモードの施設は今回の判定の対象外にする（開発用。既存の E2E が Arena・`KeyI` から開いている）。

## 7. 方針（Planner への入力）

- 施設が使えるかの判定を 1 か所（core の純粋関数）に置く: テストモード、または鍛冶士が加入済み（`smithJoined`）
- 入口 E-1〜E-3 と、仮設の作業台の建設・それを指す文言が、この判定を使う
- 本編の加入前は、作業台を建てない・インタラクトを出さない・`KeyI` で開かない・チェックポイントは回復だけ（装備を整える入口にならない）
- 文言: 存在しない作業台を指す行は出さない／書き換えない範囲で外す。新しい台詞は書かない
- 既存 E2E のうち、本編の加入前に鑑定所を開いていたもの（`chapter1-skill2`・`mansion-escort` D-04・`chapter1-legacy-ui` 旧セーブ・`character-weapon-visual` 剣士 / 影の旅人）は、検証の中身を変えずに、施設が使える状態（加入後のセーブ・テストモード）へ移す
