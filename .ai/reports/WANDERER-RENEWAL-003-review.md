# WANDERER-RENEWAL-003 Review

## Round 1/3

## Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | WANDERER-RENEWAL-003 |
| Branch | `claude/wanderer-renewal-001-nhlxns` |
| Reviewed SHA | `031314457f12425463089ac3172dc510f40afc58` |
| Diff range | `9e7af94958e4e64b747ade59a9f256801e5b3165..031314457f12425463089ac3172dc510f40afc58` |
| Handoff Verification | V-1 OK（remote head = Implementation SHA）/ V-2 OK（Task file 到達可）/ V-2a OK（Plan `9e7af94` → Impl の Task 差分は `Status:` 行・Status History 1行追加・Implementation Result 節のみ）/ V-3 OK（Implementation Plan あり）/ V-4 OK / V-4a OK（`rev-parse 0313144:.ai/reports/WANDERER-RENEWAL-003-analysis.md` = `939af04…` 一致）/ V-4b OK（`cc2384c` は branch から到達可）/ V-5 OK（Test Report・Changed Files あり）/ V-6 OK（diff 5 files、終点 = Implementation SHA） |
| Analysis Source | `.ai/reports/WANDERER-RENEWAL-003-analysis.md`（`claude/wanderer-renewal-001-nhlxns` @ `cc2384cc1b0f18aaf58f3ec24dc67f3e2d58e2b3`、blob `939af04bc76619188795bb2486480b077bc476ba`） |
| Plan Source | `.ai/tasks/WANDERER-RENEWAL-003.md`（`claude/wanderer-renewal-001-nhlxns` @ `9e7af94958e4e64b747ade59a9f256801e5b3165`、blob `57d072666a7000d557181ce64a7ae456b80592b1`） |

## Result
PASS

## Independence
別 Agent・別セッション（separate-context subagent。Implementer の判断過程は入力にしていない）

## Checklist
| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | OK | `WANDERER_CLIP_DUR` は旧値の 1.12〜1.26 倍（basic/basic2 0.40→0.50、basic3 0.62→0.78、retreat 0.40→0.48、shadowPass 0.50→0.60、dash 0.34→0.38、spin 0.38→0.44、ult 0.80→0.95）で「少し遅く」。キーフレーム割合は不変（`WANDERER_GRAB_CLOSE_FRAC` は既存値 0.56 の定数化のみ）。決めの姿勢の実時間と影の手: basic 0.150/0.16、basic2 0.150/0.14、basic3 0.187/0.18、握り込み 0.437/0.45（旧 0.120 / 0.120 / 0.149 / 0.347 より手の時刻に近づいた）。必殺技は `ultImpactDelay` = min(0.30, 0.45×0.95) = 0.30 秒で旧（min(0.30, 0.36)）と同じ、`ultClipWarp` が接触フレーム 0.45 を 0.30 秒へ合わせるので本体と判定は一致したまま。glyph テストは実装 `WANDERER_SKILL1.icon` 🌘 / `WANDERER_SKILL2.icon` 👥（src/core/wanderer-style.js:62,70）に一致し、`expectNoSwordsmanGlyph` は維持 |
| 2 | Scope compliance | OK | 変更は Files To Change の4ファイル + Task file のみ |
| 3 | Regression | OK | 当たり判定は `WANDERER_STRIKE.delay`（0.16/0.14/0.18）・`WANDERER_ECHO_LAG` 0.45・`JOB_SWING_IMPACT_FRAC`（battleKnight のみ）で決まり、クリップ長に依存しない。17-wanderer-style.js の `applyShadowHand` の変更は rise/sweep/grab/spin/crawl すべて hit/crush 以降の留まり開始・沈み長さ・`done` だけで、立ち上がり・薙ぎ（`wSpan(t, hit-0.10, hit+0.12)`）・握り（`crush-0.16..crush`）は不変 |
| 4 | Build | PASS | `npm run build` ✓ built |
| 5 | Unit tests | PASS | `npm run test:unit` 2333 tests / pass 2332 / fail 0 / skipped 1。追加テストは伸び幅・1/2段目同テンポ・姿勢と手のずれ ≤0.03 秒・atkCooldown 0.44・手の時刻と大きさ・回避の型を検査 |
| 6 | E2E tests | 未実行（指示により Playwright は実行せず） | Implementer の Test Report では対象 E2E 12 件 PASS、全 E2E は CI |
| 7 | Save/Load integrity | OK | セーブ関連の変更なし |
| 8 | Existing behavior | OK（Risks 参照） | 攻撃間隔は `attackCD`（atkCooldown 0.44）だけで決まり `resolveGroundAttackAction` は `swinging` を見ないので、コンボの出は変わらない。倍率・クールダウン・範囲・手の大きさ/造形/配色・閃き・他職・他マップに差分なし。他職の glyph テストは未変更 |
| 9 | Code duplication | OK | 新規重複なし |
| 10 | Unnecessary architecture changes | OK | 定数1つの追加のみ |

## Changed Files
- `src/core/wanderer-style.js`（`WANDERER_CLIP_DUR`、`WANDERER_GRAB_CLOSE_FRAC`）
- `src/legacy/parts/17-wanderer-style.js`（`applyShadowHand` の余韻・沈み）
- `tests/unit/wanderer-style.test.js`（重量感の検査）
- `tests/ui-production-glyphs.spec.js`（影の旅人の Skill 1/2 の期待値のみ）
- `.ai/tasks/WANDERER-RENEWAL-003.md`（Status / Implementation Result）

## Out of Scope Changes
None

## Risks
1. **Skill 2 の受付**: `castSkill2` は `state.swinging` 中は入力を捨てる（src/legacy/parts/11-combat-actions.js:1039）。basic/basic2 のクリップ 0.50 が atkCooldown 0.44 を超えたため、押しっぱなしのオートコンボ中は `swinging` が途切れなくなった（旧は各段 0.40〜0.44 の約 0.04 秒だけ受付）。攻撃をやめた後に Skill 2 が受け付けられるまでが最大 +0.10 秒（basic3 の後は +0.16 秒）遅くなる。Analyzer が指摘済みで伸び幅を 2〜3 割に抑える判断が計画に入っているため非ブロッキング。実プレイで Skill 2 が「出ない」と感じる場合は、伸び幅を下げるか入力の先行受付を検討（Human 判断）
2. `state.swinging` 中の移動速度 0.45 倍（13-update-loop.js:569）と、踏み込み（`attackLunge.duration = swingDur`、距離は不変）が同じ割合で長くなる。重量感の意図どおりだが、攻撃を離した直後の移動がわずかに重くなる
3. 必殺技の影の手（slam）の倒れ込みが出現（= 判定の瞬間）から 0.12〜0.26 秒 → 0.12〜0.30 秒になり、見た目の着弾が判定から 0.04 秒遅くなった。計画 §2 に記載済みの見た目のみの変更で、出現時刻・判定時刻は不変
4. 回避の小さな手（flick）の沈みが 0.20 → 0.24 秒。回避本体（共通 0.2 秒 + `DODGE_MOTION.wanderer`）は不変
5. Human の依頼文は「docs/CHARACTERS.md に記載」としているが、docs にはアイコンの記載が無い（正本は `WANDERER_SKILL1/2.icon`）。テストの期待値は実装どおりで問題なし
6. 全 E2E はこのレビューでは未実行。CI の結果を PR で確認すること

## Required Changes
None

## Note
Task file の Status History への `REVIEWING（Reviewer PASS）` の追記は、Orchestrator の指示（このコミットは review report のみ）に従い本コミットに含めていない。Orchestrator が PR 作成時に追記する。
