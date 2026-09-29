# UI-002-E Plan

- Role: Planner（READ ONLY。書いたのは本ファイルのみ。ソース・Task file・Decision record・C2 / V の記録・D の未 commit 変更は変更していない）
- Task: `.ai/tasks/UI-002-E.md`（Status: DRAFT。HDE-1〜HDE-3 は作業ツリー上に記録済み・未 commit）
- Date: 2026-09-29
- Session: UI-001 以降と同一の Claude Code セッション（独立性なし）
- 本計画は **提案**。デザインの最終決定はしない。Human Approval があるまで実装しない。
- **改訂（2026-09-29、Human の指示による再分析）**: 影の旅人を剣士と同一視していた前提を撤回した。影の旅人は武器を持たず、通常攻撃は「素手＋影」、Skill 1 / 2 は影を使った独自の表現、Ultimate は影送りで、剣士とは戦闘表現が別物（Human 確定情報）。内部ロジックが剣士の kit と共通でも、UI アイコンを剣士と同じ絵柄にしない。改訂した節: §0、§3.4（新設）、§4.5、§4.6（新設）、§7、§8.3、§11、§15、§16、§20（新設）

## 0. 入力と Artifact Handoff 検証

| 入力 | 値 |
| --- | --- |
| Analyzer report | `.ai/reports/UI-002-E-analysis.md`、Source Branch `claude/ui-002-c1-impl`、Source SHA `a073dc82f2192bef67932eeac595bb82219f11d2`、Blob SHA `cff1e310ac8625ff753a91627c5847d9bc6198d2`、Persisted by Human |
| Handoff 検証（Planner、2026-09-29） | H-1 到達可能 / H-2 Path 存在 / H-3 変更 1 件 / H-4 期待 Path 一致 / H-5 見出し `# UI-002-E Analysis` 一致 / H-6 Blob 一致 / H-7 同キーの既存記録なし / H-8 Source SHA の内容を読んだ — すべて PASS |
| Human Decision | HDE-1〜HDE-3（`.ai/tasks/UI-002-E.md` の作業ツリー上の記録。未 commit） |
| 追加で確認した FACT | 魔法使い・弓師は `range:'ranged'`（`01-character-creation.js:63, 80`）。影の旅人については §20 に再調査の結果をまとめた。要点: 内部ロジックは剣士の kit（`kit:'warrior'`、`12-progression-ui.js:1745-1746`）だが、武器メッシュは表示しない（`06-player-enemy.js:2017-2020, 2212`、T-4 の Human Decision「最終的に素手」）。**この内部共通性をアイコンの共通化の根拠にしない**（Human 確定情報） |

## 1. Purpose

C2 Prototype で確かめた視覚言語を、Chapter 1 の主人公 5 人 × 5 操作（Attack / Skill 1 / Skill 2 / Ultimate / Heal）と Weapon Badge の**正式アイコン体系**にする。体系は「共通の操作種別シルエット＋技固有モチーフ」（HDE-1）で、16px で成立すること。

## 2. Human Decision constraints

| # | 制約 | 出所 |
| --- | --- | --- |
| C-1 | 2 層構造: 外形 = 操作種別、内部 = 技固有モチーフ | HDE-1 |
| C-2 | 16px では細部より外形・シルエットを優先 | HDE-1、V 引き継ぎ |
| C-3 | 色だけに意味を依存しない | HDE-1、V-6 |
| C-4 | Emoji / Unicode 記号に戻さない | HDE-1、V-5 |
| C-5 | 対象は 5 人 × 5 種 = 25。独立した 25 体系にせず、共通テンプレート＋技固有モチーフ。キャラクター追加に耐える | HDE-2 |
| C-6 | Ultimate: 八芒星は不採用。16px で特殊操作と分かる外形・固有モチーフ・単純なシルエット・Ready を色だけにしない・常時パルス / 発光に依存しない。Ready 到達時の 1 回の反応は候補 | HDE-3 |
| C-7 | Attack は大剣シルエットを維持する方向、Heal は瓶シルエットを維持し回復の補助形状を検討、Skill は C2 仮アイコンを出発点 | V 引き継ぎ |
| C-8 | UI semantic token 優先。キャラクターパレットと混同しない | V-7 |
| C-9 | HUD 位置・ボタンサイズ・PC / touch レイアウト・HUD 表示条件・MP 廃止・Ultimate ゲージのロジックは扱わない | E Scope（Human） |

## 3. Common icon system

### 3.1 2 層の定義

| 層 | 役割 | 描き方 | 16px |
| --- | --- | --- | --- |
| L1: 操作種別の外形（frame） | Attack / Skill / Ultimate / Heal を区別する | 24×24 のグリッドの外周を使う**枠の形**。塗りの面＋外側の輪郭 | **必ず残す**（外形だけで操作種別が分かること） |
| L2: 技固有モチーフ（motif） | キャラクター固有の技を示す | 枠の内側（中央 14×14 程度）に置く**太い単純形 1 つ** | 太い主形だけ残す。細部は 20 / 24px 用 |

- L1 は 4 種（Attack / Skill / Ultimate / Heal）。Skill 1 と Skill 2 は同じ Skill 外形で、区別は L2（モチーフ）と**外形の小さな印**（例: 角の切り欠き 1 か所 / 2 か所）の候補を HDE-E5 で決める。
- 3 段階の詳細度（LOD）: 16px は「L1 外形＋L2 主形」、20px は「＋L2 の第 2 要素」、24px は「＋小さな差し色 / 内側の縁」。1 つの SVG に LOD ごとの要素を持たせ、表示サイズで CSS から出し分ける（§8.4）。

