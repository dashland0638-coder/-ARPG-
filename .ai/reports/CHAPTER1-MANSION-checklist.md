# CHAPTER1-MANSION — 森の洋館 仕様照合表（CM-01）

Date: 2026-10-07
Work Item: CM-01（`.ai/reports/CHAPTER1-CONTENT-plan.md` P1）
Base: `main` `1ec6d44`（PR #36・#37 merge 後）

## 状態の定義

| 状態 | 意味 |
| --- | --- |
| **IMPLEMENTED** | コードがあり、本編の経路に置かれている |
| **PLAYABLE** | 本編の進行から、実際にその地点まで遊んで到達できることを確認した |
| **VERIFIED** | 自動テストまたは Human の実機で、成立を確認した |

- 推測の行は作らない。証拠の無いものは「未確認」と書く。
- Test Mode（Combat Arena を含む）で確かめた挙動は、**同じコードを通る範囲だけ**証拠にする。本編の到達の証拠にはしない。

## 1. 照合表

| # | 項目 | 仕様（`MANSION_SCENARIO.md`） | 実装（コード） | 自動テスト | 実機 | 状態 | 残り（Work Item） |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **5戦** | 戦闘表 ①〜④＋③' | `spawnTaggedGroup('forestAmbush' / 'servantAmbush' / 'manorWarden')`（`07-ai-combat.js:101,132,151`）、配置の `roomTag:'manorHall'`（4体）と `'manorDeep'`（4体） | 敵の挙動: `mansion-enemies.spec.js`、`mansion-warden.spec.js`、`mansion-butler.spec.js`、unit `mansion-enemies` / `mansion-warden` / `mansion-butler` / `mansion-combat-curve`。本編のワールドに組み上がることは `mansion-enemies.spec.js:291` / `mansion-butler.spec.js:317` | 未 | IMPLEMENTED（挙動は VERIFIED） | 各戦闘の発火を本編の経路で確認: CM-06 |
| 2 | **3フェーズのボス**（館の主） | 「館の主」節。閾値 0.65 / 0.30、フェーズは戻らない | `buildBoss('mansionBoss')`、フェーズ判定 `lordPhaseFor` / `lordShouldShiftPhase`（`core/mansion-enemies.js`） | `mansion-lord.spec.js:118,141,180,245`（Arena 経由）、`:286`（本編のワールドに主の間が組み上がる）、unit `mansion-lord.test.js` | 未 | IMPLEMENTED（戦闘は VERIFIED） | 本編の主の間での撃破: CM-04 |
| 3 | **6区画** | 座標レイアウト Z1〜Z7（ランプの区画は6） | `mansionZone('hall' / 'upper' / 'servant' / 'anomaly' / 'basement' / 'lord')`（`02-world-common.js:143-151`）。屋根裏（★4）は第一章では出ない | unit `mansion-lamp-zones.test.js` | 未 | VERIFIED（区画分け） | ― |
| 4 | **25部屋** | **CM-01 で追記**: 通常22＋異常空間3 | `MANSION_ROOMS`（`03-dungeons-mansion-temple.js:2228`）の id が25 | **無し**。`mansion-scenario.spec.js` 冒頭のコメントは「MANSION_ROOMS の表に対する静的な検算で確認できる」と書くが、その検算テストは存在しない | 未 | IMPLEMENTED | 表の静的検算（重なり・出入口・階段の着地）: **CM-02 に追加** |
| 5 | 階段（自動4本） | 階層移動の表（auto ✅ が4本） | `auto = true` が4か所（`:2629` 大階段、`:2804` 使用人用階段、`:3554` 地下入口、`:3643` 地下奥） | 無し | 未 | IMPLEMENTED | CM-06 |
| 6 | **鍛冶屋との合流** | 作業室で出会い、そこから同行 | `registerRoomEvent(uWork, …, {kind:'mansionEscortJoin'})` → `state.smithEscort = JOINED`（`12-progression-ui.js:445`）。追従 `escortFollowStep`（止まる 2.6 / 駆け足 6.0 / 飛ぶ 26.0、仕様と一致） | unit `mansion-anomaly.test.js`「作業室で合流するまで、鍛冶屋は動かない」「同行の追従」 | 未 | IMPLEMENTED（判定は VERIFIED） | 合流の一幕: CM-02 |
| 7 | **瓦礫イベント** | 瓦礫の通路。鍛冶屋の二言 → 剣士が気づく | `mansionRubble` → `playMansionRubbleScene` → `mansionInsight` | **無し** | 未 | IMPLEMENTED | CM-03 |
| 8 | **Skill 2 の閃き** | 崩し斬りを閃く | `grantChapter1Skill2()`、`learnedSkill2` を保存 | `chapter1-skill2.spec.js`（閃く前は無い／閃いた後は出る／セーブ往復）、`mansion-escort.spec.js:42` | 未 | 閃いた後の状態は VERIFIED。閃く場面は IMPLEMENTED | CM-03 |
| 9 | **分離** | 地下入口の扉をくぐると剣士だけが別の場所へ | 扉 `MANOR_SPLIT_DOOR (76,0,88)`（仕様と一致）、`registerRoomEvent(sDown)` → `playMansionSplitScene` → `SEPARATED` | unit `mansion-anomaly.test.js`「鍛冶屋との分離」（判定 `shouldSeparate` のみ） | 未 | IMPLEMENTED（判定は VERIFIED） | 分離の一幕: CM-02 |
| 10 | **異変空間** | `xFoyer` / `xCor` / `xHall`、照明段階 0〜3 | `buildMansionAnomaly`、`core/mansion-anomaly.js` | unit「異変は段階的に強くなる」「照明の狂いと、ボス撃破後の正常化」 | 未 | IMPLEMENTED（段階の判定は VERIFIED） | 部屋の組み上がりと進行: CM-02 |
| 11 | **再会** | 撃破後、本物の玄関ホールで再会 | `playMansionReunion`（`state.pos (0,0,-50)` = 本物の玄関ホール、`03-…:3026`）→ `REUNITED` | unit「ボス撃破後の再会」（判定 `shouldReunite` のみ） | 未 | IMPLEMENTED（判定は VERIFIED） | CM-04 |
| 12 | **撃破後の流れ** | 撃破 → 構造正常化 → 再会 → 工具回収 → 結果画面 → `BOSS_ENDING_LINES` → 酒場 | `normalizeMansionStructure` → `playMansionReunion` → `smithToolsRecovered` → `showBossResultScreen` | **無し**（E2E のボスは Arena から出すので、この経路を通らない） | 未 | IMPLEMENTED | CM-04 |
| 13 | **酒場への帰還と変化** | `smithJoined` / `smithToolsRecovered` の酒場 | `buildTavern` の分岐、`playSmithGreeting` | `mansion-scenario.spec.js:105,117`、`mansion-escort.spec.js:65,86`、`tavern-smith-greeting.spec.js:65,102` | 未 | VERIFIED（セーブ注入で） | 撃破から続けて戻る経路: CM-04 / CV-03 |
| 14 | **次のキャラクターへの接続** | 洋館クリア → 魔法使い＋剣士 | `core/chapter1-progress.js`、`joinSceneReady` | `chapter1-progression.spec.js:100,179`（クリア済みセーブから） | 未（WORK12.1 §16-1） | VERIFIED（セーブ注入で） | 撃破から続けての接続: CV-03 |
| 15 | 演出 | 演出の優先順位（ビジュアル → SE → 移動 → 短い会話 → 手記） | 各一幕は実装済み | 一部（上記） | 未 | IMPLEMENTED | チェック表: CM-05 |
| 16 | BGM / SE | ― | BGM は手続き生成 `MOODS.mansion`（実音源なし。HD-C2 で可）、SE は既存の cue | 無し | 未 | IMPLEMENTED | CM-05 |
| 17 | **通しプレイ** | 体験の骨格（森 → 酒場） | ― | 無し（この環境では歩いて通せない） | **未**（HE-2: Human が実機で行う） | ― | CM-06（区間の連結）、CM-07（Human の実機） |

