# CH1-EXP — Chapter 1 Experience Redesign（第一章の体験品質）

Status: PLANNED

Analysis: .ai/reports/CHAPTER-1-experience-audit.md（branch `claude/chapter1-experience-audit`、base `origin/main` `7020e4d`）
Plan: .ai/reports/CHAPTER-1-experience-plan.md（Work Item ごとの Goal / Scope / Out of Scope / Acceptance / Test Plan / Dependencies）

## Goal

第一章を、イベントを順番に進めるだけの構成から、キャラクターの感情・会話・移動・景色の変化が自然につながる体験へ改善する（Human の依頼「CHAPTER 1 EXPERIENCE REDESIGN」、2026-10-13）。

- 初期フェーズ（このブランチ）は、調査と計画と Task 草案だけ。実装は Work Item ごとに別ブランチ・別 PR で行う。

## Constraints

- 第一章に無い要素を足さない。
  - Level / XP / スフィア / パッシブ / Skill 3 / フルクラフト / 鑑定 / 強化
- 次を承認なしに変えない。
  - 主人公の交代順
  - 進行の条件
  - セーブの形式
  - 敵・ボスの数値
- 旧セーブを壊さない。テストモードだけの機能を本編に出さない。
- `basefile.html` を変えない。legacy の連結構成を ES Module にしない。
- UI は承認済みの方向性（中世ファンタジー × トゥーン × マット × シンプル）を保つ。
- 完成の判定は E2E の PASS に加えて、Human の iPhone 実機の通しプレイ（CQ-01）。

## Work Items

| ID | Summary | 要件 | 優先度 | Status | Approval | 依存 |
| --- | --- | --- | --- | --- | --- | --- |
| X-1 | 分離の台詞を「消えた……？」に | A | P1 | PLANNED | [ ] | ― |
| X-2 | 宵待ちの村の演出テンポ（無言の間を詰め、見せ場は残す） | C | P1 | PLANNED | [ ] | X-4（推奨） |
| X-3 | 非戦闘の歩行の腕振り・胴の動き | E | P1 | PLANNED | [ ] | ― |
| X-4 | 演出中も主人公の待機・歩行のアニメーションを止めない | C・E | P1 | PLANNED | [ ] | X-3 |
| X-5 | 帰還 → 帰還の会話 → 次の主人公の登場 → 交代の会話 → 切り替え | B | P2 | WAITING_APPROVAL | [ ] | EX-1、E2E は古い監査の E-8 |
| X-6a | 村の光の色の段差をなくす（補間） | D | P2 | PLANNED | [ ] | ― |
| X-6b | 村の時間帯を何で決めるか（行き来で巻き戻らない） | D | P2〜P3 | WAITING_APPROVAL | [ ] | EX-2、X-6a |
| X-7 | 最初のマップ改修の詳細計画 | F | P3 | WAITING_APPROVAL | [ ] | EX-3、CH1-T0、X-2、X-6 |

各 Work Item の計画は `CHAPTER-1-experience-plan.md` §2。Status と Approval の正本はこの表。

### X-1 Approval
- [ ] Approved
- Approval type: Agent Approval（文言は Human が依頼で指定）
- Escalation Check: None
- Approved by / date / where:
- Scope of approval: 計画 §2 X-1 の Files（`03-dungeons-mansion-temple.js` の台詞 1 行とコメント、`MANSION_SCENARIO.md`、`docs/CHAPTER1_PLAYTEST.md` B-12、unit 1 件）
- Persistence:

Implementation (X-1): BLOCKED until approval（初期フェーズは実装しない）

### X-2 Approval
- [ ] Approved
- Approval type: Agent Approval
- Escalation Check: None（イベントの数・場所・台詞・条件・順序は変えない。記憶のイベントを止めない形に変える案は Out of Scope）
- Approved by / date / where:
- Scope of approval: 計画 §2 X-2
- Persistence:

Implementation (X-2): BLOCKED until approval

### X-3 Approval
- [ ] Approved
- Approval type: Agent Approval（CHARACTER-VIS-001 D-3「非戦闘は歩き寄りの姿勢・腕振り」の範囲。脚・歩調・速度は据え置き）
- Escalation Check: None
- Approved by / date / where:
- Scope of approval: 計画 §2 X-3
- Persistence:

Implementation (X-3): BLOCKED until approval

### X-4 Approval
- [ ] Approved
- Approval type: Agent Approval
- Escalation Check: None
- Approved by / date / where:
- Scope of approval: 計画 §2 X-4
- Persistence:

Implementation (X-4): BLOCKED until approval

### X-5 Approval
- [ ] Approved
- Approval type: Human Approval（EX-1）
- Escalation Check: EX-1（## Escalation 参照）
- Approved by / date / where:
- Scope of approval:
- Persistence:

Implementation (X-5): BLOCKED until approval

