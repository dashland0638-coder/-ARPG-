# CT-04 Report — 時計塔の本筋と物語の並び

| 項目 | 内容 |
| --- | --- |
| Work Item ID | CT-04 |
| Goal | 本筋のつながり・関門・物語の並び・周回用拡張の扱いを unit で固定 |
| 変更ファイル | `tests/unit/clocktower-route.test.js`(新規 4件)、`.ai/tasks/CT-04.md`、本書。ゲームのコードは変更なし |

## テスト
- 本物の TOWER_ROOMS / TOWER_STAIRS を読み、31 区間(部屋の出入口の重なり・階段の乗り口と着地)を順に確かめる
- 変異確認3件(歯車の間の北の出入口をずらす / 関門を 4F の階段へ移す / 1F の会話を脇の部屋へ移す)→ 全て失敗を確認して戻した
- `npm run test:unit`: 全件 pass
- 時計塔の個別テストは CT-02(12件)・CT-03(8件)・CT-04(4件)の計24件

## Reviewer
- PASS(Round 1)。テストのみ
