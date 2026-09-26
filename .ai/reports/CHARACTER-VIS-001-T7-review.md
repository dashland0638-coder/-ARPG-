# CHARACTER-VIS-001 / T-7 Review

## 1. Review Target
| 項目 | 値 |
| --- | --- |
| Task ID | CHARACTER-VIS-001 / T-7（武器・装飾の Material と輪郭線の一貫性。Planner Candidate B） |
| Branch | `claude/character-vis-001-t7-impl` |
| Reviewed SHA | `e1af174985bea6b7283e55f74b7261289c121cd1`（REVIEWING への移行 commit。remote 先端と一致） |
| Baseline | `main` `7bce8db4fd32618d439119bde907408359ce3b2f`（HEAD の祖先） |
| Diff range | `7bce8db..e1af174`（15 commits。コード: `170de03` C1 / `07e1895` C2・C3 / `78b6b24` C4 / `91ed72f` C5 / `f8bcdb6` C6 / `2fd5760` S-7。他は Task file・reports・docs） |
| Approved Task Blob | `b8234f69aed12844bec979d3562ec6c4ffff1a7b`（`4533c18` の Task file の blob と一致を確認。Planner commit `e0375fe`） |
| Plan / Analysis | `.ai/reports/CHARACTER-VIS-001-T6-plan.md`（Candidate B）/ `.ai/reports/CHARACTER-VIS-001-T6-analysis.md` |
| Date | 2026-09-26 |
| Independence | **同一セッションで兼務**（Implementer と同じ Claude Code セッション）。判定は Reviewed SHA の diff・ソース・Reviewer 自身のテスト再実行を根拠とし、source / tests / docs / Task file は変更していない（R-1） |

## 2. Verdict
**PASS**（Findings: 修正必須 0件。Record-only notes 10件）

## 3. S-1〜S-7
| # | 判定 | 根拠（Reviewed SHA のコード） |
| --- | --- | --- |
| S-1 武器装飾 = palette trim | PASS | `buildWeaponMesh()`: `weaponTrimHex = resolvePalette(paletteKeyFor(classDef.key, state.job, classDef.charKey)).trim`、`goldTrim` はこの色。固定 `0xc9a227` の Material は無い。**基礎職**（`state.job` 無し → 基礎職の行）、**上位職**（`state.job` → 上位職の行。生成時 = `buildPlayer` 時点で `state.job` 設定済み、転身の瞬間 = `12:1966-1967` で `state.job` を書いた後に `swapPlayerWeaponVisual`）、**持ち替え**（`swapPlayerWeaponVisual` も同じ `buildWeaponMesh`）で同じ規則。`01`（CLASSES）の差分なし |
| S-2 `WEAPON_FINISH` | PASS | `src/render/player-palette.js` に別 export（steel 0.50/0.50、darkSteel 0.55/0.45、trim 0.55/0.35、wood 1.0/0、gem 0.2/0.1/発光 0.30）。`buildWeaponMesh` の steel / darkSteel / woodMat / goldTrim / ジェムが参照。`PLAYER_PALETTE` / `PLAYER_FINISH` の差分は 0 行（削除行なし）。承認の初期候補範囲内 |
| S-3 持ち替え武器・オフハンド | PASS | `swapPlayerWeaponVisual()` の末尾で `addPartOutlines([weapon, P.offhandWeapon], auraRoot ? inAura : null)`。`addPartOutlines` は既存の `addOutline(r, {always:true, filter})` と `addXrayShell(r, {filter})` を呼ぶだけ。拡大（`scale 1.32`）は後から掛かるが、シェルは子なので追従 |
| S-4 上位職の装飾 | PASS | `applyJobPromotionVisual()` 末尾で `addPartOutlines(meshes)`。`meshes` に入るのはすべてこの関数内で新規に作ったメッシュ（既存の本体メッシュを push していない＝二重付与なし）。関数内の `return` は冒頭のガード2つと内側のコールバックのみで、末尾まで到達する。**対象外**: 魔導士の結晶（`c.userData.noOutline`）、魔法陣（`circle`）、バーサーカーのオーラ（`auraRing`）、特殊武器のオーラ（持ち替え時は `inAura` で skip）。攻撃 VFX・投射物・足元リングは `jobDecorMeshes` / 武器に含まれず対象外 |
| S-5 破棄 | PASS | `disposePlayerPartTree()`: `userData.isOutline` / `isXray` のメッシュは skip（geometry は元メッシュと共有、Material は `outlineMats()` / `xrayMat()` の単一インスタンス）、`P.roleMats` の Material は dispose しない。`swapPlayerWeaponVisual`（旧武器・オフハンド）と `clearJobPromotionVisual` で使用。両関数に `c.material.dispose()` の直接呼び出しは残っていない。武器の Material は武器ごとに新規（本体の role Material と共有しない） |
| S-6 生成規則の統一 | PASS | `buildWeaponMesh(weaponKey, classDef, bodyR, bodyH, HIP_Y, specialId)`（引数 `trimMat` 削除）。呼び出しは `buildPlayer` と `swapPlayerWeaponVisual` の2箇所で同じ形。`swapPlayerWeaponVisual` の単色 trim の生成（旧 T-5 P-D9 の実装）は削除。槍・刀・魔法の剣・ボウガンの装飾も武器専用 trim |
| S-7 指の位置（Human Decision、V-1b 後に追加） | PASS（記録付き） | `2fd5760`: 指3本の x を `[-0.6, 0, 0.6] × B.forearm`（旧 絶対値 ±0.16）。指の形・本数・親指・y / z・手の球は不変。Human Decision は Task file「Out of Scope Found（T-7）」に記録（R-4） |

