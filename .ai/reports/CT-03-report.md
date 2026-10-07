# CT-03 Report — 時計塔の締め

| 項目 | 内容 |
| --- | --- |
| Work Item ID | CT-03 |
| Goal | §4-4 ボス前・盗賊の過去、§4-5 跳ぶ瞬間・島・翌朝の酒場を本編に置き、道へつなぐ |
| 変更ファイル | `07-ai-combat.js`(時喰らいの台詞に本編のみ1行、周回用を使わない)、`06-player-enemy.js`(`setLookout` に省略可の `finaleLines`、`beginFinale` がそれを使う。既定は従来の台詞)、`03-dungeons-mansion-temple.js`(盗賊の過去の部屋イベント、`CLOCKTOWER_CHAPTER1_LEAP` / `CLOCKTOWER_CHAPTER1_ISLAND`)、`12-progression-ui.js`(道の導入に本編のみ3行)、`tests/unit/clocktower-finale.test.js`(新規 8件)、`tests/unit/clocktower-story.test.js`(stub に `collapsing` を追加) |

## 判断
- 盗賊の過去は仕様では「射出台の前」。見晴台は乗った瞬間に終幕が始まる(タイルを探させない既存の作り)ので、崩壊の後・見晴台へ上がる前の文字盤の裏に置いた(CT-01 §3)
- 終幕は台詞だけを差し替えられるようにした(`setLookout` の6番目の引数、省略時は従来どおり)。歩く・跳ぶ・着水の手順は同じ
- 島の人影は地の文で描く。遠景のグラフィック(加入前の見た目、影の遅れ)は CR-02 で作る部品を使って足す(CR-02 の範囲に記録)
- 酒場の時計の返却は道の導入(主人と話すたび)に入れた。セーブ項目を増やさないため、二度目以降も同じ会話になる

## テスト
- 新規 8件(本物の buildBoss の設定 + startBossDialogue、setLookout + beginFinale、buildClocktowerChapter1Story、SCENARIO_TAVERN_DIALOGUE.road)
- 変異確認4件(ボス台詞の本編条件 / 終幕の差し替え / 盗賊の過去の崩壊条件 / 道の導入の本編条件)→ 全て失敗を確認して戻した
- `npm run test:unit`: 全件 pass
- E2E: 時計塔・道・影の人物に触れる spec 一式: 50 passed

## Reviewer
- PASS(Round 1)。ボスの性能、崩壊・見晴台・着水の仕組み、進行の判定、セーブ項目は不変。加入前の人物の名前・職業名を出していない(N-4)。Decision Record 不要(DEC-004 の範囲内)

## Status
- IMPLEMENTED / PLAYABLE / VERIFIED(自動テスト)。島の遠景の人影は CR-02 で追加。実機の通しは CT-05 → Human(HE-2)
