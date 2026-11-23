# WANDERER-RENEWAL-002 — 影の旅人・最終設計（影の手・フード外套・大振りのモーション）

Status: REVIEWING

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
| 2026-11-23 | Task | APPROVED → IMPLEMENTING → TESTING → REVIEWING | Implementer | Plan Handoff H-1〜H-8 確認。build / unit 2331 / E2E 80 + 7 PASS。Debugger サイクル 0 |
| 2026-11-23 | Task | REVIEWING → CHANGES_REQUIRED | Reviewer | Round 1/3（`591370292c171a56713808e7c734489b5a46787b`）: 影の手の大きさが WR2-2 と不一致 |
| 2026-11-23 | Task | CHANGES_REQUIRED → TESTING → REVIEWING | Implementer | Review Fix Loop Round 1（Auto Fix 1）。build / unit 2331 / E2E 5 PASS |

## Implementation Result

### Artifact Handoff
| Kind | Path | Source（branch @ SHA） | Blob SHA | 確認 |
| --- | --- | --- | --- | --- |
| analysis | `.ai/reports/WANDERER-RENEWAL-002-analysis.md` | `claude/wanderer-renewal-001-nhlxns` @ `9cb8f545b95c3ef221271ebb748955d257f4fec4` | `0f159b46a7fd1104afd512d47a49f6a4f3ceadbd` | H-1〜H-8 OK |
| plan | `.ai/tasks/WANDERER-RENEWAL-002.md` | `claude/wanderer-renewal-001-nhlxns` @ `8860d024acc2420e2b1582f9f919f315efdb961e` | `1050fe013dc47e9d93377f60e0e224ea3c4281dd` | H-1〜H-8 OK |

### Changed Files
| ファイル | 変更 |
| --- | --- |
| `src/core/wanderer-style.js` | 通常攻撃の影の手の表（`WANDERER_STRIKE`: 突き上げ / 薙ぎ払い / 握砕、遅れ・形・大きさ）、`WANDERER_HAND_SCALE`、`planStrike`、`handTargetPoint`、影の手の型（`SHADOW_HAND_SHAPE`）、3 段目の追撃を手の円へ、構え（腕を下ろした静かな立ち姿・武器なし・軌跡なし）と全クリップを大振りの「影を呼ぶ」動作へ |
| `src/legacy/parts/17-wanderer-style.js` | 影の刃・本人の残像を廃止。空の武器の枠、フード外套の共有部品 `buildWandererHoodParts`、影の手（造形・共有ジオメトリ/Material・プール・7 種の動き）、影の手の一撃と追撃の待ち行列、影渡り（這う手）、必殺技の 5 本の手、回避の小さな手、加入後の 0.45 秒遅れる足元の影、外套の裾・マフラーの揺れ |
| `06-player-enemy.js` | 影の旅人の衣服をフード外套へ（コート・白いシャツ・ポケット・背中のフード・ゲイターをやめる）。前髪だけ覗く。武器の枠は空 |
| `11-combat-actions.js` | 影の旅人の通常攻撃は `castWandererCombo`（影の手が当たる瞬間に判定）。回避攻撃・切り上げは斬撃の弧の代わりに影の手。必殺技に影の手 |
| `13-update-loop.js` / `10-input.js` | 影残しの前への一撃・回避を影の手に。影の刃の更新を削除 |
| `14-dungeon-road.js` | 加入前の姿を共有部品（深いフード）・配色表の色・加入後と同じ布の作りへ |
| `src/render/player-palette.js` | 影の旅人の行を DEC-034 の色へ（外套 #654F86 / インナー #46404F / パンツ #3D3846 / マフラー #8E70B8 / ブーツ #3B3B41） |
| `src/legacy/concat-plugin.js` | core の import 追加 |
| `docs/CHARACTERS.md` / `COMBAT.md` | 影の手・フード外套・配色・モーションを実装事実として記載 |
| `.ai/decisions/DEC-034-wanderer-shadow-hands.md`（新規）/ `AGENT-DECISIONS.md` | Human の設計書の記録 / AD-005 の一部置き換えの注記 |
| tests | `unit/wanderer-style.test.js`（影の手の形・時刻・場所・大振り）、`unit/player-palette.test.js`（影の旅人の行）、`unit/road-stranger.test.js`（共有部品の stub）、`wanderer-renewal.spec.js`（武器なし・影の手が遅れて当たる・追撃・盾・会話で落ちる） |
| `.ai/reports/img/WANDERER-RENEWAL-002/*.jpg` | 撮影 |

