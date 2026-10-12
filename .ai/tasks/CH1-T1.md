# CH1-T1 — 本編の会話から、第一章に無い機能の案内を除く

Status: REVIEWING

- 監査: `.ai/reports/CHAPTER-1-completion-audit.md` P1-2
- 計画: `.ai/reports/CHAPTER-1-completion-plan.md` CH1-T1
- ブランチ: `claude/ch1-t1-smith-guide-line`（`origin/main` `2089a88` から）

## Human Approval
- [x] Approved
- Approved by / date / where: Human / 2026-10-12 / 本セッションの会話（「SHADOW_GUIDE_INTRO の鍛冶士に関する案内を、次の文言に変更することを承認します。『奥にいるのが鍛冶士。装備のことは、そちらで。』」）
- Scope of approval: 本編の隅の人物の初回会話のうち鍛冶士を案内する 1 行の差し替え、その分岐を通る E2E の追加。テストモードの既存の文言は維持する
- Persistence: 許可（branch `claude/ch1-t1-smith-guide-line`）。PR を作成して停止する。`main` への merge は Human

## Analyzer
- **FACT**: 鍛冶士の加入後（`state.smithJoined`）に、隅の人物へ初めて話しかけると、初回会話（`12-progression-ui.js` の `SHADOW_GUIDE_FIRST_MEET`）に「奥にいるのが鍛冶士。装備の鑑定や強化は、そちらで頼めます。」が出る。
  - 第一章の鍛冶屋は装備の管理だけで、鑑定・強化は無い（HD-2）。
- **再現**: 修正前のコードで、追加した E2E が上の行を受け取って FAIL した（下記 Test）。
- **名前の訂正**: 監査・計画・承認の指示では `SHADOW_GUIDE_INTRO` と書いたが、実際の定数名は `SHADOW_GUIDE_FIRST_MEET`。指している行は同じ。
- **同じ種類の文の点検**: 本編で「鑑定」「強化」「スフィア」「商店」「購入」「経験値」「レベル」を含む台詞・トースト・ログを grep した。
  - この 1 行のほかは、すべて `legacyGrowth()` かテストモードの経路の中にあった。
  - 該当したのは、仮設の作業台、Skill 3、3 択報酬、鑑定所のボタン、スフィア盤。
- **テストモードの分岐**: `legacyGrowth()` が true になるのはテストモード（訓練場のワールド）だけ。
  - 訓練場には隅の人物がいないので、テストモードでこの会話は実際には出ない。
  - 指示どおり、文言は分岐として残した。

## Planner
- **Files To Change**:
  - `src/legacy/parts/12-progression-ui.js`（1 行を `legacyGrowth()` で分岐）
  - `tests/shadow-guide.spec.js`（1 件追加）
  - `.ai/tasks/CH1-T1.md`
- **Files Not To Change**:
  - `basefile.html`、セーブ、他の台詞、話者名、鍛冶屋の機能
  - `SHADOW_GUIDE_FIRST_MEET` の他の行と、加入前の分岐
- **Acceptance Criteria**:
  1. 鍛冶士の加入後の本編のセーブで、初回会話に「鑑定」「強化」が出ない。
  2. 承認された文言が出る。
  3. テストモードの文言は従来のまま。
  4. 既存 E2E・unit が通る。

## Implementation
- `12-progression-ui.js`: `state.smithJoined` の行を、`legacyGrowth()` なら従来の文、本編なら「奥にいるのが鍛冶士。装備のことは、そちらで。」にした。
- `tests/shadow-guide.spec.js`: 次の条件のセーブで、隅の人物に初めて話しかける E2E を追加。
  - 条件: 洋館クリア済み、魔法使い＋剣士、`smithJoined:true`、`shadowGuideMet:false`。
  - 確かめること:
    - 加入後の分岐の行（承認の文言）が出る。
    - 全行に「鑑定」「強化」が無い。
    - 「影の旅人」が出ない。

## Test
| 確認 | 結果 |
| --- | --- |
| `npm run build` | PASS |
| `npm run test:unit` | 1782 PASS / 0 FAIL / 1 SKIP（既存） |
| 追加した E2E（修正前のコード） | **FAIL**（期待どおり）。受け取った行に「奥にいるのが鍛冶士。装備の鑑定や強化は、そちらで頼めます。」があり、監査 P1-2 を再現 |
| 追加した E2E（修正後） | PASS |
| 関連 E2E（`shadow-guide`・`tavern-smith-greeting`・`chapter1-facility-access`・`chapter1-smith-shop`・`chapter1-legacy-ui`） | **13 passed**（ローカル、2 CPU） |
| CI（GitHub Actions の全体） | PR で実行 |

固定の待ち時間について: 追加した E2E の待ちは、既存の 1 件目と同じ短い間隔（会話送りの 150ms、歩きの 300ms）だけ。判定は表示（`toHaveClass` / `toHaveText`）を待つ形にした。

## Reviewer
（Reviewer の結果で更新）

## Status History
| Date | From → To | By | Note |
| --- | --- | --- | --- |
| 2026-10-12 | （新規）→ REVIEWING | Orchestrator / Analyzer / Planner / Implementer | Human 承認の文言で実装 |
