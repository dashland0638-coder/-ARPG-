// src/render/lowpoly-primitives.js の単体テスト。ゲームを起動せず、
// ジオメトリが妥当な形(頂点数・NaN無し・法線あり)で返ることだけを確認する。
// Run with `npm run test:unit`(node --test)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTrapezoidBox, makeWedge, makePlate, makePrism, makeLoft } from '../../src/render/lowpoly-primitives.js';

function assertSaneGeometry(geo, minTris){
  assert.ok(geo.attributes.position, 'position属性がある');
  const pos = geo.attributes.position;
  assert.ok(pos.count >= 3, '頂点が3つ以上ある');
  for(let i=0;i<pos.count;i++){
    assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)), `頂点${i}にNaN/Infinityが無い`);
  }
  assert.ok(geo.attributes.normal, 'computeVertexNormals()で法線が計算されている');
  const triCount = geo.index ? geo.index.count/3 : pos.count/3;
  assert.ok(triCount >= minTris, `三角形数が${minTris}以上(実際:${triCount})`);
}

test('makeTrapezoidBox', async (t) => {
  await t.test('通常サイズで妥当なジオメトリを返す', () => {
    const geo = makeTrapezoidBox({topW:0.5, topD:0.3, botW:0.7, botD:0.5, height:0.6});
    assertSaneGeometry(geo, 12);   // 6面 x 2三角形
  });
  await t.test('上面オフセットで前傾させても壊れない', () => {
    const geo = makeTrapezoidBox({topW:0.4, topD:0.3, botW:0.6, botD:0.4, height:0.5, topOffsetZ:0.15});
    assertSaneGeometry(geo, 12);
    // topOffsetZだけ上面がZ方向にずれているはず
    const pos = geo.attributes.position;
    const topZs = [];
    for(let i=0;i<pos.count;i++) if(pos.getY(i) > 0) topZs.push(pos.getZ(i));
    const avgTopZ = topZs.reduce((a,b)=>a+b,0)/topZs.length;
    assert.ok(Math.abs(avgTopZ - 0.15) < 1e-6, '上面中心がtopOffsetZ分ずれている');
  });
});

test('makeWedge', async (t) => {
  await t.test('ridgeW=0で四角錐(頂点1つ)になる', () => {
    const geo = makeWedge({baseW:0.4, baseD:0.3, height:0.35, ridgeW:0});
    assertSaneGeometry(geo, 6);   // 底面2 + 側面4
    assert.equal(geo.attributes.position.count, 5, '底面4+頂点1の5頂点');
  });
  await t.test('ridgeW>0で稜線を持つくさび形になる', () => {
    const geo = makeWedge({baseW:0.5, baseD:0.4, height:0.4, ridgeW:0.2, ridgeOffsetZ:0.1});
    assertSaneGeometry(geo, 8);
    assert.equal(geo.attributes.position.count, 6, '底面4+稜線2の6頂点');
  });
  await t.test('非対称オフセット(片側だけ尖る肩鎧)を指定しても壊れない', () => {
    const geo = makeWedge({baseW:0.6, baseD:0.5, height:0.5, ridgeW:0, ridgeOffsetX:0.2, ridgeOffsetZ:-0.15});
    assertSaneGeometry(geo, 6);
  });
});