### 3.2 外形の候補（L1）

C2 の外形（円 = Attack、角丸四角 = Skill、菱形 = Ultimate、小円 = Heal）は 16px で崩れなかった（Analyzer I-4）。これを出発点に、次の 2 系統を提示する。

| 案 | Attack | Skill | Ultimate | Heal | 特徴 |
| --- | --- | --- | --- | --- | --- |
| F-A（C2 継承） | 円 | 角丸四角 | 菱形 | 小円 | C2 で実画面確認済み。Ultimate の菱形は §5 の候補と組み合わせる |
| F-B（盾形系） | 円 | 盾形（上辺が平ら・下が尖る） | 紋章形（§5） | 瓶の外形そのもの | 中世ファンタジー感（V-1）が強い。盾形は 16px で角丸四角より判別しやすいが、内側の面積が小さい |

- どちらを採るかは HDE-E4（Planner は決めない）。
- アイコン（SVG）自体の外形と、HUD ボタンの外形（D3 の Action Zone のボタン形）は**別物**として扱う。E が決めるのはアイコンの外形（§12）。

### 3.3 16px の最低識別要素

- L1 外形が判別できる（円・四角・菱形 / 紋章・瓶の違い）
- L2 は太さ 2px 以上（24 グリッド換算）の主形 1 つ
- 内部の空白（穴・隙間）は 2px 以上。1px の隙間は輪郭で埋まる（Analyzer §7: C2 の十字・星が潰れた原因）

### 3.4 25 枠の扱い（改訂）

- **Chapter 1 の 5 人 × Attack / Skill 1 / Skill 2 / Ultimate / Heal の 25 枠を正式設計対象とする**（HDE-2）。
- 25 枠すべてを別 SVG として作るという意味ではない。次のように分ける。

| 区分 | 内容 | 例 |
| --- | --- | --- |
| 共通化できるもの | 操作種別の外形（L1）4 種 / キャラクター差が不要な UI 表現 / Human が共通化を判断したもの | Attack・Skill・Ultimate・Heal の外形、Heal の回復形状（HDE-E7 で共通化を選んだ場合） |
| 個別化すべきもの | キャラクターの戦闘表現（武器・身体・魔法・影）/ 技固有のモチーフ | 剣士＝大剣、影の旅人＝素手＋影、各技のモチーフ |

- 「同じ技だから同じアイコン」ではなく、「同じ操作種別を共通の外形で示し、技・キャラクターの違いを内部モチーフで示す」。
- ゲーム内部で技の処理を共有しているか（例: 影の旅人の kit が剣士）は、アイコンの共通化の判断基準にしない。
- 旧版の「実際に異なる絵柄は 18 個の見込み」は**撤回**した。個別の絵柄の数は、HDE-E7（Heal の共通化）等の Human Decision の後に決まる。

## 4. 5×5 icon design matrix

凡例: 外形 = L1（§3.2 のどちらでも同じ考え方）、16px = 16px で残す要素、20/24 = 追加できる要素。モチーフは**候補**で、最終形は Human が撮影を見て決める（§16）。

### 4.1 剣士（warrior）

| 操作 | 技（FACT） | 外形 | 技固有モチーフ（候補） | 16px | 20/24px | 意味が伝わる根拠 |
| --- | --- | --- | --- | --- | --- | --- |
| Attack | 大剣の通常攻撃 | Attack | 大剣（縦〜斜め） | 大剣シルエット | 斬撃の弧を**剣から離して**追加 | 大剣は 16px で判別可（Analyzer §1.4）。C2 で弧が剣と一体化 → 16px では弧を省く |
| Skill 1 | 切り下がり: 強打して後方へ引く | Skill | 振り下ろした大剣＋**後ろ向きの矢じり**（「打って下がる」） | 剣＋後ろ向きの太い矢じり | 着地の短線・剣の軌跡 | 現行 `⬇️` / C2 の下向き矢印は「下がる」を示さない（Analyzer I-1）。「攻撃＋後退」の 2 要素で技の意味と一致させる |
| Skill 2 | 崩し斬り: 足元を狙う水平に近い横薙ぎで体幹を崩す。**回転ではない** | Skill | **崩れる台座 / 割れた足場**を水平の斬線が断つ（C2 の「断たれた円」を水平方向へ） | 水平の太い斬線＋割れた形 | 破片 1〜2 個 | 仕様 6-2（回転斬り禁止）に合わせ、渦・円運動の形を使わない。「足元」「崩す」を水平線と割れで示す |
| Ultimate | 渾身の斬撃: 大範囲の強力な一撃 | Ultimate | 大きな縦の斬撃（太い刃の三日月）＋衝撃の放射 2〜3 本 | 太い三日月 1 つ | 放射線 | Attack の大剣と同じ系統（剣士）で、Attack より大きく「一撃」を示す |
| Heal | 薬草（全員共通の効果） | Heal | §6 の候補 | 瓶シルエット | §6 | — |

### 4.2 魔法使い（mage、range:'ranged'）

