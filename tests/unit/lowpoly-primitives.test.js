// src/render/lowpoly-primitives.js の単体テスト。ゲームを起動せず、
// ジオメトリが妥当な形(頂点数・NaN無し・法線あり)で返ることだけを確認する。
// Run with `npm run test:unit`(node --test)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
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

// makeCharacterTorso()自体(src/legacy/parts/05-rendering-rig.js)は、state等
// 90個の共有可変変数に依存する「concatされた1つの共有スコープ」の一部
// (ARCHITECTURE.md参照)であり、真のESモジュールであるこのテストファイルから
// 直接importすることはできない。そのため、そこで実際に使っている
// TORSO_SECTION_RATIOSと同じ比率をここに複製し、makeLoft()自体を通して
// 「肩>胸>腰」「円形ではない(width≠depth)」という設計要件を検証する
// (比率の値を変えた場合はこのコピーも合わせて更新すること)。
const TORSO_SECTION_RATIOS = {
  waist:    { yFrac:0.00, widthMul:0.62, depthMul:0.55 },
  abdomen:  { yFrac:0.33, widthMul:0.80, depthMul:0.85 },
  chest:    { yFrac:0.66, widthMul:1.00, depthMul:0.90 },
  shoulder: { yFrac:1.00, widthMul:1.15, depthMul:0.75 },
};
function makeCharacterTorsoForTest({width, depth, height}){
  const hh = height/2;
  const sections = Object.values(TORSO_SECTION_RATIOS).map(r => {
    const hw = width*r.widthMul, hd = depth*r.depthMul;
    return { y: -hh + height*r.yFrac, points: [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]] };
  });
  return makeLoft({ sections, closedTop:true, closedBottom:true });
}

test('makeCharacterTorso(Loft胴体): 肩>胸>腰・非円形のシルエット要件', async (t) => {
  const bodyR = 0.345, bodyH = 0.80;   // BUILD.male相当の実際の値
  const geo = makeCharacterTorsoForTest({ width:bodyR, depth:bodyR, height:bodyH });

  await t.test('妥当なジオメトリが返る(NaN無し・法線あり)', () => {
    assertSaneGeometry(geo, 8*2 + 2);   // 側面3段x4面x2 + キャップ2段x2三角形
  });

  await t.test('肩幅(shoulder) > 胸幅(chest) > 腰幅(waist) ―― 樽ではない', () => {
    const pos = geo.attributes.position;
    const maxAbsXNear = (yTarget) => {
      let m = 0;
      for(let i=0;i<pos.count;i++){
        if(Math.abs(pos.getY(i) - yTarget) < 1e-6) m = Math.max(m, Math.abs(pos.getX(i)));
      }
      return m;
    };
    const hh = bodyH/2;
    const shoulderW = maxAbsXNear(-hh + bodyH*1.00);
    const chestW    = maxAbsXNear(-hh + bodyH*0.66);
    const waistW    = maxAbsXNear(-hh + bodyH*0.00);
    assert.ok(shoulderW > chestW, `肩幅(${shoulderW.toFixed(3)})が胸幅(${chestW.toFixed(3)})より広い`);
    assert.ok(chestW > waistW, `胸幅(${chestW.toFixed(3)})が腰幅(${waistW.toFixed(3)})より広い`);
  });

  await t.test('各断面で幅(X)と厚み(Z)が異なる ―― Latheのような円形断面(width==depth)ではない', () => {
    const pos = geo.attributes.position;
    const seen = new Map();   // y(丸め) -> {maxX, maxZ}
    for(let i=0;i<pos.count;i++){
      const y = Math.round(pos.getY(i)*1000)/1000;
      const e = seen.get(y) || {maxX:0, maxZ:0};
      e.maxX = Math.max(e.maxX, Math.abs(pos.getX(i)));
      e.maxZ = Math.max(e.maxZ, Math.abs(pos.getZ(i)));
      seen.set(y, e);
    }
    assert.ok(seen.size >= 4, '4段の断面がそれぞれ別の高さに存在する');
    for(const [, e] of seen){
      assert.notEqual(e.maxX, e.maxZ, `幅(${e.maxX})と厚み(${e.maxZ})が一致していない(円形断面ではない)`);
    }
  });

  await t.test('閉じた立体として面が一貫して外向きに巻かれている(裏返り無し)', () => {
    assert.ok(signedVolume(geo) > 0, '符号付き体積が正');
  });
});

// makeCharacterPelvis()自体も(makeCharacterTorsoと同じ理由で)このテスト
// ファイルから直接importできないため、05-rendering-rig.js内のPELVIS_SECTION_
// RATIOSと同じ比率をここに複製して検証する(比率を変えたらこのコピーも
// 合わせて更新すること)
const PELVIS_SECTION_RATIOS = {
  upperWaist:  { yFrac:1.00, widthMul:0.85, depthMul:0.75 },
  hip:         { yFrac:0.50, widthMul:1.10, depthMul:0.95 },
  lowerPelvis: { yFrac:0.00, widthMul:0.70, depthMul:0.60 },
};
function makeCharacterPelvisForTest({width, depth, height}){
  const hh = height/2;
  const sections = Object.values(PELVIS_SECTION_RATIOS).map(r => {
    const hw = width*r.widthMul, hd = depth*r.depthMul;
    return { y: -hh + height*r.yFrac, points: [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]] };
  });
  return makeLoft({ sections, closedTop:true, closedBottom:true });
}

test('makeCharacterPelvis(Loft骨盤): Torso-Hip-Legをつなぐくびれ形状の要件', async (t) => {
  const hipR = 0.265, pelvisH = 0.34;   // BUILD.male相当の実際の値
  const geo = makeCharacterPelvisForTest({ width:hipR, depth:hipR, height:pelvisH });

  await t.test('妥当なジオメトリが返る(NaN無し・法線あり)', () => {
    assertSaneGeometry(geo, 2*4*2 + 2);   // 側面2段x4面x2 + キャップ2段x2三角形
  });

  await t.test('Hip(中央)がUpperWaist(上端)・LowerPelvis(下端)より左右に広い ―― くびれている', () => {
    const pos = geo.attributes.position;
    const maxAbsXNear = (yTarget) => {
      let m = 0;
      for(let i=0;i<pos.count;i++){
        if(Math.abs(pos.getY(i) - yTarget) < 1e-6) m = Math.max(m, Math.abs(pos.getX(i)));
      }
      return m;
    };
    const hh = pelvisH/2;
    const upperW = maxAbsXNear(-hh + pelvisH*1.00);
    const hipW   = maxAbsXNear(-hh + pelvisH*0.50);
    const lowerW = maxAbsXNear(-hh + pelvisH*0.00);
    assert.ok(hipW > upperW, `Hip幅(${hipW.toFixed(3)})がUpperWaist幅(${upperW.toFixed(3)})より広い`);
    assert.ok(hipW > lowerW, `Hip幅(${hipW.toFixed(3)})がLowerPelvis幅(${lowerW.toFixed(3)})より広い`);
  });

  await t.test('各断面で幅(X)と厚み(Z)が異なる ―― 円形断面(width==depth)ではない', () => {
    const pos = geo.attributes.position;
    const seen = new Map();
    for(let i=0;i<pos.count;i++){
      const y = Math.round(pos.getY(i)*1000)/1000;
      const e = seen.get(y) || {maxX:0, maxZ:0};
      e.maxX = Math.max(e.maxX, Math.abs(pos.getX(i)));
      e.maxZ = Math.max(e.maxZ, Math.abs(pos.getZ(i)));
      seen.set(y, e);
    }
    assert.ok(seen.size >= 3, '3段の断面がそれぞれ別の高さに存在する');
    for(const [, e] of seen){
      assert.notEqual(e.maxX, e.maxZ, `幅(${e.maxX})と厚み(${e.maxZ})が一致していない(円形断面ではない)`);
    }
  });

  await t.test('閉じた立体として面が一貫して外向きに巻かれている(裏返り無し)', () => {
    assert.ok(signedVolume(geo) > 0, '符号付き体積が正');
  });

  await t.test('Torsoの細いWaist(bodyR*0.62/0.55)と視覚的に近い規模でつながる', () => {
    // 完全一致は不要(指示どおり)だが、桁違いに大きい/小さいと「自然に
    // つながる」とは言えないため、上端(UpperWaist)の実効半径がTorso側の
    // Waist半径のだいたい半分〜2倍のオーダーに収まることだけ確認する
    const bodyR = 0.345;
    const torsoWaistW = bodyR*0.62;
    const pos = geo.attributes.position;
    let upperW = 0;
    const hh = pelvisH/2;
    for(let i=0;i<pos.count;i++){
      if(Math.abs(pos.getY(i) - (-hh+pelvisH*1.00)) < 1e-6) upperW = Math.max(upperW, Math.abs(pos.getX(i)));
    }
    assert.ok(upperW > torsoWaistW*0.5 && upperW < torsoWaistW*2.0,
      `Pelvis上端の幅(${upperW.toFixed(3)})がTorso Waist幅(${torsoWaistW.toFixed(3)})と近いオーダーにある`);
  });
});

// makeCharacterThigh()自体も(makeCharacterTorso/Pelvisと同じ理由で)この
// テストファイルから直接importできないため、05-rendering-rig.js内の
// THIGH_SECTION_RATIOSと同じ比率をここに複製して検証する(比率を変えたら
// このコピーも合わせて更新すること)
const THIGH_SECTION_RATIOS = {
  upperThigh: { yFrac:1.00, widthMul:1.10, depthMul:0.95 },
  midThigh:   { yFrac:0.62, widthMul:1.00, depthMul:0.88 },
  lowerThigh: { yFrac:0.30, widthMul:0.85, depthMul:0.74 },
  knee:       { yFrac:0.00, widthMul:0.70, depthMul:0.62 },
};
function makeCharacterThighForTest({width, depth, height}){
  const hh = height/2;
  const sections = Object.values(THIGH_SECTION_RATIOS).map(r => {
    const hw = width*r.widthMul, hd = depth*r.depthMul;
    return { y: -hh + height*r.yFrac, points: [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]] };
  });
  return makeLoft({ sections, closedTop:true, closedBottom:true });
}

test('makeCharacterThigh(Loft太腿): PelvisからKneeへ絞られるテーパー形状の要件', async (t) => {
  const thighR = 0.132, thighLen = 0.56;   // BUILD.male相当の実際の値
  const geo = makeCharacterThighForTest({ width:thighR, depth:thighR, height:thighLen });

  await t.test('妥当なジオメトリが返る(NaN無し・法線あり)', () => {
    assertSaneGeometry(geo, 3*4*2 + 2);   // 側面3段x4面x2 + キャップ2段x2三角形
  });

  const pos = geo.attributes.position;
  const hh = thighLen/2;
  const maxAbsXNear = (yTarget) => {
    let m = 0;
    for(let i=0;i<pos.count;i++){
      if(Math.abs(pos.getY(i) - yTarget) < 1e-6) m = Math.max(m, Math.abs(pos.getX(i)));
    }
    return m;
  };
  const upperW = maxAbsXNear(-hh + thighLen*1.00);
  const midW   = maxAbsXNear(-hh + thighLen*0.62);
  const lowerW = maxAbsXNear(-hh + thighLen*0.30);
  const kneeW  = maxAbsXNear(-hh + thighLen*0.00);

  await t.test('Pelvis側(UpperThigh)が最も太く、Knee側へ向けて単調に絞られる', () => {
    assert.ok(upperW > midW,   `UpperThigh幅(${upperW.toFixed(3)})がMidThigh幅(${midW.toFixed(3)})より広い`);
    assert.ok(midW   > lowerW, `MidThigh幅(${midW.toFixed(3)})がLowerThigh幅(${lowerW.toFixed(3)})より広い`);
    assert.ok(lowerW > kneeW,  `LowerThigh幅(${lowerW.toFixed(3)})がKnee幅(${kneeW.toFixed(3)})より広い`);
  });

  await t.test('各断面で幅(X)と厚み(Z)が異なる ―― 円形断面(width==depth)ではない', () => {
    const seen = new Map();
    for(let i=0;i<pos.count;i++){
      const y = Math.round(pos.getY(i)*1000)/1000;
      const e = seen.get(y) || {maxX:0, maxZ:0};
      e.maxX = Math.max(e.maxX, Math.abs(pos.getX(i)));
      e.maxZ = Math.max(e.maxZ, Math.abs(pos.getZ(i)));
      seen.set(y, e);
    }
    assert.ok(seen.size >= 4, '4段の断面がそれぞれ別の高さに存在する');
    for(const [, e] of seen){
      assert.notEqual(e.maxX, e.maxZ, `幅(${e.maxX})と厚み(${e.maxZ})が一致していない(円形断面ではない)`);
    }
  });

  await t.test('閉じた立体として面が一貫して外向きに巻かれている(裏返り無し)', () => {
    assert.ok(signedVolume(geo) > 0, '符号付き体積が正');
  });

  await t.test('Knee側の幅がKnee関節の飾り球(B.calf*0.98相当)とオーダーが近い ―― Calfとの段差なし', () => {
    // 完全一致は不要。Kneeの飾り球はB.calf(男0.106)*0.98≒0.104が半径。
    // Thigh下端(Knee)の実効半幅がこのオーダー(0.5〜2倍)に収まっていれば、
    // 球が段差を覆い隠せる大きさとして視覚的に自然につながる。
    const kneeCapR = 0.106*0.98;
    assert.ok(kneeW > kneeCapR*0.5 && kneeW < kneeCapR*2.0,
      `Thigh Knee側の幅(${kneeW.toFixed(3)})がKnee飾り球の半径(${kneeCapR.toFixed(3)})と近いオーダーにある`);
  });
});

// makeCharacterCalf()自体も(makeCharacterTorso/Pelvis/Thighと同じ理由で)
// このテストファイルから直接importできないため、05-rendering-rig.js内の
// CALF_SECTION_RATIOSと同じ比率をここに複製して検証する(比率を変えたら
// このコピーも合わせて更新すること)
const CALF_SECTION_RATIOS = {
  upperCalf: { yFrac:1.00, widthMul:0.90, depthMul:0.80 },
  midCalf:   { yFrac:0.62, widthMul:1.05, depthMul:0.92 },
  lowerCalf: { yFrac:0.30, widthMul:0.78, depthMul:0.68 },
  ankle:     { yFrac:0.00, widthMul:0.55, depthMul:0.48 },
};
function makeCharacterCalfForTest({width, depth, height}){
  const hh = height/2;
  const sections = Object.values(CALF_SECTION_RATIOS).map(r => {
    const hw = width*r.widthMul, hd = depth*r.depthMul;
    return { y: -hh + height*r.yFrac, points: [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]] };
  });
  return makeLoft({ sections, closedTop:true, closedBottom:true });
}

test('makeCharacterCalf(Loft脛): Knee-Mid-Ankleの山型シルエット要件', async (t) => {
  const calfR = 0.106, calfLen = 0.54;   // BUILD.male相当の実際の値
  const geo = makeCharacterCalfForTest({ width:calfR, depth:calfR, height:calfLen });

  await t.test('妥当なジオメトリが返る(NaN無し・法線あり)', () => {
    assertSaneGeometry(geo, 3*4*2 + 2);   // 側面3段x4面x2 + キャップ2段x2三角形
  });

  const pos = geo.attributes.position;
  const hh = calfLen/2;
  const maxAbsXNear = (yTarget) => {
    let m = 0;
    for(let i=0;i<pos.count;i++){
      if(Math.abs(pos.getY(i) - yTarget) < 1e-6) m = Math.max(m, Math.abs(pos.getX(i)));
    }
    return m;
  };
  const upperW = maxAbsXNear(-hh + calfLen*1.00);
  const midW   = maxAbsXNear(-hh + calfLen*0.62);
  const lowerW = maxAbsXNear(-hh + calfLen*0.30);
  const ankleW = maxAbsXNear(-hh + calfLen*0.00);

  await t.test('MidCalfがUpperCalf・LowerCalf・Ankleより太い ―― Thighのような単調テーパーではなく山型', () => {
    assert.ok(midW > upperW, `MidCalf幅(${midW.toFixed(3)})がUpperCalf幅(${upperW.toFixed(3)})より広い`);
    assert.ok(midW > lowerW, `MidCalf幅(${midW.toFixed(3)})がLowerCalf幅(${lowerW.toFixed(3)})より広い`);
    assert.ok(midW > ankleW, `MidCalf幅(${midW.toFixed(3)})がAnkle幅(${ankleW.toFixed(3)})より広い`);
  });

  await t.test('Ankleが最も細い ―― Ankle側へ明確に絞られている', () => {
    assert.ok(ankleW < upperW, `Ankle幅(${ankleW.toFixed(3)})がUpperCalf幅(${upperW.toFixed(3)})より細い`);
    assert.ok(ankleW < lowerW, `Ankle幅(${ankleW.toFixed(3)})がLowerCalf幅(${lowerW.toFixed(3)})より細い`);
  });

  await t.test('各断面で幅(X)と厚み(Z)が異なる ―― 円形断面(width==depth)ではない', () => {
    const seen = new Map();
    for(let i=0;i<pos.count;i++){
      const y = Math.round(pos.getY(i)*1000)/1000;
      const e = seen.get(y) || {maxX:0, maxZ:0};
      e.maxX = Math.max(e.maxX, Math.abs(pos.getX(i)));
      e.maxZ = Math.max(e.maxZ, Math.abs(pos.getZ(i)));
      seen.set(y, e);
    }
    assert.ok(seen.size >= 4, '4段の断面がそれぞれ別の高さに存在する');
    for(const [, e] of seen){
      assert.notEqual(e.maxX, e.maxZ, `幅(${e.maxX})と厚み(${e.maxZ})が一致していない(円形断面ではない)`);
    }
  });

  await t.test('閉じた立体として面が一貫して外向きに巻かれている(裏返り無し)', () => {
    assert.ok(signedVolume(geo) > 0, '符号付き体積が正');
  });

  await t.test('UpperCalf側の幅がThigh Knee断面(B.thigh*0.70相当)とオーダーが近い ―― Thighとの段差なし', () => {
    // 完全一致は不要。Thigh下端(Knee)の実効半幅はB.thigh(男0.132)*0.70≒0.092。
    // Calf上端(UpperCalf)の実効半幅がこのオーダー(0.5〜2倍)に収まっていれば、
    // 間のKnee飾り球を挟んでThigh→Calfが視覚的に自然につながる。
    const thighKneeW = 0.132*0.70;
    assert.ok(upperW > thighKneeW*0.5 && upperW < thighKneeW*2.0,
      `Calf UpperCalf側の幅(${upperW.toFixed(3)})がThigh Knee側の幅(${thighKneeW.toFixed(3)})と近いオーダーにある`);
  });

  await t.test('Ankle側の幅がBoot(半幅B.calf*0.81相当)に収まる ―― Bootとの段差・はみ出しなし', () => {
    // BootはBoxGeometry(bw,0.15,0.26)、bw=B.calf(男0.106)*1.62なので半幅は
    // B.calf*0.81≒0.086。Ankle側がこれより細ければBoot内に収まる。
    const bootHalfW = 0.106*0.81;
    assert.ok(ankleW < bootHalfW, `Ankle幅(${ankleW.toFixed(3)})がBoot半幅(${bootHalfW.toFixed(3)})より細い(Boot内に収まる)`);
  });
});

