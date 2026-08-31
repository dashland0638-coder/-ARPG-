// テストモード用トレーニング空間(2026-08-31指示: 「上位職のデバッグが
// しづらいのでテストモードをタイトルから入れるように新装しましょう。
// トレーニング空間とカカシを配置」)
// (14-training-ground.js - concatenated with the other src/legacy/parts/*.js
// files into one shared scope at build time; see src/legacy/concat-plugin.js)

  /* =========================================================
     TRAINING GROUND

     テストモード(タイトル画面 → 🛠テストモード)専用のワールド。他の
     ダンジョンと同じ WORLD_DEFS/WORLD_MOOD/worldKeyForPos/setWorldBounds
     の仕組みにそのまま乗せてある(02-world-common.js/06-player-enemy.js
     参照) ―― 「x>400の未使用領域」という座標だけの取り決めで、他の
     ダンジョンとは物理的に重ならない。

     カカシ(訓練用の的)自体はbuildEnemy()にvariant.dummy:trueとして
     渡すことで作る(06-player-enemy.js)。ダメージ判定・被弾演出・体幹・
     ノックバックといった戦闘まわりの仕組みは通常の敵と完全に共有し、
     見た目(獣の脚や鼻先を隠して藁人形に仕立てる)だけを差し替えている。
     実際の3体の配置はspawnEnemies()側(07-ai-combat.js、
     _spawnWorldKey==='training'の分岐)で行う。
  ========================================================= */
  function buildTrainingGround(){
    const CX = 455, CZ = 0;   // worldKeyForPos(06-player-enemy.js)のtraining領域(x>400)の中心付近
    const floorTex = makeStoneTileTexture('#4a4f5c', '#2c2f38', '#6a7488', 4, 8, 6, {bump:0.05});
    const floorMat = new THREE.MeshStandardMaterial({map:floorTex, roughness:0.75});
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 46), floorMat);
    floor.rotation.x = -Math.PI/2;
    floor.position.set(CX, 0.01, CZ);
    floor.receiveShadow = true;
    scene.add(floor);

    // 周囲を軽く囲うだけの壁(実際の当たり判定はworldBounds/
    // clampToWorldBoundsが担うので、壁は「ここが空間の端」と分かる
    // 目印程度の役割)
    const wallTex = makeNoiseTexture('#2a2e38', ['#22252d','#333842','#1c1f26'], 5, 3);
    const wallMat = new THREE.MeshStandardMaterial({map:wallTex, color:0x2a2e38, roughness:0.85});
    addWallBox(CX, CZ-23.3, 64, 0.6, wallMat);   // 北
    addWallBox(CX, CZ+23.3, 64, 0.6, wallMat);   // 南
    addWallBox(CX-32.3, CZ, 0.6, 46, wallMat);   // 西
    addWallBox(CX+32.3, CZ, 0.6, 46, wallMat);   // 東

    // 中立で見やすい照明(WORLD_MOODのtraining設定と合わせ、キャラの
    // 色味がそのまま見える明るいテスト用ライティングにしてある)
    const lamp = new THREE.PointLight(0xdfe8f4, 0.5, 40);
    lamp.position.set(CX, 8, CZ);
    scene.add(lamp);

    // 訓練の的(カカシ)自体はspawnEnemies()側(07-ai-combat.js)で
    // _spawnWorldKey==='training'の時に配置する ―― buildWorld()は
    // def.build()の直後にspawnEnemiesForWorld()を呼ぶ順序で、
    // spawnEnemies()内でenemies配列を作り直すため、ここでenemiesへ
    // 直接pushしても上書きされて消えてしまう(buildWorldの実行順参照)
  }
