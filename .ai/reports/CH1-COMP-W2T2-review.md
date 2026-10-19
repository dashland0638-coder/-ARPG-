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

## Round 2/3

### Review Target

| 項目 | 値 |
| --- | --- |
| Task ID | CH1-COMP W2-T2（現行コードでの戦闘ベースライン再測定と、通常プレイの生存可能性の評価） |
| Branch | `claude/ch1-comp-w2t2-baseline-remeasure` |
| Reviewed SHA | `3059700e86a07d7824f52f7e267b33b147a2ced4` |
| Diff range | merge-base `1205665`（`origin/main` は現在 `29c94da` = PR #91 の merge 後）`...3059700`。Round 1 からの差分は `353b1ce..3059700`（報告書・分析・Task file の 3 ファイル。spec とデータは変更なし） |
| Handoff | Task file W2-T2 節の「Round 1 Fix」・コミット `3059700` |

### Result

**CHANGES_REQUIRED**

Round 1 の Required 2（性格の前提）と Required 3（S5 の停止区間）は直っている。Required 1（倒れたときのボスの HP）は §0・§4.1 だけ直り、**Round 1 で箇所として挙げた §6 の表が直っていない**（「ボスの HP 78%」「ボスの HP 70%」が残る）。§6 は §0 と矛盾し、70% はコード上ありえない値（段階 2 の爆発は HP ≤ 65% でしか起きない）。記録の修正だけで直る。

### Independence

別 Agent・同一セッションの Orchestrator が起動（Round 1 の Reviewer とも別の起動。Implementer の判断過程は入力にしていない）。数値は Round 1 のスクリプトを使わず、新しいスクリプトで生データから再計算した。コードの FACT は `src/` を直接読んだ。

### Checklist

| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | 一部 NG | §6 の表に誤った値が残る（Required 1）。それ以外の依頼の項目（逃走・攻撃・回避と反撃、テストモードと通常プレイの区別、処刑の影響、iPhone の手順、次工程の基準）はそろう |
| 2 | Scope compliance | OK | `git diff --stat origin/main...HEAD` は指定の 7 ファイルだけ（1298 行追加）。`src/`・`tests/`・設定の変更なし |
| 3 | Regression | OK | `npx playwright test --list` は 296 件で、`tools/baseline` の spec は 0 件（root の `testDir: './tests'`） |
| 4 | Build | OK（未再実行） | ゲームのコードの変更なし。Implementer の `npm run build` PASS の記録 |
| 5 | Unit tests | OK（未再実行） | 同上（1877 pass の記録） |
| 6 | E2E tests | N/A | 長時間の測定は指示どおり再実行していない |
| 7 | Save/Load integrity | OK | 通常プレイの spec はセーブを `addInitScript` で仕込むだけ。保存処理・形式は変えていない |
| 8 | Existing behavior | OK | spec は DOM の読み取り、実キー・`window` への合成 KeyboardEvent、Arena 表示の切り替え、自前の `window.__bl` の書き込みだけ。ゲームの状態（`state.*`）への代入は無い。spec は Round 1 から変わっていない |
| 9 | Code duplication | OK（許容） | W2-T1 の spec を残して再現性を保つ方針（測定用ツール） |
| 10 | Unnecessary architecture changes | OK | なし |

### Round 1 の指摘の確認

| # | 指摘 | 状態 | 根拠 |
| --- | --- | --- | --- |
| 1 | 倒れたときのボスの HP（§0・§4.1・§6） | **一部未修正** | §0・§4.1 は直った（S3/S3T/S4 は 65%、S1・S2 は補間）。§6 の 211・212 行目が「ボスの HP 78%」「ボスの HP 70%」のまま |
| 2 | 性格の前提 | 修正済み | 報告書 §5・§7.3・§5 の箇条、分析 Summary 3・§F。`core/damage-math.js:55-58`（勇敢は与ダメージのみ）、`core/damage-math.js:15-30`（被ダメージの倍率は慎重だけ）と整合 |
| 3 | S5 の停止区間 | 修正済み（軽微な残り） | 9.4〜18.0 / 9.05〜17.3 は `bossAi.transitions` と一致。ただし S5 #2 は 17.2 秒の標本で HP 28.1%・段階 3 のトーストも 17.2 秒なので、「その間ボスの HP の記録は変わっていない」は #2 では 17.2 の標本 1 点だけ外れる（推奨 1。結論の約 13〜14 秒には影響しない） |
| 任意 | レベルアップ・毎分・版の見分け方 | 修正済み | レベルアップの記録は S2 53.2/53.6、S3 10.8、S3T 11.45、S4 #1 45.4（撃破 1.3 秒前）、S5 21.5/21.6、S1・S4 #2 は無し。記述と一致 |

### Recomputation

`/tmp/claude-0/-home-user--ARPG-/cff73452-1314-5b91-b2b3-48eba85d36bf/scratchpad/review2/rc.py`（`python3 -I`、`-data.json` の `hits`・`notes`・`bossHp`・`bossAi`・`hpTrace`・`executions`・`executeWindows` から）。

