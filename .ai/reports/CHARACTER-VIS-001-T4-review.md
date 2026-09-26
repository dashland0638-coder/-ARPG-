# CHARACTER-VIS-001 / T-4 Review

## Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | CHARACTER-VIS-001 / T-4（キャラクター性の再設計、再計画版） |
| Branch | `claude/character-vis-001-t4-impl` |
| Reviewed SHA | `737da5fabecc230fb2dd0ec78274f6756ca12297`（remote 先端と一致） |
| Diff range | `e07c6d4731f71024734116e11ad56f92280aef93..737da5fabecc230fb2dd0ec78274f6756ca12297`（2 commits: 実装 `07dfa81`、Analyzer report の同梱 `737da5f`） |
| Handoff Verification | V-1〜V-6（V-2a / V-4a / V-4b）PASS（V-2a は記録付き、N-1） |
| Analysis Source | `.ai/reports/CHARACTER-VIS-001-T4-analysis.md`（branch `claude/character-vis-001-t4-analysis` @ `6ea91565d255849aaee1134666da04256543f00c`、blob `f15713384131f85bc9ee57c8219d2e836b24dd0c`） |
| Plan Source | `.ai/tasks/CHARACTER-VIS-001.md`（`main` @ `c17951b978c2d5efb6d715bed7fb73f45f169e53`、Approved Task Blob `3526f842c77b509d8a38c3804ebad727fa38416a`） |
| Date | 2026-09-26 |

## Result
**PASS**（Blocking findings なし。Non-blocking N-1〜N-8）

## Independence
**同一セッションで兼務**（Implementer と同じ Claude Code セッション）。Implementer の自己評価は入力にせず、Reviewed SHA の Task / Plan / `git diff` と Reviewer の再実行で判定した。主 Acceptance（V-1-T4a〜h の目視）は Human の判断を正とした。**推奨: 人間による差分確認**（AGENTS.md §5）。差分が大きい（`06-player-enemy.js` +約1,300 / −約720 行）ため特に推奨。

## Handoff Verification（git から再計算）
| # | 確認 | 結果 | 判定 |
| --- | --- | --- | --- |
| V-1 | Branch / Reviewed SHA | `origin/claude/character-vis-001-t4-impl` 先端 = `737da5f…` | PASS |
| V-2 | Task file | `git rev-parse 737da5f:.ai/tasks/CHARACTER-VIS-001.md` = `89856a5910c3ebe469555d47922c18c73a4beddf` | PASS |
| V-2a | `git diff c17951b:<Task> 737da5f:<Task>` | 削除行は2行のみ: Work Items 表 T-4 の Status（`APPROVED` → `REVIEWING`）と、T-4 Approval 欄の `Implementation (T-4, 再計画版):` 行（`e07c6d4` の Implementation Persistence の記録、Human 指示）。他は追記（Status History・Implementation Result・Human Decision の記録） | PASS（記録あり、N-1） |
| V-3 | Plan | 承認済み Task file（`c17951b`、blob `3526f842…`）で T-4 再計画版 APPROVED `[x]`、HDR-T4-2〜15 記録済み。`c17951b` は `origin/main` から到達可能 | PASS |
| V-4 / V-4a | Analyzer report | `git rev-parse 737da5f:.ai/reports/CHARACTER-VIS-001-T4-analysis.md` = `f1571338…`（Source SHA の blob と一致） | PASS |
| V-4b | Source SHA の到達性 | `6ea9156` は `origin/claude/character-vis-001-t4-analysis` に含まれる | PASS |
| V-5 | Implementation Result | Task file 末尾の「Implementation Result（T-4、途中: 弓師パイロットまで）」以降と「T-4 最終 Test Report」「Changed Files（T-4）」 | PASS |
| V-6 | Diff range | 9 files / +1489 −760、終点 = Reviewed SHA、始点 = Implementation Persistence commit `e07c6d4` | PASS |

## Plan Compliance / Human Decision との整合（コードで独立確認）
承認済み計画（HDR-T4-2〜15）から、実装中に Human が明示の Human Decision で変更した点が多い。いずれも Task file に出典（誰・いつ・会話）付きで記録されていることを確認した。