### Test Report
- Scope: Targeted
- Executed: `npm run build`、`npm run test:unit`（2331）、E2E: wanderer-renewal / character-palette / character-clothing / character-motion / character-weapon-visual / weapon-stow / road2-join / shadow-guide / save-load / production-build / base-class-identity（80 件）、最終変更後に wanderer-renewal / shadow-guide / road2-join（7 件）を再実行
- Why this scope: 影の旅人の経路と、触れた共通基盤（衣服・配色・武器の枠・収納・加入・セーブ・公開ビルド）
- Not run: 残りの E2E（触れていない経路）
- Environment: WANDERER-RENEWAL-001 と同じ（Chromium のリンクはリポジトリ外）

| テスト | 結果 | メモ |
| --- | --- | --- |
| build | PASS | |
| unit（2331） | PASS | dusk-enemies の「敵の色を味方から離す」に合わせ、マフラーを #8E70B8 に（初案 #8A77AB は敵の色に近かった） |
| E2E 80 件 + 再実行 7 件 | PASS | |

### Acceptance Criteria（DEC-034 §11）
| AC | 確認 | 根拠 |
| --- | --- | --- |
| 加入前後で同一人物 / 加入後はフードが後ろへ・目元が見える / 外套は腰丈 | VERIFIED | 共有部品 `buildWandererHoodParts`（unit）、撮影 2-prejoin-vs-joined |
| 武器を持たない | VERIFIED | spec（武器の枠のメッシュ 0） |
| 3 段が剣士と明確に違う / 大振り | VERIFIED | unit（突き上げ・腰の回転・両腕を広げる）、撮影 3-motions |
| 巨大な影の手が地面から出る / 人間の手・尖った指先 / 内部黒紫・輪郭紫 | VERIFIED | spec（手の Material: 不透明の黒紫・輪郭 #8A5AD6）、unit（形）、撮影 4・5 |
| スキル性能・閃き・セーブ互換 | VERIFIED | spec（影残し・影渡りの追撃と盾抜け・閃き）、save-load.spec。倍率・範囲・距離は WANDERER_ECHO / SKILL の値のまま |
| 844×390 で影の手と対象が見える | VERIFIED（撮影） | 5-combat-844x390 |
| 他職への回帰なし | VERIFIED | spec（盗賊 4 段・武器あり）、character-* / weapon-stow / base-class-identity |

### Notes
- 1 段目・3 段目の判定は手の出た場所の円（WR2-1）。2 段目は従来の扇
- 影の手の大きさは WR2-2 どおり（Round 1 Fix）。iPhone 実機で Human が確認して調整できる（`WANDERER_HAND_SCALE`）
- 勝利の専用の動きは作っていない（WR2-5）

### Round 1 Fix
- Required Change #1（影の手の大きさが WR2-2 と不一致）: 案 (a)。倍率を WR2-2 の値へ（手首から先 ≒ 倍率 × 1.08 m）: 通常 3.4（≒ 3.7 m = 身長の約 1.4 倍）・握砕/影残し 4.7（約 2 倍）・影渡り 3.6・必殺技 5.2（約 2.2 倍）・回避攻撃等の小さな手 2.4。core のコメントと docs/CHARACTERS.md の数値を揃えた。844×390 の撮影で主人公と対象が見えることを確認（`img/WANDERER-RENEWAL-002/5-combat-844x390.jpg` を差し替え）
- 非ブロッキングの指摘への対応: 加入前のフードの影の帯の castShadow を外した（R5）。足元の影は地点移動（4 m 以上の飛び）で足取りを捨てる（R4）。使い回した手を前の持ち主の予定が片づけないよう、手に世代番号を持たせた（R2）。R1（待ち行列の上限）・R3（旧成長ルールのサブ武器）・R6（当たりの効果音）は Risks として残す
- Test: build PASS、unit 2331 PASS、E2E wanderer-renewal / road2-join 5 PASS
