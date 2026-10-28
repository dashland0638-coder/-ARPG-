# MUSIC-BGM-TAVERN-001 — 完成済み酒場 BGM の実機反映

Status: PR（Reviewer 判定は下。CONTENT READY = HUMAN DEVICE CHECK REQUIRED）

## Approval

- [x] Approved（Human 2026-10-28「次期開発計画の更新 ＋ 完成済み酒場BGMの実機反映」）
- Escalation（§17.3）: 承認済みの曲を特定できない。曲の文によって 2 曲ありえた。
  - 2 曲を書き出して聞き比べを依頼した。
  - Human Decision 2026-10-28: **候補 A**（`sceneDefaults.tavern`）（[DEC-012](../decisions/DEC-012-tavern-bgm.md)）。

## Goal

BGM 作成アプリで完成・承認済みの酒場 BGM を、公開ゲームで実際に再生される状態にする。新規作曲・再編曲はしない。

## 調査（Analyzer）

[`../reports/MUSIC-BGM-TAVERN-001-report.md`](../reports/MUSIC-BGM-TAVERN-001-report.md) §1〜§2。

- 確定版は v5.67.0 だった。その後、Human が v5.70.0（ギターの和音）を採用し、サンプル音源を iPhone で確認した。最新の承認済みは v5.70.0 + サンプル音源。
- 完成した音声ファイルはリポジトリに無かった（`public/audio/` 自体が無い）。`BGM_TRACKS.tavern` は null で、手続き生成の BGM が鳴っていた。
- アプリに音声の書き出し機能は無い。曲は文と生成の履歴で決まる。

## 計画（Planner）

- 書き出し: `tools/music-composer/scripts/render-bgm.mjs`（新規）。アプリ・譜面・音源は変えない。
- 組み込み
  - `public/audio/bgm/tavern.mp3` を置き、`BGM_TRACKS.tavern` に登録する。
  - `BGM_TRACK_OPTIONS.tavern` にループ点と音量を書く。
  - `audio.js` の BGM を WebAudio のループ再生に変える（継ぎ目と iPhone の音量のため）。
  - 読み込みに失敗したら手続き生成へ戻す。
- テスト
  - unit `tavern-bgm.test.js`: ファイル・元データ・再生の手順。
  - E2E `tavern-bgm.spec.js`: 実ファイルのデコード・ループ・音量・404。
  - E2E `production-build.spec.js`: `/-ARPG-/` の URL と dist。

## Files To Change

- **新規**
  - `public/audio/bgm/tavern.mp3`
  - `tools/music-composer/scripts/render-bgm.mjs`
  - `tools/music-composer/exports/tavern.json`
  - `tests/unit/tavern-bgm.test.js`
  - `tests/tavern-bgm.spec.js`
  - DEC-012、本ファイル、報告
- **変更**
  - `src/audio/asset-manifest.js`
  - `src/audio/audio.js`
  - `tests/production-build.spec.js`
  - `ASSETS.md`
  - `tools/music-composer/README.md`
  - `docs/CHAPTER1_PLAYTEST.md`（A-01a）

## Files Not To Change

- 作曲アプリの HTML（v5.67.0〜v5.70.0）・`sample-engine.js`・`sample-hooks.js`・`samples/`
- `procedural-bgm.js`、他のワールドの BGM
- `basefile.html`、legacy の連結方式、セーブ

## 受け入れ条件

1. 酒場の BGM が実音源として登録され、酒場で実音源が再生対象になる。
2. 音量設定・停止・ワールド切替が既存仕様どおり動く。
3. `/-ARPG-/` でも URL が解決し、dist に音声ファイルが入る。
4. 読み込みに失敗したら手続き生成に戻る。
5. テストは実ファイルと URL を確かめる。
6. 1 周が継ぎ目なしでつながる。ファイルは必要以上に大きくない。
7. build・unit・関連 E2E・CI・独立 Reviewer PASS。

## Result

報告: [`../reports/MUSIC-BGM-TAVERN-001-report.md`](../reports/MUSIC-BGM-TAVERN-001-report.md)