| 項目 | 承認済み計画 | 実装（Reviewed SHA） | 根拠の記録 | 判定 |
| --- | --- | --- | --- | --- |
| 衣服の作り方 | 既存 Loft を既存可動部へ、新しい衣服システムは作らない | `makeGarmentLoft` / `makeOpenGarmentLoft`（いずれも `makeLoft` の薄いラッパー）を waist / 股関節 / 膝 / 肩 / 肘 / 頭へ | HDR-T4-4・固定条件 | PASS |
| 弓師 A | ワイドパンツ + 短丈上着 | 同左 + 袖・襟の headR 比・覆面削除 | 弓師パイロットの V-1 Human Decision | PASS |
| 盗賊 A | パーカー的フード + 裾を絞ったワイドパンツ | 丸いパーカーのフード（makeHawkEyeHood 流用）+ 帽子 + パーカー + オーバーオール | 盗賊 A のデザイン変更・修正イメージ・未決定 1〜5（Human Decision） | PASS |
| 魔法使い C | ローブ + 大判ストール + 帽子の比率修正 | キャスケット + タートルネック + 前開きロングコート + ワイドパンツ（ローブ・ストール・三角帽は廃止） | 魔法使い C のデザイン変更 Human Decision 1〜3、キャスケット候補 B | PASS |
| 剣士 A / HDR-T4-2 | 短丈上着 + ロングブーツ + 大判ストール、兜を残し顔を見せない | キャップ + ネックゲイター + フード + 膝丈パーカー + パンツ + ブーツの胴、顔を見せる | 剣士 A のデザイン変更・HDR-T4-2 の剣士の変更（Human Decision）、剣士 A の V-1 | PASS |
| Step 6（HDR-T4-7 P-a / W-a） | 基礎職の衣服を継承、上位職の差し替え形状を調整 | 上位4職は基礎職の衣服を継承し部品を置き換え（戦騎士の頭 0.86 → 1.0）、影の旅人は剣士の部品の作り方を charKey で分岐 | Step 6 Human Decision、上位4職の V-1 | PASS |
| HDR-T4-13 | 収納位置 `off` のみ | 剣士・戦騎士の `WEAPON_SOCKET` の `off` と `wep`（向き）を変更 | Step 6 Human Decision #5（「背中の剣の向き逆」） | PASS（記録あり、N-3） |
| HDR-T4-8（Material は T-5） | 既存インスタンスの流用のみ | 上位職の白いレイヤー（`layerWhite`、転身中のみ）、影の旅人のコート / 白シャツ、職ごとの肌色（`SKIN_COLOR`）で新しい Material / 値 | Step 6 Human Decision #3、肌色の Human Decision | PASS（記録あり、N-3） |
| HDR-T4-14 | 衣服の構築 E2E | `tests/character-clothing.spec.js`（9件）+ デバッグの CLOTH 行 | T-4 の仕上げ Human Decision #2（変更対象ファイルの追加） | PASS |
| HDR-T4-10 | `docs/CHARACTERS.md` に外見の記述、影の旅人の食い違いは別 Task | 「外見」の節を追加、食い違いは未修正と明記 | HDR-T4-10 | PASS |
| HDR-T4-15 | 眉・口を足さない | 目の大きさ・間隔・黒目・縦横比の数値のみ変更、造形の追加なし | 目の Human Decision | PASS |
| 影の旅人の武器 | ― | 見た目だけ非表示（`weapon.visible = false`）。攻撃処理は不変 | Step 6 Human Decision #4 | PASS |

## Scope Verification
- 変更ファイル: `src/legacy/parts/05-rendering-rig.js`、`src/legacy/parts/06-player-enemy.js`、`src/core/motion-preview.js`、`tests/unit/lowpoly-primitives.test.js`、`tests/unit/motion-preview.test.js`、`tests/character-clothing.spec.js`（新規）、`docs/CHARACTERS.md`、`.ai/tasks/CHARACTER-VIS-001.md`、`.ai/reports/CHARACTER-VIS-001-T4-analysis.md`（承認時点の内容のまま同梱）。Files To Change（確定版）と Human Decision による追加の範囲内
- `13-update-loop.js`・`playwright.config.js`・`textures.js`・支援AI（`08` / `11`）に差分なし
- `05` の差分に BUILD の体格値・STANCE / CLIPS・共有 Lathe 表（`PAULDRON_PROFILE` / `CUFF_PROFILE` / `LIMB_PROFILE`）・`JOINT_CAP_K` の変更なし。`06` の差分に関節球（`jointCapRadius`）・Pauldron の `limbGeo`・骨盤（`makeCharacterPelvis`）・輪郭線（`outlineMats` / `addOutline`）の変更なし
- T-2 の体格（5.0頭身ほか）: character-motion の体格の E2E を Reviewer が再実行して 4 PASS
- unit テストの変更: 旧実装（三角帽のつば・兜・鷹の目の深いフード）に依存したアンカーを、同じ規則（近傍に `HEAD_BACK_Z`）で新しい構築へ置き換え、キャップのテストを追加。assert の削除なし（Human Decision 2 と同じ扱い）