### X-6a Approval
- [ ] Approved
- Approval type: Agent Approval
- Escalation Check: None（帯の端点の色は変えない。演出の意図は変えない）
- Approved by / date / where:
- Scope of approval: 計画 §2 X-6a
- Persistence:

Implementation (X-6a): BLOCKED until approval

### X-6b Approval
- [ ] Approved
- Approval type: Human Approval（EX-2）
- Escalation Check: EX-2
- Approved by / date / where:
- Scope of approval:
- Persistence:

Implementation (X-6b): BLOCKED until approval

### X-7 Approval
- [ ] Approved
- Approval type: Human Approval（EX-3）
- Escalation Check: EX-3
- Approved by / date / where:
- Scope of approval:
- Persistence:

Implementation (X-7): BLOCKED until approval

## Current Implementation

監査 §2〜§7 を参照。要点（FACT）は次のとおり。

- **A**: 分離の台詞は「……鍛冶屋?」の 1 行（`03-dungeons-mansion-temple.js:3143`）。
- **C**:
  - 記憶の演出は、声の後で会話欄を消し、0.8〜1.2 秒の無言の間を置いてから二人が話す。
  - 前置きを 0.8 秒に詰める処理が、見せ場の演出まで詰める（`02-world-common.js:1282-1295`）。
  - 演出中は `updatePlayer` が回らず、主人公の姿勢が固まる（`14-hud-boot.js:1388`）。
- **E**:
  - 非戦闘の腕振りは、計算で約 ±7°（`13-update-loop.js:1157`・`:1222`、`core/relaxed-idle.js:178`）。
  - 休めの姿勢の肘は、前へ 14〜24° 曲がっている（`05-rendering-rig.js:2471`）。
- **B**:
  - 交代は暗転中の `returnToTownNow()` で済む（`12-progression-ui.js:1362`）。
  - 帰ってきた主人公の場面は無い。洋館の後の鍛冶士との再会は、交代で止めてある。
- **D**:
  - 時間帯はプレイヤーの z だけで決まる（`14-dungeon-duskvillage.js:1631`）。
  - 光の色は帯の中間点で跳ぶ（`:1647-1653`）。

## Agent Decisions

| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |
| 1 | A は分離の演出の台詞（`:3143`）を差し替える。再会の場面の台詞は変えない | 依頼の場面名「逸れた場面」と指定の文言、依頼の「他の台詞は一括変更しない」 | 再会の鍛冶士の行も直す（依頼の範囲外） |
| 2 | C は無言の間と前置きの詰め方だけを直し、記憶のイベントを「止めない演出」へは変えない | 依頼「全イベントを一律に高速化しない／必要な間は残す」、DEC-001（村の体験の設計） | 記憶をログだけの形に（体験の設計が変わる → Human） |
| 3 | 演出中に主人公が固まる問題を、C・E の共通の原因として別の Work Item（X-4）に分ける | 監査 §3.1。全シナリオの演出に効くので、村だけの X-2 に混ぜない | X-2 に含める（範囲が村の外へ広がる） |
| 4 | D は「光の色の段差」（意図を変えない）と「時間帯の決め方」（意図が変わる）に分ける | 依頼「物語の演出意図を変える判断が必要なら Human」 | 1 つの Work Item で Human 判断を待つ（段差の修正まで止まる） |
| 5 | Escalation の番号は EX- とする | 未 merge の古い監査（`claude/chapter1-completion-audit`）が E-1〜E-8 を使っている | E-9 以降に続ける（ブランチをまたいで番号が衝突しうる） |
| 6 | 古い監査の判断待ち（E-3 / E-5 / E-8）は、依存として書くだけで再び質問しない | §17.3「1 回の Escalation にまとめる」・§18 | 再質問 |

## Escalation

`CHAPTER-1-experience-plan.md` §3 に §17.4 の形式で全文がある。要旨:

- **EX-1**（X-5）: 帰還と交代の一幕の流れと台詞。
  - 推奨: A（帰還 → 登場 → 交代 → 会話の後で切り替え）。会話案は計画 §2 X-5。
  - 交代で支援から外れた元主人公は (1) 姿を出さない。
- **EX-2**（X-6b）: 村の日没の表現。推奨: A（物語の進行で暮れる。巻き戻らない）。
- **EX-3**（X-7）: 最初に改修するマップ。推奨: A（宵待ちの村）。

## Autonomy Metrics
（完了処理で記入。推測で埋めない）
- Human Escalation Count:
- Human Decision Count:
- Auto Fix Count:
- Reviewer Round Count:
- Test Retry Count:
- PR Created:

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-10-13 | Task | （新規）→ PLANNED | Orchestrator / Analyzer / Planner | 監査と計画を作成。X-1〜X-4・X-6a は PLANNED（Agent Approval で着手できる）、X-5・X-6b・X-7 は EX-1〜EX-3 の回答待ち |