| 操作 | 技（FACT） | 外形 | 技固有モチーフ（候補） | 16px | 20/24px | 根拠 |
| --- | --- | --- | --- | --- | --- | --- |
| Attack | 杖の遠距離魔法 | Attack | 杖の先端＋魔弾（円） | 杖の頭＋弾 1 つ | 軌跡 | 遠距離であることを「弾」で示す |
| Skill 1 | 幻影歩法: 後方へ退き、幻影を残す（ダメージ無し） | Skill | 人影 2 つ（実体＋輪郭だけの幻影）＋後ろ向きの矢じり | 人影 2 つの重なり | 矢じり | 「幻影」と「退く」。塗りと輪郭の対比で実体 / 幻影を示す（色に依存しない） |
| Skill 2 | 観測の灯: 灯りを掲げ、怪異の挙動を見やすくする（ダメージ無し） | Skill | ランタン / 灯り＋目 | ランタンの外形 | 光の短線 | 攻撃ではない「観測」を、武器でない道具の形で示す |
| Ultimate | メテオフォール | Ultimate | 斜めに落ちる大きな岩（円＋尾） | 円＋太い尾 | 尾の分割 | 「落ちてくる」の方向で他と区別 |
| Heal | 薬草 | Heal | §6 | — | — | — |

### 4.3 弓師（archer、range:'ranged'）

| 操作 | 技（FACT） | 外形 | 技固有モチーフ（候補） | 16px | 20/24px | 根拠 |
| --- | --- | --- | --- | --- | --- | --- |
| Attack | 小弓の射撃 | Attack | 弓（弧）＋矢 | 弓の弧＋矢 1 本 | 弦 | 武器そのもの |
| Skill 1 | 五月雨射ち: 前方へ 5 本を扇状に放つ（近い敵を追尾） | Skill | 扇状に開く矢 3 本（5 本は 16px で潰れる） | 扇 3 本 | 5 本に増やす | 「扇状」を本数より開き方で示す |
| Skill 2 | 爆弾投げ | Skill | 丸い爆弾＋導火線 | 円＋短い導火線 | 火花 | 形で「爆弾」 |
| Ultimate | 八方の矢 | Ultimate | 中心から放射する矢 4 本（8 本は 16px で潰れる） | 放射 4 本 | 8 本 | 「全方位」を放射で示す |
| Heal | 薬草 | Heal | §6 | — | — | — |

### 4.4 盗賊（rogue）

| 操作 | 技（FACT） | 外形 | 技固有モチーフ（候補） | 16px | 20/24px | 根拠 |
| --- | --- | --- | --- | --- | --- | --- |
| Attack | 双剣の通常攻撃 | Attack | 交差した短剣 2 本 | X 字の 2 本 | 柄の差 | 大剣（1 本・太い）と 2 本・細いで区別（§7） |
| Skill 1 | 影退きの一閃: 一撃を叩き込み、瞬時に飛び退く | Skill | 短剣の一閃＋後ろ向きの矢じり | 斜めの刃＋矢じり | 残像の線 | 剣士の切り下がりと同じ「攻撃＋後退」の文法（同じ意味には同じ視覚言語、V-5） |
| Skill 2 | 三連投げナイフ | Skill | 平行に飛ぶ短剣 3 本 | 3 本の斜線 | 刃先 | 「投げる・3」 |
| Ultimate | 影閃乱舞 | Ultimate | 交差する斬線 3 本（星形にしない） | 3 本の交差 | 残像 | 多段の斬撃 |
| Heal | 薬草 | Heal | §6 | — | — | — |

### 4.5 影の旅人（wanderer）（改訂）

前提（Human 確定情報）: 武器を持たない。剣を持たない。通常攻撃は「素手＋影」。Skill 1 / Skill 2 は剣技ではなく影を使った独自の表現。Ultimate は影送り。剣士とはキャラクター性・攻撃表現・武器表現が別物。
ソース上の事実（§20）: 攻撃処理・判定・モーションは剣士の kit のまま、武器を表示しないだけ。素手・影の攻撃演出、影の旅人固有の Skill 1 / 2 の名前・内容、影送り固有の演出は**実装も仕様も見つからない**（OPEN QUESTION §4.6）。

| 操作 | 技（確認できた範囲） | 外形 | 技固有モチーフ（候補。Human が決める） | 16px | 20/24px | 根拠 |
| --- | --- | --- | --- | --- | --- | --- |
| Attack | 素手＋影の通常攻撃（Human 確定）。内部は剣士の kit | Attack | 開いた手（または拳）＋手から伸びる影の爪 / 影の塊 | 手のシルエット＋影の塊 1 つ | 影の爪を 2〜3 本に分ける | Human 確定の「素手＋影」。**剣・大剣・剣撃をモチーフにしない** |
| Skill 1 | 影を使った独自の技（Human 確定）。名前・内容はソース・仕様に無い（OQ-W1） | Skill | 仮の候補: (a) 影が地面を這って伸びる / (b) 手から放つ影の弾 / (c) 影の中へ沈み別の場所へ出る | 候補ごとの主形 1 つ | 候補ごと | 技の内容が決まっていないため、**候補のまま**。剣士の切り下がりと同じアイコンにしない |
| Skill 2 | 影を使った独自の技（Human 確定）。名前・内容はソース・仕様に無い（OQ-W1） | Skill | 仮の候補: (a) 影の手が敵をつかむ / (b) 足元の影だまりが広がる / (c) 影の分身 | 同上 | 同上 | 同上。剣士の崩し斬りと同じアイコンにしない |
| Ultimate | 影送り（固有の名前・icon `◐`・紫の VFX 色 `0x8a5ad6`。処理・範囲・倍率は剣士の Ultimate と同じ値、固有の演出は未実装） | Ultimate | 候補（決定しない）: (a) 影・残像: 人影と、ずれた輪郭だけの残像 / (b) 転移: 影だまり（楕円）から人影が抜け出る / (c) 送り出す動き: 開いた手から前方へ押し出される影の波 / (d) 半分影の円（肖像の記号 `◐` の意味系統を自前のシルエットで） | 候補ごとの主形 1 つ | 影の尾・残像の段 | 剣士の「渾身の斬撃」とは完全に別アイコン。技の意味（影・送る）が実装に無いため、名前から読み取れる範囲の候補にとどめる（OQ-W2） |
| Heal | 薬草（効果は全員共通） | Heal | §6 | — | — | キャラクター差を付けるかは HDE-E7 |

