# WANDERER-RENEWAL-002 — 影の旅人・最終設計（影の手・フード外套・大振りのモーション）

Status: APPROVED

Analysis: .ai/reports/WANDERER-RENEWAL-002-analysis.md（branch `claude/wanderer-renewal-001-nhlxns` @ `9cb8f545b95c3ef221271ebb748955d257f4fec4`、blob `0f159b46a7fd1104afd512d47a49f6a4f3ceadbd`）

## Approval
- [x] Approved
- Approval type: Human Approval（Human の「影の旅人・最終キャラクター設計書」2026-11-23 = `.ai/decisions/DEC-034-wanderer-shadow-hands.md`。設計書 §10 で実装順・§7 でレビューまでの実施を指示）
- Escalation Check: None（DEC-034 が WHAT。大きさ等の調整は設計書が委ねている）
- Approved by / date / where: Human（設計書）/ 2026-11-23 / Claude Code セッション。記入: Planner（Agent）
- Scope of approval: 下の Implementation Plan と Files To Change
- Persistence: 許可（branch: `claude/wanderer-renewal-001-nhlxns`、PR #145 を更新。根拠: 設計書「既存の PR #145 の…を原則維持」、作業ブランチの割当）

Implementation: 開始可

## Goal
DEC-034 の全文。本人は静か、影は獰猛 ―― 武器を持たない静かなフード姿の旅人が手を振ると、地面から黒紫の巨大な手が現れて敵を襲う。

## Constraints
DEC-034 §9（kit 維持・専用モーション表・剣士の流用禁止・武器なし・斬撃エフェクトにしない・人間の手・黒紫＋紫の輪郭・Material 分離・スキルの倍率/範囲/移動距離/判定を不用意に変えない・セーブ形式不変・他職へ影響させない・新しい描画/物理システムを必要以上に足さない）。DEC-004 N-4（加入前は名前を出さない）、DEC-030/031（0.45 秒、説明しない）。

## Implementation Plan
1. **外見（加入前後の統一）**: フード外套の部品を 1 つの関数（`buildWandererHoodParts`、17）にまとめ、加入前（`buildRoadTravelerFigure`）と加入後（buildPlayer の影の旅人）の両方で使う。外套は腰丈。加入前はフードが深い（目元まで影）、加入後は少し後ろ（目元が見え、上半分に影）。顔の上半分の影は半透明の黒い面（フードの陰）。白いシャツ・コート・ポケットはやめる。配色表の行を DEC-034 の色へ（外套 #654F86、インナー/パンツ 暗い灰紫、マフラー 外套より明るい紫、ブーツ 暗い灰色）
2. **影の手**（17）: 手のひら＋4 本の指（3 節。最後の節は長い尖った円錐）＋外へ開く親指。指の曲げ（開く ↔ 握る）を関節で持つ。内部 = 黒に近い紫の不透明 Material、輪郭 = `makeOutlineMat` の紫のシェル（指先は太く）。地面の影の円（手首が影と一体）。ジオメトリ・Material は全手で共有、手はプールで使い回す。床の下から持ち上げて出し、沈めて消す
3. **攻撃と判定の割り当て**（core に形と時刻、17 で実行）:
   - 1 段目 突き上げ: 間合い内の一番近い敵の足元（いなければ前方）に手。0.16 秒後に下から突き上げて当たる（手のまわり半径 1.5）
   - 2 段目 薙ぎ払い: 横向きの手が前方の扇（従来の弧 3.2 / 半角 60°）を薙ぐ。0.14 秒後に当たる
   - 3 段目 握砕: 敵の足元に開いた手 → 0.18 秒後に当たる（半径 1.6）→ 0.45 秒後に指を閉じて握り潰す（既存の 3 段目の追撃 = 0.6 倍）
   - Skill 1: 元の位置から巨大な手 → 0.45 秒後に周囲を一回り薙ぐ（半径 2.4、既存どおり）
   - Skill 2: 手が地面を這って前へ（6.5 m、通過で当たる）→ 先端で向きを変え、0.45 秒後にこちらへ薙ぎ戻す（既存の背面判定）
   - 必殺技: 数値・判定はそのまま。命中の瞬間に、範囲のまわりから複数の巨大な手が一斉に襲いかかる
   - 回避: 元の位置に小さな手が一瞬
   - 影の旅人では紫の斬撃弧・刃の軌跡を出さない
