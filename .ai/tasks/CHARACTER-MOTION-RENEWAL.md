# CHARACTER-MOTION-RENEWAL — プレイヤーキャラクターのモーション刷新

Status: PLANNED（今回は調査と計画のみ。実装は別途、計画・レビューを経て Human の指示で着手。DEC-035）
優先度: 通常。CHARACTER-VIS-002（造形）と並行実装しない

Analysis: .ai/reports/CHARACTER-MOTION-RENEWAL-analysis.md（branch `claude/wanderer-renewal-001-nhlxns` @ `0fe3195ae90211060f6863dcce1a0b10e08e32cf`、blob `0230126191bc11135980a42b1fa69a652444ac5b`）

## Goal
DEC-035（Human 2026-11-24）: 現状のモーションはプロトタイプ段階。キャラクターの見た目だけでなく、アクションゲームとして魅力的な動作へ改善する。
「可愛らしいキャラクターが、自然な立体感を持ち、職業ごとに異なる魅力的な動きで戦う」完成したアクション RPG の品質。

## Constraints
- 攻撃判定・判定の実時間・攻撃間隔・コンボの受付・キャンセル・回避の無敵 / 時間 / クールダウン・移動速度・入力・ゲーム時間を変えない（analysis §5 / §9）
- 不必要に長い硬直・操作不能を足さない（DEC-035）
- 影の旅人の型（AD-005・DEC-034）を変えない
- 既存の仕組み（`CLIPS` / `sampleClip` / `applyPose` / ブレンド / swing-timing）を拡張する。skinning・外部アニメーションへ移さない（analysis A-1）
- セーブ・ゲーム進行・戦闘判定を変えない。main へ merge しない

## Current Implementation（FACT。analysis §1）
- キーフレームの角度補間（`CLIPS`、4職 × 約10種）、コンボの締めはスキルの流用、上位職は基礎職 + 係数
- 被弾の体の反応・戦闘不能の倒れる動きなし。切り替えはリグの組み直し
- 歩行は全職共通の式（脚の長さを見ない）、休めの立ち姿が似る

## Work Items（案。各 Work Item で独立 Reviewer の PASS、見た目が変わるものは Human の目視承認）
| ID | Summary | 依存 | 見た目の変化 | Human 判断 |
| --- | --- | --- | --- | --- |
| M-0 | 計測と撮影の土台: クリップごとの姿勢の撮影手順（Visual Freeze を使い、デバッグパネルを写さない）、判定の実時間・攻撃間隔の回帰テスト（既存の E2E の確認と足りない分の追加）| なし | なし | ― |
| M-1 | 待機: 職ごとの休めの立ち姿（剣士 = 安定、魔法使い = 優雅、弓師 = 警戒、盗賊 = 軽快）と控えめな呼吸・重心移動。上位職の差分 | M-0 | あり | V-1 |
| M-2 | 歩行・走行: 歩幅を脚の長さと速度に合わせる（低速の足の滑り）、重心・上半身・腕の連動。入力・速度は変えない | M-0（CHARACTER-VIS-002 の頭身の確定後が望ましい）| あり | V-1 |
| M-3 | 被弾・戦闘不能: 被弾の方向と重さが伝わる短い上半身の反応（入力を止めない）、戦闘不能の短い倒れる動き（結果画面の前）| M-0 | あり | MH-1、V-1 |
| M-4 | 攻撃・コンボ（職ごと）: 予備動作 → 踏み込み → 攻撃 → フォロースルー → 戻り、段の間の繋ぎ。判定の実時間・クリップ長を保つ。剣士 → 盗賊 → 弓師 → 魔法使いの順（1職 = 1段）| M-0、**CHARACTER-VIS-002 の頭身の確定と T-1** | あり | MH-2、V-1 |
| M-5 | スキル: 通常攻撃の締めと分けた専用クリップ（職ごと）| M-4 | あり | MH-2、V-1 |
| M-6 | 回避: 方向（前後左右）で姿勢を変え、回避方向と体の向きを一致させる。時間・無敵は不変 | M-0 | あり | V-1 |
| M-7 | 上位職: 武器の形が違う職（戦騎士の長剣・バーサーカーの両手斧・鷹の目の大弓）の主要な攻撃クリップを専用に。魔導士は姿勢の差分 | M-4・M-5 | あり | MH-3、V-1 |
| M-8 | 統合: 9人（影の旅人は回帰のみ）の同一条件の撮影、全 E2E、iPhone 実機 | M-1〜M-7 | なし | V-1 |

- 実施順（推奨）: M-0 → M-1 → M-3 → M-6 → M-2 → M-4 → M-5 → M-7 → M-8。M-1・M-3・M-6 は頭身に依存しにくく先に進められる。M-2・M-4 は体格（手・脚の長さ）に依存するため、CHARACTER-VIS-002 の頭身の確定（T-1）の後
- CHARACTER-VIS-002 とは交互に1段ずつ進め、同時に実装しない（同じ `05` / `06` を触るため）