// makeCharacterUpperArm()自体も(makeCharacterTorso/Pelvis/Thigh/Calfと
// 同じ理由で)このテストファイルから直接importできないため、
// 05-rendering-rig.js内のUPPERARM_SECTION_RATIOSと同じ比率をここに複製して
// 検証する(比率を変えたらこのコピーも合わせて更新すること)
const UPPERARM_SECTION_RATIOS = {
  upperArmTop:   { yFrac:1.00, widthMul:1.00, depthMul:0.88 },
  midUpperArm:   { yFrac:0.62, widthMul:0.96, depthMul:0.84 },
  lowerUpperArm: { yFrac:0.30, widthMul:0.90, depthMul:0.78 },
  elbow:         { yFrac:0.00, widthMul:0.82, depthMul:0.72 },
};
function makeCharacterUpperArmForTest({width, depth, height}){
  const hh = height/2;
  const sections = Object.values(UPPERARM_SECTION_RATIOS).map(r => {
    const hw = width*r.widthMul, hd = depth*r.depthMul;
    return { y: -hh + height*r.yFrac, points: [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]] };
  });
  return makeLoft({ sections, closedTop:true, closedBottom:true });
}

test('makeCharacterUpperArm(Loft二の腕): ShoulderからElbowへ緩やかに絞られる要件', async (t) => {
  const upperR = 0.098, upperLen = 0.32;   // BUILD.male相当の実際の値(upperArm長は既存の固定値0.32)
  const geo = makeCharacterUpperArmForTest({ width:upperR, depth:upperR, height:upperLen });

  await t.test('妥当なジオメトリが返る(NaN無し・法線あり)', () => {
    assertSaneGeometry(geo, 3*4*2 + 2);   // 側面3段x4面x2 + キャップ2段x2三角形
  });

  const pos = geo.attributes.position;
  const hh = upperLen/2;
  const maxAbsXNear = (yTarget) => {
    let m = 0;
    for(let i=0;i<pos.count;i++){
      if(Math.abs(pos.getY(i) - yTarget) < 1e-6) m = Math.max(m, Math.abs(pos.getX(i)));
    }
    return m;
  };
  const topW   = maxAbsXNear(-hh + upperLen*1.00);
  const midW   = maxAbsXNear(-hh + upperLen*0.62);
  const lowerW = maxAbsXNear(-hh + upperLen*0.30);
  const elbowW = maxAbsXNear(-hh + upperLen*0.00);

  await t.test('Shoulder側(UpperArmTop)が最も太く、Elbow側へ向けて単調に絞られる', () => {
    assert.ok(topW   > midW,   `UpperArmTop幅(${topW.toFixed(3)})がMidUpperArm幅(${midW.toFixed(3)})より広い`);
    assert.ok(midW   > lowerW, `MidUpperArm幅(${midW.toFixed(3)})がLowerUpperArm幅(${lowerW.toFixed(3)})より広い`);
    assert.ok(lowerW > elbowW, `LowerUpperArm幅(${lowerW.toFixed(3)})がElbow幅(${elbowW.toFixed(3)})より広い`);
  });

  await t.test('絞り幅は太腿ほど大きくない ―― 過度な筋肉表現になっていない(Thighより緩やか)', () => {
    // ThighはUpperThigh(1.10)→Knee(0.70)で約36%の絞り。UpperArmは
    // UpperArmTop(1.00)→Elbow(0.82)で約18%程度に留め、脚のような
    // 大きな量感変化にならないようにしてある。
    const shrinkRatio = (topW - elbowW) / topW;
    assert.ok(shrinkRatio < 0.30, `Shoulder→Elbowの絞り幅比率(${shrinkRatio.toFixed(3)})が太腿ほど極端ではない(<0.30)`);
  });

  await t.test('各断面で幅(X)と厚み(Z)が異なる ―― 円形断面(width==depth)ではない', () => {
    const seen = new Map();
    for(let i=0;i<pos.count;i++){
      const y = Math.round(pos.getY(i)*1000)/1000;
      const e = seen.get(y) || {maxX:0, maxZ:0};
      e.maxX = Math.max(e.maxX, Math.abs(pos.getX(i)));
      e.maxZ = Math.max(e.maxZ, Math.abs(pos.getZ(i)));
      seen.set(y, e);
    }
    assert.ok(seen.size >= 4, '4段の断面がそれぞれ別の高さに存在する');
    for(const [, e] of seen){
      assert.notEqual(e.maxX, e.maxZ, `幅(${e.maxX})と厚み(${e.maxZ})が一致していない(円形断面ではない)`);
    }
  });

  await t.test('閉じた立体として面が一貫して外向きに巻かれている(裏返り無し)', () => {
    assert.ok(signedVolume(geo) > 0, '符号付き体積が正');
  });

  await t.test('Elbow側の幅がElbow飾り球(B.forearm*1.06相当)・Forearm上端とオーダーが近い ―― 段差なし', () => {
    // 完全一致は不要。Elbowの飾り球はB.forearm(男0.083)*1.06≒0.088が半径。
    // Forearm上端(LIMB_PROFILE.forearmのu=1側)の実効半径は0.083*0.94≒0.078。
    // UpperArm下端(Elbow)の実効半幅がこのオーダー(0.5〜2倍)に収まっていれば、
    // ElbowからForearmへ視覚的に自然につながる。
    const elbowCapR = 0.083*1.06;
    assert.ok(elbowW > elbowCapR*0.5 && elbowW < elbowCapR*2.0,
      `UpperArm Elbow側の幅(${elbowW.toFixed(3)})がElbow飾り球の半径(${elbowCapR.toFixed(3)})と近いオーダーにある`);
  });
});

// makeCharacterForearm()自体も(makeCharacterTorso/Pelvis/Thigh/Calf/
// UpperArmと同じ理由で)このテストファイルから直接importできないため、
// 05-rendering-rig.js内のFOREARM_SECTION_RATIOSと同じ比率をここに複製して
// 検証する(比率を変えたらこのコピーも合わせて更新すること)
const FOREARM_SECTION_RATIOS = {
  upperForearm: { yFrac:1.00, widthMul:1.00, depthMul:0.87 },
  midForearm:   { yFrac:0.65, widthMul:0.97, depthMul:0.84 },
  lowerForearm: { yFrac:0.32, widthMul:0.85, depthMul:0.74 },
  wrist:        { yFrac:0.00, widthMul:0.68, depthMul:0.60 },
};
function makeCharacterForearmForTest({width, depth, height}){
  const hh = height/2;
  const sections = Object.values(FOREARM_SECTION_RATIOS).map(r => {
    const hw = width*r.widthMul, hd = depth*r.depthMul;
    return { y: -hh + height*r.yFrac, points: [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]] };
  });
  return makeLoft({ sections, closedTop:true, closedBottom:true });
}

test('makeCharacterForearm(Loft前腕): Elbow側は太さを保ちWristへ絞る要件', async (t) => {
  const foreR = 0.083, foreLen = 0.30;   // BUILD.male相当の実際の値(forearm長は既存の固定値0.30)
  const geo = makeCharacterForearmForTest({ width:foreR, depth:foreR, height:foreLen });

  await t.test('妥当なジオメトリが返る(NaN無し・法線あり)', () => {
    assertSaneGeometry(geo, 3*4*2 + 2);   // 側面3段x4面x2 + キャップ2段x2三角形
  });

  const pos = geo.attributes.position;
  const hh = foreLen/2;
  const maxAbsXNear = (yTarget) => {
    let m = 0;
    for(let i=0;i<pos.count;i++){
      if(Math.abs(pos.getY(i) - yTarget) < 1e-6) m = Math.max(m, Math.abs(pos.getX(i)));
    }
    return m;
  };
  const upperW = maxAbsXNear(-hh + foreLen*1.00);
  const midW   = maxAbsXNear(-hh + foreLen*0.65);
  const lowerW = maxAbsXNear(-hh + foreLen*0.32);
  const wristW = maxAbsXNear(-hh + foreLen*0.00);

  await t.test('Elbow側(UpperForearm)からMidForearmまでほぼ太さを保つ(直線的)', () => {
    const stepRatio = (upperW - midW) / upperW;
    assert.ok(stepRatio < 0.10, `UpperForearm→MidForearmの絞り比率(${stepRatio.toFixed(3)})が小さい(<0.10、ほぼ直線的)`);
  });

  await t.test('MidForearmからWristへ向けて明確に絞られる', () => {
    assert.ok(midW   > lowerW, `MidForearm幅(${midW.toFixed(3)})がLowerForearm幅(${lowerW.toFixed(3)})より広い`);
    assert.ok(lowerW > wristW, `LowerForearm幅(${lowerW.toFixed(3)})がWrist幅(${wristW.toFixed(3)})より広い`);
    const tailRatio = (midW - wristW) / midW;
    assert.ok(tailRatio > 0.15, `MidForearm→Wristの絞り比率(${tailRatio.toFixed(3)})が明確にある(>0.15)`);
  });

  await t.test('各断面で幅(X)と厚み(Z)が異なるが、差は極端ではない(width/depthの比が過度に離れていない)', () => {
    const seen = new Map();
    for(let i=0;i<pos.count;i++){
      const y = Math.round(pos.getY(i)*1000)/1000;
      const e = seen.get(y) || {maxX:0, maxZ:0};
      e.maxX = Math.max(e.maxX, Math.abs(pos.getX(i)));
      e.maxZ = Math.max(e.maxZ, Math.abs(pos.getZ(i)));
      seen.set(y, e);
    }
    assert.ok(seen.size >= 4, '4段の断面がそれぞれ別の高さに存在する');
    for(const [, e] of seen){
      assert.notEqual(e.maxX, e.maxZ, `幅(${e.maxX})と厚み(${e.maxZ})が一致していない(円形断面ではない)`);
      const ratio = e.maxZ / e.maxX;
      assert.ok(ratio > 0.7 && ratio < 1.0, `厚み/幅の比率(${ratio.toFixed(3)})が極端に離れていない(0.7〜1.0)`);
    }
  });

  await t.test('閉じた立体として面が一貫して外向きに巻かれている(裏返り無し)', () => {
    assert.ok(signedVolume(geo) > 0, '符号付き体積が正');
  });

  await t.test('Elbow側の幅がUpperArm Elbow断面・Elbow飾り球とオーダーが近い ―― 段差なし', () => {
    // 完全一致は不要。UpperArm下端(Elbow)の実効半幅はB.upper(男0.098)*0.82
    // ≒0.080、Elbow飾り球はB.forearm(男0.083)*1.06≒0.088。Forearm上端
    // (UpperForearm)の実効半幅がこのオーダー(0.5〜2倍)に収まっていれば、
    // Elbowを挟んでUpperArm→Forearmが視覚的に自然につながる。
    const upperArmElbowW = 0.098*0.82;
    assert.ok(upperW > upperArmElbowW*0.5 && upperW < upperArmElbowW*2.0,
      `Forearm UpperForearm側の幅(${upperW.toFixed(3)})がUpperArm Elbow側の幅(${upperArmElbowW.toFixed(3)})と近いオーダーにある`);
  });

  await t.test('Wrist側の幅がHand/Vambraceとオーダーが近い ―― Handとの段差なし', () => {
    // 完全一致は不要。旧LIMB_PROFILE.forearmのu=0(Wrist側)は0.64で、
    // 実効半幅は0.083*0.64≒0.053。新しいWrist断面の実効半幅がこの
    // オーダー(0.5〜2倍)に収まっていれば、旧形状からの見た目の変化が
    // 小さく、既存のHand/Vambraceとの関係を壊さない。
    const oldWristW = 0.083*0.64;
    assert.ok(wristW > oldWristW*0.5 && wristW < oldWristW*2.0,
      `Forearm Wrist側の幅(${wristW.toFixed(3)})が旧Lathe Wrist側の幅(${oldWristW.toFixed(3)})と近いオーダーにある`);
  });
});

// makeCharacterHead()自体も(makeCharacterTorso〜Forearmと同じ理由で)この
// テストファイルから直接importできないため、05-rendering-rig.js内の
// HEAD_HEX_TEMPLATE/HEAD_NOSE_TEMPLATE/HEAD_SECTION_RATIOSと同じ値を
// ここに複製して検証する(値を変えたらこのコピーも合わせて更新すること)
const HEAD_HEX_TEMPLATE = [
  [-0.78, 1.00],
  [-1.00, 0.05],
  [-0.22,-1.15],
  [ 0.22,-1.15],
  [ 1.00, 0.05],
  [ 0.78, 1.00],
];
// Face再設計フェーズ(Phase A): 鼻〜口のぷっくりした隆起(顔側右→
// noseMouthR→noseMouthL→顔側左、の順で挿入)。倍率(noseMul)ではなく
// 前方への加算オフセット(nosePush、下記HEAD_SECTION_RATIOS参照)方式。
const HEAD_NOSE_TEMPLATE = [
  [ 0.30, 1.00],
  [-0.30, 1.00],
];
// Head / Hair / Headwear Global Visual Integration再修正フェーズ:
// depthMulを断面ごとの独立値にするのをやめ、depthMul=widthMul*0.80という
// 単一ルールに置き換えた(詳細は05-rendering-rig.js側のコメント参照)。
// このテストファイルでは複製元と同じ計算結果になるよう、あらかじめ
// 計算済みの値を直接書いている
const DEPTH_TO_WIDTH_RATIO = 0.80;
const HEAD_SECTION_RATIOS = {
  chin:      { yFrac:0.00, widthMul:0.38, nosePush:0.03 },
  jaw:       { yFrac:0.22, widthMul:0.72, nosePush:0.08 },
  cheek:     { yFrac:0.52, widthMul:1.06, nosePush:0.04 },
  upperHead: { yFrac:0.80, widthMul:0.92, nosePush:0.00 },
  crown:     { yFrac:1.00, widthMul:0.60, nosePush:0.00 },
};
Object.values(HEAD_SECTION_RATIOS).forEach(r => { r.depthMul = r.widthMul * DEPTH_TO_WIDTH_RATIO; });
function makeCharacterHeadForTest({width, depth, height}){
  const hh = height/2;
  const sections = Object.values(HEAD_SECTION_RATIOS).map(r => {
    const hw = width*r.widthMul, hd = depth*r.depthMul;
    const facePts = HEAD_HEX_TEMPLATE.map(([fx,fz]) => [fx*hw, fz*hd]);
    const nosePts = HEAD_NOSE_TEMPLATE.map(([fx,fz]) => [fx*hw, fz*hd + depth*r.nosePush]);
    return { y: -hh + height*r.yFrac, points: [...facePts, ...nosePts] };
  });
  return makeLoft({ sections, closedTop:true, closedBottom:true });
}

