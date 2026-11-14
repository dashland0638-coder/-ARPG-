/* 幽霊船・時計塔の敵(ENEMY-VISUAL-001)。

   ■ 位置づけ
   森の洋館(core/mansion-enemies.js)と同じ作り。このファイルは「二つのダンジョンの敵の数値と判断」
   だけを持つ純粋モジュールで、state / three.js / scene に依存しない。実際に敵を動かす副作用は
   07-ai-combat.js(近接の状態機械)と 16-foes-sea-clock.js(見た目・固有の AI)にある。
   近接の敵は既存の器(core/enemy-profiles.js の defineMeleeProfile)に登録し、
   予兆(punish-window)・体幹・崩し・処刑・正面耐性は既存の共通経路に乗る。

   ■ 二つの世界観を混ぜない
     幽霊船「海の呪いと亡霊」  … 藍・青白い霊光・錆・古い木・腐敗の緑紫。浮く・崩れる・這う・重く引きずる
     時計塔「機械と時間の歪み」… 黒鉄・真鍮・古い金・紫・琥珀・淡い青白。規則正しく刻む・止まる・巻き戻る・残像
   共通の約束: 外見から攻撃が分かる(武器・腕・機構の形)。大振りは床に外周の弧(既存)。HP を盛らない。

   ■ 三段階
     通常種(normal) … 基本の行動と攻撃
     強化種(elite)  … 同じ敵の strongMob(大きく・予兆は同じで隙が短く・大怯みで止まらない)。既存の strongMob の仕組み
     変異種(mutant) … 外見・モーション・攻撃のどれかが変わる別の戦い方(残像の連撃・錨の投擲・狙いが三つ…)
====================================================================== */
import { defineMeleeProfile } from './enemy-profiles.js';

/* ---------------------------------------------------------------------
   近接の攻撃表(core/enemy-profiles.js の形)。追加の項目(このファイルで足した器の拡張):
     lunge          振り抜く間に前へ踏み込む距離(突進。判定は踏み込んだ先の位置から測る)
     followUp       振り抜いた後、すぐ続けて出す攻撃のキー(連撃。予兆は短いが必ず見せる)
     telegraphReach 床の弧の半径(踏み込みのぶん判定より遠くまで描く)
   プロファイルの追加:
     telegraphAll   light にも床の弧を出す(全周の振り回し・遠くまで届く突きなど、見ないと避けられない light)
--------------------------------------------------------------------- */

// ---- 幽霊船 ----------------------------------------------------------
export const PHANTOM_SAILOR_ATTACKS = {
  // 錆びた舶刀の一太刀。刃を引く短い予兆
  slash: { key:'slash', telegraph:0.42, active:0.14, recovery:0.46, reach:2.0,
           damageMul:1.0, halfAngle:0.95, hold:0, sfx:'slashLight', shake:0.08 },
  // 踏み込み: 刃に青白い光が集まる → 一瞬だけ実体化して滑るように詰める → 霧になって崩れる(長い隙)
  lunge: { key:'lunge', telegraph:0.72, active:0.24, recovery:0.92, reach:1.9, lunge:2.1, telegraphReach:4.0,
           damageMul:1.15, halfAngle:0.42, hold:0.3, sfx:'slashDraw', shake:0.12 },
};
export const PHANTOM_ECHO_ATTACKS = {
  slash: Object.assign({}, PHANTOM_SAILOR_ATTACKS.slash, { telegraph:0.36 }),
  // 変異: 踏み込みの後、残像を連れてもう一度(二度目の予兆は短いが、必ず刃が光る)
  lunge: Object.assign({}, PHANTOM_SAILOR_ATTACKS.lunge, { telegraph:0.70, recovery:0.40, followUp:'relunge' }),
  relunge: { key:'relunge', telegraph:0.40, active:0.22, recovery:1.05, reach:1.9, lunge:1.8, telegraphReach:3.7,
             damageMul:0.9, halfAngle:0.42, hold:0.2, sfx:'slashDraw', shake:0.10 },
};
export const DROWNED_SAILOR_ATTACKS = {
  // 水を吸った腕を振り上げて、身体ごと叩き落とす。重い予兆・長い隙
  smash: { key:'smash', telegraph:0.82, active:0.20, recovery:0.92, reach:2.3,
           damageMul:1.3, halfAngle:0.62, hold:0.26, sfx:'gsOverhead', shake:0.18 },
  // 引き寄せる薙ぎ: 腰を落として大きく横へ。広いが、振り抜いた後はよろめく
  haul:  { key:'haul', telegraph:1.10, active:0.28, recovery:1.25, reach:3.4,
           damageMul:1.2, halfAngle:1.85, hold:0.3, sfx:'slashHeavy', shake:0.2 },
};
export const ANCHOR_DROWNED_ATTACKS = {
  // 錨を身体の周りで一周振り回す(全周。床に弧を出す)
  swing: { key:'swing', telegraph:0.95, active:0.30, recovery:1.0, reach:2.8,
           damageMul:1.25, halfAngle:3.1, hold:0.25, sfx:'chainRattle', shake:0.2 },
  // 錨の投擲: 鎖ごと前へ一直線。遠くまで届くが細い。投げた後は鎖を手繰る長い隙
  throw: { key:'throw', telegraph:1.20, active:0.30, recovery:1.5, reach:6.2,
           damageMul:1.4, halfAngle:0.2, hold:0.3, sfx:'chainRun', shake:0.24 },
};

