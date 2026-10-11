# MUSIC-AUDIO-001 Analysis — CC0 サンプル音源エンジン（ピアノ・フルート試作）

Source: Human 提供の `ARPG_Music_AI_Composer_v5_67_0_tavern_bgm_complete.html`（sha256 `696476fc…5700ff`、2946 行）を
`tools/music-composer/ARPG_Music_AI_Composer_v5_67_0.html` として無変更で保存。解析は先に受け取った v5.66.0 で行い、v5.67.0 との差分（§1）を確認した。branch `claude/cc0-sample-audio-engine-76noqo` @ `6ba05c8`。

## 1. 対象の特定（Phase 1-1）

| 事項 | 区分 | 内容 |
| --- | --- | --- |
| 音楽アプリの所在 | FACT | このセッションでアクセスできるリポジトリは `dashland0638-coder/-ARPG-`（ゲーム本体）だけ。ゲーム側の `src/audio/procedural-bgm.js` はパラメータ表から環境 BGM を作るもので、作曲アプリではない |
| 受け取った版 | FACT | Human は先に v5.66.0、次に **v5.67.0（酒場 BGM 確定版）** を共有。v5.66.0 との差分は2行だけ: 完成版酒場のギターの level `.039→.030` と `INSTRUMENT_CALIBRATION.Guitar` `1.02→.78`（ギターの音量のみ。末尾の版コメントは v5.66.0 のまま） |
| 置き場所 | DECISION | ゲーム本体のコード（`src/` `index.html` `basefile.html` など）には触れず、独立したディレクトリ `tools/music-composer/` に置く。Vite の build 入力（`index.html`）からは参照されない |

## 2. 現行実装（Phase 1-2/1-3）

すべて単一 HTML 内の全域関数（`<script>` 3つ、ES Module ではない）。

| 機能 | 関数 | 要点 |
| --- | --- | --- |
| 作曲 | `analyze` → `makeTrack` → `composeMelody` / `buildArrangement` / `expandToFullLoop` | 自然言語 → 意図 → 80 音（40 小節 1 ループ: A→A′→B→A″）。`state.track = {phrase[], bass[], chords, arrangement, cellVolumes, …}` |
| 楽器の加入段階 | `TAVERN_STAGE_POLICY` / `tavernAllows` / `tavernProgressionKey` | 酒場だけ。swordsman〜complete の6段階 |
| 譜面イベント | `buildTruthScore(track)` | `{instrument, index, start, duration, n, level, kind}` の配列。`scoreTiming` の時刻 |
| 譜面表示・編集 | `buildScoreTimeline` / `initScoreEditing` | `buildTruthScore` のイベントを描く。編集は `track.phrase` / `track.bass` を直接書き換える |
| 通し再生 | `playTrack` | **`buildTruthScore` を使わず**、同じ計算を再実装して `makeVoice` / `makeAcousticGuitarStrum` などを呼ぶ |
| 停止 | `stopAudio` | `playbackToken++`、`audioCtx.close()`。次の再生は新しい AudioContext |
| セル試聴 | `previewScoreEvent(e)` | 譜面イベント1つを `makePiano` / `makeVoice` で鳴らす。セル音量込み |
| セル音量 | `cellVolume` / `setCellVolume` | `track.cellVolumes["楽器:index:kind"]`（0.35〜2.0、Bass は固定） |
| 音色 | `makePiano`（倍音加算）/ `makeVoice(name,…)`（2 発振器 + lowpass。Flute/Viola/Cello/Bass/Harp/Bell） | `calibratedLevel` で楽器ごとに補正 |

### 譜面と再生のずれ（FACT）

- `buildTruthScore` には **Piano** のイベント（kind `piano` / `piano-low`）があるが、`playTrack` は `makePiano` を一度も呼ばない。**譜面に見えるピアノは通し再生で鳴らない**（セル試聴だけ鳴る）。酒場の swordsman 段階（Piano + Cello）は実際には Cello だけになる
- **Flute** は `playTrack` と `buildTruthScore` が同じ条件・音・時刻・長さ・level を計算している（level は再生側だけ `cellVolume` を掛ける）
- Bell は譜面が 12 箇所、再生は `i===0||7||12` の 3 箇所（今回の対象外。記録のみ）

## 3. 交換可能にする最小設計（Phase 1-4）

既存 HTML を1文字も変えず、末尾に3つの `<script>` を足すだけにする。