### 4.6 影の旅人の OPEN QUESTION（新設）

| # | 問い |
| --- | --- |
| OQ-W1 | 影の旅人の Skill 1 / Skill 2 の技の名前・内容・演出。ソース（`CHARGE_VARIANTS_BY_CLASS` / `SKILL2_BY_CLASS` / `crush-slash.js`）にも docs にも定義が無い。現在の内部処理は剣士の切り下がり・崩し斬り |
| OQ-W2 | 影送りの効果・演出（何を「送る」のか、転移・残像・影の放出など）。現在は剣士の Ultimate と同じ処理で色だけ紫 |
| OQ-W3 | 通常攻撃「素手＋影」の具体的な見た目（拳か開いた手か、影は爪・塊・波のどれか）。素手の演出は未実装（`docs/CHARACTERS.md` 武器の見た目の節） |
| OQ-W4 | Weapon Badge で「武器なし」を表すか、Badge 自体を出さないか（表示条件は D。E は絵柄を用意するかどうか） |
| OQ-W5 | 影の旅人の技アイコンを、技の内容が決まる前に作るか（仮モチーフで作る / 技の内容の決定を待つ） |
| OQ-W6 | 影の表現の色: 影の VFX の紫（`0x8a5ad6`）を icon accent に使うか（HDE-E9 と関係）。キャラクターパレットの金具の紫 `#654F86` とは別の値（`player-palette.js:74-80`） |

## 5. Ultimate alternatives（決定しない）

| 案 | 外形（L1） | 内部モチーフ（L2） | 16px の視認性（予測） | Ready との相性 | 5 人への展開 |
| --- | --- | --- | --- | --- | --- |
| U-1: 菱形＋技モチーフ | C2 と同じ菱形 | 技ごとの太い主形 1 つ（§4 の Ultimate 欄） | 菱形は C2 で 16px 判別済み。中身は主形 1 つなら残る見込み | 菱形の面を満たす / 縁を太くする（C2 で確認済みの方式） | 可（中身だけ差し替え） |
| U-2: 紋章盾（エスカッシャン） | 上辺が平らで下が尖る盾形＋上辺の冠状の切り込み 3 つ | 技モチーフ | 冠の切り込みは 16px で 1〜2px になり潰れる恐れ。盾形自体は残る | 盾の面を満たす | 可 |
| U-3: 太い二重枠 | 外形は Skill と同じ系統で、**枠線を二重（太＋細）**にする | 技モチーフ | 二重枠は 16px で 1 本に見える恐れ（C2 の輪と同じ問題） | 内側の枠を塗る | 可 |
| U-4: 角の突起つき円（光輪ではない、4 方向の短い突起） | 円＋上下左右の太い三角 4 つ | 技モチーフ | 突起が太ければ 16px で残る。八芒星より単純 | 突起を塗る / 面を満たす | 可 |

- 比較の基準（実測で確かめる）: DPR 1 の 16 / 20 / 24px、グレースケール、Not Ready / Ready の 2 状態。W-E2 で 2〜4 案を試作・撮影し、Human が選ぶ（HDE-E1）。
- Ready の表し方（候補）: 外形の面を塗る（Not Ready は輪郭中心）＋ Ready 到達時の 1 回の反応（C2 と同じ）。常時パルス・常時発光は使わない（C-6）。ゲージの進捗表現（面の充填・％）は D3 と接する（§12）。

## 6. Heal alternatives（決定しない）

前提（FACT）: 瓶シルエットは 16px で判別可、十字はほぼ見えない（Analyzer §1.4）。

| 案 | 瓶＋回復の最小形状 | 16px の見込み | 備考 |
| --- | --- | --- | --- |
| H-1: 太い十字 | 瓶の胴に、線幅 3px（24 グリッド）の十字を**切り抜き**で | 十字の穴が 2px 以上なら残る | 最も一般的な回復記号。赤十字の色には頼らない |
| H-2: 葉 1 枚 | 瓶の口から出る葉（薬草 = 草） | 葉の外形が瓶の外へ出るので潰れにくい | 「薬草」というゲーム内の名前に合う |
| H-3: 上向きの矢じり | 瓶の胴に上向きの三角の切り抜き | 三角は 16px で残りやすい | 「上がる」＝回復。ただし矢じりは Skill 1 の「後退」と文法が被る恐れ |
| H-4: 液面の線 | 瓶の中の液面（上半分が空き・下が満ち）だけ | 液面は 16px で 1 本の境界として残る | 「中身がある瓶」。回復の意味は弱い |

- Heal は 5 人で効果が同じ（薬草）。**1 種を共通で使う**案と、キャラクターごとに瓶の栓などを変える案がある（HDE-E7）。
- 所持数の表示は Heal アイコンの外（HUD 側の数字）で、E では扱わない（D）。

## 7. Weapon Badge design

