# MUSIC-AUDIO-001

Status: REVIEWING（自動テストは PASS。iPhone 実機の確認が未実施のため合格としない。main への merge は Human）

Analysis: .ai/reports/MUSIC-AUDIO-001-analysis.md（branch `claude/cc0-sample-audio-engine-76noqo` @ `6ba05c8`）

## Approval
- [x] Approved
- Approval type: Agent Approval（`../AGENTS.md` §6.1）
- Escalation Check: 1回目は Escalation（音楽アプリの実体がリポジトリに無い）。Human が v5.66.0、続いて v5.67.0 の HTML を共有して解消
- Approved by / date / where: Planner (Agent) / 2026-10-11 / branch `claude/cc0-sample-audio-engine-76noqo`
- Scope of approval: `tools/music-composer/` の新設、テスト2本、`.ai/` の記録、`.gitignore` は変更なし(既存の `dist/` で除外)
- Persistence: 許可（branch: `claude/cc0-sample-audio-engine-76noqo`、根拠: セッションの割当）

## Goal
音楽アプリの音源を、JavaScript の簡易合成音から実際の楽器を収録したサンプル音源へ段階的に置き換える。今回はピアノとフルートの試作に限定する。
追加（Human 指示）: ヴィオラとチェロもサンプル音源にする。続いてハープとベル。ピアノの音量を 30% 上げる。続けてベース・ドラム（ギターは CC0 の収録が無く見送り）。続けてキーボード（ギターは合成音のまま）。続けてベロシティの2層目。続けて合成音モードの不具合修正（v5.68.0）。続けてメモリ削減。Human 決定でギター（FreePats Nylon-String Acoustic Guitar）と iPhone 実機検証。

## Constraints
- 酒場 BGM の確定版を基準として保護する。作曲エンジン・自然言語の作曲指示・40小節1ループ・楽器の加入段階・譜面編集を壊さない
- 既存の HTML を直接上書きしない。専用ブランチで行う
- ゲーム本体を代わりに編集しない
- CC0 を確認できない音源は使わない。数 GB の音源集を丸ごと同梱しない

## Implementation Plan
Analysis §3〜§5 のとおり。

## Files To Change
- 新規 `tools/music-composer/`（基準 HTML・試作 HTML・`sample-engine.js`・`sample-hooks.js`・`samples/`・`scripts/`・`README.md`）
- 新規 `tests/unit/music-sample-engine.test.js` / `tests/music-sample-engine.spec.js`


## Files Not To Change
ゲーム本体のすべて（`src/` `index.html` `basefile.html` `public/` `docs/` ほか）。基準 HTML の中身。

## Acceptance Criteria → 結果
| 条件 | 結果 |
| --- | --- |
| 既存の作曲・譜面・編集を維持 | 合成音モードで基準と同じ track・譜面イベント・発振器数（E2E） |
| 譜面と音が同じイベント | サンプルモードの4楽器は `buildTruthScore` のイベントと音程・開始時刻が1対1（E2E） |
| 確定版の聞こえ方 | フルート・ヴィオラ・チェロ・ハープの強さ・長さ・奥行きが v5.67.0 の合成音の再生と完全一致。ベルは合成音が鳴らす 3 音が一致し、譜面の残り 9 音を追加。ベース・ドラムも合成音の 98 音が一致し、ベースは譜面の style-bass 8 音を追加（E2E） |
| 弦の長い音 | 8 秒の音がループで減衰せず、つなぎ目に段差なし（E2E。全 26 ゾーンを手動確認） |
| 再生・停止・連続再生・セル試聴 | E2E（重複なし、古い AudioContext は closed、試聴は常に1つ） |
| セル音量が再生に反映 | 200% で level がちょうど2倍（E2E） |
| 読み込み失敗でも止まらない | 404 で「読み込み失敗 → 合成音」、合成音と同じ発振器数で再生（E2E） |
| 出典・バージョン・ライセンス | `tools/music-composer/README.md` |
| iPhone Safari | 確認表（9 項目）を README に記載。**未実施のため合格としていない** |

