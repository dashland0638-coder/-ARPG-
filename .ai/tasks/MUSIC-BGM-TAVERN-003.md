# MUSIC-BGM-TAVERN-003 — 酒場 BGM の途中の途切れ（編曲の最小修正）

Status: PR #107（CONTENT READY = HUMAN DEVICE CHECK REQUIRED）

## Approval

- [x] Approved（Human 2026-10-30「楽曲の途中で1小節程度、音が途切れるように感じる箇所があり、不自然です」）

## Goal

静かな雰囲気を保ったまま、曲の途中で音が不自然に途切れる印象をなくす。再生の仕組み・ループ処理ではなく、編曲（音の長さ・余韻）で直す。

## 調査（Analyzer）

[`../reports/MUSIC-BGM-TAVERN-003-report.md`](../reports/MUSIC-BGM-TAVERN-003-report.md) §1。8 拍ごとの最後の 1 拍で、チェロが切れていた（全楽器の休符ではなく、音の長さの不足）。

## 計画（Planner）

- 作曲アプリ v5.71.0（`make_v571.py`）: 酒場のチェロを次のチェロの始まりまで伸ばす。他は v5.70.0 のまま。v5.70.0 は変えない。
- 6 段階を v5.71.0 から書き出し直す（`render-bgm.mjs` の既定の元を v5.71.0 に）。
- 修正前の 6 段階と聞き比べのページを `public/audio/bgm/compare/` に置く。
- テスト: unit（v5.71.0 の差・修正前の音源）、E2E（譜面の途切れ・書き出した音の大きさ・聞き比べのページ・公開ビルド）。

## Files To Change

- **新規**
  - `tools/music-composer/ARPG_Music_AI_Composer_v5_71_0.html`、`ARPG_Music_AI_Composer_v5_71_0_samples.html`、`scripts/make_v571.py`
  - `tools/music-composer/exports/tavern-stages-v5_70.json`
  - `public/audio/bgm/compare/index.html`、`public/audio/bgm/compare/v5_70/*.mp3`（修正前。git mv）
  - DEC-014、本ファイル、報告
- **変更**
  - `public/audio/bgm/tavern-*.mp3`、`tools/music-composer/exports/tavern-stages.json`
  - `tools/music-composer/scripts/render-bgm.mjs`（既定の元）、`scripts/build-prototype.mjs`（`--base` で別の版の試作も作る）
  - テスト: `tests/unit/tavern-bgm.test.js`、`tests/music-sample-engine.spec.js`、`tests/tavern-bgm.spec.js`、`tests/production-build.spec.js`
  - 文書: `tools/music-composer/README.md`、`docs/CHAPTER1_PLAYTEST.md`、NEXT-DEV-PLAN

## Files Not To Change

- 作曲アプリ v5.67.0〜v5.70.0（試作を含む）・`sample-engine.js`・`sample-hooks.js`・`samples/`
- `src/`（再生・ループ・段階の選び方・音量・出撃と帰還）、`basefile.html`、セーブ

## 受け入れ条件

1. 不自然に無音になる箇所が無い（譜面で、どの段でも伸びている音が切れる時間が無い。書き出した音で、半小節ごとの大きさが中央値より 8dB 以上下がらない）。
2. 静かな部分の余韻が残る（チェロが次の音まで伸びる）。
3. 旋律・和音・他の楽器・段階ごとの楽器は変わらない。音量の倍率も同じ。
4. 6 段階すべてで直っている。
5. ループ・音量・出撃と帰還は壊れていない（既存の E2E）。
6. 修正前と聞き比べられる。
7. build・unit・関連 E2E・CI・独立 Reviewer PASS。iPhone の確認が終わるまで CONTENT READY = HUMAN DEVICE CHECK REQUIRED。

## Result

報告: [`../reports/MUSIC-BGM-TAVERN-003-report.md`](../reports/MUSIC-BGM-TAVERN-003-report.md)
