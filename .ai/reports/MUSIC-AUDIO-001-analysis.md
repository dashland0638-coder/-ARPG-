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

## 9. 追加: ベース・ドラム、ギターの調査（Human 指示「続けて」）

| 項目 | 内容 |
| --- | --- |
| ベース | VSCO 2 CE `Solo Contrabass/SusNV` v1、12 音（MIDI 28〜59）。v1 は約 0.4 秒で立ち上がって安定（v3 は 1 秒以上かけて膨らむ）。合成音のベースはアタック 0.2 秒・持続型なので、ピチカートではなく弓を選んだ。1.0〜3.0 秒をループ |
| ドラム | VCSL `Frame Drum` Hit v3。大（HDrumL）= キック、小（HDrumS）= スネア、各 rr1・rr2 を交互に。音程は変えない。ドラムキットのキック（Bass Drum 1/2 は演奏会用の大太鼓で響きが長すぎる）より、酒場の「軽いリズム」に合う |
| ギター | VCSL・VSCO 2 CE のどちらにもギターの収録が無い（Strumstick = 3 弦の民族楽器のみ）。CC0 を確認できる他の音源にこの環境から到達できないため、今回は合成音のまま |
| 再生側の値（FACT） | ベース: 再生は `tavernMixLevel` を2回（譜面は1回）、奥行き ×.45、セル音量は常に 1。譜面の `style-bass`（8 音）は合成音の通し再生で鳴らない。ドラム: 再生の強さは キック `tavernMixLevel(.090×drums)`、スネア その ×.78。譜面は キック .072・スネア .05 ×drums（`tavernMixLevel` なし）。時刻・種類は同じ |
| 決定 | 合成音でも鳴る音（ベース 18、ドラム 80）は値まで一致。`style-bass` はピアノ・ベルと同じく譜面どおり鳴らす |
| 音量 | ベース gain 1.7（±2.5 dB）、ドラム gain 1.0（キック RMS ±0.3 dB、スネア +3.8 dB / ピーク +2.2 dB） |

## 10. 追加: キーボード（Human 指示「続けて」。ギターは推奨 A のとおり合成音のまま）

| 項目 | 内容 |
| --- | --- |
| 音源 | VCSL `Electrophones/TX81Z/FM Piano` vl2、10 音（MIDI 60〜96、長3度おき）。ファイル名は科学的表記（C4 = 60、実測で確認）。パッチは作者が作成し実機から収録（`Origin.txt`）。CC0（VCSL の LICENSE） |
| 使われ方（FACT） | 酒場には無い（`TAVERN_STAGE_POLICY`）。他のシーンでは譜面に pluck（`makeStylePluck`、通し再生で鳴る）と keys / synth（`makeKeyboard`、通し再生では鳴らずセル試聴だけ）がある。洋館: pluck 8・keys 8 |
| 決定 | pluck は合成音と同じ値（洋館 8 音一致）。keys / synth はピアノ・ベルと同じく譜面どおり鳴らす。1 つの音源（FM エレピ）を3種類に使う |
| 音量 | pluck は gain 1.0 で ±1.5 dB。keys は同じ level で +6.7 dB だったため、keys / synth の経路だけ ×0.47 |

## 11. 追加: ベロシティの2層目（Human 指示「続けて」）

| 項目 | 内容 |
| --- | --- |
| 実測（FACT） | 強さ v = level / refLevel の分布（酒場2段階 + 4シーン）: ピアノ 0.04〜0.37（中央 0.07）、キーボード 0.02〜0.05、ハープ 0.12〜1.22、ベース 0.02〜0.49、弦・フルート・ベル 0.4〜1.3、ドラム 1.0〜1.3。ピアノとキーボードは通し再生のほぼ全部が「強い収録を lowpass で暗くした音」だった |
| 決定 | ピアノ（vl1、MIDI 43〜87 の 23 音）・ハープ（mf、15 音）・キーボード（vl1、10 音）に弱い層を追加。v < 0.5 で弱い層（2 半音以内に無ければ強い層）。弱い層の音量は強い層と最初の 1 秒の RMS でそろえる（`zone.gain` 0.47〜1.29）。明るさは層の中で付け直す（弱い層は v / 0.5）。弦・フルート・ベルは中〜強に集まっているので1層のまま。ベースは既に弱い層（v1） |
| 結果 | 同じ強さでの音量は以前と同じ（差 0.0 dB）。層の境目（v 0.49 / 0.51）で ±0.5 dB |
| 容量 | 167 ファイル・8.4 MB（+2.4 MB）。デコード後は 48 kHz で約 114 MB（595 秒分）の見込み。iPhone では重い可能性がある（次の課題: 曲で使う楽器・音域だけ読む） |