// ---- 時計塔 ----------------------------------------------------------
export const GEAR_SOLDIER_ATTACKS = {
  // 針の刃の突き。規則正しい一拍
  jab:   { key:'jab', telegraph:0.46, active:0.14, recovery:0.50, reach:2.1,
           damageMul:1.0, halfAngle:0.7, hold:0, sfx:'swing', shake:0.08 },
  // ゼンマイの溜め: 胸の歯車が回り上がる → 止まった一瞬 → 叩きつける。振った後は機構が止まって再起動(長い隙)
  wind:  { key:'wind', telegraph:1.05, active:0.24, recovery:1.30, reach:2.9,
           damageMul:1.5, halfAngle:1.15, hold:0.35, sfx:'gsOverhead', shake:0.2 },
};
export const GEAR_SPRINTER_ATTACKS = {
  // 変異(高速型): 回転機構を増設。突きが三連(二の突き・三の突きは短い予兆)
  jab:   Object.assign({}, GEAR_SOLDIER_ATTACKS.jab, { telegraph:0.36, recovery:0.24, followUp:'jab2' }),
  jab2:  { key:'jab2', telegraph:0.24, active:0.12, recovery:0.22, reach:2.1, damageMul:0.7, halfAngle:0.7, hold:0,
           sfx:'swing', shake:0.06, followUp:'jab3' },
  jab3:  { key:'jab3', telegraph:0.28, active:0.14, recovery:0.95, reach:2.2, damageMul:0.9, halfAngle:0.8, hold:0,
           sfx:'swing', shake:0.08 },
  // 回転突進: 脚の歯車が唸る → 踏み込んで回る
  spin:  { key:'spin', telegraph:0.80, active:0.30, recovery:1.10, reach:1.8, lunge:2.6, telegraphReach:4.4,
           damageMul:1.2, halfAngle:1.4, hold:0.3, sfx:'slashSpin', shake:0.14 },
};
export const CLOCK_GUARDIAN_ATTACKS = {
  // 長針の突き: 正面へ遠く、細い(横へ外せば当たらない)。床に線を出す
  thrust:   { key:'thrust', telegraph:0.86, active:0.20, recovery:0.92, reach:3.7,
              damageMul:1.35, halfAngle:0.3, hold:0.3, sfx:'gsChargeRelease', shake:0.16 },
  // 振り子の大回転: 胴の振り子を全周へ。予兆が一番長く、隙も一番長い(背後へ回る好機)
  pendulum: { key:'pendulum', telegraph:1.25, active:0.32, recovery:1.40, reach:3.3,
              damageMul:1.25, halfAngle:3.1, hold:0.3, sfx:'slashSpin', shake:0.24 },
};

