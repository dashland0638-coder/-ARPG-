# CI-001 Analyzer report（GitHub Actions `Test` の恒常的な失敗）

| 項目 | 値 |
| --- | --- |
| Task ID | CI-001 |
| Branch | `claude/agent-autonomous-execution-ewtk87` |
| 基準 SHA | `e8f77b8ac385b8088b0abf87d97b62f268ccb5ce` |
| Persisted by | Agent（Orchestrator。AGENTS.md §5.2） |
| 日付 | 2026-10-02 |
| 出典 | UI-002-D 統合監査の R-1（`.ai/tasks/UI-002-D.md` WI-D7、PR #32 のコメント） |

## 1. 事実（CI の記録）

- `.github/workflows/test.yml`（`pull_request` / `workflow_dispatch`）: `npm ci` → build → `npm run test:unit` → `npx playwright install --with-deps chromium` → `npm test`（Playwright、`workers: 1`、`fullyParallel: false`、retries の設定なし、`timeout: 45_000`、headless + SwiftShader）
- 記録のある **26 run（完了分）がすべて failure**。UI-002 より前（run #1 = 2026-09-25、別ブランチ）から同じ
- 失敗するのは E2E だけ。build・unit は毎回 PASS
- 失敗の数は run ごとに 1〜19 件で、**run の所要時間と連動する**:

| run | 所要時間 | 失敗 | 備考 |
| --- | --- | --- | --- |
| #1（2026-09-25、P-10 analysis） | 2.2h | 14 | UI-002 より前 |
| #9（UI-002-C1） | 2.4h | 14 | |
| #16（WI-D5） | 2.8h | 18 | 4 run が同時に走っていた |
| #20（WI-D6 計画、D6 の実装前） | 2.4h | 2 | |
| #21・#23・#24・#25（WI-D6） | 2.7〜2.9h | 16〜19 | 4 run が同時に走っていた |
| #22 | 2.1h | 1 | |
| #26（統合監査） | 1.4h | 2 | |

- どの run でも落ちるのは同じ顔ぶれ（「コア集合」）: `base-class-comparison:111`、`base-class-identity:51/85/376/413`、`character-motion:142/394`、`mansion-escort:126`、`mansion-scenario:70/145`、`save-load:99/131`、`settings:6`、`shadow-guide:12`、`tavern-smith-greeting:65`、`combat-test-arena:14`、`air-actions:*`、`ui-proto-gate:48/92`。速い run では `mansion-escort:126` など数件だけ
- 依存（`npm ci` の lockfile）・Playwright / Chromium（CI は `npx playwright install` で lockfile の版と一致する Chromium を入れる）・workflow の手順は run の間で同じ

## 2. 再現（ローカル）

この環境（Xeon 2.1GHz、4 CPU、GPU なし）で、CI の構成（同じ `playwright.config.js`、SwiftShader）のまま測った。Chromium の版の違い（AD-001: リポジトリ外の設定で `executablePath` だけを差し替え）は CI には無い差で、結果には影響しない（下の fps は同じ SwiftShader の描画）。

| 条件 | プレイ中の fps（1280×800） | ゲーム内の時間 / 実時間 | コア集合 15 spec（67 件） |
| --- | --- | --- | --- |
| 4 CPU | 4.8〜5.2 | 約 0.25 | 66 PASS / 1 FAIL（`base-class-identity:413`） |
| 2 CPU（`taskset -c 0-1`。GitHub の private リポジトリの `ubuntu-latest` は 2 vCPU） | 2.8〜2.9 | 約 0.14 | **43 PASS / 23 FAIL / 1 FLAKY**（CI の遅い run とほぼ同じ顔ぶれ） |

- fps は解像度に比例して下がる（844×390: 12、640×400: 14）。品質設定・影・Chromium の GPU フラグ（`--use-angle=swiftshader` 等）では変わらない。メインスレッドの JS は 1 フレーム約 2.6ms で、残りは SwiftShader の描画（CPU）
- **CI の失敗は CPU の数（= 機械の速さ）で再現する**。テストの並列実行はしていない（`workers: 1`）ので、同じ run の中のテスト同士の干渉ではない

## 3. 原因

### 3.1 主因: ゲーム内の時間が描画の速さに比例して遅れ、テストは実時間で待っている

- `animate()`（`14-hud-boot.js`）はシミュレーションの 1 歩を `Math.min(0.05, clock.getDelta())` で 50ms に頭打ちにしている（すり抜け防止の正しい設計。COMBAT_DESIGN.md §4 に「ヘッドレスではゲーム内時間が実時間より遅れる」と既に記録）。1 フレーム 1 歩なので、20fps を下回るとゲーム内の時間は `0.05 × fps` 倍でしか進まない
- E2E は `waitForTimeout`・`expect` の timeout などの**実時間**でゲーム内の出来事（攻撃の命中・クロスフェード・歩く演出・処刑の窓）を待っている。待ち時間は各 spec の作者の環境の速さに合わせて決められていた（例: `tavern-smith-greeting` の `GREETING_WAIT_MS` は「2〜3fps で約 43 秒」から 120 秒）
- そのため **CI の機械の速さが変わると、ゲーム内の時間の進みが変わり、落ちる spec が変わる**。遅い機械（2 vCPU、混雑時）ほど多く落ちる。実例:
  - `mansion-escort:126`: 停止から 2.5 秒（実時間）でクロスフェード（約 0.5 秒、ゲーム内）が寄り切る前提 → 0.14 倍では 0.35 秒しか進まず 0.83〜0.88 < 0.9（CI では速い run でも落ちる）
  - `base-class-*`: 攻撃から 2 秒（実時間）以内のダメージ表示を待つ → ゲーム内 0.3 秒では振りの命中フレームに届かない
  - `character-motion:394`: ATTACK の局面を通ったか / `:142` Freeze の切り替えの表示（0.5 秒ごと、ゲーム内）を 3 秒（実時間）で待つ
  - `tavern-smith-greeting:65`: 歩く演出 4.4 秒（ゲーム内）を 120 秒（実時間）で待つ → 0.035 倍以下（1 fps 未満）で超える