4. **本人のモーション**（core のキーフレーム）: 構え = 腕を下ろした静かな立ち姿（わずかに手を開く）。1 段目 = 右手を下から前上へ大きく振り上げ、体を少し反らす。2 段目 = 右腕を大きく横へ払い、腰と上体を回す。3 段目 = 両腕を大きく広げ、片手を握り込みながら前傾。Skill 1 = 前へ手を振って滑り下がる。Skill 2 = 前へ手を差し出す。必殺技 = 両腕を大きく広げる。回避攻撃・切り上げも手の動作に
5. **足元の影と布の揺れ**（17）: 加入後も足元の影が 0.45 秒遅れてついてくる。待機で少し揺れ、走ると伸びる。マフラーの端・外套の後ろ裾が体の動きより遅れて揺れる
6. **docs / テスト**: CHARACTERS / COMBAT（影の手の表現）、unit（手の形・時刻・判定・外見）、E2E（`wanderer-renewal.spec.js` を影の手へ）、撮影

## Files To Change
`src/core/wanderer-style.js`、`src/legacy/parts/17-wanderer-style.js`、`06-player-enemy.js`、`11-combat-actions.js`、`13-update-loop.js`、`10-input.js`、`14-dungeon-road.js`、`src/render/player-palette.js`（影の旅人の行だけ）、`docs/CHARACTERS.md` / `COMBAT.md`、`tests/unit/wanderer-style.test.js` / `player-palette.test.js`（影の旅人の行）/ `road-stranger.test.js`、`tests/wanderer-renewal.spec.js`、`tests/character-palette.spec.js`（影の旅人の期待色がある場合）、`.ai/reports/img/WANDERER-RENEWAL-002/`

## Files Not To Change
他職の配色の行・モーション・Material、セーブ形式、閃きの台詞と場所、スキルの倍率・範囲・移動距離、`basefile.html`

## Test Plan
build / unit 全件 / E2E: wanderer-renewal・character-palette・character-clothing・character-motion・character-weapon-visual・weapon-stow・road2-join・shadow-guide・save-load・production-build。撮影（正面・側面・背面、3 段・Skill 1/2・必殺技・回避、加入前後、844×390）

## Acceptance Criteria
DEC-034 §11 の 12 項目。

## Agent Decisions
| # | 決定 | 根拠ソース | 代替案 |
| --- | --- | --- | --- |
| WR2-1 | 1 段目・3 段目の判定は「手の出た場所の円」、2 段目は従来の扇 | DEC-034 §8「視覚的な迫力と攻撃判定の位置を一致」 | 全段を扇のまま（足元の手と判定がずれる） |
| WR2-2 | 影の手の大きさ: 通常 約 1.4〜1.6 倍・強い 約 2 倍・必殺技 2.2 倍 ×5 本（身長 2.54 基準）。真上へ伸ばしきらず斜めに出して見下ろしカメラで主人公を隠さない | DEC-034 §3-3（固定値にせずカメラに合わせる） | 2〜3 倍を真上へ（見下ろしで画面を覆う） |
| WR2-3 | 内部は不透明（MeshLambert 系の黒紫）、出入りは床の下からの上下動で表し、透明度の変化を使わない | DEC-034 §3-2（半透明の不定形にしない）、R-2（Material 共有） | フェードアウト |
| WR2-4 | 顔の上半分の影は、顔の前の半透明の黒い面（フードの陰）で表す | DEC-034 §2-1（影のライティングは描画方式を増やさない） | 影の計算を追加 |
| WR2-5 | 勝利の専用の動きは作らない（全員共通の仕組みが無い。休めの姿勢と遅れてついてくる影で表す） | DEC-034 §9（新しいシステムを必要以上に足さない） | 勝利ポーズの仕組みを新設 |

## Escalation
None

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-11-23 | Task | — → ANALYZING → APPROVED | Orchestrator / Planner | Human の最終キャラクター設計書（DEC-034）。Analyzer report persist（`9cb8f545b95c3ef221271ebb748955d257f4fec4`）。H-1〜H-8 確認 |
