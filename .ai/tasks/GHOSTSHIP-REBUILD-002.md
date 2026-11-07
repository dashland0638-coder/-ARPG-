# GHOSTSHIP-REBUILD-002 — 幽霊船全面再設計・実装フェーズ

Status: DONE（Agent 側。PR 作成済み）／ CONTENT READY = HUMAN DEVICE CHECK REQUIRED（iPhone 実機は未確認）

設計（承認済み）: PR #113（`claude/dazzling-maxwell-y3msf3`、未マージ）の `.ai/reports/GHOSTSHIP-REBUILD-001-*.md` / `.ai/tasks/GHOSTSHIP-REBUILD-001.md`
決定記録: `.ai/decisions/DEC-017-ghostship-cannot-return.md`
実装報告: `.ai/reports/GHOSTSHIP-REBUILD-002-implementation.md` / 試験: `-test-report.md` / レビュー: `-review.md`

## Approval
- [x] Approved
- Approval type: Human Approval（2026-11-07 の依頼文「Humanによる設計承認は完了しています」。E-1 = 案 A を含む）
- Escalation Check: None（承認範囲の中で実装。セーブ互換・他シナリオ・物語の核の変更なし）
- Scope of approval: 依頼文 §5 の W0〜W12
- Persistence: 許可（branch: `claude/ghostship-rebuild-002`、根拠: 依頼文「専用の実装ブランチを作成」）

## Goal
承認済みの幽霊船の再設計を、物語・マップ・探索・敵・ミニボス・メインボス・脱出演出まで一貫した体験としてゲームへ実装する。iPhone の実機プレイを前提にする。`main` へはマージしない。

## ブランチの関係（調査）
- PR #113: open・未マージ（2026-11-07 確認）。`main` は `413cbfe` のまま
- 実装ブランチ `claude/ghostship-rebuild-002` は設計ブランチ（`e4c8277`）から分岐。実装 PR の差分には設計の commit（PR #113 と同じもの）が含まれる。PR #113 を先にマージすれば、実装 PR の差分は実装だけになる

## Work Items

| WI | 内容 | 状態 | 完了条件の確認 |
| --- | --- | --- | --- |
| W0 | 仕様・進行基盤（時計塔要素の除去・酒場の会話 案A・docs・DEC-017・セーブ互換の確認） | DONE | セーブ項目の追加なし（帰還不能・ループは出撃中だけ）。`save-load` / `chapter1-old-save-growth` E2E |
| W1 | 往路マップ | DONE | unit `ghostship-map` |
| W2 | 探索イベント | DONE | E2E `ghostship-chapter1` 1・2 |
| W3 | 帰還不能イベント（指定の順） | DONE | E2E 2（歩いて①）・3（②）、unit `ghostship-story`（順序）・`ghostship-map` |
| W4 | 変化後マップ | DONE | unit `ghostship-map`・`ghostship-runtime` |
| W5 | 通常敵（残影4種） | DONE | unit・画面写真 |
| W6 | 甲板長 | DONE | unit（号笛一度・HP半分） |
| W7 | 船長ボス3段 | DONE | unit `ghostship-captain`・`ghostship-runtime`、手元の E2E で撃破まで |
| W8 | 撃破・脱出 | DONE | unit `ghostship-runtime`、E2E 4（甲板 → 縄梯子 → 酒場） |
| W9 | 音響・環境演出 | DONE（範囲内） | 実装報告 §5 D-6・§7（BGM の変奏は将来の候補） |
| W10 | 物語・演出統合 | DONE | unit（時計塔の語が無い）、通し |
| W11 | テスト・レビュー | DONE | 試験報告・独立レビュー（別エージェント） |
| W12 | 実機確認・最終調整 | **未確認（Human）** | 実装報告 §6 の手順 |

## Agent Decisions
- 第一章の本編だけ新しい船（`ghostShipChapter1()`）。旧成長・周回は既存の船のまま（壊さない・戻しやすい）
- 部屋どうしの移動は既存の階段に `resolve` を足して段階ごとに行き先を引く（洋館の異常空間と同じく別区画＋付け替え）。新しい移動の仕組みは作らない
- 撃破後は宵待ちの村と同じく結果画面の前に解放の演出、結果画面の「上へ」で時計塔と同じ `afterDefeat`
- 船長の段の移行で、既存ボスの即時の範囲爆発は使わない（予兆の無い被弾を作らない）
- 光源は2つを使い回す（iPhone の描画の負荷）。射撃の残影は光源と尾を付けない
- 撃破後は下の部屋へ行けない（行った先で閉じ込められない）。船長室の決断は往路だけ
- parts の連結の作法（各ファイルの末尾の「/* ===」が次のファイルの見出し）に合わせ、新しいファイルの先頭・末尾を整えた

## Status History
- 2026-11-07 ANALYZING（PR #113 未マージを確認。関連コードの調査）
- 2026-11-07 IMPLEMENTING（W0 → W1〜W4 → W5〜W7 → W8〜W9。Work Item ごとに build・unit）
- 2026-11-07 TESTING（unit・E2E。模擬試験で引き寄せ後の硬直の不具合を発見・修正。歩く E2E で撃破後の閉じ込めの危険を発見・修正）
- 2026-11-07 REVIEWING（独立 Reviewer: 別エージェント）Round 1 CHANGES_REQUIRED（MAJOR 2・MINOR 5）→ 修正 → Round 2 PASS
- 2026-11-07 DONE（最終 E2E 16 passed、unit 2151 pass / 0 fail。PR 作成）

### Autonomy Metrics
Human Escalation: 0 / Human Decision: 0 / Auto Fix: 3（自分の試験で見つけた2件: 引き寄せ後の硬直・撃破後の閉じ込め／Review Fix Loop 1 Round）/ Reviewer Rounds: 2 / Test Retry: 1（chapter1-tower-to-road。原因は実行中の編集による再読み込み）/ PR: 作成（番号は最終報告）
