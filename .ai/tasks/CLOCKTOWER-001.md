# CLOCKTOWER-001 — 第一章④ 時計塔（シナリオ完成 → シナリオ・マップ全面再設計）

Status: DONE（Agent 側。PR #121）／ HUMAN DEVICE CHECK REQUIRED（iPhone 実機は未確認）

基準: `main` @ `ddfd2f9`（#120 のマージ後）。ブランチ: `claude/dazzling-maxwell-y3msf3`（PR #121、base = main）
第 1 段（2026-11-09）: 既存の塔に盗賊の閃き・区画描画・見せてから話すを補った。
第 2 段（2026-11-10）: Human の依頼でシナリオ・マップを全面的に作り直した（#121 は未マージで同じ Work Item のため、同じブランチの上に積んだ）。

調査: `.ai/reports/CLOCKTOWER-001-analysis.md` / 設計: `-design.md` / 実装: `-implementation.md` / 試験: `-test-report.md` / レビュー: `-review.md`
Human Decision: `.ai/decisions/DEC-018-clocktower-redesign.md`

## Approval
- [x] Approved — Human Request（2026-11-09「時計塔のシナリオ完成」、2026-11-10「時計塔シナリオ・マップ全面再設計」）
- 第一章の凍結（PROGRESSION-010）に対する扱い: 明示的な Human の依頼による変更
- Escalation Check: None（既存仕様との矛盾は新しい依頼の明示で解決。N-3 / N-4 は両立。DEC-018 に記録）

## Work Items（第 2 段）

| WI | 内容 | 状態 | 確認 |
| --- | --- | --- | --- |
| A | 調査（既存の塔・再利用と置き換え・既存仕様との矛盾） | DONE | 調査報告 |
| B | 設計（物語・6 階のマップ・ギミック・閃き・ボス） | DONE | 設計書 |
| C | マップの再構築（6 階 29 部屋、一階 1〜3 分、通路幅 6 以上、階ごとの見た目） | DONE | unit・ブラウザ |
| D | 探索イベント・記憶ギミック（時が止まる・止まった歯車・灯りの記憶・七時十三分の繰り返し・記憶の断片 9） | DONE | unit・ブラウザ |
| E | 盗賊の閃き（3F、代わりは 4F 踊り場） | DONE | unit・E2E・ブラウザ |
| F | 敵（19 体）・ボス「止刻の残響」（新しい技 3 つ＋文字盤の針）・撃破後（管理人が時間を動かす） | DONE | unit・ブラウザ |
| G | 酒場（出撃の導入 2 行・翌朝の一行）・道への接続 | DONE | unit・E2E |
| H | テスト・文書・Human Decision の記録・独立レビュー | DONE | 試験報告・レビュー |
| I | iPhone 実機 | **未確認（Human）** | CHAPTER1_PLAYTEST.md §6 D-01〜D-22 |

## Agent Decisions
- #121 を作り直しの PR として使う（未マージで同じ Work Item）。第 1 段の共通の部品（カメラの `y`・区画描画）は再利用
- 七時十三分に「失った」のは、娘が家を出た瞬間と最後の言葉。娘の生死・行方は断定しない
- 管理人とは戦わない（対峙の会話 → 止刻の残響）。管理人は生還し、鐘を鳴らしてから自分で降りる
- ボスの key `towerWarden`・数値は変えない（ボス能力・装備の接頭辞・撃破記録が参照）
- 巨大な文字盤は床に嵌め込む（壁に掛けるとカメラの上へはみ出す）
- 雲は塔の平面の外だけ（3F のカメラに雲の層が重なって白く霞んだため）
- 4F の鍵の扉は、場面を見逃しても鉤に近づけば開く（詰まらない）

## 既知の制限・残件
- 時計塔の場面そのものの E2E は無い（本編を歩き通せない）。本物のソースを動かす unit と、ブラウザで一時的な確認用の仕組みを使った確認で代える
- 4F の鍵の鉤は、テストモードの旧成長では手がかりの場面が無い（近づけば開く）
- 洋館以外のボスの「床を掃く針」の片付けが撃破時に届かない既存の件（範囲外）
- 道: 影の旅人の閃きは Human の判断が要る（調査報告 §4）

## Implementation Result

### Autonomy Metrics（第 1 段＋第 2 段）
| 項目 | 値 |
| --- | --- |
| Human Escalation Count | 0 |
| Human Decision Count | 1（第 2 段の再設計の依頼。DEC-018） |
| Auto Fix Count | 第 1 段 3 / 第 2 段 8（3F の雲・文字盤を床へ・レビュー Round 1 の指摘をまとめて 1・Round 2 の N-1・unit の準備 2・E2E の期待の更新 1・テストの共通部品 1） |
| Reviewer Round Count | 第 1 段 1（PASS）/ 第 2 段 2（CHANGES_REQUIRED → PASS） |
| Test Retry Count | 第 1 段 1 / 第 2 段 1（道の 1 件を単独で再実行して原因を特定し、テストの共通部品を直した） |
| PR Created | Yes（#121） |