| 対象 | 結果 |
| --- | --- |
| §4.1 撃破時刻・最初の「TEST MODE」の時刻 | 一致（S1 9.45/9.65、S2 5.10/5.05、S3 3.60/3.65、S3T 3.85/3.85、S4 5.30/7.80。S5 は記録なし）。累計 ≥ 96 の時刻は全 10 試行で +0.05 秒、何発目（4/4/3…）も一致 |
| §4.1 倒れたときのボスの HP | S1 補間 77.1 / 76.1、S2 85.1 / 85.4 → 「約 77 / 76 / 85」と一致。S3・S3T・S4 は段階 2 のトーストの時刻が最初の HP1 の時刻と全 6 試行で同じで、3 発目は 30（爆発）。`07-ai-combat.js:4546-4547`（`hpRatio<=0.65` で `triggerBossPhaseSkill(en,2)`）と合わせて「65%（段階 2 へ移った瞬間）」は妥当（補間値 63.4〜65.9 とも矛盾しない） |
| §4.1 被弾・プレイヤー・支援の回数 / 合計・支援の割合・Break / 処刑・途中の会話 | 一致。S5 #1 のプレイヤー 14 / 657 は撃破判定 21.5 の直後 21.55 の決め手の 1 撃を含む集計値（`damage.player`）で妥当 |
| §4.2 段階の時刻・段階ごとの被弾 | 回数・合計は全試行一致。毎分の被弾の回数は ±1 の丸め差のみ（例: S2 #1 段階 2 は 30 / 16.15 秒 = 111.5 → 表は 112） |
| §4.3 値による出どころの分類 | 一致（倒れるまでの順、撃破までの回数・合計、「他」26・28・34 が各 1 回で S4 #1・S5x） |
| §4.4 S5 | 振りかぶり 7/7、回避 6/6、ボスが最も近いフレーム 430/462 = 93%・432/473 = 91%、最小 HP 96 − 93 = 3（`hpTrace` 最小 2.73%）・96 − 63 = 33（34.4%）。本体の被弾は 0.35 / 0.5 秒の 1 撃だけ。停止区間 9.4〜18.0 / 9.05〜17.3 → 21.5 − 8.6 = 12.9、22.0 − 8.25 = 13.75 で「約 13〜14 秒」と一致 |
| §4.5 処刑 | 窓 10.35（S3）・11.1（S3T）・21.55（S5 #2）、処刑 11.15・21.6、S3T − S3 = 0.3〜0.7 秒。一致 |
| §4.6 薬草の CALC | k = 0/1/3/5 の時刻、要る数（S1 40/44、S2 81/82、S3 7、S3T 9、S4 35/24、S5 0）すべて一致 |
| §0 | §4.1 と一致 |
| §10 | 旧データ（8 試行）の撃破時刻・被弾・プレイヤーの命中と一致。S1 の最初の被弾は今回 6.8 / 6.25 秒、旧 7.5 / 6.6 秒で「6 秒以降」も正しい。設計書 §3.5 の CALC（`origin/main` `29c94da` の `.ai/reports/CH1-COMBAT-PROTO-design.md:279-284`）の引用も一致 |
| §2.2 | `normalPlayStats`: 酒場・村とも 96 / 96・攻撃力 30、`testModeUiShown: false`。全試行の `statsBefore.hp` も 96 / 96 |

### コードの FACT の確認（抜き取り 13 件。`1205665` の `src/`）

| # | 記述 | 確認箇所 | 結果 |
| --- | --- | --- | --- |
| 1 | HP = round((18 + 体力×7 + 装備 HP) × 倍率) | `12-progression-ui.js:1827`、`01-character-creation.js:141` | OK |
| 2 | 魔法使い 体力 10、初期装備 胴 HP+5・脚 HP+3 → 18+70+8 = 96 | `01-character-creation.js:63`、`08-loot-equipment.js:191` | OK |
| 3 | 防御なし。被ダメージの倍率は慎重だけ・最小 1 | `core/damage-math.js:15-30` | OK |
| 4 | 被弾後の無敵時間なし（`invulnerable` / `paralyzeInvulnT` だけ） | `07-ai-combat.js:4602` 付近、`:4662` | OK |
| 5 | 薬草 = 最大 HP の 20%、満タンでは使えない | `08-loot-equipment.js:477`・`:484` | OK |
| 6 | 宵待ちの村は z > 260、休憩所の登録は 1 か所だけ | `06-player-enemy.js:5126`、`registerCheckpoint(` の呼び出しは src 全体で 1 件 | OK |
| 7 | テストモードは HP 1 で止まり、最初の記録は間引かれない（`testModeSurviveMsgT = 0`） | `12-progression-ui.js:1189-1203` | OK |
| 8 | テストモードは勇敢、通常の魔法使い（第二の主人公）は陽気 | `14-hud-boot.js:1619`、`01-character-creation.js:285` | OK |
| 9 | 勇敢は与ダメージ ×1.05（HP 50% 以上）/ ×1.15（30% 以下） | `core/damage-math.js:55-58` | OK |
| 10 | テストモードの薬草 99 | `14-hud-boot.js:1690` | OK |
| 11 | 処刑は攻撃キーの押下時だけ（`!e.repeat` → `attackInputDown` → `tryExecution`）。押し続けは `tryAttack` 直呼び。回避中は `attackHeldStart = null` | `09-save-load.js:323`、`13-update-loop.js:145-157`・`:174-177`・`:190-192` | OK（なお E キーも `tryExecution` を直接呼ぶ `09-save-load.js:330` が、spec は E を押さない） |
| 12 | ボス戦はカメラがボスの反対側へ寄る。魔法使いの弾は `state.facing` の向き | `13-update-loop.js:2333-2341`、`11-combat-actions.js:842-843` | OK |
| 13 | 段階 2 は HP ≤ 65%、段階 3 は ≤ 30%。移行の爆発は半径 4.5・`round(atk×0.9)`。振りかぶり 0.55 / 0.4。メニューの `ver x (build)` | `07-ai-combat.js:4546-4549`・`:4646`・`:4660-4664`、`14-hud-boot.js:357-361`、`core/build-check.js:36-39` | OK |

