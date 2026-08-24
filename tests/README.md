# テスト

`basefile.html` を実際にブラウザで動かして検証する、Playwright ベースのスモークテスト。ロジックを単体で切り出すのではなく、キャラ作成〜セーブ/ロードといった実際の操作フローを自動でなぞる形。

## 実行方法

```sh
npm install
npx playwright install chromium   # 初回のみ
npm test
```

## ネットワークが無い環境で実行する場合

`basefile.html` は `<head>` で Three.js(jsdelivr)と Google Fonts を直接読み込む。外向きの通信ができないサンドボックス/CI では、ローカルに取得した Three.js を代わりに読ませる必要がある:

```sh
npm install three@0.154.0   # basefile.html が読み込むバージョンと合わせる
SOULFORGE_THREE_LOCAL="$(pwd)/node_modules/three/build/three.min.js" npm test
```

`SOULFORGE_THREE_LOCAL` が未設定なら何もせず、通常どおり実際のCDNから読み込む。

## 既知の注意点

- ヘッドレス実行はソフトウェアレンダラ(SwiftShader)を使う。実機のGPUと見え方が異なることがあり、実際に `buildWorld()` を連続で呼び出す一部の組み合わせで床のテクスチャが正しく再現されないことがある(GPU上では未確認)。ロジック面のアサーション(状態・DOM)には影響しない
- `basefile.html` のバージョンを更新したら、`SOULFORGE_THREE_LOCAL` に使うローカル取得分も同じバージョンに揃えること
