# MUSIC-BGM-TAVERN-001 — 完成済み酒場 BGM の実機反映（報告）

基準: `main` `1cad92d`（PR #106 の merge）。branch `claude/tavern-bgm-roadmap`。Work Item: [`../tasks/MUSIC-BGM-TAVERN-001.md`](../tasks/MUSIC-BGM-TAVERN-001.md)、決定: [DEC-012](../decisions/DEC-012-tavern-bgm.md)。

Status: CONTENT READY = HUMAN DEVICE CHECK REQUIRED

## 1. 現状（Analyzer）

| 項目 | 事実 |
| --- | --- |
| ゲームの BGM | `src/audio/asset-manifest.js` の `BGM_TRACKS` は全部 null。`public/audio/` は無い。酒場は `procedural-bgm.js` の手続き生成（音量 1.0 で -36.5 LUFS、ピーク -24.7 dBFS。実測） |
| 登録した BGM の鳴らし方（変更前） | `<audio loop>`。読み込みに失敗すると無音（manifest のコメントは「戻る」と書いていたが、実際は戻らなかった）。iPhone の Safari は `volume` を無視するので、BGM の音量設定が効かない |
| 作曲アプリ | `tools/music-composer/` の v5.67.0（確定版、sha256 固定）〜 v5.70.0、サンプル版 `v5_70_0_samples.html`（v5.70.0 + 末尾 3 行）。音声の書き出し機能は無い |
| 承認の記録（MUSIC-AUDIO-001） | v5.67.0 = 酒場 BGM の確定版 → v5.68.0（合成音の修正。Human「OK」）→ v5.69.0（ギターの編集）→ **v5.70.0（ギターの和音。Human が聞き比べて採用）**。サンプル音源は Human が iPhone で「酒場 → 完成版 → 生成 → サンプル」を確認し、全項目「問題なし」（2026-10-12） |
| 完成済みの音声ファイル | 無い（リポジトリ・PR・README のどこにも無い） |
| 曲の決まり方 | 曲は場面・曲の文・修正の差分から作る種（`hash(scene\|baseText\|delta)`）で決まる。同じページで続けて生成すると、前の曲の文を引き継ぐ |
| 2 つの曲の文 | 画面で「酒場」を選ぶと `sceneDefaults.tavern` が入る。自動テストは `TAVERN_EXAMPLE_PROMPT`（v5.29 の例文）を使う。完成版で比べると、**旋律もテンポも違う曲**になる（103 BPM と 109 BPM、ヴィオラの旋律が別）。楽器（9）と音数（334）は同じ |
| PR #72（MUSIC-AUDIO-004） | 開いたまま。作曲アプリのサンプル読み込み中の再生の修正で、書き出しには関係しない（今回は触らない） |

## 2. 確定版の特定（Phase B）

- **採用**: v5.70.0 のサンプル版。場面「酒場」、加入段階「完成版（第6段階）」、音源「サンプル」（10 楽器すべてサンプル。酒場はキーボード以外の 9 楽器を使う）。
- **曲の文**: リポジトリだけでは決められなかった（§1）。
  - 2 曲を同じ方法で書き出して Human に聞き比べてもらい、**候補 A = `sceneDefaults.tavern`** に決まった（Human Decision 2026-10-28）。
  - 候補 A は、iPhone 確認の手順「酒場 → 完成版 → 生成」を新しいページで行ったときの曲と同じ。
- **後の版の承認を保つ**: v5.70.0 のギターの和音を含む。サンプルのギターは、次のストロークで前の和音の弦を止める（MUSIC-AUDIO-001 #27）。
- **構成を保つ**: 1 周は 80 音（40 小節）、完成版の 9 楽器。アプリの通し再生をそのまま録るので、編曲・楽器・強さ・長さはアプリと同じ。

## 3. 書き出し（`tools/music-composer/scripts/render-bgm.mjs`、新規）

1. Playwright の Chromium でアプリの HTML を開く。ファイルはスクリプトがフォルダから直接配り、外部へは出ない。
2. `state.track = null` で新しく 1 回だけ生成する。続けて生成したときの文の引き継ぎを避けるため。
3. `SampleHooks.setEnabled(true)` で音源を「サンプル」にし、読み込みを待つ。
4. `audioCtx` を `OfflineAudioContext`（44.1kHz・ステレオ）に差し替えて、アプリの `playTrack()` を 1 回呼ぶ。
   - 雑音（残響・合成ドラム）の `Math.random` は決まった種にする。
   - 録る長さは 1 周 P（`scoreTiming(t).eventStart(80)` をサンプル数で丸めたもの = 47.766984 秒）より 6 秒長くする。