```
samples/manifest.js   どの音をどの収録音から鳴らすか（生成物）
sample-engine.js      SampleEngine: load / isReady / play(ctx, 楽器, n, start, dur, level, 出力) → handle | null
sample-hooks.js       全域関数 makePiano / makeVoice / playTrack / stopAudio を包む
```

- 音源モード「合成音」（初期値）: 包んだ関数は元の関数をそのまま呼ぶ → v5.67.0 と同じ動作
- 「サンプル」: `playTrack` の中では合成フルートを止め、`playTrack` の直後に **`buildTruthScore` のピアノ・フルートのイベントを、同じ開始時刻・出力先（room）で** サンプル再生する。開始時刻は `startScorePlayhead(start)`、出力先は最初の `makeRoom()` から受け取る
- セル試聴は `makePiano` / `makeVoice('Flute')` を包んだ側で自動的にサンプルになる
- 鳴らせない音（未読み込み・音域外・例外）は `play()` が `null` → その音だけ元の合成音
- 楽器を増やすときは manifest に楽器を足し、hooks の対象に加えるだけ（作曲・譜面のコードは触らない）

## 4. 音源の選定（Phase 2）

| 項目 | FreePats Upright Piano KW | VCSL（Versilian Community Sample Library） | VSCO 2 CE（追加調査） |
| --- | --- | --- | --- |
| 公式ライセンス | **確認できず**（freepats.zenvoid.org はこの環境のプロキシで 403） | **CC0 1.0**（リポジトリ直下 `LICENSE`、README「Creative Commons 0 … even make commercial software」） | **CC0 1.0**（`LICENSE`）。`Readme.txt` に「サンプル単体の販売はしないで」「クレジットを」という**お願い**（法的条件ではない） |
| 確認したもの | — | `github.com/sgossner/VCSL` @ `c1ea7bcc`（2026-01-14） | `github.com/sgossner/VSCO-2-CE` @ `44030090`（2020-08-04） |
| 対象ファイル | — | `Chordophones/Zithers/Upright Piano, Knight/Sustains/Player_vl2_rr1_*.wav`（全音おき、2 velocity。収録 Simon Dalzell / Ivy Audio） | `Woodwinds/Flute/susvib/LDFlute_susvib_*_v1_1.wav`（C・E・A おき） |
| 元の形式・容量 | — | WAV 44.1kHz/24bit/ステレオ、1 音 3〜5MB。全体は数 GB | 同左、1 音 2〜3MB |
| フルート | — | **横笛（transverse flute）は無い**（リコーダー・オカリナのみ） | あり |
| 必要な変換 | — | 先頭無音削除・モノラル化・3.5 秒で切る・MP3 112kbps | 同左（4.0 秒） |
| ブラウザ再生 | — | `fetch` → `decodeAudioData` → `AudioBufferSourceNode`（`playbackRate` で移調） | 同左 |
| iPhone Safari | — | MP3 は全 iOS で decode 可。WAV/24bit も可だが容量過大。Ogg Vorbis は iOS 17 未満で不可 → MP3 を採用 | 同左 |
| 商用ゲーム同梱・再配布 | — | 可（CC0。表示義務なし） | 可（CC0）。お願いに従い、クレジットを記載し、サンプル単体では売らない |
| 判定 | **不採用**（CC0 を公式に確認できないため。§「CC0であることを確認できないファイルは採用しない」） | **ピアノに採用** | **フルートに採用**（VCSL に横笛が無いため。VCSL の前身で同じ作者・同じ CC0） |

ファイル名の音名は「科学的表記 − 1 オクターブ」（`A3` = MIDI 69）。`build_samples.py` が自己相関で全音を実測して確かめ、ずれ（ピアノ上方は +10〜16 cent のストレッチ調律）を manifest に書き、再生側で平均律に補正する。

### 再生ライブラリ

外部ライブラリは使わず、Web Audio API を直接呼ぶ自作コード（`sample-engine.js`、このリポジトリのコード）。
Tone.js（MIT）/ smplr（MIT）/ soundfont-player（MIT）も候補だが、単一 HTML のアプリにバンドラ無しで足すには重く、必要な機能（ゾーン選択・移調・エンベロープ）は 200 行程度で足りるため採用しない。**音源（CC0）と再生コード（本リポジトリ）のライセンスは別**。

## 5. 実装計画（Phase 3）

