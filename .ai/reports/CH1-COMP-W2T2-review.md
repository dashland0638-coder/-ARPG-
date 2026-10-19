# CH1-COMP-W2T2 Review

## Round 1/3

### Review Target

| 項目 | 値 |
| --- | --- |
| Task ID | CH1-COMP W2-T2（現行コードでの戦闘ベースライン再測定と、通常プレイの生存可能性の評価） |
| Branch | `claude/ch1-comp-w2t2-baseline-remeasure` |
| Reviewed SHA | `1d8a92188b456a5a4db74aee2b64b7a868b4479e` |
| Diff range | `origin/main`（`1205665`）`...1d8a921` |
| Handoff Verification | V-1 OK（remote のブランチに `1d8a921` あり）/ V-2 OK（`.ai/tasks/CH1-COMP.md` の W2-T2 節）/ V-3 OK（同節「Plan（Agent Decision）」）/ V-4 OK（旧形式。パスのみ）/ V-5 OK（同節 Test Report・Files）/ V-6 OK（差分 6 ファイル、終点 = Reviewed SHA） |
| Analysis Source | `.ai/reports/CH1-COMP-W2T2-analysis.md`（旧形式） |
| Plan Source | なし（Task file の「Plan（Agent Decision）」節） |

### Result

**CHANGES_REQUIRED**

範囲・spec の安全性・ほとんどの数値は正しい。ただし、報告書の結論表（§0・§4.1・§6）にある「倒れたときのボスの HP」が S3・S3T・S4 で実際より高く書かれている。
また、「通常プレイなら倒れる時刻」とみなす推論の前提に、性格の影響を「被ダメージには効かない」とした不正確な記述がある。
S5 の停止区間の数値の一部もデータと合わない。どれも記録の修正だけで直せる（ゲームのコードと測定のやり直しは不要）。

### Independence

別 Agent・同一セッションの Orchestrator が起動（Implementer の判断過程は入力にしていない。数値は生データから独立に再計算し、コードの FACT は `src/` を直接読んで確かめた）。
Human には、Required Changes の修正後の §0 の表を確認することを推奨する。

### Checklist

| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | 一部 NG | 依頼の測定項目（逃走・攻撃・回避と反撃、通常プレイとテストモードの区別、処刑の影響、iPhone の手順、次工程の基準）はそろっている。数値の誤り・推論の前提の誤り（Required Changes 1〜3） |
| 2 | Scope compliance | OK | 差分は `tools/baseline/` の新規 2 本、`.ai/reports/` の新規 3 本、`.ai/tasks/CH1-COMP.md` だけ。`git diff origin/main...HEAD -- src tests playwright.config.js basefile.html .github` と旧ベースラインの 3 ファイルは差分なし |
| 3 | Regression | OK | ゲームのコードの変更なし。`npx playwright test --list` は 296 件・`tools/baseline` 0 件（root の `testDir: './tests'`）で、通常の `npm test` に測定は入らない |
| 4 | Build | OK（未再実行） | ゲームのコードを変えていない。Implementer の `npm run build` PASS の記録あり |
| 5 | Unit tests | OK（未再実行） | 同上。`npm run test:unit` 1877 pass の記録あり |
| 6 | E2E tests | N/A | 長時間の測定は指示どおり再実行していない。E2E 全件は NOT_RUN（ゲームのコード変更なしのため妥当） |
| 7 | Save/Load integrity | OK | 通常プレイの spec は `addInitScript` で `soulforge_save_v1` を仕込むだけ（`tests/chapter1-progression.spec.js` と同じ手口）。セーブ形式・保存処理は変えていない |
| 8 | Existing behavior | OK | spec はゲームの状態を書き換えない。書くのは自前の `window.__bl` だけ。入力は実キーと `window` への合成 KeyboardEvent、Arena パネル・Debug Info の切り替え（表示だけ。`14-training-ground.js:222-226`）、設定のカメラ自動追従（既存 helper `disableCameraAutoFollow`。W2-T1 と同じ）。デバッグモードは使っていない |
| 9 | Code duplication | OK（許容） | W2-T1 の spec の撃破判定・会話処理・推定時間の式を複製しているが、旧 spec を残して再現性を保つ方針（依頼 §7）で、測定用ツールなので許容 |
| 10 | Unnecessary architecture changes | OK | なし |