## 4. Human Decisions（P-D0〜P-D10、P-D11）
| # | 判定 | 根拠 |
| --- | --- | --- |
| P-D0（ID = T-7） | PASS | Work Items 表に T-7 を新規行で追加。取り下げ済み T-6 の行・節は差分なし |
| P-D1（装飾 = 各職の trim） | PASS | S-1 |
| P-D2（武器の形状等は変えない） | PASS | `06` の diff で `Geometry` / `position` / `rotation` / `scale` / `WEAPON_SOCKET` / `GRIP_OFFSET` に関わる変更は指の x（S-7）の1行のみ。`buildWeaponMesh` の差分は Material 行と引数のみ |
| P-D3（`WEAPON_FINISH` を別 export） | PASS | S-2 |
| P-D4（既存方式の outline + X-ray、VFX 対象外） | PASS | S-3 / S-4。`outlineMats` / `addOutline` / `addXrayShell` / `refreshOutlines` の実装は差分なし（`05` の差分は `motionBodySnapshot` のみ）。後から足したシェルもドットモード切り替え（`refreshOutlines` は `scene.traverse`）の対象に入る |
| P-D5（VFX の色は変えない） | PASS | `10` / `11` / `13` の差分なし。結晶・魔法陣の色（`uj.trim`）不変 |
| P-D6（影の旅人） | PASS | `swapPlayerWeaponVisual` の `if(classDef.charKey === 'wanderer') weapon.visible = false;` は不変。E2E で持ち替え後も武器メッシュの表示 0 を確認。素手攻撃・影の攻撃・設定の変更なし |
| P-D7（OUTL 行） | PASS | `motionBodySnapshot().outl` = 武器（主 + オフハンド）と `jobDecorMeshes` の `traverseVisible` で、`noOutline` / 特殊武器のオーラ / シェル自身を除いた対象数・輪郭線なし数・X 線なし数。Motion Preview に `OUTL wep m/t deco m/t xray n`。本番 UI は変更なし（デバッグパネルのみ） |
| P-D8（戦闘中の Visual は含めない） | PASS | 戦闘系のコード・テストの差分なし |
| P-D9（motion 変更なし） | PASS | STANCE / CLIPS / `13` / camera / swing-timing の差分なし |
| P-D10（実装 branch） | PASS | `claude/character-vis-001-t7-impl`、起点 `7bce8db` |
| P-D11（S-7、Human Decision） | PASS（記録付き） | S-7 |

