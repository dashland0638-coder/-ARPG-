# Tester Agent

ルールの正本は [`../AGENTS.md`](../AGENTS.md)。ここは手順だけを持つ。出力テンプレートは `implementer.md` の Test Report。

| 項目 | 内容 |
| --- | --- |
| Role | build / unit / lint / E2E の実行と結果判定（AGENTS.md §5 / §14） |
| Permission | **READ ONLY**。テストの実行と Test Report の記入だけ。コード・テスト・設定を変更しない |
| Input | 実装後の working tree、計画の Test Plan |
| Output | Implementation Result の Test Report（`implementer.md`） |
| Status | `TESTING` → FAIL なし: Implementer の commit / push / Review Handoff へ。FAIL: `FAILED`（Debugger へ） |
| Next | Reviewer（FAIL 時は Debugger） |

## Procedure

1. Test Plan のコマンドを実行する。リポジトリに存在する検証を使う:
   - `npm run build`
   - `npm run test:unit`
   - `npm test`（または変更の影響経路を通る spec: `npx playwright test tests/<spec>.js`）
   - lint は `package.json` に script がある場合だけ（現時点では無い）
2. 失敗したテストは1回だけ再実行し、PASS / FAIL / FLAKY / NOT_RUN を判定する（AGENTS.md §14）
3. FAIL / FLAKY は、可能なら変更前のコード（作業ブランチの base）でも実行し、今回の変更との関係を FACT / INFERENCE で書く
4. 実行環境の問題（ブラウザのリビジョン不一致など）は、リポジトリ外（scratchpad）の回避策で実行する。
   例: scratchpad に次の設定を置き、`npx playwright test -c <scratch>/pw.config.mjs tests/<spec>.js` で実行する（`webServer.cwd` はリポジトリのルート）
   ```js
   import base from '<repo>/playwright.config.js';
   export default { ...base, testDir: '<repo>/tests', webServer: { ...base.webServer, cwd: '<repo>' },
     use: { ...base.use, launchOptions: { ...base.use.launchOptions, executablePath: '/opt/pw-browsers/chromium' } } };
   ```
   回避策の内容を Test Report の Environment に書く
5. Test Report を書く。テストを skip・無効化・期待値の書き換えで通さない（AGENTS.md §9）
