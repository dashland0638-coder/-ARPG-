# CAMERA-001 — 森の洋館・宵待ちの村のカメラ制御／隣接部屋の描画ルールの展開

Status: DONE（Agent 側。PR 作成済み）／ HUMAN DEVICE CHECK REQUIRED（iPhone 実機は未確認）

基準: `main` @ `8124c8f`（#117・#118 のマージ後）。ブランチ: `claude/camera-001-mansion-duskvillage`（PR の base = main）
調査: `.ai/reports/CAMERA-001-analysis.md` / 計画・実装: `-implementation.md` / 試験: `-test-report.md` / レビュー: `-review.md`
共通方針: `docs/DUNGEON_RENDERING.md`。包含するタスク: `CAMERA-MANSION-001`・`CAMERA-DUSKVILLAGE-001`（DONE）

## Approval
- [x] Approved — Human Request（2026-11-08 の依頼文と、洋館の入口の黒い幕の報告）
- Escalation Check: None（進行・当たり・イベント・会話・セーブは変えない）

## Work Items

| WI | 内容 | 状態 | 確認 |
| --- | --- | --- | --- |
| A | 調査（洋館・村・幽霊船の仕組み） | DONE | 調査報告 |
| B | 共通: 見せてから話すカメラ（`sceneCamShot`）・出来事の `show`・部屋の区画の部品 | DONE | unit |
| C | 洋館: 部屋ごとの区画・見せてから話す（6 か所）・入口の黒い幕（外殻・前庭を屋内で描かない） | DONE | unit・E2E・画面写真 |
| D | 村: 入れる建物の中と外・見せてから話す（7 か所） | DONE | unit・E2E・画面写真 |
| E | 自動カメラ OFF の尊重（見せる演出をしない） | DONE | unit |
| F | 試験・独立レビュー（Round 2 PASS）・文書 | DONE | 試験報告・レビュー |
| H | 追加仕様: 一度開いた扉は開いたまま・開けた扉の先は扉の両側から見え続ける（全マップ、幽霊船を含む） | DONE | unit・E2E・画面写真 |
| I | 追加仕様: 洋館の室内の扉 8 枚（近づくと開く） | DONE | unit・E2E・画面写真 |
| J | 追加仕様: 村の屋外は常に描く（建物の中身だけ分ける） | DONE | unit・画面写真 |
| K | 追加仕様の独立レビュー（Round 2 PASS） | DONE | レビュー |
| L | 追加仕様: イベントの自動移動・強制カメラの見直し（酒場の鍛冶士の再会はプレイヤーが近づくと会話、村の入口の主人公の歩みと強制カメラを削除、交代は歩む人をカメラで見せる。維持と削除の理由は調査 §7-1） | DONE | unit・E2E |
| M | 追加仕様の独立レビュー（Round 3 PASS） | DONE | レビュー |
| G | iPhone 実機 | **未確認（Human）** | 試験報告 §4・§5 |

## 既知の制限
- 幽霊船の `gsCamShot` は自動カメラ OFF でも動く（既存のまま。今回は対象外）
- 時計塔・神殿・水路・温室・道は今回の対象外（描画確認も未実施）
- 村の屋外は常に描く（屋外の舞台のため。調査 §6-3）
- 扉の開放状態は出撃の中で保つ（セーブには持たない。酒場へ戻ると世界ごと作り直す。既存の扉の作り）