5. P より後ろ（最後の音の余韻・残響）を頭に足し戻す。
   - 音の経路は足し算だけなので、これは同じ曲を 2 回続けて鳴らしたときの 2 回目と同じ音になる。
   - 6 秒の終わりは完全に無音（`tailEnd` 0）。
6. 前後に 1 秒ずつ同じ音の続きを付ける。ループ点は `loopStart` 1 秒、`loopEnd` 48.766984 秒。
   - MP3 の先頭の遅れがデコーダによって残っても、両端が同じだけずれるので継ぎ目は変わらない。
7. ピークを -1 dBFS にそろえる（+12.95 dB。曲は変えない）。ffmpeg libmp3lame 128kbps CBR で、LAME の情報タグを付ける。

**採らなかった方法**: 同じ曲を 3 回続けて予約して録り、2 回目を切り出す方法。収録音の交互（ドラムの rr1 / rr2。エンジンの中の数え方）と合成ドラムの雑音の作り置きが回ごとに変わり、回ごとの音が最大 0.12 違ったため。

### 書き出した音源の検証

| 項目 | 結果 |
| --- | --- |
| 元データ | `ARPG_Music_AI_Composer_v5_70_0_samples.html` sha256 `37d76168…cf969d42`（`exports/tavern.json`。unit で今の HTML と照合） |
| 曲 | 103 BPM、80 音、譜面のイベント 334（休符を除く）、楽器 9（Piano・Cello・Flute・Harp・Guitar・Bass・Drums・Bell・Viola） |
| サンプルで鳴った音 | ピアノ 30・フルート 80・ヴィオラ 40・チェロ 10・ハープ 20・ベル 12・ベース 18・ドラム 80・ギター 186（弦ごと）。合成音へ戻った音 0 |
| 形式 | MP3（MPEG-1 Layer III）、44.1kHz、ステレオ、128kbps CBR、LAME 情報タグ（遅れ 576・詰め物 1564 サンプル） |
| 長さ | 49.766984 秒（デコード後。Chromium は詰め物を取る）。詰め物を含むフレームの長さは 49.8155 秒（ffprobe） |
| 1 周 | 47.766984 秒（2,106,524 サンプル） |
| 容量 | 797,485 バイト（約 0.8MB） |
| 音量 | -14.0 LUFS（統合）、LRA 2.4 LU、ピーク -1.4 dBFS（MP3 のデコード後） |
| 繰り返しの一致（書き出し前） | ループ始端の前後 2 秒と 1 周あとの差 0（完全一致）、つなぎ目の段差 0 |
| つなぎ目（MP3 をデコードした後、E2E） | ループ終端の前後 0.5 秒と始端の前後 0.5 秒の差 0.044（-27 dB。MP3 の誤差）、飛ぶ所の段差 0.003（普段の隣の音の差 0.10 より小さい）。対照として、ループ点を 5 ミリ秒ずらすと 1.68、50 ミリ秒ずらすと 1.55 |
| 再現性 | 同じ手順を 2 回行うと、録音は浮動小数の誤差の範囲で一致（RMS が 8 桁一致）。MP3 はその誤差でビット単位では一致しないので、採用したファイルは sha256 `f46acdd3…c586b871` で固定する（unit） |
| ライセンス | 収録音はすべて CC0 1.0（VCSL・VSCO 2 CE・FreePats。`tools/music-composer/README.md`）。録音した BGM の配布に制約は無い |

## 4. ゲームへの組み込み（Phase C）