### 3.2 副因: SwiftShader の描画が CPU を使い切り、ページの応答そのものが遅れる

- 2 vCPU では、描画（GPU プロセスの SwiftShader）・ページのメインスレッド・Vite・Playwright が CPU を取り合う。クリックへの反応・DOM の更新・ページの起動が遅れ、**45 秒の既定の test timeout**（`save-load`・`settings`・`ui-proto-gate`）や、`combat-test-arena` の「クリックから 2 秒以内のログ」が実時間で足りなくなる
- 描画の解像度を下げると CPU の負荷が下がる（2 CPU で `deviceScaleFactor` 1 → 0.5 にすると 2.8 → 7.9fps）。CSS の寸法・座標・レイアウトは変わらない（ゲームは `renderer.setPixelRatio(devicePixelRatio)` で描画の解像度だけを決めている。他に `devicePixelRatio` を使う所は無い。spec にも無い）

### 3.3 付随: CI の設定

- `concurrency` が無く、同じ PR への push ごとに 1.5〜3 時間の run が並んで走る（例: 06:19〜06:36 に 5 run）。同時に走った run ほど所要時間・失敗が多い（相関。GitHub の runner は run ごとに別の VM なので、因果は推定 = INFERENCE）。結果を見るのは最新の commit だけ
- 失敗時の `test-results/`（error-context・スクリーンショット）を保存していない。CI だけで落ちた時に原因を調べる材料がログの末尾しか無い

### 3.4 個別

- `base-class-identity:413`（4 CPU でも FAIL）: Dummy の向きは出現のたびに一様ランダムで、正面（±0.65rad、約 21%）が出るまで最大 40 回出し直す。1 回の出し直し（パネルの開閉・クリック 6 回）が実時間で数秒かかり、180 秒の test timeout の中で回数が足りない。ゲーム内の時間とは関係が薄く、3.1 の修正では直らない可能性がある → 実装後に再評価する
- `execution-break:99` は WI-D7 でテストの古い値の読み取りを修正済み（T-4）

## 4. 分類

| 分類 | 該当 | 判断 |
| --- | --- | --- |
| 環境依存（GPU なし・CPU 数） | 主因の前提。2 vCPU で再現 | 環境は変えられない。下の 2 つで機械の速さへの依存を外す |
| test timing（実時間で待つ） | 3.1 の spec 群 | **時間の基準を揃える**（自動テストではゲーム内の時間を実時間に追いつかせる）。個々の待ち時間を延ばすのではない |
| CPU 飽和（応答の遅れ） | 3.2 の spec 群 | **描画の解像度を下げる**（Playwright の設定。レイアウトは不変） |
| workflow configuration | 3.3 | `concurrency`（古い run を取り消す）・失敗時の結果の保存 |
| parallel interference（同じ run の中） | なし | `workers: 1`。干渉は無い |
| state leakage / test isolation | なし（観測されず） | 失敗は spec の順序ではなく機械の速さに連動 |
| selector instability | なし | 失敗はセレクタの不一致ではなく時間切れ・値の未到達 |
| application bug | なし | 速い機械では同じ spec が PASS。ゲームの判定は変えない |
| Playwright / Chromium mismatch | CI には無い | CI は lockfile と一致する Chromium を入れる。ローカルだけ AD-001 の回避策 |
| dependency / version | なし | lockfile 固定。Node 20 の非推奨は警告のみ |
| test design（乱数の探索） | `base-class-identity:413` | 3.1・3.2 の後に再評価 |

## 5. 対策の方針（Planner への入力）

- 1 つの Work Item（CI-001）で行う
- **(a) 時間の基準**: 自動テストで操作されているブラウザ（`navigator.webdriver === true`。WebDriver の仕様で Playwright・Selenium が立てる。通常のブラウザでは false）だけ、遅いフレームのぶんシミュレーションを 50ms 以下の歩に分けて実時間へ追いつかせる。描画は 1 フレーム 1 回のまま。通常のプレイ（1 フレーム 1 歩・50ms 上限）は変えない。20fps 以上の端末で 1 フレーム 1 歩進むのと同じ刻みなので、テストが見るゲームの挙動は「遅い端末のスローモーション」ではなく通常の速さになる
- **(b) 描画の負荷**: `playwright.config.js` の `use.deviceScaleFactor: 0.5`（ローカルと CI で同じ設定）
- **(c) workflow**: `concurrency`（PR ごとに古い run を取り消す）と、失敗時の `test-results/` の保存
- 行わないもの: retry の追加、test timeout の一律の延長、spec・assertion の削除や緩和、`test.skip`、並列の設定の変更（もともと 1 worker）