/* 器へ登録。旋回の遅さ・索敵距離・呼吸は役割ごと */
defineMeleeProfile('phantomSailor', { attacks:PHANTOM_SAILOR_ATTACKS, light:'slash', heavy:'lunge',
  heavyCooldown:3.2, attackCooldown:0.80, detectRange:8.5, approachFactor:0.85 });
defineMeleeProfile('phantomEcho', { attacks:PHANTOM_ECHO_ATTACKS, light:'slash', heavy:'lunge',
  heavyCooldown:3.6, attackCooldown:0.75, detectRange:9.5, approachFactor:0.85 });
defineMeleeProfile('drownedSailor', { attacks:DROWNED_SAILOR_ATTACKS, light:'smash', heavy:'haul',
  heavyCooldown:3.8, attackCooldown:1.20, detectRange:8.0, approachFactor:0.80 });
defineMeleeProfile('anchorDrowned', { attacks:ANCHOR_DROWNED_ATTACKS, light:'swing', heavy:'throw',
  heavyCooldown:4.2, attackCooldown:1.25, detectRange:9.5, approachFactor:0.70, telegraphAll:true });
defineMeleeProfile('gearSoldier', { attacks:GEAR_SOLDIER_ATTACKS, light:'jab', heavy:'wind',
  heavyCooldown:3.6, attackCooldown:0.95, detectRange:8.5, approachFactor:0.85 });
defineMeleeProfile('gearSprinter', { attacks:GEAR_SPRINTER_ATTACKS, light:'jab', heavy:'spin',
  heavyCooldown:3.4, attackCooldown:0.85, detectRange:9.5, approachFactor:0.85 });
defineMeleeProfile('clockGuardian', { attacks:CLOCK_GUARDIAN_ATTACKS, light:'thrust', heavy:'pendulum',
  heavyCooldown:4.6, attackCooldown:1.25, detectRange:10, approachFactor:0.75, telegraphAll:true });

/* ---------------------------------------------------------------------
   固有の AI を持つ敵(近接の器に乗らない)。秒数と半径はここ、動かすのは 16-foes-sea-clock.js
--------------------------------------------------------------------- */
/* 深海の異形: 床を這い、間合い(4〜8)を保つ。プレイヤーの今いる所の床に輪 → 1 秒後に触手が突き上がる。
   近づかれたら長い腕で薙ぐ(床に弧)。変異種は輪が三つ(今いる所と、動く先)で、輪が大きい */
export const ABYSS = {
  keepNear: 4.0, keepFar: 8.0, detect: 10.5, crawlMul: 1.0,
  spike: { telegraph: 1.0, radius: 1.3, active: 0.18, recovery: 0.9, cooldown: 2.8, damageMul: 1.1, range: 9.0 },
  lash:  { telegraph: 0.62, reach: 2.4, halfAngle: 1.2, active: 0.16, recovery: 0.8, cooldown: 1.6, damageMul: 1.0 },
};
export const ABYSS_MUTANT = {
  keepNear: 4.0, keepFar: 8.5, detect: 11.5, crawlMul: 1.1,
  spike: { telegraph: 1.05, radius: 1.6, active: 0.18, recovery: 1.1, cooldown: 3.4, damageMul: 1.0, range: 9.5, count: 3, lead: 2.6 },
  lash:  { telegraph: 0.62, reach: 3.1, halfAngle: 1.3, active: 0.18, recovery: 0.85, cooldown: 1.6, damageMul: 1.05 },
};
/* 触手の輪の置き場所(副作用なし)。count=1 はプレイヤーの今いる所だけ。3 は今いる所と、
   向いている(動いている)向きの左右前方へ lead ずつ ―― 「動けば避けられる」を一つだけ残すための配置 */