### Changed Files

| ファイル | 内容 | 判定 |
| --- | --- | --- |
| `tools/baseline/ch1-combat-baseline-w2t2.spec.js`（新規） | 6 戦い方 × 2 回。DOM の読み取り・キー入力だけ | OK |
| `tools/baseline/ch1-normal-play-stats.spec.js`（新規） | セーブを仕込み、通常 URL でメニューの HP・攻撃力を読む | OK |
| `.ai/reports/CH1-COMP-W2T2-analysis.md`（新規） | 前提調査 | 一部修正（Required 2） |
| `.ai/reports/CH1-COMBAT-BASELINE-W2T2.md`（新規） | 測定結果・評価・iPhone の手順・次工程の基準 | 一部修正（Required 1〜3） |
| `.ai/reports/CH1-COMBAT-BASELINE-W2T2-data.json`（新規） | 生データ（12 試行＋補足 2＋通常プレイ） | OK |
| `.ai/tasks/CH1-COMP.md` | W2-T2 の行・Status History・W2-T2 節 | OK |

### Out of Scope Changes

なし。

### コードの FACT の確認（抜き取り 16 件、すべて `1205665` の `src/` で確認）

| # | 記述 | 確認箇所 | 結果 |
| --- | --- | --- | --- |
| 1 | HP = round((18 + 体力×7 + 装備 HP) × 倍率) | `12-progression-ui.js:1827`、`01-character-creation.js:141` | OK |
| 2 | 魔法使いの体力 10 | `01-character-creation.js:63` | OK |
| 3 | 第一章は成長を数えない（テストモードだけ有効） | `12-progression-ui.js:1801-1806`、`core/chapter1-rules.js:23-25` | OK |
| 4 | 初期装備 胴 HP+5・脚 HP+3 → 96 | `08-loot-equipment.js:191` | OK（実画面 96/96 とも一致） |
| 5 | 防御なし・倍率は慎重だけ・最小 1 | `core/damage-math.js:15-30`、`07-ai-combat.js:4961-4980` | OK |
| 6 | 被弾後の無敵時間なし（`invulnerable` と `paralyzeInvulnT` だけ） | `07-ai-combat.js:4601-4613`、`10-input.js:540-541` | OK |
| 7 | 薬草 = 最大 HP の 20%、満タンでは使えない | `08-loot-equipment.js:469-487` | OK |
| 8 | 宵待ちの村（z > 260）に宝箱・回復の結晶・休憩所なし | `06-player-enemy.js:5126`、`08-loot-equipment.js:563-618`・`:877-`、`registerCheckpoint` は `03-...:2798` の 1 か所 | OK |
| 9 | テストモードは HP 1 で止まる。最初の記録は間引かれない（`testModeSurviveMsgT = 0`） | `12-progression-ui.js:1189-1203` | OK |
| 10 | テストモードの性格は勇敢、通常の魔法使いは陽気（交代時に `state.personality` を更新） | `14-hud-boot.js:1619`・`:1869`、`01-character-creation.js:285` | OK |
| 11 | テストモードの薬草 99 | `14-hud-boot.js:1690` | OK |
| 12 | 処刑は攻撃キーの押下時だけ（押し続けのオートコンボは `tryAttack` 直呼び） | `13-update-loop.js:143-160`・`:190-192`、`09-save-load.js:323`（`!e.repeat`） | OK |
| 13 | 回避中は `attackHeldStart = null` | `13-update-loop.js:174-177` | OK（会話・ポーズ中も同じく消える点も同じ行） |
| 14 | ボス戦はカメラがボスの反対側へ寄る（S = 離れる） | `13-update-loop.js:2333-2341`、`10-input.js:504-508` | OK |
| 15 | 魔法使いの弾は `state.facing` の向き | `11-combat-actions.js:842-843` | OK |
| 16 | 段階 2 は HP ≤ 65%、段階 3 は ≤ 30%。移行の爆発は半径 4.5・`round(atk×0.9)`・予兆なし。振りかぶり 0.55 / 0.55 / 0.40 | `07-ai-combat.js:4545-4549`・`:4646`・`:4653-4678` | OK |
| 17 | メニューのバージョン表示 `ver x (build)` | `14-hud-boot.js:357-361`、`core/build-check.js:36-39`、`index.html:334` | OK。5 連打のデバッグモードは `DEV_UI`（`?dev=1`）でしか動かない（`02-world-common.js:1620-1622`）ので、手順の公開版では誤って入らない |

