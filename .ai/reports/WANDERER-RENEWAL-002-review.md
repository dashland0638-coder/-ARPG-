# WANDERER-RENEWAL-002 Review

## Round 1/3

## Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | WANDERER-RENEWAL-002 |
| Branch | `claude/wanderer-renewal-001-nhlxns` |
| Reviewed SHA | `680a043eca5e666aaebe05ec6aabc6e57e806273` |
| Diff range | `8860d024acc2420e2b1582f9f919f315efdb961e..680a043eca5e666aaebe05ec6aabc6e57e806273` |
| Handoff Verification | V-1 OK（remote branch の HEAD = Implementation SHA）/ V-2 OK（Task file 到達可）/ V-2a OK（Plan Source `8860d02` → Implementation SHA の Task file 差分は `Status:` 行・Status History 1 行追加・Implementation Result 節だけ）/ V-3 OK / V-4 OK / V-4a OK（`git rev-parse 680a043:.ai/reports/WANDERER-RENEWAL-002-analysis.md` = `0f159b46a7fd1104afd512d47a49f6a4f3ceadbd`）/ V-4b OK（`9cb8f54` は branch から到達可）/ V-5 OK（Test Report・Changed Files あり）/ V-6 OK（差分 23 files、終点 = Implementation SHA） |
| Analysis Source | `.ai/reports/WANDERER-RENEWAL-002-analysis.md`（`claude/wanderer-renewal-001-nhlxns` @ `9cb8f545b95c3ef221271ebb748955d257f4fec4`、blob `0f159b46a7fd1104afd512d47a49f6a4f3ceadbd`） |
| Plan Source | `.ai/tasks/WANDERER-RENEWAL-002.md`（`claude/wanderer-renewal-001-nhlxns` @ `8860d024acc2420e2b1582f9f919f315efdb961e`、blob `1050fe013dc47e9d93377f60e0e224ea3c4281dd`） |

## Result
CHANGES_REQUIRED

## Independence
別 Agent・別セッション（separate-context subagent。Implementer の判断過程は入力にしていない）

## Checklist
| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | FAIL（1 件） | 武器なし（空の枠 `buildWandererEmptyWeapon`、`trail:false` は 13-update-loop.js:987 で効く）、人間の手の造形（手のひら・4 指 3 節・尖った円錐の指先・外へ開く親指）、不透明の黒紫 core + `makeOutlineMat` の #8A5AD6 輪郭、3 段 突き上げ / 薙ぎ払い / 握砕、Skill 1/2・必殺技・回避の手、フード外套の共有部品、配色、Material 分離は DEC-034 と Plan どおり。**ただし影の手の大きさが Plan の Agent Decision WR2-2 と一致しない**（Required Changes #1） |
| 2 | Scope compliance | PASS | 変更ファイルは Files To Change の範囲（`concat-plugin.js` の import 追加と DEC-034 / AGENT-DECISIONS の記録は付随）。`basefile.html`・セーブ・他職の行は未変更 |
| 3 | Regression | PASS | `swingOnce` の早期 return は `isWandererStyle() && !state.usingAltWeapon` のときだけ。回避攻撃・切り上げ・`executeVariant` single の分岐も `isWandererStyle()`（13 は `variant.echo &&` も）でだけ影の手に替わり、他職は `spawnMeleeSwingVFX` のまま。`rigKeyOf` は差分なし。06 の剣士系衣服は `if(!isWanderer){…}` 内で旧と同じ部品（ゲイター・背中のフード・パーカー・ポケット） |
| 4 | Build | PASS | `npm run build` 成功（再実行） |
| 5 | Unit tests | PASS | `npm run test:unit` 2332 件中 2331 pass / 0 fail / 1 skip（再実行） |
| 6 | E2E tests | 未再実行（指示により） | Implementer の Test Report では対象 80 件 + 再実行 7 件 PASS |
| 7 | Save/Load integrity | PASS | セーブ項目・形式の変更なし（差分に 09-save-load / state 永続化の変更なし） |
| 8 | Existing behavior | PASS（Risk あり） | Skill の数値は不変: `WANDERER_SKILL1`（baseMult 1.2 / maxMult 2.4 / dist 2.8 / duration 0.24）・`WANDERER_SKILL2`（cd 9 / mult 1.0 / length 6.5 / width 1.8 / passStaggerMul 1.2）・`WANDERER_ECHO.skill1/skill2` は desc 以外差分なし。`finish` は arc → circle 半径 1.6（dmgMul 0.6 等は不変）で Plan WR2-1 どおり。isFinish・`onFinishHit`/`onFinishHit2`（最初の命中対象）・`checkMimicRevealInRange` は手が当たる瞬間に解決（`resolveWandererEntry`） |
| 9 | Code duplication | PASS | フード外套は `buildWandererHoodParts` 1 か所を加入前（14-dungeon-road）・加入後（06）で共有。旧来の加入前フード・マフラーのコードは削除 |
| 10 | Unnecessary architecture changes | PASS | 新しい描画・物理システムなし。ジオメトリ / Material 共有のプール（最大 8）と既存の待ち行列（`pushEcho`/`stepEchoes`）の流用 |