export function abyssSpikeTargets(px, pz, moveYaw, spec){
  const out = [{ x: px, z: pz }];
  const n = spec.count || 1;
  if (n <= 1) return out;
  const lead = spec.lead || 2.5;
  [-0.6, 0.6].forEach(da => {
    out.push({ x: px + Math.sin(moveYaw + da) * lead, z: pz + Math.cos(moveYaw + da) * lead });
  });
  return out;
}
/* 時間の残響: 半透明で漂う(ときどき動きが巻き戻る)。近づくと、今いる所に残像(床の輪)を残して消え、
   プレイヤーの横に現れて一太刀(床に弧)。残像は消えてから delay 秒後に弾ける(輪の中だけ当たる。
   見た目だけの霧と当たりの輪を分ける)。変異種(分身)は、斬った場所にもう一つ残像を残し、
   少し遅れて同じ一太刀をなぞる(時間差攻撃。弧は先に出る) */
export const TIME_ECHO = {
  detect: 8.5, blinkRange: 6.0, cooldown: 3.2, fade: 0.40, appearDist: 2.3,
  burst: { delay: 1.25, radius: 1.45, damageMul: 0.9 },
  slash: { telegraph: 0.55, reach: 2.2, halfAngle: 0.95, active: 0.15, recovery: 0.85, damageMul: 1.0 },
  rewindEvery: 2.6, rewindSec: 0.5,
};
export const TIME_ECHO_TWIN = Object.assign({}, TIME_ECHO, {
  cooldown: 3.6, replay: { delay: 0.85, damageMul: 0.8 },
});

