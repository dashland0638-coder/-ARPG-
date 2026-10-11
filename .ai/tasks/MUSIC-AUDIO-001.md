# MUSIC-AUDIO-001

Status: DONE（PR 作成まで。main への merge は Human）

Analysis: .ai/reports/MUSIC-AUDIO-001-analysis.md（branch `claude/cc0-sample-audio-engine-76noqo` @ `6ba05c8`）

## Approval
- [x] Approved
- Approval type: Agent Approval（`../AGENTS.md` §6.1）
- Escalation Check: 1回目は Escalation（音楽アプリの実体がリポジトリに無い）。Human が v5.66.0 の HTML を共有して解消
- Approved by / date / where: Planner (Agent) / 2026-10-11 / branch `claude/cc0-sample-audio-engine-76noqo`
- Scope of approval: `tools/music-composer/` の新設、テスト2本、`.ai/` の記録、`.gitignore` は変更なし(既存の `dist/` で除外)
- Persistence: 許可（branch: `claude/cc0-sample-audio-engine-76noqo`、根拠: セッションの割当）

## Goal
音楽アプリの音源を、JavaScript の簡易合成音から実際の楽器を収録したサンプル音源へ段階的に置き換える。今回はピアノとフルートの試作に限定する。

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
| 譜面と音が同じイベント | サンプルモードのピアノ・フルートは `buildTruthScore` のイベントと音程・開始時刻が1対1（E2E） |
| 再生・停止・連続再生・セル試聴 | E2E（重複なし、古い AudioContext は closed、試聴は常に1つ） |
| セル音量が再生に反映 | 200% で level がちょうど2倍（E2E） |
| 読み込み失敗でも止まらない | 404 で「読み込み失敗 → 合成音」、合成音と同じ発振器数で再生（E2E） |
| 出典・バージョン・ライセンス | `tools/music-composer/README.md` |
| iPhone Safari | 手順を README に記載。**実機は未実施** |

## Risks
- 基準が v5.67.0 ではなく v5.66.0（受け取れたのが v5.66.0 のみ）
- iPhone Safari の実機確認が未実施（AudioBuffer を別 AudioContext で使う動作・メモリ約 30MB）
- サンプルモードではピアノが鳴る（v5.66.0 の通し再生ではピアノが鳴っていない）

## Rollback
音源を「合成音」に戻す（初期値）。または基準 HTML を使う。ブランチを merge しなければゲームへの影響は無い。

## Out of Scope
全楽器の置換、作曲アルゴリズム、酒場 BGM の再編曲、ゲーム本体、合成音モードでピアノが鳴らない既存の不整合の修正。

## Agent Decisions
| # | 決定 | 根拠ソース（AGENTS.md §17.2） | 代替案 |
| --- | --- | --- | --- |
| 1 | v5.66.0 を基準に試作し、v5.67.0 へはフック3行で移せる形にする | Human が共有したのは v5.66.0 だけ。既存 HTML を変えない制約 | v5.67.0 を待って停止 |
| 2 | `tools/music-composer/` に置く（ゲームのコードに触れない） | 使えるリポジトリが1つだけ。ゲーム本体を編集しない制約 | 新リポジトリ（作成権限・Human 判断が要る） |
| 3 | ピアノ = VCSL Upright Piano Knight、フルート = VSCO 2 CE | 両方 CC0 をリポジトリの LICENSE で確認。VCSL に横笛が無い | FreePats（CC0 を確認できず不採用） |
| 4 | MP3 モノラル 112kbps、全音おき / 長3度おき、3.5〜4 秒 | iOS の decode 互換と容量（計 2.1MB） | WAV（約 100MB）、Ogg（古い iOS 不可） |
| 5 | 外部の再生ライブラリを使わない | 単一 HTML・バンドラ無し。必要機能が小さい | Tone.js / smplr（MIT） |
| 6 | 既定は合成音。サンプルは利用者が選ぶ | 確定版の保護 | 既定をサンプル |
| 7 | サンプルモードではピアノも譜面どおり鳴らす | DoD「譜面表示と実際の音が同じイベント」 | ピアノは試聴だけ |

## Escalation
解消済み（音楽アプリの所在 → Human が HTML を共有）。

## Autonomy Metrics
- Human Escalation Count: 1
- Human Decision Count: 1（v5.66.0 の HTML を共有）
- Auto Fix Count: 1（E2E のバッファ音源の数え方を修正）
- Reviewer Round Count: 1
- Test Retry Count: 0
- PR Created: Yes（PR 本文参照）

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-10-11 | Task | DRAFT → BLOCKED | Orchestrator | 音楽アプリがリポジトリに無い。Escalation |
| 2026-10-11 | Task | BLOCKED → IMPLEMENTING | Orchestrator | Human が v5.66.0 を共有 |
| 2026-10-11 | Task | IMPLEMENTING → REVIEWING | Tester | build / unit / E2E |
| 2026-10-11 | Task | REVIEWING → DONE | Reviewer / Orchestrator | PASS、PR 作成 |
