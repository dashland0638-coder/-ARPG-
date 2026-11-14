# CLOCKTOWER-MAP-001 — 試験報告（Tester）

| 種類 | 結果 |
| --- | --- |
| Build | 成功 |
| Unit | `node --test` 2238 pass / 0 fail（既存の SVG カタログの skip 1 件は無関係）。新規 `tests/unit/clocktower-veil.test.js` |
| Protocol | タスク・分析・試験・レビュー・DEC-023 |
| E2E（新規） | `tests/clocktower-view.spec.js`: 街だけをマゼンタで描いて画素で数える。塔の中 16 か所（1〜4層・縦穴の周り・坂 r0/r1/r3 の途中と上の手前）× 向き 8 × 高さ（低め・高め）＋ 自動追従 4 で **0 画素**。壁際 4 か所でカメラは向きの側（反転しない）。門の口でも 0 画素。隠し歯車庫では面もカメラの留めも効かない。**鐘楼では 200 画素より多い**（街が開ける）。直す前は同じ試験で漏れを再現（坂 r0 の途中 1928 画素、坂 r3・4 層の北など） |
| E2E（回帰） | clocktower-view / clocktower-rogue-skill2 / chapter1-tower-to-road / chapter1-late-scenarios / weapon-stow ほか: 21 passed（Round 1 の前）。Round 1 の修正後は下の追記 |

## 改修前後（844×390）
- 坂 r3 の途中・坂 r0 の途中: 改修前は低い壁の上に塔の外（夜の海・光）が見えていた → 改修後は石積みの外壁
- 鐘楼: 改修前後とも、胸壁の向こうに眼下の街

## iPhone 実機（未確認 — Human）
- 塔を登る間、壁の上・坂から街が見えないこと（カメラの高さ・自動追従の設定を変えて）
- 外壁の際でカメラが寄った時の見やすさ（特に坂）
- 鐘楼に出た瞬間に街が開けること
