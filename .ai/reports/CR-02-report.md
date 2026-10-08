# CR-02 Report — 道の導入と正体不明の人物

| 項目 | 内容 |
| --- | --- |
| Work Item ID | CR-02 |
| 目的 | 加入前は正体不明の人物(話者名「？？？」・加入前の姿・遅れる影)、正式加入で「影の旅人」を開示(DEC-004 N-4)。島の人影と道の会話を §4-5 / §4-6 どおりに置く |
| 変更ファイル | `14-dungeon-road.js`(`ROAD_STRANGER`、橋・休憩所の本編の追加行、加入前の影の遅れ `trackPreJoinShadow` / `updatePreJoinFigures` / `clearPreJoinFigures`、立ち上がって歩き出す演出)、`12-progression-ui.js`(`shadowGuideSpeaker()`)、`03-dungeons-mansion-temple.js`(`showIslandStranger`: 対岸の崖の上の街道・薄明かり・歩く人影、着地時に本編のみ)、`02-world-common.js`(ワールド破棄で影を片づける)、`14-hud-boot.js`(会話中も加入前の人物を動かす)、`docs/CHARACTERS.md`、`tests/shadow-guide.spec.js`、`tests/road.spec.js`、`tests/unit/road-stranger.test.js`(新規 10件) |

## 判断
- 道の会話は加入前の場面そのものなので、モードに関係なく「？？？」。酒場の隅だけはテストモードで従来の「影の旅人」(DEC-004「テストモードは既存の表示を壊さない形で」)
- 「島から見えた人です」「朝の鐘で出てったんだろ」は、島・主人の一言を通ってきた本編のときだけ(テストモードは島を通らない)
- 島は高さ 2.3 の石垣で囲まれている。対岸は一段高い崖の上(y=4.5)の明るい街道にして、石垣ごしに人影が見えるようにした。カメラの向きを南側(北を見る)へ回すだけで、カメラの仕組みは変えない
- 島の地の文は会話(dialogueActive)なので、通常は世界が止まる。加入前の人物を動かす1行だけを会話中の分岐に足した(他のワールドでは何もしない)
- 既存の「影のほうが、先に動く」(休憩所で影だまりが伸びる)はそのまま。立ち上がった後の歩き出しで、影が遅れてついてくる

## テスト
- Unit: 新規 10件。変異確認5件(話者名 / 酒場の話者名 / 影の遅れ / 島の呼び出し / 橋の本編条件)→ 全て失敗を確認して戻した。全件 1698 pass
- E2E: `shadow-guide` / `road` / `scenario-test-mode` 7 passed、`chapter1-progression` / `ui-production-glyphs` / `save-load` 23 passed
- 島の見え方: 一時的なローカル patch(本編条件を外し見晴台へ移動)でスクリーンショットを撮って確認。人影は崖の上の明るい街道に、小さな黒い人影として見える(patch は戻した)

## Build
- `vite build` OK

## Reviewer
- PASS(Round 1)。加入前に「影の旅人」の語・職業名が出ない。加入時に初めて出る。戦闘・敵・数値・進行・セーブ項目・Test Mode のゲームプレイは不変。assert は弱めていない(期待値を新仕様へ更新し、加入前に名前が出ないことを追加で確かめる)。Decision Record 不要(DEC-004 の範囲内)

## Status
- IMPLEMENTED / PLAYABLE / VERIFIED(自動テスト)。実機確認(Human): 島の人影が見えるか・遠すぎないか、休憩所で影の遅れが分かるか
