# DEC-012 — 酒場 BGM: 承認済みの曲の特定と、ゲームでの鳴らし方

Status: Accepted（Human の依頼 2026-10-28「次期開発計画の更新 ＋ 完成済み酒場BGMの実機反映」、Human Decision 2026-10-28）。
決定 4（ループ点で繰り返す）・5（完成版の 1 曲だけ）は [DEC-013](DEC-013-tavern-bgm-stages.md) で置き換えた。曲（決定 1〜3）は変えていない

## 決定

1. **採用する曲**: 作曲アプリ v5.70.0 のサンプル版（`ARPG_Music_AI_Composer_v5_70_0_samples.html`）で次の手順で作る曲
   - 場面「酒場」、加入段階「第一章クリア後・完成版」、音源「サンプル」。
   - 曲の文は、画面で「酒場」を選んだときに入る文（`sceneDefaults.tavern`）。
   - 理由: 確定版 v5.67.0 の後に、Human が採用した v5.70.0（ギターの和音）と、iPhone で確認したサンプル音源（MUSIC-AUDIO-001）を含む、最新の承認済みの状態だから。
2. **Human Decision（2026-10-28）**: 同じ手順でも、曲の文が `sceneDefaults.tavern` か `TAVERN_EXAMPLE_PROMPT` かで、旋律もテンポも違う曲になる（103 BPM / 109 BPM）
   - リポジトリの記録だけでは、どちらで承認したかを確定できなかった。
   - Agent が 2 曲を書き出し、Human が聞き比べて **候補 A（`sceneDefaults.tavern`、103 BPM）** を選んだ。
3. **書き出し**: アプリ・譜面・音源エンジン・収録音は変えない。新しい `tools/music-composer/scripts/render-bgm.mjs` で書き出す
   - 方法: ヘッドレスの Chromium でアプリ自身の通し再生を `OfflineAudioContext` で録る。
   - 1 周: 80 音目の枠（40 小節、47.77 秒）。最後の音の余韻は 1 周の頭へ重ねる。
   - 形式: MP3 ステレオ 44.1kHz 128kbps。ピーク -1 dBFS にそろえる（音量だけ）。
4. **ゲームでの鳴らし方**: 登録した BGM ファイルは `<audio loop>` ではなく WebAudio でデコードし、`AudioBufferSourceNode` の `loopStart` / `loopEnd` で繰り返す。音量は GainNode で掛ける
   - 読み込みに失敗したときは、手続き生成の BGM に戻る。
   - WebAudio が無いブラウザでは、従来どおり `<audio loop>` で鳴らす。
5. **酒場で鳴らす段階**: 完成版の 1 曲だけを、第一章の進行に関係なく鳴らす。Human の依頼文「完成済みの酒場BGM」に従った
   - 仲間の加入に合わせて段階を切り替える（剣士 → … → 完成版）のは別の Work Item で、Human の判断が要る。

## Reason

- **`<audio loop>` を使わない理由**
  - MP3 の先頭・末尾の詰め物と、ブラウザのループの切れ目のために、1 周ごとに無音の隙間ができる。
  - iPhone の Safari は `HTMLMediaElement.volume` を無視するので、BGM の音量設定が効かない。
- **ゲーム内の音量**: 書き出しは -14 LUFS で、手続き生成の酒場 BGM（音量 1.0 で -36.5 LUFS）よりずっと大きい。曲ごとの `gain` 0.5（-6 dB）で、音量「中」のとき約 -28 LUFS にした。大きさの最終判断は iPhone の実機確認で行う。

## Alternatives Considered

- **`<audio loop>` のまま**: 鳴らす仕組みは変えずに済むが、継ぎ目の隙間と iPhone の音量の問題が残る。
- **合成音モードで書き出す**: 確定版 v5.67.0 の初期の音に近い。ただし Human が最後に iPhone で確かめたのはサンプル音源で、MUSIC-AUDIO-001 の目的もサンプルへの置き換えだった。
- **同じ曲を 3 回続けて予約して録り、2 回目を切り出す**: 収録音の交互（ドラムの rr1 / rr2）と雑音の作り置きが回ごとに変わり、回ごとの音が揃わなかった（試して不採用）。

## Related

- `.ai/tasks/MUSIC-BGM-TAVERN-001.md`、`.ai/reports/MUSIC-BGM-TAVERN-001-report.md`
- `tools/music-composer/exports/tavern.json`
- `tests/unit/tavern-bgm.test.js`、`tests/tavern-bgm.spec.js`