test('makePlate: 自由な頂点指定で不規則形状(マント/布)が作れる', async (t) => {
  await t.test('矩形の輪郭(makeClothPanel互換の形)で妥当な平面が作れる', () => {
    const geo = makePlate([{x:-0.25,y:0},{x:0.25,y:0},{x:0.25,y:1},{x:-0.25,y:1}]);
    assertSaneGeometry(geo, 2);
  });
  await t.test('不規則なギザギザの裾(非矩形の輪郭)でも壊れずに作れる', () => {
    // マントの裾を左右非対称・不揃いな歯型にした輪郭 - Plateが「自由な
    // 頂点指定」を要求されている核心部分。矩形やLathe/Cylinderでは作れない形。
    const outline = [
      {x:-0.3, y:1.2}, {x:0.32, y:1.15},        // 肩口(上端、わずかに非対称)
      {x:0.5,  y:0.4},                           // 右側へ広がる裾
      {x:0.38, y:0.05}, {x:0.30, y:0.22},        // 裾のギザギザ(歯型1)
      {x:0.12, y:-0.05}, {x:0.02, y:0.18},       // 歯型2
      {x:-0.15,y:-0.12}, {x:-0.28,y:0.10},       // 歯型3(左右非対称)
      {x:-0.55,y:0.35},                          // 左側へ広がる裾
    ];
    const geo = makePlate(outline, {foldWaves:2.2, foldDepth:0.05});
    assertSaneGeometry(geo, outline.length - 2);
    // 輪郭の頂点それぞれがXY平面上の指定通りの位置に存在すること(自由な
    // 頂点指定がそのまま形状に反映されていることの確認)
    const pos = geo.attributes.position;
    const seen = outline.map(()=>false);
    for(let i=0;i<pos.count;i++){
      outline.forEach((p,oi)=>{
        if(Math.abs(pos.getX(i)-p.x) < 1e-5 && Math.abs(pos.getY(i)-p.y) < 1e-5) seen[oi] = true;
      });
    }
    assert.ok(seen.every(Boolean), '輪郭の全頂点がジオメトリ内に存在する');
  });
  await t.test('thickness>0で薄板(Extrude)にしても壊れない', () => {
    const geo = makePlate([{x:-0.2,y:-0.2},{x:0.2,y:-0.2},{x:0.2,y:0.2},{x:-0.2,y:0.2}], {thickness:0.03});
    assertSaneGeometry(geo, 2);
  });
});

test('makePrism', async (t) => {
  await t.test('先細りの刀身断面(hex)が妥当なジオメトリになる', () => {
    const geo = makePrism({length:1.5, scaleStart:1, scaleEnd:0.3});
    assertSaneGeometry(geo, 12);   // 6辺 x 2三角形
    const pos = geo.attributes.position;
    let maxRAtBase = 0, maxRAtTip = 0;
    for(let i=0;i<pos.count;i++){
      const y = pos.getY(i);
      const r = Math.hypot(pos.getX(i), pos.getZ(i));
      if(y < 0.01) maxRAtBase = Math.max(maxRAtBase, r);
      if(y > 1.49) maxRAtTip = Math.max(maxRAtTip, r);
    }
    assert.ok(maxRAtBase > maxRAtTip, '根元(scaleStart)の方が切先(scaleEnd)より太い = 先細りになっている');
  });
});

// 閉じたメッシュの符号付き体積(発散定理: V = (1/6)Σ v0・(v1×v2))。
// 三角形の巻き方向が全面で一貫して外向きになっていれば正になる ――
// 面の向きが裏返っている(=見た目には見えなくなる)バグを、
// スクリーンショット無しでも自動検出できる
function signedVolume(geo){
  const pos = geo.attributes.position;
  const idx = geo.index;
  let vol = 0;
  for(let i=0;i<idx.count;i+=3){
    const a = idx.getX(i), b = idx.getX(i+1), c = idx.getX(i+2);
    const v0x=pos.getX(a), v0y=pos.getY(a), v0z=pos.getZ(a);
    const v1x=pos.getX(b), v1y=pos.getY(b), v1z=pos.getZ(b);
    const v2x=pos.getX(c), v2y=pos.getY(c), v2z=pos.getZ(c);
    const cx = v1y*v2z - v1z*v2y;
    const cy = v1z*v2x - v1x*v2z;
    const cz = v1x*v2y - v1y*v2x;
    vol += (v0x*cx + v0y*cy + v0z*cz);
  }
  return vol/6;
}

