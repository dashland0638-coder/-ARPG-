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
  - 時間帯はプレイヤーの z だけで決まる（`14-dungeon-duskvillage.js:1633`）。
  - 光の色は帯の中間点で跳ぶ（`:1651-1657`）。

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

`../AGENTS.md` §17.4 の形式。計画 `CHAPTER-1-experience-plan.md` §3 と同じ内容。

### Escalation EX-1: 帰還と交代の一幕の流れと台詞

- Trigger: E-1（`docs/CHAPTER1_STORY.md` §4 の場面の順番と、交代の一幕の台詞を変える）、E-9（各キャラクターの会話内容は Human が決めると依頼にある）。
- Facts:
  - 交代は暗転中に済み、帰ってきた主人公の場面は無い（監査 §5.1）。
  - 洋館の後の鍛冶士との再会は、交代で止めてある（WORK 12.1）。
  - 村 → 幽霊船で話す剣士は、酒場に姿が無い。
  - 一方、`docs/CHAPTER1_STORY.md` §4-1 は剣士を「酒場に残る」と書いている。道を終えた後の酒場では、剣士・魔法使い・弓師が隅の卓に立つ（`buildChapter1TavernTrace`）。
- Why Agent cannot decide: 物語の場面を足し、既存の台詞の位置を動かす。依頼が会話内容を Human の判断事項にしている。
- Options:
  - **A（推奨）**: 計画 §2 X-5 の流れ（帰還 → 登場 → 交代 → 切り替え）と会話案。
    - 新規の台詞は 4 行（村の後 2 行・幽霊船の後 2 行）。既存の行は 1 か所だけ直す（盗賊の登場の前の、主人の 1 行）。
    - 影響: 交代が物語としてつながる。帰還ごとに 1〜3 行増える。`returnToTownNow` と交代の順番待ちに手が入る。
  - B: 今の順番（暗転中に交代）のまま、交代の会話の前に帰還の 1〜2 行だけ足す。
    - 影響: 変更は小さいが、操作キャラクターが会話の前に変わる唐突さは残る（要件 6 を満たさない）。
  - C: 今のまま。
- 追加の判断（A のとき）: 交代で支援から外れた元主人公の扱い。
  - (1) 姿を出さない（今と同じ）。
  - (2) 推奨: 交代の後も酒場に姿を置く（`buildCastFigure`。会話は無し）。
    - 隅の人物の卓とは別の卓に置く。
    - 村の後は剣士、幽霊船の後は剣士と魔法使い、と酒場に人が増えていく。
    - 道を終えた後に隅の卓へ集まる既存の演出へ、そのままつながる。
- Recommendation: A と (2)。
  - (2) は物語の文書（剣士は「酒場に残る」）に字義どおり合う。
  - 交代の会話で話す剣士が、その後も酒場にいる形になる。
  - 依頼の 6 項目（帰還 → 会話 → 登場 → 理由 → 会話の後で切り替え）をすべて満たす。
  - 既存の台詞をほぼ生かせる。
  - 新しい設定は「主人が帰還を迎える一言」と「帰ってきた人の一言」だけで済む。
- Minimal answer: 「A・(2) で OK」/「A・(1)」/「B」/ 台詞の修正点。

### Escalation EX-2: 宵待ちの村の日没の表現

- Trigger: E-3（演出の意図「奥へ進むほど暮れる」を変えるかどうかで、体験の意味が変わる）。
- Facts:
  - 時間帯は前後の位置だけで決まり、広場と船小屋の往復で巻き戻る（監査 §6）。
  - 光の色の段差は X-6a で直す（意図は変えない）。
- Why Agent cannot decide: 「歩いた距離で暮れる」（今の設計、DEC-001 の村の作り直し）と「出来事で暮れる」は、日没が何を表すかが違う。Decision Record にもどちらとも書いていない。
- Options:
  - **A（推奨）**: 物語の進行で暮れる。入口・閃き・水門守・ボスの手前で 1 段ずつ、数秒かけて暮れる。
    - 影響: 戻っても巻き戻らない。会話と景色が合う。変更は `updateDuskVillage` と 4 か所の契機。
  - B: 一番奥まで行った位置で暮れる（戻っても暗いまま）。
    - 影響: 変更が最小で、今の意図に近い。寄り道では暮れない。
  - C: 位置で暮れるまま（X-6a の段差の修正だけ）。
    - 影響: 巻き戻りは残る。
- Recommendation: A。依頼の「イベントの進行状態と時間帯の整合」に最も合い、日没を物語の時間として見せられる。
- Minimal answer: 「A」/「B」/「C」。

### Escalation EX-3: 最初に改修するマップ

- Trigger: E-3 / E-9（マップの大規模な改変の対象と順番は Human の判断）。
- Facts:
  - 村は、C・D の改修と、負荷の未確認（PointLight 19 個）が集まっている。
  - 洋館は、森の当たり判定（CH1-T3 の E2E で敵まで歩けなかった）がある。
  - 幽霊船・時計塔・道は、実機の通しの前で、見た目の課題を特定できていない（監査 §7）。
- Why Agent cannot decide: どのマップの体験を先に作り直すかは、プロダクトの優先順位。
- Options:
  - **A（推奨）**: 宵待ちの村。
    - 影響: X-2・X-6 と同じ場所。改修の型（テンポ・時間帯・景観）を 1 か所で確かめられる。
  - B: 森の洋館。
    - 影響: 最初に遊ぶ場所で、第一印象に効く。分離（X-1）以外の課題は実機の結果待ち。
  - C: 実機の通し（CH1-T0）の結果が出るまで決めない。
- Recommendation: A。今わかっている課題が最も多く、X-2・X-6 の効果をそのまま確かめられる。
- Minimal answer: 「A」/「B」/「C」。

## Autonomy Metrics
初期フェーズ（調査・計画）の実測:
- Human Escalation Count: 1（EX-1〜EX-3 を1回にまとめて提示）
- Human Decision Count: 0
- Auto Fix Count: 2（Review Fix Loop）
- Reviewer Round Count: 2
- Test Retry Count: 0
- PR Created: Yes（#75）

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-10-13 | Task | （新規）→ PLANNED | Orchestrator / Analyzer / Planner | 監査と計画を作成。X-1〜X-4・X-6a は PLANNED（Agent Approval で着手できる）、X-5・X-6b・X-7 は EX-1〜EX-3 の回答待ち |
| 2026-10-13 | Task | PLANNED（変更なし） | Reviewer | Round 1 CHANGES_REQUIRED（blocking 1: 時計塔 → 道の懐中時計の行の移動が `CHAPTER1_STORY.md` §4-5 の「翌朝」と食い違う。non-blocking 5: 演出の秒数・行番号・肩の範囲の誤り、Escalation の全文、§4-1「酒場に残る」の事実）。全件を反映（Round 1/3）。EX-1 の推奨を (2) へ |
| 2026-10-13 | Task | PLANNED（変更なし） | Reviewer | Round 2 PASS。non-blocking 1 件（(2) の姿は道を終える前だけ。道の後の既存の 3 人と二重にしない）を X-5 の Scope と Acceptance に反映 |