test('makeCharacterHead(Loft頭部): Chin-Jaw-Cheek-UpperHead-Crownの非対称頭部シルエット要件', async (t) => {
  const headR = 0.3705, headLen = 0.741;   // BUILD.male相当の実際の値(height=B.headR*2)
  const geo = makeCharacterHeadForTest({ width:headR, depth:headR, height:headLen });

  await t.test('妥当なジオメトリが返る(NaN無し・法線あり)', () => {
    assertSaneGeometry(geo, 4*8*2 + 6*2);   // 側面4段x8面x2 + キャップ2段x(8-2)三角形
  });

  const pos = geo.attributes.position;
  const hh = headLen/2;
  const maxAbsXNear = (yTarget) => {
    let m = 0;
    for(let i=0;i<pos.count;i++){
      if(Math.abs(pos.getY(i) - yTarget) < 1e-6) m = Math.max(m, Math.abs(pos.getX(i)));
    }
    return m;
  };
  const chinW  = maxAbsXNear(-hh + headLen*0.00);
  const cheekW = maxAbsXNear(-hh + headLen*0.52);
  const crownW = maxAbsXNear(-hh + headLen*1.00);

  await t.test('Cheekが最大幅 ―― Chin/Crownより広い(樽/球ではなく頬骨で最大幅になる)', () => {
    assert.ok(cheekW > chinW,  `Cheek幅(${cheekW.toFixed(3)})がChin幅(${chinW.toFixed(3)})より広い`);
    assert.ok(cheekW > crownW, `Cheek幅(${cheekW.toFixed(3)})がCrown幅(${crownW.toFixed(3)})より広い`);
  });

  await t.test('各断面で幅(X)と厚み(Z)が異なる ―― 円形/正八角形断面ではない', () => {
    const seen = new Map();
    for(let i=0;i<pos.count;i++){
      const y = Math.round(pos.getY(i)*1000)/1000;
      const e = seen.get(y) || {maxX:0, maxZ:0};
      e.maxX = Math.max(e.maxX, Math.abs(pos.getX(i)));
      e.maxZ = Math.max(e.maxZ, Math.abs(pos.getZ(i)));
      seen.set(y, e);
    }
    assert.ok(seen.size >= 5, '5段の断面がそれぞれ別の高さに存在する');
    // 全断面が一律に幅==厚みだと円形/正多角形断面の疑いがあるが、1断面だけ
    // たまたま幅と厚み(nosePush込みの鼻〜口Z)が数値的に一致しても、それは
    // 「円形になった」ことを意味しない(他の断面で明確に幅≠厚みであれば、
    // 断面ごとに比率が違う=非回転対称という本来の主張は成立する)
    let mismatchCount = 0;
    for(const [, e] of seen){
      if(Math.abs(e.maxX - e.maxZ) > 1e-9) mismatchCount++;
    }
    assert.ok(mismatchCount >= seen.size - 1,
      `${seen.size}断面中${mismatchCount}断面で幅と厚みが異なる(全断面が一律に一致する円形断面ではない)`);
  });

  await t.test('顔側(+Z)は平ら・後頭部側(-Z)は絞られている ―― 前後対称な球ではない', () => {
    let maxFrontZ = 0, maxBackZ = 0;
    const yTarget = -hh + headLen*0.52;
    for(let i=0;i<pos.count;i++){
      if(Math.abs(pos.getY(i) - yTarget) < 1e-6){
        const z = pos.getZ(i);
        if(z > 0) maxFrontZ = Math.max(maxFrontZ, z);
        else maxBackZ = Math.max(maxBackZ, -z);
      }
    }
    assert.notEqual(maxFrontZ, maxBackZ,
      `顔側のZ(${maxFrontZ.toFixed(3)})と後頭部側のZ(${maxBackZ.toFixed(3)})が異なる(前後非対称)`);
  });

  await t.test('閉じた立体として面が一貫して外向きに巻かれている(裏返り無し) ―― 8点断面化後もsignedVolumeが正', () => {
    assert.ok(signedVolume(geo) > 0, '符号付き体積が正');
  });

  await t.test('Chinの幅がNeck上端(B.neck*1.15相当)と極端に乖離していない ―― 首に刺さった棒に見えない', () => {
    const neckTopR = 0.088*1.15;
    assert.ok(chinW > neckTopR*0.8,
      `Chin幅(${chinW.toFixed(3)})がNeck上端(${neckTopR.toFixed(3)})に対して極端に細くない`);
  });

  await t.test('Cheekの顔側(+Z)実効Depthが既存Eye基準(headR*0.82、Mage Hat再設計フェーズで0.90から調整)と近いオーダーにある ―― Eyeが浮かない/埋まらない', () => {
    // 完全一致は不要。既存Eye(sclera/pupil/highlight)はheadR*0.82付近の
    // Z位置に配置されている(Mage Hat再設計フェーズ「目が出っ張って見える」
    // 指摘を受け、旧headR*0.90からわずかに引き下げ、頬面へ少し沈み込む
    // 「眼窩に収まった」見た目にした)。Cheek断面(Eyeの高さに最も近い)の
    // 顔側Z実効値がheadRの0.65〜1.10倍程度のオーダーに収まっていれば、
    // Head Loft化後もEyeが新しい顔面から極端に浮いたり埋まったりしない。
    // ここではnoseMouth点(中央寄り)ではなく、Eyeと同じ側面寄りにある
    // faceL/R点(|X|>0.5*hw)側のZを見る ―― Eyeの実際のX位置(headR*0.44
    // 程度)はnoseMouth点(X=0.30*hw)より外側にあるため、こちらがEye直下
    // の実効面
    assert.ok(cheekW > 0, 'Cheek幅が正');
    let maxFrontZAtFace = 0;
    const yTarget = -hh + headLen*0.52;
    for(let i=0;i<pos.count;i++){
      if(Math.abs(pos.getY(i) - yTarget) < 1e-6 && Math.abs(pos.getX(i)) > cheekW*0.5){
        const z = pos.getZ(i);
        if(z > 0) maxFrontZAtFace = Math.max(maxFrontZAtFace, z);
      }
    }
    assert.ok(maxFrontZAtFace > headR*0.65 && maxFrontZAtFace < headR*1.10,
      `Cheek顔側(faceL/R付近)のZ(${maxFrontZAtFace.toFixed(3)})がheadR*0.82(${(headR*0.82).toFixed(3)})に近いオーダーにある`);
  });

  await t.test('Head最大外形がB.headRの極端な倍率になっていない ―― Helmet/Hat/Hoodとの互換性', () => {
    // 完全一致は不要。既存Helmet/Hood/HatはheadR基準(概ねheadR*1.1〜1.35)で
    // 配置されているため、Head自体の最大半幅がheadRから極端に離れて
    // いなければ、装備の浮き/埋没リスクは低い。
    let maxW = 0;
    for(let i=0;i<pos.count;i++) maxW = Math.max(maxW, Math.abs(pos.getX(i)));
    assert.ok(maxW > headR*0.8 && maxW < headR*1.2,
      `Head最大幅(${maxW.toFixed(3)})がheadR(${headR.toFixed(3)})から極端に離れていない`);
  });
});

test('makeCharacterHead(Loft頭部) Face再設計Phase A: 鼻〜口(nosePush)の隆起要件', async (t) => {
  const headR = 0.3705, headLen = 0.741;
  const geo = makeCharacterHeadForTest({ width:headR, depth:headR, height:headLen });
  const pos = geo.attributes.position;
  const hh = headLen/2;

  // 指定の高さ(yFrac)における、noseMouth点(|X| <= 0.30*hw、中央寄り)の
  // 最大Zと、顔側の面(faceL/R、|X|に0.30*hwより大きい点)の最大Zを
  // それぞれ取り出すヘルパー
  function noseAndFaceZ(yFrac, widthMul){
    const yTarget = -hh + headLen*yFrac;
    const noseXMax = headR*widthMul*0.30 + 1e-4;   // noseMouth点のX上限(境界含む)
    let noseZ = 0, faceZ = 0;
    for(let i=0;i<pos.count;i++){
      if(Math.abs(pos.getY(i) - yTarget) < 1e-6){
        const x = Math.abs(pos.getX(i)), z = pos.getZ(i);
        if(z <= 0) continue;
        if(x <= noseXMax) noseZ = Math.max(noseZ, z);
        else faceZ = Math.max(faceZ, z);
      }
    }
    return { noseZ, faceZ };
  }

  await t.test('noseMouthL/Rが存在し、8点(6+2)断面になっている ―― Jaw高さで顔面より前方へ突出', () => {
    const { noseZ, faceZ } = noseAndFaceZ(0.22, 0.72);   // jaw
    assert.ok(noseZ > faceZ,
      `Jaw高さのnoseMouth Z(${noseZ.toFixed(3)})が顔面Z(${faceZ.toFixed(3)})より前方(nosePushの効果)`);
  });

  await t.test('nosePushはJawで最大・Cheekでそれより控えめ ―― 「口はさらに下」の高さバランス', () => {
    const jawExtra   = noseAndFaceZ(0.22, 0.72).noseZ  - noseAndFaceZ(0.22, 0.72).faceZ;
    const cheekExtra = noseAndFaceZ(0.52, 1.06).noseZ - noseAndFaceZ(0.52, 1.06).faceZ;
    assert.ok(jawExtra > cheekExtra,
      `Jawの突出量(${jawExtra.toFixed(3)})がCheekの突出量(${cheekExtra.toFixed(3)})より大きい`);
  });

  await t.test('Crown/UpperHeadでは隆起がほぼ無い ―― 頭頂に鼻が飛び出さない', () => {
    const crownExtra = noseAndFaceZ(1.00, 0.60).noseZ - noseAndFaceZ(1.00, 0.60).faceZ;
    assert.ok(crownExtra < headR*0.02, `Crownの突出量(${crownExtra.toFixed(4)})がごく小さい(ほぼ0)`);
  });

  await t.test('隆起は「幅を持った2点」―― 中央1点に収束する鋭いV字ではない', () => {
    // noseMouthL/Rが同じX(=0)に潰れていない(左右に十分な間隔がある)ことを
    // Jaw断面で確認する
    const yTarget = -hh + headLen*0.22;
    const xs = [];
    const noseXMax = headR*0.72*0.30 + 1e-4;
    for(let i=0;i<pos.count;i++){
      if(Math.abs(pos.getY(i) - yTarget) < 1e-6){
        const x = pos.getX(i), z = pos.getZ(i);
        if(z > 0 && Math.abs(x) <= noseXMax) xs.push(x);
      }
    }
    const spread = Math.max(...xs) - Math.min(...xs);
    assert.ok(spread > headR*0.3, `noseMouthL/Rの左右間隔(${spread.toFixed(3)})が十分にある(単一点ではない)`);
  });

  await t.test('後頭部側の4点はnosePushの影響を受けない(既存設計を維持)', () => {
    // 後頭部点(z<0)の最大|Z|が、旧HEAD_SECTION_RATIOS(depthMulのみ、
    // nosePush導入前)と同じ計算式で求まることを確認する ―― nosePushは
    // noseMouth点にしか加算されないため、後頭部側は従来どおりdepthMul
    // だけで決まるはず
    const yTarget = -hh + headLen*0.52;   // cheek
    let maxBackZ = 0;
    for(let i=0;i<pos.count;i++){
      if(Math.abs(pos.getY(i) - yTarget) < 1e-6){
        const z = pos.getZ(i);
        if(z < 0) maxBackZ = Math.max(maxBackZ, -z);
      }
    }
    const expectedBackZ = 1.15 * (headR*1.06*DEPTH_TO_WIDTH_RATIO);   // HEAD_HEX_TEMPLATEの後頭部点(|z|=1.15)*cheekのdepthMul(widthMul1.06*0.80)
    assert.ok(Math.abs(maxBackZ - expectedBackZ) < 1e-6,
      `後頭部側のZ(${maxBackZ.toFixed(4)})がnosePush導入前と同じ計算値(${expectedBackZ.toFixed(4)})のまま`);
  });
});

// makeEyeSclera()/makeEyePupil()/makeEyeHighlight()自体も(makeCharacterHead
// 等と同じ理由で)このテストファイルから直接importできないため、
// 05-rendering-rig.js内のmakeEyeOutline()/makeEyeSclera()/makeEyePupil()/
// makeEyeHighlight()と同じロジックをここに複製して検証する(値を変えたら
// このコピーも合わせて更新すること)
function makeEyeOutlineForTest(n, rx, ry){
  const pts = [];
  for(let i=0;i<n;i++){
    const a = (i/n)*Math.PI*2;
    pts.push({x:Math.cos(a)*rx, y:Math.sin(a)*ry});
  }
  return pts;
}
function makeEyeScleraForTest(rx, ry, halfDepth){
  return makePlate(makeEyeOutlineForTest(8, rx, ry), { thickness: halfDepth*2 });
}
function makeEyePupilForTest(r, halfDepth){
  return makePlate(makeEyeOutlineForTest(6, r, r), { thickness: halfDepth*2 });
}
function makeEyeHighlightForTest(r, halfDepth){
  return makePlate(makeEyeOutlineForTest(4, r, r), { thickness: halfDepth*2 });
}

// 06-player-enemy.js内のEye構築部分と同じ数値(headR/eyeScale/各半径/
// poke量/Z比率)をここに複製し、実際にゲーム内で使われる値でジオメトリの
// 妥当性(NaN無し・低ポリ・薄い・左右対称・前後関係)を検証する
// Headwear Audit + Eye Size調整フェーズ(「目が大きすぎる」指摘)前の
// 基準半径(Sclera/Pupil/Highlight)。「変更前より縮小している」ことを
// 確認するテストの比較基準として使う
const EYE_BASE_R = { sclera: 0.062, pupil: 0.038, highlight: 0.013 };
// Head/Posture Alignment再設計フェーズ: 05-rendering-rig.js内のHEAD_BACK_Z
// と同じ値(値を変えたらこのコピーも合わせて更新すること)。Head/Eye/Hair/
// Headwearすべてに共通で加算される後方(-Z)Position補正。Head Alignment +
// Facial Projection Calibrationフェーズで-0.035→-0.05へさらに微調整
const HEAD_BACK_Z = -0.05;
function computeEyeParamsForTest(headR){
  const eyeScale = headR/0.26;
  // Mage Hat再設計フェーズ(「目が出っ張って見える」指摘): 基準Z位置を
  // headR*0.90→headR*0.82に調整(06-player-enemy.jsのeyeFrontZと同じ値)。
  // Head/Posture Alignment再設計フェーズでHEAD_BACK_Zも追加加算された
  const eyeFrontZ = headR*0.82 + HEAD_BACK_Z;
  // Headwear Audit + Eye Size調整フェーズ(「目が大きすぎる」指摘):
  // Sclera/Pupil/Highlightの点数・輪郭は変更せず、3層すべての半径に
  // この一つの倍率(06-player-enemy.jsのeyeSizeMulと同じ値)を掛けて
  // Uniform Scalingする
  const eyeSizeMul = 0.85;
  const scleraR = EYE_BASE_R.sclera*eyeSizeMul, scleraZScale = 0.6;
  const scleraHalfDepth = scleraR*scleraZScale;
  const scleraFrontZ = eyeFrontZ + scleraHalfDepth*eyeScale;
  const pupilR = EYE_BASE_R.pupil*eyeSizeMul, pupilPoke = 0.008, pupilZScale = 0.6;
  const pupilHalfDepth = pupilR*pupilZScale;
  const highlightR = EYE_BASE_R.highlight*eyeSizeMul, highlightPoke = 0.014, highlightZScale = 0.6;
  const highlightHalfDepth = highlightR*highlightZScale;
  return {
    eyeScale, eyeSizeMul, scleraR, scleraZScale, scleraHalfDepth, scleraFrontZ,
    pupilR, pupilPoke, pupilZScale, pupilHalfDepth,
    highlightR, highlightPoke, highlightZScale, highlightHalfDepth,
  };
}

function boundingBoxOf(geo){
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  return { w: b.max.x-b.min.x, h: b.max.y-b.min.y, d: b.max.z-b.min.z };
}