| 武器 | 持ち主 | 16px の識別 | Attack との共通性 |
| --- | --- | --- | --- |
| 大剣 | 剣士 | 1 本・太い刃・大きな鍔 | Attack（剣士）の L2 と**同じ大剣**（C2 で確認済みの方針） |
| 双剣 | 盗賊 | 2 本・細い刃の X 字 | Attack（盗賊）の L2 と同じ |
| 杖 | 魔法使い | 縦の長い柄＋先端の丸い頭 | Attack（魔法使い）の杖 |
| 小弓 | 弓師 | 弧＋弦（矢は省く） | Attack（弓師）の弓 |

| 武器なし（改訂） | 影の旅人 | 候補（決定しない）: 素手（開いた手）/ 手＋影 / 影そのもの（影だまりの楕円） | Attack（影の旅人）の L2 と同じ系統。**大剣・剣・武器シルエットを使わない** |

- 影の旅人は武器を持たない（Human 確定、`docs/CHARACTERS.md`「最終的に素手の想定」）。現行の本番 HUD では、kit が剣士のため Weapon Badge に大剣の `🗡️` が出る（`14-hud-boot.js:353-360` が `weaponDefFor(kitKey)` を使う。INFERENCE: `WEAPON_TYPES` に wanderer の行が無く、kit の warrior で引かれる）。E では「武器なし」を表す絵柄の候補を用意し、Badge に何を出すか・出さないかの表示条件は D（OQ-W4）。
- Weapon Badge = 「Attack の L2（武器モチーフ）を、枠なし・または Badge 用の小さな円枠で」再利用する。現行の大剣と双剣が同じ `🗡️` という問題（Analyzer §1.6）は、1 本 / 2 本・太い / 細いのシルエット差で解消する。
- **表示位置・サイズ・表示条件・「M」の修正・交代時の同期は D の範囲**（WI-D1 / D2 / D4）。E は絵柄だけを用意する。
- Badge は 18px の枠内（現行）で使われているため、武器モチーフは 14px 程度でも成立する必要がある（INFERENCE: 枠の輪郭ぶん小さくなる）。W-E6 で 14 / 16px の撮影を行う。

## 8. SVG architecture

### 8.1 形式の候補（HDE-E3。決定しない）

| 案 | 内容 | 利点 | 欠点 |
| --- | --- | --- | --- |
| S-1: インライン SVG（core の文字列、C2 と同じ） | `src/core/` の純粋データに SVG 文字列。DOM に innerHTML で入れる | C2 で動作確認済み。ビルド設定が要らない。unit でテストできる | 同じ SVG が DOM に複数回入る。文字列の組み立てが増える |
| S-2: SVG sprite（`<symbol>` ＋ `<use>`） | 1 つの sprite を DOM に 1 回入れ、各所は `<use href="#ico-…">` | 定義が 1 か所。LOD の出し分けを CSS で行える | sprite の挿入場所が要る（`index.html` か JS）。`<use>` 内は CSS の効き方に制約がある |
| S-3: SVG ファイル（`public/` / import） | 1 アイコン 1 ファイル | デザインツールとの往復が楽 | 25＋のファイル、`currentColor` / 状態の CSS 制御が `<img>` では効かない（インラインにする処理が別に要る） |

- Planner の整理: 2 層構造（外形＋モチーフ）を**合成**するには、文字列または `<symbol>` の組み合わせが扱いやすい（S-1 / S-2）。S-3 は合成と `currentColor` に追加の仕組みが要る。

### 8.2 共通仕様（形式によらない）

| 項目 | 提案 |
| --- | --- |
| viewBox | `0 0 24 24`（C2 と同じ） |
| グリッド | 外形は 1〜23、モチーフは 5〜19 の範囲 |
| 塗り / 線 | 面は `fill:currentColor`、外側の輪郭は CSS の `stroke`（`--ui-outline`）＋ `paint-order:stroke`。内部の線は使わない（塗りと切り抜きで表す） |
| 線幅 | 輪郭 1.5〜2（24 グリッド）。16px 表示で 1〜1.3 画素。モチーフの最細部は 2 以上 |
| 切り抜き | 十字・隙間は `fill-rule:evenodd` の穴で。穴の幅は 2 以上 |
| 色 | SVG に色を書かない（C2 の unit と同じ規則）。色は CSS の token |
| LOD | 要素に `class="lod20"` / `class="lod24"` を付け、表示サイズの class（例 `.ico-16`）で非表示にする |

### 8.3 保守しやすい構造（案）

```
src/core/ui-icon-shapes.js    外形 4 種(attack / skill / ultimate / heal)の path
src/core/ui-icon-motifs.js    モチーフ(greatsword / dualblades / staff / shortbow / retreatStrike / crushSlash / ...)
src/core/ui-icon-set.js       (キャラクター, 操作) → { frame, motif, lod } の表と、SVG を組み立てる純粋関数
src/core/ui-icons.js          既存の対応表(C1)。正式アイコンの名前へつなぐ(E の後段)
```

- キャラクター追加 = モチーフの追加＋表の行の追加だけ（HDE-2 の拡張性）。
- 影の旅人は独自のモチーフ（素手＋影など）を持つ行として表に入れる。内部の kit（剣士）とは結び付けない（キーはキャラクター `charKey` で引く案。`classDef.key` は kit の warrior になるため使わない。FACT: `12-progression-ui.js:1746`）。

### 8.4 LOD の出し分け

- 使う側が表示サイズの class を付ける（例 `.ico-16` / `.ico-20` / `.ico-24`）。E は class と規則を用意し、どこで何 px で使うかは D が決める。

## 9. Semantic color / token plan

