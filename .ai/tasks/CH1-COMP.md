# CH1-COMP — Chapter 1 Comprehensive Improvement（第一章 総合改善）

Status: PLANNED（監査・計画まで。実装は Human の別の指示を待つ）

Analysis: .ai/reports/CHAPTER-1-comprehensive-improvement-audit.md（branch `claude/chapter-1-comprehensive-audit-6cul2d`、base `origin/main` `afe234e`）
Plan: .ai/reports/CHAPTER-1-comprehensive-improvement-plan.md（Work Item ごとの目的・範囲・非対象・受け入れ条件・テスト・リスク）
Decision: .ai/decisions/DEC-007-chapter1-comprehensive.md（HD-1〜HD-7、2026-10-15）

## Goal

第一章を重点的に完成させる。採用方針は次のとおり（Human の依頼、2026-10-14）。

- 戦闘: アクションと戦術の融合。予備動作が分かりやすく、学習と上達を実感できる難易度。
- グラフィック: リアル寄りトゥーン。
- キャラクター: かわいさと職業の個性を保つ。

## Constraints

- `basefile.html` を変えない。`src/legacy/parts/` の連結構成を ES Module にしない。
- セーブの互換を保つ。形式・`scenarioClears`・交代の順番・進行の条件を変えない。
- 第一章に成長要素を入れない。
  - Level / XP
  - スフィア盤
  - パッシブ
  - 自由なスキル構成
  - 鍛冶の強化・クラフト
  - ランダム装備
- テストモード（`?dev=1`）と通常プレイを分ける。
- 敵・ボスの HP と攻撃力は、承認なしに変えない。
- 完成の判定は、E2E の PASS と、Human の iPhone 実機による通しプレイ。CONTENT READY = HUMAN DEVICE CHECK REQUIRED。

## Work Items（着手順。DEC-007）

| 順 | ID | Summary | 優先度 | Status | Approval | 依存 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | W1-1 | 移動中・戦闘中にサポートを見続ける首の追従を直す（会話中は維持） | P1 | PLANNED | [ ] 実装の指示待ち | ― |
| 2 | W1-3 | 通常コンボの「✨ フィニッシュ!」を出さない（重要な通知は残す） | P1 | PLANNED | [ ] 実装の指示待ち | ― |
| 3 | W2-T1 | 戦闘改修前のベースライン測定（宵待ちの村のボス戦） | P1 | PLANNED | [ ] 実装の指示待ち | ― |
| 4 | W2-D | 村のボス戦の試作の設計（数値・仕組みの提案） | P1 | PLANNED | [ ] Human の承認が必要 | W2-T1 |
| 5 | W0-5 | アートの完成見本の提示（見本の制作は村のボス戦に限り HD-4 の範囲。実装の開始は指示待ち。画像と全マップ展開は Human の承認が必要） | P2 | PLANNED | [ ] Human の承認が必要 | W0-3, W3-0（制作: W2-2・W3-1・W3-2 の村の範囲） |
| 5 | W0-6 | 出撃会話の台詞の候補の提示 | P1 | PLANNED | [ ] Human の承認が必要 | ― |
| 6 | W1-2, W1-4, W1-5, W2-1a〜W2-6, W3, W4, W5 | 計画のとおり | ― | PLANNED | 承認後に個別の Task にする | 計画を参照 |

各 Work Item は着手のときに個別の Task として起こし、次の順で進めて小さな PR に分ける。`main` へは merge しない。

1. Analyzer
2. Planner
3. Implementer
4. Tester
5. 独立 Reviewer

## Status History

- 2026-10-14: 監査・計画（PLANNED）。独立 Reviewer の判定は Round 1 が CHANGES_REQUIRED、Round 2 が PASS。
- 2026-10-15: HD-1〜HD-7 が確定した（DEC-007）。W1-1・W1-3・W2-T1 の詳細計画と受け入れ条件を計画書に記録した。実装は未着手。