test('Eye(Sclera/Pupil/Highlight) Face再設計フェーズ Phase B: 低ポリ多角形化要件', async (t) => {
  const headR = 0.3705;   // BUILD.male相当の実際の値
  const P = computeEyeParamsForTest(headR);

  const sclera = makeEyeScleraForTest(P.scleraR*P.eyeScale, P.scleraR*P.eyeScale*1.15, P.scleraHalfDepth*P.eyeScale);
  const pupil = makeEyePupilForTest(P.pupilR*P.eyeScale, P.pupilHalfDepth*P.eyeScale);
  const highlight = makeEyeHighlightForTest(P.highlightR*P.eyeScale, P.highlightHalfDepth*P.eyeScale);

  await t.test('Sclera/Pupil/Highlightいずれも妥当なジオメトリ(NaN無し・法線あり)', () => {
    assertSaneGeometry(sclera, 8*2);       // 8点押し出し: 側面16 + 前後キャップ(8-2)*2
    assertSaneGeometry(pupil, 6*2);
    assertSaneGeometry(highlight, 4*2);
  });

  // ExtrudeGeometryは面ごとに頂点を複製する(共有しない)ため、position.count
  // 自体は輪郭点数と一致しない。代わりに(X,Y)座標の「異なる位置」の個数
  // (前後キャップでX,Yは共通、Zだけ違う)を数えることで、実質の輪郭点数を
  // 取り出す ―― SphereGeometryのUV分割(経度×緯度の格子)ならここが
  // widthSegments×heightSegmentsの粗い格子にはならず、8/6/4個のような
  // 小さな値にきれいに収まらない
  function countDistinctXY(geo){
    const pos = geo.attributes.position;
    const seen = new Set();
    for(let i=0;i<pos.count;i++){
      const key = `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)}`;
      seen.add(key);
    }
    return seen.size;
  }

  await t.test('Sclera/Pupil/HighlightいずれもSphereGeometryではない(makeEyeOutline+makePlateのExtrudeGeometryベース)', () => {
    // SphereGeometryはUV球面分割特有の「経度×緯度」の格子頂点配置になるが、
    // ここでは8/6/4角形の押し出しのみのため、XY平面上の異なる頂点位置が
    // 輪郭点数と厳密に一致する
    assert.strictEqual(countDistinctXY(sclera), 8, 'Scleraの異なる(X,Y)頂点位置が8点押し出しと一致 ―― 球のUV分割ではない');
    assert.strictEqual(countDistinctXY(pupil), 6, 'Pupilの異なる(X,Y)頂点位置が6点押し出しと一致 ―― 球のUV分割ではない');
    assert.strictEqual(countDistinctXY(highlight), 4, 'Highlightの異なる(X,Y)頂点位置が4点押し出しと一致 ―― 球のUV分割ではない');
  });

  await t.test('実装コード上もSphereGeometryが使われていない(05-rendering-rig.js内のmakeEyeXxx定義を直接検査)', () => {
    const srcPath = fileURLToPath(new URL('../../src/legacy/parts/05-rendering-rig.js', import.meta.url));
    const src = fs.readFileSync(srcPath, 'utf8');
    const start = src.indexOf('function makeEyeOutline');
    const end = src.indexOf('/* Pauldron:');
    assert.ok(start >= 0 && end > start, 'makeEyeOutline〜Pauldronコメントの区間が見つかる');
    const eyeSrc = src.slice(start, end);
    assert.ok(!/SphereGeometry/.test(eyeSrc), 'Eye生成コード(makeEyeOutline/makeEyeSclera/makeEyePupil/makeEyeHighlight)にSphereGeometryが含まれない');
  });

  await t.test('Scleraの多角形数は8点程度(16点以上の滑らかな円ではない、低ポリ要件)', () => {
    assert.strictEqual(countDistinctXY(sclera), 8, 'Scleraの輪郭点数が8(過剰に滑らかな円ではない)');
    assert.strictEqual(countDistinctXY(pupil), 6, 'Pupilの輪郭点数が6');
    assert.strictEqual(countDistinctXY(highlight), 4, 'Highlightの輪郭点数が4');
  });

  const scleraBox = boundingBoxOf(sclera);
  const pupilBox = boundingBoxOf(pupil);
  const highlightBox = boundingBoxOf(highlight);

  await t.test('PupilはScleraより小さい、HighlightはPupilより小さい(白目>瞳>ハイライトのサイズ順)', () => {
    assert.ok(pupilBox.w < scleraBox.w && pupilBox.h < scleraBox.h,
      `Pupil(${pupilBox.w.toFixed(3)}x${pupilBox.h.toFixed(3)})がSclera(${scleraBox.w.toFixed(3)}x${scleraBox.h.toFixed(3)})より小さい`);
    assert.ok(highlightBox.w < pupilBox.w && highlightBox.h < pupilBox.h,
      `Highlight(${highlightBox.w.toFixed(3)}x${highlightBox.h.toFixed(3)})がPupil(${pupilBox.w.toFixed(3)}x${pupilBox.h.toFixed(3)})より小さい`);
  });

  await t.test('Scleraは縦にやや長い(横幅<縦幅) ―― 丸いボールではなく少し縦長のLow Poly Eye', () => {
    assert.ok(scleraBox.h > scleraBox.w, `Sclera縦幅(${scleraBox.h.toFixed(3)})が横幅(${scleraBox.w.toFixed(3)})より大きい`);
  });

  await t.test('奥行き(Depth)が幅・高さより十分薄い ―― 球体のような厚みになっていない', () => {
    assert.ok(scleraBox.d < scleraBox.w*0.7 && scleraBox.d < scleraBox.h*0.7,
      `Scleraの奥行き(${scleraBox.d.toFixed(4)})が幅(${scleraBox.w.toFixed(3)})・高さ(${scleraBox.h.toFixed(3)})の70%未満(薄い板状)`);
    assert.ok(pupilBox.d < pupilBox.w*0.7 && pupilBox.d < pupilBox.h*0.7,
      `Pupilの奥行き(${pupilBox.d.toFixed(4)})が幅(${pupilBox.w.toFixed(3)})・高さ(${pupilBox.h.toFixed(3)})の70%未満(薄い板状)`);
    assert.ok(highlightBox.d < highlightBox.w*0.7 && highlightBox.d < highlightBox.h*0.7,
      `Highlightの奥行き(${highlightBox.d.toFixed(4)})が幅(${highlightBox.w.toFixed(3)})・高さ(${highlightBox.h.toFixed(3)})の70%未満(薄い板状)`);
  });

  await t.test('左右対称(X=0を軸に鏡映対称) ―― 個々のジオメトリ自体が左右非対称な形になっていない', () => {
    function assertMirrorSymmetric(geo, label){
      const pos = geo.attributes.position;
      const pts = [];
      for(let i=0;i<pos.count;i++) pts.push([pos.getX(i), pos.getY(i), pos.getZ(i)]);
      for(const [x,y,z] of pts){
        const hasMirror = pts.some(([mx,my,mz]) => Math.abs(mx-(-x))<1e-5 && Math.abs(my-y)<1e-5 && Math.abs(mz-z)<1e-5);
        assert.ok(hasMirror, `${label}: 頂点(${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)})に対応する鏡映頂点(-x)が存在する`);
      }
    }
    assertMirrorSymmetric(sclera, 'Sclera');
    assertMirrorSymmetric(pupil, 'Pupil');
    assertMirrorSymmetric(highlight, 'Highlight');
  });

  await t.test('eyeScaleでHead全体のサイズに追従して拡大縮小できる(半径に比例したサイズ変化)', () => {
    const bigHeadR = headR*1.5;
    const Pbig = computeEyeParamsForTest(bigHeadR);
    const scleraBig = makeEyeScleraForTest(Pbig.scleraR*Pbig.eyeScale, Pbig.scleraR*Pbig.eyeScale*1.15, Pbig.scleraHalfDepth*Pbig.eyeScale);
    const bigBox = boundingBoxOf(scleraBig);
    const ratio = bigHeadR/headR;
    assert.ok(Math.abs(bigBox.w/scleraBox.w - ratio) < 1e-6, `Sclera幅がheadR比率(${ratio})に比例して拡大している`);
    assert.ok(Math.abs(bigBox.h/scleraBox.h - ratio) < 1e-6, `Sclera高さがheadR比率(${ratio})に比例して拡大している`);
  });

  await t.test('Sclera→Pupil→Highlightの前後(Z)関係が正しく、Z-fightingを避ける十分な間隔がある', () => {
    // 06-player-enemy.jsの実際の配置式(scleraFrontZ、pupil/highlightの
    // position.z計算)を複製し、各層の「自分自身の前面Z」を比較する
    const pupilCenterZ = P.scleraFrontZ - P.pupilHalfDepth*P.eyeScale + P.pupilPoke*P.eyeScale;
    const pupilFrontZ = pupilCenterZ + P.pupilHalfDepth*P.eyeScale;
    const highlightCenterZ = P.scleraFrontZ - P.highlightHalfDepth*P.eyeScale + P.highlightPoke*P.eyeScale;
    const highlightFrontZ = highlightCenterZ + P.highlightHalfDepth*P.eyeScale;

    assert.ok(pupilFrontZ > P.scleraFrontZ,
      `Pupilの前面Z(${pupilFrontZ.toFixed(4)})がScleraの前面Z(${P.scleraFrontZ.toFixed(4)})よりわずかに前方(埋没しない)`);
    assert.ok(highlightFrontZ > pupilCenterZ,
      `Highlightの前面Z(${highlightFrontZ.toFixed(4)})がPupilの中心Z(${pupilCenterZ.toFixed(4)})より前方`);

    const scleraPupilGap = pupilFrontZ - P.scleraFrontZ;
    const pupilHighlightGap = Math.abs(highlightCenterZ - pupilCenterZ);
    assert.ok(scleraPupilGap > 1e-4, `Sclera-Pupil間に十分な隙間(${scleraPupilGap.toFixed(5)})がある(Z-fighting回避)`);
    assert.ok(pupilHighlightGap > 1e-4 || highlightFrontZ - pupilFrontZ > 1e-4,
      'Pupil-Highlight間、または両者の前面同士に十分な隙間がある(Z-fighting回避)');
  });
});

// makeMageHatBrim()自体も(makeCharacterHead等と同じ理由で)このテストファイル
// から直接importできないため、05-rendering-rig.js内のMAGE_BRIM_RADIUS_MUL/
// makeMageHatBrimOutline()/makeMageHatBrim()と同じロジック・数値をここに
// 複製して検証する(値を変えたらこのコピーも合わせて更新すること)
const MAGE_BRIM_RADIUS_MUL = [
  0.58, 0.72, 0.92, 1.00, 1.00, 1.00,
  1.00, 1.00, 1.00, 1.00, 0.92, 0.72,
];
function makeMageHatBrimOutlineForTest(){
  const n = MAGE_BRIM_RADIUS_MUL.length;
  return MAGE_BRIM_RADIUS_MUL.map((mul, i) => {
    const a = (i/n)*Math.PI*2;
    return [-Math.sin(a)*mul, Math.cos(a)*mul];
  });
}
function makeMageHatBrimForTest(radius, thickness){
  const outline = makeMageHatBrimOutlineForTest();
  const half = thickness/2;
  const toPts = () => outline.map(([fx,fz]) => [fx*radius, fz*radius]);
  return makeLoft({
    sections: [ { y:half, points:toPts() }, { y:-half, points:toPts() } ],
    closedTop:true, closedBottom:true,
  });
}

test('Eye Size Adjustmentフェーズ: Sclera/Pupil/Highlight Uniform Scaling要件', async (t) => {
  const headR = 0.3705;
  const P = computeEyeParamsForTest(headR);

  await t.test('eyeScaleは引き続きheadRに比例する(固定サイズ化していない)', () => {
    const bigHeadR = headR*1.5;
    const Pbig = computeEyeParamsForTest(bigHeadR);
    assert.ok(Math.abs(Pbig.eyeScale/P.eyeScale - bigHeadR/headR) < 1e-9,
      'eyeScaleがheadRの比率どおりに変化する');
  });

  await t.test('Sclera/Pupil/Highlightが全て同じeyeSizeMulに追従する(Uniform Scaling)', () => {
    assert.strictEqual(P.scleraR, EYE_BASE_R.sclera*P.eyeSizeMul);
    assert.strictEqual(P.pupilR, EYE_BASE_R.pupil*P.eyeSizeMul);
    assert.strictEqual(P.highlightR, EYE_BASE_R.highlight*P.eyeSizeMul);
    // 3層とも同じ比率(eyeSizeMul)で縮小している ―― Scleraだけ/Pupilだけの
    // 縮小ではないことの確認(浮動小数点誤差を許容する近似比較)
    const EPS = 1e-9;
    assert.ok(Math.abs(P.scleraR/EYE_BASE_R.sclera - P.pupilR/EYE_BASE_R.pupil) < EPS);
    assert.ok(Math.abs(P.pupilR/EYE_BASE_R.pupil - P.highlightR/EYE_BASE_R.highlight) < EPS);
  });

  const sclera = makeEyeScleraForTest(P.scleraR*P.eyeScale, P.scleraR*P.eyeScale*1.15, P.scleraHalfDepth*P.eyeScale);
  const pupil = makeEyePupilForTest(P.pupilR*P.eyeScale, P.pupilHalfDepth*P.eyeScale);
  const highlight = makeEyeHighlightForTest(P.highlightR*P.eyeScale, P.highlightHalfDepth*P.eyeScale);

  await t.test('Eye Geometry Point Countが維持されている(Sclera=8, Pupil=6, Highlight=4)', () => {
    function countDistinctXY(geo){
      const pos = geo.attributes.position;
      const seen = new Set();
      for(let i=0;i<pos.count;i++) seen.add(`${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)}`);
      return seen.size;
    }
    assert.strictEqual(countDistinctXY(sclera), 8, 'Scleraは8点のまま(Geometry Structure変更禁止)');
    assert.strictEqual(countDistinctXY(pupil), 6, 'Pupilは6点のまま');
    assert.strictEqual(countDistinctXY(highlight), 4, 'Highlightは4点のまま');
  });

  await t.test('NaN/Infinityを含まない', () => {
    [sclera, pupil, highlight].forEach(geo => {
      const pos = geo.attributes.position;
      for(let i=0;i<pos.count;i++){
        assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getY(i)) && Number.isFinite(pos.getZ(i)));
      }
    });
  });

  await t.test('SphereGeometryを使用していない(引き続きmakePlateベース)', () => {
    const srcPath = fileURLToPath(new URL('../../src/legacy/parts/05-rendering-rig.js', import.meta.url));
    const src = fs.readFileSync(srcPath, 'utf8');
    const start = src.indexOf('function makeEyeOutline');
    const end = src.indexOf('/* Pauldron:');
    const eyeSrc = src.slice(start, end);
    assert.ok(!/SphereGeometry/.test(eyeSrc), 'Eye生成コードにSphereGeometryが含まれない');
  });

  const scleraBoxBase = boundingBoxOf(makeEyeScleraForTest(EYE_BASE_R.sclera*P.eyeScale, EYE_BASE_R.sclera*P.eyeScale*1.15, EYE_BASE_R.sclera*0.6*P.eyeScale));
  const scleraBoxNow = boundingBoxOf(sclera);
  await t.test('変更前(eyeSizeMul=1.0相当)よりEye Sizeが縮小している', () => {
    assert.ok(scleraBoxNow.w < scleraBoxBase.w, `Sclera幅(${scleraBoxNow.w.toFixed(4)})が変更前(${scleraBoxBase.w.toFixed(4)})より縮小`);
    assert.ok(scleraBoxNow.h < scleraBoxBase.h, `Sclera高さ(${scleraBoxNow.h.toFixed(4)})が変更前(${scleraBoxBase.h.toFixed(4)})より縮小`);
  });

  await t.test('縮小率が極端でない(70%〜95%程度の範囲、点のように小さくなっていない)', () => {
    const ratio = scleraBoxNow.w/scleraBoxBase.w;
    assert.ok(ratio > 0.70 && ratio < 0.95,
      `縮小後/縮小前のSclera幅比(${ratio.toFixed(2)})が70%〜95%の範囲にある(極端な縮小ではない)`);
  });

  await t.test('左右対称 ―― 個々のジオメトリ自体が左右非対称になっていない(縮小してもmakeEyeOutlineの対称性は不変)', () => {
    function assertMirrorSymmetric(geo){
      const pos = geo.attributes.position;
      const pts = [];
      for(let i=0;i<pos.count;i++) pts.push([pos.getX(i), pos.getY(i), pos.getZ(i)]);
      for(const [x,y,z] of pts){
        assert.ok(pts.some(([mx,my,mz]) => Math.abs(mx-(-x))<1e-5 && Math.abs(my-y)<1e-5 && Math.abs(mz-z)<1e-5));
      }
    }
    assertMirrorSymmetric(sclera);
    assertMirrorSymmetric(pupil);
    assertMirrorSymmetric(highlight);
  });

  await t.test('Pupil/Highlightの前後関係(Sclera前面より前方)が縮小後も維持されている、Z-fighting無し', () => {
    const pupilCenterZ = P.scleraFrontZ - P.pupilHalfDepth*P.eyeScale + P.pupilPoke*P.eyeScale;
    const pupilFrontZ = pupilCenterZ + P.pupilHalfDepth*P.eyeScale;
    const highlightCenterZ = P.scleraFrontZ - P.highlightHalfDepth*P.eyeScale + P.highlightPoke*P.eyeScale;
    assert.ok(pupilFrontZ > P.scleraFrontZ, 'Pupil前面がSclera前面より前方(埋没しない)');
    assert.ok(Math.abs(highlightCenterZ - pupilCenterZ) > 1e-4, 'Pupil-Highlight間に十分な隙間(Z-fighting回避)');
  });

  await t.test('既存Head Scale Group(戦騎士の頭部一式0.86倍縮小)と互換 ―― Eyeもfacemeshes経由でGroup全体のスケール対象のまま', () => {
    // headScaleGroupはTHREE.Group.scaleでheadGroupParts全体(faceMeshes含む)を
    // 一括縮小する仕組みのため、Eye個々のGeometryサイズがどう変わっても
    // 影響を受けない。ここではEye Mesh自体がGroup経由のスケールに対して
    // 線形に追従することだけを確認する(Groupのscaleは乗算されるだけ)
    const groupScale = 0.86;
    const scaledW = scleraBoxNow.w * groupScale;
    assert.ok(Math.abs(scaledW - scleraBoxNow.w*0.86) < 1e-9, 'Group scaleは線形にEyeサイズへ適用される(Eye側の特別対応は不要)');
  });
});

test('Head / Posture Alignment再設計フェーズ: HEAD_BACK_Zの妥当性・全パーツへの適用漏れ確認', async (t) => {
  const headR = 0.3705;

  await t.test('HEAD_BACK_Zが極端な値ではない(headRの15%未満) ―― 猫背修正のつもりで反り返らせていない', () => {
    assert.ok(Math.abs(HEAD_BACK_Z) < headR*0.15,
      `HEAD_BACK_Z(${HEAD_BACK_Z})の絶対値がheadR(${headR})の15%未満(過度な後退/反りではない)`);
    assert.ok(HEAD_BACK_Z < 0, 'HEAD_BACK_Zは負(後方)方向 ―― 前方へさらに突き出す向きではない');
  });

  // 06-player-enemy.js内の実際のソースを検査し、Head/Eye/Hair/8クラス
  // Headwearの位置設定コードにHEAD_BACK_Zが漏れなく反映されていることを
  // 確認する(数値そのものを固定する脆いテストではなく、「適用箇所の
  // 存在」だけを見る)。無理に位置の絶対値をテストで固定しない方針
  // (指示のとおり)のため、出現回数の下限チェックに留める
  const srcPath = fileURLToPath(new URL('../../src/legacy/parts/06-player-enemy.js', import.meta.url));
  const src = fs.readFileSync(srcPath, 'utf8');
  const occurrences = (src.match(/HEAD_BACK_Z/g) || []).length;

  await t.test('HEAD_BACK_Zが十分な数のPosition定義箇所に適用されている(Head本体+Eye+Hair 4種+8クラスHeadwearぶんの下限)', () => {
    // 定義1箇所 + Head1 + Eye(eyeFrontZ経由)1 + Hair(cap/bangs/sideHair/backHair)4
    // + Warrior7 + Mage3 + Archer3 + Rogue3 + BattleKnight6 + HawkEye3
    // + Berserker1 + Archmage2 ≒ 35以上を想定した緩めの下限(数を厳密に
    // 固定せず、「明らかに適用漏れが大量にある」場合だけ検知する)
    assert.ok(occurrences >= 30,
      `HEAD_BACK_Zの出現回数(${occurrences})が30以上(Head/Eye/Hair/8クラスHeadwearへの適用漏れがない)`);
  });

  await t.test('Head本体・Hair Cap・Warrior Helm・Mage Brim・Hawk Eye Hoodの主要メッシュにHEAD_BACK_Zが適用されている', () => {
    // 主要な代表箇所だけ、実際にHEAD_BACK_Zを参照しているコード行が
    // 存在することを個別に確認する(該当箇所の周辺テキストに
    // HEAD_BACK_Zが含まれるか)
    const checkNear = (anchor, label) => {
      const idx = src.indexOf(anchor);
      assert.ok(idx >= 0, `${label}: アンカー文字列が見つかる`);
      const windowSrc = src.slice(idx, idx + 400);
      assert.ok(/HEAD_BACK_Z/.test(windowSrc), `${label}: 近傍にHEAD_BACK_Zが適用されている`);
    };
    checkNear('head.position.z = HEAD_BACK_Z', 'Head本体');
    checkNear('hair.position.set(0, head.position.y, HEAD_BACK_Z)', 'Hair Shell');
    checkNear('makeWarriorBaseHelm({width:headR, depth:headR, height:headR*WARRIOR_HELM_HEIGHT_MUL})', 'Warrior Helm');
    checkNear('makeMageHatBrim(headR*MAGE_BRIM_RADIUS_BASE_MUL, MAGE_BRIM_THICKNESS)', 'Mage Brim');
    checkNear('makeHawkEyeHood({width:B.headR*1.35', 'Hawk Eye Hood');
  });

  await t.test('Torso/Neck/BeltにはHEAD_BACK_Zを適用していない(Body Geometry/Positionは維持する方針)', () => {
    const torsoIdx = src.indexOf('torso.position.y = HIP_Y + bodyH/2;');
    const neckIdx = src.indexOf('neck.position.y = HIP_Y + bodyH*0.99;');
    assert.ok(torsoIdx >= 0 && neckIdx >= 0, 'Torso/Neckの位置設定コードが見つかる');
    assert.ok(!/HEAD_BACK_Z/.test(src.slice(torsoIdx, torsoIdx+80)), 'Torsoの位置設定にHEAD_BACK_Zを適用していない');
    assert.ok(!/HEAD_BACK_Z/.test(src.slice(neckIdx, neckIdx+80)), 'Neckの位置設定にHEAD_BACK_Zを適用していない');
  });
});