| 箇所 | 内容 |
| --- | --- |
| `public/audio/bgm/tavern.mp3` | Vite が `dist/audio/bgm/tavern.mp3` へコピーする（build で確認） |
| `src/audio/asset-manifest.js` | `BGM_TRACKS.tavern = '/audio/bgm/tavern.mp3'`。新しく `BGM_TRACK_OPTIONS.tavern = { loopStart:1, loopEnd:48.766984, gain:0.5 }` |
| `src/audio/audio.js` `playBgm` | 登録した BGM を fetch してデコードする（URL ごとに 1 回。セッション中は保持。約 17MB）<br>`AudioBufferSourceNode`（loop・loopStart・loopEnd、曲の頭 = loopStart から開始）→ GainNode（BGM 音量 × gain）→ destination<br>ワールド切替・`stopBgm` では 0.08 秒でフェードして止める<br>読み込み中にワールドが変わったら鳴らさない（token）<br>読み込みに失敗したら警告を出し、手続き生成の BGM に戻る<br>AudioContext が無いときだけ、従来の `<audio loop>` |
| `setBgmVolume` | 曲の GainNode を 0.05 秒で目標値へ動かす（`<audio>`・手続き生成の扱いは今まで通り） |
| 本番の URL | 従来の `resolveAssetUrl()` のまま（`import.meta.env.BASE_URL` = `/-ARPG-/` を前に付ける）<br>Node の unit で読めるよう、`import.meta.env` が無いときは '/' にする（Vite では動きは同じ） |
| 酒場以外 | 変更なし（手続き生成）。`setBgmIntensity` も手続き生成だけ |
| 起動時 | `buildWorld('tavern')` はタイトルの裏で走る（操作の前）。デコードと予約は止まった AudioContext のままでも進み、最初の操作で `resumeAudio()` が再開すると曲の頭から鳴る |

## 5. テスト（Phase D）

| テスト | 結果 |
| --- | --- |
| build | OK（`dist/audio/bgm/tavern.mp3` 797,485 バイト） |
| unit 全体 `npm run test:unit` | 2095 pass / 0 fail / 1 skip（skip は変更前から。変更前は 2080 pass） |
| 新規 unit `tests/unit/tavern-bgm.test.js`（6 件） | ① 登録とループ点・音量が書き出しの記録と同じ（他のワールドは null のまま）<br>② MP3 のフレームを数えて、形式（MPEG-1 Layer III・44.1kHz・128kbps・ステレオ）・LAME の情報タグ・長さ・ループ点の余白・容量を確かめる<br>③ 記録の sha256 が今の mp3 と、元の HTML が今の v5.70.0 サンプル版と一致。曲の文は `sceneDefaults.tavern`、加入段階は完成版の 9 楽器、80 音。書き出し時の検算が 0<br>④〜⑥ 偽の AudioContext と fetch で `audio.js` を動かす: 読む URL、ループ点、開始位置、音量（中 → 大 → オフ）、同じワールドで二重に鳴らない、洋館へ移ると止まって手続き生成、酒場へ戻っても読み直さない、`stopBgm`、読み込み中の切替、404 で手続き生成へ戻る |
| 新規 E2E `tests/tavern-bgm.spec.js`（4 件、Chromium） | 酒場で `/audio/bgm/tavern.mp3` を取得（200・audio/mpeg）し、デコードした 2ch・49.77 秒の曲を loop・ループ点・開始位置で鳴らす。ゲーム開始後も 1 つだけ<br>デコードしたつなぎ目の差が 0.15 未満（実測 0.044）<br>設定の BGM 音量（中 → 大 → オフ → 小）が GainNode に効く<br>404 では手続き生成に戻り、ページのエラーなし |
| E2E `tests/production-build.spec.js`（1 件追加） | 公開用のビルド（`/-ARPG-/`）で `http://localhost:4173/-ARPG-/audio/bgm/tavern.mp3` を取得し、200・audio/mpeg。`dist/` のファイルが public と同じ大きさ |
| 関連 E2E（既存） | `audio.spec.js`・`music-sample-engine.spec.js`・`mansion-scenario.spec.js`: 26 pass。`production-build.spec.js` + `tavern-bgm.spec.js`: 10 pass |
| CI | PR で確認する |

- 既存のテストは弱めていない。skip・retry・timeout も足していない。
- ブラウザの自動テストは、再生を予約したこととデコードした波形までを見る。実際に聞こえることの証明ではない（§7）。
- E2E はこの環境の Chromium の版が Playwright と合わないため、AD-001 の設定で実行した。

## 6. 判断（Agent Decisions）