## 5. Acceptance Criteria
| # | 判定 | 確認方法 |
| --- | --- | --- |
| AC-1 装飾色 = palette trim | PASS | source inspection + unit（`buildWeaponMesh` のソース検査）+ V-1a（Human OK） |
| AC-2 質感 = `WEAPON_FINISH` | PASS | source inspection + unit |
| AC-3 持ち替え武器・オフハンド・上位職装飾に outline | PASS（オフハンドの持ち替えは source のみ、R-5） | E2E（8職の生成時・上位職の装飾、剣士の持ち替え）+ unit + V-1b |
| AC-4 X-ray shell | PASS | E2E（OUTL の xray 欠け 0）+ source。画像では見えない（壁越しのみ描画） |
| AC-5 VFX に outline なし | PASS | source（`noOutline` 付与・skip）+ unit + V-1b（結晶・魔法陣・オーラに線なし） |
| AC-6 共有 Material を破棄しない | PASS | source + unit |
| AC-7 影の旅人の武器が持ち替え後も非表示 | PASS | E2E（持ち替え後も武器メッシュの表示 0。持ち替えの発生はトーストで確認） |
| AC-8 本体・T-5 配色・武器形状 / 位置・motion・VFX・CLASSES 不変 | PASS（S-7 の Human Decision を除く） | diff 監査（§9） |
| AC-9 build / unit / E2E | PASS（記録付き） | §7 |
| AC-10 V-1a Human OK | PASS（記録） | Task file |
| AC-11 V-1b Human OK | PASS（記録） | Task file。V-1c（S-7）も Human OK |

## 6. V-1a〜V-1c
- V-1a / V-1b / V-1c はいずれも Task file に Human OK が記録されている（誰・いつ・会話）。Reviewer は Human の判断を上書きしない
- Human OK の対象（武器の装飾色・質感・ジェム・持ち替え、上位職装飾と武器の輪郭線、指の位置）は、上記のとおり Reviewed SHA のコードに実装されている。V-1a / V-1b の撮影は `f8bcdb6`、V-1c は `2fd5760` のコードで行われ、`f8bcdb6..e1af174` のコード差分は S-7 の1行のみ

## 7. Test Audit
| テスト | Implementer の報告 | Reviewer の再実行（`e1af174`） | 判定 |
| --- | --- | --- | --- |
| `npm run build` | PASS | PASS | PASS |
| `npm run test:unit` | 1526 / 1526（`f8bcdb6`）、1527 / 1527（S-7 後） | **1527 / 1527 PASS** | PASS |
| T-7 関連 E2E `character-weapon-visual`（10件） | 10 PASS | PASS（下の39件に含む） | PASS |
| 関連 E2E（`character-weapon-visual`・`character-clothing`・`character-palette`・`weapon-stow`・`battle-knight-visual`） | S-7 後に 52 / 52（`character-motion` を含む） | **39 / 39 PASS** | PASS |
| 全 E2E 156件 | `f8bcdb6` で 152 PASS / 3 FAIL / 1 FLAKY | 再実行していない（R-6） | 記録どおり |
| baseline failure | `execution-break.spec.js:99`、`mansion-escort.spec.js:126` | ― | T-5 で `main` でも FAIL を確認済み。T-7 回帰ではない。PASS に数えない |
| FLAKY | `base-class-identity.spec.js:413`（全体で FAIL → 単独 PASS）、`job-traits.spec.js:162` | ― | 既知の FLAKY。PASS に数えない |
| 標準 `npm test` | NOT_RUN（Chromium revision 不一致） | NOT_RUN | Playwright 設定は変更されていない |

## 8. RF-1〜RF-3（Reviewer の独立判断）
| RF | 事実 | T-7 scope との関係 | 判断 |
| --- | --- | --- | --- |
| RF-1 | 生成時の武器は `buildPlayer` 末尾の `addOutline(group)` で特殊武器のオーラにも輪郭線が付く（T-7 以前から）。持ち替え時は P-D4 に従いオーラを skip | P-D4 は「新たに付与するものに VFX を含めない」。生成時の付与は「既存の outline 方式を変えない」（P-D4）により対象外。S-6 は Material の生成規則の統一で、輪郭線の範囲は含まない | **Record-only**。生成時と持ち替え時で特殊武器のオーラの線の有無が異なる不整合は残る（後続 Task 候補） |
| RF-2 | grip / 弦 / 矢 / 魔法の剣の光る刃などは個別の直値 Material | S-2 の対象は steel / darkSteel / goldTrim / woodMat / gem emissive と列挙されており、それ以外は対象外 | **Record-only** |
| RF-3 | 盗賊の双剣・バーサーカーの斧は刀身の一部が `goldTrim` で作られており、P-D1 の trim（#263449 / #59483D）で暗色になる | P-D1（各職の trim）の直接の結果。形状不変。V-1a で Human OK | **Record-only** |