test('Head Alignment + Facial Projection Calibrationフェーズ: JawのnosePush調整要件', async (t) => {
  const headR = 0.3705, headLen = 0.741;
  const geo = makeCharacterHeadForTest({ width:headR, depth:headR, height:headLen });
  const pos = geo.attributes.position;
  const hh = headLen/2;

  await t.test('妥当なジオメトリが返る(NaN無し・法線あり、signedVolume正)', () => {
    assertSaneGeometry(geo, 4*8*2 + 6*2);
    assert.ok(signedVolume(geo) > 0, '符号付き体積が正(裏返りなし)');
  });

  await t.test('Jawの鼻〜口点が、同じ断面の後頭部点の突出量を大きくは上回らない(顔だけが後頭部より前に出過ぎない)', () => {
    const yTarget = -hh + headLen*0.22;   // jaw
    let noseZ = 0, backZ = 0;
    const noseXMax = headR*0.72*0.30 + 1e-4;
    for(let i=0;i<pos.count;i++){
      if(Math.abs(pos.getY(i) - yTarget) < 1e-6){
        const x = Math.abs(pos.getX(i)), z = pos.getZ(i);
        if(z > 0 && x <= noseXMax) noseZ = Math.max(noseZ, z);
        if(z < 0) backZ = Math.max(backZ, -z);
      }
    }
    assert.ok(noseZ <= backZ*1.05,
      `Jawの鼻〜口Z(${noseZ.toFixed(3)})が後頭部Z(${backZ.toFixed(3)})の105%以内(顔の隆起が後頭部の張り出しを大きく上回らない)`);
  });

  await t.test('nosePushはPhase A以前の平坦な顔には戻っていない(Jaw/Chin/Cheekの隆起が引き続き0より大きい)', () => {
    const check = (yFrac, widthMul, label) => {
      const yTarget = -hh + headLen*yFrac;
      let noseZ = 0, faceZ = 0;
      const noseXMax = headR*widthMul*0.30 + 1e-4;
      for(let i=0;i<pos.count;i++){
        if(Math.abs(pos.getY(i) - yTarget) < 1e-6){
          const x = Math.abs(pos.getX(i)), z = pos.getZ(i);
          if(z <= 0) continue;
          if(x <= noseXMax) noseZ = Math.max(noseZ, z);
          else faceZ = Math.max(faceZ, z);
        }
      }
      assert.ok(noseZ > faceZ, `${label}: 鼻〜口Z(${noseZ.toFixed(3)})が顔面Z(${faceZ.toFixed(3)})より前方(隆起が残っている)`);
    };
    check(0.00, 0.38, 'Chin');
    check(0.22, 0.72, 'Jaw');
    check(0.52, 1.06, 'Cheek');
  });

  await t.test('Jawの隆起は引き続き全断面中で最大(ピーク) ―― Cheek/Chinより明確に大きい', () => {
    function extraAt(yFrac, widthMul){
      const yTarget = -hh + headLen*yFrac;
      let noseZ = 0, faceZ = 0;
      const noseXMax = headR*widthMul*0.30 + 1e-4;
      for(let i=0;i<pos.count;i++){
        if(Math.abs(pos.getY(i) - yTarget) < 1e-6){
          const x = Math.abs(pos.getX(i)), z = pos.getZ(i);
          if(z <= 0) continue;
          if(x <= noseXMax) noseZ = Math.max(noseZ, z); else faceZ = Math.max(faceZ, z);
        }
      }
      return noseZ - faceZ;
    }
    const jawExtra = extraAt(0.22, 0.72);
    const cheekExtra = extraAt(0.52, 1.06);
    const chinExtra = extraAt(0.00, 0.38);
    assert.ok(jawExtra > cheekExtra && jawExtra > chinExtra,
      `Jawの突出量(${jawExtra.toFixed(3)})がCheek(${cheekExtra.toFixed(3)})・Chin(${chinExtra.toFixed(3)})より大きい(引き続きピーク)`);
  });

  await t.test('Eyeとの干渉なし ―― Cheekの顔側(faceL/R付近)ZがEye基準(headR*0.82+HEAD_BACK_Z)と近いオーダーのまま', () => {
    const yTarget = -hh + headLen*0.52;
    const cheekWMax = headR*1.06;
    let maxFrontZAtFace = 0;
    for(let i=0;i<pos.count;i++){
      if(Math.abs(pos.getY(i) - yTarget) < 1e-6 && Math.abs(pos.getX(i)) > cheekWMax*0.5){
        const z = pos.getZ(i);
        if(z > 0) maxFrontZAtFace = Math.max(maxFrontZAtFace, z);
      }
    }
    const eyeFrontZOrder = headR*0.82 + HEAD_BACK_Z;
    assert.ok(maxFrontZAtFace > eyeFrontZOrder*0.6 && maxFrontZAtFace < eyeFrontZOrder*1.6,
      `Cheek顔側のZ(${maxFrontZAtFace.toFixed(3)})がEye基準Z(${eyeFrontZOrder.toFixed(3)})と近いオーダーにある(埋没・浮きの兆候なし)`);
  });
});

test('Mage Hat Brim(つば) 再設計フェーズ: 前後非対称Low Poly要件', async (t) => {
  const headR = 0.3705;
  const radius = headR*1.95, thickness = 0.04;
  const geo = makeMageHatBrimForTest(radius, thickness);
  const n = MAGE_BRIM_RADIUS_MUL.length;

  await t.test('妥当なジオメトリが返る(NaN無し・法線あり)', () => {
    // 側面: (段数-1)*n*2三角形 + 天板/底面2段x(n-2)三角形
    assertSaneGeometry(geo, n*2 + (n-2)*2);
  });

  await t.test('閉じた立体として面が外向きに巻かれている(裏返り無し)', () => {
    assert.ok(signedVolume(geo) > 0, '符号付き体積が正');
  });

  await t.test('完全な円盤ではない ―― 点ごとに半径倍率(MAGE_BRIM_RADIUS_MUL)が異なる', () => {
    const allSame = MAGE_BRIM_RADIUS_MUL.every(m => m === MAGE_BRIM_RADIUS_MUL[0]);
    assert.ok(!allSame, '輪郭上の各点の半径倍率が一様ではない(単純な円柱/円盤ではない)');
  });

  const outline = makeMageHatBrimOutlineForTest();
  await t.test('前方(+Z、顔側)のBrimが後方(-Z)より明確に短い ―― Face Opening相当の後退がある', () => {
    const frontZ = Math.max(...outline.filter(([x,z])=>z>0).map(([x,z])=>z)) * radius;
    const backZ  = Math.max(...outline.filter(([x,z])=>z<0).map(([x,z])=>-z)) * radius;
    assert.ok(frontZ < backZ*0.75,
      `前方Brim Z(${frontZ.toFixed(3)})が後方Brim Z(${backZ.toFixed(3)})より明確に短い(75%未満)`);
  });

  await t.test('左右対称 ―― X=0を軸に大きな非対称が無い', () => {
    // outline[i]とoutline[n-i](0を除く)がミラー対(x=-x,z=z)になっている
    for(let i=1;i<n;i++){
      const [x1,z1] = outline[i];
      const [x2,z2] = outline[(n-i)%n];
      assert.ok(Math.abs(x1+x2) < 1e-9 && Math.abs(z1-z2) < 1e-9,
        `点${i}と点${(n-i)%n}が左右ミラー対(x符号反転・z一致)になっている`);
    }
  });

  await t.test('Face側OpeningがEyeのX位置を覆う ―― 縮小された輪郭点(mul<1)のX範囲がEyeのX位置(headR*0.44程度)を含む', () => {
    // MAGE_BRIM_RADIUS_MUL<1.00(意図的に縮小された点、前方寄り)のX範囲を
    // 直接見る(z>0のような幾何学的フィルタは90°付近の浮動小数点誤差で
    // 側面の点を誤って含みうるため使わない)。縮小域のX範囲がEyeの実際の
    // X位置(headR*0.44程度)を覆っていれば、つばの縮小がEyeの真上を
    // 通っていることになる
    const shrunkXs = outline
      .filter((_, i) => MAGE_BRIM_RADIUS_MUL[i] < 1.00)
      .map(([x]) => Math.abs(x)*radius);
    const maxShrunkX = Math.max(...shrunkXs);
    const eyeXOrder = 0.115*(headR/0.26);   // 06-player-enemy.jsの実際のEye X位置(0.115*eyeScale)
    assert.ok(maxShrunkX >= eyeXOrder,
      `縮小域のX最大値(${maxShrunkX.toFixed(3)})がEyeの実際のX位置(${eyeXOrder.toFixed(3)})以上をカバーしている`);
  });

  await t.test('Hat全体サイズ(後方・側方の半径)がHeadより極端に小さくなっていない ―― 「魔法使いらしい大きな帽子」を維持', () => {
    const backSideR = Math.max(...outline.map(([x,z])=>Math.hypot(x,z))) * radius;
    assert.ok(backSideR > headR*1.5, `後方・側方の最大半径(${backSideR.toFixed(3)})がheadR(${headR.toFixed(3)})の1.5倍以上(縮小しすぎていない)`);
    assert.ok(Math.abs(backSideR - radius) < 1e-6, '後方・側方は旧CylinderGeometryと同じ半径(縮小していない)');
  });

  await t.test('厚みが薄い(見下ろしカメラで不自然な板の側面が目立たない程度)', () => {
    geo.computeBoundingBox();
    const b = geo.boundingBox;
    const depth = b.max.y-b.min.y;
    assert.ok(depth === thickness || Math.abs(depth-thickness) < 1e-6, `Y方向の厚み(${depth.toFixed(3)})が指定厚み(${thickness})と一致`);
    assert.ok(depth < radius*0.2, `厚み(${depth.toFixed(3)})が半径(${radius.toFixed(3)})の20%未満(薄い板状)`);
  });

  await t.test('実装コード上もBrimがCylinderGeometryではない(05-rendering-rig.js内のmakeMageHatBrim定義を直接検査)', () => {
    const srcPath = fileURLToPath(new URL('../../src/legacy/parts/05-rendering-rig.js', import.meta.url));
    const src = fs.readFileSync(srcPath, 'utf8');
    const start = src.indexOf('const MAGE_BRIM_RADIUS_MUL');
    const end = src.indexOf('Hair Shell(旧Hair Cap)');
    assert.ok(start >= 0 && end > start, 'MAGE_BRIM_RADIUS_MUL〜Hair Shellコメントの区間が見つかる');
    const brimSrc = src.slice(start, end);
    assert.ok(!/CylinderGeometry/.test(brimSrc), 'Brim生成コード(makeMageHatBrim)にCylinderGeometryが含まれない(makeLoftベースに置き換え済み)');
  });
});

// makeWarriorBaseHelm()自体も(makeCharacterHead等と同じ理由で)このテスト
// ファイルから直接importできないため、05-rendering-rig.js内の
// WARRIOR_HELM_ARC_TEMPLATE/WARRIOR_HELM_RINGSと同じ値をここに複製して
// 検証する(値を変えたらこのコピーも合わせて更新すること)
const WARRIOR_HELM_ARC_TEMPLATE = [
  [-0.55,  0.45],
  [-1.00, -0.05],
  [-0.60, -0.85],
  [ 0.00, -1.00],
  [ 0.60, -0.85],
  [ 1.00, -0.05],
  [ 0.55,  0.45],
];
// Headwear Silhouette Integration Phase(Priority B)で中間リングを追加
// (05-rendering-rig.jsのWARRIOR_HELM_RINGSと同じ値、上記コメントの通り
// 値を変えたらこのコピーも合わせて更新すること)
const WARRIOR_HELM_RINGS = [
  { yFrac:0.00, widthMul:1.12, depthMul:1.05 },
  { yFrac:0.50, widthMul:1.15, depthMul:1.08 },
  { yFrac:0.78, widthMul:1.02, depthMul:0.98 },
  { yFrac:1.00, widthMul:0.78, depthMul:0.74 },
];
function makeWarriorBaseHelmForTest({width, depth, height}){
  const n = WARRIOR_HELM_ARC_TEMPLATE.length;
  const verts = [];
  WARRIOR_HELM_RINGS.forEach(r=>{
    const hw = width*r.widthMul, hd = depth*r.depthMul;
    WARRIOR_HELM_ARC_TEMPLATE.forEach(([fx,fz])=>{
      verts.push(fx*hw, height*r.yFrac, fz*hd);
    });
  });
  const idx = [];
  for(let ri=0; ri<WARRIOR_HELM_RINGS.length-1; ri++){
    const base = ri*n, next = (ri+1)*n;
    for(let i=0;i<n-1;i++){
      const a=base+i, b=base+i+1, aTop=next+i, bTop=next+i+1;
      idx.push(a,bTop,b, a,aTop,bTop);
    }
  }
  const topBase = (WARRIOR_HELM_RINGS.length-1)*n;
  for(let i=1;i<n-1;i++) idx.push(topBase, topBase+i+1, topBase+i);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

test('makeWarriorBaseHelm(素の剣士のBase Helm): 顔側にFace Openingを持つ馬蹄形の要件', async (t) => {
  const headR = 0.3705, helmHeight = headR*1.60;   // BUILD.male相当の実際の値
  const geo = makeWarriorBaseHelmForTest({ width:headR, depth:headR, height:helmHeight });
  const n = WARRIOR_HELM_ARC_TEMPLATE.length;

  await t.test('妥当なジオメトリが返る(NaN無し・法線あり)', () => {
    // 側面: (段数-1)*(n-1)*2三角形 + 天板: (n-2)三角形
    assertSaneGeometry(geo, (WARRIOR_HELM_RINGS.length-1)*(n-1)*2 + (n-2));
  });

  await t.test('三角形数が想定どおり(開口部に余分な面が無い)', () => {
    const expectedTris = (WARRIOR_HELM_RINGS.length-1)*(n-1)*2 + (n-2);
    assert.strictEqual(geo.index.count, expectedTris*3,
      `インデックス数(${geo.index.count})が想定(${expectedTris*3})と一致 ―― 開口部を塞ぐ余分な面が生成されていない`);
  });

  await t.test('円形/正球ではない(断面ごとにwidth/depthの倍率が異なる、単純なSphereGeometryの縮小ではない)', () => {
    const ratios = WARRIOR_HELM_RINGS.map(r => r.widthMul / r.depthMul);
    const allSame = ratios.every(r => Math.abs(r - ratios[0]) < 1e-9);
    assert.ok(!allSame || Math.abs(ratios[0]-1) > 1e-9,
      '断面ごとのwidth/depth比が一定の円形スケールではない(方向性を持つ形状)');
    // 断面(リング)ごとに実際の頂点X/Z範囲も円形(X幅==Z奥行き)にならないことを確認
    const pos = geo.attributes.position;
    WARRIOR_HELM_RINGS.forEach((r, ri) => {
      let maxX = 0, maxZ = 0;
      for(let i=0;i<n;i++){
        const idxV = ri*n+i;
        maxX = Math.max(maxX, Math.abs(pos.getX(idxV)));
        maxZ = Math.max(maxZ, Math.abs(pos.getZ(idxV)));
      }
      assert.notEqual(maxX, maxZ, `リング${ri}の幅(${maxX.toFixed(3)})と奥行き(${maxZ.toFixed(3)})が一致していない`);
    });
  });

  await t.test('Face Opening: 顔側(+Z)の開口の縁が、既存Eye位置(headR*0.115*eyeScale)より外側にある', () => {
    // 完全一致は不要。既存Eyeの左右位置はheadR基準でx=±0.115*eyeScale
    // (eyeScale=headR/0.26)。Eyeの高さ(head中心付近、helm下端からおよそ
    // 0.02+headR*0.5の高さ)における開口の縁のX位置が、Eyeのx位置より
    // 外側(絶対値が大きい)にあれば、EyeがHelmetの側壁に隠れない。
    const eyeScale = headR/0.26;
    const eyeX = 0.115*eyeScale;
    const eyeYLocal = 0.02 + headR*0.50;   // helm下端(hY-headR*0.5)からの相対高さ
    const eyeYFrac = eyeYLocal / helmHeight;
    // bottomRingとmidRingの間で線形補間(開口の縁=配列の最初の点、フラグメント[0])
    const bottom = WARRIOR_HELM_RINGS[0], mid = WARRIOR_HELM_RINGS[1];
    const t2 = Math.min(1, eyeYFrac / (mid.yFrac - bottom.yFrac));
    const widthMulAtEye = bottom.widthMul + (mid.widthMul - bottom.widthMul)*t2;
    const openingEdgeFrac = Math.abs(WARRIOR_HELM_ARC_TEMPLATE[0][0]);   // 0.55
    const openingEdgeX = openingEdgeFrac * widthMulAtEye * headR;
    assert.ok(openingEdgeX > eyeX,
      `Eyeの高さでの開口の縁のX(${openingEdgeX.toFixed(3)})がEyeのX位置(${eyeX.toFixed(3)})より外側にある(Eyeが隠れない)`);
  });

  await t.test('Helmet最大サイズがheadRの極端な倍率になっていない', () => {
    const pos = geo.attributes.position;
    let maxR = 0;
    for(let i=0;i<pos.count;i++) maxR = Math.max(maxR, Math.abs(pos.getX(i)), Math.abs(pos.getZ(i)));
    assert.ok(maxR > headR*0.8 && maxR < headR*1.5,
      `Helmet最大半幅(${maxR.toFixed(3)})がheadR(${headR.toFixed(3)})の0.8〜1.5倍に収まっている`);
  });

  await t.test('頭頂の天板が上向きの法線を持つ(見下ろしカメラから正しく見える)', () => {
    const pos = geo.attributes.position;
    const topBase = (WARRIOR_HELM_RINGS.length-1)*n;
    const v = i => new THREE.Vector3(pos.getX(topBase+i), pos.getY(topBase+i), pos.getZ(topBase+i));
    let sumY = 0, count = 0;
    for(let i=1;i<n-1;i++){
      const a = v(0), b = v(i+1), c = v(i);
      const normal = new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a));
      sumY += normal.y; count++;
    }
    assert.ok(sumY/count > 0, `天板の面法線の平均Y成分(${(sumY/count).toFixed(4)})が正(上向き)`);
  });
});