### 推論・記述の確認

- FACT / 実測 / 推定の区別は §5・§7.1 と分析の表で分かれている。§4.3（値で分けた出どころ）・§4.4（約 13〜14 秒）・§4.6（CALC）は推定と明記。
- 「最初の HP1 = 通常プレイなら倒れる時刻」は、性格が与ダメージを通して段階移行の爆発の時刻を変えうること、S5 では爆発の当たり外れ（生死）に効きうることまで書かれ、§5 の結論の行にも「性格の差で爆発の時刻がずれうる」が入った。過大な主張は無い。
- 実機確認をしていないこと（§8 冒頭）、通常プレイを最初から最後まで自動で測らなかった理由（§7.2）が明記されている。
- §8: 準備（版の確かめ方を含む）・戦い方 A/B/C/C'・記録項目・判定基準・保留の条件がそろう。
- §9: 「通常プレイで生存できない可能性が残る間は、ボスの攻撃を追加しない」を守り、攻撃追加の前に実機の C を置いている。
- Task file: W2-T2 の行（REVIEWING）・Status History・Files・Test Report は差分と一致。Round 1 Fix の 1 は「報告書 §0・§4.1」と書いており、§6 を直していないことと符合する（Required 1 の修正時に §6 を足すこと）。

### Risks

- **`origin/main` が `29c94da`（PR #91 の merge）へ進み、`.ai/tasks/CH1-COMP.md` が衝突する**（`git merge-tree --write-tree origin/main HEAD` で CONFLICT。#91 は W2-D の行の状態と Status History の 1 行を変えた）。PR を作る前に `origin/main` を取り込んで解消すること（両方の行を残すだけで済む見込み）。報告書の「PR #91（W2-D の設計書）」の参照は merge 後も有効。
- 1 条件 2 試行・自動の理想に近い操作（報告書に明記済み）。
- S5 #2 の停止区間の終わりは標本で ±0.1〜1 秒の幅がある（推奨 1）。

### Required Changes

| # | ファイル / 箇所 | 問題（根拠） | 期待する状態 | 確認方法 |
| --- | --- | --- | --- | --- |
| 1 | `.ai/reports/CH1-COMBAT-BASELINE-W2T2.md` §6 の表、211 行目（逃走中心「9.5 秒（ボスの HP 78%）」）と 212 行目（攻撃中心「3.6〜3.9 秒、ボスの HP 70%」） | Round 1 Required 1 で箇所として挙げた §6 が直っていない。§0・§4.1（約 76〜77% / 65%）と矛盾し、70% は段階 2 の爆発（`07-ai-combat.js:4547`、HP ≤ 65%）で倒れることと両立しない | 「ボスの HP 約 76〜77%」「ボスの HP 65%（段階 2 へ移った瞬間）」など、§0・§4.1 と同じ値にする。Task file の Round 1 Fix（または Round 2 Fix）に §6 を足す | `grep -n "78%\|70%" .ai/reports/CH1-COMBAT-BASELINE-W2T2.md` で §6 に残らないこと（§8.3 の記録の例「約 70%」は例示なので可） |

推奨（任意。PASS の条件にはしない）:
1. §4.4 の箇条「ボスの HP の記録（1 秒ごと）もその間は変わっていない」は、S5 #2 では 17.2 秒の標本が 28.1%（段階 3 のトーストも 17.2 秒）なので、「#2 は 16.0 秒の標本まで 30.0%」等にするとよい。
2. 分析 Summary 3 の「ほかは小さい」は、報告書 §5 の「S5 では生死に効く可能性がある」と合わせて「ほかは小さい（性格は S5 の爆発の当たり外れに効きうる。§F）」とするとよい。
3. PR の前に `origin/main`（`29c94da`）を取り込み、Task file の衝突を解消する（Risks）。