| token | main（`40644f3`） | C2 ブランチ（`3e54909`） | E での扱い（案） |
| --- | --- | --- | --- |
| `--ui-text` / `--ui-text-muted` / `--ui-line` / `--ui-surface-*` | あり | あり | そのまま使う |
| `--ui-selected` / `--ui-danger` / `--ui-recovery` / `--ui-special` / `--ui-disabled` / `--ui-outline` | **無い** | あり（既存値の再利用） | E の実装前に main へ入っている必要がある。入れ方は HDE-E8（C2 を main へ merge / E で同じ定義を入れる）。**Planner は merge しない** |
| Attack / Skill / Cooldown / Ready 専用 | 無い | 無い | 新設しない案を基本とする（Ready = `--ui-special`、Cooldown = overlay、Disabled = `--ui-disabled`。C2 と同じ）。必要なら候補を Human に提示 |
| 職業色 | UI token に無い（決まり） | 同 | icon accent に使うかは HDE-E9。使う場合も UI token にせず、キャラクター定義から取る |

## 10. State representation

アイコン（SVG）と状態表現（CSS）を分ける。アイコンは状態を持たない。

| 状態 | 表し方（案。色だけにしない） | 常時アニメーション |
| --- | --- | --- |
| normal | 面＋輪郭 | なし |
| pressed | 1〜2px 沈む＋内側の縁（C2 と同じ） | なし |
| disabled | 面を塗らず輪郭だけ＋斜線 overlay（C2 と同じ） | なし |
| cooldown | 扇形の overlay で残り時間（C2 と同じ） | なし（進捗に応じて変わるだけ） |
| ready（Ultimate） | 外形の面を満たす＋太い縁（C2 と同じ系統）。到達時に 1 回の反応（候補） | **常時パルス・常時発光なし**（C-6） |

- 状態の CSS は正式な共通 class（例 `.ico-state-disabled`）として E で用意する案と、D3（Action Zone）で用意する案がある（HDE-E10）。
- 既存 HUD の `#btn-ult.ready` の常時パルス（`main.css:228`）の停止は、HUD の変更なので D3 と接する（HDE-E10）。

## 11. C2 → E migration boundary

| 区分 | 内容 |
| --- | --- |
| 再利用 | （影の旅人には C2 の大剣を使わない）viewBox 24、`fill:currentColor`＋CSS の輪郭、SVG に色を書かない規則、ASCII のみの unit test、状態の表し方（pressed / disabled / cooldown / ready）、`--ui-*` の意味色 6 種、剣士の大剣シルエット（Attack / Weapon Badge） |
| 再設計 | Ultimate（八芒星を廃止し §5 から選ぶ）、Heal（十字 → §6）、Skill 1（下向き矢印 → 切り下がり）、Skill 2（断たれた円 → 水平の崩し）、Attack の斬撃の弧（16px では省く） |
| 廃止 / 引き継がない | C2 の Weapon Badge が kit（剣士）経由で大剣を出す仕組み（`uiProtoWeaponIcon(weaponKey)`。影の旅人でも greatsword になる）、八芒星、C2 の見本オーバーレイ（`15-ui-proto.js` / `ui-proto.css`）を本番の仕組みとして使うこと（見本は C2 に残す）、`uiProtoIcon` の名前体系 |
| 未定 | C2 ブランチ自体を main へ入れるか（HDE-E8） |

## 12. D / E boundary

| E で決める | E で決めない（D または別 Task） |
| --- | --- |
| アイコンの形（外形・モチーフ・LOD）、SVG の形式、状態の見た目の規則、Weapon Badge の武器モチーフ | HUD の位置、ボタンサイズ、PC / touch のレイアウト、HUD の表示条件（D1）、Weapon Badge の位置・サイズ・「M」・同期（D1 / D2 / D4）、Action Zone のボタンの外形（D3）、Ultimate ゲージのロジック、MP 廃止（HD-D10）、844×390 の配置 |

- 接点: 本番 HUD にアイコンを入れる時期（HDE-E2）。E が「アイコン資産と規則」だけを作り、HUD への適用を D3 / D4 に任せる案と、E が現行 HUD の emoji を差し替える案がある。

## 13. Work Items

| ID | Summary | 依存 | 主な成果 |
| --- | --- | --- | --- |
| W-E1 | 共通外形（L1）4 種と LOD 規則 | HDE-E4 | `ui-icon-shapes.js`、LOD の class 規則、unit |
| W-E2 | Ultimate 外形の試作比較（§5 の 2〜4 案）と撮影 | W-E1 | 比較用の見本（開発用 URL 限定、C2 と同じ方式）と撮影。Human が HDE-E1 を決める |
| W-E3 | Heal 案の試作比較（§6）と撮影 | W-E1 | 同上。Human が HDE-E7 を決める |
| W-E4 | 剣士のモチーフ（大剣・切り下がり・崩し斬り・渾身の斬撃） | W-E1、HDE-E1 | `ui-icon-motifs.js`（剣士分）と撮影 |
| W-E5 | 魔法使い・弓師・盗賊・影の旅人のモチーフ（影の旅人は §4.5 の候補。HDE-E6 / E14 次第で仮モチーフ） | W-E4、HDE-E6、HDE-E14 | 同（残り 4 人分） |
| W-E6 | Weapon Badge の武器モチーフ 4 種（Attack モチーフの再利用） | W-E4 / W-E5 | 14 / 16px の撮影 |
| W-E7 | アイコンの組み立て（キャラクター × 操作 → SVG）と表 | W-E4〜W-E6 | `ui-icon-set.js`、unit（25 の組み合わせすべて） |
| W-E8 | 状態表現の共通 CSS（HDE-E10 で E に含める場合） | W-E7 | 状態 class と撮影（グレースケール含む） |
| W-E9 | `ui-icons.js`（C1 の対応表）と正式アイコンの対応付け | W-E7 | 対応表の更新、unit |
| W-E10 | 検証（DPR 1 の 16 / 20 / 24px、グレースケール、文字なし）と Test Report | W-E1〜W-E9 | 撮影一式、unit / E2E の結果 |

