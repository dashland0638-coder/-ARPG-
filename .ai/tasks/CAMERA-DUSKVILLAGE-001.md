# CAMERA-DUSKVILLAGE-001 — 宵待ちの村に「見せてから話す」カメラを入れる

Status: **DONE**（CAMERA-001 で実装。`.ai/tasks/CAMERA-001.md`、`.ai/reports/CAMERA-001-*.md`）。iPhone 実機は未確認
方針の正本: `docs/DUNGEON_RENDERING.md` §3

## Goal
- 重要な建物や物を映してから会話を始める
- 村の中の移動方向や位置関係を認識しやすくする
- イベント時のカメラを調整する
- プレイヤーが対象を見てから会話を理解できるようにする

## Notes
- 幽霊船の考え方を参考にする。設定はそのまま写さず、村（屋外・広場と通りの繋がり）に合わせる
- `updateCamera` の村だけに効く分岐にする（他のシナリオへ影響させない）
