# ARPG Music AI Composer — サンプル音源の試作（MUSIC-AUDIO-001）

ゲーム本体とは独立した作曲アプリ（単一 HTML）。ゲームの build・実行からは参照されない。

| ファイル | 中身 |
| --- | --- |
| `ARPG_Music_AI_Composer_v5_67_0.html` | 酒場 BGM の確定版 v5.67.0。**無変更**で保存（sha256 `696476fc…5700ff`。単体テストで固定） |
| `ARPG_Music_AI_Composer_v5_68_0.html` | 合成音モードの修正版 v5.68.0。v5.67.0 から `scripts/make_v568.py` で作る（下の「v5.68.0 の修正」） |
| `ARPG_Music_AI_Composer_v5_69_0.html` | v5.69.0。v5.68.0 から `scripts/make_v569.py` で作る。ギターの譜面イベントの編集・譜面エディタの音名の欄の修正（下の「v5.69.0」） |
| `ARPG_Music_AI_Composer_v5_70_0.html` | v5.70.0。v5.69.0 から `scripts/make_v570.py` で作る。酒場完成版のギターの和音を、同時に鳴る音に合わせる（下の「v5.70.0」） |
| `ARPG_Music_AI_Composer_v5_70_0_samples.html` | 試作。v5.70.0 の末尾に `<script>` を3行足しただけ（`scripts/build-prototype.mjs` が生成） |
| `ARPG_Music_AI_Composer_v5_71_0.html` | v5.71.0。v5.70.0 から `scripts/make_v571.py` で作る。酒場のチェロを次のチェロの始まりまで伸ばす（下の「v5.71.0」）。ゲームの酒場 BGM の書き出し元 |
| `ARPG_Music_AI_Composer_v5_71_0_samples.html` | v5.71.0 の末尾に v5.70.0 の試作と同じ `<script>` 3 行を足したもの（`node scripts/build-prototype.mjs --base ARPG_Music_AI_Composer_v5_71_0.html`） |
| `sample-engine.js` | サンプル再生エンジン（Web Audio API を直接使う。外部ライブラリなし） |
| `sample-hooks.js` | アプリの全域関数を包んで、10楽器をサンプルで鳴らす。楽器ごとの切り替え・計測の表示 |
| `samples/` | ピアノ 31 + フルート 10 + ヴィオラ 13 + チェロ 13 + ハープ 16 + ベル 10 + ベース 12 + ドラム 4 + キーボード 10 + ギター 43 音、弱い層 ピアノ 23 + ハープ 15 + キーボード 10 音（計 210 ファイル、MP3 モノラル 112kbps、約 10MB）と `manifest.js` |
| `scripts/build_samples.py` | CC0 の元データから `samples/` を作り直す |

## 使い方

画面の「編集」ページ →「空間」の下の **音源** で切り替える。

- **合成音（従来）**: 初期値。v5.70.0 と同じ音
- **サンプル**: 10楽器（ピアノ・フルート・ヴィオラ・チェロ・ハープ・ベル・ベース・ドラム〔キック・スネア〕・キーボード・ギター）が収録音。
  楽器ごとのチェックを外すと、その楽器だけ合成音で鳴る（聞き比べ用。選択はブラウザに保存）。読み込めない音は合成音に戻る
- カードの下に計測を出す: 最初の読み込み・直近の読み込みの時間と音数、再生の準備にかかった時間、出力の遅れ（`baseLatency + outputLatency`）、
  サンプルのメモリ（デコード後）、サンプリング周波数。iPhone の確認で使う

サンプルは `fetch` で読むので、HTTP(S) で配信して開く（`file://` では読めず、合成音に戻る）。

読み込むのは**今の曲に要る収録音だけ**。曲を生成・編集する、または加入段階を変えると読み直し、要らなくなった収録音は手放す。
「合成音」に戻すと全部手放す。デコード後のメモリは曲ごとに約 7〜25MB（酒場完成版 25MB。全部読むと約 125MB）。
「音源」カードに、楽器ごとの状態（準備完了 / この曲では不使用 など）と読み込み済みの量を表示する。
読み込みが間に合わなかった音は、その音だけ合成音で鳴る。

```sh
npm run dev   # → http://localhost:5173/tools/music-composer/ARPG_Music_AI_Composer_v5_70_0_samples.html
```

ファイルアプリなど `file://` で開くときは、音源を埋め込んだ1ファイル版（約 11MB、既存の `dist/` 除外で git 管理外）を作る。

