# ROAD-VISUAL-002 — 道（名もなき街道）の見た目の改良（案 B）の実装

Status: CLOSED（段階1 = PR #125 で完了。段階2〜6 は DEC-025 E-6 で取り下げ。新しい道 ROAD-VISUAL-003 へ移す）

基準: main `0fc4572`。ブランチ: `claude/dazzling-maxwell-y3msf3`。main へはマージしない（Human が判断）。
調査・設計: `.ai/reports/ROAD-VISUAL-001-analysis.md` / `-design.md`
Human Decision: `.ai/decisions/DEC-024-road-visual.md`

## Approval
- [x] 設計方針の承認 — Human 2026-11-14（HD-R1〜R6）。実装後のレビュー・マージの承認は別
- Escalation Check: None（HD-R4 の実装は W3-3 未承認のため保留。DEC-024）

## W3-3 との依存関係
| 段階 | W3-3（共通ビジュアル基準）への依存 | 扱い |
| --- | --- | --- |
| 1 描画の工夫（InstancedMesh） | なし（見た目は同じ） | 実施（本 PR） |
| 2 光と色（`WORLD_MOOD.road` の露出・太陽・半球光、HD-R4） | **あり**（W3-2: 露出、半球光と主光の比） | **保留**。W3-3 の承認後に別 PR |
| 3 道の脇と景色の段階（茂み・草・野花・木の位置） | なし（既存の色・テクスチャ生成） | W3-3 の基準ができたら色を合わせ直す |
| 4 地点の飾り（道標・小川の岸と水のきらめき・休憩所の木と荷） | なし（同上） | 同上 |
| 5 丘の先（歩ける範囲の外の斜面・遠景）とカメラ演出（HD-R3） | なし | ― |
| 6 加入前の影だまり（HD-R5） | なし（輪郭・素材の基準ではなく、影だまりの大きさと濃さ） | ― |

## 変更対象ファイル（段階ごと）
| 段階 | 変更する | 変えない |
| --- | --- | --- |
| 1 | `src/legacy/parts/14-dungeon-road.js`（`buildRoad` の木・石垣・木の部材、`buildRoadInstances`）、新規 `tests/road-visual.spec.js`・`tests/unit/road-visual.test.js` | 下の「全段階で変えない」 |
| 2（保留） | `src/legacy/parts/02-world-common.js`（`WORLD_MOOD.road` の数値だけ） | |
| 3・4 | `14-dungeon-road.js`（`buildRoad` の飾り。InstancedMesh で種類ごとに1回の描画）、`tests/road-visual.spec.js`（地点の撮影） | |
| 5 | `14-dungeon-road.js`（丘の先の景色、`playRoadEnding` の冒頭のカメラ） | 台詞・順番 |
| 6 | `14-dungeon-road.js`（`buildRoadTravelerFigure` の影だまりの見た目だけ） | `PRE_JOIN_SHADOW_LAG`・`trackPreJoinShadow` |

全段階で変えない: `07-ai-combat.js`（敵）・`core/chapter1-progress.js`・`core/scenario-waypoints.js`・セーブ・`12-progression-ui.js`・`ROAD_BOUNDS` と主要な位置・イベントの帯と順番・台詞・`roadHandOff`（加入処理）・点光源の数。`tests/unit/road-visual.test.js` がソースで確かめる。

## 段階1の結果（2026-11-14、この環境の headless・844×390 タッチ、既定のカメラ）
景色の描画回数 =（敵を隠した描画）−（主人公・支援・敵だけの描画）。影の更新を止めた1回の描画。`tests/road-visual.spec.js` が出力する。

| 地点 | 景色の描画回数 前 → 後 | フレーム全体の描画回数 前 → 後 | 三角形 前 → 後 |
| --- | --- | --- | --- |
| 入口（z4） | 14 → 9 | 330 → 325 | 15.5k → 19.5k |
| 道標の手前（z11） | 26 → 15 | 336 → 325 | 15.2k → 19.1k |
| 橋の手前（z52） | 17 → 9 | 327 → 319 | 15.0k → 18.8k |
| 休憩所の手前（z69） | 17 → 11 | 327 → 321 | 15.0k → 19.0k |
| 丘の手前（z97） | 11 → 7 | 321 → 317 | 14.9k → 18.6k |

- 道のメッシュ 610 → 462（−148）、geometry 278 → 130。木の幹・葉・石垣・木の部材が、それぞれ1回の描画（柱は形ごとに2回）
- **景色の描画回数は約 35〜42% 減ったが、フレーム全体では 1〜3% しか減らない**。改良前も、画面の外の木・石垣はカメラの範囲外として描かれていなかったため
- フレーム全体の約 310 回は、景色ではなく**主人公のメッシュ（約 309 個）**から来ている。道に限らず全マップに共通の負荷で、本 Work Item の範囲外（キャラクターは変えない）。別の Work Item の候補として記録する
- 三角形は約 4k 増える（InstancedMesh は全部の木を毎回描く）。iPhone では描画回数のほうが重いので、こちらを選ぶ
- この段階の本当の効果は「段階3〜5で茂み・草・野花を何十個足しても、種類ごとに描画1回で済む」こと。`ROAD_SCENERY_CALL_BUDGET = 40` で上限を固定した
- 見た目は改良前と同じ（スクリーンショットの比較。既定のカメラでは木・石垣はほぼ画面の外）
- FPS（ソフトウェア描画、参考値）: 7.6〜8.2 → 7.7〜8.2。差は測定の揺れの範囲

## 段階1の試験
- unit: `node --test 'tests/unit/*.test.js'` 2244 pass / 0 fail（新規 `road-visual.test.js` 5 件を含む）
- E2E: `road-visual.spec.js`・`road.spec.js`（2）・`chapter1-tower-to-road.spec.js`（2）・`chapter1-late-scenarios.spec.js`（5）すべて pass
  （1回目に `chapter1-tower-to-road` の通しが「ページの再読み込み」で落ちた。試験中に `14-dungeon-road.js` を編集して開発サーバーが再読み込みしたため。編集なしの再実行で pass）
- 独立 Reviewer: Round 1 PASS（minor 2・nit 3）。minor 2 件（柱の形・影の更新の止め方）と nit 1 件（`ROAD_TRUNK_RATIO`）を直した

## Work Items
| 段階 | 内容 | 状態 |
| --- | --- | --- |
| 1 | 描画の工夫（InstancedMesh）と描画回数の E2E | DONE（本 PR） |
| 2 | 光と色（HD-R4） | 取り下げ（DEC-025） |
| 3 | 道の脇と景色の段階 | 取り下げ（DEC-025） |
| 4 | 地点の飾り | 取り下げ（DEC-025） |
| 5 | 丘の先とカメラ演出（HD-R3） | 取り下げ（DEC-025） |
| 6 | 加入前の影だまり（HD-R5）と実機確認 | 取り下げ（DEC-025） |
| — | iPhone 実機 | **未確認（Human）** |

## Agent Decisions
- 段階を1つずつ PR にし、前の段階がマージされてから次へ進む（Human の「段階ごとにスクリーンショットとテスト結果を確認する」）
- 木・石垣は InstancedMesh（静的バッチではなく）。石垣の箱の向き（±0.1 rad）と葉の色の違いをそのまま残せるため。葉の3色は instanceColor
- 柱は形（上下の半径・角の数）ごとに InstancedMesh を分ける（道標 1 本・休憩所 4 本で描画2回）。元の寸法のまま（Reviewer の指摘）
