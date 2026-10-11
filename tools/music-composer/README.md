# ARPG Music AI Composer — サンプル音源の試作（MUSIC-AUDIO-001）

ゲーム本体とは独立した作曲アプリ（単一 HTML）。ゲームの build・実行からは参照されない。

| ファイル | 中身 |
| --- | --- |
| `ARPG_Music_AI_Composer_v5_66_0.html` | 基準。Human から受け取った v5.66.0 を**無変更**で保存（sha256 `9c5c0ed8…c48465`。単体テストで固定） |
| `ARPG_Music_AI_Composer_v5_66_0_samples.html` | 試作。基準の末尾に `<script>` を3行足しただけ（`scripts/build-prototype.mjs` が生成） |
| `sample-engine.js` | サンプル再生エンジン（Web Audio API を直接使う。外部ライブラリなし） |
| `sample-hooks.js` | アプリの全域関数を包んで、ピアノ・フルートをサンプルで鳴らす |
| `samples/` | ピアノ 31 音 + フルート 10 音（MP3 モノラル 112kbps、計 約 2.1MB）と `manifest.js` |
| `scripts/build_samples.py` | CC0 の元データから `samples/` を作り直す |

## 使い方

画面の「編集」ページ →「空間」の下の **音源** で切り替える。

- **合成音（従来）**: 初期値。v5.66.0 と同じ音
- **サンプル（ピアノ・フルート）**: ピアノとフルートだけ収録音。その他の楽器は合成音のまま。読み込めない音は合成音に戻る

サンプルは `fetch` で読むので、HTTP(S) で配信して開く（`file://` では読めず、合成音に戻る）。

```sh
npm run dev   # → http://localhost:5173/tools/music-composer/ARPG_Music_AI_Composer_v5_66_0_samples.html
```

ファイルアプリなど `file://` で開くときは、音源を埋め込んだ1ファイル版（約 2.9MB、既存の `dist/` 除外で git 管理外）を作る。

```sh
node tools/music-composer/scripts/build-prototype.mjs --standalone
# → tools/music-composer/dist/ARPG_Music_AI_Composer_v5_66_0_samples_standalone.html
```

## 譜面と音

サンプルモードでは、ピアノ・フルートは `buildTruthScore()` の譜面イベント（音程 `n` / 開始 `start` / 長さ `duration` / 強さ `level` × セル音量）から鳴らす。

- 音程: 最も近い収録音を `playbackRate` で移調（ピアノは最大 ±1 半音、フルートは最大 ±2.5 半音）。収録音の実測のずれ（cent）は打ち消す
- 長さ: `duration` の間は保ち、その後は楽器ごとの余韻で消える（ピアノ: 長さ × 0.5、0.25〜0.9 秒。フルート: 長さ × 0.15、0.1〜0.25 秒）
- 強弱: 音量に加えて、弱い音ほど lowpass で丸くする
- 合成音モードの通し再生では、譜面にあるピアノが鳴らない（v5.66.0 の既存の動作。そのまま残している）。サンプルモードでは譜面どおり鳴る

## iPhone Safari での確認手順（未実施）

自動テストは Chromium（デスクトップ、ヘッドレス）だけで実行した。実機の確認は次の手順で行う。

1. PC で `npm run dev` を起動し、同じ Wi-Fi の iPhone の Safari で `http://<PC の LAN IP>:5173/tools/music-composer/ARPG_Music_AI_Composer_v5_66_0_samples.html` を開く
   （または 1ファイル版を AirDrop / ファイルアプリで開く）
2. 消音スイッチを切る（Web Audio はマナーモードで鳴らない）
3. 酒場 → 加入段階「完成版」→ 生成 → 編集ページの「音源」を「サンプル」にし、表示が「ピアノ: 準備完了 / フルート: 準備完了」になるのを待つ
4. 確認項目:

| # | 項目 | 期待 |
| --- | --- | --- |
| 1 | ▶ 再生 | ピアノ・フルートが収録音で鳴る。他の楽器と時刻がずれない |
| 2 | ■ 停止 → ▶ 再生 を 5 回 | 前の音が残らない・重ならない |
| 3 | 最後まで再生 → 自動で停止 → ▶ 再生 | 同上 |
| 4 | 譜面のフルート/ピアノのセルを続けてタップ | 1 音ずつ鳴り、前の試聴は止まる |
| 5 | セル音量を 200% → 再生 | そのセルだけ大きい |
| 6 | 「合成音」に戻して再生 | 従来の音 |
| 7 | 機内モードで開く（1ファイル版でない場合） | 「読み込み失敗 → 合成音」と出て、合成音で再生できる |
| 8 | 画面ロック → 復帰 → 再生 | 音が出る |

結果は PR か `.ai/tasks/MUSIC-AUDIO-001.md` に記録する。

## 音源の出典とライセンス

| 楽器 | 出典 | バージョン | ライセンス | 使用ファイル |
| --- | --- | --- | --- | --- |
| ピアノ | Versilian Community Sample Library（VCSL）— Upright Piano, Knight（収録 Simon Dalzell / Ivy Audio） | `github.com/sgossner/VCSL` commit `c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e`（2026-01-14） | CC0 1.0（リポジトリの `LICENSE`） | `Chordophones/Zithers/Upright Piano, Knight/Sustains/Player_vl2_rr1_{B0…B5}.wav` の全音おき 31 音 |
| フルート | VS Chamber Orchestra: Community Edition（VSCO 2 CE）— Flute（Versilian Studios / Sam Gossner） | `github.com/sgossner/VSCO-2-CE` commit `440300901dfe9275fd84e0b7763af1f8443ae62e`（2020-08-04） | CC0 1.0（リポジトリの `LICENSE`） | `Woodwinds/Flute/susvib/LDFlute_susvib_{C3…C6}_v1_1.wav` の 10 音 |

- 個々の元ファイル名は `samples/manifest.js` の `source` に全部ある
- 加工: 先頭の無音を削除、モノラル化、ピアノ 3.5 秒・フルート 4.0 秒で切って末尾をフェード、-1 dBFS に正規化、MP3 112kbps
- CC0 なので表示義務は無いが、VSCO 2 CE の Readme のお願いに従って上記のとおりクレジットする（Versilian Studios / Sam Gossner、Ivy Audio / Simon Dalzell）。サンプル単体での販売はしない
- FreePats の Upright Piano KW は、公式ページでライセンスを確認できなかったため使っていない
- 再生コード（`sample-engine.js` / `sample-hooks.js`）は本リポジトリのコードで、音源のライセンスとは別

## 音源の作り直し

```sh
git clone --filter=blob:none --no-checkout https://github.com/sgossner/VCSL vcsl
git clone --filter=blob:none --no-checkout https://github.com/sgossner/VSCO-2-CE vsco
python3 -I tools/music-composer/scripts/build_samples.py --vcsl vcsl --vsco vsco --out tools/music-composer/samples
```

（git / ffmpeg / numpy が必要。`--filter=blob:none` なので、取り出すのは使う 41 ファイルだけ）