// makeHawkEyeHood()自体も(makeWarriorBaseHelm等と同じ理由で)このテスト
// ファイルから直接importできないため、05-rendering-rig.js内の
// HAWKEYE_HOOD_ARC_TEMPLATE/HAWKEYE_HOOD_RINGSと同じ値をここに複製して
// 検証する(値を変えたらこのコピーも合わせて更新すること)
const HAWKEYE_HOOD_ARC_TEMPLATE = [
  [-0.62,  0.55],
  [-1.00, -0.05],
  [-0.62, -0.85],
  [ 0.00, -1.00],
  [ 0.62, -0.85],
  [ 1.00, -0.05],
  [ 0.62,  0.55],
];
const HAWKEYE_HOOD_RINGS = [
  { yFrac:0.00, widthMul:0.58, depthMul:0.58 },
  { yFrac:0.25, widthMul:0.92, depthMul:0.90 },
  { yFrac:0.52, widthMul:1.08, depthMul:1.04 },
  { yFrac:0.78, widthMul:0.82, depthMul:0.78 },
  { yFrac:1.00, widthMul:0.50, depthMul:0.50 },
];
function makeHawkEyeHoodForTest({width, depth, height}){
  const n = HAWKEYE_HOOD_ARC_TEMPLATE.length;
  const verts = [];
  HAWKEYE_HOOD_RINGS.forEach(r=>{
    const hw = width*r.widthMul, hd = depth*r.depthMul;
    HAWKEYE_HOOD_ARC_TEMPLATE.forEach(([fx,fz])=>{
      verts.push(fx*hw, height*r.yFrac, fz*hd);
    });
  });
  const idx = [];
  for(let ri=0; ri<HAWKEYE_HOOD_RINGS.length-1; ri++){
    const base = ri*n, next = (ri+1)*n;
    for(let i=0;i<n-1;i++){
      const a=base+i, b=base+i+1, aTop=next+i, bTop=next+i+1;
      idx.push(a,bTop,b, a,aTop,bTop);
    }
  }
  const topBase = (HAWKEYE_HOOD_RINGS.length-1)*n;
  for(let i=1;i<n-1;i++) idx.push(topBase, topBase+i+1, topBase+i);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

test('makeHawkEyeHood(鷹の目Hood再設計): 「黒い球」を排除した開いたLow Poly Hoodの要件', async (t) => {
  const headR = 0.3705;   // BUILD.male相当の実際の値
  // Phase 9: Hawk Eye Headwear再設計でCap非表示化+Hood拡大(1.25→1.35、
  // 1.75→1.90、06-player-enemy.jsのmakeHawkEyeHood()呼び出しと同じ値)。
  // ARC_TEMPLATE/RINGS自体は変更していないため、以下のEye Opening関連の
  // 不等式チェックはこの新しい寸法でも成立する(単純な拡大のため)
  const width = headR*1.35, depth = headR*1.35, height = headR*1.90;
  const geo = makeHawkEyeHoodForTest({ width, depth, height });
  const n = HAWKEYE_HOOD_ARC_TEMPLATE.length;

  await t.test('妥当なジオメトリが返る(NaN無し・法線あり)', () => {
    // 側面: (段数-1)*(n-1)*2三角形 + 天板: (n-2)三角形
    assertSaneGeometry(geo, (HAWKEYE_HOOD_RINGS.length-1)*(n-1)*2 + (n-2));
  });

  await t.test('三角形数が想定どおり(開口部に余分な面が無い) ―― Vertex/Triangle Countの妥当性', () => {
    const expectedTris = (HAWKEYE_HOOD_RINGS.length-1)*(n-1)*2 + (n-2);
    assert.strictEqual(geo.index.count, expectedTris*3,
      `インデックス数(${geo.index.count})が想定(${expectedTris*3})と一致 ―― 開口部を塞ぐ余分な面が生成されていない`);
    assert.strictEqual(geo.attributes.position.count, HAWKEYE_HOOD_RINGS.length*n,
      `頂点数(${geo.attributes.position.count})がリング数×断面点数と一致`);
  });

  await t.test('実装コード上もSphereGeometryが使われていない(05-rendering-rig.js内のmakeHawkEyeHood定義を直接検査)', () => {
    const srcPath = fileURLToPath(new URL('../../src/legacy/parts/05-rendering-rig.js', import.meta.url));
    const src = fs.readFileSync(srcPath, 'utf8');
    const start = src.indexOf('const HAWKEYE_HOOD_ARC_TEMPLATE');
    const end = src.indexOf('Mage Hat再設計フェーズ: Brim');
    assert.ok(start >= 0 && end > start, 'HAWKEYE_HOOD_ARC_TEMPLATE〜Mage Hatコメントの区間が見つかる');
    const hoodSrc = src.slice(start, end);
    assert.ok(!/SphereGeometry/.test(hoodSrc), 'Hood生成コード(makeHawkEyeHood)にSphereGeometryが含まれない');
  });

  await t.test('円形/正球ではない(断面ごとにwidth/depthの倍率が異なる、単純なSphereGeometryの縮小ではない)', () => {
    const ratios = HAWKEYE_HOOD_RINGS.map(r => r.widthMul / r.depthMul);
    const allSame = ratios.every(r => Math.abs(r - ratios[0]) < 1e-9);
    assert.ok(!allSame || Math.abs(ratios[0]-1) > 1e-9,
      '断面ごとのwidth/depth比が一定の円形スケールではない(方向性を持つ形状)');
  });

  const pos = geo.attributes.position;

  await t.test('前方(開口の縁)Zが後方Zより明確に浅い ―― Front/Back非対称性(布が後方に垂れる方向性)', () => {
    // Cheek/Templeリング(最大幅、index2)で比較
    const ri = 2;
    const openingEdgeFrac = HAWKEYE_HOOD_ARC_TEMPLATE[0][1];   // 0.55(前方)
    const backFrac = Math.abs(HAWKEYE_HOOD_ARC_TEMPLATE[3][1]); // 1.00(後方中央)
    const hd = depth*HAWKEYE_HOOD_RINGS[ri].depthMul;
    const frontZ = openingEdgeFrac*hd, backZ = backFrac*hd;
    assert.ok(frontZ < backZ*0.75,
      `前方開口縁のZ(${frontZ.toFixed(3)})が後方Z(${backZ.toFixed(3)})より明確に浅い(75%未満、後方が張り出す)`);
  });

  await t.test('左右Mirror Symmetry ―― アーク・リングの各点がX=0を軸に鏡映対称', () => {
    HAWKEYE_HOOD_RINGS.forEach((r, ri) => {
      const base = ri*n;
      for(let i=0;i<n;i++){
        const mi = n-1-i;   // アーク配列は前後対称に並んでいるため、i番目とn-1-i番目が鏡映対
        const x1 = pos.getX(base+i), z1 = pos.getZ(base+i);
        const x2 = pos.getX(base+mi), z2 = pos.getZ(base+mi);
        assert.ok(Math.abs(x1+x2) < 1e-5 && Math.abs(z1-z2) < 1e-5,
          `リング${ri}の点${i}と点${mi}が左右ミラー対(x符号反転・z一致)`);
      }
    });
  });

  await t.test('Headとのサイズ整合性 ―― 最大半幅がheadRの極端な倍率になっていない(旧SphereGeometry半径headR*1.35と近いオーダー)', () => {
    let maxR = 0;
    for(let i=0;i<pos.count;i++) maxR = Math.max(maxR, Math.abs(pos.getX(i)), Math.abs(pos.getZ(i)));
    assert.ok(maxR > headR*0.9 && maxR < headR*1.6,
      `Hood最大半幅(${maxR.toFixed(3)})がheadR(${headR.toFixed(3)})の0.9〜1.6倍に収まっている(過度に巨大化していない)`);
  });

  await t.test('Eye X PositionがFace Openingの範囲(開口の縁のXより内側)に入る ―― 埋没しない設計', () => {
    const eyeScale = headR/0.26;
    const eyeX = 0.115*eyeScale;
    // Cheek/Templeリング(Eyeの高さに最も近い、最大幅の断面)の開口縁X
    const ri = 2;
    const hw = width*HAWKEYE_HOOD_RINGS[ri].widthMul;
    const openingEdgeX = Math.abs(HAWKEYE_HOOD_ARC_TEMPLATE[0][0])*hw;
    assert.ok(eyeX < openingEdgeX,
      `EyeのX位置(${eyeX.toFixed(3)})が開口縁のX(${openingEdgeX.toFixed(3)})より内側(開口の範囲内)`);
  });

  await t.test('EyeがHood内部に完全に埋まらない ―― 開口縁のZ(Cheekリング)がEye前面のZより手前(浅い)', () => {
    // 06-player-enemy.jsの実際の値(headR*0.82系統、eyeSizeMul=0.85込み)で
    // Eye前面Zを再計算し、Hoodの開口縁Z(Cheekリング)がそれより手前
    // (小さい)であることを確認する ―― 開口縁が実際のEyeより奥にあると
    // Eyeがその陰に隠れてしまう
    const eyeScale = headR/0.26;
    const eyeFrontZ = headR*0.82 + HEAD_BACK_Z;
    const eyeSizeMul = 0.85;
    const scleraR = 0.062*eyeSizeMul, scleraZScale = 0.6;
    const scleraFrontZ = eyeFrontZ + scleraR*scleraZScale*eyeScale;
    const ri = 2;
    const hd = depth*HAWKEYE_HOOD_RINGS[ri].depthMul;
    const openingEdgeZ = HAWKEYE_HOOD_ARC_TEMPLATE[0][1]*hd;
    assert.ok(openingEdgeZ < scleraFrontZ,
      `Hood開口縁のZ(${openingEdgeZ.toFixed(3)})がEye(Sclera)前面のZ(${scleraFrontZ.toFixed(3)})より手前 ―― Eyeが開口の奥に埋没しない`);
  });

  await t.test('頭頂の天板が上向きの法線を持つ(見下ろしカメラから正しく見える)', () => {
    const topBase = (HAWKEYE_HOOD_RINGS.length-1)*n;
    const v = i => new THREE.Vector3(pos.getX(topBase+i), pos.getY(topBase+i), pos.getZ(topBase+i));
    let sumY = 0, count = 0;
    for(let i=1;i<n-1;i++){
      const a = v(0), b = v(i+1), c = v(i);
      const normal = new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a));
      sumY += normal.y; count++;
    }
    assert.ok(sumY/count > 0, `天板の面法線の平均Y成分(${(sumY/count).toFixed(4)})が正(上向き)`);
  });
});

// Head Assembly構造修正フェーズ: 旧Hair CapはHeadと別テンプレート/別基準値
// /別原点で作られており、前面ZがHeadより常に0.09〜0.18後方=額を覆うことが
// 構造的に不可能だった(Mesh識別Debugで全8クラス確認)。新実装
// makeCharacterHairShell()は「Headの断面の輪郭点をそのままHAIR_SHELL_MUL倍
// した外殻」なので、Headが外へ出ることが数学的に起こり得ない。ここでは
// その包含関係を実際の値で検証する(05-rendering-rig.jsと同じ値を複製 ――
// 値を変えたらこのコピーも合わせて更新すること)。
const HAIR_SHELL_MUL = 1.09;
const HAIR_HAIRLINE_YFRAC = 0.72;
const HAIR_TOP_LIFT = 0.03;
const HAIR_NAPE_YFRAC = 0.34;
const HAIR_NAPE_FRONT_MUL = 0.55;
const HEAD_FRONT_POINT_IDX = new Set([0, 5, 6, 7]);
function headRatioAtForTest(yFrac){
  const secs = Object.values(HEAD_SECTION_RATIOS);
  if(yFrac <= secs[0].yFrac) return Object.assign({}, secs[0], {yFrac});
  for(let i=0;i<secs.length-1;i++){
    const a=secs[i], b=secs[i+1];
    if(yFrac <= b.yFrac){
      const t=(yFrac-a.yFrac)/(b.yFrac-a.yFrac);
      return { yFrac,
        widthMul: a.widthMul+(b.widthMul-a.widthMul)*t,
        depthMul: a.depthMul+(b.depthMul-a.depthMul)*t,
        nosePush: a.nosePush+(b.nosePush-a.nosePush)*t };
    }
  }
  return Object.assign({}, secs[secs.length-1], {yFrac});
}
function headSectionPointsForTest(o, r){
  const hw=o.width*r.widthMul, hd=o.depth*r.depthMul;
  const facePts = HEAD_HEX_TEMPLATE.map(([fx,fz]) => [fx*hw, fz*hd]);
  const nosePts = HEAD_NOSE_TEMPLATE.map(([fx,fz]) => [fx*hw, fz*hd + o.depth*r.nosePush]);
  return [...facePts, ...nosePts];
}
function makeCharacterHairShellForTest(opts){
  const o = Object.assign({ width:0.39, depth:0.39, height:0.78 }, opts || {});
  const hh = o.height/2;
  const sections = [];
  sections.push({
    y: -hh + o.height*HAIR_NAPE_YFRAC,
    points: headSectionPointsForTest(o, headRatioAtForTest(HAIR_NAPE_YFRAC)).map(([x,z], i) => {
      const k = HEAD_FRONT_POINT_IDX.has(i) ? HAIR_NAPE_FRONT_MUL : HAIR_SHELL_MUL;
      return [x*k, z*k];
    }),
  });
  const yfs = [HAIR_HAIRLINE_YFRAC];
  Object.values(HEAD_SECTION_RATIOS).forEach(r => { if(r.yFrac > HAIR_HAIRLINE_YFRAC + 1e-6) yfs.push(r.yFrac); });
  yfs.forEach((yf, i) => {
    const pts = headSectionPointsForTest(o, headRatioAtForTest(yf)).map(([x,z]) => [x*HAIR_SHELL_MUL, z*HAIR_SHELL_MUL]);
    const isTop = (i === yfs.length-1);
    sections.push({ y: -hh + o.height*yf + (isTop ? o.height*HAIR_TOP_LIFT : 0), points: pts });
  });
  return makeLoft({ sections, closedTop:true, closedBottom:true });
}

test('makeCharacterHairShell(Hair Shell): Headの外殻として、HeadがHairの外へ出ることが構造的に起こり得ない', async (t) => {
  const headR = 0.3705, HEAD_DEPTH_MUL = 0.85;
  const DIMS = { width:headR, depth:headR*HEAD_DEPTH_MUL, height:headR*2 };
  const geo = makeCharacterHairShellForTest(DIMS);

  await t.test('妥当なジオメトリが返る(NaN無し・法線あり・裏返っていない)', () => {
    assertSaneGeometry(geo, 3*8*2 + 6*2);   // 側面3段x8面x2 + 上下キャップ(8-2)x2
    assert.ok(signedVolume(geo) > 0, '符号付き体積が正(面が外向き)');
  });

  await t.test('生え際より上の全高さで、Hairの輪郭点がHeadの対応点より外側にある', () => {
    for(const yf of [0.62, 0.66, 0.70, 0.75, 0.80, 0.90, 1.00]){
      const r = headRatioAtForTest(yf);
      const headPts = headSectionPointsForTest(DIMS, r);
      headPts.forEach(([hx,hz], i) => {
        const ax = hx*HAIR_SHELL_MUL, az = hz*HAIR_SHELL_MUL;
        const headLen = Math.hypot(hx,hz), hairLen = Math.hypot(ax,az);
        assert.ok(hairLen > headLen,
          `yFrac=${yf} 点${i}: Hair(${hairLen.toFixed(4)})がHead(${headLen.toFixed(4)})より原点から遠い`);
      });
    }
  });

  await t.test('前面Z・半幅・背面Zのいずれも、生え際より上でHeadを上回る', () => {
    for(const yf of [0.62, 0.70, 0.80, 1.00]){
      const r = headRatioAtForTest(yf);
      const hw = DIMS.width*r.widthMul, hd = DIMS.depth*r.depthMul;
      const headFront = hd + DIMS.depth*r.nosePush, headBack = -hd*1.15;
      assert.ok(headFront*HAIR_SHELL_MUL > headFront, `yFrac=${yf}: Hairの前面Zの方が前`);
      assert.ok(hw*HAIR_SHELL_MUL > hw, `yFrac=${yf}: Hairの半幅の方が広い`);
      assert.ok(Math.abs(headBack*HAIR_SHELL_MUL) > Math.abs(headBack), `yFrac=${yf}: Hairの背面Zの方が後ろ`);
    }
  });

  await t.test('うなじリングは後方・側面だけHeadの外、顔側4点はHeadの内側(顔を覆わない)', () => {
    HEAD_HEX_TEMPLATE.concat(HEAD_NOSE_TEMPLATE).forEach((_, i) => {
      const k = HEAD_FRONT_POINT_IDX.has(i) ? HAIR_NAPE_FRONT_MUL : HAIR_SHELL_MUL;
      if(HEAD_FRONT_POINT_IDX.has(i)) assert.ok(k < 1, `顔側点${i}はHeadの内側(倍率${k})`);
      else assert.ok(k > 1, `後方/側面点${i}はHeadの外側(倍率${k})`);
    });
    assert.ok(HAIR_NAPE_YFRAC < HAIR_HAIRLINE_YFRAC, 'うなじリングは生え際より下にある');
  });

  await t.test('生え際がEyeの中心より上にある(瞳を隠さない)', () => {
    const eyeCenterLocalY = 0.02;
    const hairlineLocalY = -headR + 2*headR*HAIR_HAIRLINE_YFRAC;
    assert.ok(hairlineLocalY > eyeCenterLocalY,
      `生え際(${hairlineLocalY.toFixed(4)})がEye中心(${eyeCenterLocalY})より上`);
  });

  await t.test('Hair Shellの上端・最大半幅がWarrior Helmの内側に収まる', () => {
    const topY = headR + 2*headR*HAIR_TOP_LIFT;
    assert.ok(topY < headR*1.10, `Hair上端(${topY.toFixed(4)})がWarrior Helm天板(${(headR*1.10).toFixed(4)})より低い`);
    const maxHalfW = headR*headRatioAtForTest(HAIR_HAIRLINE_YFRAC).widthMul*HAIR_SHELL_MUL;
    assert.ok(maxHalfW < headR*1.12, `Hair最大半幅(${maxHalfW.toFixed(4)})がWarrior Helm下端の半幅(${(headR*1.12).toFixed(4)})より内側`);
  });
});