## Implementation Plan（概要。各 Work Item の着手時に詳細計画を作り直す）
| WI | 主なファイル | 方法 |
| --- | --- | --- |
| M-1 | `05` `STANCE_RELAXED` / `JOB_RELAXED_STANCE`、`core/relaxed-idle.js` | 角度の値と揺れの係数。新しい仕組みは作らない |
| M-2 | `13` `updateLocomotion` | 歩幅の位相の係数を脚の長さ（BUILD.hipY）と速度から算出、振り角との整合 |
| M-3 | 被ダメの入口（小さな共通関数を1つ足し、各被ダメ箇所から呼ぶ）、`12` `triggerPlayerDown` | 上半身の短い反応（判定・ダメージ・入力は不変）。倒れる動きは結果画面の前に短く |
| M-4 / M-5 | `05` `CLIPS[職]`、`11` `COMBO_CLIP_BY_STAGE` | キーフレームの追加・調整。`dur` と判定の割合を保つ（判定の実時間の回帰テスト）|
| M-6 | `13` `DODGE_MOTION` と回避の姿勢 | 方向別の係数 |
| M-7 | `05` 上位職のクリップ（基礎職のクリップの差し替え表）| 係数ではなく形の差 |

## Test Plan
| 区分 | 内容 |
| --- | --- |
| Unit | 時間の割合・クリップ長の不変（`swing-timing` / `ult-clips` / `combat-stance` / `relaxed-idle` の既存 unit）、新しい表の妥当性 |
| E2E | `character-motion`・`weapon-stow`・`job-traits`・`base-class-identity` / `comparison`・`air-actions`・`execution-*`・`combat-*`・`wanderer-renewal`・`character-visual-budget`（影の旅人の不変）。判定の実時間・攻撃間隔・回避の時間の回帰 |
| 撮影 | Visual Freeze で各クリップの予備動作・命中・フォロースルー・戻りを同じ条件で撮影し、変更前後を並べる |
| Full Regression | 全 E2E（CI）|
| 目視 | Human の V-1（各 Work Item）|
| iPhone | 操作の応答性（攻撃・回避の入力の遅れが無い）、FPS |

## Acceptance Criteria
- 判定の実時間・攻撃間隔・コンボの受付・回避の時間 / 無敵・移動速度に差分なし（unit / E2E）
- 硬直・操作不能の追加なし
- 影の旅人の型とシグネチャに差分なし
- 各 Work Item の Human の V-1 OK、独立 Reviewer の PASS

## Risks
- 判定と見た目の同期のずれ（クリップ長・割合の変更）→ 長さと割合を保つ、回帰テスト
- 体格の変更（CHARACTER-VIS-002 の頭身）で手の届く位置が変わり、攻撃クリップの調整がやり直し → M-4 は頭身の確定後
- 被弾の反応が操作の邪魔になる → 上半身のみ・短く・入力は止めない
- 上位職の専用クリップの保守コスト → 主要な攻撃クリップに限る

## Rollback
各 Work Item は独立した commit 群。クリップ・係数の表の差し替えなので revert で戻せる（セーブ・判定に影響しない）。

## Out of Scope
攻撃判定・ダメージ・コンボの段数・スキルの性能、入力の追加（歩行キー等）、影の旅人の型、敵・ボス・支援AI のモーション、skinning・外部アニメーション

## Escalation（各 Work Item の着手前に必要になる Human 判断。今回はまだ送らない）
| # | 事項 | 推奨案 |
| --- | --- | --- |
| MH-1 | 戦闘不能に倒れる動きを入れると、結果画面までの時間が延びる | 1 秒未満の短い動き |
| MH-2 | コンボの締めをスキルと別の専用クリップにする（docs の「〜の型」の記述との関係）| 締めは専用にし、docs の記述を更新 |
| MH-3 | 上位職の専用クリップの範囲 | 武器の形が違う3職の主要な攻撃クリップのみ |

## Agent Decisions
| # | 決定 | 根拠 | 代替案 |
| --- | --- | --- | --- |
| MD-1 | CHARACTER-VIS-002 と別の独立 Task にする | DEC-035「無理に一つの巨大な Task にまとめない」| CHARACTER-VIS-002 の Work Item にする |
| MD-2 | 既存のキーフレーム方式を拡張し、skinning へ移さない | §3 Existing System First、analysis A-1 | skinning |
| MD-3 | 攻撃クリップ（M-4）は CHARACTER-VIS-002 の頭身の確定後 | analysis A-6（手戻り）| 先に攻撃から |

## Status History
| Date | Target | From → To | By | Note |
| --- | --- | --- | --- | --- |
| 2026-11-24 | Task | — → PLANNED | Analyzer / Planner | DEC-035 の追加要求で起票。調査 `.ai/reports/CHARACTER-MOTION-RENEWAL-analysis.md`。実装は未着手 |
