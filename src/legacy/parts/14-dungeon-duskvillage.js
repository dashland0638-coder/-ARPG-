// 新規7層目「宵待ちの村」(Phase D / #37)
// (14-dungeon-duskvillage.js - concatenated with the other src/legacy/parts/*.js
// files into one shared scope at build time; see src/legacy/concat-plugin.js)

     DUSK VILLAGE (Phase D / #37)
     新資料(敵・中ボス・ボスキャラクターデザイン刷新指示書 / ステージ・ダンジョン
     詳細実装仕様)が求める「灯りが怪異をこちらの世界へ引き出す」というステージを、
     実際のThree.js 3D構造(ROOMS+壁テーブルという他ダンジョンと同じ authoring
     パターン)へ翻訳して実装した。資料が明記する技術的優先順位
     (最優先: 1.夕暮れ→夜の色変化 2.灯り 3.灯りによる敵の出現 4.廃村マップ
      5.ボス 6.光によるボス怯み / 次点: 霧・水面・環境イベント・ランタン破壊・
      最終形態 / 余裕があれば: 複雑なライティング・動的天候)に従い、最優先の
     6項目を実装し、次点以降は簡略化・一部のみ実装している(詳細はコミット
     メッセージの「技術的妥協」参照)。

     マップ構造刷新(イメージ図準拠): 当初は広い長方形の部屋を線形に繋ぐ
     構成だったが、参考イメージ(蜘蛛の巣のように木の細道が水上に張り巡らされ、
     中央の広場だけ少し広い)に合わせて作り直した。太い部屋ではなく、
     細い桟橋(cor:true、幅4)で繋いだハブ(小さな足場、幅14)から
     左右に小屋(漁師の小屋/見張り台跡/民家A・B・C)へ分岐する構成にし、
     広い場所は最終エリアの商店街広場(ボス戦)だけに絞ってある。
     壁テーブルの authoring パターン自体は他ダンジョンと同じ(gaps宣言 +
     buildWalls())で、部屋を小さく・細くしただけなので、ロジック側の
     変更は最小限で済んでいる。水面はただの装飾(当たり判定なし)、
     桟橋の縁はaddLowRailBox(元々「水辺の境界」用に用意されていた
     ヘルパー)で縁取っている。
     どのファイルも前後のファイルとコメントの開き/閉じを跨いで連結される
     (concat-plugin.jsで単純結合されるため)ので、このファイル自身は
     このセクション見出しコメントで前のファイルの末尾コメントを閉じ、
     ファイル末尾で新しいセクション見出しコメントを開いて次のファイル
     (14-hud-boot.js)に閉じてもらう ―― 本文中に独立したブロックコメントを
     絶対に挟まないこと(挟むとこの閉じ開きの対応がずれて壊れる)
  ========================================================= */

  const DUSKVILLAGE_ENTRY = new THREE.Vector3(0, 0, 300);

  // 蜘蛛の巣状のレイアウト: 細い桟橋(cor:true、幅4)が縦の背骨として
  // 3つのハブ(桟橋の分岐/舫い場/役場裏口、いずれも幅14の小さな足場)を
  // 繋ぎ、各ハブから東西に細い桟橋がもう一本ずつ伸びて小屋(漁師の小屋・
  // 見張り台跡・民家A・民家B・民家C)へ至る。広い場所は商店街広場
  // (ボスエリア)だけ。gapsの数値は「繋ぐ相手の部屋のx0/x1(またはz0/z1)と
  // 一致させる」という他ダンジョンと同じ規約通りに、桟橋の幅(4、広場前後
  // のみ6)へ揃えてある
  const DUSK_ROOMS = [
    {id:'entry',    x0:-8,  x1:8,  z0:284, z1:308, cor:false, gaps:{N:[-2,2]}, name:'湖沼の入口'},
    {id:'pier1',    x0:-2,  x1:2,  z0:308, z1:338, cor:true,  gaps:{N:'full', S:'full'}, name:'桟橋'},
    {id:'hub1',     x0:-7,  x1:7,  z0:338, z1:352, cor:false, gaps:{S:[-2,2], N:[-2,2], W:[343,347], E:[343,347]}, name:'桟橋の分岐'},
    {id:'fishCor',  x0:-20, x1:-7, z0:343, z1:347, cor:true,  gaps:{E:'full', W:'full'}, name:'桟橋'},
    {id:'fisher',   x0:-34, x1:-20,z0:336, z1:354, cor:false, gaps:{E:[343,347]}, name:'漁師の小屋'},
    {id:'watchCor', x0:7,   x1:20, z0:343, z1:347, cor:true,  gaps:{E:'full', W:'full'}, name:'桟橋'},
    {id:'watch',    x0:20,  x1:34, z0:336, z1:354, cor:false, gaps:{W:[343,347]}, name:'見張り台跡'},
    {id:'pier2',    x0:-2,  x1:2,  z0:352, z1:382, cor:true,  gaps:{N:'full', S:'full'}, name:'桟橋'},
    {id:'hub2',     x0:-7,  x1:7,  z0:382, z1:396, cor:false, gaps:{S:[-2,2], N:[-2,2], W:[387,391], E:[387,391]}, name:'舫い場'},
    {id:'houseACor',x0:-20, x1:-7, z0:387, z1:391, cor:true,  gaps:{E:'full', W:'full'}, name:'桟橋'},
    {id:'houseA',   x0:-34, x1:-20,z0:380, z1:398, cor:false, gaps:{E:[387,391]}, name:'民家A'},
    {id:'houseBCor',x0:7,   x1:20, z0:387, z1:391, cor:true,  gaps:{E:'full', W:'full'}, name:'桟橋'},
    {id:'houseB',   x0:20,  x1:34, z0:380, z1:398, cor:false, gaps:{W:[387,391]}, name:'民家B'},
    {id:'pier3',    x0:-2,  x1:2,  z0:396, z1:426, cor:true,  gaps:{N:'full', S:'full'}, name:'桟橋'},
    {id:'hub3',     x0:-7,  x1:7,  z0:426, z1:440, cor:false, gaps:{S:[-2,2], N:[-2,2], W:[431,435]}, name:'役場裏口'},
    {id:'houseCCor',x0:-20, x1:-7, z0:431, z1:435, cor:true,  gaps:{E:'full', W:'full'}, name:'桟橋'},
    {id:'houseC',   x0:-34, x1:-20,z0:424, z1:442, cor:false, gaps:{E:[431,435]}, name:'民家C'},
    {id:'pier4',    x0:-2,  x1:2,  z0:440, z1:466, cor:true,  gaps:{N:'full', S:'full'}, name:'桟橋'},
    {id:'market',   x0:-8,  x1:8,  z0:466, z1:482, cor:false, gaps:{S:[-2,2], N:[-3,3]}, name:'商店街'},
    {id:'pier5',    x0:-3,  x1:3,  z0:482, z1:500, cor:true,  gaps:{N:'full', S:'full'}, name:'桟橋'},
    // 唯一「少し広くなっている」場所。とはいえ元の全長60より遥かに小さい
    {id:'square',   x0:-15, x1:15, z0:500, z1:536, cor:false, gaps:{S:[-3,3]}, name:'商店街広場'},
  ];

  // 昼夜進行(ALTITUDE_BANDSと同じ「進行度で色を補間する」手法を、高さでは
  // なくzの進み具合に置き換えて流用した)。z=284(入口)で夕焼け、
  // z=536(広場)で完全な夜になる
  const DUSK_BANDS = [
    {z:284, sky:0x3a2038, fog:0.014, sun:0xff9a5a, sunI:0.55, hemi:0.32, hemiSky:0x9a6a6a, hemiGnd:0x1e1420, rim:0xff8a4a, rimI:0.24, exp:0.82},   // 夕焼け
    {z:380, sky:0x261a3a, fog:0.020, sun:0xc07aa0, sunI:0.40, hemi:0.26, hemiSky:0x6a5a8a, hemiGnd:0x161022, rim:0x9a6ac0, rimI:0.22, exp:0.76},   // 薄暮/ブルーアワー
    {z:460, sky:0x141428, fog:0.028, sun:0x6a7ac0, sunI:0.24, hemi:0.18, hemiSky:0x3a4a7a, hemiGnd:0x0a0a16, rim:0x5a7ad0, rimI:0.20, exp:0.70},   // 夜
    {z:536, sky:0x080814, fog:0.036, sun:0x3a4a90, sunI:0.14, hemi:0.12, hemiSky:0x22305a, hemiGnd:0x06060c, rim:0x3a5ac0, rimI:0.18, exp:0.62},   // 完全な夜(ボス)
  ];

  let duskLanterns = [];
  let duskBossRef = null;
  let nearbyLantern = null;
  let duskSkyColor = null;

  // ---- 敵配置 ----
  // 常時見える濡れた村人(既存の'wraith'テーマ=フード付き・輪郭が曖昧、
  // という既存シルエットが「顔の見えない元村人」という資料の意図と
  // 噛み合うため、新規テーマは起こさずそのまま流用した)
  // モジュールスコープ(トップレベル)に置いているのは、07-ai-combat.jsの
  // spawnEnemies()から呼び出すため ―― 敵の生成とenemies配列への登録は
  // 全ダンジョン共通でspawnEnemies()が担う(spawnEnemiesForWorld()が
  // buildWorld()の中でdef.build()の直後に呼ばれ、その中でenemiesを
  // 一旦[]にリセットしてから_spawnWorldKeyに応じて詰め直すため、
  // build()側でenemies.pushしても直後に消されてしまう)
  function villager(x, z, extra){
    return buildEnemy(new THREE.Vector3(x,0,z), Object.assign(
      {color:0x3a4048, hp:210, atk:34, speed:1.9, atkType:'charge', xp:96, goldBonus:[20,30]}, extra));
  }
  // 灯りで初めて姿を見せる影の子供: villagerと同じ骨格を一回り小さくし、
  // 色を暗く沈めて「子供の影」の異質さを出した(資料の「灯りを当てると
  // 巨大な口が見える」という顔の作り替えまでは今回実装していない)
  function shadowChild(x, z){
    const en = buildEnemy(new THREE.Vector3(x,0,z),
      {color:0x140a1a, hp:150, atk:30, speed:2.6, atkType:'ghost', xp:88, goldBonus:[18,28]});
    en.group.scale.multiplyScalar(0.72);
    en.dormant = true; en.group.visible = false;
    return en;
  }
  // shadowChildをenemies配列とランタンのreveals配列の両方に登録する
  // (dormant中もupdateEnemies()やdealDamageToEnemy()から正しく扱われる
  // よう、enemies配列への所属が必須)
  function addDuskShadowChild(lantern, x, z){
    const en = shadowChild(x, z);
    enemies.push(en);
    if(lantern) lantern.reveals.push(en);
    return en;
  }

  // ---- ボス:宵影の群れ ----
  // spawnEnemies()から呼ばれ、生成したボスを返す(enemies.pushと
  // duskBossRefへの代入は呼び出し側=spawnEnemies()が行う)
  function buildDuskBoss(){
    const boss = buildBoss(new THREE.Vector3(0, 0, 524), {
      key:'duskCollective', bodyColor:0x1a1622, emissive:0x2a2438, eyeColor:0xd8ccc0, auraColor:0x5a4a70,
      hpMax:2600, atk:66, speed:1.9, xp:1150,
      bossDoorKey:'duskBossDoor',
      dialogueName:'宵影の群れ',
      ambushDialogueLines:[
        '闇の中で、無数の輪郭がざわめいた。',
        '灯りもないのに、踏み込むとは――'
      ],
      dialogueLines:[
        '広場の暗闇そのものが、ゆっくりと人の形へ寄り集まっていく。',
        '村人、商人、旅人……この村に残った、あらゆる未練が。',
        '……忘れられることで、私たちはまだ、ここにいられる。',
        'その灯りを、消してくれ――!'
      ],
      repeatDialogueLines:[
        '暗闇が、また輪郭を結び直す。',
        '……何度でも、ここに留まり続ける。忘れられてしまうまでは。',
        'さあ、灯りを消して。'
      ],
      clearName:'宵影の群れ',
      clearFlavor:'「……暗いのは……いや……」――光に包まれ、無数の輪郭が一つずつ消えていく。',
      rewardLoot:{type:'gem', name:'小さなランタンの欠片', icon:'💎', color:0xffb060}
    });
    boss.lightDimmed = true;   // 光を当てるまでは攻撃が一切通らない(dealDamageToEnemy参照)
    boss._dimHintCD = 0;
    return boss;
  }

  function buildDuskVillage(){
    duskLanterns = [];
    duskBossRef = null;

    const plankTex = makePlankTexture('#4a3a2a', 4, 6, 3);
    const plankMat = new THREE.MeshStandardMaterial({map:plankTex, roughness:0.85});
    const railMat  = new THREE.MeshStandardMaterial({color:0x2a2018, roughness:0.9});
    const houseMat = new THREE.MeshStandardMaterial({map:makePlankTexture('#241c16', 3, 5, 2), roughness:0.9});
    const roofMat  = new THREE.MeshStandardMaterial({color:0x1a1410, roughness:0.85});
    const waterMat = new THREE.MeshStandardMaterial({color:0x0a1a22, roughness:0.35, metalness:0.2,
      transparent:true, opacity:0.82, emissive:0x0a2a30, emissiveIntensity:0.1});

    const roomById = {};
    DUSK_ROOMS.forEach(r=> roomById[r.id] = r);

    // 水面: 全域を覆う一枚板。当たり判定はなく、桟橋の縁(addLowRailBox)の
    // 外に落ちても見た目としてそこに水がある、というだけの装飾
    const water = new THREE.Mesh(new THREE.PlaneGeometry(90, 270), waterMat);
    water.rotation.x = -Math.PI/2;
    water.position.set(0, -0.35, 410);
    scene.add(water);

    function buildWalls(r){
      function run(fixed, lo, hi, gap, vertical){
        if(gap === 'full') return;
        const parts = gap ? [[lo,gap[0]],[gap[1],hi]] : [[lo,hi]];
        parts.forEach(([a,b])=>{
          if(b-a <= 0.01) return;
          if(vertical) addLowRailBox(fixed, (a+b)/2, 0.6, b-a, railMat);
          else         addLowRailBox((a+b)/2, fixed, b-a, 0.6, railMat);
        });
      }
      run(r.z1, r.x0, r.x1, r.gaps.N, false);
      run(r.z0, r.x0, r.x1, r.gaps.S, false);
      run(r.x0, r.z0, r.z1, r.gaps.W, true);
      run(r.x1, r.z0, r.z1, r.gaps.E, true);
    }
    DUSK_ROOMS.forEach(r=>{
      addFloorWithHoles(r.x0, r.x1, r.z0, r.z1, [], plankMat, 0.08);
      buildWalls(r);
    });

    // ---- 家屋のシルエット(各小屋の足場の上に1棟ずつ) ----
    function house(x, z, w, d, h){
      addStaticBox(x, h/2, z, w, h, d, houseMat, true);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*0.72, h*0.55, 4), roofMat);
      roof.position.set(x, h + h*0.24, z);
      roof.rotation.y = Math.PI/4;
      scene.add(roof);
    }
    house(-27, 345, 7, 7, 3.8);   // 漁師の小屋
    house(-27, 389, 6, 6, 3.6);   // 民家A
    house(27,  389, 6, 6, 3.6);   // 民家B
    house(-27, 433, 6, 6, 3.6);   // 民家C
    house(-4,  472, 5, 5, 3.2);   // 商店街の廃店舗
    house(4,   476, 5, 5, 3.2);   // 商店街の廃店舗

    // 見張り台跡: 屋根のある小屋ではなく、崩れた塔の柱として立たせる
    // (「跡」という名前通り、他の小屋とはっきり見た目を分ける)
    const watchTower = new THREE.Mesh(new THREE.CylinderGeometry(1.6,2.0,5.5,8), houseMat);
    watchTower.position.set(27, 2.75, 345);
    watchTower.rotation.z = 0.06;
    watchTower.castShadow = true;
    scene.add(watchTower);
    walls.push({minX:27-1.8, maxX:27+1.8, minZ:345-1.8, maxZ:345+1.8});

    // ---- ランタン(最重要ギミック) ----
    // 消灯時は暗い柱にしか見えず、interact()で点けると:
    //  ・柱灯り自体が明るく灯る
    //  ・reveals に登録した眠っている(dormant)敵が目を覚ます
    // 資料の「灯りを消す/再び点けると別の場所に現れる」までは実装していない
    // (次点以降の演出のため今回は簡略化。TODO参照)
    function addLantern(x, z, reveals){
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,1.8,6),
        new THREE.MeshStandardMaterial({color:0x2a2018, roughness:0.8}));
      pole.position.set(x, 0.9, z); pole.castShadow = true; scene.add(pole);
      const lampMat = new THREE.MeshStandardMaterial({color:0x4a3a28, emissive:0x2a1a08, emissiveIntensity:0.15, roughness:0.5});
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22,10,8), lampMat);
      lamp.position.set(x, 1.95, z); scene.add(lamp);
      const light = new THREE.PointLight(0xffb060, 0, 10);
      light.position.set(x, 2.0, z);
      scene.add(light);
      const l = {pos:new THREE.Vector3(x,0,z), lit:false, lamp, lampMat, light, reveals:reveals||[]};
      duskLanterns.push(l);
      return l;
    }

    // 敵(村人・影の子供・ボス)はここでは生成しない ―― buildWorld()が
    // def.build()の直後に呼ぶspawnEnemiesForWorld()がenemies配列を
    // 一旦リセットしてしまうため、生成とenemies.pushはspawnEnemies()
    // (07-ai-combat.js、_spawnWorldKey==='duskvillage'の分岐)側で行う。
    // ここではランタンだけ先に用意しておき、spawnEnemies()がduskLanterns
    // 配列を参照してshadowChildをreveals配列へ後付けする
    addLantern(0, 345);    // 桟橋の分岐(hub1)中央の、最初の灯り
    addLantern(-27, 389);  // 民家Aの前
    addLantern(27, 389);   // 民家Bの前
    const marketLantern = addLantern(0, 474);   // 商店街の灯り: 敵は出さず環境イベント専用
    const squareLantern = addLantern(0, 518);   // 広場中央の大灯り: ボス戦の光源

    // ---- 環境イベント(商店街) ----
    // 資料21番「商店街に入った直後は静か。灯りをつけると店の中に大量の
    // 人影。次の瞬間全員消える」を、新規ジオメトリを起こさずテキストで
    // 実現した(他ダンジョンの環境ストーリーテリングと同じ手法)
    marketLantern.onLight = ()=>{
      spawnToast('……店の奥に、大勢の人影が並んでいるのが見えた。');
    };

    // ---- ボス:宵影の群れ ----
    // ボス本体の生成(buildDuskBoss())とenemies.push/duskBossRefへの
    // 代入はspawnEnemies()側で行う。ここではボスの間の扉だけ用意する
    buildDoor('duskBossDoor', 0, 500, 6, 0x2a2438, 'NS');

    // ---- ロア ----
    buildLoreNote(new THREE.Vector3(0, 0, 306), '朽ちた道標', [
      '「宵待ちの村へ ようこそ」',
      '文字の下に、小さく彫り足された跡がある。「――もう、誰も来ないと思っていた」'
    ], {kind:'sign', wall:false});
    buildLoreNote(new THREE.Vector3(-30, 0, 430), '軒先に吊るされたままのランタン', [
      '灯油はとうに切れている。それでも、誰かが定期的に磨いているような跡がある。'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(5, 0, 470), '商店の看板', [
      '「――屋」としか読めない。屋号の残りは、色褪せて消えている。',
      '扉の隙間から、かすかに灯油の匂いがした。'
    ], {kind:'sign', wall:false});

    buildTownReturnPortal(new THREE.Vector3(0, 0, 292));
  }

  // 灯りを点ける。近くで眠っている敵を起こし、初めての点灯には短い演出を
  // 付ける(資料20番「灯りをつけると誰もいなかった場所に人影が立っている」
  // の簡略版として、複数体まとめて起き上がる形にした)
  function lightLantern(l){
    if(!l || l.lit) return;
    l.lit = true;
    l.lampMat.emissive.setHex(0xffb060); l.lampMat.emissiveIntensity = 0.9;
    l.light.intensity = 1.1;
    sfx('chime');
    spawnToast('🏮 灯りを点けた');
    if(l.onLight) l.onLight();
    l.reveals.forEach(en=>{
      if(!en || en.dead) return;
      en.dormant = false;
      en.group.visible = true;
    });
    if(l.reveals.length) spawnToast('……何かが、そこにいる。');
    updateInteractPrompt();
  }

  function updateDuskVillage(dt){
    if(currentWorldKey !== 'duskvillage') return;

    // ---- 昼夜進行(ALTITUDE_BANDSと同じ補間手法をzの進み具合に適用) ----
    const z = state.pos.z;
    let a = DUSK_BANDS[0], b = DUSK_BANDS[DUSK_BANDS.length-1];
    for(let i=0;i<DUSK_BANDS.length-1;i++){
      if(z >= DUSK_BANDS[i].z && z <= DUSK_BANDS[i+1].z){ a = DUSK_BANDS[i]; b = DUSK_BANDS[i+1]; break; }
    }
    if(z < DUSK_BANDS[0].z){ a = b = DUSK_BANDS[0]; }
    if(z > DUSK_BANDS[DUSK_BANDS.length-1].z){ a = b = DUSK_BANDS[DUSK_BANDS.length-1]; }
    const t = (b.z===a.z) ? 0 : Math.max(0, Math.min(1, (z-a.z)/(b.z-a.z)));
    if(!duskSkyColor) duskSkyColor = new THREE.Color();
    duskSkyColor.setHex(a.sky).lerp(new THREE.Color(b.sky), t);
    if(scene.fog){
      scene.background = duskSkyColor;
      scene.fog.color.copy(duskSkyColor);
      scene.fog.density = a.fog + (b.fog-a.fog)*t;
    }
    const sunI = a.sunI + (b.sunI-a.sunI)*t, hemiI = a.hemi + (b.hemi-a.hemi)*t, rimI = a.rimI + (b.rimI-a.rimI)*t;
    if(sunLight){ sunLight.intensity = sunI; sunLight.color.setHex(t<0.5?a.sun:b.sun); }
    if(hemiLight){ hemiLight.intensity = hemiI; hemiLight.color.setHex(t<0.5?a.hemiSky:b.hemiSky); hemiLight.groundColor.setHex(t<0.5?a.hemiGnd:b.hemiGnd); }
    if(rimLight){ rimLight.intensity = rimI; rimLight.color.setHex(t<0.5?a.rim:b.rim); }
    if(renderer) renderer.toneMappingExposure = (a.exp + (b.exp-a.exp)*t) * (state.brightness || 1);

    // ---- ランタン近接判定 ----
    let nearest = null, nearestD = 2.4;
    duskLanterns.forEach(l=>{
      const d = state.pos.distanceTo(l.pos);
      if(d < nearestD){ nearest = l; nearestD = d; }
    });
    if(nearbyLantern !== nearest){ nearbyLantern = nearest; updateInteractPrompt(); }

    // ---- ボスの光ギミック(資料22番の核心) ----
    if(duskBossRef && !duskBossRef.dead){
      const en = duskBossRef;
      if(en._dimHintCD > 0) en._dimHintCD -= dt;
      const litNear = duskLanterns.some(l=> l.lit && en.group.position.distanceTo(l.pos) < 11);
      const shouldDim = !litNear;
      if(shouldDim !== !!en.lightDimmed){
        en.lightDimmed = shouldDim;
        if(en.body && en.body.material){
          if(!en._baseMatColor) en._baseMatColor = en.body.material.color.clone();
          en.body.material.color.copy(en._baseMatColor).multiplyScalar(shouldDim ? 0.12 : 1);
          en.body.material.emissiveIntensity = shouldDim ? 0.08 : 0.5;
        }
        if(!shouldDim) spawnToast('✨ 灯りに照らされ、実体が現れた!');
      }
    }
  }

  /* =========================================================