### Recomputation

`/tmp/claude-0/-home-user--ARPG-/cff73452-1314-5b91-b2b3-48eba85d36bf/scratchpad/review/recompute.py`（`python3 -I`）で `-data.json` の `hits`・`notes`・`bossHp`・`bossAi`・`executions`・`executeWindows`・`midFightDialogues` から再計算した。

| 対象 | 再計算したもの | 結果 |
| --- | --- | --- |
| §4.1 | 撃破時刻、最初の HP1 の時刻、累計 ≥ 96 の時刻と何発目、被弾 n / 合計、プレイヤー・支援の n / 合計、支援の割合、Break / 処刑、途中の会話 | すべて一致。HP1 と累計の差は全 10 試行で 0.05 秒 |
| §4.1 / §0 / §6 | 倒れたときのボスの HP | **不一致（Required 1）**。報告の値は倒れる時刻の直前の 1 秒刻みの標本（最大 0.7 秒前）。S3・S3T・S4 は 3 発目が段階 2 の爆発で、爆発はコード上 HP ≤ 65% でしか起きない（`07-ai-combat.js:4547`）。報告の S3 69.7〜70.0%・S3T 69.4〜70.3%・S4 #2 65.4% はいずれも 65% より上で、ありえない |
| §4.2 | 段階の時刻（トースト）、段階ごとの被弾 n / 合計、毎分（被弾の回数 / 分） | 一致（境の時刻ちょうどの被弾は新しい段階に数える扱い。爆発が新しい段階に入るので妥当）。S3 #2 の段階 2 は 3.65 で、表の 3.6 は丸め |
| §4.3 | 値による出どころの分類（33 本体・30 爆発・29 写し影・20 残響・19 分身・18 泡）、倒れるまでの順、撃破までの回数・合計、「他」（26・28・34） | 一致 |
| §4.4 | 振りかぶり 7 / 回避 6、回避後の本体の被弾 0、ボスが最も近いフレームの割合 93% / 91%、S5 の最小 HP（96 − 93 = 3、96 − 63 = 33。`hpTrace` の最小 2.73% / 34.4% とも整合） | 一致 |
| §4.4 | ボスの HP が止まっていた区間 | **不一致（Required 3）**。下の表 |
| §4.4 | 実際の戦闘時間 約 13〜14 秒 | AI の止まり（#1 9.4→18.0、#2 9.05→17.3）を引くと 12.9 / 13.75 秒。「約 13〜14 秒」は妥当（INFERENCE のまま） |
| §4.5 | 処刑の窓・処刑の時刻、S3T と S3 の差 0.3〜0.7 秒 | 一致 |
| §4.6 | 薬草 k 個で倒れる時刻（累計 ≥ 96 + 19.2k）、撃破まで要る数（撃破までの累計 < 96 + 19.2k となる最小の k） | 一致（S1 40〜44、S2 81〜82、S3 7、S3T 9、S4 24〜35、S5 0） |
| §10 | 旧データ（`.ai/reports/CH1-COMBAT-BASELINE-data.json`、1 つの配列）の撃破時刻・被弾・プレイヤーの命中 | 一致。設計書 §3.5 の CALC の引用も一致 |
| §2.2 | 通常プレイ 96/96・攻撃力 30（酒場・村） | `normalPlayStats` と一致。`testModeUiShown: false` |