## 確認した論点（問題なし）
- **TDZ / 評価順**: 起動時（14-hud-boot の `buildWorld → disposeWorld`）から呼ばれる `clearWandererEchoes` → `hideShadowHands` → `releaseShadowHand` が触るのは `var wandererEchoes` / `var shadowHands` と関数宣言だけ。`const SHADOW_HAND_MAX`・`let shadowHandGeo`・`wEaseOut` 等は `spawnShadowHand` 以降（17 の評価後）でしか使われない。`clearWandererEchoes` は未定義の `wandererEchoes` を `[]` にし、17 の `var wandererEchoes = wandererEchoes || []` がそれを保持する。加入前の姿（`buildRoadTravelerFigure`）が起動時に呼ぶ `buildWandererHoodParts` は 17 の let/const を参照しない。`hexStr`（06）・`PLAYER_FINISH`/`resolvePalette`（import）は 14-dungeon-road より前に定義済み
- **会話・遷移での取り消し**: 14-hud-boot.js:1409（会話中は毎フレーム）、02-world-common.js:406（disposeWorld）、14-hud-boot.js:2308（運搬）、`updateWandererEchoes` の `!state.started || dialogueActive || !isWandererStyle() || cutsceneRunning()`。`clearWandererEchoes` は待ち行列と全ての手を落とす。空なら早期 return（毎フレーム呼んでも何もしない）
- **プールの再利用**: `spawnShadowHand` が root 位置・yaw・arm 位置・lean 回転・wrist の拡大/位置・円の拡大をすべて初期化するので、前の mode（crawl の root 移動、sweep の `lean.rotation.y`、grab の非一様 scale）は持ち越さない。追撃（`keepHand:true`）は押し出されても手を解放しない。通常攻撃の一撃（`keepHand:false`）が押し出されるのは予定時刻前 = 手がまだ自分のもの（rise/sweep/grab の `done` は hitT + 0.40 以降）
- **3 段目**: 一撃（0.18 秒、isFinish、半径 1.6）と握砕の追撃（0.45 秒、0.6 倍、同じ手を `crushT = WANDERER_ECHO_LAG` で閉じる）。手の握る時刻と追撃の判定時刻が一致
- **trackPreJoinShadow**: `g.userData.pool` は維持（14-dungeon-road.js:131）、road-stranger の unit が引き続き検査
- **配色**: `player-palette.js` の差分は wanderer の行とそのコメントだけ（#654F86 / #3D3846 / #8E70B8 / #46404F / #3B3B41）
- **docs**: COMBAT.md の影渡りの行、CHARACTERS.md の戦い方・外見・配色・武器の記述は実装と一致（大きさの数値も実際の形に近い。ただし #1 の通り Plan / コードのコメントと食い違う）

## Changed Files
`.ai/decisions/AGENT-DECISIONS.md`、`.ai/decisions/DEC-034-wanderer-shadow-hands.md`（新規）、`.ai/reports/img/WANDERER-RENEWAL-002/*.jpg`（5）、`.ai/tasks/WANDERER-RENEWAL-002.md`、`docs/CHARACTERS.md`、`docs/COMBAT.md`、`src/core/wanderer-style.js`、`src/legacy/concat-plugin.js`、`src/legacy/parts/06-player-enemy.js`、`10-input.js`、`11-combat-actions.js`、`13-update-loop.js`、`14-dungeon-road.js`、`17-wanderer-style.js`、`src/render/player-palette.js`、`tests/unit/player-palette.test.js`、`tests/unit/road-stranger.test.js`、`tests/unit/wanderer-style.test.js`、`tests/wanderer-renewal.spec.js`

## Out of Scope Changes
None（`concat-plugin.js` の import 追加は新しい core の export を legacy へ渡すための付随変更）

