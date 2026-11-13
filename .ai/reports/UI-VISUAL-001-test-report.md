# UI-VISUAL-001 — 試験報告（Tester）

| 種類 | 結果 |
| --- | --- |
| Build | `npx vite build` / `npm run build` 成功 |
| Unit | `node --test` 2235 pass / 0 fail（既存の SVG カタログの skip 1 件は checkout に catalog が無いためで無関係） |
| Protocol | `.ai/tasks/UI-VISUAL-001.md`、`.ai/reports/UI-VISUAL-001-{analysis,test-report,review}.md`、DEC-022 |
| E2E（新規） | `tests/notice-layout.spec.js`: iPhone 844×390 タッチ / 1280×800 PC / 844×390 PC / タブレット 1180×820 タッチ の 4 サイズ。優先度（危険が押し出されない・一番上）、同じ通知のまとめ（×n）、中央の視認領域（横 25〜75%・縦 30〜80%）を覆わない、HUD・操作ボタン・コンボ表示・ボスバーに重ならない、ボス戦は背の低い画面で 1 件、長い入力の理由、記録タブ、DOM への追加が一度だけ |
| E2E（回帰） | notice-layout / dialog-result-layout / notifications / combat-events-layout / menu-character-layout / action-zone / air-actions / chapter1-dusk-basics / character-weapon-visual / combat-center-messages / dev-ui-gate / dusk-boss-phase-burst / mansion-scenario / combat-test-arena / ghostship-chapter1 / dusk-fisher-telegraph / ui-proto-gate / tavern-smith-greeting: 87 passed。production-build 6 件は手元で preview サーバー（4173）を起動していなかったための接続拒否で、起動して 6 passed。レビュー Round 3 の後の修正後に notice-layout / combat-events-layout / dialog-result-layout 25 passed |
| CI | `1adfba2` で dusk-boss-phase-burst が失敗（上の帯の並べ替えで要素を付け直し、同じ通知が二度「出た」と数えられた）→ `9272a49` で flex の order に変更して修正。以降の CI は失敗なし |

assertion を弱めた変更は無い。変えた assertion:
- `dialog-result-layout.spec.js`: 「同じ通知を 5 件 → 3 件積む」を「1 件にまとまり ×5」へ（依頼 §6 の集約）。積み方・ゾーンの確認は `notice-layout.spec.js` へ移し、4 サイズ・中央・操作ボタンまで広げた。アニメーション名 `toastLife` → `noticeBottomLife`（1.7 秒の寿命の確認はそのまま）
- `notification-channels.test.js`: spawnToast の本体に `item-pop` があること → 3 つの表示先へ振り分け、どれも `.item-pop.is-toast` を作り、ログへ積まないこと

## 改修前後（844×390・タッチ、同じ 5 件の通知 + ログ 4 件を同時に）
- 改修前: 危険「守護神像が腕を引いた」と出現「背後に気配」が、後から来た弱い通知（スタミナ・ジャストドッジ・閃いた）に押し出されて消えた。残った 3 件は画面の中央上（制限時間と重なる）
- 改修後: 危険が一番上・出現が次（上の帯、制限時間の下）。閃いたは押し出されて記録へ。ジャストドッジは頭の上に小さく、スタミナは操作ボタンのそば。中央は空いている

## iPhone 実機（未確認 — Human）
- 横持ちでの上の帯の読みやすさ（13〜14px）と、セーフエリア（ノッチ側）
- ボス戦で上の帯が 1 件・1 行になること（長い文は「…」、全文はメニューの記録）
- 入力の理由が指で隠れないか（必殺技ボタンの左）
- 頭の上の行動の結果が見えるか（1.1 秒）
