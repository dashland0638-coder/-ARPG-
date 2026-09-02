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