1. `scripts/build_samples.py`: 2 リポジトリを blob 無しで clone し、使う 41 ファイルだけ取り出して変換（数 GB を取らない）
2. `sample-engine.js`: ゾーン選択（最寄り・等距離は低い方・12 半音まで）、`planNote`（dur 保持 → 楽器ごとの余韻: ピアノ dur×0.5（0.25〜0.9 秒）/ フルート dur×0.15（0.1〜0.25 秒））、強弱（gain と lowpass の明るさ）、発音の頭の検出（MP3 のエンコーダ遅延対策）
3. `sample-hooks.js`: 上記 §3。画面の「空間」カードの下に「音源」カードを足す（設定は localStorage、使えなければ合成音）
4. `scripts/build-prototype.mjs`: 試作 HTML（相対パスで samples/ を読む）と、file:// でも動く1ファイル版（dist/、git 管理外）
5. テスト: `tests/unit/music-sample-engine.test.js`（node）、`tests/music-sample-engine.spec.js`（Playwright）

## 6. リスク

- 今後の版でフックが包む関数名（`makePiano` `makeVoice` `playTrack` `startScorePlayhead` `makeRoom` `stopAudio` `buildTruthScore` `cellVolume` `calibratedLevel`）が変わった場合、フックは自動で無効（合成音のまま）になり、コンソールに不足関数名を出す
- サンプルモードではピアノが鳴るようになる（譜面どおり）。酒場の聞こえ方が v5.67.0 の通し再生と変わる。既定値は合成音
- 実機（iPhone Safari）の音質・メモリ・遅延は未確認（§ README の手順）

## 7. 追加: ヴィオラ・チェロ（Human 指示「ピアノはそのまま残して、次はヴィオラとチェロ」）

| 項目 | 内容 |
| --- | --- |
| 音源 | VSCO 2 CE `Strings/Viola Section/susvib`（v2）13 音、`Strings/Cello Section/susvib`（v3）13 音。CC0（§4 と同じリポジトリ・コミット）。VCSL には弦の持続音が無い |
| 音名 | 他と同じく「科学的表記 − 1 オクターブ」（実測で確認。ヴィオラ C2 = MIDI 48、チェロ C1 = MIDI 36） |
| 長さ | 収録音を 3.6 秒で切り、1.2〜3.6 秒をループ（0.3 秒の等パワー・クロスフェード）。再生は `AudioBufferSourceNode.loop` |
| 再生側の値（FACT） | v5.67.0 の `playTrack` は、ヴィオラに level ×1.18 と `tavernMixLevel`、最後の区間の長さ ×1.16 を掛ける。チェロには `tavernMixLevel` を2回掛ける。ヴィオラの長さの計算は絶対時刻と譜面の時刻を混ぜている。いずれも `buildTruthScore` の level / duration と違う |
| 決定 | 鳴らす音（音程・開始時刻）は譜面イベント、強さ・長さ・奥行きは `playTrack` と同じ計算（`sample-hooks.js` の `performance()`）。酒場完成版で、合成音の `makeVoice` に渡る値と 130 音すべて一致 |
| 音量 | 合成音と同じ level で RMS が ±1 dB に収まるよう gain 1.6 |

## 8. 追加: ハープ・ベル、ピアノ +30%（Human 指示）

| 項目 | 内容 |
| --- | --- |
| ハープ | VCSL `Concert Harp`（KSHarp、f 層）16 音、MIDI 45〜98。ファイル名は科学的表記（A4 = 69、実測で確認）。VSCO 2 CE の Harp は同じ収録の一部（mf のみ） |
| ベル | VCSL `Hand Chimes` sus 10 音（長3度おき、MIDI 60〜96）。アプリのベルは主旋律 +12（70〜98 前後）で、合成音はサイン波 + 2.71 倍音の柔らかいチャイム。Tubular Bells（MIDI 60〜77）は音域が低く、Glockenspiel は硬く明るすぎるため不採用 |
| 再生側の値（FACT） | ハープ: 譜面と再生で level・長さ・奥行きが同じ。ベル: 譜面は 12 か所（0,7,12,32,39,44,48,55,60,64,71,76 音目）、v5.67.0 の再生は 3 か所（0,7,12）だけ。値（level・長さ）は同じ式、奥行きは +.25 |
| 決定 | ハープは譜面どおり。ベルはピアノと同じく譜面どおり 12 か所すべて鳴らす（DoD「譜面と音が同じ」、ピアノでの Human 判断に合わせる）。合成音が鳴らす 3 か所の値は合成音と一致 |
| 音量 | 同じ level で合成音と ±3 dB（ハープ gain 2.1、ベル 1.7）。ピアノは gain 1.0 → 1.3（+30%、Human の試聴結果） |