## 9. Scope 逸脱の確認（`git diff 7bce8db e1af174`）
| 対象 | 結果 |
| --- | --- |
| `01`〜`04`、`07`〜`14`（CLASSES・NPC・敵・ボス・支援AI・入力・戦闘・更新ループ・HUD）、`src/textures/`、`playwright.config.js`、`package*.json` | 差分なし |
| T-5 の配色表・`PLAYER_FINISH`・役割別 Material の値 | 差分なし（`player-palette.js` は `WEAPON_FINISH` の追加のみ） |
| 武器の Geometry・大きさ・位置・収納・持ち方 | 差分なし |
| `05-rendering-rig.js` | `motionBodySnapshot` の `outl` 追加のみ（P-D7） |
| `concat-plugin.js` | 既存の import 行に `WEAPON_FINISH` を1語追加（R-3） |
| 本体の Geometry | 指の x 位置のみ（S-7、Human Decision） |
| 無関係なリファクタリング | 見つからない |
| 取り下げ済み T-6 | Task file の T-6 の行・節は差分なし |

## 10. Findings
**修正必須の Finding: 0件**

## 11. Record-only Notes
| # | 内容 |
| --- | --- |
| R-1 | 独立性: Reviewer は Implementer と同一セッション（T-1〜T-5 と同じ運用）。修正は行っていない |
| R-2 | Human の指示文の「Implementation commit `537cc61`」は Test Report の commit。レビュー対象はその後の S-7（`2fd5760`）・docs・Status 移行を含む `e1af174` とした |
| R-3 | `src/legacy/concat-plugin.js` は T-7 の Files To Change の表に無い。`WEAPON_FINISH` を legacy から使うための既存 import 行への1語追加で、実装者が RF-4 として記録済み |
| R-4 | S-7（指の位置）は承認済み T-7 の Scope 表には無く、V-1b 後の Human Decision として「Out of Scope Found（T-7）」節に記録されている（Scope 表そのものは Approved Task Blob のまま）。追跡は可能 |
| R-5 | 持ち替えたオフハンドの輪郭線は、本編で盗賊系の主人公に特殊武器を装備させる導線が無いため E2E / 画像で未確認。コードは主武器と同じ `addPartOutlines` の引数（source inspection のみ） |
| R-6 | 全 E2E（156件）は S-7 の後に再実行されていない。S-7 は指の x のみで、関連 E2E（Implementer 52件、Reviewer 39件）は PASS |
| R-7 | Human の指示文の unit 件数 1526 は `f8bcdb6` 時点。S-7 で1件追加され 1527 |
| R-8 | RF-1（特殊武器のオーラの輪郭線の不整合）は後続 Task 候補 |
| R-9 | T-5 Review が見落とした「native 武器の装飾が固定ゴールドで P-D9 と不一致」（T-6 Analysis GAP-01）は、T-7 S-1 で解消された |
| R-10 | 持ち替えの E2E は鑑定所を開くために酒場を歩く導線（`chapter1-skill2.spec.js` と同じ）を使う。影の旅人のセーブで鍛冶士加入済みにすると届かなかったため、最小セーブにしている（テストの前提として記録） |

## 12. Reviewer の変更
- Reviewer 工程で source・tests・docs・Task file・Playwright 設定を変更していない。main への merge・push はしていない。作成したのは本 report（未 commit）のみ
- （REVIEWING への Status 移行 `e1af174` は、Reviewer 工程の開始前に Implementer として Human の指示で行ったもの）

## 13. 次の工程
PASS。T-7 は DONE 判定工程へ進められる状態。Status の DONE への更新は Human の指示を待つ。