```sh
node tools/music-composer/scripts/build-prototype.mjs --standalone
# → tools/music-composer/dist/ARPG_Music_AI_Composer_v5_70_0_samples_standalone.html
# 別の版の1ファイル版(聞き比べ用):
node tools/music-composer/scripts/build-prototype.mjs --standalone --base ARPG_Music_AI_Composer_v5_69_0.html
```

## v5.68.0 の修正（合成音モード）

v5.67.0 の `playTrack` は、譜面（`buildTruthScore`）と同じ計算を別に持っていて、譜面と音がずれていた。
v5.68.0 では通し再生が譜面のイベントをそのまま鳴らす（`playScoreEvent`）。譜面の値は確定版の音に合わせた。

| 楽器 | v5.67.0 | v5.68.0 |
| --- | --- | --- |
| ピアノ | 譜面にあるのに通し再生で鳴らない | 鳴る |
| ベル | 譜面 12 か所のうち 3 か所だけ鳴る | 12 か所鳴る |
| ベース | 譜面の style-bass（ジャンルの低音）が鳴らない | 鳴る |
| キーボード | 譜面の keys / synth が鳴らない（セル試聴だけ） | 鳴る |
| ヴィオラ | 「次の音まで伸ばす」計算で絶対時刻と譜面の時刻が混ざり、約 0.12 秒短く鳴る | 譜面どおりの長さ（+0.12〜0.14 秒） |
| 脈動（酒場以外） | 鳴るのに譜面に無い | 譜面のドラム行に出る。セル試聴も脈動の音 |
| 強さ（ヴィオラ ×1.18・最後の区間の長さ ×1.16、チェロ・ベースの酒場の補正 2 回、ドラム、ギター .045 など） | 再生と譜面で値が違う | 譜面の値を再生（確定版の音）に合わせた。音は変わらない |

v5.67.0 で鳴っていた音は、ヴィオラの長さ以外すべて同じ値で鳴る（酒場 3 段階・4 シーン・2 ジャンルで E2E）。

## v5.69.0（ギターの編集・音名の欄の修正）

- 譜面のギターのセルを選ぶと、エディタで **音名（和音の一番低い音。和音ごと移調）・長さ（拍）・ずれ（拍、-1〜1）** を変えられる。
  `track.guitarEdits[イベント番号] = {shift, offset, d}` に保存し、`buildTruthScore` が当てるので、譜面の表示と通し再生（合成音・サンプルとも）に同じ値が入る
- 編集しなければ v5.68.0 と同じ譜面・同じ音（酒場のリズム・ギターの音量・40 小節を保つ。E2E で 7 曲を比較）
- ギターの「この音を休符にする」は効かない（ギターのセルからは主旋律を消してしまうため）
- 既存の不具合の修正: 音名の欄に選択肢が無かった（`buildPitchOptions()` が呼ばれていない）。v5.68.0 までは「この音を変更」でどの音も C4 になっていた

## v5.70.0（酒場のギターの和音）

v5.69.0 までの酒場完成版のギターは、同時に鳴る音と 26% が半音・増4度・長7度でぶつかっていた（Human の指摘「不協和音」）。

| 原因 | v5.69.0 | v5.70.0 |
| --- | --- | --- |
| 和音の選び方 | `t.chords` の4つを1小節ごとに回す（チェロ・ハープ・旋律の和音と合わない） | ストロークの間に鳴っている低音（ベース・チェロ）と旋律から、D メジャーの三和音（I ii iii IV V vi）を選ぶ。低音が根音なら強く加点、ぶつかれば減点 |
| 和音の音 | 4音の和音の先頭3音を「根音・3度・5度」に使う（例: G・F#・B で G と F# が半音） | 根音・3度・5度で組む。声部の形と音域は同じ |
| 旋律とぶつかる音 | 1オクターブ下げる（音名はぶつかったまま） | 省く（根音は残す） |
| ギターのセル試聴 | 音の番号を小節として渡し、別の小節の和音を鳴らす | 譜面のストロークと同じ和音 |

