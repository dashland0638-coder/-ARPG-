// Low Poly向けの追加ジオメトリ生成ヘルパー(グラフィック刷新プロジェクト)。
//
// 既存の src/textures/textures.js と同じ位置づけの「真のESモジュール」-
// state / scene / camera など ~90個の共有可変変数(ARCHITECTURE.md参照)には
// 一切依存しない純粋関数のみで、three からジオメトリを組み立てて返すだけ。
// legacy/parts/*.js からは concat-plugin.js のHEADER経由でimportされ、
// 通常の関数として呼び出される。
//
// なぜ追加するか: 既存の限界(既存グラフィック解析より)
//   - THREE.LatheGeometry(旋盤): 縦軸まわりに完全対称な形しか作れない
//   - THREE.Box/Cylinder/Cone/Sphere/Torus: 単体では「胸鎧が前後左右で
//     別の絞り方をする」「肩鎧が片側だけ鋭く尖る」ような非対称・自由な
//     輪郭を表現できない
// ここで追加する4つは、いずれも「低ポリ・低コスト」を保ったまま、その
// 隙間を埋めるための最小限の関数。Box/Polyhedron/Prism(に相当するもの)は
// three.js標準の BoxGeometry / IcosahedronGeometry 等がそのまま使えるため
// ここでは重複実装しない(呼び出し側でそのまま使う)。
//
// 全ジオメトリ共通の方針:
//   - 頂点法線は computeVertexNormals() で滑らかに計算するが、呼び出し側が
//     MeshStandardMaterial に flatShading:true を指定すれば(既存コードの
//     clothMatFlat/trimMatFlat と同じ手法)、画面には面ごとのフラットな
//     陰影として描画される。ジオメトリ側で法線を手計算する必要はない。
//   - 非インデックス化はしない(頂点共有でメッシュを軽量に保つ) -
//     flatShading:true が面ごとの陰影を保証するため、頂点共有していても
//     「面ごとに明暗が変わる」低ポリらしい見た目は失われない。

import * as THREE from 'three';

