# PROGRESSION-010

Status: REVIEWING

Report: .ai/reports/PROGRESSION-010-final.md

## Goal

PROGRESSION-001〜009 を統合し、第一章を完成版として扱える状態を最終確認して凍結する。新しいゲームデザインは追加しない。

## Approval
- Approval type: Agent Approval（統合・記録のみ。`../AGENTS.md` §6.1）。仕様は Human Decision（HD-1〜3、第一章の異空間廃止）
- Escalation Check: None
- Persistence: 許可（branch `claude/progression-010-chapter1-final`、最新 main から）。**main への merge は Human**（CLAUDE.md）

## Plan
| Step | 内容 |
| --- | --- |
| 1 | 最新 main に PR #33（006）→ #34（007）→ #35（008）の branch を順に merge。PROGRESSION-009 の監査記録も含める |
| 2 | #34 と #35 の Decision Record の競合を、両方を残して解消（007 → 008 の順） |
| 3 | HD-1（第一章の Skill 1）を確定として記録: Decision Record・`chapter1-rules.js` のコメント・`docs/PROGRESSION.md`・UI-002-F 再監査。技の名前を unit で固定 |
| 4 | 第一章の凍結と、C-1〜C-3・R-1・R-2・B-4 の扱いを Decision Record に記録 |
| 5 | Build / Unit / E2E 全体 / GitHub Actions |

## Files Not To Change
ゲームのコード（`src/legacy/parts/*`、`chapter1-rules.js` のロジック）、`basefile.html`、テストモード
