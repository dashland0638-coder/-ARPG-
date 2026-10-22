/* Scenario Test Mode の「開始地点」(WORK 4)。

   ■ なぜ要るのか
   ヘッドレス環境は実プレイの1割ほどの速度しか出ず、村の入口から船小屋まで
   歩くだけで数分かかる(WORK 3 で住宅・船小屋の実機確認ができなかった)。
   開発中のシナリオを検証するには、途中から始められる必要がある。

   ■ 宵待ちの村専用にしない
   シナリオキー → 地点の表として持ち、幽霊船や時計塔でも同じ形で足せる。
   地点が登録されていないシナリオは、今までどおり入口から始まる。

   ■ 本編には出さない
   参照するのは Scenario Test Mode だけ(01-character-creation.js /
   14-hud-boot.js)。通常のゲームUI・セーブ・進行には一切現れない。

   state・THREE・scene に依存しない(ARCHITECTURE.md の core/ の作法)。 */

export const SCENARIO_WAYPOINTS = {
  duskvillage: [
    {id:'entry',    name:'村の入口',   x:0,    z:294},
    {id:'plaza',    name:'中央広場',   x:0,    z:350},
    {id:'fish',     name:'魚屋',       x:-45,  z:348},
    {id:'homes',    name:'住宅',       x:45,   z:348},
    {id:'boat',     name:'船小屋',     x:-40,  z:311},
    {id:'market',   name:'商店街',     x:0,    z:386},
    {id:'yard',     name:'水門前',     x:0,    z:416},
    {id:'sluice',   name:'水門',       x:0,    z:446},
    {id:'deep',     name:'村の奥',     x:0,    z:466},
    /* ボス(村の残響、z:520)は 6 以内に近づくと名乗って戦いが始まる(07 updateBossAI)。
       bossgate は水鏡の跡の扉(z:500)の手前 = ボス戦直前。boss は 5 の距離なので、
       着いた瞬間に名乗りが始まる = ボス戦の開始(本編と同じ近づいた時の経路。
       ボスの状態は何も書き換えない)。TEST-CHAPTER-SELECT-001 */
    {id:'bossgate', name:'水鏡の跡の手前', x:0, z:495, kind:'boss-pre'},
    {id:'boss',     name:'水鏡の跡',   x:0,    z:515, kind:'boss-start'},
  ],
  // 道(WORK 11)。x は ROAD_X(14-dungeon-road.js)と同じ 640
  /* ボス戦直前・開始(TEST-CHAPTER-SELECT-001)。座標の根拠は .ai/reports/TEST-CHAPTER-SELECT-001-analysis.md。
     どれも本編でその場所へ着く時と同じ位置(階段の着地点など)で、進行フラグ・扉・ボスの状態には触らない。
     y を持つ地点は上の階(床の高さ)。持たないものは地面(y:0) */
  mansion: [
    // 当主の間の前室。地下の最深部からの階段の着地点と同じ。ボスは近づくと名乗る(扉なし)
    {id:'bossante', name:'当主の間の前室', x:80, z:137, kind:'boss-pre'},
    // ボス(80,166)から 5。着いた瞬間に名乗りが始まる
    {id:'bosshall', name:'当主の間',       x:80, z:161, kind:'boss-start'},
  ],
  ghostship: [
    // 船倉の階段の着地点。目の前の扉(調べると開く)の奥がボス。扉を開けるまでボスは動かない
    {id:'bosshold', name:'船倉の扉の前', x:-32, z:108, kind:'boss-pre'},
  ],
  clocktower: [
    // 5 階の控えの間(床 y:36)。4 階からの階段の着地点と同じ。西の扉の奥がボス
    {id:'bossante', name:'最上階の控えの間', x:-288, y:36, z:186, kind:'boss-pre'},
  ],
  temple: [
    // 試練の間の前室。ボスは近づくと名乗る(扉なし)
    {id:'bossante', name:'祭壇の前室', x:96, z:-119, kind:'boss-pre'},
  ],
  waterway: [
    // 最奥の扉の前(調べると開く)
    {id:'bossdoor', name:'最奥の扉の前', x:-104, z:-108, kind:'boss-pre'},
  ],
  conservatory: [
    // 母樹の間の扉の前の通路(調べると開く)
    {id:'bossdoor', name:'母樹の間の扉の前', x:226, z:61, kind:'boss-pre'},
  ],
  road: [
    {id:'sign',     name:'道標',       x:640,  z:12},
    {id:'bridge',   name:'小川の橋',   x:640,  z:52},
    {id:'rest',     name:'休憩所の手前', x:640, z:68},
  ],
};

export function waypointsFor(scenarioKey){
  return SCENARIO_WAYPOINTS[scenarioKey] || [];
}

export function findWaypoint(scenarioKey, id){
  const list = waypointsFor(scenarioKey);
  for(let i=0;i<list.length;i++) if(list[i].id === id) return list[i];
  return null;
}