/* ---------------------------------------------------------------------
   TrapezoidBox: 上面/下面のサイズ(と中心のオフセット)を別々に指定できる箱。
   胸鎧・腰鎧・ブーツなど「回転体では作れない、前後左右で絞り方が違う」
   形状に使う。中心は原点(y: -height/2 〜 +height/2)、既存の BoxGeometry と
   同じ置き方で使える。
--------------------------------------------------------------------- */
export function makeTrapezoidBox(opts){
  const o = Object.assign({
    topW:0.6, topD:0.4, botW:0.7, botD:0.5, height:0.5,
    topOffsetX:0, topOffsetZ:0, botOffsetX:0, botOffsetZ:0,
  }, opts || {});
  const hy = o.height/2;
  const bx = o.botOffsetX, bz = o.botOffsetZ, tx = o.topOffsetX, tz = o.topOffsetZ;
  // 8頂点: 底面4つ(b0..b3)+ 上面4つ(t0..t3)。b0/t0 = -x,-z から反時計回り
  const verts = [
    [bx-o.botW/2,-hy,bz-o.botD/2], [bx+o.botW/2,-hy,bz-o.botD/2],
    [bx+o.botW/2,-hy,bz+o.botD/2], [bx-o.botW/2,-hy,bz+o.botD/2],
    [tx-o.topW/2, hy,tz-o.topD/2], [tx+o.topW/2, hy,tz-o.topD/2],
    [tx+o.topW/2, hy,tz+o.topD/2], [tx-o.topW/2, hy,tz+o.topD/2],
  ];
  const idx = [
    0,2,1, 0,3,2,          // 底面
    4,5,6, 4,6,7,          // 上面
    3,2,6, 3,6,7,          // +Z面(前)
    1,0,4, 1,4,5,          // -Z面(後)
    2,1,5, 2,5,6,          // +X面(右)
    0,3,7, 0,7,4,          // -X面(左)
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts.flat(), 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/* ---------------------------------------------------------------------
   Wedge: 矩形の底面から、上端の稜線(ridgeW>0)または1点(ridgeW<=0)へ
   向かって傾斜する形。稜線の位置は前後左右(ridgeOffsetX/Z)に自由にずらせる
   ため、Cone(常に軸中心の1点へ回転対称)では作れない「片側だけ鋭く尖る
   肩鎧」「前に反った兜の鶏冠飾り」等の非対称な傾斜面に使う。
--------------------------------------------------------------------- */
export function makeWedge(opts){
  const o = Object.assign({
    baseW:0.5, baseD:0.4, height:0.4, ridgeW:0, ridgeOffsetX:0, ridgeOffsetZ:0,
  }, opts || {});
  const hy = o.height/2;
  const b0 = [-o.baseW/2,-hy,-o.baseD/2], b1 = [o.baseW/2,-hy,-o.baseD/2];
  const b2 = [ o.baseW/2,-hy, o.baseD/2], b3 = [-o.baseW/2,-hy, o.baseD/2];
  const geo = new THREE.BufferGeometry();
  if(o.ridgeW <= 1e-6){
    // 四角錐: 頂点1つ(apex)
    const apex = [o.ridgeOffsetX, hy, o.ridgeOffsetZ];
    const verts = [b0,b1,b2,b3,apex].flat();
    const idx = [
      0,2,1, 0,3,2,     // 底面
      0,1,4,            // 側面(後)
      1,2,4,            // 側面(右)
      2,3,4,            // 側面(前)
      3,0,4,            // 側面(左)
    ];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
  } else {
    // 稜線(2頂点、X軸方向にridgeWの幅を持つ線)へ収束するくさび形
    const r0 = [o.ridgeOffsetX - o.ridgeW/2, hy, o.ridgeOffsetZ];
    const r1 = [o.ridgeOffsetX + o.ridgeW/2, hy, o.ridgeOffsetZ];
    const verts = [b0,b1,b2,b3,r0,r1].flat();
    const idx = [
      0,2,1, 0,3,2,     // 底面
      0,1,4, 1,5,4,     // 側面(後、台形を2枚の三角形に)
      1,2,5,            // 側面(右)
      2,3,5, 3,4,5,     // 側面(前)
      3,0,4,            // 側面(左)
    ];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
  }
  geo.computeVertexNormals();
  return geo;
}

/* ---------------------------------------------------------------------
   Plate: 自由な2D輪郭(XY平面)から作る薄いポリゴン板。マント/ローブ/
   腰布/毛皮/髪/羽に使う。既存 makeClothPanel() の「矩形+中央列を正弦波で
   Z変位」を、任意の輪郭点列に一般化したもの。
     outline: [{x,y}, ...] 反時計回り、原点は板のピボット
     opts.foldWaves/foldDepth: 既存 makeClothPanel と同じ、正弦波のひだ
     opts.thickness: 0なら平面(ShapeGeometry)、>0ならExtrudeGeometryで薄板化
   既存コード(10-input.js/02-world-common.js)で実績のある THREE.Shape /
   ShapeGeometry をそのまま使うため、三角形分割ロジックを自前で書かない。
--------------------------------------------------------------------- */
export function makePlate(outline, opts){
  const o = Object.assign({ foldWaves:0, foldDepth:0, phase:0, thickness:0, curveSegments:1 }, opts || {});
  const shape = new THREE.Shape();
  outline.forEach((p, i) => { i===0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y); });
  shape.closePath();

  let geo;
  if(o.thickness > 0){
    geo = new THREE.ExtrudeGeometry(shape, {depth:o.thickness, bevelEnabled:false, curveSegments:o.curveSegments});
    geo.translate(0, 0, -o.thickness/2);   // 板の中心をZ=0にする(既存のPlaneGeometryベースの板と同じ基準)
  } else {
    geo = new THREE.ShapeGeometry(shape, o.curveSegments);
  }

  if(o.foldWaves > 0 && o.foldDepth > 0){
    // 輪郭のY範囲を0(下端)〜1(上端)に正規化し、makeClothPanel と同じ
    // 「高さに応じた正弦波」をZへ加算する(厚み付きの場合は前後両面とも)
    let minY = Infinity, maxY = -Infinity;
    outline.forEach(p => { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    const span = Math.max(1e-4, maxY - minY);
    const pos = geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const rowT = (pos.getY(i) - minY) / span;
      const wave = Math.sin(rowT*Math.PI*o.foldWaves + o.phase) * o.foldDepth;
      pos.setZ(i, pos.getZ(i) + wave);
    }
    pos.needsUpdate = true;
  }
  geo.computeVertexNormals();
  return geo;
}

/* ---------------------------------------------------------------------
   Prism: 2D断面(XZ平面の点列)を、始点(y=0)と終点(y=length)で別々の
   スケールに引き延ばす先細り押し出し形状。THREE.ExtrudeGeometryは断面が
   一定なので使えない「根元は太く、切先に向かって細くなる」刀身・槍・弓の
   幹に使う。両端は開放(キャップ無し) - 柄・鍔・切先など隣接パーツに
   隠れる想定で、ポリゴン数を増やさない。
--------------------------------------------------------------------- */
export function makePrism(opts){
  const o = Object.assign({
    shape:[{x:0,z:0.5},{x:0.35,z:0.15},{x:0.35,z:-0.15},{x:0,z:-0.5},{x:-0.35,z:-0.15},{x:-0.35,z:0.15}],
    length:1, scaleStart:1, scaleEnd:0.3,
  }, opts || {});
  const n = o.shape.length;
  const verts = [];
  o.shape.forEach(p => verts.push(p.x*o.scaleStart, 0, p.z*o.scaleStart));
  o.shape.forEach(p => verts.push(p.x*o.scaleEnd, o.length, p.z*o.scaleEnd));
  const idx = [];
  for(let i=0;i<n;i++){
    const a = i, b = (i+1)%n, aTop = a+n, bTop = b+n;
    idx.push(a,b,bTop, a,bTop,aTop);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