- Human が v5.69.0 と聞き比べて採用した
- 結果（酒場完成版）: ぶつかり 26.1% → 7.4%（残りは主にフルート。主旋律の3度上をなぞる設計のため）。和音の中のぶつかり 20 → 0
- リズム・長さ・強さ・ギターの編集・他の楽器は v5.69.0 と同じ（E2E）
- サンプルのギター: 和音が変わるとき（次のストローク）に前の和音の弦を止める（約 0.05 秒で消す）。余韻は合成音に近い 0.2〜0.5 秒。
  v5.69.0 の試作ではサンプルの余韻（最大 1.5 秒）が次の和音に重なり、合成音の約3倍の時間ぶつかっていた

## v5.71.0（酒場のチェロの持続。MUSIC-BGM-TAVERN-003）

iPhone で「曲の途中で 1 小節ほど音が途切れる」と報告があった（2026-10-30）。

| | v5.70.0 | v5.71.0 |
| --- | --- | --- |
| 酒場のチェロ（foundation）の長さ | ベースの長さ（8 拍）の 0.9 倍。8 拍のうち最後の 1 拍（約 0.58 秒）が切れる | 次のチェロ（8 音後）の始まりまで。最後のチェロは 1 周の終わりまで |
| 全部の音が切れる時間（休符・合成の短い拍を除く） | 剣士・魔法使いの段で 8 拍ごとに 1 拍（1 周に 10 回、最後は 1 周の終わり）。弓師〜盗賊の段は小さなハープだけ | 無し（6 段階とも） |
| 書き出した音の半小節ごとの大きさ（曲の中央値との差の最小） | 剣士〜盗賊 -13〜-14 dB、影の旅人 -12.7 dB・完成版 -10.5 dB（1 周の終わり） | -3〜-5 dB（普段の強弱） |

- チェロは次の音のちょうど始まりで止める（重ねない）。同時に鳴る音から和音を選ぶギター（v5.70）の判定は変わらない
- 変えたのはチェロの長さだけ。音の高さ・強さ・始まり、他の楽器、旋律、和音、段階ごとの楽器、酒場以外の曲は v5.70.0 と同じ（E2E で確かめる）
- 全体の音量は上げていない（書き出しの倍率 +12.95 dB は同じ）
- 修正前と聞き比べ、iPhone で修正後を採用した（Human 2026-10-31）。聞き比べのページと修正前の音源は確認の後に消した。修正前の書き出しの記録は `exports/tavern-stages-v5_70.json`

## 譜面と音（サンプル）

サンプルモードでは、v5.68.0 の通し再生が合成音の関数に渡す値（= 譜面イベントの値）を、そのままサンプルで鳴らす。
`sample-hooks.js` は合成音の関数を包むだけ（v5.67.0 以前は `playScoreEvent` が無いのでフックを付けない）。

- キーボードの pluck は合成音と同じく calibratedLevel を通さない。keys / synth は同じ level で合成音と音量がそろうよう ×0.47
- 音程: 最も近い収録音を `playbackRate` で移調（ピアノ ±1、フルート ±2.5、ヴィオラ・チェロ・ハープ・ベル・ベース ±2 半音まで。キーボード ±2 半音。ドラムは移調しない）。収録音の実測のずれ（cent）は打ち消す
- 長さ: 指定の長さの間は保ち、その後は楽器ごとの余韻で消える（ピアノ: 長さ × 0.5、0.25〜0.9 秒。フルート: 長さ × 0.15、0.1〜0.25 秒。ヴィオラ: 長さ × 0.12、0.12〜0.3 秒。チェロ: 同 0.15〜0.35 秒。ハープ: 長さ × 0.8、0.4〜1.5 秒。ベル: 長さ × 0.6、0.5〜1.8 秒。ベース: 長さ × 0.12、0.1〜0.25 秒。ドラム: 0.4〜0.8 秒。キーボード: 長さ × 0.3、0.12〜0.5 秒）
- ヴィオラ・チェロ・ベースは収録音より長い音をループで伸ばす。ループは弓の立ち上がりの後（ヴィオラ・チェロ 1.2〜3.6 秒、ベース 1.0〜3.0 秒）で、つなぎ目は 0.3 秒の等パワー・クロスフェード
- ドラムはキック・スネアそれぞれ2つの収録音を交互に鳴らす（同じ音の連打が機械的にならないように）
- 強弱: 音量に加えて、弱い音ほど lowpass で丸くする。
  ピアノ・ハープ・キーボードは強さが基準の 0.5 未満なら弱く弾いた収録音（弱い層）を使う。弱い層の音量は強い層と RMS でそろえてあるので、音量は強さだけで決まり、音色だけが変わる（層の境目で ±0.5dB）
