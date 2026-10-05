# PROGRESSION-005 Review（第一章の Skill 1 を職業固有の既定の技に固定）

## Round 1/3

### Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | PROGRESSION-005 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| Reviewed SHA | `9b75206644a39b4bf84f0f44370cfb3e5ee0db02` |
| Diff range | `4bee9dd..9b75206` |
| Handoff Verification | V-1〜V-6 OK（Analysis `a57f7bd`・Plan `4bee9dd` の blob 一致） |

### Result
PASS

### Independence
同一セッションで兼務（`skillChoice` を書く所・`skill1VariantUsable` / `activeSkill1Variant` の呼び出し元を全数 grep し直した。Human による差分確認を推奨）

### Checklist（Human 指定の 10 観点）
| # | 観点 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Chapter 1 で Skill 1 を変更できない | PASS | 本編で `skillChoice` を書き換える経路は鑑定所のカード（`data-variant`）だけで、本編ではそのカードを作らない（unit: `data-variant=` はテストモードの分岐の 1 か所だけ）。E2E: 加入後の鑑定所のスキル1 は既定の技 1 枚・`data-variant` 0・見出し「固定」（変更前は一覧と付け替え → FAIL） |
| 2 | Skill 1 の具体的なデザインを決めていない | PASS | 既定は `defaultSkill1For` / `CHAPTER1_SKILL1`（変更なし。unit で `{mage: 'phantom'}` のままを固定）。技の定義・性能・名称・アニメーションの差分なし。剣士・盗賊・弓師の `retreat` 系は既存の既定のまま（正式とは記録していない） |
| 3 | 旧セーブ値を削除していない | PASS | 判定は読むだけ。E2E: 魔法使い・剣士の旧セーブで `skillChoice: 'spin'` がセーブし直しても残る |
| 4 | `activeSkill1Variant()` 等と整合 | PASS | 固定の判定は `skill1VariantUsable` の 1 か所。`activeSkill1Variant()`（戦闘・HUD）とスキル1 サブタブの一覧が同じ判定を通る。使えない技のときの既定（`defaultSkill1For`）は PROGRESSION-003 のまま |
| 5 | Skill 2 / Ult（PROGRESSION-003）を壊していない | PASS | 差分なし。PROGRESSION-003 の E2E（alt を本編で使わない・テストモードで選べる）PASS |
| 6 | 主人公の交代を壊していない | PASS | 交代処理は変更なし。E2E: 剣士 → 魔法使いの交代後、保存の `spin` があっても幻影歩法。`chapter1-progression` PASS |
| 7 | Test Mode を壊していない | PASS | `legacyGrowth()` が true の分岐は変更前と同じ。E2E: テストモードで見出し「付け替え可能」、回転（魔導旋風）へ付け替えると HUD が 🌌。既存の `ui-production-glyphs`（テストモードでダッシュ斬りへ付け替え）・`auto-combo`・`job-traits` PASS |
| 8 | Chapter 2 を壊していない | PASS（影響なし） | 判定は既存の `legacyGrowth()`。Chapter 2 の実行時の状態は存在しない（UI-002-F 再監査 X-7） |
| 9 | UI が「変更可能」と誤認させない | PASS | 本編の見出しは「固定」、カードは押せない（`cursor:default`。Skill 2・必殺技の「固定」と同じ既存の見せ方）。本編に表示される「付け替え」の文言は、スキル1・2・必殺技とも本編では「固定」に切り替わる（スキル3 のサブタブは本編で出ない） |
| 10 | Regression test の追加 | PASS | E2E 4 件（本編の加入後の鑑定所・剣士だけの段階の HUD は変更前 FAIL、交代・テストモードは回帰の確認）、unit 1 件追加・PROGRESSION-003 の構造の確認を本編の固定の分岐を含む形へ更新（変更前の src で 2 件 FAIL） |

### Findings
- Info: PROGRESSION-003 の unit の 1 件（`skill1VariantUsable` の構造）は、本編の分岐が「解放条件の付いた技は不可」から「既定の技だけ可」へ広がったため、正規表現を更新した。テストモードの分岐（解放条件の無い技は可・新技は解放済み・上位職の技は転身済み）の確認はそのまま残している（検証を弱めていない）
- Info: 鑑定所を開けない剣士だけの段階（PROGRESSION-004）でも、HUD・戦闘は `activeSkill1Variant()` を通るので既定の技に固定される（E2E で glyph `skill.warrior.retreat` を確認）

### Required Changes
None
