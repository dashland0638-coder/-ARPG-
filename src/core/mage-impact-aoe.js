// 基本魔法使い(mage)のCombat Identity: Impact AoE(ARPG Base Class
// Identity強化 Phase 2)。
//
// 「敵の配置・集団を見て撃つ」ことを報酬化する ―― 通常攻撃(Projectile)が
// 敵に命中した瞬間、命中点の周辺にいる別の敵も巻き込む。中心の敵は
// これまでどおり100%のダメージ(単体戦の火力は変えない)、周辺の敵は
// 減衰したダメージを受ける「案A」方式(このファイルのコメント末尾参照)。
//
// 半径は既存のCharge Orb(魔法使いの溜め技「巨大魔弾」、13-update-
// loop.jsのspawnChargeOrb、orbRadius:1.6)より明確に小さくしてある。
// 溜め技の方が「狙って発動する大きなAoE」であるべきで、通常攻撃の
// Impact AoEがそれと同格・それ以上になると溜め技の存在意義を薄めて
// しまうため。Arena Dummyの標準スポーン間隔(横スプレッド2.6、
// arenaSpawn()、07-ai-combat.js)よりも小さく、敵の当たり判定半径
// (Dummyのhit Radius実測0.43)よりは明確に大きい値として1.2を選んだ
// ―― 「適当に撃てば毎回複数ヒットする」ほど広くはせず、敵が密集して
// いる時だけ意味を持つ範囲にしてある。
export const MAGE_IMPACT_AOE_RADIUS = 1.2;

// 周辺Targetのダメージ倍率。既存のSphere Board Skill「連鎖雷撃」
// (chain、12-progression-ui.js、chainMul:0.6)が持つ「2体目は6割の
// ダメージ」という前例にそのまま揃えた ―― 新しい倍率を作らず、この
// ゲームが既に持つ「副次的な一撃は6割」という感覚に合わせている。
export const MAGE_IMPACT_AOE_SPLASH_MUL = 0.6;

// 中心の命中点(impact point)から見て、その敵が半径内かどうかを判定し、
// 内側ならsplashダメージ(四捨五入)を、外側なら0を返す。
// distFlat: 命中点から敵までの水平距離(呼び出し側で高さは別途チェック
// 済みの前提。既存のp.isChargeOrbと同じ「水平距離のみで判定」方式に
// 合わせてある)。
// primaryDmg: 中心の敵が実際に受けたダメージ量(この値のsplashMul倍を返す)。
//
// 中心Enemy自身の除外や、生存確認(en.dead)・対象の有無といった判定は
// 呼び出し側(13-update-loop.js updateProjectiles())の責務 ―― これらは
// enemies配列やオブジェクト同一性に依存する副作用のある判定であり、
// この関数はTHREE.js/stateに依存しない純粋な数値計算だけを持つ。
export function mageImpactAoeDamage(distFlat, primaryDmg, radius = MAGE_IMPACT_AOE_RADIUS, splashMul = MAGE_IMPACT_AOE_SPLASH_MUL) {
  // typeof チェックを先に置く: null/undefinedは >= 0 の比較で0扱いに
  // 化けてしまう(null>=0はtrue)ため、数値であることを先に確認する
  if (typeof distFlat !== 'number' || Number.isNaN(distFlat)) return 0;
  if (distFlat < 0 || distFlat > radius) return 0;
  return Math.round((primaryDmg || 0) * splashMul);
}

/* 案A(中心100% / 周辺60%)を採用した理由:
   ユーザー指示(Phase 2指示 6章)の第一候補どおり、単体戦のダメージを
   一切変えず(中心Targetは今までのdealDamageToEnemy(en, p.dmg, ...)の
   ままで、AoE追加前と完全に同じ)、複数の敵が実際に近くにいる場合だけ
   合計火力が伸びる形にしている。案B(中心・周辺同一ダメージだが半径を
   極小にする)は「単体でも近づけば必ず得」という設計になり、狙って
   1v1で使っても弓師と同等以上になりかねないため見送った。 */
