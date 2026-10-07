# CG-04 Report — 幽霊船の本筋と物語の並び

| 項目 | 内容 |
| --- | --- |
| Work Item ID | CG-04 |
| Goal | 本筋のつながりと、物語の会話が本筋の区間に順番どおり入っていることを unit で固定 |
| 変更ファイル | `tests/unit/ghostship-route.test.js`(新規 2件)、`.ai/tasks/CG-04.md`、本書。ゲームのコードは変更なし |

## テスト
- `node --test tests/unit/ghostship-route.test.js`: 2/2 pass
- 変異確認4件(晩餐の間の範囲を船長室側へ移す/甲板の範囲を階段の判定圏の中へ縮める/甲板の階段に関門を足す/船長室の範囲を cabinDoor から外す)→ 全て失敗を確認して戻した
- `npm run test:unit`: 全件 pass
- 幽霊船の個別テストは CG-02(7件)・CG-03(9件)・CG-04(2件)の計18件

## Reviewer
- PASS(Round 1)。テストのみ。アサーションの緩和なし

## Status
- 幽霊船の物語: IMPLEMENTED / PLAYABLE / VERIFIED(自動テスト)。Content Ready は Human の実機通し(CG-05 の手順)の後