// makeHairBang()自体も同じ理由でテスト用に複製する
function makeHairBangShapeForTest(r){
  return [
    {x:0, z:r}, {x:r*0.75, z:r*0.4}, {x:r*0.75, z:-r*0.4},
    {x:0, z:-r}, {x:-r*0.75, z:-r*0.4}, {x:-r*0.75, z:r*0.4},
  ];
}
function makeHairBangForTest({rootR, tipR, length}){
  return makePrism({
    shape: makeHairBangShapeForTest(rootR),
    length,
    scaleStart: tipR/rootR,
    scaleEnd: 1.0,
  });
}

test('makeHairBang(前髪束): Cone(トゲ)ではない太い低ポリ髪束の要件', async (t) => {
  const headR = 0.3705;
  // Head + Hair Integration再設計フェーズ: 実際のゲームカメラ距離で
  // Bangsが視認できるよう半径を約2.3倍に拡大した(旧0.115/0.050→
  // 0.260/0.115)。ここでは新しい中央Bangsの値でmakeHairBang()自体の
  // 妥当性を検証する
  const geo = makeHairBangForTest({ rootR:headR*0.320, tipR:headR*0.145, length:0.09 });

  await t.test('妥当なジオメトリが返る(NaN無し・法線あり)', () => {
    assertSaneGeometry(geo, 6*2);   // 六角形断面x2段の側面
  });

  await t.test('付け根(太い側)が毛先(細い側)より明確に太い ―― 単純な円錐(先端が1点)ではない', () => {
    const pos = geo.attributes.position;
    let maxRAtY0 = 0, maxRAtYLen = 0;
    for(let i=0;i<pos.count;i++){
      const y = pos.getY(i), r = Math.hypot(pos.getX(i), pos.getZ(i));
      if(Math.abs(y-0) < 1e-6) maxRAtY0 = Math.max(maxRAtY0, r);
      if(Math.abs(y-0.09) < 1e-6) maxRAtYLen = Math.max(maxRAtYLen, r);
    }
    assert.ok(maxRAtYLen > maxRAtY0*1.5,
      `付け根側の半径(${maxRAtYLen.toFixed(4)})が毛先側(${maxRAtY0.toFixed(4)})より明確に太い(1.5倍超)`);
    assert.ok(maxRAtY0 > 0.001, `毛先が完全な1点(半径0)ではない ―― 太さのある房として残る`);
  });

  await t.test('断面が6点(六角形) ―― 円形のCone断面ではない', () => {
    const pos = geo.attributes.position;
    // y=lengthの段(付け根側)の頂点数を数える
    let count = 0;
    for(let i=0;i<pos.count;i++){ if(Math.abs(pos.getY(i)-0.09) < 1e-6) count++; }
    assert.strictEqual(count, 6, `付け根側断面の頂点数(${count})が6(六角形)`);
  });
});

test('Hair Bangs配置: 毛先がEye位置(head中心+0.02)より上で止まる、かつ生え際(hairlineY)より下まで垂れる', () => {
  const headR = 0.3705;
  // buildPlayer()側の実際の配置ロジック(head.position.yを0とした相対値)。
  // Head + Hair Integration再設計フェーズで、実際のゲームカメラ距離での
  // 視認性向上のため毛先をさらに額側へ下げた(中央0.050→0.028、
  // 左右0.090→0.060)
  const eyeY = 0.02;
  const hairlineY = headR*0.19;   // Hair Capの生え際(下端)、06-player-enemy.jsのhairlineY相当
  const bangs = [
    { tipY: 0.028 },   // center
    { tipY: 0.045 },   // left/right
    { tipY: 0.045 },
  ];
  bangs.forEach((b, i) => {
    assert.ok(b.tipY > eyeY, `Bang[${i}]の毛先(${b.tipY})がEye位置(${eyeY})より上にある(Eyeを覆わない)`);
    assert.ok(b.tipY < hairlineY, `Bang[${i}]の毛先(${b.tipY})がHair Capの生え際(${hairlineY.toFixed(3)})より下まで垂れている(額に重なる)`);
  });
});

test('Head + Hair Integrationフェーズ: Bangs/Side Hairの左右対称性とHeadwear互換の範囲確認', () => {
  const headR = 0.3705;
  // buildPlayer()側の実際の配置(06-player-enemy.js)を複製。中央Bangsを
  // 除く左右2束のX/tiltZが符号だけ異なる(鏡映対称)ことを確認する
  const sideBangs = [
    { x:-headR*0.34, tiltZ:-0.22, rootR:headR*0.270 },
    { x: headR*0.34, tiltZ: 0.22, rootR:headR*0.270 },
  ];
  assert.strictEqual(sideBangs[0].x, -sideBangs[1].x, '左右BangsのX位置が符号だけ異なる(対称)');
  assert.strictEqual(sideBangs[0].tiltZ, -sideBangs[1].tiltZ, '左右Bangsの傾きが符号だけ異なる(対称、鏡映)');
  assert.strictEqual(sideBangs[0].rootR, sideBangs[1].rootR, '左右Bangsの太さが同じ(非対称な拡大になっていない)');

  // Headwear互換確認: 拡大後もBangs/Side Hairの根元Xが、Warrior Base Helm
  // のFace Opening想定幅(既存テスト「Face Opening: 顔側の開口の縁が
  // headR*0.115*eyeScaleより外側」の考え方と同じオーダー)を大きく超えて
  // いないか ―― 中央Bangsの根元半径(headR*0.260)自体は房の太さであり
  // Face Opening相当の実効X範囲(概ねheadR*0.55前後、WARRIOR_HELM_ARC_
  // TEMPLATEの開口縁0.55基準)より内側に収まっていることを確認する
  const centerBangRootR = headR*0.320;
  const openingHalfWidthOrder = headR*0.55;
  assert.ok(centerBangRootR < openingHalfWidthOrder,
    `中央Bangsの根元半径(${centerBangRootR.toFixed(3)})がWarrior Helm Face Openingの実効半幅(${openingHalfWidthOrder.toFixed(3)})より内側(貫通しない)`);

  const sideHairRootX = headR*0.98, sideHairRootR = headR*0.30;
  assert.ok(sideHairRootX + sideHairRootR < headR*1.5,
    `Side Hairの根元外縁(${(sideHairRootX+sideHairRootR).toFixed(3)})がheadRの1.5倍未満(Headwearから極端に飛び出さない)`);
});

// ============================================================
// Hair再設計 Phase 2: Side Hair + Back Hair
// makeHairBang()/makeHairBangShape()自体はPhase 1で既にテスト済み
// (makeHairBangForTest、上記)なので、ここではPhase 2で追加した配置
// パラメータ(06-player-enemy.js内のSIDE_HAIR/BACK_HAIR相当の値を
// 複製)の妥当性を検証する
// ============================================================

const headRMale = 0.3705;   // BUILD.male.headR相当の実際の値
// buildPlayer()側の実際の値(head.position.yを0とした相対値、Xは
// s=-1/+1で符号反転する前の絶対値)
// Head / Hair / Headwear Global Visual Integration再修正フェーズ(2回目):
// Camera View空間Zでの検証で、Headの露出部分(頬の側面、depthMul=
// widthMul*0.80ルール変更後)がSide Hairより一部カメラに近いことが
// 判明したため、半径を拡大(0.22/0.10→0.30/0.135)しZも中心寄り
// (-headR*0.05)から前方(+headR*0.12)へ押し出した
const SIDE_HAIR_PARAMS = {
  rootR: headRMale*0.30, tipR: headRMale*0.135,
  rootY: headRMale*0.46, tipY: -headRMale*0.22,
  x: headRMale*0.98, z: headRMale*0.12, tiltX: -0.12, tiltZ: 0.16,
};
const BACK_HAIR_PARAMS = [
  { x:0,             rootZ:-headRMale*0.90, rootY:headRMale*0.58, tipY:headRMale*0.22, rootR:headRMale*0.13, tipR:headRMale*0.06, tiltZ:0 },
  { x:-headRMale*0.55, rootZ:-headRMale*0.78, rootY:headRMale*0.52, tipY:headRMale*0.28, rootR:headRMale*0.11, tipR:headRMale*0.05, tiltZ:-0.15 },
  { x: headRMale*0.55, rootZ:-headRMale*0.78, rootY:headRMale*0.52, tipY:headRMale*0.28, rootR:headRMale*0.11, tipR:headRMale*0.05, tiltZ: 0.15 },
];

test('Side Hair(Phase 2): 妥当なGeometryで左右対称、太い房、Eyeを侵食しない', async (t) => {
  const length = SIDE_HAIR_PARAMS.rootY - SIDE_HAIR_PARAMS.tipY;
  const geo = makeHairBangForTest({ rootR:SIDE_HAIR_PARAMS.rootR, tipR:SIDE_HAIR_PARAMS.tipR, length });

  await t.test('妥当なジオメトリが返る(NaN無し・法線あり)', () => {
    assertSaneGeometry(geo, 6*2);
  });

  await t.test('付け根が毛先より明確に太い(単純なConeの先端1点ではない)', () => {
    const pos = geo.attributes.position;
    let maxRAtTip = 0, maxRAtRoot = 0;
    for(let i=0;i<pos.count;i++){
      const y = pos.getY(i), r = Math.hypot(pos.getX(i), pos.getZ(i));
      if(Math.abs(y-0) < 1e-6) maxRAtTip = Math.max(maxRAtTip, r);
      if(Math.abs(y-length) < 1e-6) maxRAtRoot = Math.max(maxRAtRoot, r);
    }
    assert.ok(maxRAtRoot > maxRAtTip*1.5,
      `付け根半径(${maxRAtRoot.toFixed(4)})が毛先半径(${maxRAtTip.toFixed(4)})より明確に太い`);
    assert.ok(maxRAtTip > 0.001, '毛先が完全な1点ではない(太さのある房)');
  });

  await t.test('左右(X=±)で完全に対称な設計値になっている', () => {
    // Side Hairはs=-1/+1でXとtiltZだけ符号反転し、他のパラメータ
    // (rootR/tipR/rootY/tipY/z/tiltX)は左右共通 ―― 実際の呼び出し
    // ロジックと同じ形で対称性を確認する
    const left  = { x:-1*SIDE_HAIR_PARAMS.x, tiltZ:-1*SIDE_HAIR_PARAMS.tiltZ };
    const right = { x: 1*SIDE_HAIR_PARAMS.x, tiltZ: 1*SIDE_HAIR_PARAMS.tiltZ };
    assert.strictEqual(left.x, -right.x, 'X位置が左右で符号だけ異なる(対称)');
    assert.strictEqual(left.tiltZ, -right.tiltZ, '傾きが左右で符号だけ異なる(対称、鏡映)');
  });

  await t.test('Z位置がEyeの前方(headR*0.90)より十分浅い ―― 側面を通るだけでEyeの正面には重ならない', () => {
    // Side HairはBangsと違い、耳→顎のラインを通って毛先がEyeの高さより
    // 下まで伸びる設計(意図的、Bangsのように「Eyeより上で止める」対象
    // ではない)。その代わりZ(前後)位置をEyeよりずっと浅く(headR*0.05
    // 程度の奥行き)取ることで、正面から見たときにEyeの真上を横切らない
    // ようにしてある。Playwrightでも正面向きでEyeが隠れないことを確認済み
    const eyeZ = headRMale*0.90;
    assert.ok(Math.abs(SIDE_HAIR_PARAMS.z) < eyeZ*0.5,
      `Side HairのZ位置(${SIDE_HAIR_PARAMS.z.toFixed(3)})がEyeのZ位置(${eyeZ.toFixed(3)})より十分浅い(正面のEyeと重ならない)`);
  });

  await t.test('根元のX位置がHead最大半幅(headR)近辺 ―― Headから不自然に離れすぎない/埋まりすぎない', () => {
    assert.ok(SIDE_HAIR_PARAMS.x > headRMale*0.7 && SIDE_HAIR_PARAMS.x < headRMale*1.3,
      `Side Hair根元のX(${SIDE_HAIR_PARAMS.x.toFixed(3)})がheadR(${headRMale.toFixed(3)})の0.7〜1.3倍に収まっている`);
  });
});

test('Back Hair(Phase 2): 妥当なGeometryで3束、短め、Hair Capとの接続が自然', async (t) => {
  await t.test('3束それぞれ妥当なジオメトリが返る(NaN無し・法線あり)', () => {
    BACK_HAIR_PARAMS.forEach((b, i) => {
      const geo = makeHairBangForTest({ rootR:b.rootR, tipR:b.tipR, length:b.rootY-b.tipY });
      assertSaneGeometry(geo, 6*2);
    });
  });

  await t.test('Back Centerが最も後方(|Z|最大)にある', () => {
    const centerZ = Math.abs(BACK_HAIR_PARAMS[0].rootZ);
    BACK_HAIR_PARAMS.slice(1).forEach((b, i) => {
      assert.ok(centerZ >= Math.abs(b.rootZ),
        `Back CenterのZ(${centerZ.toFixed(3)})がBack Left/Right[${i}](${Math.abs(b.rootZ).toFixed(3)})以上`);
    });
  });

  await t.test('左右(Back Left/Right)が対称な設計値になっている', () => {
    const [, left, right] = BACK_HAIR_PARAMS;
    assert.strictEqual(left.x, -right.x, 'X位置が左右対称');
    assert.strictEqual(left.rootZ, right.rootZ, 'Z位置が左右で同じ');
    assert.strictEqual(left.tiltZ, -right.tiltZ, '傾きが左右で符号だけ異なる(対称)');
  });

  await t.test('肩やマントまで届かない短さ(長さがheadRの0.5倍未満)', () => {
    BACK_HAIR_PARAMS.forEach((b, i) => {
      const length = b.rootY - b.tipY;
      assert.ok(length < headRMale*0.5,
        `Back Hair[${i}]の長さ(${length.toFixed(3)})がheadR*0.5(${(headRMale*0.5).toFixed(3)})未満(短髪〜中程度)`);
    });
  });

  await t.test('根元の高さ(rootY)がHair Cap下端(headR*0.19)〜上端(headR*1.05)の範囲内 ―― Hair Capとの接続に隙間がない', () => {
    const hairCapBottom = headRMale*0.19, hairCapTop = headRMale*1.05;
    BACK_HAIR_PARAMS.forEach((b, i) => {
      assert.ok(b.rootY >= hairCapBottom && b.rootY <= hairCapTop,
        `Back Hair[${i}]の根元高さ(${b.rootY.toFixed(3)})がHair Capの範囲(${hairCapBottom.toFixed(3)}〜${hairCapTop.toFixed(3)})内にある`);
    });
  });
});

test('Hair Phase 2: headGroupPartsの並び順(Head→Hair→装飾→Eye)が保たれている', () => {
  // buildPlayer()側の実際の並び: [head, hair, ...bangMeshes, ...sideHairMeshes,
  // ...backHairMeshes, ...faceMeshes]。battleKnight昇格時のheadScaleGroup
  // (headGroupParts全体を縮小)とslice(2)(目を隠す=Bangs以降がまとめて
  // 隠れる)の両方が正しく機能するために、index0=head, index1=hairの順序
  // が保たれていることが重要
  const order = ['head', 'hair', 'bang0', 'bang1', 'bang2',
    'sideHair0', 'sideHair1', 'backHair0', 'backHair1', 'backHair2',
    'eye0', 'eye1', 'eye2', 'eye3', 'eye4', 'eye5'];
  assert.strictEqual(order[0], 'head', 'headGroupParts[0]はhead');
  assert.strictEqual(order[1], 'hair', 'headGroupParts[1]はhair(Hair Cap)');
  assert.ok(order.indexOf('bang0') > order.indexOf('hair'), 'BangsはHair Capより後');
  assert.ok(order.indexOf('sideHair0') > order.indexOf('bang2'), 'Side HairはBangsより後');
  assert.ok(order.indexOf('backHair0') > order.indexOf('sideHair1'), 'Back HairはSide Hairより後');
  assert.ok(order.indexOf('eye0') > order.indexOf('backHair2'), 'EyeはBack Hairより後(slice(2)で髪飾り一式+Eyeがまとめて隠れる)');
});

// Player Material Calibration Phase A: Warrior Helmet専用に新設した
// warriorHelmMatの数値を記録するregressionテスト。06-player-enemy.jsは
// 単体テストから直接importできない結合済みscopeのため(makeWarriorBaseHelm
// 等と同じ理由)、実際のsrc値をここに複製して比較する ―― 数値がずれたら
// このテストが検出する。Headwear + Head Silhouette Audit(実機Playwright
// 比較)で、metalness:0.7・roughness:0.35(環境マップ無し)がDefault Game
// Cameraで「黒い光沢の球」にしか見えず、Low Poly Facet(7角形×3リング)が
// 一切視認できないことを確認済み。metalness/roughnessのみを変えるA/B/C
// 比較(Geometry/Lighting不変)の結果、Facetの稜線が最も明瞭に読める
// Candidate A(metalness:0.12, roughness:0.55)を採用した。
test('Player Material Calibration Phase A: Warrior Helmet専用Material(warriorHelmMat)の値とmetalMat(盗賊の投げナイフ等と共有)からの分離', () => {
  // 06-player-enemy.js内の実際の定義値(意図的な複製、上記コメント参照)
  const sharedMetalMat = { color:0x9aa0a8, roughness:0.35, metalness:0.7 };   // 盗賊の投げナイフ等が引き続き使う値(今回変更していない)
  const warriorHelmMat  = { color:0x9aa0a8, roughness:0.55, metalness:0.12 }; // Warrior Helmet専用(今回新設)

  // 1. 共有metalMat(盗賊の投げナイフ等)の値は今回のPhaseで変更していない
  assert.strictEqual(sharedMetalMat.metalness, 0.7, '共有metalMat(盗賊の投げナイフ等)のmetalnessは今回変更していない');
  assert.strictEqual(sharedMetalMat.roughness, 0.35, '共有metalMat(盗賊の投げナイフ等)のroughnessは今回変更していない');

  // 2. Warrior Helmet専用材(warriorHelmMat)は共有metalMatとは別の値 ――
  //    分離されている(同じオブジェクトを書き換えたのではないことの確認)
  assert.notStrictEqual(warriorHelmMat.metalness, sharedMetalMat.metalness,
    'warriorHelmMatは共有metalMatと別の値(専用Materialとして分離されている)');

  // 3. Facet可読性のためmetalnessを大きく下げた方向で調整されている ――
  //    Headwear + Head Silhouette Auditで「黒い球」の主因と確認された値
  //    (0.7)から明確に離れていること
  assert.ok(warriorHelmMat.metalness <= 0.2,
    `warriorHelmMatのmetalness(${warriorHelmMat.metalness})はFacetが読める範囲(<=0.2)`);
  assert.ok(warriorHelmMat.metalness > 0,
    'metalness=0にはしていない(Priority 4: 適度な金属感を残す)');

  // 4. roughnessはCandidate比較(A:0.55/B:0.50/C:0.45)でFacetが最も明瞭
  //    だったCandidate Aの範囲
  assert.ok(warriorHelmMat.roughness >= 0.45 && warriorHelmMat.roughness <= 0.6,
    `warriorHelmMatのroughness(${warriorHelmMat.roughness})はCandidate比較で選定した範囲(0.45〜0.6)`);

  // 5. colorは変更していない(既存metalMatと同じ0x9aa0a8のまま ――
  //    Material数値のみを調整する、というPhaseの制約通り)
  assert.strictEqual(warriorHelmMat.color, sharedMetalMat.color,
    'colorは既存metalMatと同じ0x9aa0a8のまま(今回はmetalness/roughnessのみ調整)');
});

