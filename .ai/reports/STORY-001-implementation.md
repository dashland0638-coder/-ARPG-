# STORY-001 — 実装報告

Status: DONE（Agent 側）／ HUMAN DEVICE CHECK REQUIRED（iPhone 実機は未確認）
調査・計画: `STORY-001-analysis.md`

## 1. 変更

| 場所 | 内容 |
| --- | --- |
| `14-dungeon-ghostship.js` `gsRegisterEvents` | `playArcherInsight`: カメラで食堂の卓を見せる → 会話 → `grantChapter1Skill2()`（習得 = 自動装備）→ 弓師の一言。出撃ごとに一度（`gsFlags.insightDone`）。既に持っていれば場面を出さない |
| 同上 | `ev.insight`: 往路・食堂の場面の後・食堂を片付けた後に、食堂の中で起きる |
| 同上 | `ev.insightFallback`: 往路で、まだ閃いていない時に、通路（船長室の手前）で起きる |
| 同上 | `ev.home`（既存の「帰る場所」の会話）: 条件に「閃きが済んだ（または飛ばした）」を足した。台詞は変えていない |

習得・ボタン・保存・交代は既存のまま（`learnSkill2` / `grantChapter1Skill2` / `learnedSkill2` の保存と復元 / 交代で false）。弓師の Skill 2「爆弾投げ」の定義・数値も変えていない。

## 2. 発生条件

| 場面 | 条件 |
| --- | --- |
| 閃き（食堂） | 往路（`phase === 'pre'`）・食堂の場面（十五人分の皿）が済んだ・食堂の残影を倒した・まだ起きていない |
| 閃き（通路） | 往路・まだ起きていない（食堂を戦わずに抜けた時。船長室へは必ず通路を通る） |
| 起きない | 帰還不能の後 / 同じ出撃で二度目 / 既に Skill 2 を持っている（閃いてから酒場へ戻って出直した・テストモード） |

## 3. 文書

`docs/CHAPTER1_STORY.md` §4-2（往路の食堂）、`docs/SCENARIOS.md`（各段の閃きの一覧。時計塔・道は未実装と明記）、`docs/COMBAT.md`（Skill 2 の表を現行に直し、閃く場所の列を足した）、`docs/CHAPTER1_PLAYTEST.md`（C-04 を更新、C-18 を追加）。

## 4. 性能

追加は出来事 2 つと会話だけ（新しいメッシュ・光源・毎フレームの処理は無い）。
