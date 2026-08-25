# テスト

2種類ある。

- **`tests/*.spec.js`(E2E)**: `src/` のアプリを実際にブラウザで動かして検証する、Playwrightベースのスモークテスト。キャラ作成〜セーブ/ロードといった実際の操作フローを自動でなぞる
- **`tests/unit/*.test.js`(単体)**: `src/core/` の純粋関数(ダメージ倍率・ドロップ抽選・ルート分岐の組み合わせ計算)を、ゲームを起動せずに直接検証する。Node標準の `node:test` を使用(追加の依存なし)

## 実行方法

```sh
npm install
npx playwright install chromium   # E2Eの初回のみ

npm test          # E2E (Playwright)
npm run test:unit # 単体 (node:test)
```

`playwright.config.js` の `webServer` 設定により、`npm run dev` が自動的に起動してからテストが走る(既に別ターミナルで起動済みなら、そちらを再利用する)。`tests/unit/` は `testIgnore` でPlaywrightの収集対象から明示的に除外してあるので、`npm test` では実行されない。

## 既知の注意点

- ヘッドレス実行はソフトウェアレンダラ(SwiftShader)を使う。実機のGPUと見え方が異なることがあり、実際に `buildWorld()` を連続で呼び出す一部の組み合わせで床のテクスチャが正しく再現されないことがある(GPU上では未確認)。ロジック面のアサーション(状態・DOM)には影響しない
- 起動時に Google Fonts への通信が発生する(失敗してもフォールバックフォントで動作は続く)。外向き通信が無い環境ではこのリクエストだけ失敗するが、テストのアサーション自体には影響しない