## Risks
（いずれも今回の CHANGES_REQUIRED の理由ではない。任意で対応）
1. **待ち行列の上限の共有**: 通常攻撃の一撃と影渡りの通過（以前は即時判定）も `WANDERER_ECHO_MAX = 3` の同じ行列に入るようになった。`castSkill2` / 通常攻撃は `state.swinging` 中に受け付けないので通常のプレイでは溢れにくいが、溢れた場合は一番古い項目（追撃や未解決の一撃）が無言で消える。一撃は別の行列（または上限の対象外）にすると安全
2. **プールの横取り**: 8 本すべてが使用中のとき `takeShadowHand` は一番古い手を横取りする（17-wanderer-style.js:225）。その手を参照する未解決の一撃が後で押し出されると、`releaseShadowHand(d.hand)` が新しい持ち主の手を消す。必殺技 5 本 + 3 段目 + 影渡りなどで起こり得るが見た目だけ
3. **サブ武器（`legacyGrowth` のみ）**: `state.usingAltWeapon` のときは従来の剣の経路（`spawnMeleeSwingVFX` の紫の弧・即時判定）に落ちる（11-combat-actions.js:741）。武器の枠は空なので「武器なしで斬撃の弧が出る」。本編では到達しない（WANDERER-RENEWAL-001 からの既存の条件）
4. **足元の影の足跡**: 運搬・遷移の後、`wandererFoot.trail` に前の場所の位置が最大 0.45 秒残り、影が一瞬前の場所に出る（`clearWandererEchoes` で trail を空にすると防げる）
5. 加入前の姿のフードの影の面（14-dungeon-road.js の `add` 経由）は `castShadow = true` のまま（加入後の 06 は false + `noOutline`）。半透明の黒い面が床に影を落とす可能性
6. 一撃ごとに `sfx('slashLight')` が手の当たる瞬間に鳴り、入力時の `MOVE_SFX` と二重になる（当たらなくても鳴る）

## Required Changes
| # | ファイル / 箇所 | 問題（根拠: AC / docs / Decision / テスト） | 期待する状態 | 確認方法 |
| --- | --- | --- | --- | --- |
| 1 | `src/core/wanderer-style.js:146-156`（`WANDERER_STRIKE.*.scale` / `WANDERER_HAND_SCALE`、コメント 153 行「手の全長 + 地面から出る手首 ≒ 倍率 × 1.6 m」）、`.ai/tasks/WANDERER-RENEWAL-002.md` Implementation Result | 影の手の実際の大きさが、承認済み Plan の Agent Decision **WR2-2「通常 約 1.4〜1.6 倍・強い 約 2 倍・必殺技 2.2 倍（身長 2.54 基準）」**と一致しない。`SHADOW_HAND_SHAPE` の手首〜中指の先は 0.42 + 0.20 + 0.16 + 0.30 ≒ **1.08 / 倍率**で、手首から下の腕（`arm`）は出きった時も床の下（`wrist.position.y = -1.25·s·(1-rise)`、rise ≦ 1.06）。よって 通常 2.4 → 約 2.6 m ≒ **1.0 倍**、握砕 3.0 → 約 3.2 m ≒ **1.25 倍**、必殺技 3.6×0.92〜1.1 → 約 3.6〜4.3 m ≒ **1.4〜1.7 倍**（撮影 4-shadow-hands.jpg でも手は主人公とほぼ同じ高さ）。コード上のコメント「≒ 倍率 × 1.6 m」（これだと WR2-2 の値になる）は事実と違い、docs/CHARACTERS.md:138 の「約 1〜1.5 倍…」とも食い違う。Task の Notes「目安（1.5〜3 倍）より控えめ（WR2-2…）」も WR2-2 の記載と合わない。DEC-034 の目安（通常 1.5〜2 倍・強い 2〜3 倍）からも、WR2-2 で決めた幅からも下に外れている | 次のどちらか: **(a) 推奨**: 倍率を WR2-2 に合わせる（例: 手首〜中指 ≒ 1.08 として 通常 ≒ 3.4〜3.8、握砕 ≒ 4.7、必殺技 ≒ 5.2 前後。見下ろしカメラで主人公を隠さないよう斜めに出す WR2-2 の後半はそのまま）、コメントを実際の計算に直し、docs/CHARACTERS.md の倍率表記を実値に更新。**(b)**: 小さくする判断を残すなら、Implementation Result に WR2-2 からの逸脱（実値と理由）を明記し、core のコメントを実際の計算（≒ 倍率 × 1.08 m）に直し、Notes の「1.5〜3 倍」の記述と docs の数値を一致させる。どちらでも DEC-034 の「固定値にせずカメラに合わせて調整」の範囲内として扱える | `WANDERER_HAND_SCALE` / `WANDERER_STRIKE.scale` × 1.08 ÷ 2.54 が、Plan（または Implementation Result に記録した逸脱）・コードのコメント・docs/CHARACTERS.md の記載と一致すること。(a) の場合は 844×390 の撮影で主人公と攻撃対象が隠れないことを確認。`npm run test:unit` が通ること（unit で倍率を検査していれば期待値も更新） |