- 本番 HUD への適用（emoji の置換）は、HDE-E2 の結果により W-E11 として追加するか、D3 / D4 に回す。

## 14. Dependencies

- 本計画の Artifact Handoff（Human が 1 ファイル 1 commit で remote に置く）
- HDE-1〜3 を含む E Task file の Persistence（作業ツリー上に未 commit）
- C2 の意味色 token の main への取り込み方（HDE-E8）
- D: WI-D1（APPROVED・未着手）とは直接の依存なし。本番 HUD への適用（HDE-E2）を E で行う場合は D3 / D4 と順序を決める
- UI-002-D の未 commit 変更の Persistence（Decision record が同じファイルのため、V-1〜V-7 の転記と合わせて）

## 15. Tests / verification plan

| 種類 | 内容 |
| --- | --- |
| unit | 全アイコンが `viewBox="0 0 24 24"` の SVG / ASCII のみ / 色を書かない / 25 の組み合わせすべてが組み立てられる / 影の旅人の Attack・Skill 1・Skill 2・Ultimate・Weapon Badge が剣士の形（大剣・剣技）を含まない / LOD の class が付いている / 外形 4 種が互いに異なる |
| E2E | 開発用 URL の比較見本（W-E2 / W-E3）が通常 URL で出ない。本番 HUD に適用する場合は、既存の HUD の id・可視判定を読む spec（`chapter1-legacy-ui` 等）が通る |
| 撮影（Visual） | DPR 1 の 16 / 20 / 24px（等倍＋8 倍拡大）、グレースケール、文字を隠した表示、5 人分の一覧、Ultimate の Not Ready / Ready、Weapon Badge の 14 / 16px |
| 判定 | 形だけで「操作の種類」が分かるか・「どの技か」が分かるかを **Human が撮影で判断**（AI の自己チェックは参考） |
| 回帰 | build / unit 全件 / Targeted E2E。既存 FAIL（mansion-escort、execution-break）・FLAKY（job-traits）の分類は変えない |

## 16. Human Decisions required before implementation

| # | 判断事項 | 候補 |
| --- | --- | --- |
| HDE-E1 | Ultimate の外形 | U-1〜U-4（§5）。W-E2 の撮影後に決める |
| HDE-E2 | 本番 HUD への適用時期 | E で emoji を置換（W-E11）/ E は資産と規則のみ、適用は D3・D4 |
| HDE-E3 | SVG の形式 | S-1 インライン / S-2 sprite / S-3 ファイル（§8.1） |
| HDE-E4 | 共通外形の系統 | F-A（C2 継承）/ F-B（盾形系）（§3.2） |
| HDE-E5 | Skill 1 と Skill 2 の外形上の区別 | モチーフだけ / 外形の小さな印（切り欠き 1・2 か所）/ 番号以外の別の印 |
| HDE-E6（改訂） | 影の旅人のモチーフの方向 | §4.5 の候補から選ぶ / 別案。前提: 剣・大剣・剣撃を使わない（Human 確定） |
| HDE-E14（新設） | 影の旅人の Skill 1 / Skill 2 / 影送りの技の内容（OQ-W1〜W3）をどこで決めるか | 技の内容を別 Task（ゲームデザイン）で決めてからアイコン化 / E では仮モチーフで作り、技の確定後に差し替え |
| HDE-E15（新設） | 影の旅人の Weapon Badge の絵柄 | 素手 / 手＋影 / 影そのもの / Badge 用の絵柄を用意しない（表示条件は D） |
| HDE-E7 | Heal の回復形状と共通化 | H-1〜H-4（§6）、全員共通 1 種 / キャラクター別 |
| HDE-E8 | C2 の意味色 token を main へ入れる方法 | C2 ブランチを main へ merge / E で同じ定義を入れる |
| HDE-E9 | 職業色を icon accent に使うか | 使う（キャラクター定義から）/ 使わない |
| HDE-E10 | 状態表現の共通 CSS と既存 Ultimate パルスの扱い | E で状態 class を用意 / D3 で用意。パルス停止は E / D3 |
| HDE-E11 | §4 の技固有モチーフ候補（特に剣士の切り下がり・崩し斬り・渾身の斬撃） | 候補どおり試作 / 修正して試作 |
| HDE-E12 | 比較見本（W-E2 / W-E3）の表示方法 | C2 と同じ `?dev=1&…` 限定の見本 / 撮影専用ページ（リポジトリ外） |
| HDE-E13 | Persistence（実装ブランチ名・commit / push の許可） | 例 `claude/ui-002-e-impl` |

## 17. Files To Change（案。Human Approval で確定）