- ピアノのサンプルは Human の試聴で「小さめ」だったため 30% 大きくした（gain 1.3）

## iPhone Safari での確認（**実機で確認していない項目は合格にしない**）

自動テストは Chromium（デスクトップ、ヘッドレス）だけで実行した。iPhone 実機（方法 3）は Human が確認し、チェックリスト全項目「問題なし」（2026-10-12）。読み込み時間・遅延の数値は記録していない。

### 確認用ページを開く

確認用ページ: `tools/music-composer/ARPG_Music_AI_Composer_v5_70_0_samples.html`（ブランチ `claude/cc0-sample-audio-engine-76noqo`）。
サンプル音源（`samples/`）を `fetch` で読むので、**HTTP で配信して開く**。

**方法 1（推奨）: PC で開発サーバーを動かし、同じ Wi-Fi の iPhone から開く**

```sh
git fetch origin claude/cc0-sample-audio-engine-76noqo
git switch claude/cc0-sample-audio-engine-76noqo
npm ci
npm run dev        # vite.config.js の host:true で、LAN からも開ける
```

iPhone の Safari で `http://<PC の LAN の IP アドレス>:5173/tools/music-composer/ARPG_Music_AI_Composer_v5_70_0_samples.html` を開く
（IP は PC 側で確認する。例: macOS は「システム設定 → Wi-Fi → 詳細」）。PC のファイアウォールが 5173 番を止めていると開けない。

- 開発中に使っていた確認用サーバー（ポート 8765）はクラウドの作業環境の中で動いていたもので、iPhone からは届かない（もう止まっている）。
  iPhone の確認には使わない。

**方法 2（未確認）: 1ファイル版**

`node tools/music-composer/scripts/build-prototype.mjs --standalone` で作る `dist/ARPG_Music_AI_Composer_v5_70_0_samples_standalone.html`（約 13MB、音源を埋め込み）。
iPhone でこのファイルを Safari のページとして開く方法（ファイルアプリのプレビューでスクリプトが動くかどうか）は確かめていない。
方法 1 が使えないときの候補とし、開けなかった場合は「問題あり」ではなく「未確認」とする。

**方法 3（iPhone だけで開ける）: claude.ai の非公開アーティファクト**

確認用ページ・`sample-engine.js`・`sample-hooks.js`・`samples/`（manifest と MP3 210 個）を、手を加えずにそのまま公開したもの。
URL: https://claude.ai/artifact/Aa2jjaA2Hu3e6Yrs2WVaXp （非公開。オーナーのアカウントで開く）。
アプリの「保存」系のボタン（ファイルのダウンロード）はアーティファクトの中では動かない（チェックリストの対象外）。

- 2026-10-12 Human 報告: iPhone の Safari で開き「問題なく動く」（ページが開き、サンプル音源で再生できた）。
  続けて同日、チェックリスト全項目「問題なし」と報告（数値は未記録）。

### 共通の準備

1. 消音スイッチ（マナーモード）を切る。Web Audio はマナーモードで鳴らない
2. 酒場 → 加入段階「完成版」→ 生成 → 編集ページの「音源」を「サンプル」にする
3. 数字は「音源」カードの「計測」欄から読む（最初 / 直近の読み込み時間・音数、再生の準備、出力の遅れ、サンプルのメモリ）。
   iPhone の Safari ではページから実際のメモリ使用量は読めない。「サンプルのメモリ」はデコードした音源の大きさ（約 25MB）で、
   アプリ全体のメモリではない。正確に測るなら Mac の Safari の Web インスペクタ（iPhone をケーブルでつなぎ、タイムライン → メモリ）

### チェックリスト

結果は **確認済み・問題なし / 問題あり / 未確認** のどれかで書く。問題ありはメモに内容（いつ・何をしたら・どうなった）を書く。