**集計**
- VERIFIED: 区画分け（#3）、酒場の変化（#13）、次キャラへの接続（#14、ただしセーブ注入）。
- 判定や挙動だけ VERIFIED: 5戦の敵の挙動、ボスの戦闘、合流・分離・異変・再会の判定。
- 場面としては IMPLEMENTED 止まり: 瓦礫、閃きの場面、分離の一幕、異変空間の進行、撃破後の流れ。
- **PLAYABLE を確認できた項目は無い。** 本編の経路で洋館の中を通した記録が無い。

## 2. 仕様書の不整合と、CM-01 での修正

| # | 場所 | 不整合 | 判断の根拠 | 修正 |
| --- | --- | --- | --- | --- |
| D-1 | `MANSION_SCENARIO.md` 末尾「鍛冶屋」節（旧 :569） | 「使用人区画で再会する(同行はしない)」 | ① 同じ文書の「鍛冶屋の同行と、怪異による分離」節（作業室で同行開始 → 地下入口で分離）② 「ボス撃破後」節（玄関ホールで再会）③ コード: 合流 `mansionEscortJoin`、分離 `sDown` の扉 (76,88)、再会は本物の玄関ホール (0,0,-50) ④ unit `mansion-anomaly.test.js`（合流・分離・再会）⑤ `docs/SCENARIOS.md` の体験の骨格（作業室で出会う → 地下入口で分離 → 玄関ホールで再会）。**5つすべてが「同行する」で一致**し、旧 :569 だけが古い（以前は鍛冶屋が「ここで待つ」と自分から残る設計だった、と同行節に記録がある） | 「作業室で出会い、そこから同行する。地下入口の扉で引き離され、撃破後に本物の玄関ホールで再会する」に訂正し、旧記述から訂正したことを明記 |
| D-2 | 同節の1行目 | 「(PROGRESSION-004 で変更…以下はテストモードだけの記述)」の注記の後に、本編では無い作業台の話が続き、本編と Test Mode の区別が読み取りにくい | PROGRESSION-004（本編は作業台も無い）、`docs/SCENARIOS.md` の酒場の表 | 本編（何も無い）と Test Mode（仮設の作業台）を分けて書き直した。意味は変えていない |
| D-3 | 「部屋テーブル」節 | 部屋数の記載が無い。Analyzer の想定「22部屋」と実数25が食い違って見えた | `MANSION_ROOMS` の id は25（通常22＋異常空間3） | 「25（通常22＋異常空間3）、屋根裏は表に含まない」を追記。**22 は通常の部屋の数として正しく、25 は異常空間を含めた数** |
| D-4 | 「スキルの付け替え」節 | 画面名を「鑑定所」とだけ書き、「購入・ランク上げ」に触れている。第一章の本編では画面名は「鍛冶屋」で、購入は無い | `12-progression-ui.js:2589`（`legacyGrowth() ? '鑑定所' : '鍛冶屋'`）、HD-2 / HD-3（`docs/PROGRESSION.md`） | 本編は「鍛冶屋」、Test Mode は「鑑定所」と併記。第一章の本編には購入が無いことを1行追記（鍵の仕組みの説明は残す） |

