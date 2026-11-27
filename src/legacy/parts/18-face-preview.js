  /* =========================================================
     顔の確認のプレビュー(CHARACTER-VIS-002 T-2R-2 / DEC-038。?dev=1 の時だけ)
     T-2R-3 以降の顔の立体の変更を、Human が iPhone で正確な角度から確かめるための画面。
       ・8 職(4 基礎職 + 4 上位職)を切り替える
       ・正面 / 斜め45° / 横 / 下から / 後頭部 の 5 方向。ドラッグで左右に回せる(方向のボタンで正確な角度に戻る)
       ・顔の拡大 / 全身
       ・診断: 頭を赤・髪の殻を緑(頭と髪の貫通を見る)、帽子・フードを隠す。武器は既定で隠す(顔の前に来るため)
     ゲームのシーン・プレイヤー・カメラには触れない: 自分のシーンとレンダラーを持ち、確認用の姿は
     buildPlayer()(本物の組み立て)で作る。buildPlayer / applyJobPromotionVisual が書く共有変数
     (playerMixerParts・player・state.job・state.classDef)は組み立ての間だけ差し替えて必ず戻し、
     ゲームのシーンへ足された部品は確認用のシーンへ移す。影の旅人は対象外(8 職に含めない)。
     本番の URL では入口も出さない(DEV_UI)。 */
  const FACE_PREVIEW_VIEWS = [
    // yaw: 姿の正面(+Z)からの角度、elev: 見上げ / 見下ろし(度、負 = 下から)
    { key:'front', label:'正面',  yaw:0,   elev:4 },
    { key:'q45',   label:'45°',   yaw:45,  elev:4 },
    { key:'side',  label:'横',    yaw:90,  elev:2 },
    { key:'below', label:'下から', yaw:20,  elev:-32 },
    { key:'back',  label:'後頭部', yaw:180, elev:8 },
  ];
  const FACE_PREVIEW_CLASSES = ['warrior', 'mage', 'archer', 'rogue'];
  let facePreview = null;   // 開いている間だけ { overlay, renderer, scene, camera, fig, ... }

  function facePreviewJobs(){
    const list = [];
    FACE_PREVIEW_CLASSES.forEach(key=>{
      const c = CLASSES[key];
      if(!c) return;
      list.push({ id:key, classKey:key, job:null, label:c.name });
      const uj = upperJobFor(key);
      if(uj) list.push({ id:uj.key, classKey:key, job:uj.key, label:uj.name });
    });
    return list;
  }
  function facePreviewGender(classKey){
    const cast = CHAPTER_CAST.find(c => c && c.classKey === classKey);
    return cast ? cast.gender : 'male';
  }

  /* 確認用の姿を本物の組み立てで作る。共有変数は必ず戻す */
  function buildFacePreviewFigure(entry, previewScene){
    const saved = { parts: playerMixerParts, player, job: state.job, classDef: state.classDef };
    const before = new Set(scene.children);
    let group = null, parts = null;
    try{
      playerMixerParts = {};
      const cd = Object.assign({}, CLASSES[entry.classKey]);
      state.classDef = cd;
      state.job = entry.job;
      group = buildPlayer(cd, facePreviewGender(entry.classKey));
      player = group;
      if(entry.job) applyJobPromotionVisual();
      parts = playerMixerParts;
    } finally {
      playerMixerParts = saved.parts;
      player = saved.player;
      state.job = saved.job;
      state.classDef = saved.classDef;
    }
    // ゲームのシーンへ足された部品(姿そのもの・上位職のオーラ等)を確認用のシーンへ移す
    scene.children.filter(o => !before.has(o)).forEach(o=>{ scene.remove(o); previewScene.add(o); });
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    // X 線シェル(壁越しの表示用)は確認用のシーンでは使わない
    group.traverse(n=>{ if(n.userData && n.userData.isXray) n.visible = false; });
    group.updateMatrixWorld(true);
    return { group, parts, extras: previewScene.children.filter(o => o !== group && o.userData.facePreviewFixed !== true) };
  }
  function disposeFacePreviewFigure(fp){
    if(!fp.fig) return;
    const { group, parts, extras } = fp.fig;
    [group, ...extras].forEach(o=>{
      if(o.parent) o.parent.remove(o);
      disposePlayerPartTree(o, parts);
    });
    fp.fig = null;
    fp.diagMats = null;
  }

  /* 診断の表示: 頭 = 赤、髪の殻 = 緑。帽子・フード(頭のピボットの子で、頭・髪・目以外)を隠す */
  function applyFacePreviewDiag(fp){
    if(!fp.fig) return;
    const P = fp.fig.parts, hg = P.headGroupParts || [];
    const head = hg[0], hair = hg[1];
    if(!fp.diagMats){
      fp.diagMats = new Map();
      [head, hair].forEach(m=>{ if(m) fp.diagMats.set(m, m.material); });
      fp.diagRed = new THREE.MeshBasicMaterial({ color:0xff2020 });
      fp.diagGreen = new THREE.MeshBasicMaterial({ color:0x20d040 });
    }
    const on = fp.diag !== 'off';
    if(head) head.material = on ? fp.diagRed : fp.diagMats.get(head);
    if(hair) hair.material = on ? fp.diagGreen : fp.diagMats.get(hair);
    const pivot = P.headLookPivot;
    if(pivot){
      const keepSet = new Set([...hg]);
      pivot.children.forEach(c=>{
        if(keepSet.has(c) || c.userData.isOutline || c.userData.isXray) return;
        if(c.userData.facePreviewVisible == null) c.userData.facePreviewVisible = c.visible;
        c.visible = fp.diag === 'nohat' ? false : c.userData.facePreviewVisible;
      });
    }
  }

  function facePreviewTarget(fp){
    const P = fp.fig.parts, B = P.build || BUILD.warrior;
    const head = (P.headGroupParts || [])[0];
    if(fp.zoom === 'face' && head){
      const p = new THREE.Vector3();
      head.getWorldPosition(p);
      // 頭の高さ(2 × headR)が画面の縦の 約 40%
      return { target:p, dist: B.headR * 2 / 0.40 / (2*Math.tan(THREE.MathUtils.degToRad(fp.camera.fov/2))) };
    }
    const h = B.stature || 2.5;
    return { target:new THREE.Vector3(0, h*0.5, 0), dist: h * 1.15 / (2*Math.tan(THREE.MathUtils.degToRad(fp.camera.fov/2))) };
  }
  function placeFacePreviewCamera(fp){
    if(!fp.fig) return;
    const v = FACE_PREVIEW_VIEWS.find(x => x.key === fp.view) || FACE_PREVIEW_VIEWS[0];
    const { target, dist } = facePreviewTarget(fp);
    const yaw = THREE.MathUtils.degToRad(v.yaw + fp.yawOffset), elev = THREE.MathUtils.degToRad(v.elev);
    fp.camera.position.set(
      target.x + Math.sin(yaw)*Math.cos(elev)*dist,
      target.y + Math.sin(elev)*dist,
      target.z + Math.cos(yaw)*Math.cos(elev)*dist);
    fp.camera.lookAt(target);
    fp.label.textContent = `${fp.entry.label} / ${v.label}${fp.yawOffset ? ` ${fp.yawOffset > 0 ? '+' : ''}${Math.round(fp.yawOffset)}°` : ''}`
      + ` / ${fp.zoom === 'face' ? '顔' : '全身'}${fp.diag === 'off' ? '' : fp.diag === 'nohat' ? ' / 診断(帽子なし)' : ' / 診断'}`;
  }
  function setFacePreviewEntry(fp, entry){
    disposeFacePreviewFigure(fp);
    fp.entry = entry;
    fp.fig = buildFacePreviewFigure(entry, fp.scene);
    applyFacePreviewDiag(fp);
    applyFacePreviewWeapon(fp);
    placeFacePreviewCamera(fp);
    fp.root.querySelectorAll('[data-fp-job]').forEach(b => b.classList.toggle('selected', b.dataset.fpJob === entry.id));
  }
  function resizeFacePreview(fp){
    const w = fp.stage.clientWidth || window.innerWidth, h = fp.stage.clientHeight || 300;
    fp.renderer.setSize(w, h, false);
    fp.camera.aspect = w / h;
    fp.camera.updateProjectionMatrix();
    placeFacePreviewCamera(fp);
  }

  function openFacePreview(){
    if(!DEV_UI || facePreview) return;
    const root = document.createElement('div');
    root.id = 'face-preview';
    root.innerHTML = `
      <div class="fp-head"><span class="fp-label"></span><button type="button" class="fp-btn fp-close" data-fp-close>閉じる</button></div>
      <div class="fp-stage"></div>
      <div class="fp-controls">
        <div class="fp-row fp-jobs"></div>
        <div class="fp-row fp-views"></div>
        <div class="fp-row">
          <button type="button" class="fp-btn" data-fp-zoom="face">顔</button>
          <button type="button" class="fp-btn" data-fp-zoom="body">全身</button>
          <button type="button" class="fp-btn" data-fp-diag="off">通常</button>
          <button type="button" class="fp-btn" data-fp-diag="on">頭赤・髪緑</button>
          <button type="button" class="fp-btn" data-fp-diag="nohat">＋帽子なし</button>
          <button type="button" class="fp-btn" data-fp-weapon>武器</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    const stage = root.querySelector('.fp-stage');
    const renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;      // ゲームのレンダラーと同じ色の扱い(02-world-common.js)
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    stage.appendChild(renderer.domElement);
    const pscene = new THREE.Scene();
    pscene.background = new THREE.Color(0x30353f);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x404858, 1.3);
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2.5, 5, 4);
    const rim = new THREE.DirectionalLight(0xbfd0ff, 0.6);
    rim.position.set(-3, 3, -4);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.4, 32), new THREE.MeshBasicMaterial({ color:0x262a32 }));
    floor.rotation.x = -Math.PI/2;
    [hemi, key, rim, floor].forEach(o=>{ o.userData.facePreviewFixed = true; pscene.add(o); });
    const fp = facePreview = {
      root, stage, renderer, scene:pscene, camera:new THREE.PerspectiveCamera(30, 1, 0.02, 100),
      label: root.querySelector('.fp-label'), fig:null, entry:null,
      view:'front', zoom:'face', diag:'off', weapon:false, yawOffset:0, raf:0, drag:null,
    };
    const jobs = facePreviewJobs();
    const jobRow = root.querySelector('.fp-jobs'), viewRow = root.querySelector('.fp-views');
    jobs.forEach(j=>{
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'fp-btn'; b.dataset.fpJob = j.id; b.textContent = j.label;
      b.addEventListener('click', ()=> setFacePreviewEntry(fp, j));
      jobRow.appendChild(b);
    });
    FACE_PREVIEW_VIEWS.forEach(v=>{
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'fp-btn'; b.dataset.fpView = v.key; b.textContent = v.label;
      b.addEventListener('click', ()=>{ fp.view = v.key; fp.yawOffset = 0; refreshFacePreviewButtons(fp); placeFacePreviewCamera(fp); });
      viewRow.appendChild(b);
    });
    root.querySelectorAll('[data-fp-zoom]').forEach(b => b.addEventListener('click', ()=>{
      fp.zoom = b.dataset.fpZoom; refreshFacePreviewButtons(fp); placeFacePreviewCamera(fp);
    }));
    root.querySelectorAll('[data-fp-diag]').forEach(b => b.addEventListener('click', ()=>{
      fp.diag = b.dataset.fpDiag; refreshFacePreviewButtons(fp); applyFacePreviewDiag(fp); placeFacePreviewCamera(fp);
    }));
    root.querySelector('[data-fp-weapon]').addEventListener('click', ()=>{
      fp.weapon = !fp.weapon; refreshFacePreviewButtons(fp); applyFacePreviewWeapon(fp);
    });
    root.querySelector('[data-fp-close]').addEventListener('click', closeFacePreview);
    // ドラッグで左右に回す(方向のボタンで 0 に戻る)
    const cv = renderer.domElement;
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', e=>{ fp.drag = { x:e.clientX, base:fp.yawOffset }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', e=>{
      if(!fp.drag) return;
      fp.yawOffset = Math.max(-180, Math.min(180, fp.drag.base - (e.clientX - fp.drag.x) * 0.5));
      placeFacePreviewCamera(fp);
    });
    const endDrag = ()=>{ fp.drag = null; };
    cv.addEventListener('pointerup', endDrag);
    cv.addEventListener('pointercancel', endDrag);
    fp.onResize = ()=> resizeFacePreview(fp);
    window.addEventListener('resize', fp.onResize);
    refreshFacePreviewButtons(fp);
    setFacePreviewEntry(fp, jobs[0]);
    resizeFacePreview(fp);
    const loop = ()=>{
      if(facePreview !== fp) return;
      fp.renderer.render(fp.scene, fp.camera);
      fp.raf = requestAnimationFrame(loop);
    };
    loop();
    window.__facePreview = fp;   // E2E 用の参照(?dev=1 の時だけ)
  }
  function refreshFacePreviewButtons(fp){
    fp.root.querySelectorAll('[data-fp-view]').forEach(b => b.classList.toggle('selected', b.dataset.fpView === fp.view));
    fp.root.querySelectorAll('[data-fp-zoom]').forEach(b => b.classList.toggle('selected', b.dataset.fpZoom === fp.zoom));
    fp.root.querySelectorAll('[data-fp-diag]').forEach(b => b.classList.toggle('selected', b.dataset.fpDiag === fp.diag));
    fp.root.querySelector('[data-fp-weapon]').classList.toggle('selected', fp.weapon);
  }
  /* 武器: 既定は隠す(待機の姿では剣・杖・弓が顔の前に来るため)。「武器」で出す */
  function applyFacePreviewWeapon(fp){
    if(!fp.fig) return;
    const P = fp.fig.parts;
    [P.weapon, P.offhandWeapon].forEach(w=>{ if(w) w.visible = fp.weapon; });
  }
  function closeFacePreview(){
    const fp = facePreview;
    if(!fp) return;
    facePreview = null;
    cancelAnimationFrame(fp.raf);
    window.removeEventListener('resize', fp.onResize);
    disposeFacePreviewFigure(fp);
    if(fp.diagRed) fp.diagRed.dispose();
    if(fp.diagGreen) fp.diagGreen.dispose();
    fp.renderer.dispose();
    try{ fp.renderer.forceContextLoss(); }catch(e){}
    fp.root.remove();
    delete window.__facePreview;
  }

  /* 入口(?dev=1 の時だけ出す): タイトルのテストモードの入口の下と、設定タブの行 */
  function bindFacePreviewEntry(){
    if(!DEV_UI) return;
    const titleBtn = document.getElementById('open-face-preview-btn');
    if(titleBtn) titleBtn.addEventListener('click', ()=>{ sfx('ui'); openFacePreview(); });
    const row = document.getElementById('set-face-preview-row'), btn = document.getElementById('set-face-preview');
    if(row && btn){
      row.style.display = '';
      btn.addEventListener('click', ()=>{ sfx('ui'); openFacePreview(); });
    }
  }
  bindFacePreviewEntry();
