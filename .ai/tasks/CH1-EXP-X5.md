# CH1-EXP-X5 — シナリオクリア後の帰還と主人公交代

親 Task: `.ai/tasks/CH1-EXP.md` の Work Item X-5（正本は親の Work Items 表。親は PR #75）。
計画: `.ai/reports/CHAPTER-1-experience-plan.md` §2 X-5（PR #75）。Human Decision: DEC-006 の EX-1 = A・(2)（PR #75）。

Status: REVIEWING

## 流れ（クリアして前へ進む交代 3 か所）
1. 暗転が明けた時点では、帰ってきた主人公のまま（交代は予約だけ）。
2. 帰還の会話:
   - 洋館の後: 鍛冶士との再会（既存の `playSmithGreeting` を復活。剣士が鍛冶屋の前まで歩いて話す）。
   - 村の後: 主人と魔法使いの 2 行（DEC-006 で採用）。
   - 幽霊船の後: 主人と弓師の 2 行（同）。
3. 次の主人公の姿（`buildCastFigure`）が、カウンターの脇から帰ってきた主人公の前まで歩み寄る。
4. 交代の会話（既存の `CHAPTER1_JOIN_LINES`）。
   - 盗賊の前の主人の 1 行だけ、帰還の会話を受ける形に直した: 「その塔なら、鐘が毎晩同じ時刻で止まるらしい。」
5. 会話を閉じると、短い暗転の間に切り替える。
   - 次の主人公: 歩み寄った姿の位置に、操作キャラクターとして立つ。
   - 前の主人公: 支援 AI として、さっきまで立っていた位置に残る。
   - 支援から外れた元主人公: 卓B のそばに立つ（EX-1 の (2)）。
     - 村の後は剣士。幽霊船の後は剣士と魔法使い。
     - 道を終えた後は、既存の `buildChapter1TavernTrace` が隅の卓に 3 人を立たせるので出さない。
   - その後でセーブする。

**変えていないもの**

- 交代の順番と時期。加入の条件。
- 道の途中の交代（影の旅人）と、第一章の終わりの会話。
- 全滅・撤退で戻ったとき: 今までどおり、その場で戻すだけ。一幕は無い。
- 「つづきから」（`rebuild:false`）: 今までどおり、一幕を出さずに交代が済む。
- セーブの項目: 増やしていない。進行は `scenarioClears` から導く。
  - 一幕の途中でアプリが閉じられても、次に入れば交代は済んでいて、一幕だけが出ない（今までと同じ）。
- メニューからの自由な切り替え: 作っていない。テストモード: 何も起きない（`advanceChapter1Cast` が先に返る）。

## Implementation
- `src/legacy/parts/14-hud-boot.js`
  - `advanceChapter1Cast`: クリアして前へ進む交代（`rebuild && forward && announce`）は、`queueChapter1JoinScene(prev, next, cast)` で予約して返す。
  - `updatePendingJoinScene`: 洋館の後は、鍛冶士との再会が済むまで待つ（`blocked`）。
  - 一幕の本体（新規）:
    - `playChapter1ReturnScene`
    - `onChapter1ReturnTalkClosed`
    - `playChapter1Arrival`
    - `updateChapter1JoinFigure`
    - `openChapter1JoinTalk`
    - `onChapter1JoinTalkClosed`
    - `finishChapter1Switch`
    - `switchNow`
  - 元主人公の姿（新規）: `refreshRetiredCastFigures`。卓B の椅子を避けた 3 か所に立たせる。
  - `CHAPTER1_RETURN_LINES`（新規 4 行）。
  - 毎フレームの呼び出し: 操作中と演出中の両方から `updateChapter1JoinFigure(dt)`。
- `src/legacy/parts/12-progression-ui.js`: 会話を閉じたときの処理。
  - `chapter1Return` → `onChapter1ReturnTalkClosed()`
  - `chapter1Join` → `onChapter1JoinTalkClosed()`
- `src/legacy/parts/03-dungeons-mansion-temple.js`: `buildTavern` の中で `refreshRetiredCastFigures(true)` を呼ぶ。
- `src/core/chapter1-rules.js`
  - `retiredCastKeys(protagonist, guest, cast, roadCleared)` を追加した。
  - `joinSceneReady` の `ctx.blocked` を追加した。
- `src/legacy/concat-plugin.js`: import を追加した。
- docs:
  - `docs/CHAPTER1_STORY.md` §4-1・§4-3: 帰還の会話と主人の 1 行。
  - `docs/SCENARIOS.md`: 交代の流れ。
  - `docs/CHAPTER1_PLAYTEST.md`: A-04〜A-06。

## Test
| 確認 | 結果 |
| --- | --- |
| `tests/unit/chapter1-mansion-to-village.test.js`（11 件。下記） | PASS |
| `npm run test:unit` | 1787 PASS / 0 FAIL / 1 SKIP |
| `npm run build` | PASS |
| 関連 E2E（ローカル） | 下記 |

`chapter1-mansion-to-village.test.js` で確かめていること:

- 暗転中は剣士のまま予約だけ。
- 暗転が明けて 3 フレームで開く。
- 洋館の後は再会が済むまで待つ。
- 魔法使いが歩み寄って剣士が受け、閉じてから持ち替える。
- 村の後・幽霊船の後の帰還の 2 行と、主人の 1 行。
- 元主人公の姿は前の段の人だけで、道の後は出さない。
- 全滅では何も起きない。
- セーブから入り直すときは今までどおり、その場で交代する。

置き換えたテスト（弱めていない）:

- 旧「交代: 剣士 → 魔法使い。一幕はすぐには開かず、順番待ちに入る」は、交代が会話の前に済むことを確かめていた。
- Human の決定（会話の後で切り替える）と矛盾するので、「会話の前は剣士のまま・閉じてから持ち替える」に置き換えた。
- 他の確認（暗転中に開かない、全滅で出さない、加入の台詞の話者）は残した。

**E2E で通せない範囲**

- ボスを倒して酒場へ戻る経路は、この環境の E2E では作れない（古い監査の E-8、開発用の入口は未決）。
- 一幕そのものは unit（実物のソースを stub で動かす）と実機で確かめる。

## 実機確認（Human）
- 洋館・村・幽霊船のそれぞれの後で、`docs/CHAPTER1_PLAYTEST.md` A-04〜A-06 の流れになること。
  - 暗転明けは帰ってきた主人公。
  - 再会または帰還の会話。
  - 歩み寄り。
  - 交代の会話。
  - 会話の後で切り替わる。
- 卓B のそばの元主人公の位置・向きが不自然でないこと。歩み寄る人と重ならないこと。
- 一幕の途中でアプリを閉じて「つづきから」入ると、次の主人公で始まること。