S5 の停止区間（Required 3 の根拠）:

| 試行 | 報告 | ボスの HP の標本 | ボスの AI 状態 | 途中の会話の記録 |
| --- | --- | --- | --- | --- |
| S5 #1 | 10.1〜18.3 秒（27%） | 9.2〜17.2 秒の標本が 27.3% のまま、18.3 で 25.5% | 8.95 WINDUP → 9.4 RECOVERY → **18.0** CHASE | 13.5・15.1・16.7 |
| S5 #2 | 10.1〜18.2 秒（30%） | 9.1〜16.0 秒の標本が 30.0% のまま、**17.2 で 28.1%** | 9.05 WINDUP → **17.3** RECOVERY | 13.1・14.7・16.3 |

### 推論・記述の確認

- 「最初の HP1 の時刻 = 通常プレイなら倒れる時刻」: 最大 HP（実測 96 / 96）・被弾の値・薬草未使用・倒れる前にレベルアップなし（記録上、レベルアップは全て S2 53.2 秒以降）は確認できた。**ただし性格の差が「被ダメージには効かない」は不正確**（Required 2）。勇敢の与ダメージ ×1.05 でボスの HP が速く減り、段階移行の爆発（被ダメージ）の時刻が早まる。S3・S3T・S4 の致命の 3 発目はこの爆発なので、通常プレイ（陽気）では倒れる時刻が少し遅れうる（3 発で 96 という結論は変わらない）。S5 では爆発に当たるかどうかが位置次第なので、時刻のずれが生死に関わりうる。
- FACT / 実測 / 推定の区別: §7.1 と分析の表で分かれている。被弾の出どころ・停止時間・薬草の CALC が推定であることも明記されている。
- S5 の生存: 「理想に近い操作」「人の操作では未確定」「余裕は 1 撃分」「2 試行」と限定がついていて、過大ではない。
- PR #89 の影響: 本測定の戦い方の範囲（Break は 10 秒以降だけ）で「ほぼ無い」と言っており、データと合う。
- 実機確認をしていないこと、通常プレイを最初から最後まで自動で測っていないこととその理由（この環境では 1 区画 40 秒前後。`tests/duskvillage.spec.js` の冒頭）は §5・§7.2・§8 に明記されている。
- §8 の iPhone の手順: 準備・戦い方・記録項目・判定基準・保留の条件がそろい、バージョンの場所（メニュー下端の `ver … (build)`）も正しい。
- §9: 依頼の「通常プレイで生存できない可能性が残る間は、ボスの攻撃を追加しない」と整合する（実機の C の確認を先にする）。
- Task file: W2-T2 の行・Status History・Files・Test Report は差分と一致する。

### Risks

- 1 条件 2 試行・自動の理想に近い操作（報告書に明記済み）。
- S1〜S4 の 10 試行は、S5 の向き直りを足す前の spec（`c37994b` より前）で測っている。変更は S5 の制御だけなので S1〜S4 の値には影響しない（spec の差分で確認）が、再実行の比較では HEAD の spec を使うこと。
- 倒れたときのボスの HP（Required 1）は、§9 の「改修の後に比べる値」には入っていないが、§0 で Human が最初に読む値。

### Required Changes

