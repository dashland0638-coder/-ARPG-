# CT-02 Report — 時計塔の物語(1F〜5F 前室)

| 項目 | 内容 |
| --- | --- |
| Work Item ID | CT-02 |
| Goal | §4-3 の酒場の1行と §4-4 の 1F〜5F 前室を本編の時計塔に置く |
| 変更ファイル | `03-dungeons-mansion-temple.js`(`clocktowerChapter1` / `buildClocktowerChapter1Story`、`buildClocktower` から呼ぶ)、`14-hud-boot.js`(`CHAPTER1_JOIN_LINES.rogue` に弓師の1行)、`tests/unit/clocktower-story.test.js`(新規 12件)、`tests/unit/ghostship-story.test.js`(時計塔への交代の行数 4 → 5) |

## 配置

| 階 | 発火 | 話者 |
| --- | --- | --- |
| 1F 鐘楼の玄関 `t1hall` | 部屋に入ったら | 盗賊 |
| 2F 歯車の間 `t2gear` | 管理人の手帳を読んだら / 読まずに `t2cor2` へ出たら | 弓師 → 盗賊 |
| 3F 針の回廊 `t3hands` | 娘の書き置きを読んだら / 読まずに `t3cor2` へ | 弓師 → 盗賊 |
| 4F 鐘の広間 `t4bell` | 譜面を読んだら / 読まずに `t4cor2` へ | 弓師 |
| 5F 文字盤の前室 `t5ante` | 新しい手記「管理人の外套」(-296,36,192)を読んだら / 読まずに `t5cor1` へ | 盗賊 → 弓師 |
| 酒場(交代) | 主人の1行目の次 | 弓師(前の主人公) |

## テスト
- 新規 12件: 本物の registerRoomEvent / registerProximityEvent / updateProximityEvents / buildClocktowerChapter1Story を、本物の TOWER_ROOMS / TOWER_SLABS の座標で動かす
- 変異確認3件(本編条件の削除 / 読んだかどうかの条件の削除 / 通路の排他の削除)→ 全て失敗を確認して戻した
- `npm run test:unit`: 全件 pass
- E2E: 時計塔に触れる spec(結果は PR に記載)

## Reviewer
- PASS(Round 1)。謎解き・封鎖戦・扉・階段・敵・ボス・セーブ項目は不変。加入前の5人目には触れない。Decision Record 不要(DEC-004 の範囲内)

## Status
- IMPLEMENTED / PLAYABLE(本筋上)/ VERIFIED(自動テスト)。実機の通しは CT-05 → Human(HE-2)