test('makeLoft', async (t) => {
  await t.test('validation: sections が2未満なら空ジオメトリ+警告(例外を投げない)', () => {
    const geo = makeLoft({ sections:[{y:0, points:[[0,0],[1,0],[1,1]]}] });
    assert.equal(geo.attributes.position, undefined, '頂点属性が設定されない空のBufferGeometry');
  });

  await t.test('validation: sections が空でも例外を投げない', () => {
    assert.doesNotThrow(() => makeLoft({ sections:[] }));
    assert.doesNotThrow(() => makeLoft({}));
  });

  await t.test('validation: 断面のpointsが3未満なら空ジオメトリ+警告', () => {
    const geo = makeLoft({ sections:[
      {y:1, points:[[0,0],[1,0]]},
      {y:0, points:[[0,0],[1,0]]},
    ]});
    assert.equal(geo.attributes.position, undefined);
  });

  await t.test('validation: 断面間でpoints.lengthが異なれば空ジオメトリ+警告', () => {
    const geo = makeLoft({ sections:[
      {y:1, points:[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]]},
      {y:0, points:[[-0.3,-0.3],[0.3,-0.3],[0.3,0.3]]},   // 3点(section Aは4点)
    ]});
    assert.equal(geo.attributes.position, undefined);
  });

  await t.test('ユーザーAPI例(4点四角形×2断面、Top/Bottomを閉じる)が妥当なジオメトリになる', () => {
    const geo = makeLoft({
      sections: [
        { y: 1.0, points: [[-0.5,-0.3],[0.5,-0.3],[0.5,0.3],[-0.5,0.3]] },
        { y: 0.0, points: [[-0.3,-0.2],[0.3,-0.2],[0.3,0.2],[-0.3,0.2]] },
      ],
      closedTop: true,
      closedBottom: true,
    });
    // 側面: 4辺 x 2三角形 = 8。上下キャップ: 4角形のファン分割(4-2=2枚)x2 = 4。計12三角形
    assertSaneGeometry(geo, 12);
    assert.equal(geo.index.count/3, 12, '三角形数が想定通り(側面8+キャップ4)');
    assert.ok(signedVolume(geo) > 0, '閉じた立体の符号付き体積が正 = 全面が一貫して外向きに巻かれている(裏返り無し)');
  });

  await t.test('断面のY順が昇順(下→上)でもTop/Bottomを正しく判定して閉じる', () => {
    const geo = makeLoft({
      sections: [
        { y: 0.0, points: [[-0.3,-0.2],[0.3,-0.2],[0.3,0.2],[-0.3,0.2]] },
        { y: 1.0, points: [[-0.5,-0.3],[0.5,-0.3],[0.5,0.3],[-0.5,0.3]] },
      ],
      closedTop: true,
      closedBottom: true,
    });
    assert.ok(signedVolume(geo) > 0, '配列順が昇順でも外向きに巻かれている');
  });

  await t.test('3断面(点数は同じ、形は断面ごとに異なる)を積み重ねられる ―― 回転体では作れない、\
高さごとに前後/左右の比率が違う断面(例: 腰は正方形寄り、胸は前後に薄く左右に広い、肩で絞る)', () => {
    const geo = makeLoft({
      sections: [
        { y: 0.0, points: [[-0.30,-0.20],[0.30,-0.20],[0.30, 0.20],[-0.30, 0.20]] },   // 腰: ほぼ正方形
        { y: 0.5, points: [[-0.55,-0.10],[0.55,-0.10],[0.55, 0.10],[-0.55, 0.10]] },   // 胸: 前後に薄く、左右に広い
        { y: 1.0, points: [[-0.25,-0.15],[0.25,-0.15],[0.25, 0.15],[-0.25, 0.15]] },   // 肩: 再び絞る
      ],
      closedTop: true,
      closedBottom: true,
    });
    // 側面: 4辺 x 2断面ぶん x 2三角形 = 16。キャップ: 2枚 x 2三角形 = 4。計20三角形
    assertSaneGeometry(geo, 20);
    assert.equal(geo.index.count/3, 20);
    assert.ok(signedVolume(geo) > 0, '断面の形が段ごとに違っても、閉じた立体として一貫して外向きに巻かれている');
    // 胸(y=0.5)の断面がLatheでは作れない「前後に薄く左右に広い」形のまま
    // 反映されていることを直接確認する(x方向の最大幅 > z方向の最大幅)
    const pos = geo.attributes.position;
    let maxXAt05 = 0, maxZAt05 = 0;
    for(let i=0;i<pos.count;i++){
      if(Math.abs(pos.getY(i) - 0.5) < 1e-6){
        maxXAt05 = Math.max(maxXAt05, Math.abs(pos.getX(i)));
        maxZAt05 = Math.max(maxZAt05, Math.abs(pos.getZ(i)));
      }
    }
    assert.ok(maxXAt05 > maxZAt05, '胸の断面が前後(Z)より左右(X)に広い非円形の形状のまま生成されている');
  });
});