| # | 決定 | 根拠 | 代替案 |
| --- | --- | --- | --- |
| 1 | サンプル音源で書き出す | Human が最後に iPhone で確かめた状態。MUSIC-AUDIO-001 の目的 | 合成音（確定版 v5.67.0 の初期値） |
| 2 | 余韻を頭へ足し戻す 1 回録り（§3） | 回ごとの音が揃い、継ぎ目が「2 回目」と同じになる | 3 回続けて録る（音が揃わない） |
| 3 | 前後 1 秒の続き + ループ点 | MP3 の詰め物がデコーダで残っても継ぎ目が変わらない（Safari の扱いに依存しない） | 詰め物の量を決め打ちしてループ点を補正 |
| 4 | WebAudio で鳴らす（`<audio loop>` をやめる） | 継ぎ目の隙間を無くす。iPhone で音量の設定を効かせる | `<audio>` + MediaElementSource（継ぎ目は残る） |
| 5 | 読み込み失敗で手続き生成へ戻す | manifest の「失敗しても今まで通り」の約束。無音の区間を作らない（HD-C2） | 無音（変更前の実際の動き） |
| 6 | ファイルはピーク -1 dBFS、ゲーム内は `gain` 0.5 | MP3 の精度を保ち、ゲーム内の大きさは 1 か所で直せる | 書き出しの段階で小さくする |
| 7 | 128kbps CBR ステレオ | 約 0.8MB。ASSETS.md の目安（1〜2MB）以下。定位（パン）を保つ | モノラル・VBR |

## 7. iPhone の実機で確かめること（HUMAN DEVICE CHECK REQUIRED）

`docs/CHAPTER1_PLAYTEST.md` A-01a。PR のテスト版で確かめる。

1. 消音スイッチを切り、「はじめる」を押す。酒場で BGM が鳴り始める。鳴り始めが遅すぎないか（ファイル 0.8MB の読み込みとデコードの時間）。
2. 曲の頭から鳴る。1 周（約 48 秒）の切れ目で途切れ・無音・プツッという音がない。2〜3 周聞く。
3. 音質: ピアノ・フルート・ギター・ヴィオラなどが割れずに、作曲アプリで聞いた候補 A と同じに聞こえる。
4. 音量: 設定の BGM（オフ / 小 / 中 / 大）で大きさが変わる。「中」で効果音・会話とのバランスが不自然でない。大きすぎ・小さすぎなら `gain` を直す。
5. 酒場から出撃すると止まる。出撃先は今まで通りの BGM。酒場へ戻ると曲の頭から鳴る。
6. 画面ロック → 復帰、アプリの切り替え → 復帰の後も鳴る（または操作で再開する）。

## 8. 未解決・実機で未確認

- iPhone の Safari で、MP3 の詰め物を取るかどうかは未確認（取らなくても継ぎ目は変わらない設計。§3 の 6）。
- 鳴り始めの遅れ・デコード後のメモリ（約 17MB）の影響は、実機では未計測。
- 酒場で鳴らすのは完成版だけ。仲間の加入に合わせて段階（剣士 → … → 完成版）を切り替えるかは Human の判断（DEC-012 §5）。
- 酒場以外の曲（洋館など）は、作曲アプリでの承認が無いので手続き生成のまま。
- 作曲アプリの E2E は今も `TAVERN_EXAMPLE_PROMPT` で比べている（候補 B）。アプリの検証としては変えていない。

## 9. Autonomy Metrics

- Human Escalation Count: 1（承認済みの曲の特定）
- Human Decision Count: 1（候補 A）
- Auto Fix Count: 1（3 回録りで音が揃わない → 1 回録り + 余韻の足し戻し）
- Reviewer Round Count: 1

## 10. Review

**Round 1: PASS**（独立 Reviewer、`fb98892`）。ブロッキングな指摘は無かった。

**Reviewer が自分で確かめたこと**
- 作曲アプリが変わっていないこと。
- 書き出しの手順が画面の操作と同じであること。
- 曲の構成が線形で、余韻を頭へ足し戻す方法が正しいこと。
- 1 周 P の値。
- 音量（-14.0 LUFS）。
- sha256。
- デコードしたつなぎ目（0.044）。
- `/-ARPG-/` の URL と dist。
- テストが実ファイルを見ていること、テストを弱めていないこと。
- ライセンス。
- ロードマップの記載が merge の記録と合うこと。

**非ブロッキングの指摘 2 件（どちらも直した）**
1. `audio.js` の冒頭と「3つのレイヤー」のコメントが、`<audio>` の方式のままだった。
2. ASSETS.md のメモリの目安が 44.1kHz 前提だった。