| # | 項目 | 手順 | 期待 | 結果 | メモ |
| --- | --- | --- | --- | --- | --- |
| 1 | 初回読み込み時間 | 設定 → Safari → 詳細 → Webサイトデータ で PC の IP の項目を削除 → ページを開いて準備 2 | 「最初の読み込み」の ms と音数（酒場完成版は 43 音）。表示が「準備完了」になる | 確認済み・問題なし | 方法 3。2026-10-12 Human 報告「全部問題なし」（数値は未記録） |
| 2 | 2回目の読み込み時間 | ページを読み込み直して準備 2 | 1 より短い（HTTP キャッシュ） | 確認済み・問題なし | 方法 3。2026-10-12 Human 報告「全部問題なし」（数値は未記録） |
| 3 | 音色と音量バランス | ▶ 再生。「音源」のチェックでピアノ・フルート・ギターなどを1つずつ合成音に切り替えて聞き比べる | ピアノ・フルート・ギターが他の楽器と釣り合う。割れ・極端に小さい楽器がない | 確認済み・問題なし | 方法 3。2026-10-12 Human 報告「全部問題なし」 |
| 4 | 再生・停止・再再生 | ▶ → ■ → ▶ を 5 回。最後まで再生 → 自動で止まる → ▶ | 毎回すぐ鳴る。前の音が残らない | 確認済み・問題なし | 方法 3。2026-10-12 Human 報告「全部問題なし」 |
| 5 | 譜面と再生音の同期 | 再生中の再生位置の線と音を見比べる。譜面のピアノ・フルート・ギターのセルをタップ（セル試聴） | 線と音がずれない。セルの音が譜面の音と同じ | 確認済み・問題なし | 方法 3。2026-10-12 Human 報告「全部問題なし」 |
| 6 | 40 小節の通しで音切れ・重複再生がない | 40 小節を最後まで再生。加入段階を swordsman → … → 完成版 と変えてそれぞれ再生 | 途中で途切れない・同じ音が二重に鳴らない。段階ごとに楽器が増え、どれも 40 小節で終わる | 確認済み・問題なし | 方法 3。2026-10-12 Human 報告「全部問題なし」 |
| 7 | メモリ使用・操作の不安定さ | 1〜6 の間、画面を操作し続ける。画面ロック → 復帰 → ▶ も試す | ページが落ちない・再読み込みされない・操作が固まらない。復帰後も音が出る | 確認済み・問題なし | 方法 3。2026-10-12 Human 報告「全部問題なし」 |
| 参考 | 再生開始時の遅延 | ▶ を押してから音が出るまで | 「再生の準備」+ 120ms +「出力の遅れ」程度 | 確認済み・問題なし | 方法 3。2026-10-12 Human 報告「全部問題なし」（数値は未記録） |

アプリは 40 小節を 1 回通して自動で止まる（自動で繰り返し再生する機能は無い）。6 は「40 小節の 1 ループ」を通しで確認する。

結果は PR #70 か `.ai/tasks/MUSIC-AUDIO-001.md` に記録する。すべて「確認済み・問題なし」になるまで、実機確認は合格としない。

## ゲームへの書き出し（MUSIC-BGM-TAVERN-001。002 で 6 段階、003 で v5.71.0 から）

アプリ・譜面・音源エンジン・収録音は変えずに、ヘッドレスの Chromium でアプリを開き、画面と同じ手順（場面 → 加入段階 → 生成 → 音源「サンプル」）で曲を作る。
その通し再生（`playTrack`）を `OfflineAudioContext` で録り、ゲーム用のループ音源（MP3）にする。

```sh
node tools/music-composer/scripts/render-bgm.mjs --scene tavern --stages swordsman,mage,archer,thief,shadow,complete --prompt default --out <dir> --name tavern
# → <dir>/tavern-<n>-<stage>.mp3(ステレオ 44.1kHz 128kbps)と tavern-stages.json(元の HTML の sha256・曲の文・段階ごとの楽器・ループ点・検算)
```

- 加入段階(MUSIC-BGM-TAVERN-002): アプリの「酒場BGMの成長」(`TAVERN_STAGE_POLICY`)の 6 段階を、段階ごとに新しいページで同じ曲の文から作る。
  段階で変わるのは鳴らす楽器だけ(主旋律・和音・テンポ・長さは同じ。書き出しが段階ごとに確かめる)。段階は剣士加入 → 魔法使い加入 → 弓師加入 → 盗賊加入 → 影の旅人加入 → 第一章クリア後・完成版
- 音量は 6 段階に同じ倍率を掛ける(一番大きい完成版のピークが -1 dBFS)。段階が進むほど大きくなるのは、楽器が増えるため
- 1 周の長さは 1/300 秒単位に丸める(44.1kHz でも 48kHz でもサンプル数が整数になる。47.766667 秒)