| File | 内容 | WI |
| --- | --- | --- |
| `src/core/ui-icon-shapes.js`（新規） | 外形 4 種 | W-E1 |
| `src/core/ui-icon-motifs.js`（新規） | 技・武器モチーフ | W-E4〜W-E6 |
| `src/core/ui-icon-set.js`（新規） | 組み立てと表 | W-E7 |
| `src/core/ui-icons.js` | 正式アイコンへの対応付け | W-E9 |
| `src/styles/ui-icons.css`（新規）と `src/styles/main.css`（import 1 行） | LOD・状態の CSS | W-E1 / W-E8 |
| `src/styles/tokens.css` | 意味色 6 種（HDE-E8 で E に入れる場合） | — |
| 比較見本（HDE-E12 で開発用 URL 限定を選ぶ場合）: `src/legacy/parts/15-…`（新規）と `src/core/dev-ui.js` | W-E2 / W-E3 |
| `tests/unit/ui-icon-*.test.js`（新規） | unit | W-E10 |
| `tests/*.spec.js`（新規。見本のゲート） | E2E | W-E10 |
| （HDE-E2 で E が適用する場合）`index.html` / `12-progression-ui.js` / `14-hud-boot.js` | emoji の置換 | W-E11 |

## 18. Out of Scope

- HUD の位置・ボタンサイズ・PC / touch のレイアウト・HUD 配置・HUD の表示条件（D）
- Weapon Badge の位置・サイズ・「M」・同期（D1 / D2 / D4）
- MP 廃止そのもの（HD-D10）
- Ultimate ゲージのゲームロジック
- 技の性能・モーション・VFX・戦闘ロジック
- C2 実装コードの修正（R-1 / N-1 / N-2 を含む）
- トースト・ログ・メニュー・鑑定所の emoji、3D 空間内の表示、ミニマップの Canvas（E Task の Out of Scope。範囲の拡大は別途 Human が判断）
- Chapter 2 以降のキャラクター・技・上位職の武器（拡張できる構造だけ用意する）

## 19. 変更したファイル

- `.ai/reports/UI-002-E-plan.md`（新規、本ファイル）のみ。commit / push はしていない。

## 20. 影の旅人の再調査（FACT、2026-09-29 改訂時）

| # | 調査項目 | FACT | 根拠 |
| --- | --- | --- | --- |
| 1 | Attack の攻撃表現 | 攻撃処理・判定・モーションは剣士の kit のまま。武器メッシュだけ `visible=false`（見た目は素手）。素手・影の攻撃演出は未実装 | `06-player-enemy.js:2017-2020, 2212`、`docs/CHARACTERS.md`「影の旅人の武器」 |
| 2 | Skill 1 の技内容 | 影の旅人専用の定義は無い。classDef の key が kit の `warrior` になるため、剣士の Skill 1（切り下がり）が使われる | `12-progression-ui.js:1745-1746`、`chapter1-rules.js:42-53` |
| 3 | Skill 2 の技内容 | 同上。剣士の Skill 2（崩し斬り）が使われる | `12-progression-ui.js:2341-2344` |
| 4 | Ultimate「影送り」 | `{name:'影送り', icon:'◐', cd:20, radius:4.2, mult:3.2, vfxColor:0x8a5ad6}`。cd・radius・mult は剣士の渾身の斬撃と同じ値で、違うのは名前・icon・VFX の色（紫）。影送り固有の演出コードは見つからない（`wanderer` / `charKey` を ult・combat のコードで検索） | `01-character-creation.js:27, 114` |
| 5 | 武器を持たないことを示す定義 | 専用の武器定義は無い（`WEAPON_TYPES` に wanderer の行が無い）。見た目の非表示は T-4 の Human Decision（「最終的に素手の想定」）。classDef は `kit:'warrior'` を土台に組まれる | `11-combat-actions.js:104-127`、`06-player-enemy.js:2017-2020`、`01-character-creation.js:107` |
| 6 | 影・残像・手などの既存モチーフ | 酒場の NPC の足元の「影だまり」（紫がかった円、`0x2a1a3a`）と紫の点光源（`0x8a5ad6`）。影 VFX・足元リングの紫は `CLASSES.wanderer.trim` `0x8a5ad6`。肖像・Ultimate の記号は `◐`。残像・手の既存モチーフは見つからない | `03-dungeons-mansion-temple.js:2030, 2061-2069`、`player-palette.js:74-80`、`01-character-creation.js:107-114` |
| 7 | V / T-5 / T-7 の視覚仕様 | T-5: 配色（コート Charcoal `#30323A`、パンツ Dark Purple `#403454`、マフラー `#A3B1BF`、シャツ `#D8D4D0`、金具 Shadow Purple `#654F86`。影の演出の紫 `0x8a5ad6` とは別）、全身黒にしない（P-D8）。T-2: BUILD は剣士（DEC-T2-10 (a)）。T-4: 形状は W-a、武器は見た目だけ非表示。V（V-1〜V-7）に影の旅人専用の記述は無い（V-5 の職業例にも無い） | `docs/CHARACTERS.md:143-175`、`.ai/tasks/CHARACTER-VIS-001.md:128-140, 674-680, 1002-1021`、`.ai/tasks/UI-002-V.md` |
| 8 | docs の食い違い | `docs/CHARACTERS.md` の「5人目」の節は「戦闘には一切関わらない・専用クラス未実装」のまま、プレイアブル化の実装と食い違っている（HDR-T4-10 で未修正）。専用クラス・武器・戦闘スタイルは「未確定」 | `docs/CHARACTERS.md:102-125, 174-176` |

- 結論（INFERENCE ではなく記録の整理）: 影の旅人の「素手＋影」「影の技」「影送り」は Human の確定情報として扱う。ソースと docs には、その具体的な中身（技の名前・効果・演出）が無い。したがってアイコンのモチーフは候補にとどめ、技の内容は OQ-W1〜W3 とする。
