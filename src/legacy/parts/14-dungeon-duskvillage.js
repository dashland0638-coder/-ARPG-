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

  // 時間帯。ALTITUDE_BANDS と同じ「進行度で色を補間する」手法を、高さではなく
  // z の進み具合へ置き換えて使っている。夕暮れ(入口)→薄暮(広場/商店街)→
  // 夜に近づく(水門)→夜(奥/ボス)。撃破後の夜明けは下の DUSK_DAWN が担当する
  const DUSK_BANDS = [
    {z:284, sky:0x3a2038, fog:0.013, sun:0xff9a5a, sunI:0.58, hemi:0.34, hemiSky:0x9a6a6a, hemiGnd:0x1e1420, rim:0xff8a4a, rimI:0.24, exp:0.84},  // 夕暮れ
    {z:352, sky:0x2a1d3c, fog:0.018, sun:0xd08aa8, sunI:0.44, hemi:0.28, hemiSky:0x76629a, hemiGnd:0x18122a, rim:0xa06ac8, rimI:0.22, exp:0.78},  // 薄暮
    {z:438, sky:0x141428, fog:0.026, sun:0x6a7ac0, sunI:0.26, hemi:0.19, hemiSky:0x3a4a7a, hemiGnd:0x0a0a16, rim:0x5a7ad0, rimI:0.20, exp:0.70},  // 夜に近づく
    {z:534, sky:0x080814, fog:0.034, sun:0x3a4a90, sunI:0.15, hemi:0.13, hemiSky:0x22305a, hemiGnd:0x06060c, rim:0x3a5ac0, rimI:0.18, exp:0.64},  // 夜
  ];
  // 撃破後の夜明け。ボスは WORK 7 で作るので、ここでは「duskDawnT が 0→1 に
  // なれば空が明けていく」という受け皿だけ用意してある(誰もまだ動かさない)
  const DUSK_DAWN = {sky:0x5a6a8a, fog:0.016, sun:0xffd2a0, sunI:0.62, hemi:0.42, hemiSky:0xbcc8e0, hemiGnd:0x2a2a30, rim:0xffb070, rimI:0.22, exp:0.88};

  let duskProps = [];        // 環境アニメーションの対象。{obj, kind, phase, freq, amp, ...}
  let duskWater = null;      // 水面(頂点を毎フレーム揺らす一枚板)
  let duskWaterBase = null;  // その頂点の基準座標(Float32Array)
  let duskRipples = [];      // 波紋。プレイヤー/小舟の近くに出る
  let duskBossRef = null;    // WORK 7 でボスを入れるための受け皿(今は常に null)
  let duskSkyColor = null;
  let duskDawnT = 0;         // 0=夜のまま 1=夜明け。WORK 7 の撃破演出が動かす
  let duskCreakCD = 0;       // 木橋の軋み(鳴らしすぎないための間引き)
  let duskRippleCD = 0;

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
       持たない(桟橋の縁 addLowRailBox が歩ける範囲を決める)。
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
      addFloorWithHoles(r.x0, r.x1, r.z0, r.z1, [], mat, 0.08);
      addRoomSurface(r, surf);
      buildWalls(r);
    });

    /* ---- 建物 ----
       全部の内部は作らない。「入れる」のは魚屋・住宅・船小屋・商店の店・
       水門の管理小屋の5棟で、そこだけ壁に出入口を開けてある。残りは
       シルエットとして village の密度を作るためのもの。 */
    function roof(x, z, w, d, h, ry){
      const m = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w,d)*0.74, h*0.5, 4), roofMat);
      m.position.set(x, h + h*0.22, z);
      m.rotation.y = (ry || 0) + Math.PI/4;
      m.castShadow = true;
      scene.add(m);
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
      roof(x, z, w, d, h);
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
    // 食器: 人数分ある。3人分並べたまま
    [[46.0,348.7],[46.6,349.3],[47.2,348.8]].forEach(([dx,dz])=>{
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.05, 10), potMat);
      dish.position.set(dx, 0.85, dz); scene.add(dish);
    });
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
    lamp(-8, 374); lamp(-6, 396); lamp(6, 396);
    ropeLine(-6, 390, 6, 390, 3.0, 0.4);
    [-3.5, 0, 3.5].forEach((lx,i)=>
      hanging(lx, 2.45, 390, 0.7, 0.8, clothMat, 'cloth', {amp:0.10, freq:0.49 + i*0.05}));

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

    // =====================================================================
    // ⑩ 水門 ―― 巨大な門・歯車・鎖・操作機構・管理小屋
    // =====================================================================
    // 門柱と、持ち上がったままの門扉
    [-6.5, 6.5].forEach(px=>{
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 6.4, 2.2), stoneMat);
      pillar.position.set(px, 3.2, 450); pillar.castShadow = true; scene.add(pillar);
      walls.push({minX:px-1.1, maxX:px+1.1, minZ:448.9, maxZ:451.1});
    });
    const gateSlab = new THREE.Mesh(new THREE.BoxGeometry(11, 3.4, 0.6), darkWood);
    gateSlab.position.set(0, 5.0, 450); gateSlab.castShadow = true; scene.add(gateSlab);
    // 歯車と鎖。動かないまま錆びている
    [[-6.5, 5.6], [6.5, 5.6]].forEach(([gx, gy])=>{
      const gear = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.22, 12), ironMat);
      gear.position.set(gx, gy, 448.6); gear.rotation.x = Math.PI/2; scene.add(gear);
      for(let i=0;i<10;i++){
        const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.24), ironMat);
        const a = i/10*Math.PI*2;
        tooth.position.set(gx + Math.cos(a)*1.08, gy + Math.sin(a)*1.08, 448.6);
        tooth.rotation.z = a; scene.add(tooth);
      }
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 6), ironMat);
      chain.position.set(gx, gy - 1.8, 448.9); scene.add(chain);
      duskProp(chain, 'sway', {amp:0.02, freq:0.27});
    });
    // 操作機構(レバー)と管理小屋
    post(2.6, 444, 1.0, 0.12);
    const lever = board(2.6, 1.45, 444, 0.12, 0.9, 0.12, ironMat);
    lever.rotation.z = 0.5;
    house(-8, 443, 5.5, 6, 3.4, 'E');
    shelf(-9.5, 444.5, 1.6, 0);
    board(-7, 0.9, 442.5, 1.2, 0.08, 0.6, woodMat);
    lamp(4.5, 440);
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
    // 村の奥 → ボスエリア。WORK 6 で「水門守の残響を倒すまで開かない」に
    // 変える予定だが、WORK 2 の時点では地形確認のためそのまま開く
    buildDoor('duskBossDoor', 0, 500, 6, 0x2a2438, 'NS');

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

    buildTownReturnPortal(new THREE.Vector3(0, 0, 288));
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

    // ---- 時間帯(zの進み具合で補間。撃破後は dawn へ寄せる) ----
    const z = state.pos.z;
    let a = DUSK_BANDS[0], b = DUSK_BANDS[DUSK_BANDS.length-1];
    for(let i=0;i<DUSK_BANDS.length-1;i++){
      if(z >= DUSK_BANDS[i].z && z <= DUSK_BANDS[i+1].z){ a = DUSK_BANDS[i]; b = DUSK_BANDS[i+1]; break; }
    }
    if(z < DUSK_BANDS[0].z){ a = b = DUSK_BANDS[0]; }
    if(z > DUSK_BANDS[DUSK_BANDS.length-1].z){ a = b = DUSK_BANDS[DUSK_BANDS.length-1]; }
    const k = (b.z===a.z) ? 0 : Math.max(0, Math.min(1, (z-a.z)/(b.z-a.z)));
    const d = Math.max(0, Math.min(1, duskDawnT));
    const mix = (p)=> (a[p] + (b[p]-a[p])*k) * (1-d) + DUSK_DAWN[p]*d;
    if(!duskSkyColor) duskSkyColor = new THREE.Color();
    duskSkyColor.setHex(a.sky).lerp(new THREE.Color(b.sky), k);
    if(d > 0) duskSkyColor.lerp(new THREE.Color(DUSK_DAWN.sky), d);
    if(scene.fog){
      scene.background = duskSkyColor;
      scene.fog.color.copy(duskSkyColor);
      scene.fog.density = mix('fog');
    }
    if(sunLight){ sunLight.intensity = mix('sunI'); sunLight.color.setHex(d>0.5 ? DUSK_DAWN.sun : (k<0.5?a.sun:b.sun)); }
    if(hemiLight){
      hemiLight.intensity = mix('hemi');
      hemiLight.color.setHex(d>0.5 ? DUSK_DAWN.hemiSky : (k<0.5?a.hemiSky:b.hemiSky));
      hemiLight.groundColor.setHex(d>0.5 ? DUSK_DAWN.hemiGnd : (k<0.5?a.hemiGnd:b.hemiGnd));
    }
    if(rimLight){ rimLight.intensity = mix('rimI'); rimLight.color.setHex(d>0.5 ? DUSK_DAWN.rim : (k<0.5?a.rim:b.rim)); }
    if(renderer) renderer.toneMappingExposure = mix('exp') * (state.brightness || 1);

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
      const s = Math.sin(t*p.freq*Math.PI*2 + p.phase);
      const s2 = Math.sin(t*p.freq*1.37*Math.PI*2 + p.phase*1.7);
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
