# CG-03 Report — 幽霊船の物語(後半)

| 項目 | 内容 |
| --- | --- |
| Work Item ID | CG-03 |
| Goal | §4-2 後半(船倉の警告・ボス前・ボス・撃破後・酒場の角灯) |
| 変更ファイル | `04-dungeons-ship-waterway.js`(船倉の奥の会話、`GHOST_CAPTAIN_CHAPTER1_LINES` / `GHOST_CAPTAIN_CHAPTER1_FAREWELL`)、`07-ai-combat.js`(本編のときボスの台詞を差し替え、周回用は使わない)、`12-progression-ui.js`(撃破後の結びの前に一行)、`03-dungeons-mansion-temple.js`(酒場の棚の角灯)、`tests/unit/ghostship-ending.test.js`(新規 9件)、`tests/unit/ghostship-story.test.js`(登録数 1+4 → 1+5) |

## 配置の判断
- 貨物室からの階段は扉の手前(-32,108)に着き、既存の「空気」(r4)と「船長帽の影」(r6)がその場で続けて出る。警告の彫り込み(-38,104)は着地点の背後で、読まれない場合がある。そのため §4-2 の「船倉の警告」と「ボス前」は、影の直後の一つの会話(魔法使い→弓師)にした。意味と話者は §4-2 のまま
- 角灯は木彫りの舟(3.1, 22.6)と左右対称の (-3.1, 22.6)。舟と同じく scenarioClears を見るだけ

## テスト
- 新規 9件 + CG-02 の 7件: pass。本物の startBossDialogue / clear-return-btn のハンドラ / buildBoss の設定 / 酒場の角灯のブロックを stub 付きで実行
- 変異確認5件(ボス台詞の条件・周回台詞の条件・撃破後の条件・角灯の条件・船倉の順序)→ 全て失敗を確認して戻した
- `npm run test:unit`: 全件 pass

## Status
- IMPLEMENTED / PLAYABLE(本筋上)/ VERIFIED(自動テスト)。実機の通しは CG-05 → Human(HE-2)
