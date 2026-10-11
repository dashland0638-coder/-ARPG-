# CA-01 Report — 宵待ちの村と道の BGM（手続き生成）

Date: 2026-10-07
Branch: `claude/ca-01-village-road-bgm`（起点 `main` `1ec6d44`）
Result: **DONE**（Reviewer Round 1 PASS）

## 何が起きていたか
`playBgm(key)` は、実音源（`BGM_TRACKS`）が無ければ `startProceduralBgm(ctx, …, key)` で BGM を生成する。
`MOODS` に `duskvillage` / `road` の項目が無かったため、`startProceduralBgm` が `null` を返し、**村と道は無音**だった。

## 変更（`src/audio/procedural-bgm.js`）
| 鍵 | 方向性 | 値 |
| --- | --- | --- |
| `duskvillage` | 夕暮れの湖畔。人のいない村なので不穏にせず、短調の5音でゆっくり薄く。環境音（水音・家鳴り・風）を消さないよう、洋館より小さく、高域を落とし、湖の開けた残響 | root 110 / 短調5音 [0,3,5,7,10] / tempo 0.6 / density 0.14 / sine / cutoff 700 / pad 0.040 / event 0.032 / pluck / reverb 2.4s・0.34 |
| `road` | 第一章で一番明るい朝の街道。長調の5音を、酒場より少し高く柔らかく。屋外なので残響は短い | root 131 / 長調5音 [0,2,4,7,9] / tempo 0.9 / density 0.20 / triangle / cutoff 1800 / pad 0.038 / event 0.038 / reverb 1.4s・0.20 |

既存の項目（酒場・洋館・幽霊船・神殿・時計塔・水路・温室）は変えていない。実音源の経路（`BGM_TRACKS` に登録すればそちらが優先）もそのまま。

## テスト（`tests/unit/procedural-bgm.test.js`、4件）
1. 第一章の5つの舞台（`CHAPTER1_ORDER`）と酒場に項目がある
2. その項目で BGM が実際に組み上がり、止められる（偽の AudioContext で `startProceduralBgm` を実行）。項目の無い鍵は `null`（＝無音）
3. すべての項目の形が正しい（5音・昇順、音量と残響が 0〜1）
4. 村と道は洋館より控えめ。村は短3度を含み高域が低く、道は長調の5音

**変更前のコードでは #1・#2・#4 が失敗する**ことを確認した（変更を外して実行 → 3 fail）。

| 確認 | 結果 |
| --- | --- |
| Build | PASS |
| Unit（全体） | 1651 / 1650 pass / 0 fail / 1 skip（既存） |
| E2E（ローカル、2 CPU）: `audio` / `road` / `chapter1-dusk-basics` | 7 / 7 passed |

## 実機で確認すること（Human。CQ-01 / CV-01 の確認項目に入れる）
- 村: 環境音（水音・家鳴り）が BGM に埋もれないか。夜明けの後も違和感がないか
- 道: 朝の明るさに合っているか。森の環境音とぶつからないか
- 音色の好みは Human の判断（変えるなら値の調整だけで済む）

## Reviewer（Round 1）: PASS
- HD-C2 の範囲（村と道に手続き生成 BGM、実音源は別）に収まっている。
- 既存の mood・実音源の経路・凍結中のシステムに触れていない。
- 変更前に失敗し、変更後に通るテストで、無音が直ったことを確かめている。