/* ---------------------------------------------------------------------
   敵の台帳(資料・試験・配置が読む)。役割・得意距離・速さ・攻撃の頻度と範囲・予兆・隙・対処・組み合わせ
--------------------------------------------------------------------- */
export const FOE_SPECS = {
  // 幽霊船
  phantomSailor: { dungeon:'ghostship', name:'亡霊船員', tier:'normal', role:'attacker', ai:'servant', melee:'phantomSailor',
    range:'近〜中(2〜4)', speed:2.3, tell:'刃を引き、青白い光が集まる', punish:'踏み込みの後、霧に崩れる 0.9 秒',
    counter:'光ったら横へ。踏み込みを空振らせて背中を斬る', pairs:'溺死した船員の後ろから踏み込む' },
  phantomEcho: { dungeon:'ghostship', name:'残像の亡霊', tier:'mutant', base:'phantomSailor', role:'attacker', ai:'servant', melee:'phantomEcho',
    range:'中(〜4)', speed:3.0, tell:'刃の光＋残像', punish:'二度目の踏み込みの後 1.05 秒',
    counter:'一度目を避けても二度目が来る。二度目を避けてから斬る', pairs:'異形の輪に追い込む' },
  drownedSailor: { dungeon:'ghostship', name:'溺死した船員', tier:'normal', role:'tank', ai:'servant', melee:'drownedSailor',
    range:'近〜中(2〜3.5)', speed:1.35, tell:'腕を振り上げる／腰を落として身体をひねる', punish:'叩きつけの後 0.9 秒、薙ぎの後よろめき 1.25 秒',
    counter:'大振りを下がって空振らせ、よろめきに差し込む', pairs:'前衛。亡霊船員・異形の盾になる' },
  anchorDrowned: { dungeon:'ghostship', name:'錨を引く溺死船員', tier:'mutant', base:'drownedSailor', role:'tank', ai:'servant', melee:'anchorDrowned',
    range:'近(全周 2.8)／遠(一直線 6.2)', speed:1.25, tell:'錨を肩に担ぐ／鎖を手繰って構える', punish:'投擲の後 1.5 秒(鎖を手繰る)',
    counter:'近くでは全周を一歩下がって外す。遠くでは一直線を横へ外して詰める', pairs:'甲板長(号笛で亡霊を呼ぶ)' },
  abyssCrawler: { dungeon:'ghostship', name:'深海の異形', tier:'normal', role:'range', ai:'abyss',
    range:'中〜遠(4〜9)', speed:1.6, tell:'背の甲殻が割れ、腕を床に突き立てる → 足元に輪', punish:'突き上げの後 0.9 秒',
    counter:'輪が出たら外へ。近づけば長い腕の薙ぎ(弧)が来るので、薙ぎの後に斬る', pairs:'前衛の後ろから足元を狙う' },
  abyssMutant: { dungeon:'ghostship', name:'変異した異形', tier:'mutant', base:'abyssCrawler', role:'range', ai:'abyss',
    range:'中〜遠(4〜9.5)', speed:1.75, tell:'甲殻が大きく開き、輪が三つ', punish:'突き上げの後 1.1 秒',
    counter:'輪の三つ目は動く先。止まるか、輪の無い向きへ', pairs:'亡霊の踏み込みと重ねてくる' },
  // 時計塔
  gearSoldier: { dungeon:'clocktower', name:'歯車機兵', tier:'normal', role:'attacker', ai:'servant', melee:'gearSoldier',
    range:'近〜中(2〜3)', speed:2.0, tell:'胸の歯車が回り上がり、止まる', punish:'叩きつけの後、機構が止まって再起動 1.3 秒',
    counter:'止まった一瞬を見て下がる。再起動の間に斬る', pairs:'時間の残響の消える間に詰めてくる' },
  gearSprinter: { dungeon:'clocktower', name:'回転機兵', tier:'mutant', base:'gearSoldier', role:'attacker', ai:'servant', melee:'gearSprinter',
    range:'近〜中(2〜4.4)', speed:3.1, tell:'脚の歯車が唸る／突きの拍が速い', punish:'三の突きの後 0.95 秒、回転の後 1.1 秒',
    counter:'三連突きは三つ目まで待つ。回転突進は横へ', pairs:'番人の陰から回り込む' },
  gearGunner: { dungeon:'clocktower', name:'機兵の射手', tier:'normal', role:'range', ai:'fire',
    range:'遠(〜13)', speed:1.0, tell:'肩のゼンマイ弓を引き絞る(溜め 0.7 秒)', punish:'撃った後',
    counter:'縦穴越しは弓師が射る。近ければ撃つ前に詰める', pairs:'縦穴の向こう岸から' },
  timeEcho: { dungeon:'clocktower', name:'時間の残響', tier:'normal', role:'tricky', ai:'echo',
    range:'中(〜6)', speed:1.9, tell:'今いる所に残像の輪を残して消える', punish:'一太刀の後 0.85 秒',
    counter:'残像の輪からすぐ離れる。横に現れた本体の弧を外して斬る', pairs:'機兵の溜めと重ねる。鐘ですくむ' },
  echoTwin: { dungeon:'clocktower', name:'分身する残響', tier:'mutant', base:'timeEcho', role:'tricky', ai:'echo',
    range:'中(〜6)', speed:2.0, tell:'残像の輪＋斬った所に二つ目の残像', punish:'なぞりの後',
    counter:'一太刀を避けた場所に留まらない(少し遅れて同じ弧が来る)', pairs:'鐘楼で射手と' },
  clockGuardian: { dungeon:'clocktower', name:'時計仕掛けの番人', tier:'elite', role:'tank', ai:'servant', melee:'clockGuardian',
    range:'近(全周 3.3)／中(正面 3.7)', speed:1.6, tell:'長針を引き絞る／振り子を後ろへ引く', punish:'大回転の後 1.4 秒',
    counter:'正面は硬い(正面耐性)。突きは横へ、大回転は外へ出てから背中を斬る', pairs:'回転機兵と' },
};

/* 三段階の差(試験が読む): 変異種は通常種と違う攻撃(キー)を少なくとも一つ持つ */
export function foeAttackKeys(melee){
  const t = { phantomSailor:PHANTOM_SAILOR_ATTACKS, phantomEcho:PHANTOM_ECHO_ATTACKS, drownedSailor:DROWNED_SAILOR_ATTACKS,
    anchorDrowned:ANCHOR_DROWNED_ATTACKS, gearSoldier:GEAR_SOLDIER_ATTACKS, gearSprinter:GEAR_SPRINTER_ATTACKS,
    clockGuardian:CLOCK_GUARDIAN_ATTACKS }[melee];
  return t ? Object.keys(t) : [];
}
