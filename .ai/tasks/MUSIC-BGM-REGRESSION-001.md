# MUSIC-BGM-REGRESSION-001 — 酒場 BGM の段階切り替えの重なり・タイトル復帰時に止まらない

Status: PR（CONTENT READY = HUMAN DEVICE CHECK REQUIRED）

## Approval

- [x] Approved（Human 2026-11-01「酒場BGMの進行段階切り替え不具合・タイトル復帰時の停止不具合」）

## 不具合（Human が PR #107 の merge 後、第一章の通しプレイで確認）

1. 剣士の段から魔法使いの段へ進むと、追加の楽器は鳴るが元の曲も鳴り続け、2 つが重なってずれて聞こえる。
2. ゲーム中にタイトルへ戻っても、酒場 BGM が鳴り続ける。

## 調査（Analyzer）

[`../reports/MUSIC-BGM-REGRESSION-001-report.md`](../reports/MUSIC-BGM-REGRESSION-001-report.md) §1。

## 計画（Planner）

- `src/audio/audio.js`: BGM の音源を 1 つの台帳で持ち、止める・消す処理を 1 か所にまとめる。
  - 消すときは、予約した停止に頼らず、音量 0・出力から外す・停止まで行う。
  - フェードの後はタイマーで必ず消す。切り替えのたびに、フェード中の古い音源を先に消す。
  - 曲の位置は共通の時計（曲の頭の時刻）から決める。
  - `stopBgm()` はクロスフェード中も含めて全部止め、状態を空にする（何度呼んでもよい）。
- ゲーム側: タイトルへ戻るとき（`returnToTitle`）と、起動時のタイトル（`initThree` の直後）で `stopBgm()`。
  入場（`finishEnteringGame` の `buildWorld`）でその時点の BGM が鳴る。
- テスト: unit `bgm-regression.test.js`（新規）、E2E `bgm-regression.spec.js`（新規、実物の流れ）、既存の E2E を「タイトルでは鳴らさない」に合わせる。

## Files To Change

- `src/audio/audio.js`、`src/legacy/parts/10-input.js`、`src/legacy/parts/14-hud-boot.js`
- `tests/unit/bgm-regression.test.js`（新規）、`tests/bgm-regression.spec.js`（新規）、`tests/tavern-bgm.spec.js`
- 文書: 本ファイル、報告、DEC-015、`docs/CHAPTER1_PLAYTEST.md`（A-01a）

## Files Not To Change

- 6 段階の音源・作曲アプリ・`exports/`、`src/core/tavern-bgm.js`（段階の決め方）、`asset-manifest.js`
- 効果音・手続き生成の BGM・セーブ・`basefile.html`・legacy の連結方式

## 受け入れ条件

1. 段階を替えると、前の段は 2 秒で下がって止まり、出力から外れる。同時に鳴りうる音源は 2 つまで。続けて替えても増えない。
2. 新旧の段は同じ曲の位置から（共通の時計）。6 段階すべて同じ。酒場へ入り直すと、その時点の段を頭から。
3. タイトルへ戻ると、クロスフェード中でも全部止まる。タイトルの間は鳴らない（起動時も）。もう一度入ると正しい段が鳴る。
4. 効果音・音量の設定・BGM オフ・読み込みに失敗したときの代わりの音・AudioContext はそのまま。止める処理は何度呼んでもよい。
5. build・unit・関連 E2E・CI・独立 Reviewer PASS。iPhone の確認が終わるまで CONTENT READY = HUMAN DEVICE CHECK REQUIRED。

## Result

報告: [`../reports/MUSIC-BGM-REGRESSION-001-report.md`](../reports/MUSIC-BGM-REGRESSION-001-report.md)