## Risks
- iPhone Safari での実機確認が一部未実施。デコード後のメモリは曲ごとに約 7〜23MB（全部なら約 104MB）
- サンプルモードではピアノが鳴る（v5.67.0 の通し再生ではピアノが鳴っていない）

## Rollback
音源を「合成音」に戻す（初期値）。または基準 HTML を使う。ブランチを merge しなければゲームへの影響は無い。

## Out of Scope
全楽器の置換、作曲アルゴリズム、酒場 BGM の再編曲、ゲーム本体、合成音モードでピアノが鳴らない既存の不整合の修正。

## Agent Decisions
| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |
| 1 | 既存 HTML を変えずフック3行で載せる形にし、基準は v5.67.0（確定版）にする | 既存 HTML を変えない制約。v5.66.0→v5.67.0 の差分はギター音量2行だけでフックに影響なし | v5.66.0 のまま |
| 2 | `tools/music-composer/` に置く（ゲームのコードに触れない） | 使えるリポジトリが1つだけ。ゲーム本体を編集しない制約 | 新リポジトリ（作成権限・Human 判断が要る） |
| 3 | ピアノ = VCSL Upright Piano Knight、フルート = VSCO 2 CE | 両方 CC0 をリポジトリの LICENSE で確認。VCSL に横笛が無い | FreePats（CC0 を確認できず不採用） |
| 4 | MP3 モノラル 112kbps、全音おき / 長3度おき、3.5〜4 秒 | iOS の decode 互換と容量（計 2.1MB） | WAV（約 100MB）、Ogg（古い iOS 不可） |
| 5 | 外部の再生ライブラリを使わない | 単一 HTML・バンドラ無し。必要機能が小さい | Tone.js / smplr（MIT） |
| 6 | 既定は合成音。サンプルは利用者が選ぶ | 確定版の保護 | 既定をサンプル |
| 7 | サンプルモードではピアノも譜面どおり鳴らす（Human が「そのまま残す」と決定） | DoD「譜面表示と実際の音が同じイベント」 | ピアノは試聴だけ |
| 8 | ヴィオラ・チェロは VSCO 2 CE の Viola / Cello Section susvib（強い方の velocity） | CC0。ソロのヴィオラは無い。弱い velocity は -20〜-28 dB で正規化するとノイズが上がる | VCSL（弦の持続音が無い） |
| 9 | 弦はループ（1.2〜3.6 秒、0.3 秒の等パワー・クロスフェード）で伸ばす | 譜面の長い音（最大 3.2 拍 ×1.16）に収録音の長さで切れない。容量 3.6 秒/音 | 長いサンプル（容量が数倍） |
| 11 | ハープ = VCSL Concert Harp（f 層）、ベル = VCSL Hand Chimes | CC0。ベルはアプリの音域と柔らかい音色に合う | Tubular Bells（音域が低い）、Glockenspiel（硬い） |
| 12 | ベルは譜面の 12 か所すべて鳴らす（合成音は 3 か所） | DoD「譜面と音が同じ」。ピアノと同じ扱い | 合成音と同じ 3 か所 |
| 13 | ピアノの gain 1.0 → 1.3 | Human の試聴「小さめなので 30% 大きく」 | － |
| 14 | ベース = VSCO 2 CE Solo Contrabass SusNV v1（弓） | 合成音のベースは持続型。v1 は立ち上がりが速い | ピチカート（減衰型で合成音と性格が違う） |
| 15 | ドラム = VCSL Frame Drum（大 = キック、小 = スネア）、rr を交互 | 酒場の「軽いリズム」。Bass Drum は演奏会用の大太鼓 | Bass Drum 2 + Snare Drum Modern |
| 16 | ギターは合成音のまま | VCSL・VSCO 2 CE に収録が無い。他の CC0 音源を確認できない | 未確認の音源（不採用ルール） |
| 17 | キーボード = VCSL TX81Z FM Piano（pluck・keys・synth 共通） | CC0。酒場に影響しない。エレピは keys の合成音（saw + triangle）に近い | ハープシコード（pluck だけに合う） |
| 18 | 弱い層はピアノ・ハープ・キーボードだけ（強さの実測で選ぶ） | 通し再生の強さの分布。ピアノ・キーボードはほぼ全部が弱い | 全楽器（容量 2 倍、効果の無い楽器が多い） |
| 19 | 弱い層の音量は RMS で強い層にそろえる（zone.gain） | 強弱は level だけで決め、これまでの音量調整（ピアノ +30% など）を崩さない | 収録の音量差を残す（全体が小さくなる） |
| 20 | 合成音モードの修正は v5.68.0 として別ファイルで作る（v5.67.0 は残す） | 既存 HTML を上書きしない制約。確定版の保護 | v5.67.0 を直接修正 |
| 21 | 再生は譜面イベントをそのまま鳴らす。譜面の値は確定版の音に合わせる。鳴っていなかった譜面の音は鳴らす。ヴィオラの長さの誤りは直す | 「譜面と音が同じイベント」と確定版の保護の両立。鳴らす扱いはサンプルモードで Human 承認済み | 譜面を音に合わせて鳴らない音を譜面から消す |
| 22 | 曲に要る収録音だけを読む（dry run で選ぶ）。未読み込みの音はその音だけ合成音 | 本番と同じ経路で選ぶので層・音域がずれない。遠いゾーンでの代用は音程の変形が大きい | 楽器単位で読む（ピアノは 54 音を全部持つ） |
| 23 | ギターは FLAC を MP3 に変換して既存のエンジンで鳴らす（SFZ プレイヤーを使わない） | 追加の依存なし。既存の遅延読み込み・譜面との対応をそのまま使える | sfizz / js-synthesizer（WASM）、smplr |
| 24 | ギターの編集は v5.69.0 で `track.guitarEdits`（移調・ずれ・長さ）。譜面と再生の両方に当てる | 要件 4。既存のエディタはギターを編集できない | ギターを主旋律から作り直す |
| 25 | 音名の欄が空の不具合も v5.69.0 で直す | ギターの音程の編集に必要。既存の音の編集も C4 に化けていた | 直さない |
| 10 | どの音を鳴らすか（音程・開始）は譜面イベント、強さ・長さ・奥行きは v5.67.0 の playTrack と同じ計算（`performance()`） | 確定版の保護が最重要。譜面の level / 長さと再生の値はヴィオラ・チェロで違う（下記） | 譜面の値で鳴らす（確定版の聞こえ方が変わる） |