| # | ファイル / 箇所 | 問題（根拠） | 期待する状態 | 確認方法 |
| --- | --- | --- | --- | --- |
| 1 | `.ai/reports/CH1-COMBAT-BASELINE-W2T2.md` §0 の表（「そのときのボスの HP」S3/S3T 69〜70%）、§4.1 の列「そのときのボスの HP」、§6 の「攻撃中心」行（「ボスの HP 70%」）。S1 #1 の 78% なども同じ方法 | 値は倒れる時刻の **直前の 1 秒刻みの標本**（`bossHp`。S3 #1 は 3.1 秒の標本を 3.6 秒の値として使用）。S3・S3T・S4 は 3 発目が段階 2 への移行の爆発で、爆発は HP ≤ 65% でしか起きない（`src/legacy/parts/07-ai-combat.js:4547`）。報告の 69.4〜70.3%（S3・S3T）、65.4%（S4 #2）は 65% を超えており、データの読み方の誤り | S3・S3T・S4 は「65% 以下（段階 2 への移行の爆発で倒れる。直前の標本は 69〜70%）」のように、コード上の閾値に合う値にする。表の注に「直前の標本（最大 0.7 秒前）」の読み方を書く。§0・§6 の文言も合わせる | `bossHp` の標本の時刻と `normalPlayDown.firstHp1SimSec`、`notes` の「闘気を纏った」の時刻を突き合わせる（S3/S3T/S4 は段階 2 の時刻 = 倒れる時刻） |
| 2 | 報告書 §5 の「性格」行（「被ダメージには効かない」）と §4.1 の箇条（「倒れる時刻までの条件は通常プレイと同じ（性格の差を除く）」）、`.ai/reports/CH1-COMP-W2T2-analysis.md` Summary 3（「生死に直接効くのは HP 1 で止まるだけ」）と §F の末尾の INFERENCE（「性格の違いはプレイヤーの与ダメージにだけ効き、被ダメージには効かない」） | 勇敢の与ダメージ ×1.05（HP 50% 以上）でボスの HP の減りが速くなり、**段階移行の爆発の時刻**（`07-ai-combat.js:4546-4547`、HP 比で起きる）が早まる。S3・S3T・S4 の致命の 3 発目はこの爆発なので、通常プレイ（陽気）では倒れる時刻が少し遅れうる。S5 は爆発に当たるかが位置次第で、時刻のずれが生死に関わりうる。現状の記述は推論の前提を過小に書いている | 「性格は被ダメージの値には効かないが、プレイヤーの与ダメージを通じて段階移行の爆発の時刻を変える」と直す。S3・S3T・S4 は「3 発（33＋33＋30 = 96）で倒れる結論は変わらず、時刻は少し遅れうる（INFERENCE）」、S5 は「爆発に当たるかが変わりうる」と限定を足す | 該当箇所の文言を読む。`src/core/damage-math.js:56-59`（勇敢）と `07-ai-combat.js:4546-4547`（段階移行）を照合 |
| 3 | 報告書 §4.4 の表「ボスの HP が止まっていた区間」 | S5 #1「10.1〜18.3 秒」・S5 #2「10.1〜18.2 秒（30% のまま）」がデータと合わない。#2 は 17.2 秒の標本で既に 28.1%。両試行とも 9.1〜9.2 秒の標本で既に止まった値になっている（上の Recomputation の表） | 標本の範囲で書く（例: #1「9.2〜17.2 秒の標本が 27.3%、18.3 秒で再開」、#2「9.1〜16.0 秒の標本が 30.0%、17.2 秒で再開」）か、ボスの AI 状態が止まっていた区間（#1 9.4〜18.0、#2 9.05〜17.3）で書き、どちらの読み方かを明記する。「約 8 秒」「実際の戦闘時間 約 13〜14 秒」はその値と整合させる | `trials[S5-1/S5-2].bossHp` と `bossAi.transitions` を読む |

推奨（任意。PASS の条件にはしない）:
- §4.1 の「全試行で、レベルアップはボスの撃破の時点（またはその直前）」: S4 #2 はレベルアップの記録が無く、S4 #1 は撃破の 1.3 秒前。結論（倒れる前にレベルアップなし）は正しいので、「記録のある試行では」等に直すとよい。
- §4.2 の「毎分」は「被弾の回数 / 分」と明記するとよい。
- §8.1 の「`1205665` 以降」は、括弧の中のコミットの前後を人が見分けにくい。「GitHub の main のコミット一覧で `1205665` より新しいか」など見分け方を添えるとよい。
