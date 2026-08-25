# ソウルフォージ・プロトタイプ

見下ろし型(トップダウン)3D ARPG。Vite製のWebアプリ構成。詳しい構成・分割方針は [ARCHITECTURE.md](./ARCHITECTURE.md) を参照。

> `basefile.html` は移行前の単一ファイル版を凍結したスナップショット。今後の開発はすべて `src/` 側で行う(詳細は ARCHITECTURE.md)。

## 遊び方(開発中に手元で動かす)

```sh
npm install
npm run dev
```

表示されたURLをブラウザで開く。同じWi-Fi内であればiPhoneのSafariからも `http://<このマシンのLAN IP>:5173` で開ける(`vite.config.js` で `host:true` にしてあるため)。

1. 職業・性別・性格・名前を決め、ダイスで能力値を割り振ってキャラを作る
2. 街(酒場)を拠点に、鑑定所で装備・スキル・スフィア(アビリティ)を整える
3. 出撃メニューから6つのダンジョンいずれかへ。ボスを倒す、あるいは撤退で街に戻る
4. 進行状況は自動的にセーブされる(下記「セーブデータ」を参照)

対応入力: キーボード+マウス / タッチ(仮想スティック) / ゲームパッド(Backbone One等、USB/Bluetooth接続で自動認識)。

## ビルド・公開

```sh
npm run build      # dist/ に静的ファイル一式を生成
npm run preview    # dist/ をローカルで確認
```

`main` への push で GitHub Pages へ自動デプロイされる(`.github/workflows/deploy.yml`)。**リポジトリの Settings → Pages → Source を "GitHub Actions" に設定する必要がある(初回のみ、手動)。** 設定後は `https://<owner>.github.io/-ARPG-/` で公開される。

## 技術構成

- **描画**: Three.js(npm経由でバンドル。バージョンは `package.json` に固定)
- **テクスチャ**: 既定は`<canvas>`上での手続き生成(`src/textures/`、木目・石畳・芝生など)。実画像を登録すれば一部の面は差し替え可能(`src/textures/texture-manifest.js`、詳細はASSETS.md)
- **音楽・効果音**: 既定はWebAudio(`src/audio/`)。SEは都度合成、BGMはワールドごとに生成される環境音楽(`procedural-bgm.js`)。実ファイルを登録すればBGM/SEとも差し替え可能(`src/audio/asset-manifest.js`、詳細はASSETS.md)
- **保存**: `localStorage`。キャラ進行(`soulforge_save_v1`)と表示設定(`soulforge_settings_v1`)は別スロット
- **フォント**: Google Fonts(Cinzel / Noto Serif JP / Noto Sans JP)
- **PWA**: `public/manifest.webmanifest` あり。iPhoneでホーム画面に追加するとフルスクリーンで起動する(アイコンはプレースホルダー、差し替え歓迎)

## ファイルの歩き方

`state`(ゲーム進行状況)・オーディオ・テクスチャ生成は `src/core/`・`src/audio/`・`src/textures/` に真のESモジュールとして切り出し済み。残りは `src/legacy/parts/01〜14-*.js` に機能単位のファイルへ分割してあるが、実行時は1つの共有スコープとして連結される(理由・詳細は ARCHITECTURE.md)。

## セーブデータ

- **`soulforge_save_v1`**: キャラの進行(レベル・装備・所持品・スキル/スフィア・クリア済シナリオなど)。街に戻るたび・メニューの「セーブ」・タブを非アクティブにした瞬間・ページを閉じる直前に自動保存される
- **`soulforge_settings_v1`**: 音量・画質・画面の揺れなどの表示設定。キャラとは独立に、起動時へ復元される
- 「新しく始める」は既存のセーブを上書きする(確認ダイアログあり)
- ダンジョン内の座標そのものは保存対象外。再開時は必ず街(酒場)から始まる

## 未実装のシナリオ

`SCENARIO_DEFS` 内の `pyramid`(砂漠のピラミッド)・`volcano`(業火の火山)は `unlocked:false` のまま出撃メニューに「近日追加予定」として表示される。ワールド構築関数はまだ存在しない。

## テスト

`tests/` に2種類。E2E(`*.spec.js`、Playwright。起動〜キャラ作成〜セーブ/ロードを実際にブラウザで操作して検証)と、単体(`unit/*.test.js`、`node:test`。ダメージ倍率・ドロップ抽選・ルート分岐の組み合わせ計算などの純粋関数をゲームを起動せず検証)。詳細は `tests/README.md`。

```sh
npx playwright install chromium   # E2Eの初回のみ
npm test          # E2E
npm run test:unit # 単体
```

`playwright test` は `npm run dev` を自動起動してから実行する。詳細は `tests/README.md`。

## 既知の制約

- `buildWorld()`(ワールド構築)と `continueGame()`(セーブ復元)には例外を捕捉して街へフォールバックする処理が入っているが、それ以外の境界は薄い
- `src/legacy/parts/` はファイルこそ分かれているが実行時は1つの共有スコープ。ダメージ計算・ドロップ抽選・ルート分岐・周回制限時間など`state`に依存しない「計算の核」は`src/core/`へ切り出して単体テスト済みだが(`tests/unit/`)、それ以外の大部分は依然として上記のE2Eスモークテストのみが頼り
- モバイル実機でのタッチ操作の当たり判定は未検証の組み合わせが残っている
- PWAのアイコンはプレースホルダー(単色グラデーションの円)
