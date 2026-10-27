// 「宵待ちの村」―― Chapter 1 / 魔法使い主役パートのステージ (WORK 2)
// (14-dungeon-duskvillage.js - concatenated with the other src/legacy/parts/*.js
// files into one shared scope at build time; see src/legacy/concat-plugin.js)

     DUSK VILLAGE ―― 正式仕様「忘れられること」(WORK 2 / DEC-001)

     旧実装は「灯りが怪異をこちらの世界へ引き出す」というステージで、細い桟橋を
     蜘蛛の巣状に張った水上迷路だった。正式仕様の決定(.ai/decisions/
     DEC-001-duskvillage-rebuild.md)でテーマそのものが差し替わったため、
     マップ骨格と環境をここで作り直している。

     ゲームループは「灯りを当てる」ではなく
       観察する → 違和感を見つける → 見分ける → 誘導する
     なので、旧ランタンギミック(点灯で敵が湧く/点けないとボスが無敵)は
     継承していない。灯りは背景として残っているだけで、触れない。

     構造(論理エリア → 部屋):
       森 → 村入口 → 中央広場 ┬ 魚屋 ┬ 船小屋
                               ├ 住宅
                               └ 商店街 → 水門前 → 水門 → 村の奥 → ボスエリア
     部屋数を論理エリア数に無理に合わせていない ―― 中央広場を村の中心に据え、
     そこから短い小道で4方向へ枝を出す形にして、「広場に戻ってくる」動線に
     してある。広い水面を何度も違う角度から見せることで、小さな村を広く見せる。

     authoring のパターン(ROOMS の表 + buildWalls() + addFloorWithHoles())は
     他ダンジョンと同じままで、表の中身だけを差し替えてある ―― worldBounds は
     setWorldBounds() が DUSK_ROOMS から導出する(06-player-enemy.js)ので、
     部屋を動かしても歩ける範囲が自動的に追従する。

     敵とボス(水鏡の影/泡沫の群れ/写し身/記憶漁師/水門守の残響/村の残響)は
     WORK 3 以降。ここでは「歩いているだけで、この村に何かあったと感じる」
     マップと環境だけを作る。

     どのファイルも前後のファイルとコメントの開き/閉じを跨いで連結される
     (concat-plugin.jsで単純結合されるため)ので、このファイル自身は
     このセクション見出しコメントで前のファイルの末尾コメントを閉じ、
     ファイル末尾で新しいセクション見出しコメントを開いて次のファイル
     (14-hud-boot.js)に閉じてもらう ―― 本文中に独立したブロックコメントを
     絶対に挟まないこと(挟むとこの閉じ開きの対応がずれて壊れる)
  ========================================================= */

  // 部屋テーブルと、それに対する問い合わせは core/dusk-village-map.js にある
  // (state/THREE 非依存なので tests/unit/ から直接検証できる)。ここは
  // その表を読んで、実際の床・壁・建物・小物・環境アニメーションを建てる側
  const DUSKVILLAGE_ENTRY = new THREE.Vector3(DUSK_ENTRY.x, 0, DUSK_ENTRY.z);

  // 時間帯。帯の表(DUSK_BANDS / DUSK_DAWN)と、帯の位置 → 光の値の補間は
  // core/dusk-light.js にある(CH1-EXP X-6a。光の色も空と同じく連続に補間する)。
  // ここは「今どの帯の位置にいるか」を決めて、その値を three.js へ書くだけ

  let duskProps = [];        // 環境アニメーションの対象。{obj, kind, phase, freq, amp, ...}
  let duskWater = null;      // 水面(頂点を毎フレーム揺らす一枚板)
  let duskWaterBase = null;  // その頂点の基準座標(Float32Array)
  let duskRipples = [];      // 波紋。プレイヤー/小舟の近くに出る
  let duskBossRef = null;    // WORK 7 でボスを入れるための受け皿(今は常に null)
  let duskSkyColor = null;
  /* 時間帯(CH1-EXP X-6b)。村で起きた出来事で目標が上がり、実際の値は数秒かけて
     そこへ寄る。上がるだけで戻らない(core/dusk-light.js)。出撃ごとに 0 から */
  let duskBandPos = 0, duskBandTarget = 0;
  function advanceDuskTime(beat){ duskBandTarget = advanceDuskTarget(duskBandTarget, beat); }
  let duskDawnT = 0;         // 0=夜のまま 1=夜明け。WORK 7 の撃破演出が動かす
  let duskCreakCD = 0;       // 木橋の軋み(鳴らしすぎないための間引き)
  let duskRippleCD = 0;
  /* 入れる建物の屋根(WORK 4)。カメラが真上からなので、中へ入ると屋根しか
     見えない ―― 中にいる間だけその棟の屋根を透かす。建物ごとに持つのは
     位置と大きさと屋根の材質だけで、判定は updateDuskVillage で毎フレーム */
  let duskInteriors = [];
  /* 水門(WORK 6)。門扉は閉じた状態で建て、水門守の残響を倒すと上がる。
     歯車・鎖・レバーは演出で動かすので参照を持っておく */
  let duskGateSlab = null, duskGateWall = null, duskGateLever = null;
  let duskBarDoor = null, duskBarBeam = null;   // 閂の門(CH1-COMP W3)
  let duskGateGears = [], duskGateChains = [];
  let duskGateOpenT = 0;        // 0=閉 1=全開。撃破後にゆっくり上がる
  let duskGateOpening = false;
  let duskLagProp = null;   // 環境異常(WORK 4): いま揺れが止まっている小舟
  let duskLagT = 0;
  let duskLagCD = 12;

  // 環境音の区画。どの部屋がどの区画かは core 側(duskAmbienceZoneFor)が持つ
  function duskAmbienceZone(){
    const r = duskRoomAt(state.pos.x, state.pos.z);
    return r ? duskAmbienceZoneFor(r.id) : 'duskShore';
  }

  /* 環境アニメーションの登録。巨大な汎用システムは作らず、ここでは
     「どのオブジェクトを、どの種類の揺れで、どの位相・周期・振れ幅で動かすか」
     だけを配列に積む。位相と周期を1つずつずらしてあるのは、全部が同じ拍で
     揺れると一気に「ゲームのループ」に見えるため ―― 風と水で動いている
     ように見せたいので、周期は意図的に割り切れない値にしてある。 */
  function duskProp(obj, kind, opts){
    opts = opts || {};
    duskProps.push({
      obj, kind,
      phase: opts.phase != null ? opts.phase : Math.random()*Math.PI*2,
      freq:  opts.freq  != null ? opts.freq  : 0.5 + Math.random()*0.4,
      amp:   opts.amp   != null ? opts.amp   : 0.06,
      baseY: obj.position.y,
      baseRotX: obj.rotation.x, baseRotZ: obj.rotation.z,
      react: opts.react || 0,     // プレイヤーが近づくと揺れが増える距離(0=反応しない)
      reactT: 0,
      light: opts.light || null,  // 灯りだけ、明るさの側も揺らす
    });
    return obj;
  }

  function buildDuskVillage(){
    duskProps = [];
    duskRipples = [];
    duskWater = null; duskWaterBase = null;
    duskBossRef = null;
    duskDawnT = 0; duskCreakCD = 0; duskRippleCD = 0;
    duskBandPos = 0; duskBandTarget = 0;   // 出撃のたびに夕暮れから(CH1-EXP X-6b)
    duskGuestWalk = null;
    duskFishMemoryDone = false;   // 出撃のたびに、記憶はまた一度だけ起きる
    duskChildMemoryDone = false; duskBoatMemoryDone = false;
    duskMarketMemoryDone = false; duskGateTalkDone = false;
    duskInsightDone = false;
    duskMarketFight = null;
    duskWardenSpawned = false; duskBossPreludeDone = false;
    duskDawnRising = false; duskDawnBirdCD = 0; duskDawnRippleCD = 0;
    duskDeepSeen = 0; duskDeepCD = 0;
    duskGateCreakCD = 0; duskGateChainCD = 0; duskGateFlowCD = 0;
    duskInteriors = [];
    duskGateSlab = null; duskGateWall = null; duskGateLever = null;
    duskBarDoor = null; duskBarBeam = null;
    duskGateGears = []; duskGateChains = [];
    duskGateOpenT = 0; duskGateOpening = false;
    duskLagProp = null; duskLagT = 0; duskLagCD = 12;

    const plankTex  = makePlankTexture('#4a3a2a', 4, 6, 3);
    const plankMat  = new THREE.MeshStandardMaterial({map:plankTex, roughness:0.85});
    const stoneTex  = makeStoneTileTexture('#57544e', '#2e2c28', '#6e6a62', 4, 8, 6, {bump:0.05});
    const stoneMat  = new THREE.MeshStandardMaterial({map:stoneTex, roughness:0.8});
    const dirtMat   = new THREE.MeshStandardMaterial({
      map: makeGrassTexture('#33302a', ['#3c3830','#2a2722','#443c30','#262320'], 7, 5), roughness:0.95});
    const railMat   = new THREE.MeshStandardMaterial({color:0x2a2018, roughness:0.9});
    const wallMat   = new THREE.MeshStandardMaterial({map:makePlankTexture('#2b221a', 3, 5, 2), roughness:0.9});
    const roofMat   = new THREE.MeshStandardMaterial({color:0x1d1712, roughness:0.85});
    const clothMat  = new THREE.MeshStandardMaterial({color:0x9a9384, roughness:0.95, side:THREE.DoubleSide});
    const ropeMat   = new THREE.MeshStandardMaterial({color:0x6a5c42, roughness:1.0});
    const ironMat   = new THREE.MeshStandardMaterial({color:0x3c3a38, roughness:0.6, metalness:0.5});
    const woodMat   = new THREE.MeshStandardMaterial({color:0x4a3a28, roughness:0.85});
    const darkWood  = new THREE.MeshStandardMaterial({color:0x33281c, roughness:0.9});
    const potMat    = new THREE.MeshStandardMaterial({color:0x6b6157, roughness:0.85});
    const waterMat  = new THREE.MeshStandardMaterial({color:0x0b1c26, roughness:0.28, metalness:0.25,
      transparent:true, opacity:0.86, emissive:0x0a2a32, emissiveIntensity:0.12});

    /* ---- 水面 ----
       村のどこからでも見える、この場所の主役。板ではなく分割した平面にして
       あり、updateDuskVillage() が頂点を2つの正弦波で揺らす。当たり判定は
       持たない(岸の縁 addLowRailBox が歩ける範囲を決める)。
       分割数は「うねりが見える最小限」に抑えてある ―― 実機(iPhone)と
       ソフトウェアレンダラのどちらでも毎フレーム全頂点を触るため */
    const waterGeo = new THREE.PlaneGeometry(170, 300, 26, 46);
    duskWater = new THREE.Mesh(waterGeo, waterMat);
    duskWater.rotation.x = -Math.PI/2;
    duskWater.position.set(0, -0.32, 410);
    scene.add(duskWater);
    duskWaterBase = waterGeo.attributes.position.array.slice();

    // ---- 床と縁 ----
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
      /* 森は土、村の中心は石畳、それ以外は水上の板張り。足音(addRoomSurface)も
         同じ1行から決まるので、見た目と音がずれようがない */
      const mat = r.id === 'forest' ? dirtMat
                : (r.id === 'plaza' || r.id === 'gate') ? stoneMat : plankMat;
      const surf = r.id === 'forest' ? 'dirt'
                : (r.id === 'plaza' || r.id === 'gate') ? 'stone' : 'wood';
      addFloorWithHoles(r.x0, r.x1, r.z0, r.z1, [], mat, DUSK_FLOOR_Y);
      addRoomSurface(r, surf);
      buildWalls(r);
    });

    /* ---- 建物 ----
       全部の内部は作らない。「入れる」のは魚屋・住宅・船小屋・商店の店・
       水門の管理小屋の5棟で、そこだけ壁に出入口を開けてある。残りは
       シルエットとして village の密度を作るためのもの。 */
    function roof(x, z, w, d, h, ry, mat){
      const m = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*0.74, h*0.5, 4), mat || roofMat);
      m.position.set(x, h + h*0.22, z);
      m.rotation.y = (ry || 0) + Math.PI/4;
      m.castShadow = true;
      scene.add(m);
      return m;
    }
    // 壁1枚。doorGap を渡すと、その辺の中央に出入口を開ける
    function wallRun(cx, cz, sx, sz, h, doorGap){
      if(!doorGap){ addStaticBox(cx, h/2, cz, sx, h, sz, wallMat, true); return; }
      const alongX = sx > sz;
      const len = alongX ? sx : sz;
      const side = (len - doorGap)/2;
      if(side <= 0.05) return;
      if(alongX){
        addStaticBox(cx - (doorGap/2 + side/2), h/2, cz, side, h, sz, wallMat, true);
        addStaticBox(cx + (doorGap/2 + side/2), h/2, cz, side, h, sz, wallMat, true);
      } else {
        addStaticBox(cx, h/2, cz - (doorGap/2 + side/2), sx, h, side, wallMat, true);
        addStaticBox(cx, h/2, cz + (doorGap/2 + side/2), sx, h, side, wallMat, true);
      }
    }
    // 入れない建物(シルエット)
    function hut(x, z, w, d, h){
      addStaticBox(x, h/2, z, w, h, d, wallMat, true);
      roof(x, z, w, d, h);
    }
    // 入れる建物。door は出入口の向き('S'|'N'|'E'|'W')
    function house(x, z, w, d, h, door){
      const t = 0.3;
      wallRun(x, z - d/2, w, t, h, door === 'S' ? 2.2 : 0);
      wallRun(x, z + d/2, w, t, h, door === 'N' ? 2.2 : 0);
      wallRun(x - w/2, z, t, d, h, door === 'W' ? 2.2 : 0);
      wallRun(x + w/2, z, t, d, h, door === 'E' ? 2.2 : 0);
      /* 入れる建物の屋根だけは、透かせるように専用の材質を持たせる
         (roofMat のままだと、透かした瞬間に村中の屋根が消える) */
      const rmat = new THREE.MeshStandardMaterial({color:0x1d1712, roughness:0.85,
                                                   transparent:true, opacity:1});
      const rmesh = roof(x, z, w, d, h, 0, rmat);
      duskInteriors.push({x, z, w, d, mesh:rmesh, mat:rmat, k:0});
    }

    // ---- 小物 ----
    function crate(x, z, s, ry){
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s*0.82, s), darkWood);
      m.position.set(x, s*0.41 + 0.08, z); m.rotation.y = ry || 0; m.castShadow = true;
      scene.add(m); return m;
    }
    function barrel(x, z, r, h){
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r*0.92, h, 10), woodMat);
      m.position.set(x, h/2 + 0.08, z); m.castShadow = true; scene.add(m); return m;
    }
    function basket(x, z, r){   // 魚籠。口が開いた籠
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r*0.7, r*1.3, 9, 1, true), woodMat);
      m.position.set(x, r*0.65 + 0.08, z); m.castShadow = true; scene.add(m); return m;
    }
    function board(x, y, z, w, h, d, mat, ry){   // 机・棚板・まな板・看板の板
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || woodMat);
      m.position.set(x, y, z); m.rotation.y = ry || 0; m.castShadow = true;
      scene.add(m); return m;
    }
    function table(x, z, w, d, ry){
      board(x, 0.78, z, w, 0.08, d, woodMat, ry);
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>{
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.72, 0.09), darkWood);
        leg.position.set(x + sx*(w/2-0.12), 0.44, z + sz*(d/2-0.12));
        scene.add(leg);
      });
    }
    function shelf(x, z, w, ry){
      [0.45, 0.95, 1.45].forEach(y=> board(x, y, z, w, 0.06, 0.4, darkWood, ry));
      [-1,1].forEach(s=>{
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 0.4), darkWood);
        post.position.set(x + Math.cos(ry||0)*s*(w/2), 0.8, z - Math.sin(ry||0)*s*(w/2));
        scene.add(post);
      });
    }
    function pot(x, z, r){
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), potMat);
      m.position.set(x, r*0.8 + 0.08, z); m.scale.y = 0.8; m.castShadow = true;
      scene.add(m); return m;
    }
    // 吊り下げもの(洗濯物・網・布・看板)。風で揺れる
    function hanging(x, y, z, w, h, mat, kind, opts){
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(x, y, z);
      if(opts && opts.ry) m.rotation.y = opts.ry;
      scene.add(m);
      return duskProp(m, kind || 'sway', opts);
    }
    function ropeLine(x0, z0, x1, z1, y, sag){
      const dx = x1-x0, dz = z1-z0;
      const len = Math.hypot(dx, dz);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 5), ropeMat);
      m.position.set((x0+x1)/2, y - (sag||0), (z0+z1)/2);
      m.rotation.z = Math.PI/2;
      m.rotation.y = -Math.atan2(dz, dx);
      scene.add(m);
      return duskProp(m, 'ropeSag', {amp:0.035, freq:0.42});
    }
    function post(x, z, h, r){
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r||0.1, (r||0.1)*1.15, h, 7), darkWood);
      m.position.set(x, h/2 + 0.08, z); m.castShadow = true; scene.add(m); return m;
    }
    // 背景としての灯り。触れない(旧ランタンギミックは継承しない)
    function lamp(x, z, color){
      post(x, z, 1.9, 0.07);
      const mat = new THREE.MeshStandardMaterial({color:0x4a3a28, emissive:color||0xffb060,
        emissiveIntensity:0.55, roughness:0.5});
      const glass = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat);
      glass.position.set(x, 2.0, z);
      scene.add(glass);
      /* 光源プール(takeLight)は使わない ―― プールから借りたものは必ず
         giveLight() で返す約束だが、ワールド構築中に置いた灯りは
         disposeWorld() が currentWorldObjects ごと外すだけで返却の機会が
         無く、借りっぱなしになってプールが恒久的に縮む。旧ランタンと
         同じく、ここは素の PointLight で置く */
      const light = new THREE.PointLight(color||0xffb060, 0.5, 9);
      light.position.set(x, 2.1, z);
      scene.add(light);
      // 灯り本体はごく小さく揺れる。炎の揺らぎは強度の方で見せる
      return duskProp(glass, 'lamp', {amp:0.05, freq:1.5 + Math.random()*0.8, light});
    }
    function boat(x, z, ry, len){
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.42, len||3.4, 7, 1, false, 0, Math.PI), darkWood);
      hull.rotation.z = Math.PI/2; hull.rotation.x = Math.PI;
      g.add(hull);
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.07, 0.5), woodMat);
      seat.position.y = 0.16; g.add(seat);
      g.position.set(x, -0.12, z); g.rotation.y = ry || 0;
      scene.add(g);
      // 小舟は水に浮いているので、常にゆっくり上下・左右に傾く。
      // プレイヤーが近づくと波が立って揺れが増える(react)
      return duskProp(g, 'boat', {amp:0.055, freq:0.33 + Math.random()*0.18, react:4.6});
    }
    function buoy(x, z, r){   // 浮き
      const m = new THREE.Mesh(new THREE.SphereGeometry(r||0.22, 9, 7),
        new THREE.MeshStandardMaterial({color:0x7a5a3a, roughness:0.9}));
      m.position.set(x, -0.2, z);
      scene.add(m);
      return duskProp(m, 'float', {amp:0.07, freq:0.6 + Math.random()*0.3});
    }
    function reeds(x, z, n){   // 水際の草。まとめて1回だけ登録する
      const g = new THREE.Group();
      for(let i=0;i<(n||5);i++){
        const h = 0.6 + Math.random()*0.5;
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.05),
          new THREE.MeshStandardMaterial({color:0x3f4a32, roughness:1}));
        blade.position.set((Math.random()-0.5)*0.9, h/2, (Math.random()-0.5)*0.9);
        blade.rotation.z = (Math.random()-0.5)*0.25;
        g.add(blade);
      }
      g.position.set(x, -0.25, z);
      scene.add(g);
      return duskProp(g, 'reeds', {amp:0.09, freq:0.8 + Math.random()*0.5});
    }

    // =====================================================================
    // ① 湖畔の森道 ―― 村へ入る前。木立で村を隠し、一望させない
    // =====================================================================
    /* 木立は歩ける床の外側(|x| >= 16)に立てる。見下ろしカメラは
       プレイヤーの 8m 上にいるので、道の上に高い樹冠を置くと画面を塞いで
       しまう ―― 道を縁取って村を隠すのが狙いなので、外から挟む */
    const treeMat = new THREE.MeshStandardMaterial({color:0x2a2a20, roughness:1});
    [[-17,288],[-21,297],[-16,303],[18,286],[22,294],[17,302],[-25,292],[26,300],
     [-19,308],[20,309]].forEach(([tx,tz])=>{
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 4.2, 6), treeMat);
      trunk.position.set(tx, 2.1, tz); trunk.castShadow = true; scene.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3.0, 6),
        new THREE.MeshStandardMaterial({color:0x1e2a1e, roughness:1}));
      crown.position.set(tx, 4.6, tz); scene.add(crown);
      duskProp(crown, 'sway', {amp:0.02, freq:0.3 + Math.random()*0.2});
    });
    reeds(-9, 305, 6); reeds(9, 304, 5);

    // ② 木橋 ―― 村の入口はここから。踏むと軋む(updateDuskVillage)
    [-1.6, 1.6].forEach(px=>{ post(px, 305.5, 1.3, 0.08); post(px, 310.5, 1.3, 0.08); });
    ropeLine(-1.6, 305.5, -1.6, 310.5, 1.25, 0.12);
    ropeLine( 1.6, 305.5,  1.6, 310.5, 1.25, 0.12);

    // =====================================================================
    // ③ 村の入口 ―― 道標と、村を隠す2棟。ここからは広場が見通せない
    // =====================================================================
    hut(-11, 322, 6.5, 7, 4.2);
    hut(11, 324, 6, 6.5, 4.6);
    lamp(-4.6, 316);
    lamp(4.6, 316);
    hanging(0, 2.5, 313.4, 3.0, 0.7, clothMat, 'sway', {amp:0.05, freq:0.55});   // 村の名を書いた布看板
    reeds(-15, 318, 5);

    // =====================================================================
    // ④ 中央広場 ―― 村の中心。井戸を据え、四方の枝が見える
    // =====================================================================
    /* 井戸は広場の中心から west へずらしてある ―― 見下ろしカメラの正面に
       背の高いものを置くと、村の奥への視線を塞ぎ、通り道も塞いでしまう。
       広場の主役ではあるが、動線の上には置かない */
    const wellX = -7, wellZ = 349, wellR = 1.5;
    const well = new THREE.Mesh(new THREE.CylinderGeometry(wellR, wellR*1.05, 1.0, 12), stoneMat);
    well.position.set(wellX, 0.58, wellZ); well.castShadow = true; scene.add(well);
    walls.push({minX:wellX-wellR, maxX:wellX+wellR, minZ:wellZ-wellR, maxZ:wellZ+wellR});
    [[wellX-1.3,wellZ],[wellX+1.3,wellZ]].forEach(([px,pz])=> post(px, pz, 2.4, 0.09));
    board(wellX, 2.5, wellZ, 3.0, 0.16, 0.5, darkWood);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.4, 8), woodMat);
    bucket.position.set(wellX, 1.9, wellZ); scene.add(bucket);
    duskProp(bucket, 'swing', {amp:0.10, freq:0.46});   // 釣瓶。風でゆっくり回る

    // 掲示板。村の連絡がそのまま残っている
    post(-6.5, 340, 1.8, 0.1);
    board(-6.5, 1.7, 340, 2.2, 1.2, 0.12, darkWood);
    // 広場を囲む建物(入れないシルエット)。密度で「村の中心」を作る
    hut(-20, 338, 6, 6, 4.0);
    hut(-20, 364, 6.5, 6, 3.8);
    hut(20, 366, 6, 6.5, 4.2);
    hut(13, 336, 5.5, 5.5, 3.6);
    lamp(-8, 358); lamp(8, 358); lamp(-10, 336); lamp(10, 336);
    // 広場の洗濯物。生活の跡が村の真ん中に残っている
    ropeLine(-18, 352, -10, 352, 2.5, 0.25);
    [-16.5, -14.5, -12.5, -10.8].forEach((lx,i)=>
      hanging(lx, 2.0, 352, 0.8, 0.95, clothMat, 'cloth', {amp:0.13, freq:0.5 + i*0.07}));
    crate(18, 344, 0.9); crate(18.9, 344.7, 0.7, 0.4);
    barrel(-17, 345, 0.45, 0.95);

    // =====================================================================
    // ⑤ 魚屋 ―― 魚籠・まな板・桶・秤・帳簿
    // =====================================================================
    house(-45, 348, 9, 10, 3.8, 'E');
    table(-46.5, 345, 2.2, 1.1);
    board(-46.5, 0.86, 345, 1.0, 0.07, 0.6, woodMat);     // まな板
    board(-45.8, 0.90, 344.6, 0.5, 0.04, 0.09, ironMat);  // 包丁
    basket(-48.5, 350, 0.55); basket(-47.4, 351, 0.45); basket(-49.2, 348.6, 0.5);
    /* 籠の中と、まな板の上に残った魚。干からびているので、ここは
       「いま漁をしている村」ではない ―― 置きすぎると説明用の陳列に
       見えるので、目に入る2箇所だけ */
    const fishMat = new THREE.MeshStandardMaterial({color:0x6d7a72, roughness:0.75});
    [[-48.5, 350, 0.62], [-47.4, 351, 0.5]].forEach(([fx, fz, r])=>{
      const fish = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), fishMat);
      fish.scale.set(1, 0.5, 2.1);
      fish.position.set(fx, r + 0.1, fz);
      fish.rotation.y = Math.random()*Math.PI;
      scene.add(fish);
    });
    const cutFish = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), fishMat);
    cutFish.scale.set(1, 0.42, 2.0);
    cutFish.position.set(-46.5, 0.93, 345);
    cutFish.rotation.y = 0.3;
    scene.add(cutFish);
    barrel(-42.5, 351.5, 0.42, 0.9);
    pot(-43.5, 345.5, 0.36);
    // 秤: 竿と両側の皿
    post(-48.6, 343.6, 1.5, 0.07);
    const beam = board(-48.6, 1.6, 343.6, 1.5, 0.05, 0.05, ironMat);
    duskProp(beam, 'swing', {amp:0.06, freq:0.63});
    crate(-40.5, 341, 0.85); crate(-41.2, 342.2, 0.6, 0.6);
    // 軒先に吊るした網
    ropeLine(-51, 340, -51, 344, 2.4, 0.1);
    hanging(-51, 1.85, 342, 1.6, 1.1, new THREE.MeshStandardMaterial({
      color:0x6a6250, roughness:1, transparent:true, opacity:0.55, side:THREE.DoubleSide}),
      'cloth', {amp:0.10, freq:0.44, ry:Math.PI/2});
    reeds(-55, 334, 5);

    // =====================================================================
    // ⑥ 住宅 ―― 机・椅子・食器・布団・洗濯物・玩具
    // =====================================================================
    house(45, 348, 9, 9, 3.8, 'W');
    table(46.5, 349, 2.0, 1.2);
    [[45.2,349],[47.8,349],[46.5,350.6]].forEach(([sx,sz])=> {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.46, 8), woodMat);
      stool.position.set(sx, 0.31, sz); scene.add(stool);
    });
    /* 食卓(WORK 4)。椅子は3つなのに、食器は4人分ある。
       怖がらせるための仕掛けではなく、「ここには誰かがいた」と思える
       ずれを1つだけ置いてある ―― 説明はしないし、イベントにもしない */
    [[46.0,348.7],[46.6,349.3],[47.2,348.8],[46.3,350.0]].forEach(([dx,dz])=>{
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.05, 10), potMat);
      dish.position.set(dx, 0.85, dz); scene.add(dish);
    });
    // 水差しと、伏せたままの椀
    const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.34, 9), potMat);
    jug.position.set(45.6, 0.99, 349.6); scene.add(jug);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.15, 9, 7, 0, Math.PI*2, 0, Math.PI/2), potMat);
    bowl.position.set(47.6, 0.86, 350.1); bowl.rotation.x = Math.PI; scene.add(bowl);
    // 畳んでいない衣類と、繕いかけの布
    board(48.0, 0.30, 344.6, 0.9, 0.22, 0.7, clothMat);
    board(47.2, 0.24, 344.2, 0.6, 0.14, 0.5, clothMat);
    // 桶と工具(暮らしの道具。並べすぎない)
    barrel(43.2, 350.8, 0.3, 0.5);
    board(48.6, 0.52, 348.2, 0.5, 0.06, 0.12, ironMat);
    // 布団: 敷いたまま
    board(43.5, 0.22, 345.5, 1.5, 0.28, 2.2, clothMat);
    // 玩具: 小さな木彫りの舟。床に転がっている
    const toy = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.5, 6, 1, false, 0, Math.PI), woodMat);
    toy.rotation.z = Math.PI/2; toy.rotation.x = Math.PI;
    toy.position.set(44.2, 0.16, 351.5); scene.add(toy);
    shelf(48.3, 346.5, 1.8, Math.PI/2);
    pot(48.3, 351.2, 0.32);
    // 軒先の洗濯物(住宅の外)
    ropeLine(36, 341, 42, 341, 2.6, 0.22);
    [37.5, 39.0, 40.5].forEach((lx,i)=>
      hanging(lx, 2.1, 341, 0.9, 1.0, clothMat, 'cloth', {amp:0.12, freq:0.47 + i*0.06}));
    hut(52, 340, 5.5, 5.5, 3.6);
    hut(38, 357, 6, 5.5, 3.8);
    lamp(36, 348);
    // 屋内の灯り(WORK 4)。消して出た家ではない ―― 点いたまま残っている
    lamp(44.0, 346.6);

    // =====================================================================
    // ⑥' 裏通り(CH1-COMP W3) ―― 住宅の北から裏へ回り、商店街の東の口へ抜ける細い道。
    //     表通り(広場 → 商店街)は閂の門で閉ざされているので、ここが本筋になる。
    //     広場の掲示板の「見回り当番 ―― 今月は東の組」が、東へ回る手がかり。
    //     北の端は物置場の行き止まり(宝箱)。目印は赤い布(光源は増やさない)
    // =====================================================================
    hut(50.2, 372, 3.4, 9, 3.4);     // 東側の家並み(裏手)
    hut(39.8, 368, 3.2, 7, 3.2);     // 西側の物置
    hut(39.8, 395, 3.2, 5.5, 3.0);   // 物置場の小屋
    ropeLine(42, 380, 48, 380, 2.6, 0.2);
    [43.2, 44.8, 46.4].forEach((lx,i)=>
      hanging(lx, 2.1, 380, 0.8, 0.95, clothMat, 'cloth', {amp:0.12, freq:0.46 + i*0.07}));
    /* 目印: 物置場の赤い布。夕暮れの青い村の中でここだけ赤い ―― 広場の東から
       裏通りへ入った時に、奥の行き先として見える(発光の材質だけ。灯りは足さない) */
    const duskMarkerCloth = new THREE.MeshStandardMaterial({color:0x8a2a22, roughness:0.95,
      emissive:0x5a1410, emissiveIntensity:0.55, side:THREE.DoubleSide});
    post(43.5, 393.5, 3.0, 0.1); post(48.5, 393.5, 3.0, 0.1);
    ropeLine(43.5, 393.5, 48.5, 393.5, 2.9, 0.15);
    hanging(46, 2.2, 393.5, 2.4, 1.3, duskMarkerCloth, 'cloth', {amp:0.10, freq:0.4});
    crate(49.6, 396.4, 0.9); crate(50.4, 395.2, 0.7, 0.5); barrel(42.4, 396.5, 0.42, 0.9);
    lamp(45.5, 382);   // 商店街の南西の角から移した(灯りの数は 19 のまま)
    // 裏通りの小道(商店街へ)。水の上の板張りに、杭を数本
    [24, 30, 36].forEach(px=> post(px, 384.4, 1.0, 0.09));

    // =====================================================================
    // ⑦ 船小屋 ―― 船・網・浮き・ロープ・滑車・修理道具。水面がいちばん近い
    // =====================================================================
    house(-42, 310, 11, 10, 4.2, 'N');
    // 修理途中の舟(小屋の中)と、繋いだままの舟(外の水面)
    boat(-42, 308.5, 0.12, 3.6);
    boat(-34.5, 303.5, 1.35, 3.2);
    boat(-47.5, 317.5, -0.5, 3.0);
    buoy(-36.5, 300.8); buoy(-33.2, 301.6, 0.18); buoy(-38.4, 299.4, 0.2);
    // 滑車とロープ(舟を吊り上げる仕掛け)
    post(-46.5, 306.5, 3.0, 0.12);
    const pulley = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.07, 6, 12), ironMat);
    pulley.position.set(-46.5, 3.0, 306.5); pulley.rotation.y = Math.PI/2; scene.add(pulley);
    duskProp(pulley, 'spin', {amp:0.05, freq:0.3});
    ropeLine(-46.5, 306.5, -46.5, 309.5, 2.9, 0.35);
    // 網と道具
    ropeLine(-50, 304, -50, 309, 2.3, 0.12);
    hanging(-50, 1.75, 306.5, 1.8, 1.2, new THREE.MeshStandardMaterial({
      color:0x5f5a4a, roughness:1, transparent:true, opacity:0.5, side:THREE.DoubleSide}),
      'cloth', {amp:0.11, freq:0.41, ry:Math.PI/2});
    basket(-38, 313, 0.5); basket(-39.2, 314, 0.42);
    crate(-48, 313.5, 0.8); crate(-48.6, 314.8, 0.6, 0.3);
    board(-44, 0.5, 315.5, 1.4, 0.1, 0.35, woodMat);      // 修理台の上の板
    board(-44.3, 0.62, 315.3, 0.45, 0.06, 0.07, ironMat); // 道具
    reeds(-30, 302, 6); reeds(-50, 300, 5);
    lamp(-45.5, 312.5);   // 小屋の中の灯り(WORK 4)

    // =====================================================================
    // ⑧ 商店街 ―― 看板・商品棚・秤・帳簿・空の棚・木箱
    // =====================================================================
    house(-13, 380, 8, 9, 3.9, 'E');     // 入れる店
    hut(13, 379, 7.5, 8, 4.0);
    hut(14, 393, 6.5, 6, 3.7);
    hut(-14, 394, 6, 6, 3.6);
    // 看板(揺れる)。屋号はもう読めない
    [[-8.6, 377, 0], [8.6, 377, Math.PI]].forEach(([sx,sz,ry])=>{
      post(sx, sz, 2.6, 0.09);
      hanging(sx + (ry ? -0.9 : 0.9), 2.1, sz, 1.5, 0.6, clothMat, 'sign', {amp:0.09, freq:0.52, ry:0});
    });
    shelf(-15.5, 382, 2.2, 0);       // 空の商品棚
    shelf(-11, 383.5, 2.0, 0);
    board(-13, 0.9, 378.5, 1.6, 0.08, 0.7, woodMat);   // 帳場の台
    pot(-15.8, 378.4, 0.3);
    crate(6, 386, 0.95); crate(7.1, 386.8, 0.75, 0.5); crate(4.8, 387, 0.6, -0.3);
    barrel(4, 384, 0.44, 0.92); barrel(4.9, 383.2, 0.4, 0.8);
    lamp(-6, 396); lamp(6, 396);   // 南西の角の灯りは裏通りへ移した(CH1-COMP W3)
    ropeLine(-6, 390, 6, 390, 3.0, 0.4);
    [-3.5, 0, 3.5].forEach((lx,i)=>
      hanging(lx, 2.45, 390, 0.7, 0.8, clothMat, 'cloth', {amp:0.10, freq:0.49 + i*0.05}));

    /* ---- 商店街の暮らし(WORK 5) ----
       ここは村でいちばん「普通の生活」が見える場所。廃墟にはしない ――
       壊すのではなく、途中で置かれたままにする。
       戦闘の場でもあるので、真ん中は空けて、物は壁沿いへ寄せている
       (複数の怪異が同時にいても画面が詰まらないように) */
    // 屋台。売り物は無いが、天幕だけまだ張ってある
    post(-4.2, 384.5, 2.2, 0.08); post(-1.2, 384.5, 2.2, 0.08);
    board(-2.7, 1.0, 384.5, 3.2, 0.08, 1.1, woodMat);          // 台
    hanging(-2.7, 2.28, 384.2, 3.2, 0.9, clothMat, 'sign', {amp:0.07, freq:0.44});
    pot(-3.6, 384.3, 0.22); pot(-1.8, 384.7, 0.2);
    lamp(-6.2, 382.5);   // 屋台の灯り。ここだけは物が見える明るさにする
    // 作業台と椅子。仕事の途中で立ったまま
    table(15.5, 386, 1.8, 1.0);
    board(15.2, 0.86, 386, 0.7, 0.05, 0.3, ironMat);            // 工具
    [[14.4, 387.2], [16.6, 385.0]].forEach(([sx,sz])=>{
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.24, 0.46, 8), woodMat);
      stool.position.set(sx, 0.31, sz); scene.add(stool);
    });
    // 秤。皿が片方だけ下がったまま釣り合っていない
    post(-15.2, 386.5, 1.0, 0.07);
    board(-15.2, 1.06, 386.5, 1.1, 0.05, 0.08, ironMat);
    [[-15.7, 0.86], [-14.7, 1.02]].forEach(([px, py])=>{
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.05, 10), ironMat);
      pan.position.set(px, py, 386.5); scene.add(pan);
    });
    // 三軒目の店(入れる)。中は棚と台だけ
    house(15, 397, 7, 7, 3.7, 'W');
    shelf(17.2, 396, 1.8, Math.PI/2);
    board(15.5, 0.9, 398.4, 1.4, 0.08, 0.6, woodMat);
    lamp(13.4, 396.4);   // 屋内の灯り(WORK 4 と同じ扱い)
    /* 水路。商店街の脇を通り、水門のほうへ流れていく。浅い掘割なので
       壁にはしていない ―― ここは戦う場所でもあるので、逃げ道を潰さない */
    const canalMat = new THREE.MeshStandardMaterial({color:0x10242e, roughness:0.3, metalness:0.2,
      transparent:true, opacity:0.88, emissive:0x0a2a32, emissiveIntensity:0.14});
    const canal = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 30), canalMat);
    canal.rotation.x = -Math.PI/2; canal.position.set(-18.6, 0.10, 386); scene.add(canal);
    [-19.9, -17.3].forEach(cx=> board(cx, 0.16, 386, 0.4, 0.16, 30, stoneMat));
    // 渡し板。水路をまたぐ所だけ板が渡してある
    board(-18.6, 0.19, 380, 3.2, 0.1, 1.1, woodMat);
    reeds(-18.6, 372.5, 3); reeds(-18.6, 400, 3);

    // =====================================================================
    // ⑨ 水門前 ―― 建物を減らし、水面を広く見せる
    // =====================================================================
    hut(-24, 410, 5, 5, 3.2);
    lamp(-9, 420); lamp(9, 420);
    reeds(-28, 406, 6); reeds(28, 408, 6); reeds(-27, 432, 5); reeds(27, 430, 5);
    buoy(-22, 424); buoy(22, 426, 0.19); buoy(-19, 434, 0.2);
    boat(24, 415, 0.9, 3.0);
    // 舫い杭が並ぶだけの岸。ここは「何も無いこと」を見せる場所
    [-16, -8, 8, 16].forEach(px=> post(px, 436.5, 1.1, 0.11));

    // ⑨' 見張り小屋(CH1-COMP W3) ―― 水門前の西の行き止まり。見回りの当番が
    //     水門を見張っていた小屋。寄り道の宝箱と手記
    house(-39, 420, 7, 6, 3.2, 'E');
    board(-40.5, 0.9, 421.8, 1.4, 0.08, 0.6, woodMat);   // 机
    post(-44.2, 414.2, 3.4, 0.12);                       // 見張りの柱(水門の方を向いた古い竿)
    board(-44.2, 3.3, 414.2, 1.2, 0.08, 0.08, darkWood);
    reeds(-44, 426, 4);

    // =====================================================================
    // ⑩ 水門 ―― 巨大な門・歯車・鎖・操作機構・管理小屋
    // =====================================================================
    // 門柱と、持ち上がったままの門扉
    [-6.5, 6.5].forEach(px=>{
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 6.4, 2.2), stoneMat);
      pillar.position.set(px, 3.2, 450); pillar.castShadow = true; scene.add(pillar);
      walls.push({minX:px-1.1, maxX:px+1.1, minZ:448.9, maxZ:451.1});
    });
    /* 門扉は**下りたまま**(WORK 6)。WORK 2 では持ち上がった状態で置いて
       あったが、水門前の会話(WORK 5)が「閉じたままですね」と言っている
       ので、閉じている方が正しい ―― 水門守の残響を倒すと上がる */
    duskGateSlab = new THREE.Mesh(new THREE.BoxGeometry(11, 3.4, 0.6), darkWood);
    duskGateSlab.position.set(0, 1.7, 450); duskGateSlab.castShadow = true; scene.add(duskGateSlab);
    duskGateWall = {minX:-5.5, maxX:5.5, minZ:DUSK_SLUICE_Z.gateZ0, maxZ:DUSK_SLUICE_Z.gateZ1};
    walls.push(duskGateWall);
    /* 門柱から柵までの石垣(CH1-COMP W3)。以前は門扉と柱の外側に幅 4 ほどの隙間があり、
       水門守と戦わずに奥へ抜けられた(DEC-001 の「水門が関門」に反する)。両脇を塞いで、
       水門が上がるまで先へ進めないようにする。範囲は core/dusk-village-map.js の表 */
    DUSK_SLUICE_BLOCKS.filter(b=> b.id === 'wallW' || b.id === 'wallE').forEach(b=>{
      addStaticBox((b.x0 + b.x1)/2, 0.9, (DUSK_SLUICE_Z.z0 + DUSK_SLUICE_Z.z1)/2,
                   b.x1 - b.x0, 1.8, DUSK_SLUICE_Z.z1 - DUSK_SLUICE_Z.z0, stoneMat, true);
    });
    // 歯車と鎖。止まっているが、錆びついてはいない ―― まだ動く
    duskGateGears = []; duskGateChains = [];
    [[-6.5, 5.6], [6.5, 5.6]].forEach(([gx, gy])=>{
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.22, 12), ironMat);
      gear.position.set(gx, gy, 448.6); gear.rotation.x = Math.PI/2; scene.add(gear);
      for(let i=0;i<10;i++){
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.24), ironMat);
        const a = i/10*Math.PI*2;
        tooth.position.set(gx + Math.cos(a)*1.08, gy + Math.sin(a)*1.08, 448.6);
        tooth.rotation.z = a; scene.add(tooth);
      }
      duskGateGears.push(gear);
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 6), ironMat);
      chain.position.set(gx, gy - 1.8, 448.9); scene.add(chain);
      duskGateChains.push(duskProp(chain, 'sway', {amp:0.02, freq:0.27}));
    });
    // 操作機構(レバー)と管理小屋
    post(2.6, 444, 1.0, 0.12);
    duskGateLever = board(2.6, 1.45, 444, 0.12, 0.9, 0.12, ironMat);
    duskGateLever.rotation.z = 0.5;
    house(-8, 443, 5.5, 6, 3.4, 'E');
    shelf(-9.5, 444.5, 1.6, 0);
    board(-7, 0.9, 442.5, 1.2, 0.08, 0.6, woodMat);
    lamp(4.5, 440);
    lamp(-6.4, 444.2);   // 管理小屋の中の灯り(WORK 6)
    /* 木製の足場(WORK 6)。門の手前を横に渡る板張りで、水門守が
       行き来する場所でもある ―― 「戦うために水門がある」のではなく、
       もともと見回りのための足場がそこにある、という形 */
    [[-9.5, 446.5], [9.5, 446.5]].forEach(([wx, wz])=> post(wx, wz, 1.0, 0.12));
    board(0, 0.24, 446.5, 20, 0.14, 1.6, plankMat);
    [-8, -4, 4, 8].forEach(px=> post(px, 446.5, 0.9, 0.09));
    // 水門の下、勢いを失った水路
    reeds(-11, 455, 4); reeds(11, 456, 4);

    // =====================================================================
    // ⑪ 村の奥 ―― 静かな大きい水面。人の手のものはほとんど無い
    // =====================================================================
    reeds(-24, 470, 7); reeds(24, 472, 7); reeds(-22, 492, 6); reeds(22, 490, 6);
    buoy(-14, 478, 0.2); buoy(15, 484, 0.18);
    boat(-18, 466, 2.4, 2.8);    // 流れ着いたまま誰も戻さなかった舟
    lamp(-9, 466, 0xc8b8ff);     // 奥だけ灯りの色が違う ―― もう村のものではない
    post(-9, 496, 1.2, 0.1); post(9, 496, 1.2, 0.1);

    // ⑫ ボスエリア ―― WORK 7 で「村の残響」を置く。今は何もいない静かな水面
    reeds(-16, 508, 6); reeds(16, 510, 6);
    buoy(-8, 520, 0.22); buoy(9, 524, 0.2);

    // ---- 扉 ----
    // 村の奥 → ボスエリア。村の奥の北の壁(z = 500、東西に走る)の開口 x -3〜3 を塞ぐ。
    // 通路は南北に走るので、扉は東西の壁に付く 'EW'。以前は 'NS'(南北の壁に付く、
    // 横道の扉の向き)で、門が通路に沿って 90° 回って立ち、当たり判定も
    // 開口の真ん中の細い板(x ±0.4)だけだった(CH1 follow-up B)
    buildDoor('duskBossDoor', 0, 500, 6, 0x2a2438, 'EW');
    /* 閂の門(CH1-COMP W3)。広場 → 商店街の表通り(広場の北の口 x -5〜5、z 370)。
       閂は商店街の側から掛けられていて、広場からは開かない(調べる表示も出さない)。
       裏通りから商店街へ回り込み、門の北側に寄ると閂を外す ―― 以後は広場への近道。
       村人が「水のほうへの道」を自分たちの側から閉ざした跡(手記の「――閉めた」と同じ) */
    duskBarDoor = buildDoor('duskBarDoor', 0, 370, 10, 0x3a2a1c, 'EW');
    duskBarDoor.locked = true;
    duskBarBeam = board(0, 1.25, 370.35, 10.4, 0.26, 0.26, darkWood);   // 閂(北側に渡した太い横木)
    registerProximityEvent(new THREE.Vector3(0, 0, 372), 1, '', [], {
      marker: false,
      area: {x0: -5, x1: 5, z0: 370.5, z1: 374},
      onEnter: ()=> openDuskBarDoor(),
    });
    // ---- ロア ----
    // 読まなくても本筋が分かる補助。後のシナリオイベントで意味を持つ程度に留める
    buildLoreNote(new THREE.Vector3(0, 0, 309), '朽ちた道標', [
      '「宵待ちの村へ ようこそ」',
      '文字の下に、小さく彫り足された跡がある。「――もう、誰も来ないと思っていた」'
    ], {kind:'sign', wall:false});
    buildLoreNote(new THREE.Vector3(-6.5, 0, 340.8), '広場の掲示板', [
      '「水門の見回り当番 ―― 今月は東の組」',
      '当番表の名前は、どれも途中から書かれなくなっている。'
    ], {kind:'sign', wall:false});
    buildLoreNote(new THREE.Vector3(3.6, 0, 368.6), '閂の掛かった門', [
      '門の向こう側から、太い閂が掛けられている。こちらからは外せない。',
      '水のほうへの道を、村の誰かが内側から閉ざしたらしい。'
    ], {kind:'sign', wall:false});
    buildLoreNote(new THREE.Vector3(-41.2, 0, 421.6), '見張りの交代表', [
      '「東の組 ―― 裏から回って水門へ」',
      '表の通りを使わない理由は、どこにも書かれていない。'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(-46.5, 0, 344.2), '魚屋の古い帳簿', [
      '売り上げの列が、ある日を境にぱたりと止まっている。',
      '最後の行にだけ、商いとは関係のない書き付けがあった。「水門の件について――」',
      'そこで文字は途切れている。'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(44.2, 0, 352.2), '床に転がった木彫りの舟', [
      '子供の手には少し大きい。舳先が丁寧に削り直してある。',
      '誰かが何度も直してやったのだろう。'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(-44, 0, 316.2), '修理台に残された道具', [
      '舟底の板は半分だけ張り替えられ、釘は箱に戻されないまま並んでいる。',
      '続きをやるつもりだったのは、間違いない。'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(-13, 0, 379.3), '商店の帳簿', [
      '「三の棚、空。四の棚、空」――棚卸しの覚書が、同じ言葉で埋まっている。',
      '最後の頁だけ、別の筆跡で一行。「誰も取りに来なかった」'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(-7, 0, 442.2), '水門の古い記録', [
      '開閉の日付と、水位の数字が几帳面に並んでいる。',
      'ある日を境に、水位の欄だけが空白になり、日付だけが続いていく。'
    ], {kind:'book'});
    /* 水門まわりの記録(WORK 6)。**全文は完成させない。**
       破れている / 読めない / 途中で切れている / 同じ行が何度も書き直されて
       いる ―― 「忘れようとした結果、記録だけが残った」形にしてある。
       商店街の「もう、その話は」と、魚屋の帳簿の切れた一行と並ぶもの */
    buildLoreNote(new THREE.Vector3(-9.4, 0, 444.6), '破れた貼り紙', [
      '「夜間の開放は禁止――」',
      'そこから下は破り取られている。画鋲の跡だけが四つ残っている。'
    ], {kind:'sign', wall:false});
    buildLoreNote(new THREE.Vector3(3.4, 0, 444), '見回りの控え', [
      '同じ一行が、何度も書き直されている。',
      '「水面に人影」――「水面に人かげ」――「水面に、」',
      '最後の行は書きかけで終わっている。筆はまだ手元にあったはずなのに。'
    ], {kind:'book'});
    buildLoreNote(new THREE.Vector3(-4.2, 0, 447.0), '足場に落ちていた紙片', [
      'ふやけて、ほとんど読めない。',
      '読み取れるのは二か所だけ。「子どもには――」と、「――閉めた」。'
    ], {kind:'book'});

    /* ---- 村へ入る(WORK 3) ----
       村の入口の部屋に入った時点で一度だけ。回り込んで素通りできないよう、
       円ではなく部屋そのものを判定域にしてある(registerRoomEvent) */
    registerRoomEvent(duskRoomById('gate'), 0, '', ()=>{
      playDuskEntranceScene();
      return null;   // 台詞は演出側が出すので、ここでは行を返さない
    }, {inset: 1.2});   // 入ってすぐ。奥まで歩かせてから始めない

    /* ---- 魚屋の記憶(WORK 3) ----
       帳場のあたりへ寄ったときだけ。中へ入らなければ起きない ―― 探索した
       人にだけ残っているものが見える、という作りにしてある */
    registerProximityEvent(new THREE.Vector3(-46.5, 0, 347), 4.2, '', null, {
      onEnter: ()=> playDuskFishMemory(),
    });

    /* ---- 住宅:子供の記憶(WORK 4) ----
       食卓のそば。玩具の舟と同じ部屋で、「明日、船に乗せて」という
       約束だけが残っている。船小屋を見たときに、プレイヤーが自分で
       結びつけられる余地を残すのが目的なので、ここでは説明しない */
    registerProximityEvent(new THREE.Vector3(45.5, 0, 350), 4.0, '', null, {
      onEnter: ()=> playDuskChildMemory(),
    });

    /* ---- 船小屋:船の記憶(WORK 4) ----
       舟の並ぶ水際。子供の声が一瞬だけ水の上から聞こえる。
       「この舟があの子の舟だった」とは言わない */
    registerProximityEvent(new THREE.Vector3(-42, 0, 307), 5.0, '', null, {
      onEnter: ()=> playDuskBoatMemory(),
    });

    /* ---- 商店街:忘れた方がいい(WORK 5) ----
       屋台のそば。ここだけは「失われたもの」ではなく「話さなかったこと」が
       残っている。魚屋の帳簿の切れた一行と並べられるように置いてある */
    registerProximityEvent(new THREE.Vector3(-2.7, 0, 384.5), 4.6, '', null, {
      onEnter: ()=> playDuskMarketMemory(),
    });

    /* ---- 商店街:複合戦闘(WORK 5) ----
       部屋に入った時点で始まる。時間差で水鏡の影 → 泡沫 → 写し身
       (core/encounter-waves.js)。全部出し切ったら終わりで、湧き足さない */
    registerRoomEvent(duskRoomById('market'), 0, '', ()=>{
      startDuskMarketFight();
      return null;   // 台詞は出さない。戦闘はそのまま始まる
    }, {inset: 1.2});

    /* ---- 水門前:水門を見る(WORK 5) ----
       建物が減り、水面が広がった所へ入った時点で一度だけ。倒した報酬では
       なく、場所の説明でもない ―― 門が見えたことへの、二人の短い相槌。
       部屋そのものを判定域にしてあるのは、端を回り込んでも必ず通るため
       (商店街の複合戦闘と同じ registerRoomEvent) */
    registerRoomEvent(duskRoomById('yard'), 0, '', ()=>{
      // 商店街で閃かずに抜けてきた場合は、ここで閃いてから水門を見る(WORK 12.1)
      playDuskInsight(()=> playDuskGateTalk());
      return null;
    }, {inset: 1.2});

    /* ---- 水門:水門守の残響(WORK 6) ----
       ボスらしい名乗りは入れない。レバーが勝手に動き、鎖が鳴り、
       誰もいないのに門がわずかに下がる ―― 「敵が現れた」ではなく
       「過去の動作が再生された」ように見せる(§13) */
    registerRoomEvent(duskRoomById('sluice'), 0, '', ()=>{
      playDuskWardenArrival();
      return null;
    }, {inset: 1.2});

    /* ---- 村の奥の終点:ボスの手前(WORK 6) ----
       水面がひとつに集まるだけ。戦闘は WORK 7 で始まる */
    registerProximityEvent(new THREE.Vector3(0, 0, 496), 6.0, '', null, {
      onEnter: ()=> playDuskBossPrelude(),
    });

    buildTownReturnPortal(new THREE.Vector3(0, 0, 288));
  }

  /* =========================================================
     村へ入る ―― 最初の違和感(WORK 3)

     説明で始めない。人がいないこと・水面が静かなこと・舟が揺れていることは
     もう歩いているだけで見えているので、ここで足すのは「一瞬だけ見えて、
     見直すと消えているもの」ひとつだけ。

     セミシームレスにするため、黒画面も場所の切り替えも挟まない ―― 同じ
     場所のまま、剣士が数歩先へ出て、魔法使いが立ち止まり、水面を見る。
     既存の playCutscene / cutsceneTurnTo / state.walkTo / spawnApparition を
     そのまま使っていて、新しいイベント基盤は作っていない。 ========================================================= */
  let duskGuestWalk = null;   // 演出中だけ、同行者を歩かせる({x, z, speed})

  // 同行者(剣士)を演出用に歩かせる。戦闘AI(updateGuestCompanion)は
  // 演出中そもそも回らないので、取り合いにはならない
  /* 剣士の合流地点(WORK 12.1)。森の道(湖畔の森道)は魔法使いがひとりで歩き、
     村に着く直前 ―― 木橋の袂で剣士が待っている。近づくと、斜め後ろに
     付いて歩き出す(updateGuestCompanion の waitAt)。入口の一幕
     (playDuskEntranceScene)は木橋を渡った先なので、そこでは必ず一緒にいる */
  const DUSK_GUEST_WAIT = {x: 1.8, z: 305.5, radius: 4.5, passZ: 309};
  function placeDuskGuestAtBridge(){
    if(!guestCompanion) return;
    guestCompanion.waitAt = Object.assign({}, DUSK_GUEST_WAIT);
    guestCompanion.pos.set(DUSK_GUEST_WAIT.x, 0, DUSK_GUEST_WAIT.z);
    guestCompanion.target = null;
    guestCompanion.group.position.set(DUSK_GUEST_WAIT.x, 0, DUSK_GUEST_WAIT.z);
    guestCompanion.group.rotation.y = Math.PI;   // 森の道(南)のほうを向いて待つ
  }

  function stepDuskGuestWalk(dt){
    if(!duskGuestWalk || typeof guestCompanion === 'undefined' || !guestCompanion) return;
    const g = guestCompanion;
    const dx = duskGuestWalk.x - g.pos.x, dz = duskGuestWalk.z - g.pos.z;
    const d = Math.hypot(dx, dz);
    if(d < 0.15){ duskGuestWalk = null; return; }
    const step = Math.min(d, (duskGuestWalk.speed || 3.0) * dt);
    g.pos.x += dx/d * step;
    g.pos.z += dz/d * step;
    /* 歩いている間は、支援 AI が普段歩くときと同じ上下の揺れを付ける(CH1-EXP X-4。
       08-loot-equipment.js updateGuestCompanion と同じ式)。滑って見えないように */
    g.bobT = (g.bobT || 0) + dt;
    g.group.position.set(g.pos.x, Math.sin(g.bobT*8)*0.015, g.pos.z);
    g.group.rotation.y = Math.atan2(dx, dz);
  }

  /* 村の演出の待ち時間(CH1-EXP X-2、core/cutscene-timing.js)。
     イベント地点に入ったら、すぐ会話が始まるように前置きは 0.5 秒まで。台詞を送った
     後、次の台詞までの無言の間は 0.3 秒まで(以前は記憶の声の後に 0.8〜1.2 秒、
     台詞も操作も無い間があった)。どちらも実時間で数えるので、低 fps でも延びない
     (演出で歩かせている・振り向かせている間だけは、動きに合わせてゲーム内の時間)。
     ボスの手前・撃破後・水門守の登場・撃破など、見せるための間は keep:true で残す */
  const DUSK_TEMPO = {firstLineSec: 0.5, gapSec: 0.3, realtime: true};

  const DUSK_MAGE = '魔法使い';
  const DUSK_KNIGHT = '剣士';

  function playDuskEntranceScene(){
    advanceDuskTime('entrance');   // 村に入った。ここから暮れ始める(CH1-EXP X-6b)
    // 水面の人影。村の西側、岸のすぐ外 ―― 歩いていける場所ではない
    const shadePos = new THREE.Vector3(-13, 0, 326);
    let shade = null;
    playCutscene([
      // 剣士が数歩先へ出る。魔法使い(プレイヤー)は歩度を落として止まる
      {t:0.05, run:()=>{
        if(typeof guestCompanion !== 'undefined' && guestCompanion){
          duskGuestWalk = {x: state.pos.x + 1.2, z: state.pos.z + 5.5, speed: 3.2};
        }
        state.walkTo = {vx: 0, vz: 1.1};
      }},
      {t:0.9, run:()=>{ state.walkTo = null; }},
      // 水面へ目をやる。カメラも一緒に回して、本人が見ているものを画面へ入れる
      {t:0.35, run:()=>{
        const yaw = Math.atan2(shadePos.x - state.pos.x, shadePos.z - state.pos.z);
        cutsceneTurnTo(yaw, 0.7, yaw + Math.PI);
        ambienceHold(4);        // 風がふっと止む。音を足さずに、鳴っていたものを止める
      }},
      {t:0.8, run:()=>{
        shade = spawnApparition(shadePos, {color:0x2a3b4a, fadeIn:1.1, fadeOut:1.3,
                                           maxOpacity:0.46, vanishDist:200});
        if(shade) shade.rotation.y = Math.PI;
        spawnDuskRipple(shadePos.x, shadePos.z, 1.2);
      }},
      // 人影が見えてから声をかけるまでの一拍は残す(人影のフェードとそろえる)
      {t:1.2, keep:true, run:()=> cutsceneLine('「……止まってください」', DUSK_MAGE)},
      {t:1.7, run:()=>{
        cutsceneLine('「どうした」', DUSK_KNIGHT);
        // 剣士が振り返る
        if(typeof guestCompanion !== 'undefined' && guestCompanion){
          duskGuestWalk = {x: state.pos.x - 0.8, z: state.pos.z + 2.0, speed: 3.4};
        }
      }},
      {t:1.8, run:()=> cutsceneLine('「水面に、人が映っていました。上には誰もいないのに」', DUSK_MAGE)},
      {t:2.0, run:()=> cutsceneLine('「……今は」', DUSK_KNIGHT)},
      {t:1.8, run:()=> cutsceneLine('「消えました。急いで帰ったのかもしれません」', DUSK_MAGE)},
      {t:2.0, run:()=> cutsceneLine('「水の中へか」', DUSK_KNIGHT)},
      {t:1.8, run:()=> cutsceneLine('「ええ。……すみません、今のは冗談です」', DUSK_MAGE)},
      // 剣士も観察して、自分で決める ―― 説明を待つ側にしない
      {t:2.0, run:()=>{
        cutsceneLine('「笑うところが分からん。……足元を見ておけ、濡れてる」', DUSK_KNIGHT);
        if(typeof guestCompanion !== 'undefined' && guestCompanion){
          duskGuestWalk = {x: state.pos.x + 1.0, z: state.pos.z + 4.0, speed: 2.6};
        }
      }},
      {t:2.0, run:()=> cutsceneLine('「はい。見ています」', DUSK_MAGE)},
      // 向き直って操作を返す
      {t:1.6, run:()=>{
        cutsceneHideLine();
        cutsceneTurnTo(0, 0.6, Math.PI);
      }},
      {t:0.7, run:()=>{
        state.dialogueActive = false;
        clearMovementInput(false);
      }},
    ], DUSK_TEMPO);
  }

  /* 魚屋の記憶(WORK 3)

     ここで暮らしていた人の、なんでもない一日の切れ端。説明はしない ――
     誰がいつ言ったのかも、なぜ聞こえるのかも明かさない。
     姿は輪郭だけを一瞬見せて、すぐ消える。 */
  let duskFishMemoryDone = false;
  function playDuskFishMemory(){
    if(duskFishMemoryDone) return;
    duskFishMemoryDone = true;
    playCutscene([
      {t:0.1, run:()=>{
        ambienceHold(6);
        sfx('woodCreak');
      }},
      // 帳場の内と外。二人ぶんの輪郭が、一瞬だけ重なって見える
      {t:0.7, run:()=>{
        spawnApparition(new THREE.Vector3(-46.5, 0, 344.2), {color:0x3a4550, fadeIn:1.2, fadeOut:1.1,
                                                             maxOpacity:0.42, vanishDist:200, facing:Math.PI});
        spawnApparition(new THREE.Vector3(-45.0, 0, 346.6), {color:0x3a4550, fadeIn:1.3, fadeOut:1.2,
                                                             maxOpacity:0.38, vanishDist:200});
      }},
      // 声は名前を持たない。誰なのかは言わない
      {t:1.3, run:()=> cutsceneLine('「……今日はこれだけか」', '')},
      {t:2.2, run:()=> cutsceneLine('「明日はもう少し獲れるさ」', '')},
      {t:2.4, run:()=>{
        cutsceneHideLine();
        spawnDuskRipple(-46.0, 346.0, 0.9);
      }},
      {t:1.0, run:()=> cutsceneLine('「……聞こえたか」', DUSK_KNIGHT)},
      {t:2.2, run:()=> cutsceneLine('「はい。まだ残っているんだと思います、ここに」', DUSK_MAGE)},
      {t:2.4, run:()=>{
        cutsceneHideLine();
        state.dialogueActive = false;
        clearMovementInput(false);
      }},
    ], DUSK_TEMPO);
  }

  /* 住宅の記憶 ―― 子供の約束(WORK 4)

     食卓のそば、玩具の舟が転がっている部屋で一度だけ。
     誰の声かも、いつのことかも言わない。船小屋で舟を見たときに、
     プレイヤーが自分で「さっきの約束」と結びつけられる余地を残す。 */
  let duskChildMemoryDone = false;
  function playDuskChildMemory(){
    if(duskChildMemoryDone) return;
    duskChildMemoryDone = true;
    playCutscene([
      {t:0.1, run:()=>{ ambienceHold(6); sfx('crockery'); }},
      // 食卓の椅子のあたりに、小さい輪郭がひとつ
      {t:0.8, run:()=>{
        spawnApparition(new THREE.Vector3(46.2, 0, 350.4), {color:0x46505c, fadeIn:1.2, fadeOut:1.1,
                                                            maxOpacity:0.40, vanishDist:200});
      }},
      {t:1.2, run:()=> cutsceneLine('「明日、船に乗せて!」', '')},
      {t:2.2, run:()=> cutsceneLine('「もう少し大きくなったらな」', '')},
      {t:2.2, run:()=> cutsceneLine('「……約束だよ」', '')},
      {t:2.4, run:()=> cutsceneHideLine()},
      /* 魔法使いは怪異の説明をしない。目に入ったものから推測するだけ */
      {t:0.8, run:()=> cutsceneLine('「……子どもの部屋ですね」', DUSK_MAGE)},
      {t:2.0, run:()=> cutsceneLine('「分かるのか」', DUSK_KNIGHT)},
      {t:1.9, run:()=> cutsceneLine('「玩具が小さいので。それと、椅子が三つで食器が四つあります」', DUSK_MAGE)},
      {t:2.4, run:()=> cutsceneLine('「……数が合わんな」', DUSK_KNIGHT)},
      {t:2.0, run:()=> cutsceneLine('「合いません。理由はまだ思いつきません」', DUSK_MAGE)},
      {t:2.2, run:()=>{
        cutsceneHideLine();
        state.dialogueActive = false;
        clearMovementInput(false);
      }},
    ], DUSK_TEMPO);
  }

  /* 船小屋の記憶 ―― 水の上から、さっきの声(WORK 4)

     住宅の約束と、目の前の舟を結びつけるのはプレイヤー。
     「この舟があの子の舟だった」とは言わない。 */
  let duskBoatMemoryDone = false;
  function playDuskBoatMemory(){
    if(duskBoatMemoryDone) return;
    duskBoatMemoryDone = true;
    playCutscene([
      {t:0.1, run:()=>{ ambienceHold(7); sfx('woodCreak'); }},
      // 水の上をひとつ、波紋が走る
      {t:0.7, run:()=>{
        spawnDuskRipple(-38.5, 303.5, 1.1);
        spawnDuskRipple(-36.0, 301.8, 0.8);
      }},
      {t:1.4, run:()=> cutsceneLine('「……ねえ、まだ?」', '')},
      {t:2.2, run:()=>{
        cutsceneHideLine();
        spawnDuskRipple(-41.0, 305.0, 0.9);
      }},
      {t:1.2, run:()=> cutsceneLine('「……舟だ」', DUSK_KNIGHT)},
      {t:2.0, run:()=> cutsceneLine('「ええ。直しかけのまま置いてあります」', DUSK_MAGE)},
      {t:2.2, run:()=> cutsceneLine('「乗せてやるつもりだったんだろうな」', DUSK_KNIGHT)},
      {t:2.4, run:()=> cutsceneLine('「……そう思います。確かめようがありませんが」', DUSK_MAGE)},
      {t:2.4, run:()=>{
        cutsceneHideLine();
        state.dialogueActive = false;
        clearMovementInput(false);
      }},
    ], DUSK_TEMPO);
  }

  /* 商店街の記憶 ―― 「もう、その話は」(WORK 5)

     これまでの記憶(魚屋・住宅・船小屋)は、失われたものを見せるものだった。
     ここだけは少し違う ―― 村人が何かを話したがらなかったことが残っている。

     何を恐れていたのかは言わない。魚屋の帳簿の「水門の件について――」と、
     ここの「もう、その話は――」が別の場所に置いてあるのは、プレイヤーが
     自分で並べられるようにするため。答えはこちらからは出さない。 */
  let duskMarketMemoryDone = false;
  function playDuskMarketMemory(){
    if(duskMarketMemoryDone) return;
    duskMarketMemoryDone = true;
    playCutscene([
      {t:0.1, run:()=>{ ambienceHold(6); sfx('crockery'); }},
      // 屋台をはさんで、輪郭がふたつ。向かい合ったまま動かない
      {t:0.7, run:()=>{
        spawnApparition(new THREE.Vector3(-2.7, 0, 383.0), {color:0x4a5260, fadeIn:1.1, fadeOut:1.0,
                                                            maxOpacity:0.38, vanishDist:200});
        spawnApparition(new THREE.Vector3(-2.7, 0, 386.0), {color:0x46505c, fadeIn:1.3, fadeOut:1.0,
                                                            maxOpacity:0.34, vanishDist:200});
      }},
      {t:1.3, run:()=> cutsceneLine('「あの話は、もういいだろ」', '')},
      {t:2.2, run:()=> cutsceneLine('「……子どもには」', '')},
      {t:2.2, run:()=> cutsceneLine('「だから、もういい。忘れた方がいい」', '')},
      {t:2.4, run:()=> cutsceneHideLine()},
      /* 剣士が先に口を開く。WORK 3 では魔法使いが観察して剣士が聞き返す
         側だったが、ここでは剣士のほうが「何の話だ」と拾いにいく ――
         観察する役が入れ替わる、それだけの変化にとどめる */
      {t:0.9, run:()=> cutsceneLine('「……何の話を、やめたんだ」', DUSK_KNIGHT)},
      {t:2.2, run:()=> cutsceneLine('「分かりません。ただ、魚屋の帳簿にも途中で切れた一行がありました」', DUSK_MAGE)},
      {t:2.6, run:()=> cutsceneLine('「水門の、と書いてあったやつか」', DUSK_KNIGHT)},
      {t:2.2, run:()=> cutsceneLine('「覚えていたんですね」', DUSK_MAGE)},
      {t:2.0, run:()=> cutsceneLine('「お前が読み上げたからな」', DUSK_KNIGHT)},
      {t:2.2, run:()=>{
        cutsceneHideLine();
        state.dialogueActive = false;
        clearMovementInput(false);
      }},
    ], DUSK_TEMPO);
  }

  /* =========================================================
     商店街の複合戦闘(WORK 5)

     水鏡の影・泡沫・写し身を、同じ場所に時間差で出す。目的は数で押すこと
     ではなく、「いま何に注意するか」を1つずつ足していくこと ――
     どれから倒してもよく、正解の順番は決めていない(core/encounter-waves.js)。

     ・水鏡の影 → 見分ける
     ・泡沫     → 増える前に散らす
     ・写し身   → 自分の攻撃が返ってくる

     出し切ったら終わり。倒しても湧き足さない。 ========================================================= */
  let duskMarketFight = null;   // {t, fired:[], flags:{}} 交戦が始まってからの経過

  function startDuskMarketFight(){
    if(duskMarketFight) return;
    duskMarketFight = {t: 0, fired: [], flags: {}};
  }

  function stepDuskMarketFight(dt){
    if(!duskMarketFight) return;
    /* 記憶や会話の最中は波を進めない(WORK 5)。演出中も村の時間は
       動き続ける(WORK 3 で updateDuskVillage を演出中も回している)ので、
       このままだと20秒の記憶を見ている間に次の波が湧いてしまう ――
       話が終わったところから数え直す */
    if(state.dialogueActive) return;
    duskMarketFight.t += dt;
    /* 合図。水鏡の影に手を出したか(交戦)、分裂したか。時間だけに縛ると
       棒立ちでも進み、合図だけに縛ると手を出さないと進まないので、
       どちらか早いほうで次の波が出る */
    let engaged = false, split = false, alive = 0;
    for(let i=0;i<enemies.length;i++){
      const e = enemies[i];
      if(!e || e.dead || !e.duskMarket) continue;
      alive++;
      if(e.atkType === 'mirror' && !e.mirrorCloneOf){
        if(e.triggered) engaged = true;
        if(e.mirrorSplit) split = true;
      }
    }
    duskMarketFight.flags.mirrorEngaged = engaged;
    duskMarketFight.flags.mirrorSplit = split;

    const due = dueWaves(PROVISIONAL_MARKET_WAVES, duskMarketFight.t,
                         duskMarketFight.flags, duskMarketFight.fired);
    due.forEach(w=>{
      duskMarketFight.fired.push(w.id);
      spawnDuskMarketWave(w);
    });

    /* 戦闘後の静けさ(§11)。出し切って、残りがいなくなったら
       それで終わり ―― 次の敵は出さない。終わったことは言葉では言わず、
       風と水音が戻るだけ */
    if(alive === 0 && allWavesFired(PROVISIONAL_MARKET_WAVES, duskMarketFight.fired)
       && duskMarketFight.t > 1){
      duskMarketFight = null;
      ambienceHold(4);
      // 戦いのあと、剣士の動きを見ていた魔法使いが「観測の灯」を閃く(WORK 12.1)
      playDuskInsight();
    }
  }

  /* 観測の灯の閃き(WORK 12.1、Chapter 1 の Skill 2)。

     全体基本仕様の閃きの型そのまま ―― 同行者の「行動」を見て、主人公自身が
     気づく。剣士は教えない。商店街の複合戦闘(村の中盤)を終えた直後に一度だけ。
     戦わずに先へ抜けた場合は、水門前に入ったところで同じ場面が起きる
     (閃かないまま村の奥へ進むことはない)。

     「レベルが上がったから覚える」ではない。習得は既存の
     grantChapter1Skill2()(core/chapter1-skills.js の learnSkill2)で、
     閃いた瞬間に自動で装備される */
  let duskInsightDone = false;
  function playDuskInsight(onDone){
    /* 閃き。ここで一段暮れる(CH1-EXP X-6b)。商店街の戦闘の後でも、水門前で
       閃いても同じ段へ。既に閃いていて演出を飛ばす場合も、ここを通れば上がる
       (目標は上がるだけなので、二度呼ばれても変わらない) */
    advanceDuskTime('insight');
    if(duskInsightDone || state.learnedSkill2){
      if(onDone) onDone();
      return;
    }
    duskInsightDone = true;
    playCutscene([
      {t:0.2, run:()=> ambienceHold(6)},
      {t:0.4, run:()=> cutsceneLine('「……さっき、斬る前に一度止まりましたね」', DUSK_MAGE)},
      {t:0.1, run:()=> cutsceneLine('「どれが本物か分からんうちは、振らん。見てから決めた」', DUSK_KNIGHT)},
      {t:0.1, run:()=> cutsceneLine('「見てから、決める」', DUSK_MAGE)},
      {t:0.1, run:()=>{
        cutsceneHideLine();
        grantChapter1Skill2();
        spawnDuskRipple(state.pos.x, state.pos.z, 1.4);
      }},
      {t:0.6, run:()=> cutsceneLine('「……なら、見えるようにすればいいんですね」', DUSK_MAGE)},
      {t:0.1, run:()=> cutsceneLine('「何をする気だ」', DUSK_KNIGHT)},
      {t:0.1, run:()=> cutsceneLine('「灯りを。答えは出ません。でも、違いは見えます」', DUSK_MAGE)},
      {t:0.1, run:()=>{
        cutsceneHideLine();
        state.dialogueActive = false;
        clearMovementInput(false);
        if(onDone) onDone();
      }},
    ], DUSK_TEMPO);
  }

  /* 波を1つ出す。出現位置は商店街の端 ―― プレイヤーの真上に湧かせない。
     「気づいたら隣にいた」ではなく「向こうから来る」ように見せるため */
  const DUSK_MARKET_SPOTS = {
    mirror: [[-9, 396]],
    foam:   [[9, 374], [12, 377], [6, 372]],
    copy:   [[-15, 397]],
  };
  function spawnDuskMarketWave(w){
    const spots = DUSK_MARKET_SPOTS[w.spawn] || [];
    for(let i=0;i<w.count;i++){
      const [x, z] = spots[i % spots.length];
      let en = null;
      if(w.spawn === 'mirror')      en = buildDuskMirrorShade(x, z);
      else if(w.spawn === 'foam')   en = buildDuskFoam(x, z);
      else if(w.spawn === 'copy')   en = buildDuskCopyShade(x, z);
      if(!en) continue;
      en.duskMarket = true;
      enemies.push(en);
      spawnDuskRipple(x, z, 1.0);
    }
    if(w.spawn !== 'mirror') sfx('bossWake');
  }

  /* 水門前の会話(WORK 5)。水門が見えた所で一度だけ。
     魔法使いは「分かりません」で止まらない ―― 仮説を持って調べる側へ進む */
  let duskGateTalkDone = false;
  function playDuskGateTalk(){
    if(duskGateTalkDone) return;
    duskGateTalkDone = true;
    playCutscene([
      {t:0.2, run:()=> ambienceHold(5)},
      {t:1.0, run:()=> cutsceneLine('「この水門、閉じたままですね」', DUSK_MAGE)},
      {t:2.2, run:()=> cutsceneLine('「閉じた理由があるのか」', DUSK_KNIGHT)},
      {t:2.0, run:()=> cutsceneLine('「あると思います」', DUSK_MAGE)},
      {t:1.9, run:()=> cutsceneLine('「調べるか」', DUSK_KNIGHT)},
      {t:1.8, run:()=> cutsceneLine('「ええ」', DUSK_MAGE)},
      {t:2.0, run:()=>{
        cutsceneHideLine();
        state.dialogueActive = false;
        clearMovementInput(false);
      }},
    ], DUSK_TEMPO);
  }

  /* =========================================================
     水門(WORK 6)

     門扉は閉じた状態で建ててある。水門守の残響が引くとレバーと鎖が
     わずかに動き、撃破するとゆっくり上がる ―― 撃破直後にリザルトを
     出さず、鎖が止まる → 歯車が回る → 門が上がる → 水音が変わる、を
     そのままゲーム内の時間で見せる。 ========================================================= */
  // 水門守がレバーを引いている間だけ、レバーと鎖が動く(0..1)
  /* 閂を外す(CH1-COMP W3)。門の北側(商店街)に寄った時だけ ―― 広場の側からは届かない */
  function openDuskBarDoor(){
    if(!duskBarDoor || duskBarDoor.opened) return;
    duskBarDoor.locked = false;
    swingOpen(duskBarDoor, true);
    if(duskBarBeam){ duskBarBeam.rotation.z = 1.2; duskBarBeam.position.set(5.6, 0.5, 370.9); }
    sfx('woodCreak');
    spawnLog('🚪 閂を外した。広場への近道が開いた');
  }

  function pullDuskGateLever(prog){
    if(!duskGateLever) return;
    const k = Math.sin(Math.max(0, Math.min(1, prog)) * Math.PI);
    duskGateLever.rotation.z = 0.5 - k * 0.7;
    duskGateChains.forEach((c, i)=>{
      if(c && c.obj) c.obj.position.y = 3.8 - k * 0.22 * (i ? 1 : -1);
    });
    if(duskGateOpenT <= 0 && k > 0.85 && (duskGateCreakCD -= 0.016) <= 0){
      duskGateCreakCD = 1.4;
      sfx('woodCreak');
    }
  }
  let duskGateCreakCD = 0;

  /* 撃破後の開放。カットシーンで画面を止めず、歩ける状態のまま
     門が上がっていく(§14)。 */
  function openDuskWaterGate(){
    if(duskGateOpening || duskGateOpenT > 0) return;
    duskGateOpening = true;
    sfx('bossWake');
    ambienceHold(3);
  }

  function stepDuskWaterGate(dt){
    if(!duskGateOpening || duskGateOpenT >= 1) return;
    duskGateOpenT = Math.min(1, duskGateOpenT + dt * 0.14);   // 約7秒かけて上がる
    if(duskGateSlab) duskGateSlab.position.y = 1.7 + duskGateOpenT * 3.3;
    duskGateGears.forEach((g, i)=> g.rotation.z += dt * 1.1 * (i ? 1 : -1));
    duskGateLever && (duskGateLever.rotation.z = 0.5 - duskGateOpenT * 0.9);
    if((duskGateChainCD -= dt) <= 0){ duskGateChainCD = 0.9; sfx('woodCreak'); }
    // 水門の下で、止まっていた水が動き出す
    if((duskGateFlowCD -= dt) <= 0){
      duskGateFlowCD = 0.5;
      spawnDuskRipple(-3 + Math.random()*6, 452 + Math.random()*4, 0.8 + Math.random()*0.6);
    }
    if(duskGateOpenT >= 1){
      // 通れるようになる。壁を外すのは開き切ってから
      const idx = walls.indexOf(duskGateWall);
      if(idx >= 0) walls.splice(idx, 1);
      duskGateOpening = false;
      spawnLog('🌊 水門が開いた');
    }
  }
  let duskGateChainCD = 0, duskGateFlowCD = 0;

  /* =========================================================
     村の残響 ―― 宵待ちの村のボス(WORK 7)

     一人の怨念ではない。魚を獲ったこと、家で過ごした時間、舟を出したこと、
     商いをしたこと、水門を開け閉めしたこと、誰かを待った時間 ――
     忘れられた村の記憶が混ざったもの。だから黒幕はいないし、倒しても
     誰かが帰ってくるわけでもない。

     ボスAIは既存のものをそのまま使い、村で覚えた4つを場に出す層だけを
     足してある(stepDuskEchoLayer / core/village-echo.js)。 */
  function buildDuskVillageEcho(){
    const en = buildBoss(new THREE.Vector3(0, 0, 520), {
      /* 扉(duskBossDoor)は bossDoorKey に登録していない ―― 扉は村の奥と
         ボスエリアの境として残るが、目覚めの条件は既存の「近づいたら」
         だけにしてある。ボスは水面の真ん中(z=520)にいて、扉(z=500)を
         通らずに 6 ユニットまで近づく道は無いので、通常プレイの挙動は
         扉を条件にした場合と変わらない。こうしてあるのは、
         Scenario Test Mode の地点ジャンプで扉を跨いで入った時にも
         ボスが眠ったままにならないようにするため */
      key:'duskEcho',
      /* 体の色は褪せたセピア(CH1-COMP W3、core/dusk-enemies.js)。被弾の白から戻す色(en.baseColor)と
         同じ値にする。目・オーラ・弾の色は今のまま */
      bodyColor:VILLAGE_PALETTE.echoBoss.main, emissive:VILLAGE_PALETTE.echoBoss.shade,
      eyeColor:0xbfe0ec, auraColor:0x8fc8d8,
      projColor:0x8fc8d8,
      /* HPで長引かせない(§9)。覚えたことを組み合わせて戦う場なので、
         殴る回数ではなく判断の回数で決まるようにしてある */
      hpMax:760, atk:30, speed:1.7, xp:260,
      dialogueName:'村の残響',
      /* 名乗らない。誰かが喋っているのではなく、village が覚えている
         ことがそのまま声になっているだけ ―― 「実は○○だった」を出さない */
      dialogueLines:[
        '水面がゆっくりと盛り上がり、いくつもの輪郭が重なって、人のかたちになる。',
        '「……まだ、誰も来ない」',
        '「網は干したままだ」「舟は明日出す」「棚が空いている」「水門は、閉めた」',
        '声はどれも別々の時間のもので、どれも途中で切れている。'
      ],
      ambushDialogueLines:[
        '重なった輪郭が、こちらを向いた。',
        '「……忘れないで」'
      ],
      repeatDialogueLines:[
        '水面がまた盛り上がる。前と同じ場所、前と同じかたち。',
        '「……まだ、誰も来ない」'
      ],
      clearName:'村の残響',
      clearFlavor:'重なっていた輪郭がほどけ、ひとつずつ水面へ戻っていった。',
      rewardLoot:{type:'gem', name:'水底に沈んだ木札', icon:'💎', color:0x8fc8d8}
    });
    en.baseColor = VILLAGE_PALETTE.echoBoss.main;
    en.decoyKind = 'mirror';   // 水面に映るものを追う ―― 幻影歩法も通常どおり効く
    duskBossRef = en;
    return en;
  }

  /* =========================================================
     記憶の解放 → 最後の記憶 → 夜明け(WORK 7)

     撃破した瞬間に結果画面を出さない。散らばっていた記憶が水面へ戻り、
     最後にひとつだけ残って、夜が明ける ―― そこまでを見せてから、
     いつもの結果画面へ渡す(洋館の playMansionReunion と同じ作り)。

     長いムービーにはしない。説明もしない。 ========================================================= */
  function playDuskEpilogue(onDone){
    /* 水面に戻っていく記憶。村で実際に通った場所の順に、
       ボスのまわりの水面へ散らしていく ―― 「これは○○さんの記憶です」
       とは言わない。歩いた人にだけ、見覚えがある */
    const SPOTS = [
      {x:-11, z:512}, {x: 10, z:514}, {x:-7, z:518},
      {x:  9, z:520}, {x:-12, z:524}, {x: 6, z:526},
    ];
    let i = 0;
    const releaseOne = ()=>{
      const p = SPOTS[i % SPOTS.length]; i++;
      spawnDuskRipple(p.x, p.z, 1.0 + Math.random()*0.6);
      spawnApparition(new THREE.Vector3(p.x, 0, p.z), {color:0x6a8090, fadeIn:1.2,
                       fadeOut:1.1, maxOpacity:0.30, vanishDist:200});
      sfx('chime');
    };
    playCutscene([
      {t:0.3, run:()=>{ ambienceHold(9); addShake(0.08); }},
      // 散らばっていたものが、ひとつずつ水面へ戻る
      {t:0.9, keep:true, run:releaseOne},
      {t:0.8, keep:true, run:releaseOne},
      {t:0.8, keep:true, run:releaseOne},
      {t:0.9, keep:true, run:releaseOne},
      {t:0.8, keep:true, run:releaseOne},
      {t:0.9, keep:true, run:releaseOne},
      // それが真ん中へ集まって、ひとつになる
      {t:1.2, keep:true, run:()=>{
        spawnDuskRipple(0, 520, 2.6);
        spawnApparition(new THREE.Vector3(0, 0, 520), {color:0x7f98a8, fadeIn:1.6,
                         fadeOut:2.0, maxOpacity:0.34, vanishDist:200});
        ambienceHold(7);
      }},
      // 最後の記憶。これ以上は足さない
      {t:2.0, keep:true, run:()=> cutsceneLine('「……ありがとう。」', '')},
      {t:2.6, run:()=>{ cutsceneHideLine(); duskDawnStart(); }},
      // 夜が明けていく(既存の時間帯システムをそのまま進めるだけ)
      {t:3.0, keep:true, run:()=> sfx('chime')},
      {t:2.4, keep:true, run:()=> cutsceneLine('「……残ったんですね」', DUSK_MAGE)},
      {t:2.2, run:()=> cutsceneLine('「何が」', DUSK_KNIGHT)},
      {t:2.0, run:()=> cutsceneLine('「……消えたわけじゃない、ということです」', DUSK_MAGE)},
      {t:2.4, run:()=> cutsceneLine('「……残るなら、それでいい」', DUSK_KNIGHT)},
      {t:2.6, run:()=>{
        cutsceneHideLine();
        state.dialogueActive = false;
        clearMovementInput(false);
        if(onDone) onDone();
      }},
    ], DUSK_TEMPO);
  }

  // 夜明けを始める。進行そのものは stepDuskDawn が毎フレーム進める
  function duskDawnStart(){ duskDawnRising = true; }
  let duskDawnRising = false;
  function stepDuskDawn(dt){
    if(!duskDawnRising || duskDawnT >= 1) return;
    duskDawnT = Math.min(1, duskDawnT + dt * 0.10);   // 約10秒かけて明ける
    if((duskDawnBirdCD -= dt) <= 0){
      duskDawnBirdCD = 3.5 + Math.random()*3;
      sfx('chime');       // 遠くの鳥。専用の音は足さず、既存の音を弱く使う
    }
    // 水音が戻る。止まっていた水面に、ゆっくり波紋が増える
    if((duskDawnRippleCD -= dt) <= 0){
      duskDawnRippleCD = 1.2;
      spawnDuskRipple(-18 + Math.random()*36, 500 + Math.random()*30, 0.6 + Math.random()*0.5);
    }
  }
  let duskDawnBirdCD = 0, duskDawnRippleCD = 0;

  /* 水門守の残響(WORK 6)。AIは updateKeeperAI(07-ai-combat.js)、
     残響の数値は core/warden-echo.js。ここは「どんな個体か」だけ。
     中ボス扱いだが、硬さで強くしていない ―― 強さは「過去の行動が
     残っている」という性質そのもの。 */
  function buildDuskWardenEcho(x, z){
    // 見た目は重い門番(CH1-COMP W3、dressVillageEnemy)。数値は今のまま
    const en = buildEnemy(new THREE.Vector3(x, 0, z), duskEnemyVariant('warden', {
      hp:900, atk:36, speed:2.2, atkType:'keeper',
      xp:320, goldBonus:[70, 95],
    }));
    en.baseColor = VILLAGE_PALETTE.warden.main;
    en.decoyKind = 'keeper';
    en.group.scale.multiplyScalar(WARDEN_SCALE);   // 一回り大きい(1.18)。見失わないように
    en.hitRadius = villageHitRadius('warden', WARDEN_SCALE);   // 当たりも見た目の広がりに合わせる
    en.onDefeat = ()=> onDuskWardenDefeated();
    en.midbossName = '水門守の残響';
    en.midbossFlavor = '引く手が止まり、鎖の音だけが少し遅れて消えていった。';
    en.strongMob = true;
    return en;
  }

  /* 撃破。残響が消え、鎖が止まり、門が上がる。
     リザルトも黒画面も挟まない ―― 歩けるまま、世界の側が変わる */
  function onDuskWardenDefeated(){
    advanceDuskTime('warden');   // 水門守の撃破。夜に近づく(CH1-EXP X-6b)
    clearKeeperEchoes();
    if(duskGateLever) duskGateLever.rotation.z = 0.5;
    openDuskWaterGate();
    playCutscene([
      // 撃破の直後、門が動き出すのを見せる間(撃破の演出として残す)
      {t:2.0, keep:true, run:()=> cutsceneLine('「……閉めようと、していましたね」', DUSK_MAGE)},
      {t:2.4, run:()=> cutsceneLine('「ずっとか」', DUSK_KNIGHT)},
      {t:2.0, run:()=> cutsceneLine('「ずっとです。何度も、同じところで」', DUSK_MAGE)},
      {t:2.4, run:()=>{
        cutsceneHideLine();
        state.dialogueActive = false;
        clearMovementInput(false);
      }},
    ], DUSK_TEMPO);
  }

  /* 水門守の残響の登場(WORK 6)

     大きなボス演出は入れない(§13)。レバーが動き、鎖が鳴り、誰もいない
     のに門が少し軋む ―― そのあとで、水面から形が起き上がる。
     「敵が登場した」のではなく「過去の動作が再生された」ように見せる。 */
  let duskWardenSpawned = false;
  function playDuskWardenArrival(){
    if(duskWardenSpawned) return;
    duskWardenSpawned = true;
    playCutscene([
      {t:0.2, run:()=> ambienceHold(7)},
      // 誰もいないのにレバーが動く
      {t:0.6, keep:true, run:()=>{ pullDuskGateLever(0.5); sfx('woodCreak'); }},
      {t:0.7, keep:true, run:()=>{ pullDuskGateLever(1.0); spawnDuskRipple(2.6, 445.6, 0.8); }},
      {t:0.6, keep:true, run:()=>{ pullDuskGateLever(0); sfx('woodCreak'); }},
      // 門がわずかに軋んで、また止まる
      {t:0.7, keep:true, run:()=>{
        if(duskGateSlab) duskGateSlab.position.y = 1.62;
        addShake(0.06);
      }},
      {t:0.5, keep:true, run:()=>{ if(duskGateSlab) duskGateSlab.position.y = 1.7; }},
      // 水面に、引いていた人の形
      {t:0.7, keep:true, run:()=>{
        spawnDuskRipple(2.6, 445.6, 1.5);
        spawnApparition(new THREE.Vector3(2.6, 0, 445.4), {color:0x7fb0c4, fadeIn:1.2,
                         fadeOut:1.0, maxOpacity:0.36, vanishDist:200});
      }},
      {t:0.9, run:()=> cutsceneLine('「……誰も、いませんね」', DUSK_MAGE)},
      {t:2.0, run:()=> cutsceneLine('「いるさ。さっきまで動いてた」', DUSK_KNIGHT)},
      {t:2.2, run:()=>{
        cutsceneHideLine();
        // ここで初めて本体が起き上がる
        const en = buildDuskWardenEcho(2.6, 446.0);
        en.triggered = true;
        enemies.push(en);
        sfx('bossWake');
        addShake(0.14);
        spawnDuskRipple(2.6, 446.0, 2.0);
        state.dialogueActive = false;
        clearMovementInput(false);
      }},
    ], DUSK_TEMPO);
  }

  /* =========================================================
     村の奥 ―― 静かな時間(WORK 6)

     敵を出さない。ここでやるのは「歩いてきた場所を、水面の側から
     もう一度見せる」ことだけ。

     台詞で village の過去を説明しない(§17)。水面に一瞬だけ人影や舟が
     重なるだけで、それが何だったかはプレイヤーが決める ―― 魚屋も
     住宅も船小屋も商店街も、もう歩いてきた場所なので、説明は要らない。
  ========================================================= */
  /* 奥へ進むにつれて、順に1つずつ。z が進んだ距離で出す ――
     時間で出すと、立ち止まっている人には全部出て、急ぐ人には何も
     出ない。歩いた人にだけ見えるものにしてある */
  const DUSK_DEEP_MEMORIES = [
    {z: 466, x: -13, line: '「明日はもう少し獲れるさ」',   ripple: 1.0},   // 魚屋(WORK 3)
    {z: 472, x:  12, line: '「明日、船に乗せて!」',        ripple: 0.9},   // 住宅(WORK 4)
    {z: 478, x: -10, line: '「……ねえ、まだ?」',           ripple: 1.1},   // 船小屋(WORK 4)
    {z: 485, x:  11, line: '「忘れた方がいい」',            ripple: 0.8},   // 商店街(WORK 5)
    {z: 492, x:  -8, line: '「水門の件について――」',        ripple: 1.2},   // 水門(WORK 2/6)
  ];
  let duskDeepSeen = 0;
  let duskDeepCD = 0;

  function stepDuskDeepMemories(dt){
    if(duskDeepCD > 0) duskDeepCD -= dt;
    if(duskDeepSeen >= DUSK_DEEP_MEMORIES.length) return;
    if(state.dialogueActive || duskDeepCD > 0) return;
    const m = DUSK_DEEP_MEMORIES[duskDeepSeen];
    if(state.pos.z < m.z) return;
    duskDeepSeen++;
    duskDeepCD = 2.5;   // 続けざまには出さない
    /* 会話にしない ―― 画面を止めず、歩いている足は止まらない。
       水面に一瞬だけ人影が重なり、声が一行だけ流れる */
    spawnApparition(new THREE.Vector3(m.x, 0, m.z + 3), {color:0x4a5a68, fadeIn:0.9,
                     fadeOut:1.2, maxOpacity:0.30, vanishDist:200});
    spawnDuskRipple(m.x, m.z + 3, m.ripple);
    spawnLog(m.line);
    sfx('chime');
  }

  /* ボスの手前(WORK 6)。村の奥の終点で、いままでの水面がひとつに
     集まる。**ここでは戦闘を始めない**(村の残響は WORK 7)。 */
  let duskBossPreludeDone = false;
  function playDuskBossPrelude(){
    if(duskBossPreludeDone) return;
    advanceDuskTime('prelude');   // ボスの手前。夜(CH1-EXP X-6b)
    duskBossPreludeDone = true;
    playCutscene([
      {t:0.2, run:()=> ambienceHold(8)},
      // 離れた水面から、ひとつずつ
      {t:0.9, keep:true, run:()=>{ spawnDuskRipple(-12, 494, 1.2); spawnApparition(
        new THREE.Vector3(-12, 0, 494), {color:0x4a5a68, fadeIn:1.0, fadeOut:1.4,
                                         maxOpacity:0.28, vanishDist:200}); }},
      {t:1.4, keep:true, run:()=>{ spawnDuskRipple(11, 496, 1.0); spawnApparition(
        new THREE.Vector3(11, 0, 496), {color:0x46505c, fadeIn:1.0, fadeOut:1.4,
                                        maxOpacity:0.26, vanishDist:200}); }},
      {t:1.4, keep:true, run:()=>{ spawnDuskRipple(-6, 498, 0.9); spawnDuskRipple(7, 497, 0.8); }},
      // それが真ん中へ寄っていく
      {t:1.6, keep:true, run:()=>{
        spawnDuskRipple(0, 498, 1.6);
        spawnApparition(new THREE.Vector3(0, 0, 498.5), {color:0x3f4a58, fadeIn:1.4,
                         fadeOut:1.8, maxOpacity:0.34, vanishDist:200});
        sfx('bossWake');
      }},
      {t:2.2, run:()=> ambienceHold(6)},
      /* §17 の通り、ここで村の過去を説明させない。
         魔法使いは「広く感じます」としか言わない ―― 村が広がったのでは
         なく、知っている場所が増えただけ */
      {t:1.0, run:()=> cutsceneLine('「……最初より、広く感じます」', DUSK_MAGE)},
      {t:2.4, run:()=> cutsceneLine('「村は変わってない」', DUSK_KNIGHT)},
      {t:2.2, run:()=> cutsceneLine('「知っている場所が増えたからでしょう」', DUSK_MAGE)},
      {t:2.4, run:()=>{
        cutsceneHideLine();
        state.dialogueActive = false;
        clearMovementInput(false);
      }},
    ], DUSK_TEMPO);
  }

  /* 記憶漁師(WORK 5)。AIは updateFisherAI(07-ai-combat.js)、
     網の時間と落ち先は core/memory-fisher.js。ここは「どんな個体か」だけ。
     強モブ扱いだが、硬さで強くしていない ―― 「過去を狙う」という
     性質そのものが強さになる。 */
  function buildDuskFisher(x, z){
    // 見た目は背を丸めた漁師(CH1-COMP W3、dressVillageEnemy)。数値は今のまま
    const en = buildEnemy(new THREE.Vector3(x, 0, z), duskEnemyVariant('fisher', {
      hp:520, atk:34, speed:2.3, atkType:'fisher',
      xp:180, goldBonus:[38, 54],
    }));
    en.baseColor = VILLAGE_PALETTE.fisher.main;
    en.decoyKind = 'fisher';
    en.netCD = 1.2;
    en.netWindupT = 0;
    return en;
  }

  /* 水鏡の影(WORK 3)。AIは updateMirrorShadeAI(07-ai-combat.js)、
     観察できる差の数値は core/mirror-shade.js。ここは「どんな個体か」だけ。
     spawnEnemies() から呼ばれる(生成と enemies への登録は向こうの担当) */
  function buildDuskMirrorShade(x, z){
    // 見た目は水面に映った村人(CH1-COMP W3、dressVillageEnemy。分身も同じ作り)。数値は今のまま
    const en = buildEnemy(new THREE.Vector3(x, 0, z), duskEnemyVariant('mirror', {
      hp:260, atk:30, speed:2.2, atkType:'mirror',
      xp:104, goldBonus:[22, 34],
    }));
    en.baseColor = VILLAGE_PALETTE.mirror.main;
    en.mirrorSplit = false;
    en.mirrorClones = [];
    en.mirrorReformT = 0;
    en.decoyKind = 'mirror';
    return en;
  }

  /* 泡沫の群れ(WORK 4)。1体は弱く、放っておくと増える。
     増殖の上限と間隔は core/foam-swarm.js、AIは updateFoamAI。 */
  function buildDuskFoam(x, z){
    // 見た目は泡の塊(CH1-COMP W3、dressVillageEnemy)。数値は今のまま
    const en = buildEnemy(new THREE.Vector3(x, 0, z), duskEnemyVariant('foam', {
      hp:56, atk:16, speed:2.9, atkType:'foam',
      xp:22, goldBonus:[3, 7],
    }));
    en.group.scale.multiplyScalar(FOAM_SCALE);   // 0.62(今の値)
    // 当たりの半径は見た目の塊の広がり × 0.62(以前は拡大前の胴の球のままで、見た目より広かった)
    en.hitRadius = foamHitRadius(FOAM_SCALE);
    en.foamGrowT = Math.random() * 2.0;
    en.decoyKind = 'foam';
    return en;
  }

  /* 写し身(WORK 4)。プレイヤーの直前の一撃を1回だけ返す。
     Attack Snapshot は core/attack-snapshot.js、AIは updateCopyShadeAI。 */
  function buildDuskCopyShade(x, z){
    // 見た目は色を抜かれた長い外套の写し(CH1-COMP W3、dressVillageEnemy)。数値・弾の色は今のまま
    const en = buildEnemy(new THREE.Vector3(x, 0, z), duskEnemyVariant('copy', {
      hp:230, atk:26, speed:2.4, atkType:'copy',
      xp:112, goldBonus:[24, 36],
    }));
    en.baseColor = VILLAGE_PALETTE.copy.main;
    en.decoyKind = 'copy';
    en.copyState = 'watch';
    return en;
  }

  /* =========================================================
     宵待ちの村の敵の姿(CH1-COMP W3-E / DEC-008)

     村の 5 種は以前、全部が同じ「頭巾をかぶった浮く毛玉」(汎用の 'wraith')で、
     色と大きさだけが違った。洋館の敵と同じ作り方(buildEnemy の独自の胴の約束)で、
     種類ごとに「何をする敵か」が形・姿勢・持ち物で読めるように作り直す:

       水鏡の影   … 水面に映った村人。肩掛けと頭巾、裾が足元の映り込みへ溶ける。浮く。
                    溜めで両腕を後ろへ引き(本体ほど深い)、全周を薙ぐ。本体と分身は同じ姿
       泡沫       … 3〜4 個の泡の塊。低く漂い、増える前に泡が膨らむ。触れると弾ける
       写し身     … 色を抜かれた長い外套と帽子、顔は暗い水。写す時は片腕を上げ、手元に光が集まる
       記憶漁師   … 背を丸めた漁師。つばの広い帽子、油引きの外套、背中に網の束、長い腕。
                    網を投げる前に腕を後ろへ振りかぶり、近接は両腕を広げてから一回転
       水門守     … 肩幅の広い門番。肩から鎖、巻き上げの把手と鉤。両腕を上げて鎖を掴み、引き下ろす

     ・数値(HP・攻撃力・判定・時刻・速さ)は変えない。姿勢は AI の状態を読むだけ
       (updateVillageMobExtras。AI は姿勢の存在を知らない)
     ・材質はマット(core/dusk-enemies.js VILLAGE_FINISH)。光源は足さない
     ・胴(body)の材質だけは個体ごと(被弾の白・強調が書き換える)。ほかの部品のジオメトリと
       材質は種類ごとに 1 つを全個体で共有する(書き換えないものだけ)。ジオメトリは
       sharedGeometries()(02)に登録してあり、世界の破棄で捨てられない
     ・洋館の M.mansionKind は使わない(updateMansionMeleeTelegraph が床の弧を隠しにくる)。
       印は M.villageKind
  ========================================================= */
  const villageGeoCache = new Map();
  const villageMatCache = new Map();
  function vGeo(key, make){
    let g = villageGeoCache.get(key);
    if(!g){ g = make(); villageGeoCache.set(key, g); }
    return g;
  }
  function vMat(key, make){
    let m = villageMatCache.get(key);
    if(!m){ m = make(); villageMatCache.set(key, m); }
    return m;
  }
  // マットな共有の材質(書き換えない部品だけに使う)
  function vMatte(key, color, finish, extra){
    const f = finish || VILLAGE_FINISH.cloth;
    return vMat(key, ()=> new THREE.MeshStandardMaterial(Object.assign(
      {color, roughness:f.roughness, metalness:f.metalness}, extra || {})));
  }
  function vMesh(parent, geo, mat, x, y, z, opts){
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = !(opts && opts.noShadow);
    if(opts && opts.outline) m.userData.villageOutline = true;   // buildEnemy の輪郭線の対象
    if(opts && opts.noOutline) m.userData.noOutline = true;
    parent.add(m);
    return m;
  }
  // 楕円の断面(makeLoft 用)
  function vEllipse(rx, rz, n, offZ){
    const pts = [];
    for(let i=0;i<n;i++){
      const a = (i / n) * Math.PI * 2;
      pts.push([Math.cos(a) * rx, Math.sin(a) * rz + (offZ || 0)]);
    }
    return pts;
  }
  // 手足 1 本(肩・股の pivot から下へ)。ジオメトリは寸法ごとに共有
  function villageLimb(parent, x, y, z, len, thick, mat, opts){
    opts = opts || {};
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const taper = opts.taper || 0.85;
    const geo = vGeo(`limb:${len}:${thick}:${taper}`, ()=>{
      const c = new THREE.CylinderGeometry(thick, thick * taper, len, 6);
      c.translate(0, -len / 2, 0);
      return c;
    });
    vMesh(pivot, geo, mat, 0, 0, 0);
    if(opts.foot){
      const fgeo = vGeo(`foot:${thick}:${opts.foot}`, ()=> new THREE.BoxGeometry(thick * 2.4, thick * 1.5, opts.foot));
      vMesh(pivot, fgeo, opts.footMat || mat, 0, -len - thick * 0.6, opts.foot * 0.22);
    }
    if(opts.hand){
      const hgeo = vGeo(`hand:${opts.hand}`, ()=> new THREE.BoxGeometry(opts.hand, opts.hand * 1.2, opts.hand * 0.6));
      vMesh(pivot, hgeo, opts.handMat || mat, 0, -len - opts.hand * 0.5, 0);
    }
    parent.add(pivot);
    return pivot;
  }
  // 胴の上半身を 1 つの Group にまとめる(ひねり・反りを肩ごと付けるため)
  function villageUpper(g, waistY){
    const up = new THREE.Group();
    up.position.y = waistY;
    g.add(up);
    return up;
  }

  /* 幽霊の手がかり(歩く怪異。core/dusk-enemies.js VILLAGE_GHOST):
     透ける脚の材質・裾から垂れる薄布・足元の霧の映り込み。どれも種類ごとに共有し、自発光も光源も無い */
  function vGhostMat(key, color, opacity, finish){
    return vMatte(key, color, finish || VILLAGE_FINISH.cloth, {transparent:true, opacity, depthWrite:false});
  }
  function villageGhostHem(g, key, color, topY, topR, botR){
    // 裾から地面近くへ垂れる、透ける薄布(下ほど広がる)
    return vMesh(g, vGeo(`${key}.ghostHem`, ()=> makeLoft({sections:[
      {y:topY,        points:vEllipse(topR, topR * 0.8, 8)},
      {y:topY * 0.45, points:vEllipse(botR * 0.92, botR * 0.76, 8)},
      {y:0.08,        points:vEllipse(botR, botR * 0.82, 8)},
    ]})), vGhostMat(`${key}.ghostHem`, color, VILLAGE_GHOST.hemOpacity), 0, 0, 0, {noShadow:true, noOutline:true});
  }
  function villageGhostPool(g, radius){
    // 足元の霧の映り込み(水鏡の影の映り込みと同じ素材の色。浮かない種類なので床の少し上)
    const pool = vMesh(g, vGeo(`ghost.pool:${radius}`, ()=>{ const c = new THREE.CircleGeometry(radius, 16); c.rotateX(-Math.PI/2); return c; }),
      vGhostMat('ghost.pool', VILLAGE_PALETTE.mirror.water, VILLAGE_GHOST.poolOpacity, VILLAGE_FINISH.water), 0, 0.03, 0, {noShadow:true, noOutline:true});
    pool.scale.z = 1.12;
    return pool;
  }

  /* 村の敵の variant(buildEnemy に渡す)。数値は呼ぶ側が渡す。色は表の主な色 */
  function duskEnemyVariant(kind, v){
    return Object.assign({theme:'village', villageKind:kind, color:VILLAGE_PALETTE[kind].main}, v || {});
  }

  /* buildEnemy → dressEnemy から呼ばれる。body(胴)と head(頭)は buildEnemy が作った物を
     作り替えて使う(材質は個体ごとのまま。被弾の白は胴と頭に乗る) */
  function dressVillageEnemy(g, body, variant, M){
    const kind = variant.villageKind || 'mirror';
    const pal = VILLAGE_PALETTE[kind] || VILLAGE_PALETTE.mirror;
    M.villageKind = kind;
    M.limbs = [];
    M.legs.forEach(l=>{ l.visible = false; });   // 四つ足の脚は使わない
    if(M.snout) M.snout.visible = false;         // 獣の鼻先も
    M.eyes.forEach(e=>{ e.visible = false; });   // 目の代わりに顔の面で前を見せる
    // 胴の材質(個体ごと)をマットに。色は buildEnemy が variant.color(= 表の主な色)で作ってある
    const bm = body.material;
    bm.roughness = VILLAGE_FINISH.cloth.roughness;
    bm.metalness = 0;
    bm.emissiveIntensity = VILLAGE_FINISH.emissiveIntensity;
    body.scale.set(1, 1, 1);
    body.rotation.set(0, 0, 0);
    M.hitRadius = villageHitRadius(kind, 1);

    if(kind === 'mirror') dressVillageMirror(g, body, pal, M);
    else if(kind === 'foam') dressVillageFoam(g, body, pal, M);
    else if(kind === 'copy') dressVillageCopy(g, body, pal, M);
    else if(kind === 'fisher') dressVillageFisher(g, body, pal, M);
    else if(kind === 'warden') dressVillageWarden(g, body, pal, M);
  }

  /* ---- 水鏡の影: 水面に映った村人 ----
     浮く(足は無い)。濡れた灰紫の衣、褪せた薔薇色の肩掛けと頭巾。顔は暗い水面。
     裾は滴になって、足元の映り込み(暗い円)へ溶けていく */
  function dressVillageMirror(g, body, pal, M){
    const P = VILLAGE_PROPORTIONS.mirror;
    const cloth = vMatte('mirror.cloth', pal.main);
    const accent = vMatte('mirror.accent', pal.accent);
    const shade = vMatte('mirror.shade', pal.shade);
    const face = vMatte('mirror.face', pal.face, VILLAGE_FINISH.water);
    const water = vMatte('mirror.water', pal.water, VILLAGE_FINISH.water,
                         {transparent:true, opacity:0.62, depthWrite:false});
    M.hover = true;
    const W = 0.92;   // 腰の高さ
    // 裾(腰から下へ広がる)。最後の段が細く絞られて滴へつながる
    const skirt = vMesh(g, vGeo('mirror.skirt', ()=> makeLoft({sections:[
      {y:W,    points:vEllipse(0.19, 0.14, 8)},
      {y:0.62, points:vEllipse(0.29, 0.23, 8)},
      {y:0.3,  points:vEllipse(0.38, 0.31, 8)},
      {y:0.14, points:vEllipse(0.33, 0.27, 8)},
    ]})), cloth, 0, 0, 0, {outline:true});
    skirt.userData.villageOutline = true;
    // 滴: 裾の端から映り込みへ垂れる
    const dripGeo = vGeo('mirror.drip', ()=>{ const c = new THREE.ConeGeometry(0.06, 0.3, 5); c.rotateX(Math.PI); return c; });
    [[0.22, 0.08], [-0.2, 0.12], [0.02, -0.26]].forEach(([x, z])=> vMesh(g, dripGeo, water, x, 0.02, z, {noShadow:true, noOutline:true}));
    // 足元の映り込み(浮いている高さぶん下に置く)
    const disc = vMesh(g, vGeo('mirror.disc', ()=>{ const c = new THREE.CircleGeometry(0.62, 16); c.rotateX(-Math.PI/2); return c; }),
                       water, 0, -0.12, 0, {noShadow:true, noOutline:true});
    disc.scale.z = 1.15;
    M.reflection = disc;

    const up = villageUpper(g, W);
    M.upper = up;
    // 胴(個体ごとの材質)
    body.geometry = vGeo('mirror.torso', ()=> makeTrapezoidBox({topW:P.shoulderW, topD:0.26, botW:0.34, botD:0.22, height:0.56}));
    body.position.set(0, P.torsoY - W, 0);
    up.add(body);
    // 肩掛け
    vMesh(up, vGeo('mirror.shawl', ()=> new THREE.CylinderGeometry(0.25, 0.33, 0.14, 8)), accent, 0, 1.43 - W, 0, {outline:true});
    // 頭(首ごと上半身へ)
    up.add(M.neck);
    M.neck.position.set(0, 1.62 - W, 0.0);
    M.head.scale.setScalar(1.02);
    vMesh(M.neck, vGeo('mirror.face', ()=> new THREE.BoxGeometry(0.19, 0.22, 0.05)), face, 0, -0.01, 0.19, {noShadow:true});
    const hood = vMesh(M.neck, vGeo('mirror.hood', ()=> new THREE.SphereGeometry(0.235, 8, 6, 0, Math.PI*2, 0, Math.PI*0.56)),
                       accent, 0, 0.02, -0.02, {outline:true});
    hood.rotation.x = -0.32;
    const tail = vMesh(M.neck, vGeo('mirror.hoodTail', ()=> new THREE.ConeGeometry(0.1, 0.32, 5)), accent, 0, -0.18, -0.17);
    tail.rotation.x = Math.PI + 0.35;
    // 腕(垂れた細い腕。引く・薙ぐのはこの腕)
    const armL = villageLimb(up, -0.27, 1.40 - W, 0, 0.32, 0.062, cloth);
    const armR = villageLimb(up,  0.27, 1.40 - W, 0, 0.32, 0.062, cloth);
    const foreL = villageLimb(armL, 0, -0.32, 0, 0.3, 0.052, shade, {hand:0.08, handMat:shade});
    const foreR = villageLimb(armR, 0, -0.32, 0, 0.3, 0.052, shade, {hand:0.08, handMat:shade});
    Object.assign(M, {armL, armR, foreL, foreR});
  }

  /* ---- 泡沫: 泡の塊 ----
     頭も手足も無い。低く漂う白緑の泡が 3〜4 個。1 つ目が胴(被弾の白が乗る) */
  function dressVillageFoam(g, body, pal, M){
    M.hover = true;
    M.neck.visible = false;    // 頭は使わない(輪郭線も頭ごと消える)
    const bubbleMat = vMatte('foam.bubble', pal.main, VILLAGE_FINISH.foam);
    const beadMat = vMatte('foam.bead', pal.accent, VILLAGE_FINISH.foam);
    const sphere = vGeo('foam.sphere', ()=> new THREE.SphereGeometry(1, 7, 5));
    const c0 = FOAM_CLUSTER[0];
    body.geometry = sphere;
    body.scale.setScalar(c0.r);
    body.position.set(c0.x, c0.y, c0.z);
    M.foamBubbles = [];
    FOAM_CLUSTER.slice(1).forEach((b, i)=>{
      const m = vMesh(g, sphere, bubbleMat, b.x, b.y, b.z, {outline: i === 0});
      m.scale.setScalar(b.r);
      M.foamBubbles.push({m, r:b.r, phase:i * 2.1, grows: i === FOAM_CLUSTER.length - 2});
    });
    // 泡の芯(少し濃い緑の粒)。塊に向きを持たせないので、前後どちらから見ても同じ
    [[0.18, 0.5, 0.22], [-0.12, 0.36, 0.26]].forEach(([x, y, z])=>{
      const b = vMesh(g, sphere, beadMat, x, y, z, {noShadow:true});
      b.scale.setScalar(0.07);
    });
    // 泡から半身を起こす人影(頭と肩、透ける。core FOAM_FIGURE)。塊の広がりの内側に収め、当たりは変えない
    const F = FOAM_FIGURE;
    const figMat = vMatte('foam.figure', pal.shade, VILLAGE_FINISH.foam, {transparent:true, opacity:F.opacity, depthWrite:false});
    const shoulders = vMesh(g, vGeo('foam.figShoulder', ()=> makeTrapezoidBox({topW:F.shoulder.w, topD:F.shoulder.d,
      botW:F.shoulder.w * 0.7, botD:F.shoulder.d * 0.8, height:F.shoulder.h})), figMat, 0, F.shoulder.y, 0, {noShadow:true, noOutline:true});
    const head = vMesh(g, vGeo('foam.figHead', ()=> new THREE.SphereGeometry(F.head.r, 8, 6)), figMat, 0, F.head.y, F.head.z, {noShadow:true, noOutline:true});
    M.foamFigure = {shoulders, head};
  }

  /* ---- 写し身: 色を抜かれた長い外套 ----
     魔法使いの青は使わない。外套の裾は地面すれすれで、浮いている。顔は暗い水。
     写す時だけ右腕を上げ、手元に光(弾と同じ色。光源は使わない)が集まる */
  function dressVillageCopy(g, body, pal, M){
    const P = VILLAGE_PROPORTIONS.copy;
    const accent = vMatte('copy.accent', pal.accent);
    const shade = vMatte('copy.shade', pal.shade);
    const face = vMatte('copy.face', pal.face, VILLAGE_FINISH.water);
    M.hover = true;
    const W = 0.95;
    /* 長い外套(足元から肩まで)は共有の材質。胴(被弾の白・交戦中の赤い強調が乗る、個体ごとの材質)は
       肩に掛けた短い肩掛け ―― 外套全体を胴にすると、交戦中の強調(threatHighlight)で
       全身が赤く染まり、灰色の写しに見えなくなる(洋館の敵の胴と同じくらいの面積にとどめる) */
    vMesh(g, vGeo('copy.coat', ()=> makeLoft({sections:[
      {y:1.5,  points:vEllipse(0.2, 0.14, 8)},
      {y:0.98, points:vEllipse(0.22, 0.16, 8)},
      {y:0.52, points:vEllipse(0.31, 0.24, 8)},
      {y:0.06, points:vEllipse(0.4, 0.31, 8, -0.03)},
    ]})), vMatte('copy.sleeve', pal.main), 0, 0, 0, {outline:true});
    body.geometry = vGeo('copy.cape', ()=> makeLoft({sections:[
      {y:1.64, points:vEllipse(0.16, 0.12, 8)},
      {y:1.46, points:vEllipse(0.3, 0.2, 8)},
      {y:1.12, points:vEllipse(0.34, 0.24, 8)},
    ], closedTop:true}));
    body.position.set(0, 0, 0);
    // 上半身(腕と頭)の pivot。肩掛け(胴)は写しの溜めで伸びすぎないよう、姿勢側で幅だけにとどめる
    const up = villageUpper(g, W);
    M.upper = up;
    vMesh(up, vGeo('copy.collar', ()=> new THREE.CylinderGeometry(0.15, 0.2, 0.14, 8)), accent, 0, 1.6 - W, 0, {outline:true});
    up.add(M.neck);
    M.neck.position.set(0, 1.78 - W, 0.02);
    M.head.scale.setScalar(0.92);
    vMesh(M.neck, vGeo('copy.face', ()=> new THREE.BoxGeometry(0.18, 0.21, 0.05)), face, 0, -0.01, 0.17, {noShadow:true});
    // 帽子(つばの広い丸帽 + 帯)
    vMesh(M.neck, vGeo('copy.brim', ()=> new THREE.CylinderGeometry(0.36, 0.36, 0.03, 12)), shade, 0, 0.13, 0, {outline:true});
    vMesh(M.neck, vGeo('copy.crown', ()=> new THREE.CylinderGeometry(0.14, 0.18, 0.3, 8)), shade, 0, 0.29, -0.01, {outline:true});
    vMesh(M.neck, vGeo('copy.band', ()=> new THREE.CylinderGeometry(0.185, 0.185, 0.05, 8)), accent, 0, 0.18, -0.01, {noShadow:true});
    // 長い袖の腕
    const sleeve = vMatte('copy.sleeve', pal.main);
    const armL = villageLimb(up, -0.24, 1.52 - W, 0, 0.34, 0.07, sleeve);
    const armR = villageLimb(up,  0.24, 1.52 - W, 0, 0.34, 0.07, sleeve);
    const foreL = villageLimb(armL, 0, -0.34, 0, 0.32, 0.06, sleeve, {hand:0.08, handMat:shade});
    const foreR = villageLimb(armR, 0, -0.34, 0, 0.32, 0.06, sleeve, {hand:0.08, handMat:shade});
    Object.assign(M, {armL, armR, foreL, foreR});
    // 手元に集まる光(写しの溜めの間だけ見える。発光の材質だけで、光源は持たない)
    const orb = vMesh(foreR, vGeo('copy.orb', ()=> new THREE.SphereGeometry(0.16, 8, 6)),
                      vMat('copy.orb', ()=> new THREE.MeshBasicMaterial({color:pal.orb, transparent:true, opacity:0.85, depthWrite:false})),
                      0, -0.44, 0.04, {noShadow:true, noOutline:true});
    orb.visible = false;
    M.copyOrb = orb;
  }

  /* ---- 記憶漁師: 背を丸めた漁師 ----
     つばの広い帽子、油引きの外套(オリーブ)、背中に網の束、地面へ届きそうな長い腕。歩く */
  function dressVillageFisher(g, body, pal, M){
    const P = VILLAGE_PROPORTIONS.fisher;
    const coat = vMatte('fisher.coat', pal.main);
    const rope = vMatte('fisher.rope', pal.accent, VILLAGE_FINISH.rope);
    const shade = vMatte('fisher.shade', pal.shade);
    const face = vMatte('fisher.face', pal.face, VILLAGE_FINISH.skin);
    const hat = vMatte('fisher.hat', pal.hat);
    const W = 0.92;
    // 外套の裾(腰から膝)
    vMesh(g, vGeo('fisher.skirt', ()=> makeLoft({sections:[
      {y:W + 0.04, points:vEllipse(0.25, 0.19, 8)},
      {y:0.66,     points:vEllipse(0.31, 0.25, 8)},
      {y:0.46,     points:vEllipse(0.34, 0.28, 8)},
    ]})), coat, 0, 0, 0, {outline:true});
    // 脚(長靴)は透ける影。外套の裾から薄布が垂れ、足元に霧の映り込み(幽霊の手がかり。歩き方は今のまま)
    const ghostLeg = vGhostMat('fisher.ghostLeg', pal.shade, VILLAGE_GHOST.legOpacity);
    [-0.13, 0.13].forEach((x, i)=>{
      const leg = villageLimb(g, x, 0.9, 0, 0.8, 0.08, ghostLeg, {foot:0.26});
      M.limbs.push({m:leg, axis:'x', base:0, amp:0.55, phase:i * Math.PI, walk:true, idle:0.03});
    });
    villageGhostHem(g, 'fisher', pal.main, 0.5, 0.33, 0.38);
    villageGhostPool(g, 0.5);
    // 上半身(前へ丸めた背)
    const up = villageUpper(g, W);
    up.rotation.x = P.hunch;
    M.upper = up; M.upperBaseX = P.hunch;
    body.geometry = vGeo('fisher.torso', ()=> makeTrapezoidBox({topW:P.shoulderW, topD:0.36, botW:0.46, botD:0.3, height:0.6, topOffsetZ:0.06}));
    body.position.set(0, P.torsoY - W + 0.08, 0);
    up.add(body);
    // 背中の網の束と、胸を斜めに渡る負い紐
    const net = vMesh(up, vGeo('fisher.net', ()=> new THREE.IcosahedronGeometry(0.3, 0)), rope, 0, 1.34 - W, -0.34, {outline:true});
    net.scale.set(1.15, 0.85, 0.7);
    const strap = vMesh(up, vGeo('fisher.strap', ()=> new THREE.BoxGeometry(0.06, 0.78, 0.04)), rope, 0, 1.3 - W, 0.2, {noShadow:true});
    strap.rotation.z = 0.72;
    // 頭(低く前へ出る)
    up.add(M.neck);
    M.neck.position.set(0, 1.62 - W, 0.16);
    vMesh(M.neck, vGeo('fisher.face', ()=> new THREE.BoxGeometry(0.2, 0.2, 0.05)), face, 0, -0.03, 0.18, {noShadow:true});
    // つばの広い帽子(後ろのつばが垂れる)
    const brim = vMesh(M.neck, vGeo('fisher.brim', ()=> new THREE.CylinderGeometry(0.42, 0.46, 0.04, 12)), hat, 0, 0.13, -0.03, {outline:true});
    brim.rotation.x = -0.16;
    vMesh(M.neck, vGeo('fisher.crown', ()=> new THREE.CylinderGeometry(0.17, 0.21, 0.2, 8)), hat, 0, 0.23, -0.01, {outline:true});
    // 長い腕(網を投げ、近接で一回転して薙ぐ)
    const armL = villageLimb(up, -0.34, 1.44 - W, 0.08, 0.44, 0.075, coat);
    const armR = villageLimb(up,  0.34, 1.44 - W, 0.08, 0.44, 0.075, coat);
    const foreL = villageLimb(armL, 0, -0.44, 0, 0.42, 0.065, coat, {hand:0.12, handMat:face});
    const foreR = villageLimb(armR, 0, -0.44, 0, 0.42, 0.065, coat, {hand:0.12, handMat:face});
    Object.assign(M, {armL, armR, foreL, foreR});
    M.armHome = {L:{x:-0.34, y:1.44 - W, z:0.08}, R:{x:0.34, y:1.44 - W, z:0.08}};
  }

  /* ---- 水門守の残響: 重い門番 ----
     肩幅の広い胴、革の前掛け、肩から斜めに鎖。右手に巻き上げの把手、左手に鉤。
     両腕を上げて鎖を掴み、引き下ろす(当たる瞬間に引ききる)。重く歩く */
  function dressVillageWarden(g, body, pal, M){
    const P = VILLAGE_PROPORTIONS.warden;
    const coat = vMatte('warden.coat', pal.main);
    const apron = vMatte('warden.apron', pal.shade);
    const iron = vMatte('warden.iron', pal.accent, VILLAGE_FINISH.iron);
    const ironDark = vMatte('warden.ironDark', pal.iron, VILLAGE_FINISH.iron);
    const face = vMatte('warden.face', pal.face, VILLAGE_FINISH.skin);
    M.heavy = true;
    const W = 1.0;
    // 太い脚は透ける影(重さは肩幅・腕・鎖・重い歩きで残す)。前掛けの下から薄布、足元に霧の映り込み
    const ghostLeg = vGhostMat('warden.ghostLeg', pal.shade, VILLAGE_GHOST.legOpacity);
    [-0.2, 0.2].forEach((x, i)=>{
      const leg = villageLimb(g, x, 0.94, 0, 0.84, 0.12, ghostLeg, {foot:0.32});
      M.limbs.push({m:leg, axis:'x', base:0, amp:0.42, phase:i * Math.PI, walk:true, idle:0.025});
    });
    villageGhostHem(g, 'warden', pal.shade, 0.72, 0.34, 0.46);
    villageGhostPool(g, 0.62);
    const up = villageUpper(g, W);
    M.upper = up; M.upperBaseX = 0.04;
    body.geometry = vGeo('warden.torso', ()=> makeTrapezoidBox({topW:P.shoulderW, topD:0.46, botW:0.58, botD:0.36, height:0.74}));
    body.position.set(0, P.torsoY - W, 0);
    up.add(body);
    // 前掛けと腰の帯
    vMesh(up, vGeo('warden.apron', ()=> new THREE.BoxGeometry(0.58, 0.86, 0.05)), apron, 0, 1.06 - W, 0.22, {outline:true});
    vMesh(up, vGeo('warden.belt', ()=> new THREE.CylinderGeometry(0.33, 0.36, 0.13, 8)), ironDark, 0, 1.02 - W, 0);
    // 肩から腰へ斜めに掛けた鎖(輪 5 つ)
    const link = vGeo('warden.link', ()=> new THREE.TorusGeometry(0.075, 0.024, 4, 8));
    for(let i=0;i<5;i++){
      const k = i / 4;
      const m = vMesh(up, link, iron, -0.3 + 0.6 * k, 1.74 - 0.66 * k - W, 0.25, {noShadow:true});
      m.rotation.set(0, i % 2 ? Math.PI / 2 : 0, -0.85);
    }
    // 頭(平たい帽子、顔は帽子の陰)
    up.add(M.neck);
    M.neck.position.set(0, 1.84 - W, 0.03);
    M.head.scale.setScalar(1.18);
    vMesh(M.neck, vGeo('warden.face', ()=> new THREE.BoxGeometry(0.23, 0.2, 0.05)), face, 0, -0.03, 0.22, {noShadow:true});
    vMesh(M.neck, vGeo('warden.cap', ()=> new THREE.CylinderGeometry(0.24, 0.27, 0.12, 9)), apron, 0, 0.17, -0.01, {outline:true});
    vMesh(M.neck, vGeo('warden.capBrim', ()=> new THREE.BoxGeometry(0.3, 0.03, 0.16)), apron, 0, 0.12, 0.2, {noShadow:true});
    // 太い腕。右手に巻き上げの把手、左手に鉤
    const armL = villageLimb(up, -0.47, 1.62 - W, 0, 0.4, 0.1, coat);
    const armR = villageLimb(up,  0.47, 1.62 - W, 0, 0.4, 0.1, coat);
    const foreL = villageLimb(armL, 0, -0.4, 0, 0.4, 0.088, coat, {hand:0.14, handMat:apron});
    const foreR = villageLimb(armR, 0, -0.4, 0, 0.4, 0.088, coat, {hand:0.14, handMat:apron});
    Object.assign(M, {armL, armR, foreL, foreR});
    const crank = vMesh(foreR, vGeo('warden.crankRod', ()=> new THREE.CylinderGeometry(0.026, 0.026, 0.46, 5)), ironDark, 0.0, -0.5, 0.1, {noShadow:true});
    crank.rotation.x = Math.PI / 2;
    vMesh(foreR, vGeo('warden.crankKnob', ()=> new THREE.CylinderGeometry(0.05, 0.05, 0.14, 6)), iron, 0.0, -0.5, 0.34, {noShadow:true});
    const hook = vMesh(foreL, vGeo('warden.hook', ()=> new THREE.TorusGeometry(0.13, 0.03, 5, 10, Math.PI * 1.3)), iron, 0, -0.56, 0.06, {outline:true});
    hook.rotation.set(0, Math.PI / 2, Math.PI * 0.35);
  }

  /* ---------------------------------------------------------
     残響の姿(水門守・ボスの段階 3。spawnKeeperEcho が使う)
     水門守と同じ骨格の、低ポリの写し。ジオメトリは全残響で共有し、残響ごとに持つのは
     濃さを変えるための材質 1 つ(07 が渡す)。当たる「引いた」残響だけが腕を持つ
     --------------------------------------------------------- */
  function buildEchoFigure(mat, harmful){
    const g = new THREE.Group();
    const fig = new THREE.Group();
    fig.scale.setScalar(WARDEN_SCALE);   // 水門守の背丈に合わせる(判定の半径は 07 が別に持つ)
    g.add(fig);
    const add = (geo, x, y, z)=>{ const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.userData.noOutline = true; fig.add(m); return m; };
    add(vGeo('echo.torso', ()=> makeTrapezoidBox({topW:0.8, topD:0.46, botW:0.58, botD:0.36, height:0.74})), 0, 1.38, 0);
    add(vGeo('echo.head', ()=> new THREE.IcosahedronGeometry(0.24, 0)), 0, 1.88, 0.03);
    add(vGeo('echo.cap', ()=> new THREE.CylinderGeometry(0.24, 0.27, 0.12, 7)), 0, 2.06, 0.02);
    const legGeo = vGeo('echo.leg', ()=>{ const c = new THREE.CylinderGeometry(0.12, 0.1, 0.94, 5); c.translate(0, -0.47, 0); return c; });
    add(legGeo, -0.2, 0.96, 0);
    add(legGeo, 0.2, 0.96, 0);
    let armL = null, armR = null;
    if(harmful){
      const armGeo = vGeo('echo.arm', ()=>{ const c = new THREE.CylinderGeometry(0.1, 0.08, 0.84, 5); c.translate(0, -0.42, 0); return c; });
      armL = new THREE.Group(); armL.position.set(-0.47, 1.62, 0); fig.add(armL);
      armR = new THREE.Group(); armR.position.set(0.47, 1.62, 0); fig.add(armR);
      [armL, armR].forEach(a=>{ const m = new THREE.Mesh(armGeo, mat); m.userData.noOutline = true; a.add(m); });
    }
    return {group:g, armL, armR};
  }
  // 引いた残響の腕(core/dusk-enemies.js echoPose: 出た瞬間から上がっていて、当たる瞬間に引ききる)
  function poseEchoArms(e, p){
    if(!e.armL) return;
    const a = p.reach * (-2.6 + 1.9 * p.pull);
    e.armL.rotation.set(a, 0, -0.18 * p.reach);
    e.armR.rotation.set(a, 0, 0.18 * p.reach);
  }

  /* ---------------------------------------------------------
     姿勢(updateMobAnim から毎フレーム。AI の状態を読むだけ)
     --------------------------------------------------------- */
  const _vEase = k => 1 - (1 - k) * (1 - k);
  function vLerp(M, key, target, rate, dt){
    const cur = M[key] != null ? M[key] : target;
    const v = cur + (target - cur) * Math.min(1, dt * rate);
    M[key] = v;
    return v;
  }
  function updateVillageMobExtras(en, M, t, sw, moving, dt){
    // 脚(歩く種類だけ)。洋館と同じ振り子
    if(M.limbs){
      for(let i=0;i<M.limbs.length;i++){
        const L = M.limbs[i];
        const amp = L.walk ? Math.min(L.amp, 0.16 + sw * L.amp * 1.4) : L.amp;
        const w = moving ? amp : (L.idle || 0.03);
        L.m.rotation[L.axis] = L.base + Math.sin(t + (L.phase || 0)) * w;
      }
    }
    const kind = M.villageKind;
    if(kind === 'mirror') poseVillageMirror(en, M, t, dt);
    else if(kind === 'foam') poseVillageFoam(en, M, t, dt);
    else if(kind === 'copy') poseVillageCopy(en, M, t, dt);
    else if(kind === 'fisher') poseVillageFisher(en, M, t, dt, moving);
    else if(kind === 'warden') poseVillageWarden(en, M, t, dt, moving);
  }

  /* 水鏡の影: 溜めで両腕を後ろへ引き(深さ = 本体 1 / 分身 0.45)、上体を反らす → 一撃で前へ振り抜く */
  function poseVillageMirror(en, M, t, dt){
    const st = en.mirrorState;
    let k = 0;
    if(st === 'windup') k = 1 - Math.max(0, en.mirrorT) / Math.max(0.01, en.mirrorWindupDur || 0.01);
    else if(st === 'strike') k = 1 - Math.max(0, en.mirrorT) / MIRROR_STRIKE_SEC;
    const p = mirrorPose(st, k, en.mirrorDepth != null ? en.mirrorDepth : 1);
    const active = st === 'windup' || st === 'strike';
    const rate = active ? 18 : 5;
    const idle = active ? 0 : Math.sin(t * 0.8) * 0.06;
    const arm = vLerp(M, 'vArm', p.arm + idle, rate, dt);
    const spread = vLerp(M, 'vSpread', p.spread, rate, dt);
    const lean = vLerp(M, 'vLean', p.lean, rate, dt);
    M.armL.rotation.set(arm, 0, -0.1 - spread);
    M.armR.rotation.set(arm + idle * 0.5, 0, 0.1 + spread);
    M.foreL.rotation.x = M.foreR.rotation.x = -0.22 - 0.35 * spread;
    M.upper.rotation.x = lean;
    // 映り込みは浮き沈みに関わらず床の近くに留める(group の高さを打ち消す)
    if(M.reflection) M.reflection.position.y = -0.04 - Math.max(0, en.group.position.y - baseYOf(en));
  }

  /* 泡沫: 泡が呼吸する。増える直前に 1 つが膨らみ、弾けた直後(次に当たれるまで)は縮む */
  function poseVillageFoam(en, M, t, dt){
    const grow = en.triggered ? Math.min(1, (en.foamGrowT || 0) / 6.5) : 0;
    const spent = (en.foamAtkCD || 0) > 0 ? Math.min(1, en.foamAtkCD / 1.6) : 0;
    M.foamBubbles.forEach(b=>{
      const swell = b.grows ? 1 + 0.35 * grow * grow : 1;
      b.m.scale.setScalar(b.r * swell * (1 + Math.sin(t * 3 + b.phase) * 0.07) * (1 - 0.18 * spent));
    });
    if(M.foamFigure){
      // 人影は泡の呼吸より少し遅れて揺れる(動作のズレ)。弾けた直後は泡へ沈む
      const F = FOAM_FIGURE, sink = 0.14 * spent, sway = Math.sin(t * 1.6 - 0.9) * 0.04;
      M.foamFigure.head.position.set(sway, F.head.y - sink + Math.sin(t * 2.2 - 0.6) * 0.02, F.head.z);
      M.foamFigure.shoulders.position.set(sway * 0.6, F.shoulder.y - sink, 0);
    }
    if(en.body && en.bodyScale){
      const B = en.bodyScale, s = 1 - 0.22 * spent, w = Math.sin(t * 2.2) * 0.05;
      en.body.scale.set(B.x * s * (1 + w), B.y * s * (1 - w), B.z * s * (1 + w));
    }
  }

  /* 写し身: 写す間だけ右腕を上げ、手元に光が集まる(1.25 秒、灯りで伸びる長さのまま)。
     肩掛け(胴)を縦に伸ばしていた溜めの変形は、帽子と頭を突き抜けるので幅だけにとどめる */
  function poseVillageCopy(en, M, t, dt){
    const k = copyMimicProgress(en.copyState, en.copyT, en.copyDur);
    const kk = k == null ? 0 : k;
    const rate = k == null ? 4 : 16;
    const raise = vLerp(M, 'vRaise', -2.25 * _vEase(kk), rate, dt);
    M.armR.rotation.set(raise + Math.sin(t * 0.7) * 0.03, 0, 0.08 + 0.2 * kk);
    M.foreR.rotation.x = -0.45 * kk;
    M.armL.rotation.set(Math.sin(t * 0.7 + 1.3) * 0.04 + 0.12 * kk, 0, -0.08);
    M.foreL.rotation.x = -0.15;
    M.upper.rotation.x = -0.08 * kk;
    if(M.copyOrb){
      M.copyOrb.visible = k != null && !en.dead;
      if(M.copyOrb.visible) M.copyOrb.scale.setScalar(0.25 + 0.95 * kk + Math.sin(t * 9) * 0.05 * kk);
    }
    if(k != null && en.body && en.bodyScale){
      const B = en.bodyScale;
      en.body.scale.set(B.x * (1 + 0.05 * kk), B.y, B.z * (1 + 0.05 * kk));
    }
  }

  /* 記憶漁師: 網の溜めで右腕を後ろへ振りかぶる → 投げた直後に前へ振り抜く。
     近接の溜めで両腕を広げて上体をひねり戻し → 当たった直後に一回転して薙ぐ(全周 2.3 の輪と同じ形) */
  function poseVillageFisher(en, M, t, dt, moving){
    const netK = (en.netWindupT || 0) > 0 ? 1 - en.netWindupT / Math.max(0.01, en.netWindupDur || 0.5) : null;
    if(M.netPrev != null && M.netPrev > 0 && !(en.netWindupT > 0)) M.throwT = 0.4;   // 投げた瞬間
    M.netPrev = en.netWindupT || 0;
    if(M.throwT > 0) M.throwT = Math.max(0, M.throwT - dt);
    const m = en.fisherMelee;
    const meleeK = m && fisherMeleeWindingUp(m) ? fisherMeleeProgress(m) : null;
    const sweep = m && m.recoverT > 0 ? 1 - m.recoverT / 0.45 : null;   // 当たった直後の振り抜き(硬直 0.45 秒)

    let armLX = -0.18 + Math.sin(t * 0.9) * 0.05, armRX = -0.18 + Math.sin(t * 0.9 + 1.4) * 0.05;
    let rollL = -0.08, rollR = 0.08, twist = 0, fore = -0.25, rate = 6;
    if(meleeK != null){
      rollL = -0.08 - 1.25 * meleeK; rollR = 0.08 + 1.25 * meleeK;
      armLX = armRX = -0.3 * meleeK; twist = -0.85 * meleeK; fore = -0.1; rate = 20;
    } else if(sweep != null){
      const e = _vEase(Math.min(1, sweep * 1.6));
      rollL = -1.33 + 0.9 * sweep; rollR = 1.33 - 0.9 * sweep;
      armLX = armRX = -0.3; twist = -0.85 + 3.2 * e; fore = -0.1; rate = 26;
    } else if(netK != null){
      armRX = 1.9 * _vEase(netK); rollR = 0.08 + 0.35 * netK;
      armLX = -0.7 * netK; twist = 0.32 * netK; rate = 18;
    } else if(M.throwT > 0){
      const e = M.throwT / 0.4;
      armRX = -1.7 * e; armLX = -0.2; twist = -0.25 * e; rate = 22;
    }
    if(moving && meleeK == null && sweep == null && netK == null && !(M.throwT > 0)){
      // 歩く間は長い腕が脚と逆に揺れる
      armLX += Math.sin(t + Math.PI) * 0.3; armRX += Math.sin(t) * 0.3;
    }
    M.armL.rotation.set(vLerp(M, 'vAL', armLX, rate, dt), 0, vLerp(M, 'vRL', rollL, rate, dt));
    M.armR.rotation.set(vLerp(M, 'vAR', armRX, rate, dt), 0, vLerp(M, 'vRR', rollR, rate, dt));
    M.foreL.rotation.x = M.foreR.rotation.x = fore;
    // 一回転の振り抜き(1 周を越えたら戻す)は速く、待機への戻りはゆっくり
    const tw = vLerp(M, 'vTwist', twist, sweep != null ? 30 : rate * 0.6, dt);
    M.upper.rotation.y = tw;
    M.upper.rotation.x = (M.upperBaseX || 0) + (meleeK != null ? -0.12 * meleeK : 0) + (netK != null ? -0.1 * netK : 0);
  }

  /* 水門守: 予備動作で両腕を上げて鎖を掴み、引く間の 45%(当たる瞬間)で引き下ろしきる(core keeperPose) */
  function poseVillageWarden(en, M, t, dt, moving){
    const p = keeperPose(en.keeperState, en.keeperT, en.keeperDur);
    const active = en.keeperState === 'windup' || en.keeperState === 'operate';
    const swing = moving && !active ? 0.26 : 0.04;
    const a = p.reach * (-2.6 + 1.9 * p.pull);
    const armLX = a + Math.sin(t + Math.PI) * swing * (1 - p.reach);
    const armRX = a + Math.sin(t) * swing * (1 - p.reach);
    const rate = active ? 20 : 6;
    M.armL.rotation.set(vLerp(M, 'vAL', armLX, rate, dt), 0, -0.12 - 0.1 * p.reach);
    M.armR.rotation.set(vLerp(M, 'vAR', armRX, rate, dt), 0, 0.12 + 0.1 * p.reach);
    M.foreL.rotation.x = M.foreR.rotation.x = -0.2 - 0.25 * p.reach * (1 - p.pull);
    M.upper.rotation.x = (M.upperBaseX || 0) + 0.12 * p.reach * (1 - p.pull) - 0.32 * p.pull * p.reach;
  }

  /* ---------------------------------------------------------
     村の残響(ボス)の姿(buildBoss の cfg.key==='duskEcho' から)
     水の裾から起き上がる、村の記憶が重なった人の形: 漁師のつばの広い帽子、前掛け、
     肩から門番の鎖、半歩ずれて重なるもう一つの胴(別の時間の誰か)。誰か一人の顔にはしない。
     部品には名前を付ける ―― ボスの分身(boss.group.clone)の中から同じ部品を拾い直して、
     分身にも同じ動きを付けるため(duskEchoPartsOf)
     --------------------------------------------------------- */
  function buildDuskEchoBody(g, cfg, eyeMat, eyeGeo){
    const pal = VILLAGE_PALETTE.echoBoss;
    const P = VILLAGE_PROPORTIONS.echoBoss;
    const F = VILLAGE_FINISH;
    const mat = (color, f, extra)=> new THREE.MeshStandardMaterial(Object.assign({color, roughness:f.roughness, metalness:f.metalness}, extra || {}));
    // 胴の材質(被弾の白・段階移行の発光が書き換える。色 = en.baseColor)
    const bodyMat = mat(pal.main, F.cloth, {emissive:pal.shade, emissiveIntensity:0.12});
    const accent = mat(pal.accent, F.cloth);
    const shade = mat(pal.shade, F.cloth);
    const hatMat = mat(pal.hat, F.cloth);
    const chainMat = mat(pal.chain, F.iron);
    const faceMat = mat(pal.face, F.water);
    const waterMat = mat(pal.water, F.water, {transparent:true, opacity:0.86});
    const rippleMat = new THREE.MeshBasicMaterial({color:VILLAGE_PALETTE.mirror.accent, transparent:true, opacity:0.22,
                                                  side:THREE.DoubleSide, depthWrite:false});
    const ghostMat = mat(pal.accent, F.cloth, {transparent:true, opacity:0.3, depthWrite:false});
    const named = (m, name)=>{ m.name = name; return m; };
    const add = (parent, geo, material, x, y, z, name)=>{
      const m = new THREE.Mesh(geo, material);
      m.position.set(x, y, z); m.castShadow = true;
      if(name) m.name = name;
      parent.add(m);
      return m;
    };
    const W = 1.6;   // 水の裾が胴へつながる高さ
    // 水の裾(足元から腰へ細くなる)と、足元の水の輪
    add(g, makeLoft({sections:[
      {y:W + 0.1, points:vEllipse(0.62, 0.5, 10)},
      {y:1.0,     points:vEllipse(0.95, 0.8, 10)},
      {y:0.45,    points:vEllipse(1.35, 1.15, 10)},
      {y:0.04,    points:vEllipse(1.7, 1.5, 10)},
    ]}), waterMat, 0, 0, 0, 'echoSkirt');
    const ripple = add(g, new THREE.RingGeometry(1.75, 2.15, 24), rippleMat, 0, 0.05, 0, 'echoRipple');
    ripple.rotation.x = -Math.PI / 2;
    ripple.castShadow = false;
    ripple.userData.noOutline = true;
    // 上半身
    const up = named(new THREE.Group(), 'echoUpper');
    up.position.y = W;
    g.add(up);
    const torsoGeo = makeTrapezoidBox({topW:P.shoulderW, topD:0.85, botW:1.0, botD:0.7, height:1.35});
    const body = add(up, torsoGeo, bodyMat, 0, P.torsoY - W, 0, 'echoTorso');
    // 半歩ずれて重なる、もう一つの胴(別の時間の誰か)
    const ghost = add(up, torsoGeo, ghostMat, 0.24, P.torsoY - W + 0.1, -0.2, 'echoGhost');
    ghost.rotation.y = 0.22; ghost.scale.setScalar(1.04); ghost.castShadow = false;
    ghost.userData.noOutline = true;
    // 前掛け
    add(up, new THREE.BoxGeometry(0.95, 1.1, 0.08), accent, 0, 2.0 - W, 0.42);
    // 肩から腰へ斜めの鎖(門番の記憶)
    const link = new THREE.TorusGeometry(0.16, 0.05, 4, 8);
    for(let i=0;i<5;i++){
      const k = i / 4;
      const m = add(up, link, chainMat, -0.62 + 1.24 * k, 2.95 - 1.2 * k - W, 0.46);
      m.rotation.set(0, i % 2 ? Math.PI / 2 : 0, -0.8);
    }
    // 頭: 顔は暗い水。目の光だけは今のまま(どこを向いているかの手がかり)
    const head = add(up, new THREE.IcosahedronGeometry(0.5, 1), bodyMat, 0, 3.4 - W, 0.05, 'echoHead');
    add(up, new THREE.BoxGeometry(0.56, 0.48, 0.08), faceMat, 0, 3.36 - W, 0.47);
    [-0.17, 0.17].forEach(x=> add(up, eyeGeo, eyeMat, x, 3.42 - W, 0.53));
    // 漁師のつばの広い帽子(漁師の記憶)
    const brim = add(up, new THREE.CylinderGeometry(0.98, 1.04, 0.07, 14), hatMat, 0, 3.78 - W, -0.04);
    brim.rotation.x = -0.12;
    add(up, new THREE.CylinderGeometry(0.42, 0.52, 0.46, 9), hatMat, 0, 4.02 - W, -0.02);
    // 長い腕(振りかぶり → 叩き下ろす)。右手に鉤、左手に網の束
    const limb = (parent, x, y, len, thick, material, name)=>{
      const pivot = named(new THREE.Group(), name);
      pivot.position.set(x, y, 0);
      const c = new THREE.CylinderGeometry(thick, thick * 0.85, len, 7);
      c.translate(0, -len / 2, 0);
      add(pivot, c, material, 0, 0, 0);
      parent.add(pivot);
      return pivot;
    };
    const armL = limb(up, -0.92, 2.9 - W, 1.0, 0.2, bodyMat, 'echoArmL');
    const armR = limb(up,  0.92, 2.9 - W, 1.0, 0.2, bodyMat, 'echoArmR');
    const foreL = limb(armL, 0, -1.0, 1.0, 0.17, shade, 'echoForeL');
    const foreR = limb(armR, 0, -1.0, 1.0, 0.17, shade, 'echoForeR');
    const hook = add(foreR, new THREE.TorusGeometry(0.3, 0.06, 5, 10, Math.PI * 1.3), chainMat, 0, -1.25, 0.1);
    hook.rotation.set(0, Math.PI / 2, Math.PI * 0.35);
    const net = add(foreL, new THREE.IcosahedronGeometry(0.36, 0), accent, 0, -1.25, 0);
    net.scale.set(1, 0.8, 0.7);
    armL.rotation.z = -0.12; armR.rotation.z = 0.12;
    return {body, parts:Object.assign({kind:'echo'}, duskEchoPartsOf(g))};
  }
  function duskEchoPartsOf(root){
    const f = n => root.getObjectByName(n) || null;
    return {upper:f('echoUpper'), armL:f('echoArmL'), armR:f('echoArmR'), foreL:f('echoForeL'), foreR:f('echoForeR'),
            ghost:f('echoGhost'), skirt:f('echoSkirt'), ripple:f('echoRipple'), head:f('echoHead')};
  }
  /* 本体と分身で共有する姿勢。k = 振りかぶりの進み具合(null = 振りかぶっていない)、
     slam = 叩き下ろした直後の残り(1 → 0) */
  function poseDuskEchoBody(P, t, dt, k, slam, store){
    const kk = k == null ? 0 : k;
    const s = Math.max(0, Math.min(1, slam || 0));
    const rate = k != null || s > 0 ? 18 : 4;
    const idleL = Math.sin(t * 0.9) * 0.08, idleR = Math.sin(t * 0.9 + 1.4) * 0.08;
    const target = k != null ? -2.5 * _vEase(kk) : (s > 0 ? -0.55 * s : 0);
    const a = vLerp(store, 'eArm', target, rate, dt);
    if(P.armL) P.armL.rotation.set(a + (k == null && s <= 0 ? idleL : 0), 0, -0.12 - 0.3 * kk);
    if(P.armR) P.armR.rotation.set(a + (k == null && s <= 0 ? idleR : 0), 0, 0.12 + 0.3 * kk);
    if(P.foreL) P.foreL.rotation.x = -0.3 - 0.4 * kk;
    if(P.foreR) P.foreR.rotation.x = -0.3 - 0.4 * kk;
    if(P.upper) P.upper.rotation.x = vLerp(store, 'eLean', -0.22 * kk + 0.26 * s + Math.sin(t * 0.8) * 0.03, rate, dt);
    if(P.skirt){ const w = 1 + Math.sin(t * 1.3) * 0.035; P.skirt.scale.set(w, 1, 2 - w); }
    if(P.ripple){ P.ripple.rotation.z = t * 0.2; P.ripple.scale.setScalar(1 + ((t * 0.35) % 1) * 0.25); }
    if(P.ghost){ P.ghost.position.x = 0.24 + Math.sin(t * 0.7) * 0.1; P.ghost.rotation.y = 0.22 + Math.sin(t * 0.5) * 0.12; }
  }
  // ボス本体(updateBossAnim から)。振りかぶり = 近接の輪と同じ進み具合
  function poseDuskEchoBoss(en, P, t, dt, k){
    const slam = (en.postAtkRecoveryT || 0) > 0 && k == null ? en.postAtkRecoveryT / POST_ATTACK_RECOVERY_SEC : 0;
    poseDuskEchoBody(P, t, dt, en.knockedDown ? null : k, en.knockedDown ? 0 : slam, en);
  }
  // ボスの分身(updateMobAnim から)。分身は水鏡の影と同じ AI なので、その溜めと一撃を読む
  function poseDuskEchoClone(en, dt){
    en.animT = (en.animT || 0) + dt;
    let k = null, slam = 0;
    if(en.mirrorState === 'windup') k = 1 - Math.max(0, en.mirrorT) / Math.max(0.01, en.mirrorWindupDur || 0.01);
    else if(en.mirrorState === 'strike') slam = Math.max(0, en.mirrorT) / MIRROR_STRIKE_SEC;
    poseDuskEchoBody(en.echoParts, en.animT, dt, k, slam, en);
  }

  /* 波紋。プレイヤーが水際を歩いた時と、小舟に近づいた時に出る。
     数を絞って使い捨てにしてあるので、専用のプールは作っていない ――
     同時に出るのはせいぜい数枚で、寿命も1秒前後。 */
  function spawnDuskRipple(x, z, r0){
    if(duskRipples.length >= 10) return;
    const mat = new THREE.MeshBasicMaterial({color:0x8fc8d8, transparent:true, opacity:0.32,
      side:THREE.DoubleSide, depthWrite:false});
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 16), mat);
    mesh.rotation.x = -Math.PI/2;
    mesh.position.set(x, -0.28, z);
    mesh.scale.setScalar(r0 || 1);
    scene.add(mesh);
    duskRipples.push({mesh, mat, t:0, life:1.3 + Math.random()*0.5});
  }

  function updateDuskVillage(dt){
    if(currentWorldKey !== 'duskvillage') return;
    const t = mechTime;   // 全体で共有している経過時間(14-hud-boot.js)

    // 演出中の同行者の歩み(洋館の manorSmithWalk と同じ考え方)
    stepDuskGuestWalk(dt);

    // 商店街の複合戦闘(WORK 5)。波の時間はゲーム内時間で進む
    stepDuskMarketFight(dt);

    // 水門の開放(WORK 6)。撃破後、歩けるまま門が上がっていく
    stepDuskWaterGate(dt);
    stepDuskDawn(dt);        // 夜明け(WORK 7)
    // 村の奥の記憶(WORK 6)
    stepDuskDeepMemories(dt);

    /* ---- 入れる建物の屋根(WORK 4) ----
       カメラは真上からなので、屋根があると中が一切見えない ―― 魚屋の帳場も、
       住宅の食卓も、船小屋の舟も、置いてあるだけで見えないままになる。
       中にいる棟の屋根だけを透かす。切り替えは補間なので、出入りのたびに
       画面が点滅しない。屋根そのものは残る(外から見た村の形は変わらない) */
    for(let i=0;i<duskInteriors.length;i++){
      const h = duskInteriors[i];
      const inside = Math.abs(state.pos.x - h.x) < h.w/2 + 0.8
                  && Math.abs(state.pos.z - h.z) < h.d/2 + 0.8;
      const want = inside ? 1 : 0;
      h.k += (want - h.k) * Math.min(1, dt * 6);
      h.mat.opacity = 1 - h.k * 0.92;
      h.mesh.visible = h.mat.opacity > 0.03;
    }

    // ---- 時間帯(zの進み具合で補間。撃破後は dawn へ寄せる) ----
    /* 色も強さも、帯の間を連続に補間する(core/dusk-light.js)。以前は光の色だけ
       帯の中間点で選び替えていて、広場と船小屋の往復で景色が跳んでいた */
    /* 何で暮れるか(CH1-EXP X-6b、DEC-006 EX-2 = A): 村で起きた出来事。
       プレイヤーの位置では決めないので、引き返しても巻き戻らない。
       テストモードの開始地点(出来事を飛ばして途中から入る)だけは、その場所の
       帯まで目標を上げる ―― 上げるだけなので、戻っても巻き戻らないのは同じ */
    if(state.testMode) duskBandTarget = Math.max(duskBandTarget, duskBandPosAtZ(state.pos.z));
    duskBandPos = stepDuskBandPos(duskBandPos, duskBandTarget, dt);
    const L = duskLight(duskBandPos, duskDawnT);
    if(!duskSkyColor) duskSkyColor = new THREE.Color();
    duskSkyColor.setHex(L.sky);
    if(scene.fog){
      scene.background = duskSkyColor;
      scene.fog.color.copy(duskSkyColor);
      scene.fog.density = L.fog;
    }
    if(sunLight){ sunLight.intensity = L.sunI; sunLight.color.setHex(L.sun); }
    if(hemiLight){
      hemiLight.intensity = L.hemi;
      hemiLight.color.setHex(L.hemiSky);
      hemiLight.groundColor.setHex(L.hemiGnd);
    }
    if(rimLight){ rimLight.intensity = L.rimI; rimLight.color.setHex(L.rim); }
    if(renderer) renderer.toneMappingExposure = L.exp * (state.brightness || 1);

    // ---- 水面 ----
    // 直交する2つの波を足して、割り切れない周期でうねらせる。
    // 位相に x+z を混ぜてあるので、縞ではなく水面らしい面の起伏になる
    if(duskWater && duskWaterBase){
      const pos = duskWater.geometry.attributes.position;
      const arr = pos.array;
      for(let i=0;i<arr.length;i+=3){
        const px = duskWaterBase[i], py = duskWaterBase[i+1];
        arr[i+2] = Math.sin(px*0.22 + t*0.9) * 0.085
                 + Math.sin(py*0.17 - t*0.63) * 0.065
                 + Math.sin((px+py)*0.09 + t*0.41) * 0.05;
      }
      pos.needsUpdate = true;
      duskWater.geometry.computeVertexNormals();
    }

    // ---- 環境オブジェクト ----
    // 全部を同じ拍で動かさないため、位相・周期はプロップごとに持たせてある。
    // react を持つもの(小舟)だけ、プレイヤーが近づくと揺れが増える
    for(let i=0;i<duskProps.length;i++){
      const p = duskProps[i];
      const o = p.obj;
      if(!o) continue;
      let boost = 1;
      if(p.react){
        const dx = state.pos.x - o.position.x, dz = state.pos.z - o.position.z;
        const near = (dx*dx + dz*dz) < p.react*p.react;
        p.reactT = near ? Math.min(1, p.reactT + dt*1.6) : Math.max(0, p.reactT - dt*0.7);
        boost = 1 + p.reactT*1.7;
      }
      /* 環境異常(WORK 4): 選ばれた小舟だけ、位相を進めずに止める。
         時間が戻るわけではないので、解けた瞬間に「少し遅れて追いつく」 */
      if(p === duskLagProp){ p.lagHold = (p.lagHold || 0) + dt; }
      const lt = t - (p.lagHold || 0);
      const s = Math.sin(lt*p.freq*Math.PI*2 + p.phase);
      const s2 = Math.sin(lt*p.freq*1.37*Math.PI*2 + p.phase*1.7);
      switch(p.kind){
        case 'boat':
          o.position.y = p.baseY + s*p.amp*boost;
          o.rotation.z = p.baseRotZ + s2*p.amp*0.9*boost;
          o.rotation.x = p.baseRotX + s*p.amp*0.4*boost;
          break;
        case 'float':
          o.position.y = p.baseY + s*p.amp;
          break;
        case 'cloth':   // 洗濯物・網。面の傾きと軽いはためき
          o.rotation.x = p.baseRotX + s*p.amp;
          o.rotation.z = p.baseRotZ + s2*p.amp*0.55;
          break;
        case 'sign':
          o.rotation.z = p.baseRotZ + s*p.amp;
          break;
        case 'swing':   // 釣瓶・秤。吊り下がって前後に振れる
          o.rotation.z = p.baseRotZ + s*p.amp;
          o.rotation.x = p.baseRotX + s2*p.amp*0.4;
          break;
        case 'ropeSag':
          o.position.y = p.baseY + s*p.amp;
          break;
        case 'reeds':
          o.rotation.z = p.baseRotZ + s*p.amp + s2*p.amp*0.3;
          break;
        case 'spin':
          o.rotation.z = p.baseRotZ + s*p.amp;
          break;
        case 'lamp':
          // 炎の揺らぎ。位置ではなく明るさで見せる
          o.position.y = p.baseY + s*p.amp*0.12;
          if(p.light) p.light.intensity = 0.42 + (s*0.5 + s2*0.5)*0.12;
          break;
        default:        // 'sway': 木・布看板・鎖
          o.rotation.z = p.baseRotZ + s*p.amp;
          break;
      }
    }

    // ---- 波紋 ----
    for(let i=duskRipples.length-1;i>=0;i--){
      const r = duskRipples[i];
      r.t += dt;
      const kk = r.t / r.life;
      r.mesh.scale.setScalar(1 + kk*3.2);
      r.mat.opacity = 0.32 * (1 - kk);
      if(kk >= 1){ scene.remove(r.mesh); duskRipples.splice(i,1); }
    }

    /* ---- 船小屋の環境異常(WORK 4) ----
       「何か見間違えたかな」程度の小さなずれを1つだけ。船小屋のあたりに
       いる間、たまに小舟の揺れが一瞬だけ止まって、少し遅れて追いつく。
       同時に複数を起こさない ―― 全部ずらすと、ただの不具合に見える */
    if(duskLagT > 0){
      duskLagT -= dt;
      if(duskLagT <= 0) duskLagProp = null;
    } else {
      duskLagCD -= dt;
      const room = duskRoomAt(state.pos.x, state.pos.z);
      if(duskLagCD <= 0 && room && (room.id === 'boat' || room.id === 'boatCor')){
        duskLagCD = 9 + Math.random()*7;
        // 近くの小舟をひとつだけ選ぶ
        for(let i=0;i<duskProps.length;i++){
          const p = duskProps[i];
          if(p.kind !== 'boat') continue;
          if(state.pos.distanceTo(p.obj.position) > 12) continue;
          duskLagProp = p;
          duskLagT = 0.9 + Math.random()*0.5;
          break;
        }
      }
    }

    // ---- プレイヤーへの反応 ----
    // 歩いている間だけ。水際(部屋の縁から2.2以内)を通ると小さな波紋が立ち、
    // 木橋の上では板が軋む。どちらも間引いて、鳴らしすぎ/出しすぎを防ぐ
    if(duskRippleCD > 0) duskRippleCD -= dt;
    if(duskCreakCD > 0) duskCreakCD -= dt;
    const moving = state.vel.lengthSq() > 1.2;
    const room = duskRoomAt(state.pos.x, state.pos.z);
    if(moving && room){
      const edge = Math.min(state.pos.x - room.x0, room.x1 - state.pos.x,
                            state.pos.z - room.z0, room.z1 - state.pos.z);
      if(edge < 2.2 && duskRippleCD <= 0){
        duskRippleCD = 0.55;
        const nx = state.pos.x + (Math.random()-0.5)*1.4;
        const nz = state.pos.z + (Math.random()-0.5)*1.4;
        spawnDuskRipple(nx, nz, 0.7);
      }
      if(room.id === 'bridge' && duskCreakCD <= 0){
        duskCreakCD = 1.1 + Math.random()*0.9;
        sfx('woodCreak');
      }
    }
    // 小舟に近づくと、舟が立てた波が水面に広がる
    if(duskRippleCD <= 0){
      for(let i=0;i<duskProps.length;i++){
        const p = duskProps[i];
        if(p.kind !== 'boat' || p.reactT < 0.55) continue;
        if(Math.random() < 0.35){
          duskRippleCD = 0.7;
          spawnDuskRipple(p.obj.position.x + (Math.random()-0.5)*2.2,
                          p.obj.position.z + (Math.random()-0.5)*2.2, 0.9);
        }
        break;
      }
    }
  }

  /* =========================================================
