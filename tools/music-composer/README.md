# ARPG Music AI Composer — サンプル音源の試作（MUSIC-AUDIO-001）

ゲーム本体とは独立した作曲アプリ（単一 HTML）。ゲームの build・実行からは参照されない。

| ファイル | 中身 |
| --- | --- |
| `ARPG_Music_AI_Composer_v5_67_0.html` | 基準。酒場 BGM の確定版 v5.67.0 を**無変更**で保存（sha256 `696476fc…5700ff`。単体テストで固定） |
| `ARPG_Music_AI_Composer_v5_67_0_samples.html` | 試作。基準の末尾に `<script>` を3行足しただけ（`scripts/build-prototype.mjs` が生成） |
| `sample-engine.js` | サンプル再生エンジン（Web Audio API を直接使う。外部ライブラリなし） |
| `sample-hooks.js` | アプリの全域関数を包んで、ピアノ・フルート・ヴィオラ・チェロ・ハープ・ベルをサンプルで鳴らす |
| `samples/` | ピアノ 31 + フルート 10 + ヴィオラ 13 + チェロ 13 + ハープ 16 + ベル 10 音（MP3 モノラル 112kbps、計 約 5.0MB）と `manifest.js` |
| `scripts/build_samples.py` | CC0 の元データから `samples/` を作り直す |

## 使い方

画面の「編集」ページ →「空間」の下の **音源** で切り替える。

- **合成音（従来）**: 初期値。v5.67.0 と同じ音
- **サンプル（ピアノ・フルート・弦・ハープ・ベル）**: ピアノ・フルート・ヴィオラ・チェロ・ハープ・ベルが収録音。その他の楽器（ベース・ギター・ドラム・キーボード）は合成音のまま。読み込めない音は合成音に戻る

サンプルは `fetch` で読むので、HTTP(S) で配信して開く（`file://` では読めず、合成音に戻る）。

```sh
npm run dev   # → http://localhost:5173/tools/music-composer/ARPG_Music_AI_Composer_v5_67_0_samples.html
```

ファイルアプリなど `file://` で開くときは、音源を埋め込んだ1ファイル版（約 6.7MB、既存の `dist/` 除外で git 管理外）を作る。

```sh
node tools/music-composer/scripts/build-prototype.mjs --standalone
# → tools/music-composer/dist/ARPG_Music_AI_Composer_v5_67_0_samples_standalone.html
```

## 譜面と音

サンプルモードでは、6楽器とも `buildTruthScore()` の譜面イベント（音程 `n` / 開始 `start` / 長さ / 強さ × セル音量）から鳴らす。

- どの音を鳴らすか（音程・開始時刻）は譜面イベントそのもの
- 強さ・長さ・奥行きは、v5.67.0 の `playTrack` が合成音に渡す値と同じにする（`sample-hooks.js` の `performance()`）。
  フルートは譜面の値のまま。ヴィオラは強さ ×1.18 と酒場の補正、最後の区間は長さ ×1.16。チェロは酒場の補正をもう一度。
  ハープは譜面の値のまま。ベルは奥行き +0.25。
  ヴィオラの長さは譜面のバーより短いことがある（v5.67.0 の再生の計算をそのまま再現している）
- 音程: 最も近い収録音を `playbackRate` で移調（ピアノ ±1、フルート ±2.5、ヴィオラ・チェロ・ハープ・ベル ±2 半音まで）。収録音の実測のずれ（cent）は打ち消す
- 長さ: 指定の長さの間は保ち、その後は楽器ごとの余韻で消える（ピアノ: 長さ × 0.5、0.25〜0.9 秒。フルート: 長さ × 0.15、0.1〜0.25 秒。ヴィオラ: 長さ × 0.12、0.12〜0.3 秒。チェロ: 同 0.15〜0.35 秒。ハープ: 長さ × 0.8、0.4〜1.5 秒。ベル: 長さ × 0.6、0.5〜1.8 秒）
- ヴィオラ・チェロは収録音（3.6 秒）より長い音をループで伸ばす。ループは弓の立ち上がりの後の 1.2〜3.6 秒で、つなぎ目は 0.3 秒の等パワー・クロスフェード
- 強弱: 音量に加えて、弱い音ほど lowpass で丸くする
- 合成音モードの通し再生では、譜面にあるピアノが鳴らない。ベルも譜面の 12 か所のうち 3 か所（0・7・12 音目）しか鳴らない（どちらも v5.67.0 の既存の動作。そのまま残している）。サンプルモードでは譜面どおり鳴る
- ピアノのサンプルは Human の試聴で「小さめ」だったため 30% 大きくした（gain 1.3）

