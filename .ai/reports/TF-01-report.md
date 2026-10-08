# TF-01 Report — rogue Back Attack E2E の不安定の解消

| 項目 | 内容 |
| --- | --- |
| Work Item ID | TF-01(HE-TF-01 = a) |
| 原因 | Arena の Dummy(passive・速さ 0)が徘徊 AI で 2〜4.5 秒ごとにランダムな点へ向き直っていた。(1) テストが狙った向きを見つけても、近づく 1.3 秒の間に向きが変わる。(2) 出し直し 1 回にパネルの開閉を含む 7 クリック(software rendering で 1 クリック約1.6秒)かかり、180 秒で 12 回前後しか試せず、21% の当たりが続けて外れると時間切れ(約6%) |
| 変更 | `07-ai-combat.js`: Arena の `Dummy` だけ、出した時にランダムな向きを取り(これまでの最初の向き直りと同じ分布)、その後は向きを変えない(`arenaFixedFacing`)。`tests/base-class-identity.spec.js`: 出し直しの間 Arena パネルを開いたまま(1 回 3 クリック)。使わなくなった `clearArena` を削除 |
| 変えていないもの | 戦闘・Back Attack の判定・数値・凍結対象・他のテストモードの敵(訓練場に置かれた3体のカカシを含む)。アサーション・許容幅・タイムアウト |

## テスト
- Back Attack 2件 × 5回 を2回: **20/20 pass**(1件あたり 20〜70 秒。以前は 180 秒の時間切れが出ていた)
- Arena の Dummy を使う spec 一式(auto-combo / base-class-comparison / base-class-identity / character-motion / combat-events-layout / combat-test-arena / execution-break / job-traits / notifications): **51 passed**
- `npm run test:unit`: 全件 pass

## 経緯
- 試行1(パネルを開いたままにするだけ): 出した直後は徘徊 AI がまだ向きを決めておらず、正面のケースが 5/5 失敗 → 不採用
- 試行2(出し直さず、向き直りを待つ): 接近中の向き直りで 4/10 失敗 → 不採用。原因の特定までを HE-TF-01 として Human に上げた

## Reviewer
- PASS(Round 1)。変更は Arena の Dummy の1か所とテストの補助関数だけ
