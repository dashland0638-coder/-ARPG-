// Procedural texture/bump-map generation - the game draws every surface on
// a <canvas> at runtime rather than shipping image files. Self-contained:
// no dependency on game state, only on THREE and the DOM canvas API. The
// "structured" surface generators (plank/masonry/cobble/wallpaper/
// stone-tile) can optionally be overridden with a real image registered in
// texture-manifest.js - see applyOverride() below.
import * as THREE from 'three';
import { TEXTURE_OVERRIDES } from './texture-manifest.js';

function resolveAssetUrl(assetPath){
  if(!assetPath) return assetPath;
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return base + assetPath;
}

// url -> { image: HTMLImageElement|null, waiters: Set<THREE.Texture> }.
// Multiple surfaces (different repeat/bump params) can share one override
// name, so a single load is fanned out to every texture waiting on it
// rather than re-fetched per call site.
const overrideLoads = new Map();
function applyOverride(name, tex){
  if(!name) return;
  const url = TEXTURE_OVERRIDES[name];
  if(!url) return;
  const resolved = resolveAssetUrl(url);
  let entry = overrideLoads.get(resolved);
  if(!entry){
    entry = { image: null, waiters: new Set() };
    overrideLoads.set(resolved, entry);
    new THREE.TextureLoader().load(resolved, loaded => {
      entry.image = loaded.image;
      entry.waiters.forEach(t => { t.image = entry.image; t.needsUpdate = true; });
      entry.waiters.clear();
      // the loaded photo has its own baked lighting/relief - stop offering
      // it as a bumpMap candidate so a later applySurfaceDetail() call
      // doesn't emboss the procedural height field on top of it.
      bumpFor.delete(tex);
    }, undefined, err => {
      console.warn(`texture override failed to load, keeping procedural surface: ${name}`, err);
    });
  }
  if(entry.image){ tex.image = entry.image; tex.needsUpdate = true; }
  else entry.waiters.add(tex);
}

  /* =========================================================
     PROCEDURAL SURFACE LIBRARY

     Every surface in the game used to be the same speckle pattern in a
     different colour, so a plank deck, a temple wall and a tiled restroom
     all read as "flat colour with grit on it". The generators below draw
     actual planking, masonry, cobbles and wallpaper - and each one also
     renders a matching height field, which applySurfaceDetail() hands to
     the material as a bumpMap. That is what makes joints and mortar catch
     the light instead of being painted on.
  ========================================================= */
  const surfCache = new Map();
  // colour texture -> {tex: height texture, scale: how deep the relief reads}.
  // The depth lives here rather than on the texture. Written back when
  // THREE.Texture had no userData bag to hang it off (newer versions added
  // one) - left as a side map since there's no reason to churn working code
  // just because the workaround it was written around is now optional.
  const bumpFor   = new Map();

  function _tex(canvas, rx, ry){
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    return t;
  }
  // '#rrggbb' scaled by k, clamped - used for per-unit shade variation
  function _shade(hex, k){
    const n = parseInt(hex.slice(1), 16);
    const c = v => Math.max(0, Math.min(255, Math.round(v*k)));
    return 'rgb('+c((n>>16)&255)+','+c((n>>8)&255)+','+c(n&255)+')';
  }
  function _grey(v){
    v = Math.max(0, Math.min(255, Math.round(v)));
    return 'rgb('+v+','+v+','+v+')';
  }

  /* Draws a colour pass and a height pass into two canvases, caches the
     pair, and returns the colour texture. Mid-grey (128) in the height pass
     means "flat", darker means recessed. */
  function makeSurface(key, size, rx, ry, bumpScale, draw, overrideName){
    if(surfCache.has(key)){
      const cached = surfCache.get(key);
      if(overrideName) applyOverride(overrideName, cached);
      return cached;
    }
    const c = document.createElement('canvas'); c.width = c.height = size;
    const h = document.createElement('canvas'); h.width = h.height = size;
    const cx = c.getContext('2d'), hx = h.getContext('2d');
    hx.fillStyle = _grey(128); hx.fillRect(0,0,size,size);
    draw(cx, hx, size);
    const tex = _tex(c, rx, ry), bump = _tex(h, rx, ry);
    bumpFor.set(tex, {tex:bump, scale:bumpScale});
    surfCache.set(key, tex);
    if(overrideName) applyOverride(overrideName, tex);
    return tex;
  }

  /* ---- planking: floorboards, decks, hull strakes ---------------------- */
  function makePlankTexture(base, rows, rx, ry, opts){
    opts = opts || {};
    const key = 'plank|'+base+'|'+rows+'|'+rx+'|'+ry+'|'+(opts.vertical?'v':'h');
    return makeSurface(key, 128, rx, ry, opts.bump || 0.055, (cx,hx,S)=>{
      const ph = S/rows;
      if(opts.vertical){ cx.translate(S,0); cx.rotate(Math.PI/2); hx.translate(S,0); hx.rotate(Math.PI/2); }
      cx.fillStyle = _shade(base, 0.42); cx.fillRect(0,0,S,S);   // the gaps between boards
      hx.fillStyle = _grey(58);          hx.fillRect(0,0,S,S);
      for(let r=0;r<rows;r++){
        const y = r*ph, k = 0.84 + ((r*2654435761)%97)/97*0.32;
        cx.fillStyle = _shade(base, k);
        cx.fillRect(0, y+1, S, ph-2);
        hx.fillStyle = _grey(146 + (k-1)*70);
        hx.fillRect(0, y+1, S, ph-2);
        // long grain, following the board
        cx.globalAlpha = 0.42;
        for(let i=0;i<6;i++){
          cx.strokeStyle = _shade(base, k*(0.8 + Math.random()*0.34));
          cx.lineWidth = 0.5 + Math.random()*0.9;
          const gy = y + 2 + Math.random()*(ph-4);
          cx.beginPath();
          cx.moveTo(0, gy);
          cx.bezierCurveTo(S*0.33, gy+(Math.random()-0.5)*2.6, S*0.66, gy+(Math.random()-0.5)*2.6, S, gy);
          cx.stroke();
        }
        cx.globalAlpha = 1;
        // a knot, and the butt joint where two boards meet end to end
        if(((r*7)%3)===0){
          const kx = 12 + ((r*53)%(S-24));
          cx.fillStyle = _shade(base, k*0.58);
          cx.beginPath(); cx.ellipse(kx, y+ph*0.5, 2.6, 1.7, 0, 0, Math.PI*2); cx.fill();
          hx.fillStyle = _grey(112);
          hx.beginPath(); hx.ellipse(kx, y+ph*0.5, 2.6, 1.7, 0, 0, Math.PI*2); hx.fill();
        }
        const jx = ((r%2) ? S*0.5 : S*0.18) + (r*11)%9;
        cx.fillStyle = _shade(base, 0.45); cx.fillRect(jx, y+1, 1.4, ph-2);
        hx.fillStyle = _grey(72);          hx.fillRect(jx, y+1, 1.4, ph-2);
      }
    }, opts.name);
  }

  /* ---- leather: armor straps, cloth-adjacent gear, boots ----------------
     Mottled organic blotches (no two patches of hide are quite the same
     shade) plus a scatter of fine creases - the two things a flat colour
     fill can't give a leather surface. Used on the player rig's cloth/skin
     parts (06-player-enemy.js) rather than the structured wall/floor
     surfaces above, so there's no "rows/cols" grid to lay out - just noise
     at a few different scales. */
  function makeLeatherTexture(base, rx, ry, opts){
    opts = opts || {};
    const key = 'leather|'+base+'|'+rx+'|'+ry+'|'+(opts.seed||0);
    return makeSurface(key, 96, rx, ry, opts.bump || 0.05, (cx,hx,S)=>{
      cx.fillStyle = base; cx.fillRect(0,0,S,S);
      // mottled blotches - overlapping soft-edged patches of slightly
      // different shade, the variation leather naturally has hide to hide
      for(let i=0;i<18;i++){
        const x = Math.random()*S, y = Math.random()*S, r = 6 + Math.random()*14;
        const k = 0.82 + Math.random()*0.36;
        const grad = cx.createRadialGradient(x,y,0,x,y,r);
        grad.addColorStop(0, _shade(base, k));
        grad.addColorStop(1, base);
        cx.fillStyle = grad;
        cx.beginPath(); cx.arc(x,y,r,0,Math.PI*2); cx.fill();
        hx.fillStyle = _grey(128 + (k-1)*90);
        hx.beginPath(); hx.arc(x,y,r,0,Math.PI*2); hx.fill();
      }
      // fine creases - short, irregular curved lines, recessed in the bump pass
      for(let i=0;i<14;i++){
        const x0 = Math.random()*S, y0 = Math.random()*S;
        const a = Math.random()*Math.PI*2, len = 6 + Math.random()*16;
        const x1 = x0 + Math.cos(a)*len, y1 = y0 + Math.sin(a)*len;
        const mx = (x0+x1)/2 + (Math.random()-0.5)*6, my = (y0+y1)/2 + (Math.random()-0.5)*6;
        cx.globalAlpha = 0.5;
        cx.strokeStyle = _shade(base, 0.62); cx.lineWidth = 0.6 + Math.random()*0.6;
        cx.beginPath(); cx.moveTo(x0,y0); cx.quadraticCurveTo(mx,my,x1,y1); cx.stroke();
        cx.globalAlpha = 1;
        hx.strokeStyle = _grey(96); hx.lineWidth = 1.0;
        hx.beginPath(); hx.moveTo(x0,y0); hx.quadraticCurveTo(mx,my,x1,y1); hx.stroke();
      }
      // fine grain speckle
      for(let i=0;i<100;i++){
        cx.fillStyle = _shade(base, 0.9 + Math.random()*0.22);
        cx.fillRect(Math.random()*S, Math.random()*S, 1, 1);
      }
    }, opts.name);
  }

  /* 顔をCanvasに描いてUVマッピングする案(2026-08-31、「参考画像のような
     キャラデザを今の方式で再現できるのか」の検証として、球で作る瞳の
     グラデーション・睫毛の描線・頬の赤みをテクスチャに逃がす案)は魔法使い
     で試作し、不採用と判断した。この見下ろしカメラでは頭の正面
     (顔を描く高さ)がほぼ真横から見るグレージング角になり、球のような
     外向きに突き出たジオメトリでない限り、面上に描いた絵は極端に圧縮
     されて視認できない(縞模様のテクスチャを貼って検証済み)。既存の
     球3層アイ(06-player-enemy.js)が機能しているのは、頭の表面そのもの
     ではなく、そこから外側へ張り出した独立した球だからで、この制約は
     テクスチャでは回避できない。よって顔は今まで通り球の組み合わせの
     ままとした。

     追記(2026-09-02、戦騎士のグラフィック刷新): 上記の制約自体を回避する
     「頭の表面に貼らず、常にカメラへ正対する独立した板(ビルボード)に
     顔を描いて頭の手前に浮かせる」案も試作した。技術的には機能した
     (見下ろし視点でも顔が潰れずに読めた)が、ユーザー判断により
     「顔の作り込みは優先しない、兜/帽子/フードでの差別化を優先する」
     という方針転換のため撤去した。makeFaceTexture()自体は削除済み ――
     技術的に不可能だったわけではないので、今後また顔を作り込む方針に
     戻す場合はこのコメントとgit historyから実装を復元できる。 */

  /* ---- metal: armor plate, trim, blades - brushed streaks and old scars -
     A flat metallic colour with metalness turned up reads as plastic, not
     steel - what actually sells "worked metal" is directional brushing and
     a couple of scars catching the light differently from the surrounding
     grain. */
  function makeMetalTexture(base, rx, ry, opts){
    opts = opts || {};
    const key = 'metal|'+base+'|'+rx+'|'+ry+'|'+(opts.seed||0);
    return makeSurface(key, 96, rx, ry, opts.bump || 0.04, (cx,hx,S)=>{
      cx.fillStyle = base; cx.fillRect(0,0,S,S);
      // brushed streaks: thin near-horizontal lines of slightly varying shade
      cx.globalAlpha = 0.5;
      for(let i=0;i<45;i++){
        const y = Math.random()*S;
        cx.strokeStyle = _shade(base, 0.88 + Math.random()*0.28);
        cx.lineWidth = 0.5 + Math.random()*0.7;
        cx.beginPath(); cx.moveTo(0, y); cx.lineTo(S, y + (Math.random()-0.5)*3); cx.stroke();
      }
      cx.globalAlpha = 1;
      // a handful of scratches/scars
      for(let i=0;i<5;i++){
        const x0 = Math.random()*S, y0 = Math.random()*S;
        const a = Math.random()*Math.PI*2, len = 8 + Math.random()*18;
        const x1 = x0+Math.cos(a)*len, y1 = y0+Math.sin(a)*len;
        cx.strokeStyle = _shade(base, 0.55); cx.lineWidth = 0.8;
        cx.beginPath(); cx.moveTo(x0,y0); cx.lineTo(x1,y1); cx.stroke();
        hx.strokeStyle = _grey(190); hx.lineWidth = 1.2;
        hx.beginPath(); hx.moveTo(x0,y0); hx.lineTo(x1,y1); hx.stroke();
      }
      // faint speckled wear
      for(let i=0;i<45;i++){
        cx.fillStyle = _shade(base, 0.85 + Math.random()*0.3);
        cx.fillRect(Math.random()*S, Math.random()*S, 1, 1);
      }
    }, opts.name);
  }

  /* Wires a material's `.map` up with its matching procedural bump map (see
     makeSurface() above), unconditionally - unlike applySurfaceDetail()
     below, which gates this behind the quality setting for the sprawling
     floor/wall surfaces it targets. Character gear textures are tiny by
     comparison, so there's no quality reason to skip the bump here; this
     just saves every call site the trouble of reaching into the same
     internal bumpFor map. No-op (returns mat unchanged) if mat.map isn't a
     tracked procedural surface. */
  function applyBump(mat, scale){
    const rec = mat.map && bumpFor.get(mat.map);
    if(rec){ mat.bumpMap = rec.tex; mat.bumpScale = scale != null ? scale : rec.scale; }
    return mat;
  }

  /* ---- masonry: ashlar blocks, brickwork, tomb walls -------------------
     Rows are laid in running bond. Blocks are drawn from -1 to cols so the
     half-block at each edge completes across the tile seam. */
  function makeMasonryTexture(base, mortar, cols, rows, rx, ry, opts){
    opts = opts || {};
    const key = 'masonry|'+base+'|'+mortar+'|'+cols+'|'+rows+'|'+rx+'|'+ry+'|'+(opts.crack?1:0)+'|'+(opts.moss||'');
    return makeSurface(key, 128, rx, ry, opts.bump || 0.07, (cx,hx,S)=>{
      const bw = S/cols, bh = S/rows, m = Math.max(1.2, bw*0.055);
      cx.fillStyle = mortar; cx.fillRect(0,0,S,S);
      hx.fillStyle = _grey(64); hx.fillRect(0,0,S,S);
      let seed = 1;
      const rnd = ()=>{ seed = (seed*1103515245 + 12345) & 0x7fffffff; return (seed%1000)/1000; };
      for(let r=0;r<rows;r++){
        const off = (r%2) ? bw*0.5 : 0;
        for(let c=-1;c<=cols;c++){
          const x = c*bw + off, y = r*bh;
          const k = 0.82 + rnd()*0.36;
          cx.fillStyle = _shade(base, k);
          cx.fillRect(x+m, y+m, bw-m*2, bh-m*2);
          hx.fillStyle = _grey(150 + (k-1)*60);
          hx.fillRect(x+m, y+m, bw-m*2, bh-m*2);
          // weathering: a darker wash over one corner of some blocks
          if(rnd() < 0.34){
            cx.globalAlpha = 0.16 + rnd()*0.2;
            cx.fillStyle = _shade(base, 0.5);
            cx.fillRect(x+m, y+m, (bw-m*2)*(0.4+rnd()*0.5), (bh-m*2)*(0.5+rnd()*0.5));
            cx.globalAlpha = 1;
          }
          // moss creeping out of the joints and down the face of the block
          if(opts.moss && rnd() < 0.62){
            const mh = (bh-m*2) * (0.2 + rnd()*0.45);
            cx.globalAlpha = 0.3 + rnd()*0.4;
            cx.fillStyle = opts.moss;
            cx.beginPath();
            cx.moveTo(x+m, y+bh-m);
            for(let q=0;q<=5;q++){
              cx.lineTo(x+m + (bw-m*2)*q/5, y+bh-m - mh*(0.35+rnd()*0.9));
            }
            cx.lineTo(x+bw-m, y+bh-m);
            cx.closePath(); cx.fill();
            cx.globalAlpha = 0.22 + rnd()*0.3;
            cx.fillRect(x+m, y+m, bw-m*2, Math.max(1, m*0.9));
            cx.globalAlpha = 1;
          }
          // a chipped edge or a crack across the face
          if(opts.crack && rnd() < 0.22){
            cx.strokeStyle = _shade(base, 0.48);
            cx.lineWidth = 0.9;
            cx.beginPath();
            const cy = y+m+rnd()*(bh-m*2);
            cx.moveTo(x+m, cy);
            cx.lineTo(x+bw*0.5, cy+(rnd()-0.5)*bh*0.4);
            cx.lineTo(x+bw-m, cy+(rnd()-0.5)*bh*0.3);
            cx.stroke();
          }
        }
      }
    }, opts.name);
  }

  /* ---- cobbles: garden paths, courtyards ------------------------------ */
  function makeCobbleTexture(base, grout, cells, rx, ry, opts){
    opts = opts || {};
    const key = 'cobble|'+base+'|'+grout+'|'+cells+'|'+rx+'|'+ry;
    return makeSurface(key, 128, rx, ry, opts.bump || 0.09, (cx,hx,S)=>{
      cx.fillStyle = grout;    cx.fillRect(0,0,S,S);
      hx.fillStyle = _grey(60); hx.fillRect(0,0,S,S);
      const cw = S/cells;
      let seed = 7;
      const rnd = ()=>{ seed = (seed*1103515245 + 12345) & 0x7fffffff; return (seed%1000)/1000; };
      for(let r=-1;r<=cells;r++){
        for(let c=-1;c<=cells;c++){
          const jx = (rnd()-0.5)*cw*0.28, jy = (rnd()-0.5)*cw*0.28;
          const x = c*cw + cw*0.5 + jx + ((r%2)?cw*0.5:0);
          const y = r*cw + cw*0.5 + jy;
          const rad = cw*(0.34 + rnd()*0.12);
          const k = 0.78 + rnd()*0.44;
          // draw the stone, and again shifted by a tile so it wraps cleanly
          for(const dx of [0,-S,S]) for(const dy of [0,-S,S]){
            if(Math.abs(x+dx-S/2) > S*0.75 || Math.abs(y+dy-S/2) > S*0.75) continue;
            cx.fillStyle = _shade(base, k);
            cx.beginPath(); cx.ellipse(x+dx, y+dy, rad, rad*(0.82+rnd()*0.3), rnd()*3, 0, Math.PI*2); cx.fill();
            hx.fillStyle = _grey(158 + (k-1)*54);
            hx.beginPath(); hx.ellipse(x+dx, y+dy, rad*0.94, rad*0.8, 0, 0, Math.PI*2); hx.fill();
          }
        }
      }
    }, opts.name);
  }

  /* ---- wallpaper / panelling: interiors that aren't stone -------------- */
  function makeWallpaperTexture(base, stripe, bands, rx, ry, opts){
    opts = opts || {};
    const key = 'paper|'+base+'|'+stripe+'|'+bands+'|'+rx+'|'+ry;
    return makeSurface(key, 128, rx, ry, opts.bump || 0.02, (cx,hx,S)=>{
      cx.fillStyle = base; cx.fillRect(0,0,S,S);
      const bwid = S/bands;
      for(let i=0;i<bands;i++){
        cx.globalAlpha = 0.5;
        cx.fillStyle = stripe;
        cx.fillRect(i*bwid, 0, bwid*0.34, S);
        cx.globalAlpha = 0.22;
        cx.fillStyle = stripe;
        cx.fillRect(i*bwid + bwid*0.55, 0, bwid*0.1, S);
        cx.globalAlpha = 1;
        hx.fillStyle = _grey(140);
        hx.fillRect(i*bwid, 0, bwid*0.34, S);
      }
      // damp staining, so it reads as an old house rather than a showroom
      for(let i=0;i<26;i++){
        cx.globalAlpha = 0.05 + Math.random()*0.09;
        cx.fillStyle = '#241a14';
        const w = 8+Math.random()*34, h = 10+Math.random()*44;
        cx.beginPath();
        cx.ellipse(Math.random()*S, Math.random()*S, w*0.5, h*0.5, 0, 0, Math.PI*2);
        cx.fill();
      }
      cx.globalAlpha = 1;
    }, opts.name);
  }



  /* ---- dressed stone tiling: a grout grid with an inset motif in some
     squares, the way a temple or a keep's hall is laid -------------------- */
  function makeStoneTileTexture(base, grout, accent, tiles, rx, ry, opts){
    opts = opts || {};
    const key = 'stonetile|'+base+'|'+grout+'|'+accent+'|'+tiles+'|'+rx+'|'+ry;
    return makeSurface(key, 128, rx, ry, opts.bump || 0.06, (cx,hx,S)=>{
      const tw = S/tiles, g = Math.max(1.4, tw*0.06);
      cx.fillStyle = grout;    cx.fillRect(0,0,S,S);
      hx.fillStyle = _grey(62); hx.fillRect(0,0,S,S);
      let seed = 19;
      const rnd = ()=>{ seed = (seed*1103515245 + 12345) & 0x7fffffff; return (seed%1000)/1000; };
      for(let r=0;r<tiles;r++){
        for(let q=0;q<tiles;q++){
          const x = q*tw, y = r*tw, k = 0.85 + rnd()*0.3;
          cx.fillStyle = _shade(base, k);
          cx.fillRect(x+g, y+g, tw-g*2, tw-g*2);
          hx.fillStyle = _grey(152 + (k-1)*56);
          hx.fillRect(x+g, y+g, tw-g*2, tw-g*2);
          // a lit edge along the top and left, so each slab reads as raised
          cx.globalAlpha = 0.13;
          cx.fillStyle = '#ffffff';
          cx.fillRect(x+g, y+g, tw-g*2, 1.4);
          cx.fillRect(x+g, y+g, 1.4, tw-g*2);
          cx.globalAlpha = 0.14;
          cx.fillStyle = '#000000';
          cx.fillRect(x+g, y+tw-g-1.4, tw-g*2, 1.4);
          cx.globalAlpha = 1;
          // the inset: a smaller square turned 45 degrees, on some slabs only
          if(rnd() < 0.34){
            const cxp = x+tw/2, cyp = y+tw/2, rad = tw*0.19;
            cx.fillStyle = accent;
            cx.globalAlpha = 0.8;
            cx.beginPath();
            cx.moveTo(cxp, cyp-rad); cx.lineTo(cxp+rad, cyp);
            cx.lineTo(cxp, cyp+rad); cx.lineTo(cxp-rad, cyp);
            cx.closePath(); cx.fill();
            cx.globalAlpha = 1;
            hx.fillStyle = _grey(184);
            hx.beginPath();
            hx.moveTo(cxp, cyp-rad); hx.lineTo(cxp+rad, cyp);
            hx.lineTo(cxp, cyp+rad); hx.lineTo(cxp-rad, cyp);
            hx.closePath(); hx.fill();
          }
          // wear pooling towards one corner
          if(rnd() < 0.45){
            cx.globalAlpha = 0.06 + rnd()*0.12;
            cx.fillStyle = '#100c08';
            cx.beginPath();
            cx.ellipse(x+tw*rnd(), y+tw*rnd(), tw*0.3, tw*0.26, 0, 0, Math.PI*2);
            cx.fill();
            cx.globalAlpha = 1;
          }
        }
      }
    }, opts.name);
  }

  /* ---- turf: the forest floor, which is the first surface anyone sees --- */
  function makeGrassTexture(base, tints, rx, ry){
    const key = 'grass|'+base+'|'+tints.join(',')+'|'+rx+'|'+ry;
    return makeSurface(key, 128, rx, ry, 0.035, (cx,hx,S)=>{
      cx.fillStyle = base;      cx.fillRect(0,0,S,S);
      hx.fillStyle = _grey(120); hx.fillRect(0,0,S,S);
      // broad patches first, so the turf isn't uniform at a distance
      for(let i=0;i<14;i++){
        cx.globalAlpha = 0.16 + Math.random()*0.2;
        cx.fillStyle = tints[Math.floor(Math.random()*tints.length)];
        cx.beginPath();
        cx.ellipse(Math.random()*S, Math.random()*S, 12+Math.random()*26, 10+Math.random()*22, Math.random()*3, 0, Math.PI*2);
        cx.fill();
      }
      cx.globalAlpha = 1;
      // then individual blades, leaning at random
      for(let i=0;i<900;i++){
        const x = Math.random()*S, y = Math.random()*S;
        const len = 2 + Math.random()*4.5, lean = (Math.random()-0.5)*2.2;
        cx.strokeStyle = tints[Math.floor(Math.random()*tints.length)];
        cx.globalAlpha = 0.35 + Math.random()*0.5;
        cx.lineWidth = 0.7 + Math.random()*0.7;
        cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x+lean, y-len); cx.stroke();
        hx.strokeStyle = _grey(Math.random()<0.5 ? 96 : 168);
        hx.globalAlpha = 0.4;
        hx.lineWidth = 1;
        hx.beginPath(); hx.moveTo(x, y); hx.lineTo(x+lean, y-len); hx.stroke();
      }
      cx.globalAlpha = 1; hx.globalAlpha = 1;
      // scattered soil and small stones showing through
      for(let i=0;i<40;i++){
        cx.globalAlpha = 0.18 + Math.random()*0.25;
        cx.fillStyle = Math.random()<0.6 ? '#3a3226' : '#6a6458';
        const r = 0.8 + Math.random()*2.2;
        cx.beginPath(); cx.arc(Math.random()*S, Math.random()*S, r, 0, Math.PI*2); cx.fill();
      }
      cx.globalAlpha = 1;
    });
  }

  /* Cached once per renderer, since capabilities.getMaxAnisotropy() is a
     GPU query. Exported as getMaxAnisotropy() rather than left as a bare
     module-private variable: 05-rendering-rig.js's dot-mode filtering
     needs the same value, and reaching for a name like `_maxAniso` that
     lives only in this module's closure is exactly the class of bug
     ARCHITECTURE.md documents (applySurfaceDetail's old renderer/qualityIdx
     ReferenceError) - a legacy/parts/ file can't see another module's
     private state just because it used to all be one shared scope. */
  let _maxAniso = 0;
  function getMaxAnisotropy(renderer){
    if(!_maxAniso && renderer) _maxAniso = renderer.capabilities.getMaxAnisotropy() || 1;
    return _maxAniso || 1;
  }

  /* Walks freshly built world objects and upgrades every textured standard
     material in place: anisotropic filtering so floors stay sharp at a
     grazing angle, plus the height field that matches its colour map.
     `renderer` and the "軽量にはバンプを付けない" default both live outside
     this module (renderer/quality setting belong to the world/settings
     code), so the caller passes them in rather than this module reaching
     for globals it doesn't have. */
  function applySurfaceDetail(objs, wantBump, renderer){
    const maxAniso = getMaxAnisotropy(renderer);
    const done = new Set();
    objs.forEach(root => root.traverse && root.traverse(n=>{
      if(!n.isMesh || !n.material) return;
      const mats = Array.isArray(n.material) ? n.material : [n.material];
      mats.forEach(m=>{
        if(!m || done.has(m) || !m.map) return;
        done.add(m);
        m.map.anisotropy = Math.min(4, maxAniso);
        m.map.needsUpdate = true;
        if(!m.isMeshStandardMaterial) return;
        const rec = bumpFor.get(m.map);
        if(!rec) return;
        const b = rec.tex;
        if(wantBump){
          if(m.bumpMap === b) return;
          b.repeat.copy(m.map.repeat);
          b.offset.copy(m.map.offset);
          b.needsUpdate = true;
          m.bumpMap = b;
          m.bumpScale = rec.scale || 0.04;
          m.needsUpdate = true;
        } else if(m.bumpMap){
          m.bumpMap = null;
          m.needsUpdate = true;
        }
      });
    }));
  }

  // small procedural speckle texture so grass/floors read as having
  // texture instead of a single flat color
  const noiseTextureCache = new Map();
  function makeNoiseTexture(baseColor, speckleColors, repeatX, repeatY){
    const cacheKey = baseColor+'|'+speckleColors.join(',')+'|'+repeatX+'|'+repeatY;
    if(noiseTextureCache.has(cacheKey)) return noiseTextureCache.get(cacheKey);
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    // matching height field, so even the plain speckled surfaces get grain
    const hcan = document.createElement('canvas');
    hcan.width = size; hcan.height = size;
    const hctx = hcan.getContext('2d');
    ctx.fillStyle = baseColor;
    ctx.fillRect(0,0,size,size);
    hctx.fillStyle = _grey(128);
    hctx.fillRect(0,0,size,size);
    for(let i=0;i<size*size*0.09;i++){
      const x = Math.random()*size, y = Math.random()*size;
      const a = 0.12 + Math.random()*0.28;
      ctx.globalAlpha = a;
      ctx.fillStyle = speckleColors[Math.floor(Math.random()*speckleColors.length)];
      const s = 1 + Math.random()*3.2;
      ctx.fillRect(x, y, s, s);
      hctx.globalAlpha = a*0.8;
      hctx.fillStyle = _grey(Math.random() < 0.5 ? 92 : 176);
      hctx.fillRect(x, y, s, s);
    }
    ctx.globalAlpha = 1; hctx.globalAlpha = 1;
    const tex = _tex(canvas, repeatX, repeatY);
    const bump = _tex(hcan, repeatX, repeatY);
    bumpFor.set(tex, {tex:bump, scale:0.03});
    noiseTextureCache.set(cacheKey, tex);
    return tex;
  }

  // a coarse tile pattern - grid lines with a slight per-tile shade
  // variation, for bathroom/restroom-style flooring
  function makeTileTexture(baseColor, groutColor, tilesPerSide){
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const hcan = document.createElement('canvas');
    hcan.width = size; hcan.height = size;
    const hctx = hcan.getContext('2d');
    ctx.fillStyle = groutColor;
    ctx.fillRect(0,0,size,size);
    hctx.fillStyle = _grey(66);
    hctx.fillRect(0,0,size,size);
    const tileSize = size/tilesPerSide;
    const gap = Math.max(1.5, tileSize*0.07);
    for(let ty=0; ty<tilesPerSide; ty++){
      for(let tx=0; tx<tilesPerSide; tx++){
        const shade = 0.88 + Math.random()*0.24;
        ctx.fillStyle = baseColor;
        ctx.globalAlpha = shade;
        ctx.fillRect(tx*tileSize+gap, ty*tileSize+gap, tileSize-gap*2, tileSize-gap*2);
        ctx.globalAlpha = 1;
        hctx.fillStyle = _grey(150 + (shade-1)*70);
        hctx.fillRect(tx*tileSize+gap, ty*tileSize+gap, tileSize-gap*2, tileSize-gap*2);
        // a soft sheen along the top-left edge of each tile
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(tx*tileSize+gap, ty*tileSize+gap, tileSize-gap*2, 1.5);
        ctx.globalAlpha = 1;
        // grime settling into the corners
        if(Math.random() < 0.45){
          ctx.globalAlpha = 0.06 + Math.random()*0.12;
          ctx.fillStyle = '#141008';
          ctx.beginPath();
          ctx.ellipse(tx*tileSize + tileSize*Math.random(), ty*tileSize + tileSize*Math.random(),
                      tileSize*0.3, tileSize*0.24, 0, 0, Math.PI*2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
    const tex = _tex(canvas, 1, 1);
    const bump = _tex(hcan, 1, 1);
    bumpFor.set(tex, {tex:bump, scale:0.05});
    return tex;
  }

export { makePlankTexture, makeMasonryTexture, makeCobbleTexture, makeWallpaperTexture, makeStoneTileTexture, makeGrassTexture, applySurfaceDetail, makeNoiseTexture, makeTileTexture, getMaxAnisotropy, makeLeatherTexture, makeMetalTexture, applyBump };
