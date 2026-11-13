# ENEMY-VISUAL-002 — 試験報告（Tester）

## 結果
| 種類 | コマンド | 結果 |
| --- | --- | --- |
| Build | `npx vite build` | OK |
| Unit | `node --test` | 2228 pass / 0 fail（SVG カタログの既存の skip 1 件は checkout に catalog が無いためで、この変更と無関係） |
| Protocol | `.ai/tasks` / `.ai/reports` / `.ai/decisions`（DEC-021）を作成 | OK |
| E2E（1 回目、レビュー前） | ghostship-chapter1 / ghostship-archer-skill2 / clocktower-rogue-skill2 / mansion-scenario / mansion-lord / mansion-enemies / mansion-butler / mansion-warden / mansion-escort / chapter1-dusk-basics / tavern-smith-greeting / action-zone / notifications | 57 passed（20.2 分）。skip・retry なし |
| E2E（2 回目、Round 1 の修正後） | ghostship-chapter1 / ghostship-archer-skill2 / mansion-scenario / clocktower-rogue-skill2 | 14 passed（8.0 分） |
| E2E（3 回目、Round 2 の修正後） | ghostship-chapter1 / mansion-enemies / mansion-scenario / clocktower-rogue-skill2 | 17 passed（8.7 分） |
| CI（GitHub Actions） | PR #122 のチェック | `ca99d32`・`f25f221`・`921e082`・`2acc82b` で失敗なし |

assertion を弱めた変更は無い。消した assertion は消えた仕組み（回復結晶・チェックポイント）を確かめていたものだけで、
代わりに「無いこと」を確かめる assertion を足した（`healing-objects-removed.test.js`）。
宝箱の数の assertion（洋館の supply 2 → 4）は仕様の変更（回復の調整）に合わせて値を変え、食堂が supply であることを足した。

## 追加したテスト
- `tests/unit/ghostship-foes-uncanny.test.js`: 三種の造形（非対称・長い腕と関節・尾・拳で這う・六本脚・顎・疑似餌）、遅れる部位、実体化と崩れ、
  溶接による共有、湧き直しのリセット、錨の投擲の向き・頭の向き・床に置く物の水平、**時計塔の敵の関数の中身の指紋（不変の確認）**
- `tests/unit/healing-objects-removed.test.js`: 回復結晶・姿見・チェックポイントの識別子が src に無い、一般の回復（薬草・魔力の雫・supply）は残る、保存の版は 2 のまま

## 見た目と負荷（ヘッドレス Chromium・SwiftShader。数値の絶対値は実機と違う）
- 改修前後の比較画像（idle / 予兆 / 振り抜き / 硬直 / 移動、6 種）と、6 種を並べた遠景で、シルエットの違いを確認
- 描画される部品の数（輪郭・透視の殻を含む）: 亡霊 18 → 35、溺死 24 → 38、錨 33 → 47、異形 33 → 44、変異 36 → 48
- 6 体を並べた遠景の描画回数: 441 → 549（＋108。1 体あたり＋18）。FPS は 10.2 → 9.4（SwiftShader。CPU 描画のため参考値）
- 点光源の数は変わらない（16 / 点光源 13 で同じ）

## iPhone（未確認 — Human）
- 幽霊船の 1 部屋（2〜3 体）での FPS・発熱
- 霧の帯・尾（半透明）が重なった時の描画の重さ
- 遠目・小さい画面でのシルエットの読み分け、予兆（頭が跳ね起きる・刃の光・甲殻が開く）の見え方
- 洋館の回復の減り（結晶 3・姿見）と、宝箱 2 つの supply 化の釣り合い（実際の通しプレイでの体感）