## iPhone Safari での確認手順（未実施）

自動テストは Chromium（デスクトップ、ヘッドレス）だけで実行した。実機の確認は次の手順で行う。

1. PC で `npm run dev` を起動し、同じ Wi-Fi の iPhone の Safari で `http://<PC の LAN IP>:5173/tools/music-composer/ARPG_Music_AI_Composer_v5_67_0_samples.html` を開く
   （または 1ファイル版を AirDrop / ファイルアプリで開く）
2. 消音スイッチを切る（Web Audio はマナーモードで鳴らない）
3. 酒場 → 加入段階「完成版」→ 生成 → 編集ページの「音源」を「サンプル（ピアノ・フルート・弦・ハープ・ベル）」にし、表示が6楽器とも「準備完了」になるのを待つ
4. 確認項目:

| # | 項目 | 期待 |
| --- | --- | --- |
| 1 | ▶ 再生 | 6楽器が収録音で鳴る。他の楽器と時刻がずれない。長いヴィオラ・チェロの音が途切れない |
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
| ヴィオラ | VSCO 2 CE — Viola Section（セクション＝合奏の収録。ソロのヴィオラは無い） | 同上 | CC0 1.0 | `Strings/Viola Section/susvib/ViolaEns_susvib_{C2…D5}_v2_1.wav` の 13 音 |
| チェロ | VSCO 2 CE — Cello Section（セクション） | 同上 | CC0 1.0 | `Strings/Cello Section/susvib/susvib_{C1…F4}_v3_1.wav` の 13 音 |
| ハープ | VCSL — Concert Harp（KSHarp） | VCSL commit `c1ea7bcc…`（上と同じ） | CC0 1.0 | `Chordophones/Composite Chordophones/Concert Harp/KSHarp_{A2…D7}_f1.wav`（C3 だけ `_f2`）の 16 音 |
| ベル | VCSL — Hand Chimes | 同上 | CC0 1.0 | `Idiophones/Struck Idiophones/Hand Chimes/sus_{C3…C6}_r01_main.wav` の長3度おき 10 音 |

- 個々の元ファイル名は `samples/manifest.js` の `source` に全部ある
- 加工: 先頭の無音を削除、モノラル化、-1 dBFS に正規化、MP3 112kbps。ピアノ 3.5 秒・フルート 4.0 秒で切って末尾をフェード。
  ヴィオラ・チェロは 3.6 秒まで（ループ用のクロスフェードを入れ、後ろにループ始端からの続きを 0.1 秒）。ハープ 4.0 秒・ベル 4.5 秒で切って末尾をフェード
- ハープのファイル名だけ音名が科学的表記（A4 = MIDI 69）。他は 1 オクターブ下の表記。どちらも build 時に実測で確かめる
- CC0 なので表示義務は無いが、VSCO 2 CE の Readme のお願いに従って上記のとおりクレジットする（Versilian Studios / Sam Gossner、Ivy Audio / Simon Dalzell）。サンプル単体での販売はしない
- FreePats の Upright Piano KW は、公式ページでライセンスを確認できなかったため使っていない
- 再生コード（`sample-engine.js` / `sample-hooks.js`）は本リポジトリのコードで、音源のライセンスとは別

## 音源の作り直し

```sh
git clone --filter=blob:none --no-checkout https://github.com/sgossner/VCSL vcsl
git clone --filter=blob:none --no-checkout https://github.com/sgossner/VSCO-2-CE vsco
python3 -I tools/music-composer/scripts/build_samples.py --vcsl vcsl --vsco vsco --out tools/music-composer/samples
```

（git / ffmpeg / numpy が必要。`--filter=blob:none` なので、取り出すのは使う 93 ファイルだけ）