- `--prompt default` は画面で「酒場」を選んだときに入る文（`sceneDefaults.tavern`）。`example` は `TAVERN_EXAMPLE_PROMPT`（自動テストが使う古い例文）。
  2 つは旋律もテンポも違う曲になる（103 BPM / 109 BPM）。ゲームの酒場 BGM は Human が聞き比べて `default`（候補 A）を選んだ（DEC-012）
- アプリは同じページで続けて生成すると、前の曲の文を引き継ぐ（`mergeRevisionStack`）。書き出しは毎回まっさらなページで 1 回だけ生成する
- 1 周 = 80 音目の枠（`scoreTiming(t).eventStart(80)`、40 小節）。最後の音の余韻・残響は 1 周の頭に重ねる（2 回続けて鳴らしたときの 2 回目と同じ音）。
  前後に 1 秒ずつ同じ音の続きを付ける。ゲームはデコード後に `loopStart = 1` から 1 周分を別のバッファへ写して丸ごと繰り返す（MP3 の先頭の遅れが残っても継ぎ目が変わらない。`src/audio/audio.js`）
- 音量は倍率を掛けるだけ（曲は変えない）。ゲーム内の大きさは `src/audio/asset-manifest.js` の `BGM_TRACK_OPTIONS.tavern.gain`
- 録音は浮動小数の誤差の範囲で毎回同じ。MP3 はその誤差で毎回ビット単位では一致しないので、採用したファイルは `exports/tavern-stages.json` の sha256 で固定する（`tests/unit/tavern-bgm.test.js`）
- 書き出したもの: `public/audio/bgm/tavern-1-swordsman.mp3` 〜 `tavern-6-complete.mp3`、記録 `exports/tavern-stages.json`（MUSIC-BGM-TAVERN-001 の 1 曲版 `tavern.mp3` は 6 段階に置き換えた）

## 音源の出典とライセンス

| 楽器 | 出典 | バージョン | ライセンス | 使用ファイル |
| --- | --- | --- | --- | --- |
| ピアノ | Versilian Community Sample Library（VCSL）— Upright Piano, Knight（収録 Simon Dalzell / Ivy Audio） | `github.com/sgossner/VCSL` commit `c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e`（2026-01-14） | CC0 1.0（リポジトリの `LICENSE`） | `Chordophones/Zithers/Upright Piano, Knight/Sustains/Player_vl2_rr1_{B0…B5}.wav` の全音おき 31 音 |
| フルート | VS Chamber Orchestra: Community Edition（VSCO 2 CE）— Flute（Versilian Studios / Sam Gossner） | `github.com/sgossner/VSCO-2-CE` commit `440300901dfe9275fd84e0b7763af1f8443ae62e`（2020-08-04） | CC0 1.0（リポジトリの `LICENSE`） | `Woodwinds/Flute/susvib/LDFlute_susvib_{C3…C6}_v1_1.wav` の 10 音 |
| ヴィオラ | VSCO 2 CE — Viola Section（セクション＝合奏の収録。ソロのヴィオラは無い） | 同上 | CC0 1.0 | `Strings/Viola Section/susvib/ViolaEns_susvib_{C2…D5}_v2_1.wav` の 13 音 |
| チェロ | VSCO 2 CE — Cello Section（セクション） | 同上 | CC0 1.0 | `Strings/Cello Section/susvib/susvib_{C1…F4}_v3_1.wav` の 13 音 |
| ハープ | VCSL — Concert Harp（KSHarp） | VCSL commit `c1ea7bcc…`（上と同じ） | CC0 1.0 | `Chordophones/Composite Chordophones/Concert Harp/KSHarp_{A2…D7}_f1.wav`（C3 だけ `_f2`）の 16 音 |
| ベル | VCSL — Hand Chimes | 同上 | CC0 1.0 | `Idiophones/Struck Idiophones/Hand Chimes/sus_{C3…C6}_r01_main.wav` の長3度おき 10 音 |
| ベース | VSCO 2 CE — Solo Contrabass（弓、ビブラートなし） | VSCO 2 CE commit `44030090…`（上と同じ） | CC0 1.0 | `Strings/Solo Contrabass/SusNV/BKCtbss_SusNV_{E0…B2}_v1_rr1.wav` の 12 音 |
| ドラム | VCSL — Frame Drum（大 = キック、小 = スネア） | VCSL commit `c1ea7bcc…` | CC0 1.0 | `Membranophones/Struck Membranophones/Frame Drum/HDrum{L,S}_Hit_v3_rr{1,2}_Sum.wav` の 4 音 |
| ギター | FreePats — Spanish classical guitar（ナイロン弦。Roberto / roberto@zenvoid.org が 2008 年に収録、2019-06-18 版） | `github.com/freepats/spanish-classical-guitar` タグ `v1.0.0`（commit `6f4eb1b092acc88f5448cea1a0001bd07b971af8`） | CC0 1.0（リポジトリの `LICENSE`、README の「Published under the terms of Creative Commons CC0」） | `samples/{C2…C6}.flac` の 43 音（SFZ が持つ収録音のうち MIDI 36〜84。G#4 は収録が無い） |
| キーボード | VCSL — Yamaha TX81Z の FM Piano（パッチは VCSL の作者が作成し実機から収録。`Electrophones/TX81Z/Origin.txt`） | 同上 | CC0 1.0 | `Electrophones/TX81Z/FM Piano/FMPiano_{C4…C7}_vl2.wav` の長3度おき 10 音 |

