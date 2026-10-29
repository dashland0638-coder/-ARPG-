# MUSIC-BGM-TAVERN-002 — 酒場 BGM の継ぎ目と、加入段階の組み込み

Status: PR #107（CONTENT READY = HUMAN DEVICE CHECK REQUIRED）

## Approval

- [x] Approved（Human 2026-10-29「PR #107 の酒場BGMについて、以下の2点を改善してください」）

## Goal

1. iPhone 実機で起きる、酒場 BGM のループの継ぎ目の途切れをなくす。
2. 作曲アプリにすでにある「進行度に応じて楽器パートが増えるバージョン」を特定し、ゲームに組み込む。作曲・編曲はしない。

## 調査（Analyzer）

[`../reports/MUSIC-BGM-TAVERN-002-report.md`](../reports/MUSIC-BGM-TAVERN-002-report.md) §1〜§2。

- 段階版はアプリ v5.70.0 の「酒場BGMの成長」（`TAVERN_STAGE_POLICY`、6 段階）。同じ曲の文で、段階ごとに楽器だけが変わる。
- 書き出した音声はリポジトリ・ブランチ・文書のどこにも無かった。アプリから書き出す。
- 第二章の開始を表す進行状態は無い。段階は `scenarioClears` と主人公から決められる。

## 計画（Planner）

- 書き出し: `render-bgm.mjs` に `--stages` を足す。段階ごとに新しいページで生成し、同じ曲であることを確かめる。6 段階に同じ音量の倍率。
- 組み込み
  - `public/audio/bgm/tavern-<n>-<stage>.mp3` を 6 つ置き、`BGM_VARIANTS.tavern` に登録する（`tavern.mp3` は消す）。
  - `src/core/tavern-bgm.js`（新規）: 段階を選ぶ純粋関数。
  - `audio.js`: 1 周を写したバッファを丸ごと繰り返す。段階の切り替えは同じ位置から 2 秒のクロスフェード。
  - 酒場を組むときと、酒場にいる間の毎フレームで段階を見直す（`02-world-common.js`・`14-hud-boot.js`）。
- テスト: unit（ファイル・元データ・継ぎ目・切り替え・段階の選び方）、E2E（実ファイル・つづきから・切り替え・音量・404）、公開ビルド。

## Files To Change

- **新規**: `public/audio/bgm/tavern-1-swordsman.mp3` 〜 `tavern-6-complete.mp3`、`tools/music-composer/exports/tavern-stages.json`、`src/core/tavern-bgm.js`、`tests/unit/tavern-bgm-stage.test.js`、DEC-013、本ファイル、報告
- **削除**: `public/audio/bgm/tavern.mp3`、`tools/music-composer/exports/tavern.json`
- **変更**: `tools/music-composer/scripts/render-bgm.mjs`、`src/audio/asset-manifest.js`、`src/audio/audio.js`、`src/legacy/concat-plugin.js`、`src/legacy/parts/02-world-common.js`、`src/legacy/parts/14-hud-boot.js`、
  `tests/unit/tavern-bgm.test.js`、`tests/unit/mansion-presentation.test.js`、`tests/tavern-bgm.spec.js`、`tests/production-build.spec.js`、
  `ASSETS.md`、`tools/music-composer/README.md`、`docs/CHAPTER1_PLAYTEST.md`、DEC-012・MUSIC-BGM-TAVERN-001・NEXT-DEV-PLAN の参照

## Files Not To Change

- 作曲アプリの HTML・`sample-engine.js`・`sample-hooks.js`・`samples/`
- `basefile.html`、legacy の連結方式、セーブの形、進行、テストモード、敵の数値

## 受け入れ条件

1. 継ぎ目: ノードのループ点・開始位置に頼らず、1 周ちょうどのバッファを繰り返す。最後 → 最初の段差が普段の音の差より小さい。
2. 6 段階が同じ曲（主旋律・和音・テンポ・長さ）で、楽器だけがアプリの表どおりに増える。
3. 第一章は加入に合わせて段階が進み、第一章の後は完成版。再入場・出撃と帰還・セーブとロードで段階が狂わない。
4. 切り替えで途切れず、頭から鳴らし直さない。音量設定・BGM オフ・読み込み失敗時の代わりの音を保つ。
5. build・unit・関連 E2E・CI・独立 Reviewer PASS。
6. 実機の聴感は自動テストで保証したとしない。iPhone の確認が終わるまで CONTENT READY = HUMAN DEVICE CHECK REQUIRED。

## Result

報告: [`../reports/MUSIC-BGM-TAVERN-002-report.md`](../reports/MUSIC-BGM-TAVERN-002-report.md)