Task の Status 更新（`CHANGES_REQUIRED`）は、Orchestrator の指示（このレビューではレポート以外を変更しない）に従い、このコミットでは行っていない。Orchestrator が反映する。

## Round 2/3

### Review Target
| 項目 | 値 |
| --- | --- |
| Reviewed SHA | `7542fcaf2d7dc85efc33dd70bd67ca31101084a1` |
| Diff range | fix: `591370292c171a56713808e7c734489b5a46787b..7542fcaf2d7dc85efc33dd70bd67ca31101084a1`（full: `8860d024acc2420e2b1582f9f919f315efdb961e..7542fcaf2d7dc85efc33dd70bd67ca31101084a1`） |
| Handoff Verification | V-1 OK（remote HEAD = `7542fca`）/ V-2 OK / V-2a OK（Plan Source → `7542fca` の Task file 差分は `Status:` 行・Status History・Implementation Result（`### Round 1 Fix` を含む）の追加だけ）/ V-3 OK / V-4 OK / V-4a OK（blob `0f159b46a7fd1104afd512d47a49f6a4f3ceadbd` 一致）/ V-4b OK / V-5 OK / V-6 OK（fix 6 files、終点 = Implementation SHA） |

### Result
PASS

### Independence
別 Agent・別セッション（separate-context subagent）。Round 1 の指摘を前提にせず、Handoff から検証し直した

### Required Change #1 の確認
- 実装は案 (a)。`WANDERER_STRIKE` basic/basic2 3.4・basic3 4.7、`WANDERER_HAND_SCALE` basic 3.4 / grab 4.7 / skill1 4.7 / skill2 3.6 / ult 5.2 / small 2.4（dodge 1.0 のまま）
- 手首から先 ≒ 倍率 × 1.08 m で計算し直すと、通常 3.67 m ≒ 身長 2.54 の 1.45 倍、握砕・影残し 5.08 m ≒ 2.0 倍、必殺技 5.62 m ≒ 2.2 倍（左右の手 ×0.92 / 中央 ×1.1 で 2.0〜2.4 倍）。WR2-2（1.4〜1.6 / 2 / 2.2）と一致
- core のコメント（`src/core/wanderer-style.js:151-154`、「≒ 倍率 × 1.08 m」）と docs/CHARACTERS.md:138-139（通常 約 1.4・強い一撃 約 2・必殺技 約 2.2 倍 × 5 本）は実際の値と一致
- 差し替えた撮影 `5-combat-844x390.jpg`: 3 段・Skill 1/2・必殺技のどれでも主人公と対象（標的）が見えている
- **Resolved**

### 非ブロッキング対応の確認（回帰なし）
- R2: `spawnShadowHand` で `h.gen` を進め、`pushWandererQueue` が一撃に `handGen` を記録、押し出し時は `releaseShadowHandFor`（世代が一致する時だけ解放）。追撃は従来どおり `keepHand` で解放しない。横取りされた手を前の持ち主の予定が消す問題は解消
- R4: `updateWandererFoot` で直前の足取りから 4 m を超える飛びがあれば trail を捨てる。通常の移動・回避の 1 フレームの移動量は 4 m に届かないので、0.45 秒の遅れは維持
- R5: `buildWandererHoodParts` の影の帯に `castShadow = false` / `noOutline`（14 の `add`・06 の `add` とも Mesh を返す）
- R1・R3・R6 は Risks のまま（Round 1 の記載どおり、ブロッキングではない）
- 新たな TDZ: 追加は関数宣言（`releaseShadowHandFor`）と手のプロパティだけで、起動時の経路は変わらない

### Checklist（Round 2）
| # | 項目 | 結果 | 根拠 |
| --- | --- | --- | --- |
| 1 | Specification compliance | PASS | 上の確認。WR2-2 と一致 |
| 2 | Scope compliance | PASS | fix は core の倍率とコメント・17 の 3 か所・docs・撮影・Task だけ |
| 3 | Regression | PASS | 他職の経路・判定の形・時刻・Skill の数値に変更なし（倍率は見た目だけ。判定の半径 1.5 / 1.6 / 2.4 等は不変） |
| 4 | Build | PASS | `npm run build` 再実行で成功 |
| 5 | Unit tests | PASS | `npm run test:unit` 2331 pass / 0 fail（1 skip） |
| 6 | E2E tests | 未再実行（指示により） | Implementer: wanderer-renewal / road2-join 5 PASS |
| 7 | Save/Load integrity | PASS | 変更なし |
| 8 | Existing behavior | PASS | 同上 |
| 9 | Code duplication | PASS | 新しい重複なし |
| 10 | Unnecessary architecture changes | PASS | なし |

### Required Changes
None