**ゲームのコードは変更していない。** 不整合はすべて文書側にあり、コードと詳細節・テスト・`docs/SCENARIOS.md` は互いに一致していた。

## 3. コード側の課題（CM-01 の範囲外。移す先）

| # | 課題 | なぜ必要か | 移す Work Item |
| --- | --- | --- | --- |
| G-1 | `MANSION_ROOMS` の静的検算テストが無い（`mansion-scenario.spec.js` のコメントは「ある」と書いている） | 25部屋の重なり・出入口・階段の着地点が回帰で壊れても気づけない。コメントと実態も食い違っている | **CM-02**（unit で表を検算し、コメントを実態に合わせる） |
| G-2 | 合流・分離・異変空間の「場面」に E2E が無い（判定の unit だけ） | 一幕の途中で止まる・操作が戻らない、という種類の回帰を拾えない | CM-02 |
| G-3 | 瓦礫 → 閃きの場面に自動テストが無い | 同上 | CM-03 |
| G-4 | 撃破後の流れ（正常化 → 再会 → 工具 → 結果 → 酒場）に自動テストが無い | E2E のボスは Arena から出すため、本編の撃破後を一度も通っていない | CM-04 |

いずれも**テストの追加**で、ゲームの挙動の変更は含まない。挙動の不具合は見つかっていない。

## 4. 他の資料との整合

| 資料 | 結果 |
| --- | --- |
| `docs/SCENARIOS.md`（Chapter 1-① の体験の骨格、酒場の表） | 一致（作業室で出会う → 地下入口で分離 → 玄関ホールで再会） |
| `docs/CHAPTER1_STORY.md` | 洋館は対象外（「洋館の中身は変えない」）。「ずれ」の連鎖の最初＝館の主の 0.42 秒遅れの影は、仕様の「館の主」節と一致 |
| `.ai/decisions/DEC-004` | 洋館に触れる決定は無い |
| `docs/PROGRESSION.md`（HD-2 / HD-3） | D-4 を直して一致 |
| Chapter 1 System Freeze | 触れていない（文書のみ） |