## 12. 合成音モードの修正（v5.68.0、Human 指示「合成音モードの不具合修正を進めて」）

| 項目 | 内容 |
| --- | --- |
| 原因（FACT） | v5.67.0 の `playTrack` は `buildTruthScore` と同じ計算を楽器ごとに別に持っていた。そのため譜面と音が 7 種類ずれていた（§2・§7〜§10 の「再生側の値」） |
| 方針（DECISION） | 確定版 v5.67.0 は変えず、`scripts/make_v568.py` で v5.68.0 を作る。①`playTrack` は譜面のイベントをそのまま鳴らす（`playScoreEvent`）。②譜面の level・長さ・奥行き（`space`）を v5.67.0 の再生の値にそろえ、確定版の音を保つ。③鳴っていなかった譜面の音（ピアノ・ベル 9・style-bass・keys / synth）は鳴らす（サンプルモードで Human が承認した扱いと同じ）。④ヴィオラの長さの計算の誤り（絶対時刻と譜面の時刻の混在）は直す。⑤鳴っていたのに譜面に無かった脈動（makePulse）を譜面に出す |
| 検証 | v5.67.0 と v5.68.0 の合成音の呼び出しを、酒場 6 段階・4 シーン・5 ジャンルで比較（E2E は 7 曲）。v5.67.0 の音はヴィオラ以外すべて同じ値。ヴィオラ 40 音は長さだけ +0.12〜0.14 秒で、強さ・時刻・音程は同じ。v5.68.0 の通し再生は譜面イベントと 1 対 1・同じ値 |
| 酒場への影響 | 完成版: ピアノ 30・ベル 9・style-bass 8 が加わる。ヴィオラが約 0.12 秒なめらかにつながる。それ以外の音は v5.67.0 と同じ |
| サンプルのフック | v5.68.0 では再生が譜面の値で合成音の関数を呼ぶので、`sample-hooks.js` は関数を包むだけになった（v5.67.0 の癖を再現していた `performance()` を削除） |

## 13. メモリ削減（Human 指示「続けて」）

| 項目 | 内容 |
| --- | --- |
| 方式 | `SampleEngine.ensure(notes)` が、曲に要るファイルだけを読み、それ以外を手放す。要る音は `playScoreEvent` を鳴らさずに通して（dry run）集めるので、層・音域の選び方が本番と同じ。`play()` は manifest 全体から選び、選んだファイルが未読み込みならその音だけ合成音（遠いゾーンで代用しない） |
| 読み直す時 | 「サンプル」にした時、`renderEdit`（生成・編集・加入段階）、通し再生の前（セル音量で層が変わった音）。セル試聴で未読み込みの音に当たったら合成音で鳴らし、その音を読んでおく。「合成音」に戻すと全部手放す |
| 結果（Chromium、デコード後 44.1 kHz） | 酒場 swordsman 10 音 6.3 MB / 酒場 完成版 33 音 20.2 MB / 洋館 28 音 18.3 MB / 幽霊船 30 音 19.3 MB / テクノ 32 音 21.0 MB。全部読むと 167 音 104 MB。どの曲も合成音に戻った音は 0 |
| 1ファイル版 | 同じ動作（33 音・20 MB、戻った音 0）。ただし埋め込んだ音源の文字列（約 11 MB）はページに残る |
