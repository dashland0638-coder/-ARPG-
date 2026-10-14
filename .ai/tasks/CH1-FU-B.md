# CH1-FU-B — 宵待ちの村: ボスエリアの門の向き

依頼: Human「CH1-EXP Follow-up」Work Item B（P1、2026-10-14。iPhone 実機で発見）。
Approval: Human の依頼そのもの（実装の範囲は下記）。

Status: REVIEWING

## 原因
- 門は `14-dungeon-duskvillage.js` の `buildDoor('duskBossDoor', 0, 500, 6, …, 'NS')`。
- `buildDoor` の向き（`02-world-common.js`）は、扉が付く壁の向きを表す。
  - `'EW'`: 東西に走る壁。開口は x 方向。
  - `'NS'`: 南北に走る壁。開口は z 方向。東西の横道の扉に使う。
- 村の奥 → ボスエリアの開口は、z = 500 の東西の壁にある（`core/dusk-village-map.js` の `deep.gaps.N = [-3, 3]`）。
  - 正しい向きは `'EW'`。
  - `'NS'` だったため、門扉が通路に沿って 90° 回って立っていた。
- 当たり判定も同じく回っていた。
  - `{x ±0.4, z 497〜503}` という開口の真ん中の細い板だけで、開けなくても脇を通れた。
- ジオメトリ・親の回転・共通の `buildDoor` には誤りが無い。誤りはこの呼び出し 1 か所の引数だけ。

## Implementation
- `src/legacy/parts/14-dungeon-duskvillage.js`: `'NS'` → `'EW'`。
  - 位置（0, 500）と幅（6）は変えない。開口 x −3〜3 をちょうど塞ぐ。
- 新規 `tests/unit/dusk-boss-door.test.js`。部屋の表の開口と扉を突き合わせる。確かめていること:
  - 扉は境の壁（z = 500）の上にある。
  - 両側の開口が一致する。
  - 向きが EW。
  - 中心と幅が開口と同じ。
  - 当たり判定が開口の幅いっぱい。

**変えていないもの**

- 共通の `buildDoor`（他の 20 余りの扉は影響なし）。
- 部屋・壁・イベントの位置。
- ボスの目覚めの条件（扉ではなく近づいたら。`buildDuskVillageEcho` のコメントのとおり）。
- ボスの手前の演出（z = 496、半径 6。扉の手前で起きる）。
- テストモードのボス地点（z = 515。扉の内側）。

**挙動の変化（意図どおり）**

- 門は通路を塞ぐので、ボスエリアへは R（タッチは「調べる」）で門を開けて入る。
- 他の扉と同じ操作になる。
- 以前は開けなくても脇をすり抜けられた。

## Test
| 確認 | 結果 |
| --- | --- |
| 新規 `dusk-boss-door.test.js` | 修正前のソースで FAIL、修正後 2 PASS |
| `npm run test:unit` | 1812 PASS / 0 FAIL |
| `npm run build` | PASS |
| E2E `duskvillage`・`chapter1-dusk-basics`・`scenario-test-mode`・`chapter1-late-scenarios`（ローカル） | 15 passed |

見た目のスクリーンショットは、村の暗さとカメラの位置で門が写らず、証拠にならなかった。見た目は実機で確かめる。

## 実機確認（Human）— HUMAN DEVICE CHECK REQUIRED
- 村の奥から北を見て、門が通路を横切る向き（壁と同じ面）で立っていること。
- 門の左右に隙間が無く、R で開き、開くと通れること。
- ボスの手前の演出 → 門を開ける → ボス、の順で破綻が無いこと。