### 見つけた既存の不整合（v5.67.0、変更していない）
- ヴィオラ: 再生は level に ×1.18 と `tavernMixLevel` を掛け、最後の区間は長さ ×1.16。譜面には無い
- ヴィオラの長さ: 再生側は「次の音まで伸ばす」計算で絶対時刻と譜面の時刻を比べている（`st=start+…` と `nextSt=tm.eventStart(…)`）。譜面のバーより短く鳴る
- チェロ: 再生は `tavernMixLevel` を2回掛ける（譜面は1回）
- ベル: 譜面は 12 か所、再生は 3 か所（0・7・12 音目）だけ
- ベース: 再生は `tavernMixLevel` を2回。譜面の `style-bass` は再生で鳴らない
- ドラム: 譜面の level（キック .072・スネア .05 ×drums）と再生の強さ（.090×drums、スネア ×.78、`tavernMixLevel`）が違う。再生はセル音量を掛けない
- キーボード: 譜面の keys / synth は通し再生で鳴らない（セル試聴だけ）

## Escalation
解消済み（音楽アプリの所在 → Human が HTML を共有）。

## Autonomy Metrics
- Human Escalation Count: 2（音楽アプリの所在 / 書き込み権限）
- Human Decision Count: 15（ギター音源の指定と iPhone 検証の指示 / v5.68.0 の聞こえ方を承認 / 続けて〔メモリ削減〕 / 合成音モードの修正を指示 / tools/music-composer/ への書き込みを許可 / 続けて〔ベロシティ〕 / 続けて〔ギターは推奨 A〕 / ベル 12 回を承認 / 続けて / v5.66.0 の HTML を共有 / v5.67.0 の HTML を共有 / ピアノはそのまま / 次はヴィオラとチェロ / 次はハープとベル / ピアノ +30%）
- Auto Fix Count: 4（ギター編集のテストで音名の欄が空の不具合を発見・修正 / E2E のバッファ音源の数え方 / ヴィオラの長さを再生と同じ計算に / ループ終端のはみ出し）
- Reviewer Round Count: 9
- Test Retry Count: 1（E2E「楽器ごとに合成音へ戻して聞き比べられる」: 全件実行の 1 回目に失敗、その後 単体 3 回・全件 7 回はすべて PASS。FLAKY として扱い PASS に数えない。失敗時の内容は残っておらず原因は未特定。失敗したときに状態を出すようにした。対象の変更（楽器ごとの切り替え）と関係する可能性がある: INFERENCE）
- PR Created: Yes（#70）

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-10-11 | Task | DRAFT → BLOCKED | Orchestrator | 音楽アプリがリポジトリに無い。Escalation |
| 2026-10-11 | Task | BLOCKED → IMPLEMENTING | Orchestrator | Human が v5.66.0 を共有 |
| 2026-10-11 | Task | IMPLEMENTING → REVIEWING | Tester | build / unit / E2E |
| 2026-10-11 | Task | REVIEWING → DONE | Reviewer / Orchestrator | PASS、PR 作成 |
| 2026-10-11 | Task | DONE → IMPLEMENTING → DONE | Orchestrator | Human が v5.67.0 を共有。基準を差し替え、unit / E2E 再実行 PASS |
| 2026-10-12 | Task | DONE → IMPLEMENTING | Orchestrator | Human: ピアノはそのまま、次はヴィオラとチェロ |
| 2026-10-12 | Task | IMPLEMENTING → DONE | Tester / Reviewer / Orchestrator | ヴィオラ・チェロ追加。unit / E2E PASS、PR #70 を更新 |
| 2026-10-12 | Task | DONE → IMPLEMENTING → DONE | Orchestrator | Human: 次はハープとベル、ピアノ +30%。unit / E2E PASS、PR #70 を更新 |
| 2026-10-12 | Task | DONE → IMPLEMENTING → DONE | Orchestrator | Human: 問題なし、続けて。ベース・ドラム追加、ギター見送り。unit / E2E PASS、PR #70 を更新 |
| 2026-10-12 | Task | DONE → IMPLEMENTING → DONE | Orchestrator | Human: 続けて。キーボード追加（ギターは合成音のまま）。unit / E2E PASS、PR #70 を更新 |
| 2026-10-12 | Task | DONE → IMPLEMENTING → DONE | Orchestrator | Human: 続けて。弱い層（ピアノ・ハープ・キーボード）追加。unit / E2E PASS、PR #70 を更新 |
| 2026-10-12 | Task | DONE → IMPLEMENTING → BLOCKED | Orchestrator | 合成音モードの修正。v5.68.0 の作成が実行環境の自動判定で拒否。Escalation |
| 2026-10-12 | Task | BLOCKED → IMPLEMENTING → DONE | Orchestrator | Human が書き込みを許可。v5.68.0 作成、unit / E2E PASS、PR #70 を更新 |
| 2026-10-12 | Task | DONE → IMPLEMENTING → DONE | Orchestrator | Human: v5.68.0 OK、続けて。メモリ削減（曲ごとに 7〜23MB）。unit / E2E PASS、PR #70 を更新 |
| 2026-10-12 | Task | DONE → IMPLEMENTING → REVIEWING | Orchestrator | Human: ギター（FreePats）と iPhone 実機検証。ギター・v5.69.0・計測の表示を追加。unit / E2E PASS。iPhone 実機は未実施（合格としない） |