## Test Results
| テスト | 報告 | Reviewer 再確認 | 判定 |
| --- | --- | --- | --- |
| `npm run build` | PASS | 再実行 PASS | PASS |
| `npm run test:unit` | 1510 / 1510 | 再実行 1510 / 1510 | PASS |
| 関連 E2E 60 件 | 59 PASS / 1 FLAKY / 0 FAIL | Reviewer が `character-clothing`（9）・`battle-knight-visual`・`weapon-stow`（10）を再実行して 20 PASS、character-motion の体格 4 PASS | PASS（FLAKY は PASS として数えない、N-4） |
| repo 標準設定の E2E | Chromium revision 不一致 | 再現（`Executable doesn't exist at /opt/pw-browsers/chromium_headless_shell-1234/...`） | **NOT_RUN**（実行環境） |
| scratchpad の設定での E2E | repo の設定を読み `executablePath` だけ差し替え | Reviewer も同じ方法。repo の Playwright 設定の差分なし | 記録どおり（リポジトリ外の回避策） |
| `npm test` 全体 | NOT_RUN | ― | **NOT_RUN**（PASS として数えない、N-5） |

## Visual / Acceptance Verification
- 主 Acceptance（V-1-T4a〜h、HDR-T4-6 の武器収納状態での識別）: Human が各段階（弓師パイロット、盗賊、魔法使い、剣士、上位4職、影の旅人、目・肌色）と最終コードの9キャラクターの比較画像を確認し、「**完了で良いです**」（2026-09-26）。Task file に記録済み
- Reviewer 自身は画像による目視判定をしていない（Acceptance は Human の判断を正とする）

## Changed Files
`src/legacy/parts/05-rendering-rig.js`、`src/legacy/parts/06-player-enemy.js`、`src/core/motion-preview.js`、`tests/unit/lowpoly-primitives.test.js`、`tests/unit/motion-preview.test.js`、`tests/character-clothing.spec.js`、`docs/CHARACTERS.md`、`.ai/tasks/CHARACTER-VIS-001.md`、`.ai/reports/CHARACTER-VIS-001-T4-analysis.md`

## Out of Scope Changes
None（承認済み計画からの変更はすべて Human Decision として記録されている）

## Non-blocking Findings
| # | 内容 | 扱い |
| --- | --- | --- |
| N-1 | Task file の T-4 Approval 欄の `Implementation (T-4, 再計画版):` 行（と `Persistence:` 行）は `e07c6d4` で Human 指示により書き換えられており、I-3（Status・Status History・Implementation Result のみ）の外。多数の Human Decision も Implementation Result に記録 | Human の明示指示で出所が記録されている。T-2 / T-3 Review の N-1 と同種（Protocol に「実装中の Human Decision」の記録位置が無い） |
| N-2 | 実装中、Human の指示で T-4 の Status を `APPROVED` のまま据え置き、`IMPLEMENTING` / `TESTING` を REVIEWING 直前にまとめて Status History へ記録 | 記録済み。§7 の状態遷移の運用上の差異として記録のみ |
| N-3 | 承認済み計画からの変更（盗賊・魔法使い・剣士のデザイン変更、HDR-T4-2 の剣士、HDR-T4-13 の収納の向き、HDR-T4-8 の Material の例外、変更対象ファイルの追加）が多い | いずれも Human Decision として記録。§6 の「承認範囲や Files To Change を変える場合は Human Approval を取り直す」の扱いは、Human が承認済み計画内の変更として実装を指示した記録で代えている。Human による確認を推奨 |
| N-4 | `job-traits.spec.js:97`（戦騎士 Perfect Brace）が2回の実行で FLAKY（失敗箇所は毎回異なる） | 原因未特定。タイミング依存のテスト。衣服の形状との直接の関係は確認されていない。Risks として残す |
| N-5 | `npm test` 全体・repo 標準設定の E2E は NOT_RUN | main 統合前の Full Regression は Human 判断で推奨 |
| N-6 | 影の旅人の武器は見た目だけ非表示（攻撃・モーションは剣士の kit のまま）。`docs/CHARACTERS.md` の影の旅人の既存記述とプレイアブル実装の食い違いは未修正 | Human Decision どおり別 Task |
| N-7 | Analyzer report は実装 commit（`07dfa81`）ではなく、直後の別 commit（`737da5f`）で同梱（§7.3 手順2 は同じ commit） | 承認時点の内容のまま（blob 一致）。記録のみ |
| N-8 | 使われなくなった旧定義が残っている（`ROGUE_HOOD_*` / `makeRogueHood` の一部、`MAGE_CONE_HEIGHT_ABS` / `makeMageHatBrim`、`WARRIOR_HELM_*` / `makeWarriorBaseHelm`、`makeRogueMask`） | unit テストの複製・コメントが参照しているため残置と記録されている。削除は別 Task |

## DONE 判定（§7.3）
- Result PASS: 満たす
- Reviewed SHA = T-4 の最新 Implementation SHA: 満たす
- review report が remote の Branch に存在: 本 report の push で満たす
- → T-4 は `REVIEWING → DONE`。Task Level は T-5 が未完了のため `PLANNED` のまま（§7.1）

## Required Changes
None
