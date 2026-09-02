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
// HEAD_HEX_TEMPLATE/HEAD_SECTION_RATIOSと同じ値をここに複製して検証する
// (値を変えたらこのコピーも合わせて更新すること)
const HEAD_HEX_TEMPLATE = [
  [-0.78, 1.00],
  [-1.00, 0.05],
  [-0.22,-1.15],
  [ 0.22,-1.15],
  [ 1.00, 0.05],
  [ 0.78, 1.00],
];
const HEAD_SECTION_RATIOS = {
  chin:      { yFrac:0.00, widthMul:0.38, depthMul:0.42 },
  jaw:       { yFrac:0.22, widthMul:0.72, depthMul:0.68 },
  cheek:     { yFrac:0.52, widthMul:1.00, depthMul:0.88 },
  upperHead: { yFrac:0.80, widthMul:0.92, depthMul:1.00 },
  crown:     { yFrac:1.00, widthMul:0.60, depthMul:0.75 },
};
function makeCharacterHeadForTest({width, depth, height}){
  const hh = height/2;
  const sections = Object.values(HEAD_SECTION_RATIOS).map(r => {
    const hw = width*r.widthMul, hd = depth*r.depthMul;
    return { y: -hh + height*r.yFrac, points: HEAD_HEX_TEMPLATE.map(([fx,fz]) => [fx*hw, fz*hd]) };
  });
  return makeLoft({ sections, closedTop:true, closedBottom:true });
}

test('makeCharacterHead(Loft頭部): Chin-Jaw-Cheek-UpperHead-Crownの非対称頭部シルエット要件', async (t) => {
  const headR = 0.390, headLen = 0.780;   // BUILD.male相当の実際の値(height=B.headR*2)
  const geo = makeCharacterHeadForTest({ width:headR, depth:headR, height:headLen });

  await t.test('妥当なジオメトリが返る(NaN無し・法線あり)', () => {
    assertSaneGeometry(geo, 4*6*2 + 4*2);   // 側面4段x6面x2 + キャップ2段x(6-2)三角形
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

  await t.test('各断面で幅(X)と厚み(Z)が異なる ―― 円形/正六角形断面ではない', () => {
    const seen = new Map();
    for(let i=0;i<pos.count;i++){
      const y = Math.round(pos.getY(i)*1000)/1000;
      const e = seen.get(y) || {maxX:0, maxZ:0};
      e.maxX = Math.max(e.maxX, Math.abs(pos.getX(i)));
      e.maxZ = Math.max(e.maxZ, Math.abs(pos.getZ(i)));
      seen.set(y, e);
    }
    assert.ok(seen.size >= 5, '5段の断面がそれぞれ別の高さに存在する');
    for(const [, e] of seen){
      assert.notEqual(e.maxX, e.maxZ, `幅(${e.maxX})と厚み(${e.maxZ})が一致していない(円形断面ではない)`);
    }
  });

  await t.test('顔側(+Z)は平ら・後頭部側(-Z)は絞られている ―― 前後対称な球ではない', () => {
    // Cheek断面(中心付近の高さ)で、+Z側(顔)の最大Zと-Z側(後頭部)の
    // 最大|Z|を比較する。正六角形/円ならほぼ同じになるはずだが、今回の
    // テンプレートは意図的に非対称(顔は平らな広い辺、後頭部は中心寄りの
    // 狭い辺)にしてある。
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

  await t.test('閉じた立体として面が一貫して外向きに巻かれている(裏返り無し)', () => {
    assert.ok(signedVolume(geo) > 0, '符号付き体積が正');
  });

  await t.test('Chinの幅がNeck上端(B.neck*1.15相当)と極端に乖離していない ―― 首に刺さった棒に見えない', () => {
    // 完全一致は不要。既存NeckはB.neck(男0.088)*1.15≒0.101が上端半径。
    // Chinの実効半幅がこれより十分大きければ(下限0.8倍以上)、Headの
    // 下端がNeckより明らかに細い「串刺し」状態にはならない。
    const neckTopR = 0.088*1.15;
    assert.ok(chinW > neckTopR*0.8,
      `Chin幅(${chinW.toFixed(3)})がNeck上端(${neckTopR.toFixed(3)})に対して極端に細くない`);
  });

  await t.test('Cheekの顔側(+Z)実効Depthが既存Eye基準(headR*0.90)と近いオーダーにある ―― Eyeが浮かない/埋まらない', () => {
    // 完全一致は不要。既存Eye(sclera/pupil/highlight)はheadR*0.90付近の
    // Z位置に配置されている。Cheek断面(Eyeの高さに最も近い)の顔側Z実効値が
    // headRの0.75〜1.10倍程度のオーダーに収まっていれば、Head Loft化後も
    // Eyeが新しい顔面から極端に浮いたり埋まったりしない。
    let maxFrontZ = 0;
    const yTarget = -hh + headLen*0.52;
    for(let i=0;i<pos.count;i++){
      if(Math.abs(pos.getY(i) - yTarget) < 1e-6){
        const z = pos.getZ(i);
        if(z > 0) maxFrontZ = Math.max(maxFrontZ, z);
      }
    }
    assert.ok(maxFrontZ > headR*0.75 && maxFrontZ < headR*1.10,
      `Cheek顔側のZ(${maxFrontZ.toFixed(3)})がheadR*0.90(${(headR*0.90).toFixed(3)})に近いオーダーにある`);
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