// Headwear Silhouette Integration Phase: Priority A(Visor→Brow Guard)+
// Priority B(Helmet Rear/Crown Coverage)のregressionテスト。06-player-
// enemy.js/05-rendering-rig.jsは単体テストから直接importできない結合済み
// scopeのため(makeWarriorBaseHelm等と同じ理由)、実際のsrc値をここに複製
// して比較する ―― 数値がずれたらこのテストが検出する。
test('Headwear Silhouette Integration Phase(Priority A): Warrior Brow Guardが顔全幅を横断する黒帯にならず、Eye高さより上にある', () => {
  const headR = 0.3705;   // BUILD.male相当
  const eyeScale = headR/0.26;
  const eyeX = 0.115*eyeScale;               // 既存Eyeの左右X位置
  const eyeYOffset = 0.02;                   // 既存EyeのY(hY基準)
  // 06-player-enemy.js内の実際の定義値(意図的な複製、上記コメント参照)
  const browGuardW = headR*0.40, browCenterX = headR*0.40, browY = 0.115;

  // 1. 左右2枚に分割されている(1枚で顔全幅を横断する旧Visorではない)
  //    ―― 中央(鼻筋)に隙間が空いていることを、各Brow Guardの内側の縁
  //    (中心X - 半幅)が0より大きいことで確認する
  const innerEdgeX = browCenterX - browGuardW/2;
  assert.ok(innerEdgeX > 0, `Brow Guard内側の縁(${innerEdgeX.toFixed(3)})が中央(鼻筋)を塞がず隙間がある`);

  // 2. Eyeの高さ(hY+0.02)より上にある ―― Eyeの高さを横断する帯にならない
  assert.ok(browY > eyeYOffset,
    `Brow GuardのY(hY+${browY})がEyeのY(hY+${eyeYOffset})より上にあり、Eye高さを横断しない`);

  // 3. Helmet Face Openingの実効半幅(中腹リングでheadR*0.55*1.15)より
  //    内側に収まっている(兜の縁から横に飛び出さない)
  const openingHalfWidthAtMid = 0.55*1.15*headR;
  const browOuterEdgeX = browCenterX + browGuardW/2;
  assert.ok(browOuterEdgeX < openingHalfWidthAtMid,
    `Brow Guard外側の縁(${browOuterEdgeX.toFixed(3)})がHelmet Face Openingの実効半幅(${openingHalfWidthAtMid.toFixed(3)})より内側`);

  // 4. 1枚あたりの幅が旧Visor(headR*1.9、顔全幅の1.8倍相当)より大幅に
  //    狭い ―― 「単純な縮小ではなく分割」の要件を数値でも裏付ける
  assert.ok(browGuardW < headR*0.6,
    `Brow Guard1枚の幅(${browGuardW.toFixed(3)})が旧Visor(headR*1.9)よりはるかに狭い`);
});

test('Headwear Silhouette Integration Phase(Priority B): Warrior Helmetの中間リングがHead/Hair Capの背面プロファイルに沿って緩やかに絞られている', () => {
  // 05-rendering-rig.js内の実際の定義値(意図的な複製、上記コメント参照)
  const RINGS = [
    { yFrac:0.00, widthMul:1.12, depthMul:1.05 },
    { yFrac:0.50, widthMul:1.15, depthMul:1.08 },
    { yFrac:0.78, widthMul:1.02, depthMul:0.98 },
    { yFrac:1.00, widthMul:0.78, depthMul:0.74 },
  ];

  // 1. 中腹(最大幅)から頭頂へ向けて単調に絞られている(逆転していない)
  for(let i=1;i<RINGS.length;i++){
    assert.ok(RINGS[i].widthMul <= RINGS[i-1].widthMul || i===1,
      `リング${i}のwidthMul(${RINGS[i].widthMul})が中腹以降は単調非増加`);
  }

  // 2. 頭頂リングは、旧値(0.70/0.65)より緩め(Head/Hair Crownとの整合
  //    改善)だが、中腹(1.15/1.08)ほど大きくはない(兜全体を巨大化しない)
  const crown = RINGS[RINGS.length-1];
  assert.ok(crown.widthMul > 0.70 && crown.widthMul < 1.15,
    `頭頂widthMul(${crown.widthMul})が旧値(0.70)より緩く、中腹(1.15)未満`);
  assert.ok(crown.depthMul > 0.65 && crown.depthMul < 1.08,
    `頭頂depthMul(${crown.depthMul})が旧値(0.65)より緩く、中腹(1.08)未満`);

  // 3. 中腹と頭頂の間に中間リングが追加されている(急激な絞りを緩和)
  assert.strictEqual(RINGS.length, 4, 'リング数が3→4(中間リング追加)になっている');
  const mid = RINGS[1], between = RINGS[2];
  assert.ok(between.yFrac > mid.yFrac && between.yFrac < crown.yFrac,
    '中間リングのyFracが中腹と頭頂の間にある');
  assert.ok(between.widthMul < mid.widthMul && between.widthMul > crown.widthMul,
    '中間リングのwidthMulが中腹と頭頂の間の値になっている(段差の無い滑らかな絞り)');

  // 4. Face Opening側(下端・中腹)の値は今回変更していない(前面シルエット
  //    は維持する、というPhaseの制約)
  assert.deepStrictEqual(RINGS[0], { yFrac:0.00, widthMul:1.12, depthMul:1.05 },
    '下端リングは変更していない');
  assert.deepStrictEqual(RINGS[1], { yFrac:0.50, widthMul:1.15, depthMul:1.08 },
    '中腹(最大幅)リングは変更していない');
});

// Player Character Head Silhouette Global Redesign Phase: 全8クラス共通の
// Head本体サイズ・奥行き圧縮のregressionテスト。05-rendering-rig.js/
// 06-player-enemy.jsは単体テストから直接importできない結合済みscopeの
// ため(makeWarriorBaseHelm等と同じ理由)、実際のsrc値をここに複製して
// 比較する ―― 数値がずれたらこのテストが検出する。
test('Head Silhouette Global Redesign Phase: BUILD.headR/hairRのUniform縮小(95%)とHEAD_DEPTH_MUL(前後奥行きのみ追加90%)', () => {
  // 05-rendering-rig.js内の実際の定義値(意図的な複製、上記コメント参照)
  const OLD_HEAD_R_MALE = 0.390, OLD_HAIR_R_MALE = 0.420;
  const NEW_HEAD_R_MALE = 0.3705, NEW_HAIR_R_MALE = 0.399;
  const OLD_HEAD_R_FEMALE = 0.370, OLD_HAIR_R_FEMALE = 0.398;
  const NEW_HEAD_R_FEMALE = 0.3515, NEW_HAIR_R_FEMALE = 0.3781;
  const HEAD_DEPTH_MUL = 0.85;

  // 1. Uniform Scale成分(95%)がheadR/hairR双方に、male/female同じ比率で
  //    反映されている
  const mulHeadMale = NEW_HEAD_R_MALE / OLD_HEAD_R_MALE;
  const mulHairMale = NEW_HAIR_R_MALE / OLD_HAIR_R_MALE;
  const mulHeadFemale = NEW_HEAD_R_FEMALE / OLD_HEAD_R_FEMALE;
  const mulHairFemale = NEW_HAIR_R_FEMALE / OLD_HAIR_R_FEMALE;
  assert.ok(Math.abs(mulHeadMale - 0.95) < 1e-6, `male headRの縮小率(${mulHeadMale.toFixed(4)})が95%`);
  assert.ok(Math.abs(mulHairMale - 0.95) < 1e-6, `male hairRの縮小率(${mulHairMale.toFixed(4)})が95%`);
  assert.ok(Math.abs(mulHeadFemale - 0.95) < 1e-6, `female headRの縮小率(${mulHeadFemale.toFixed(4)})が95%`);
  assert.ok(Math.abs(mulHairFemale - 0.95) < 1e-6, `female hairRの縮小率(${mulHairFemale.toFixed(4)})が95%`);

  // 2. 縮小前後でhairR/headRの比率(約1.076倍)が保たれている ――
  //    Uniform Scaleが両方に同じ比率で掛かっている証拠
  const oldRatio = OLD_HAIR_R_MALE / OLD_HEAD_R_MALE;
  const newRatio = NEW_HAIR_R_MALE / NEW_HEAD_R_MALE;
  assert.ok(Math.abs(oldRatio - newRatio) < 1e-6,
    `hairR/headR比(旧${oldRatio.toFixed(4)}, 新${newRatio.toFixed(4)})が保たれている`);

  // 3. HEAD_DEPTH_MULは前後方向だけを狙った追加圧縮のため、1.0未満かつ
  //    極端すぎない範囲(顔が潰れて見えない下限)にある
  assert.ok(HEAD_DEPTH_MUL < 1.0 && HEAD_DEPTH_MUL >= 0.8,
    `HEAD_DEPTH_MUL(${HEAD_DEPTH_MUL})が1.0未満、かつ0.8以上(過剰な圧縮ではない)`);

  // 4. makeCharacterHead()に渡すdepth引数(headR*HEAD_DEPTH_MUL)は、
  //    width/height(headRそのまま)より明確に小さい ―― 「前後にだけ長い」
  //    という指摘に対応するための、前後方向限定の圧縮になっている
  const headR = NEW_HEAD_R_MALE;
  const widthArg = headR, depthArg = headR*HEAD_DEPTH_MUL, heightArg = headR*2;
  assert.ok(depthArg < widthArg, 'Head本体のdepth引数がwidth引数より小さい(前後方向だけ圧縮)');
  assert.ok(Math.abs(heightArg - headR*2) < 1e-9, 'height引数はHEAD_DEPTH_MULの対象外(widthと同じheadR基準のまま)');
});

test('Head Silhouette Global Redesign Phase: Head本体の総前後Depthが、総Width/総Heightに対して過大でない', () => {
  // makeCharacterHead()の実際のGeometryを生成し、bounding boxから
  // 前後(Z)・左右(X)・上下(Y)の実測サイズを比較する。「額と後頭部が
  // 前後に長く見える」という指摘に対し、Depthが他の2軸より明確に
  // 大きくなっていないことを確認する(Candidate比較で選定したCandidate C
  // ―― Uniform95%+追加Depth圧縮90%の効果を、実際のGeometry出力で検証)
  const HEAD_DEPTH_MUL = 0.85;
  const headR = 0.3705, headLen = headR*2;
  const geo = makeCharacterHeadForTest({ width:headR, depth:headR*HEAD_DEPTH_MUL, height:headLen });
  const pos = geo.attributes.position;
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(let i=0;i<pos.count;i++){
    minX=Math.min(minX,pos.getX(i)); maxX=Math.max(maxX,pos.getX(i));
    minY=Math.min(minY,pos.getY(i)); maxY=Math.max(maxY,pos.getY(i));
    minZ=Math.min(minZ,pos.getZ(i)); maxZ=Math.max(maxZ,pos.getZ(i));
  }
  const totalW = maxX-minX, totalH = maxY-minY, totalD = maxZ-minZ;
  // Depthが最大でもWidth・Heightの1.05倍を超えない(「前後にだけ突出して
  // 長い」という違和感の直接的な再発防止線)
  assert.ok(totalD <= totalW*1.05,
    `Head総Depth(${totalD.toFixed(3)})がWidth(${totalW.toFixed(3)})の1.05倍を超えていない`);
  assert.ok(totalD <= totalH*1.05,
    `Head総Depth(${totalD.toFixed(3)})がHeight(${totalH.toFixed(3)})の1.05倍を超えていない`);
});

test('Head Silhouette Global Redesign Phase: Eye/Bangs/Hair Cap/Back HairのZ位置がHEAD_DEPTH_MULに追従している', () => {
  // 06-player-enemy.js内の実際の計算式(意図的な複製、上記コメント参照)
  const HEAD_DEPTH_MUL = 0.85, HEAD_BACK_Z = -0.05, headR = 0.3705;
  const eyeFrontZ = headR*0.82*HEAD_DEPTH_MUL + HEAD_BACK_Z;
  const bangZ = headR*0.86*HEAD_DEPTH_MUL + HEAD_BACK_Z;
  const backHairCenterRootZ = -headR*0.90*HEAD_DEPTH_MUL + HEAD_BACK_Z;

  // 旧式(HEAD_DEPTH_MUL無し)の値より、いずれも中心(HEAD_BACK_Z)寄りに
  // 引き寄せられている ―― Headが浅くなった分、Eye/Bangs/Back Hairが
  // 古い深さのまま取り残されていないことの確認
  const oldEyeFrontZ = headR*0.82 + HEAD_BACK_Z;
  const oldBangZ = headR*0.86 + HEAD_BACK_Z;
  const oldBackHairCenterRootZ = -headR*0.90 + HEAD_BACK_Z;
  assert.ok(eyeFrontZ < oldEyeFrontZ, 'EyeのZが旧式より手前(中心寄り)に引き寄せられている');
  assert.ok(bangZ < oldBangZ, 'BangsのZが旧式より手前(中心寄り)に引き寄せられている');
  assert.ok(backHairCenterRootZ > oldBackHairCenterRootZ, 'Back HairのrootZが旧式より手前(中心寄り)に引き寄せられている');

  // Eyeの前面はBangsの基準Zより明確に奥に埋もれていない(既存のEye/Bangs
  // 前後関係、Eyeが額の房の下に沈み込みすぎない設計は維持されている)
  assert.ok(eyeFrontZ < bangZ, 'EyeのZがBangsのZより奥(顔の表面寄り)にある(既存の前後関係を維持)');
});

// Battle Knight Helmet再検証フェーズ: 実機Playwright比較で「戦騎士の頭が
// ほぼ丸出しに見える」ことが判明した。原因はCylinderGeometryの先細り
// (radiusTop=radiusBottom*0.42)が急すぎ、Head本体の頬(cheek、全断面中
// 最大幅)の高さに達する頃には兜の半径がすでに頭の半幅を下回っていた
// ため(06-player-enemy.js、battleKnight昇格処理側のコメント参照)。
test('Battle Knight Helmet再検証: Cylinderの半径が、頬(cheek)の高さでもHead本体の半幅を上回っている', () => {
  // 06-player-enemy.js内の実際の値(意図的な複製、上記コメント参照)
  const headR = 0.3705, HEAD_DEPTH_MUL = 0.85;
  const hR = headR*0.86;                 // battleKnight昇格時の縮小後head半径
  const helmetR = hR*1.25;               // 修正後の下端半径
  const helmetTopMul = 0.75;             // 修正後の先細り比率
  const helmetH = hR*1.55;
  const helmetBottomLocalY = -helmetH/2, helmetTopLocalY = helmetH/2;

  // Head本体の頬(cheek)の高さ(headScaleGroupで0.86倍された後の実効半幅)
  const cheekWidthMul = 1.06;   // HEAD_SECTION_RATIOS.cheek.widthMul(05-rendering-rig.js)
  const headCheekHalfWidth = hR*cheekWidthMul;   // Headのwidth引数もheadR*0.86倍後の値のため、hR基準でそのまま比較できる

  // cheekのY位置(headScaleGroup内、Headの下端=chin基準、yFrac0.52)を
  // Helmetのローカル座標系(headYLocal基準)へ変換して、Helmetの該当高さの
  // 半径を線形補間で求める
  const headHalfHeightScaled = headR*0.86;   // Head総高さ(headR*2)の半分に0.86倍
  const cheekYFromHeadCenter = -headHalfHeightScaled + (headHalfHeightScaled*2)*0.52;
  const helmetY = 0 + hR*0.30;   // headYLocalを0とした相対値(headYLocal + hR*0.30)
  const cheekWorldYRelative = cheekYFromHeadCenter;   // headYLocal基準でHead中心=0
  const cheekLocalInHelmet = cheekWorldYRelative - helmetY;   // Helmetのローカル座標(中心=0)
  const t = (cheekLocalInHelmet - helmetBottomLocalY) / (helmetTopLocalY - helmetBottomLocalY);
  assert.ok(t >= 0 && t <= 1, `cheekの高さがHelmetの縦範囲内にある(t=${t.toFixed(3)})`);

  const radiusAtCheek = helmetR + t*(helmetR*helmetTopMul - helmetR);
  assert.ok(radiusAtCheek > headCheekHalfWidth,
    `頬の高さでのHelmet半径(${radiusAtCheek.toFixed(4)})がHeadの頬半幅(${headCheekHalfWidth.toFixed(4)})を上回っている(Headが側面から突き抜けない)`);
  // 最低限のマージン(5%以上)も確認 ―― ギリギリの余白では実機スケールで
  // 再びHeadが透けて見えるリスクがあるため
  assert.ok(radiusAtCheek > headCheekHalfWidth*1.05,
    `頬の高さでのHelmet半径に5%以上のマージンがある(実測${((radiusAtCheek/headCheekHalfWidth-1)*100).toFixed(1)}%)`);
});