- 個々の元ファイル名は `samples/manifest.js` の `source` に全部ある
- 加工: 先頭の無音を削除、モノラル化、-1 dBFS に正規化、MP3 112kbps。ピアノ 3.5 秒・フルート 4.0 秒で切って末尾をフェード。
  ヴィオラ・チェロは 3.6 秒まで（ループ用のクロスフェードを入れ、後ろにループ始端からの続きを 0.1 秒）。ハープ 4.0 秒・ベル 4.5 秒・ドラム 1.4 秒・キーボード 3.0 秒・ギター 3.5 秒で切って末尾をフェード（ギターは FLAC から変換）。ベースは 3.0 秒まで（ループ用。ヴィオラ・チェロと同じ処理）
- 弱い層: ピアノ `Player_vl1_rr1_{G1…D#5}.wav`（アプリが使う MIDI 43〜87 の 23 音）、ハープ `KSHarp_{A2…A6}_mf1.wav`（C3 は `_mf3`、D7 は mf が無い）15 音、キーボード `FMPiano_{C4…C7}_vl1.wav` 10 音
- ハープと TX81Z のファイル名は音名が科学的表記（A4 = MIDI 69）。他は 1 オクターブ下の表記。どちらも build 時に実測で確かめる
- CC0 なので表示義務は無いが、VSCO 2 CE の Readme のお願いに従って上記のとおりクレジットする（Versilian Studios / Sam Gossner、Ivy Audio / Simon Dalzell）。サンプル単体での販売はしない
- FreePats の Upright Piano KW は、公式ページでライセンスを確認できなかったため使っていない。
  ギターは Human の指定（FreePats Nylon-String Acoustic Guitar）。公式ページ（freepats.zenvoid.org）はこの環境から開けなかったが、
  公式の GitHub リポジトリ（freepats/spanish-classical-guitar）の LICENSE と README で CC0 1.0 を確認した
- ギターの元データは SFZ（`SpanishClassicalGuitar-20190618.sfz`）+ FLAC。ブラウザは SFZ / SF2 を直接鳴らせない。
  検討した方法: ① sfizz（WASM、BSD-2）や js-synthesizer（FluidSynth の WASM、SF2、Apache-2.0）でそのまま鳴らす、
  ② smplr（MIT）など SFZ の割り当てを読むライブラリ、③ FLAC を変換して既存のエンジンで鳴らす。
  ③を採った: 追加の依存なし・既存のエンジン（ゾーン選択・余韻・遅延読み込み）をそのまま使える・iPhone の FLAC デコードに頼らない。
  SFZ の割り当て（`lokey / hikey / pitch_keycenter`）は manifest のゾーンと「最も近い収録音」で同じ結果になる。`ampeg_release=1.5` は余韻の上限 1.5 秒にした
- 再生コード（`sample-engine.js` / `sample-hooks.js`）は本リポジトリのコードで、音源のライセンスとは別

## 音源の作り直し

```sh
git clone --filter=blob:none --no-checkout https://github.com/sgossner/VCSL vcsl
git clone --filter=blob:none --no-checkout https://github.com/sgossner/VSCO-2-CE vsco
git clone --filter=blob:none --no-checkout https://github.com/freepats/spanish-classical-guitar fpg
python3 -I tools/music-composer/scripts/build_samples.py --vcsl vcsl --vsco vsco --fpg fpg --out tools/music-composer/samples
```

（git / ffmpeg / numpy が必要。`--filter=blob:none` なので、取り出すのは使う 210 ファイルだけ）
