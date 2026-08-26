// メインループ・移動・カメラ演出
// (13-update-loop.js - concatenated with the other src/legacy/parts/*.js files
// into one shared scope at build time; see src/legacy/concat-plugin.js)

     UPDATE LOOP
  ========================================================= */
  function updateInput(dt){
    let ix=0, iy=0;
    if(keys['KeyW']||keys['ArrowUp']) iy -= 1;
    if(keys['KeyS']||keys['ArrowDown']) iy += 1;
    if(keys['KeyA']||keys['ArrowLeft']) ix -= 1;
    if(keys['KeyD']||keys['ArrowRight']) ix += 1;

    // small deadzone so the virtual stick doesn't drift at rest
    const tmMag = Math.sqrt(touchMove.x*touchMove.x + touchMove.y*touchMove.y);
    if(tmMag > 0.18){ ix += touchMove.x; iy += touchMove.y; }

    // camera rotation: keyboard Q/E, touch buttons, gamepad right stick
    let camRot = 0;
    if(keys['KeyQ']) camRot -= 1;
    if(keys['KeyE']) camRot += 1;
    camRot += state.camRotateTouch || 0;

    const gp = pollGamepad();
    if(gp){
      const ax0 = gp.axes[0]||0, ax1 = gp.axes[1]||0;
      if(Math.abs(ax0)>0.15) ix += ax0;
      if(Math.abs(ax1)>0.15) iy += ax1;
      const rx = gp.axes[2]||0;
      if(Math.abs(rx)>0.15) camRot += rx;

      if(btnPressed(gp,0)) tryJump();      // A / Cross
      const atkNow = !!(gp.buttons[2] && gp.buttons[2].pressed);
      const atkWas = !!gpPrev[2];
      if(atkNow && !atkWas) attackInputDown();
      if(!atkNow && atkWas) attackInputUp();
      gpPrev[2] = atkNow;    // X / Square (tap = attack, hold = charge)
      const skillNow = !!(gp.buttons[3] && gp.buttons[3].pressed);
      const skillWas = !!gpPrev[3];
      if(skillNow && !skillWas) skillInputDown();
      if(!skillNow && skillWas) skillInputUp();
      gpPrev[3] = skillNow;  // Y / Triangle (skill button)
      if(btnPressed(gp,1)) tryDodge();     // B / Circle
      if(btnPressed(gp,7)) tryUltimate();   // R2 / RT (ultimate)
      if(btnReleased(gp,7)) releaseUltimate();
      if(btnPressed(gp,6)) castSkill2();   // L2 / LT (skill 2)
      if(btnPressed(gp,4)) interact();     // L1 / LB
      if(btnPressed(gp,5)) usePotion();    // R1 / RB
      if(btnPressed(gp,9) || btnPressed(gp,8)) toggleMenu(); // Start/Select
      if(btnPressed(gp,12)) toggleScenarioSelect(); // D-pad up
      if(btnPressed(gp,13)) toggleAppraisal();      // D-pad down
    }
    updateChargeHold(dt);
    updateMageOrbs(dt);
    updatePlatforms(dt);
    if(Math.abs(camRot)>0.01){ state.camYaw += camRot * 1.9 * dt; }

    ix = Math.max(-1,Math.min(1,ix));
    iy = Math.max(-1,Math.min(1,iy));
    state.moveInput.x = ix;
    state.moveInput.y = iy;
  }

  // the attack button now does double duty: a quick tap fires a normal
  // attack, holding it past a short threshold charges the selected skill
  const ATTACK_TAP_THRESHOLD = 0.5; // grace period before a hold counts as charging
  let attackHeldStart = null;

  function attackInputDown(){
    resumeAudio();
    if(!state.started||state.paused||state.dialogueActive||state.dodging||state.paralyzed) return;
    if(attackHeldStart!=null) return; // already held (e.g. key auto-repeat)
    if(state.chargeCD>0) return; // recast keeps the movement technique from being spammed
    if(state.skillCharging || skillHeldStart!=null) return; // can't attack while a skill is in progress
    attackHeldStart = performance.now();
    // state.charging stays false until updateChargeHold confirms the grace
    // period has passed - this is what keeps a normal quick attack from
    // flashing the charge-ring visual
  }

  function attackInputUp(){
    if(attackHeldStart==null) return;
    attackHeldStart = null;
    const wasCharging = state.charging;
    state.charging = false;
    if(!wasCharging){
      state.chargeT = 0;
      tryAttack(); // released before the grace period elapsed: normal attack
    } else {
      releaseChargeAttack(); // held past the grace period: release the charged skill
      state.chargeT = 0;
      state.chargeCD = 0.7;
    }
  }

  function updateChargeHold(dt){
    if(state.chargeCD>0) state.chargeCD -= dt;
    if(state.skillCD>0) state.skillCD -= dt;
    if(state.skill2CD>0) state.skill2CD -= dt;
    if(state.paused || state.dialogueActive || state.dodging){
      if(state.charging){ state.charging=false; state.chargeT=0; }
      if(state.skillCharging){ state.skillCharging=false; state.skillChargeT=0; }
      attackHeldStart = null; skillHeldStart = null;
      return;
    }
    if(attackHeldStart!=null){
      const heldSec = (performance.now()-attackHeldStart)/1000;
      if(!state.charging && heldSec >= ATTACK_TAP_THRESHOLD){
        state.charging = true; // grace period passed - now visibly charging
      }
    }
    if(state.charging){
      state.chargeT = Math.min(state.chargeMax, state.chargeT + dt);
    }
    if(state.skillCharging){
      state.skillChargeT = Math.min(state.skillChargeMax, state.skillChargeT + dt);
    }
  }

  // dedicated skill button: press to ready, release to unleash - unlike the
  // attack button there's no tap/hold ambiguity to resolve, so charging
  // starts immediately on press
  let skillHeldStart = null;

  function skillInputDown(){
    if(!state.started||state.paused||state.dialogueActive||state.dodging||state.paralyzed) return;
    if(skillHeldStart!=null) return;
    if(state.skillCD>0) return; // longer recast keeps skills from being spammed faster than a normal attack
    if(state.swinging || state.charging || attackHeldStart!=null) return; // can't use a skill mid-attack
    if(!hasRes('skill')){ warnNoRes(); return; }
    spendRes('skill');
    skillHeldStart = performance.now();
    state.skillCharging = true;
    state.skillChargeT = 0;
  }

  function skillInputUp(){
    if(skillHeldStart==null) return;
    skillHeldStart = null;
    state.skillCharging = false;
    releaseSkill();
    state.skillChargeT = 0;
    state.skillCD = 1.6 * rankCD('skill');
  }

  // charge technique (attack-button hold): fixed per class, not swappable
  function releaseChargeAttack(){
    const variant = getChargeVariants().dash;
    executeVariant(variant, state.chargeT, state.chargeMax);
  }

  // skill (dedicated skill button): swappable between the class's other
  // two techniques via the appraisal screen
  function releaseSkill(){
    const variant = getChargeVariants()[state.skillChoice] || getChargeVariants().retreat;
    executeVariant(variant, state.skillChargeT, state.skillChargeMax, 'skill');
  }

  function executeVariant(variant, chargeT, chargeMax, rankKey){
    const chargeRatio = Math.min(1, chargeT / chargeMax);
    const skillBonus = 1 + (state.skills.chargeUp||0)*0.15;
    const rankBonus = rankKey ? rankDmg(rankKey) : 1;
    const mult = (variant.baseMult + chargeRatio*(variant.maxMult-variant.baseMult)) * skillBonus * rankBonus;
    const dmg = Math.round(state.classDef.atk * mult) + Math.round(Math.random()*5);
    const fwd = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));

    state.swinging = true;
    beginMove(variant.key || 'basic');
    if(sequenceLocks.length) tryStrikeBell(state.pos); // was missing entirely - the charge/skill techniques never played the arm swing before this
    state.swingLockFacing = state.facing;
    if(variant.movement){
      state.skillAnim = {type:variant.movement, t:0, duration:variant.duration||0.3, fwd:fwd.clone(), dist:variant.dist||0};
    }

    if(variant.mode==='single'){
      const target = findMeleeTarget(state.classDef.meleeRange||2.6, state.classDef.meleeAngle||Math.PI/2.1) || findRangedTargetInLine(fwd, 9, 1.4);
      spawnMeleeSwingVFX((state.classDef.meleeRange||2.6)*1.15, state.classDef.meleeAngle||Math.PI/2.1, variant.vfxColor);
      if(target) dealDamageToEnemy(target, dmg, false);
      checkMimicRevealInRange(state.classDef.meleeRange||2.6, state.classDef.meleeAngle||Math.PI/2.1, dmg);
    } else if(variant.mode==='aoe'){
      spawnUltimateVFX(state.pos.clone(), {radius:variant.radius, vfxColor:variant.vfxColor});
      enemies.forEach(en=>{
        if(en.dead || en.dormant) return;
        if(!isBossAccessible(en)) return;
        if(en.group.position.distanceTo(state.pos) <= variant.radius) dealDamageToEnemy(en, dmg, false);
      });
    } else if(variant.mode==='line'){
      const right = new THREE.Vector3(Math.cos(state.facing),0,-Math.sin(state.facing));
      spawnPiercingLineVFX(fwd, variant.length, variant.vfxColor);
      enemies.forEach(en=>{
        if(en.dead || en.dormant) return;
        if(!isBossAccessible(en)) return;
        const toE = new THREE.Vector3().subVectors(en.group.position, state.pos); toE.y=0;
        const forwardDist = toE.dot(fwd);
        const sideDist = Math.abs(toE.dot(right));
        if(forwardDist>0 && forwardDist<=variant.length && sideDist<=variant.width/2) dealDamageToEnemy(en, dmg, false);
      });
    } else if(variant.mode==='orb'){
      spawnChargeOrb(fwd, variant, dmg);
    } else if(variant.mode==='burst3'){
      // three arrows in quick succession while backing away
      [0,1,2].forEach(i=>{
        setTimeout(()=>{
          if(!state.started) return;
          const f = new THREE.Vector3(Math.sin(state.facing),0,Math.cos(state.facing));
          spawnArrow(f, dmg, {color:variant.vfxColor, speed:24, hitR:1.15});
        }, i*110);
      });
    } else if(variant.mode==='fan5'){
      // five-way spread, each arrow homing onto whatever is nearest
      const right = new THREE.Vector3(Math.cos(state.facing),0,-Math.sin(state.facing));
      [-0.34,-0.17,0,0.17,0.34].forEach(spread=>{
        const dir = fwd.clone().addScaledVector(right, spread).normalize();
        spawnArrow(dir, dmg, {color:variant.vfxColor, speed:21, hitR:1.15,
                              homing:true, homingTurn:2.6, homingRange:13});
      });
    }
    flashScreen();
  }

  // a large, slow-moving magic bolt with an enlarged hit radius - explodes
  // into a small burst the moment it comes within range of any enemy
  function spawnChargeOrb(dir, variant, dmg){
    const radius = variant.orbRadius || 1.4;
    const geo = new THREE.SphereGeometry(radius*0.55, 14, 14);
    const mat = new THREE.MeshStandardMaterial({color:variant.vfxColor, emissive:variant.vfxColor, emissiveIntensity:0.7, transparent:true, opacity:0.88});
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(projectileOrigin());   // leaves the staff head...
    // ...then settles to chest height, so it crosses the room at the height
    // of the things it is meant to hit
    mesh.position.y = state.pos.y + 1.15;
    // pooled via takeLight (see its comment) - not a child of the mesh, so
    // removing/reusing the orb never changes the scene's light count
    const glow = takeLight(variant.vfxColor, 1.4, 6);
    glow.position.copy(mesh.position);
    scene.add(mesh);
    const speed = variant.orbSpeed || 11;
    const range = variant.orbRange || 15;
    projectiles.push({mesh, light: glow, dir: dir.clone(), speed, life: range/speed, dmg, isChargeOrb:true, hitRadius: radius});
  }

  function findRangedTargetInLine(fwd, length, width){
    const right = new THREE.Vector3(Math.cos(state.facing),0,-Math.sin(state.facing));
    let best=null, bestDist=Infinity;
    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      if(!isBossAccessible(en)) return;
      const toE = new THREE.Vector3().subVectors(en.group.position, state.pos); toE.y=0;
      const forwardDist = toE.dot(fwd);
      const sideDist = Math.abs(toE.dot(right));
      if(forwardDist>0 && forwardDist<=length && sideDist<=width/2 && forwardDist<bestDist){ bestDist=forwardDist; best=en; }
    });
    return best;
  }

  function spawnPiercingLineVFX(dir, length, colorHex){
    const geo = new THREE.CylinderGeometry(0.1, 0.1, length, 8);
    const mat = new THREE.MeshBasicMaterial({color:colorHex, transparent:true, opacity:0.8});
    const shot = new THREE.Mesh(geo, mat);
    shot.rotation.z = -state.facing;
    shot.rotation.x = Math.PI/2;
    shot.position.copy(state.pos);
    shot.position.y = state.pos.y + 1.0;
    shot.position.addScaledVector(dir, length/2);
    scene.add(shot);
    const startT = performance.now();
    const duration = 240;
    function tick(){
      const t = Math.min(1, (performance.now()-startT)/duration);
      mat.opacity = 0.8*(1-t);
      if(t<1){ requestAnimationFrame(tick); } else { scene.remove(shot); }
    }
    tick();
  }
  function updatePlayer(dt){
    if(state.attackCD>0) state.attackCD = Math.max(0,state.attackCD-dt);
    if(state.dodgeCD>0) state.dodgeCD = Math.max(0,state.dodgeCD-dt);
    if(state.ultLockT>0) state.ultLockT = Math.max(0,state.ultLockT-dt);   // 発動直後の保険的ロックアウトのみ(本体はゲージ制)
    updateStamina(dt);
    if(state.invulnExtraT>0){
      state.invulnExtraT -= dt;
      if(state.invulnExtraT<=0){ state.invulnExtraT=0; state.invulnerable=false; }
    }
    // 性格・装備特殊効果まわりの補助タイマー。無傷継続(慎重)、直近ドッジ(かげぬいの小刀用)、
    // 撃破連鎖(陽気)の3つを毎フレーム進める。性格や装備が無関係でも害はない。
    state.cautiousTimer = (state.cautiousTimer||0) + dt;
    if(state.justDodgedT>0) state.justDodgedT = Math.max(0, state.justDodgedT - dt);
    if(state.dodgeAttackWindowT>0) state.dodgeAttackWindowT = Math.max(0, state.dodgeAttackWindowT - dt);
    if(state.perfectDodgeCD>0) state.perfectDodgeCD = Math.max(0, state.perfectDodgeCD - dt);
    if(state.perfectDodgeWindowT>0) state.perfectDodgeWindowT = Math.max(0, state.perfectDodgeWindowT - dt);
    if(state.jumpAttackCD>0) state.jumpAttackCD = Math.max(0, state.jumpAttackCD - dt);
    if(state.comboWindowT>0){
      state.comboWindowT = Math.max(0, state.comboWindowT - dt);
      if(state.comboWindowT<=0){ state.comboStage = 0; state.comboCount = 0; }
    }
    if(state.killStreakT>0){
      state.killStreakT -= dt;
      if(state.killStreakT<=0){ state.killStreakT = 0; state.killStreak = 0; }
    }
    if(state.mp < state.maxMp) state.mp = Math.min(state.maxMp, state.mp + state.maxMp*0.035*(REGEN_MULT[state.classDef.key]||1.6)*dt);

    if(state.paralyzeT>0){
      state.paralyzeT -= dt;
      if(state.paralyzeT<=0) state.paralyzed = false;
    }
    if(state.paralyzeInvulnT>0) state.paralyzeInvulnT = Math.max(0, state.paralyzeInvulnT-dt);

    // コンボの振り中は踏み込みで身動きが取りにくくなる、という感覚を出すため
    // 移動速度を落とす(旋回速度は下のfacing補間側で別途絞る)
    const speed = state.classDef.spd * (state.swinging ? 0.45 : 1);
    let moveVec = new THREE.Vector3();

    if(state.paralyzed){
      moveVec.set(0,0,0);
      state.vel.set(0,0,0);
    } else if(state.dodging){
      state.dodgeT -= dt;
      const dashSpeed = speed*3.6;
      moveVec.copy(state.dodgeDir).multiplyScalar(dashSpeed*dt);
      state.vel.set(0,0,0);
      if(state.dodgeT<=0){
        state.dodging=false;
        const bonus = bossAbilityValue('dodgeInvuln') + sphereValue('dodgeInvulnSphereMul');   // ボス能力「亡霊の残影」+ スフィア「残影の一歩」
        if(bonus > 0) state.invulnExtraT = 0.2 * bonus;
        else state.invulnerable = false;
      }
    } else if(state.skillAnim){
      const anim = state.skillAnim;
      if(anim.type==='dash' || anim.type==='retreat'){
        const animSpeed = anim.dist / anim.duration;
        const sign = anim.type==='dash' ? 1 : -1;
        moveVec.copy(anim.fwd).multiplyScalar(animSpeed*dt*sign);
      } else {
        moveVec.set(0,0,0); // spin: rooted in place
      }
      state.vel.set(0,0,0);
      anim.t += dt;
      if(anim.t >= anim.duration){ state.skillAnim = null; }
    } else {
      const {x,y} = state.moveInput;
      const inputMag = Math.sqrt(x*x+y*y);
      let targetVel = new THREE.Vector3();
      if(inputMag>0.02){
        const dir = inputToWorldDir(x, y).normalize();
        targetVel.copy(dir).multiplyScalar(speed * Math.min(1,inputMag));
        const targetYaw = Math.atan2(dir.x, dir.z);
        let diff = targetYaw - state.facing;
        while(diff>Math.PI) diff-=Math.PI*2;
        while(diff<-Math.PI) diff+=Math.PI*2;
        // コンボ中は旋回もにぶらせる(踏み込み動作なので急な向き直しができない)
        const turnRate = state.swinging ? 5 : 13;
        state.facing += diff * Math.min(1, dt*turnRate);
      }
      // acceleration / deceleration smoothing: snappier start, soft stop
      const accelRate = inputMag>0.02 ? 14 : 20;
      state.vel.lerp(targetVel, Math.min(1, dt*accelRate));
      moveVec.copy(state.vel).multiplyScalar(dt);
    }

    // apply movement in small substeps so a fast dash can never tunnel through a thin wall
    const totalMove = moveVec.length();
    const maxStep = 0.22;
    const steps = Math.max(1, Math.ceil(totalMove / maxStep));
    const stepVec = moveVec.clone().multiplyScalar(1/steps);
    for(let i=0;i<steps;i++){
      const wasX = state.pos.x, wasZ = state.pos.z;
      state.pos.add(stepVec);
      resolveWallCollisions(state.pos);
      keepOnGround(wasX, wasZ);
      resolveBossCollision(state.pos);
      // the boss shove is a hard reposition, so it can drop the player on the
      // far side of a wall. Re-solve walls afterwards, and if the player still
      // ends up inside solid geometry, fall back to the last good position.
      resolveWallCollisions(state.pos);
      if(insideAnyWall(state.pos)){
        // only rewind a local shove; a teleport is allowed to land anywhere
        if(state.safePos && state.safePos.distanceToSquared(state.pos) < 36)
          state.pos.copy(state.safePos);
        else if(state.safePos) state.safePos.copy(state.pos);
      } else if(state.safePos){
        state.safePos.copy(state.pos);
      }
    }

    clampToWorldBounds(state.pos);

    /* Waterway pier backstop. The global clamp is centred on the world
       origin and does not constrain this small outdoor zone, so the pier gets
       a rectangle of its own.

       This used to test coordinates alone. The clocktower was later built out
       west, and its entire third floor - x -296..-156, z 36..64 - sits inside
       that test, so anyone who climbed to the third floor was instantly
       dragged 168 units east into open sky and fell. A position test is not
       enough once more than one world can occupy the same coordinates: it has
       to name the world it belongs to. */
    if(currentWorldKey === 'waterway' &&
       state.pos.x < -70 && state.pos.z > 28 && state.pos.z < 70){
      state.pos.x = Math.max(-114.4, Math.min(-85.6, state.pos.x));
      state.pos.z = Math.max(34.6, Math.min(63.4, state.pos.z));
    }

    updateLaunchFlight(dt);

    // vertical / platform logic
    state.yVel -= 22*dt;
    state.pos.y += state.yVel*dt;

    // Worlds made of stacked slabs (the clocktower) report their own ground
    // height, and report nothing at all over open air - which is what makes
    // the leap off the roof possible.
    let floorY = 0, overVoid = false;
    if(groundSlabs.length){
      // reference height: where the player was before this frame's gravity,
      // so a fast fall never outruns the floor it is falling toward
      const refY = state.grounded ? state.pos.y : state.pos.y - state.yVel*dt;
      const g = groundYAt(state.pos.x, state.pos.z, refY);
      // a floor found overhead is a ceiling, not something to stand on
      if(g === null || g > refY + 0.6){ floorY = -9999; overVoid = true; }
      else floorY = g;
    }
    const onPlat = currentWorldKey==='mansion' && Math.abs(state.pos.x-24)<4 && Math.abs(state.pos.z-(-4))<4;
    if(onPlat) floorY = 1.6;
    if(platforms.length){
      const ph = floorHeightAt(state.pos.x, state.pos.z, state.pos.y);
      if(ph > floorY) floorY = ph;
    }
    if(groundSlabs.length){
      if(overVoid){
        voidT += dt;
      } else {
        voidT = 0;
        if(state.grounded){
          if(!lastSolid) lastSolid = state.pos.clone();
          else lastSolid.copy(state.pos);
        }
      }
      // Both must hold: out over open air long enough that a one-frame nudge
      // can't trigger it, and clearly below the floor they came from.
      const from = lastSolid ? lastSolid.y : 0;
      if(overVoid && voidT > VOID_GRACE && state.pos.y < from - voidDropLimit) handleVoidFall();
    }
    if(pits.length){
      const q = pitAt(state.pos.x, state.pos.z);
      if(q && Math.abs(floorY - (q.baseY||0)) < 0.5){
        if(state.pos.y <= (q.baseY||0) - 2.5){ handlePitFall(q); }
        else { state.grounded = false; }   // nothing to stand on - keep falling
        floorY = -999;
      }
    }

    if(state.pos.y <= floorY){
      state.pos.y = floorY;
      if(!state.grounded){
        state.landVel = Math.abs(state.yVel);
        sfx('land', Math.min(1, state.landVel/11));
        state.launch = null;   // whatever threw us, we have landed
        if(state.jumpAttacking) landJumpAttack();
      }
      state.yVel = 0;
      state.grounded = true;
    } else {
      state.grounded = false;
    }

    // Swing bookkeeping. The pose itself is applied in applyCombatPose(),
    // after the walk cycle has run, so an attack always overrides locomotion
    // instead of the two fighting over the same joints every frame.
    if(state.swinging){
      state.swingT += dt / (state.swingDur || 0.28);
      if(state.swingT >= 1){
        state.swingT = 1;
        state.swinging = false;
        state.moveClip = null;
      }
    }

    // apply to mesh
    if(player){
      player.position.copy(state.pos);
      if(state.skillAnim && state.skillAnim.type==='spin'){
        const spinT = Math.min(1, state.skillAnim.t/state.skillAnim.duration);
        player.rotation.y = state.swingLockFacing + spinT*Math.PI*2;
      } else if(state.swinging){
        player.rotation.y = state.swingLockFacing;
        visualFacing = state.swingLockFacing;
      } else {
        // Turn at a limited rate rather than snapping. Aiming still uses
        // state.facing, so this changes how the character reads, not how
        // attacks resolve.
        visualFacing = turnToward(visualFacing, state.facing, 13 * dt);
        player.rotation.y = visualFacing;
      }
      updateLocomotion(dt, dt > 0 ? moveVec.length() / dt : 0);   // metres per second
      updateUltAim(dt);
      updateUltSweep(dt);
      updateDecals(dt);
      if(playerMixerParts.ring){
        if(state.charging){
          const chargeRatio = Math.min(1, state.chargeT/state.chargeMax);
          const variant = getChargeVariants().dash;
          playerMixerParts.ring.material.color.setHex(variant.vfxColor);
          playerMixerParts.ring.material.opacity = 0.4 + chargeRatio*0.5;
          playerMixerParts.ring.scale.setScalar(1 + chargeRatio*0.9);
        } else if(state.skillCharging){
          const chargeRatio = Math.min(1, state.skillChargeT/state.skillChargeMax);
          const variant = getChargeVariants()[state.skillChoice] || getChargeVariants().retreat;
          playerMixerParts.ring.material.color.setHex(variant.vfxColor);
          playerMixerParts.ring.material.opacity = 0.4 + chargeRatio*0.5;
          playerMixerParts.ring.scale.setScalar(1 + chargeRatio*0.9);
        } else if(state.paralyzed){
          playerMixerParts.ring.material.color.setHex(0x9a6ae0);
          playerMixerParts.ring.scale.setScalar(1 + Math.sin(performance.now()*0.03)*0.15);
          playerMixerParts.ring.material.opacity = 0.5+0.4*Math.abs(Math.sin(performance.now()*0.04));
        } else {
          playerMixerParts.ring.material.color.setHex(state.classDef.trim);
          playerMixerParts.ring.scale.setScalar(1);
          playerMixerParts.ring.material.opacity = state.invulnerable ? (0.2+0.5*Math.abs(Math.sin(performance.now()*0.02))) : 0.5;
        }
      }
    }
  }

  /* =========================================================
     LOCOMOTION - a stride, a lean, and a landing.
     Previously the player slid around with a sine bob and legs that never
     moved. The phase is driven by distance travelled, not by wall-clock
     time, so the stride stays locked to the feet at any speed.
  ========================================================= */
  let strideT = 0, leanX = 0, leanZ = 0, landSquash = 0, wasGrounded = true;
  let lastStrideHalf = -999, stepDustCD = 0;
  const _stepAt = new THREE.Vector3();
  let visualFacing = 0;

  // shortest-path angular step, so turning past north never spins the long way
  function turnToward(from, to, maxStep){
    let d = (to - from) % (Math.PI*2);
    if(d >  Math.PI) d -= Math.PI*2;
    if(d < -Math.PI) d += Math.PI*2;
    if(Math.abs(d) <= maxStep) return to;
    return from + Math.sign(d)*maxStep;
  }


  /* Re-pins the weapon to the hand that is holding it. The weapon is authored
     in the waist's frame - which keeps the swing arcs readable - but its
     position is resolved from the hand every frame, so the two never drift
     apart mid-animation the way a fixed offset does. */
  const _gripW = new THREE.Vector3(), _gripW2 = new THREE.Vector3();
  function updateGrip(){
    const P = playerMixerParts;
    if(!P.weapon || !P.gripHand || !P.gripOff || !P.waist) return;
    player.updateMatrixWorld(true);
    const side = P.gripSide || P.handSide;
    if(side === 'BOTH' && P.handL && P.handR){
      P.handL.getWorldPosition(_gripW);
      P.handR.getWorldPosition(_gripW2);
      _gripW.add(_gripW2).multiplyScalar(0.5);
    } else {
      (side === 'L' ? P.handL : P.handR).getWorldPosition(_gripW);
    }
    P.waist.worldToLocal(_gripW);
    P.weapon.position.copy(_gripW).add(P.gripOff);
  }


  /* =========================================================
     BLADE TRAIL

     The choreography moves the weapon three metres in a tenth of a second,
     and at that speed the eye gets three or four discrete frames of it - the
     arc the animation is describing never actually reaches the viewer. A
     ribbon stretched between the grip and the tip over the last few frames
     puts the shape of the cut on screen.

     One reused mesh with a preallocated buffer: rebuilding geometry inside a
     swing is the one place per frame allocation would actually hurt.
  ========================================================= */
  const TRAIL_SEGS = 16;
  let trailMesh = null, trailPos = null, trailMat = null;
  let trailSamples = [], trailFade = 0;

  function ensureTrail(){
    if(trailMesh) return trailMesh;
    const geo = new THREE.BufferGeometry();
    trailPos = new Float32Array(TRAIL_SEGS * 6 * 3);   // two triangles per segment
    geo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    /* Normal blending, not additive. Additive on a light floor pushed the
       ribbon towards white and made it the brightest thing on screen - which
       put the flourish above the arc that actually carries the hitbox. */
    trailMat = new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:0,
                                            side:THREE.DoubleSide, depthWrite:false});
    trailMesh = new THREE.Mesh(geo, trailMat);
    trailMesh.frustumCulled = false;
    trailMesh.userData.noOutline = true;
    scene.add(trailMesh);
    return trailMesh;
  }

  const _tipW = new THREE.Vector3(), _gripW3 = new THREE.Vector3();
  function updateBladeTrail(dt){
    const P = playerMixerParts;
    const st = state.classDef ? activeStance(state.classDef.key, state.usingAltWeapon) : null;
    if(!P.weaponTip || !P.weapon || !st || st.trail === false){ trailSamples.length = 0; return; }

    if(state.swinging){
      P.weaponTip.getWorldPosition(_tipW);
      P.weapon.getWorldPosition(_gripW3);
      trailSamples.push({
        tx:_tipW.x, ty:_tipW.y, tz:_tipW.z,
        gx:_gripW3.x, gy:_gripW3.y, gz:_gripW3.z
      });
      if(trailSamples.length > TRAIL_SEGS+1) trailSamples.shift();
      trailFade = 1;
    } else {
      trailFade = Math.max(0, trailFade - dt*5.5);
      if(trailFade <= 0){
        trailSamples.length = 0;
        if(trailMat) trailMat.opacity = 0;
        return;
      }
      if(trailSamples.length > 1) trailSamples.shift();   // the tail catches up
    }

    if(trailSamples.length < 3){ if(trailMat) trailMat.opacity = 0; return; }
    const mesh = ensureTrail();
    let w = 0;
    for(let i=0;i<TRAIL_SEGS;i++){
      const i0 = i, i1 = i+1;
      const a = trailSamples[i0], b = trailSamples[i1];
      if(!a || !b){
        // collapse unused segments to a point rather than leaving stale data
        for(let k=0;k<18;k++) trailPos[w++] = 0;
        continue;
      }
      // the ribbon narrows towards the tail: the near edge slides up the blade
      const fa = i / TRAIL_SEGS, fb = (i+1) / TRAIL_SEGS;
      const ax = a.gx + (a.tx-a.gx)*(0.15+fa*0.55), ay = a.gy + (a.ty-a.gy)*(0.15+fa*0.55), az = a.gz + (a.tz-a.gz)*(0.15+fa*0.55);
      const bx = b.gx + (b.tx-b.gx)*(0.15+fb*0.55), by = b.gy + (b.ty-b.gy)*(0.15+fb*0.55), bz = b.gz + (b.tz-b.gz)*(0.15+fb*0.55);
      trailPos[w++]=ax; trailPos[w++]=ay; trailPos[w++]=az;
      trailPos[w++]=a.tx; trailPos[w++]=a.ty; trailPos[w++]=a.tz;
      trailPos[w++]=b.tx; trailPos[w++]=b.ty; trailPos[w++]=b.tz;
      trailPos[w++]=ax; trailPos[w++]=ay; trailPos[w++]=az;
      trailPos[w++]=b.tx; trailPos[w++]=b.ty; trailPos[w++]=b.tz;
      trailPos[w++]=bx; trailPos[w++]=by; trailPos[w++]=bz;
    }
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
    trailMat.color.set(state.classDef.atkColorHex || '#ffffff');
    trailMat.opacity = 0.17 * trailFade;   // a suggestion of the arc, not the headline
  }

  function updateLocomotion(dt, moveSpeed){
    const P = playerMixerParts;
    const moving = state.grounded && moveSpeed > 0.35;   // m/s
    const busy = state.swinging || state.skillAnim || state.charging
              || state.skillCharging || state.ultAiming;

    // stride phase advances with ground covered
    // roughly 0.85 strides per metre covered, so the feet track the ground
    if(moving) strideT += moveSpeed * dt * 2.7;
    else       strideT += dt * 1.4;               // idle breathing keeps ticking

    const B = P.build || BUILD.male;
    const swing = moving ? Math.min(0.62, 0.045 + 0.085 * moveSpeed) * B.strideAmp : 0;
    const s = Math.sin(strideT);
    const run = Math.min(1, swing / 0.55);        // 0 at a walk, 1 at a sprint

    /* A footfall throws up dust. Now that the stride actually runs at a real
       cadence this is worth having: it is the cue that ties the character to
       the floor, and its absence is a large part of why a walk reads as a
       slide even once the legs are moving. Fired on the phase crossing, so
       each puff lands under the foot that is actually planting. */
    if(moving && state.grounded){
      const half = Math.floor(strideT / Math.PI);
      if(half !== lastStrideHalf){
        lastStrideHalf = half;
        const plant = (half % 2 === 0) ? P.kneeR : P.kneeL;
        if(plant && stepDustCD <= 0){
          plant.getWorldPosition(_stepAt);
          _stepAt.y = state.pos.y;
          spawnLandingDust(_stepAt, 0.26 + run*0.22);
          stepDustCD = 0.10;
        }
      }
    } else lastStrideHalf = -999;
    stepDustCD = Math.max(0, stepDustCD - dt);

    // legs: the hip swings the thigh, and the knee folds as that leg comes
    // through - a straight-legged swing is what reads as a puppet on sticks
    if(P.legL && P.legR){
      P.legL.rotation.x =  s * swing;
      P.legR.rotation.x = -s * swing;
      if(P.kneeL && P.kneeR){
        P.kneeL.rotation.x = Math.max(0,  s) * swing * 1.55 * B.kneeLift + 0.05;
        P.kneeR.rotation.x = Math.max(0, -s) * swing * 1.55 * B.kneeLift + 0.05;
      }
    }
    // arms counter-swing from the shoulder, elbows keeping a live bend
    if(!busy && P.armL && P.armR && P.armLBase && P.armRBase){
      const asw = (P.armSwing !== undefined ? P.armSwing : 1) * 0.62 * B.armSwing;
      P.armL.rotation.x = P.armLBase.x - s * swing * asw;
      P.armR.rotation.x = P.armRBase.x + s * swing * asw;
      if(P.elbowL && P.elbowR && P.elbowLBase && P.elbowRBase){
        P.elbowL.rotation.x = P.elbowLBase.x - Math.max(0, -s) * swing * 0.5;
        P.elbowR.rotation.x = P.elbowRBase.x - Math.max(0,  s) * swing * 0.5;
      }
    }
    // waist: the shoulders lead the hips through the stride and the chest
    // pitches forward as the pace picks up. Everything above the belt is
    // parented here, so this is the difference between walking and sliding.
    // While a strike owns the trunk we leave it alone entirely - it eases
    // back to the stride pose on its own once the swing releases.
    if(P.waist && !busy){
      const twist = -s * swing * 0.30 * B.shoulderRoll;
      const pitch = moving ? 0.02 + run*0.11 : Math.sin(strideT*0.8)*0.014;
      const roll  = s * swing * 0.07 * B.shoulderRoll;
      P.waist.rotation.y += (twist - P.waist.rotation.y) * Math.min(1, dt*15);
      P.waist.rotation.x += (pitch - P.waist.rotation.x) * Math.min(1, dt*8);
      P.waist.rotation.z += (roll  - P.waist.rotation.z) * Math.min(1, dt*13);
      // hips travel laterally against the shoulders. This is the single
      // clearest read on how somebody walks, and it is where the two builds
      // differ most: a wider pelvis swings further for the same stride.
      const sway = moving ? -s * swing * 0.055 * B.hipSway
                          : Math.sin(strideT*0.55) * 0.008 * B.idleShift;
      P.waist.position.x += (sway - P.waist.position.x) * Math.min(1, dt*12);
    }

    // ---- airborne: knees tuck on the way up, legs reach on the way down ----
    if(!state.grounded && P.legL && P.legR && P.kneeL && P.kneeR){
      const rise = Math.max(-1, Math.min(1, state.yVel/7));
      const tuck = rise > 0 ? rise : rise*0.45;
      P.legL.rotation.x = -0.30*tuck - 0.06;
      P.legR.rotation.x = -0.22*tuck + 0.10;
      P.kneeL.rotation.x = Math.max(0.05, 1.15*tuck);
      P.kneeR.rotation.x = Math.max(0.05, 0.85*tuck);
      if(!busy && P.armL && P.armR && P.armLBase && P.armRBase){
        P.armL.rotation.x = P.armLBase.x - 0.35*tuck;
        P.armR.rotation.x = P.armRBase.x - 0.28*tuck;
      }
    }

    // ---- the dodge: tuck low and lean hard into the roll ----
    if(state.dodging && P.waist && P.kneeL && P.kneeR){
      const dodgeK = Math.max(0, Math.min(1, state.dodgeT/0.2));
      const curl = Math.sin(dodgeK*Math.PI);      // 0 -> 1 -> 0 across the roll
      P.waist.rotation.x = 0.55*curl;
      P.kneeL.rotation.x = 0.10 + 1.5*curl;
      P.kneeR.rotation.x = 0.10 + 1.5*curl;
      P.legL.rotation.x = -0.55*curl;
      P.legR.rotation.x = -0.55*curl;
    }

    // lean into the direction of travel, and out of it when stopping
    const targetLean = moving ? Math.min(0.13, moveSpeed*0.019) : 0;
    const rel = state.facing;
    leanX += ((Math.sin(rel)*targetLean) - leanX) * Math.min(1, dt*8);
    leanZ += ((Math.cos(rel)*targetLean) - leanZ) * Math.min(1, dt*8);

    // landing: squash on the frame the feet touch down
    if(state.grounded && !wasGrounded){
      landSquash = Math.min(1, Math.abs(state.landVel || 6) / 11);
      spawnLandingDust(state.pos, landSquash);
      addShake(0.03 * landSquash);
    }
    wasGrounded = state.grounded;
    landSquash = Math.max(0, landSquash - dt*4.2);

    const airT = state.grounded ? 0 : Math.max(-1, Math.min(1, state.yVel/8));
    if(landSquash > 0.01 && P.kneeL && P.kneeR && state.grounded && !state.dodging){
      P.kneeL.rotation.x = Math.max(P.kneeL.rotation.x, landSquash*0.9);
      P.kneeR.rotation.x = Math.max(P.kneeR.rotation.x, landSquash*0.9);
    }
    const squash = 1 - landSquash*0.22 + airT*0.06;
    const stretch = 1 + landSquash*0.13 - airT*0.03;
    player.scale.set(stretch, squash, stretch);

    if(P.torso && P.torsoBaseScale){
      const breath = 1 + (moving ? 0.012 : 0.028) * Math.sin(strideT * (moving ? 1.0 : 0.62));
      P.torso.scale.set(P.torsoBaseScale.x*breath, P.torsoBaseScale.y, P.torsoBaseScale.z*breath);
    }
    const bob = (moving ? Math.abs(Math.sin(strideT))*(0.05 + run*0.035)
                        : Math.sin(strideT)*0.022) * B.bobAmp;
    player.position.y += bob;
    player.rotation.x = -leanZ*0.55;
    player.rotation.z =  leanX*0.55;

    applyCombatPose();   // an attack or a charge overrides the walk cycle
    applyPoseShift();    // the lunge and the sink that give a blow its weight
    updateGrip();        // the weapon lands on wherever the hand ended up
    updateBowDraw();     // and the string on wherever the drawing hand ended up
    updateBladeTrail(dt);
  }

  function spawnLandingDust(pos, power){
    if(power < 0.25) return;
    const mat = nextSparkMat(0xcfc4ae, 0.45);
    const bits = [];
    const n = 5 + Math.round(power*4);
    for(let i=0;i<n;i++){
      const m = takeMesh(dustPool, DUST_GEO, mat);
      m.position.set(pos.x, pos.y+0.12, pos.z);
      const sc = 0.8 + Math.random()*0.6;
      m.scale.set(sc, sc, sc);
      const a = (i/n)*Math.PI*2 + Math.random()*0.5, sp = 1.6 + Math.random()*2.2*power;
      bits.push({mesh:m, vx:Math.cos(a)*sp, vy:0.9, vz:Math.sin(a)*sp});
    }
    sparks.push({bits, glow:null, mat, pool:dustPool, t:0, life:0.42});
  }

  function updateProjectiles(dt){
    for(let i=projectiles.length-1;i>=0;i--){
      const p = projectiles[i];
      if(p.spin) p.mesh.rotation.y += p.spin*dt;
      if(p.boomerang){
        /* The warden's hand flies out, stalls, and comes back along its own
           path, threatening the same ground twice.

           Steering the direction vector round doesn't work here: the hand is
           thrown straight at the player, so the return heading is exactly
           opposite, and interpolating between a vector and its negation
           passes through zero - which normalises straight back to where it
           started. The heading is left alone and the SPEED is what reverses,
           which also gives the stall at the far end for free. */
        const B = p.boomerang;
        B.t = (B.t || 0) + dt;
        p.speed = B.base * Math.cos(Math.PI * B.t / B.dur);
        if(B.t >= B.dur){ scene.remove(p.mesh); projectiles.splice(i,1); continue; }
      }
      if(p.homing){
        // steer gradually toward the nearest live target in range
        let best=null, bestD=p.homingRange;
        enemies.forEach(en=>{
          if(en.dead || en.dormant) return;
          if(!isBossAccessible(en)) return;
          const d = p.mesh.position.distanceTo(en.group.position);
          if(d < bestD){ bestD = d; best = en; }
        });
        if(best){
          const want = new THREE.Vector3().subVectors(best.group.position, p.mesh.position);
          want.y = 0; want.normalize();
          p.dir.lerp(want, Math.min(1, p.homingTurn*dt)).normalize();
          p.mesh.rotation.y = Math.atan2(p.dir.x, p.dir.z);
        }
      }
      p.mesh.position.addScaledVector(p.dir, p.speed*dt);
      if(p.light) p.light.position.copy(p.mesh.position);   // borrowed from the pool, not a child of the mesh - see spawnProjectileSingle()
      p.life -= dt;

      let hitWall = false;
      for(const w of walls){
        if(p.mesh.position.x>=w.minX && p.mesh.position.x<=w.maxX && p.mesh.position.z>=w.minZ && p.mesh.position.z<=w.maxZ){
          hitWall = true; break;
        }
      }
      if(hitWall){ scene.remove(p.mesh); if(p.light) giveLight(p.light); projectiles.splice(i,1); continue; }

      if(p.hostile){
        const flatPlayerPos = new THREE.Vector3(state.pos.x, p.mesh.position.y, state.pos.z);
        const d = p.mesh.position.distanceTo(flatPlayerPos);
        if(d < 0.75 && Math.abs(p.mesh.position.y - state.pos.y) < 1.8 &&
           !state.invulnerable && state.paralyzeInvulnT<=0){
          scene.remove(p.mesh); if(p.light) giveLight(p.light); projectiles.splice(i,1);
          if(!tryConsumeOrbShield()){
            const dmg = applyIncomingDamageMul(state.debugMode ? 0 : p.dmg);
            state.hp = Math.max(0, state.hp - dmg);
            spawnDamagePopup(state.pos.clone(), dmg, false, false, true);
            flashScreen();
            if(p.isElectric && !state.debugMode){
              state.paralyzed = true; state.paralyzeT = 1.0; state.paralyzeInvulnT = 1.7;
              spawnToast('⚡ 体が痺れて動けない!');
            }
            if(state.hp<=0) triggerPlayerDown();
          }
          continue;
        } else if(d < 0.75 && Math.abs(p.mesh.position.y - state.pos.y) < 1.8 && state.paralyzeInvulnT<=0){
          tryPerfectDodge();
        }
      } else if(p.isChargeOrb){
        /* The orb was tested with a raw 3D distance against en.group.position,
           which is the enemy's FEET. Every other projectile flattens the
           comparison and applies a separate vertical tolerance, and for good
           reason: the orb leaves the staff head at about 1.8m while the
           target's origin is on the floor, so the vertical gap alone ate the
           whole 1.6m blast radius and the shot could never register - however
           well aimed it was. Flattened here to match the rest. */
        let hitAny = false;
        enemies.forEach(en=>{
          if(en.dead || en.dormant) return;
          if(!isBossAccessible(en)) return;
          const flat = Math.hypot(en.group.position.x - p.mesh.position.x,
                                  en.group.position.z - p.mesh.position.z);
          if(flat <= p.hitRadius && Math.abs(p.mesh.position.y - en.group.position.y) < 2.2){
            dealDamageToEnemy(en, p.dmg, false);
            hitAny = true;
          }
        });
        if(hitAny){
          spawnUltimateVFX(p.mesh.position.clone(), {radius:p.hitRadius, vfxColor:p.mesh.material.color.getHex()});
          scene.remove(p.mesh); if(p.light) giveLight(p.light); projectiles.splice(i,1); continue;
        }
      } else {
        let hit = false;
        for(const en of enemies){
          if(en.dead || en.dormant) continue;
          if(!isBossAccessible(en)) continue;
          if(p.pierce && p.pierceHitSet && p.pierceHitSet.has(en)) continue; // 貫通済みの相手には当たらない
          const d = p.mesh.position.distanceTo(new THREE.Vector3(en.group.position.x, p.mesh.position.y, en.group.position.z));
          // height check is relative to the target, not to world y=0.5:
          // the old absolute form made arrows harmless on every upper storey
          if(d < (p.hitR || 0.6) && Math.abs(p.mesh.position.y - en.group.position.y) < 1.8){
            dealDamageToEnemy(en, p.dmg, false, {staggerMul: p.staggerMul, ultGauge: p.ultGauge});
            if(p.pierce){
              p.pierceHitSet.add(en);
              p.pierceLeft--;
              if(p.pierceLeft <= 0) hit = true;  // 貫通回数を使い切ったらここで消える
            } else {
              hit = true;
            }
            if(hit) break;
          }
        }
        if(!hit){
          for(const c of chests){
            if(!c.isMimic || c.revealed) continue;
            const d = p.mesh.position.distanceTo(new THREE.Vector3(c.pos.x, p.mesh.position.y, c.pos.z));
            if(d < 0.7){
              const en = revealMimic(c);
              if(en) dealDamageToEnemy(en, p.dmg, false, {staggerMul: p.staggerMul, ultGauge: p.ultGauge});
              hit = true;
              break;
            }
          }
        }
        if(hit){ scene.remove(p.mesh); if(p.light) giveLight(p.light); projectiles.splice(i,1); continue; }
      }

      if(p.life<=0){ scene.remove(p.mesh); if(p.light) giveLight(p.light); projectiles.splice(i,1); }
    }
  }

  /* =========================================================
     GAME FEEL - hit stop, camera shake and impact sparks.
     A blow currently registers as a 90ms colour flash and a floating number.
     These three give it weight without touching any combat maths.
  ========================================================= */
  let wasPlayable = true;    // false while an overlay owns the screen
  let hitStopT = 0;          // seconds of slow motion remaining
  let hitStopCD = 0;         // refuses to re-trigger until this expires
  let shakeAmp = 0, shakeT = 0;
  const shakeOffset = new THREE.Vector3();

  /* Slow time briefly on impact.
     The first version chained: a volley of arrows or a spin through three
     enemies re-armed the freeze faster than it expired, so the whole game
     - the boss included - ran at a fraction of speed for as long as the
     player kept attacking. It now has a refractory period, so a burst of
     hits produces one punch rather than a continuous drag, and the freeze
     itself is shorter and lighter. */
  // Measured rather than guessed: at 0.55 the pause reads as about 16ms of
  // stall - enough to feel the blow land, short of the "the game hitched"
  // threshold - and sustained attacking costs only 7% of real time.
  const HIT_STOP_SCALE = 0.62;
  const HIT_STOP_REFRACTORY = 0.26;
  function hitStop(seconds){
    if(hitStopCD > 0) return;               // still inside the last one
    hitStopT = Math.min(0.022, seconds * state.hitStopScale);
    hitStopCD = HIT_STOP_REFRACTORY;
  }
  function addShake(amount){
    if(state.shakeScale === 0) return;
    shakeAmp = Math.min(0.55, shakeAmp + amount * state.shakeScale);
    shakeT = Math.max(shakeT, 0.32);
  }
  function updateShake(dt){
    if(shakeT <= 0){ shakeOffset.set(0,0,0); shakeAmp = 0; return; }
    shakeT -= dt;
    const decay = Math.max(0, shakeT / 0.32);
    const a = shakeAmp * decay * decay;
    const t = performance.now() * 0.001;
    // three different frequencies so it reads as a knock rather than a wobble
    shakeOffset.set(Math.sin(t*47.3)*a, Math.sin(t*61.7)*a*0.7, Math.sin(t*53.1)*a);
    shakeAmp *= 0.94;
  }

  /* =========================================================
     COMBAT MUSIC - the ambient per-world drone (procedural-bgm.js) used to
     play at the same hush whether the room was empty or a boss was three
     steps away. This drives a 0..1 "intensity" into it every frame: the
     nearer an active enemy is (and more so if it's a boss), the higher it
     climbs, which procedural-bgm.js turns into a faster event density, a
     brighter filter, and a driving low pulse layer that's otherwise
     silent. No-ops harmlessly for a world playing a registered BGM file
     instead of the procedural fallback (see setBgmIntensity() in
     audio.js) - there's just nothing for it to shape yet.
  ========================================================= */
  let combatIntensity = 0;
  function updateCombatMusic(dt){
    let target = 0;
    enemies.forEach(en=>{
      if(en.dead || en.dormant) return;
      const range = en.isBoss ? 14 : 8;
      const d = state.pos.distanceTo(en.group.position);
      if(d >= range) return;
      const w = (1 - d/range) * (en.isBoss ? 1.4 : 1.0);
      if(w > target) target = w;
    });
    target = Math.min(1, target);
    // rises quickly (a fight shouldn't take a second to announce itself)
    // but falls slowly, so ducking behind a pillar mid-fight doesn't
    // instantly drop the music back to a hush
    const rate = target > combatIntensity ? 2.2 : 0.6;
    combatIntensity += (target - combatIntensity) * Math.min(1, rate*dt);
    setBgmIntensity(combatIntensity);
  }

  /* A burst of shards at the point of contact, plus a one-frame light.
     Everything here is pooled. Building a BoxGeometry per shard meant every
     sword swing allocated GPU buffers mid-combat, which is precisely when a
     hitch is most noticeable - the geometry and the meshes are now created
     once at boot and recycled. */
  let sparks = [];
  const SPARK_GEO = new THREE.BoxGeometry(0.13,0.13,0.34);
  const DUST_GEO  = new THREE.SphereGeometry(0.2, 6, 5);
  const sparkPool = [];   // free meshes, keyed by which geometry they use
  const dustPool  = [];
  const lightPool = [];

  function takeMesh(pool, geo, mat){
    let m = pool.pop();
    if(!m){ m = new THREE.Mesh(geo, mat); m.matrixAutoUpdate = true; }
    else   { m.material = mat; }
    m.visible = true;
    scene.add(m);
    return m;
  }
  function giveMesh(pool, m){
    scene.remove(m);
    if(pool.length < 160) pool.push(m);
  }
  /* Point lights are pooled by object reuse, but the first version of this
     fix only stopped take/giveLight from calling scene.add()/scene.remove()
     per borrow - it still let the pool grow lazily, one new PointLight at a
     time, the first time concurrent demand exceeded whatever peak it had
     hit so far. WebGL forward lighting bakes the active light count into
     every material's shader (as a #define), so each time that count reaches
     a value it has never been at before, three.js has to compile a fresh
     shader for every distinct material the renderer touches next - a real
     GPU stall, confirmed empirically via direct WebGL linkProgram
     instrumentation. Lazily growing the pool just meant that stall kept
     recurring: every time a fight produced a slightly bigger burst of
     simultaneous arrows/sparks/orbs than any before it, the pool hit a new
     peak and the game re-paid the recompile cost - i.e. "happens often, not
     just once", exactly matching the reported symptom. The real fix is to
     pre-warm the whole pool to its cap at boot (prewarmLightPool, called
     from initThree once the scene exists), so the light count the renderer
     sees is fixed from frame one and never has a new peak to discover. */
  // Every one of these stays live in the scene for the rest of the game
  // (see prewarmLightPool below), so its per-fragment cost is paid on every
  // material, every frame, all game long - not just during the burst that
  // needs it. 12 was carried over from the old lazy cap without checking
  // that cost: pre-warming all 12 measured out to roughly double real-world
  // build/frame time in this environment's software renderer, for headroom
  // far past what combat actually uses (empirically ~4 concurrent VFX
  // lights in a sustained rapid-fire burst - see spawnProjectileSingle's
  // comment). Sized to that measured peak plus a small margin instead.
  const LIGHT_POOL_SIZE = 6;
  function prewarmLightPool(){
    for(let i=0;i<LIGHT_POOL_SIZE;i++){
      const l = new THREE.PointLight(0xffffff, 0, 1);
      scene.add(l);
      lightPool.push(l);
    }
  }
  function takeLight(color, intensity, dist){
    let l = lightPool.pop();
    if(!l){ l = new THREE.PointLight(color, intensity, dist); scene.add(l); }
    else { l.color.setHex(color); l.intensity = intensity; l.distance = dist; }
    return l;
  }
  function giveLight(l){
    l.intensity = 0;
    if(lightPool.length < LIGHT_POOL_SIZE) lightPool.push(l);
  }

  // A small ring of materials, reused in rotation. Opacity animates per burst,
  // so they can't be shared outright, but a handful cycling is enough - by the
  // time one comes round again its burst has long finished.
  const sparkMats = [];
  let sparkMatIdx = 0;
  function nextSparkMat(color, opacity){
    if(sparkMats.length < 12){
      const m = new THREE.MeshBasicMaterial({color, transparent:true, opacity});
      sparkMats.push(m);
      return m;
    }
    const m = sparkMats[sparkMatIdx = (sparkMatIdx+1) % sparkMats.length];
    m.color.setHex(color); m.opacity = opacity;
    return m;
  }

  /* dir, when given, is the direction the blow travelled. Sparks used to fly
     out in an even ring regardless, which reads as the target detonating
     rather than as something striking it from a particular side - and it
     threw away the one piece of information the impact already had. */

  /* =========================================================
     SCORCH DECALS

     A meteor, a ground split or a bomb used to leave a flash and then a floor
     that looked untouched a second later. A mark that lingers is what makes
     the ground read as something the fight happens ON rather than as a
     backdrop the effects play in front of.

     Pooled and capped: marks accumulate over a long fight, and an unbounded
     pile of transparent quads lying on the floor is a real cost.
  ========================================================= */
  const DECAL_MAX = 12;
  let decals = [], decalCircle = null, decalHotRing = null, decalAshRing = null;

  /* Ragged geometry, not circles.

     The first attempt used CircleGeometry and RingGeometry, and a perfect
     circle outline on the floor does not read as a burn - it reads as a UI
     marker, which is exactly what it looked like. Real scorching has an
     uneven edge, so the radius of every rim vertex is perturbed and a few
     variants are cut so two marks side by side are not identical.

     Built once and shared; the variants are picked at spawn. */
  const DECAL_VARIANTS = 4;
  let decalGeoSets = null;

  function raggedRadii(segments, seed, amount){
    const r = [];
    let s = seed;
    const rnd = ()=>{ s = (s*1103515245 + 12345) & 0x7fffffff; return (s%1000)/1000; };
    // two overlapping lobes of noise: broad dents plus a fine crumbly edge
    const bias = [], fine = [];
    for(let i=0;i<segments;i++){ bias.push(rnd()); fine.push(rnd()); }
    for(let i=0;i<segments;i++){
      const p = i/segments*Math.PI*2;
      const broad = Math.sin(p*2 + bias[0]*6)*0.5 + Math.sin(p*3 + bias[1]*6)*0.3;
      r.push(1 + broad*amount + (fine[i]-0.5)*amount*0.9);
    }
    return r;
  }

  function raggedDisc(segments, seed, amount){
    const r = raggedRadii(segments, seed, amount);
    const pos = [];
    for(let i=0;i<segments;i++){
      const j = (i+1)%segments;
      const a0 = i/segments*Math.PI*2, a1 = j/segments*Math.PI*2;
      pos.push(0,0,0);
      pos.push(Math.cos(a0)*r[i], Math.sin(a0)*r[i], 0);
      pos.push(Math.cos(a1)*r[j], Math.sin(a1)*r[j], 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }

  function raggedRing(inner, segments, seed, amount){
    const r = raggedRadii(segments, seed, amount);
    const pos = [];
    for(let i=0;i<segments;i++){
      const j = (i+1)%segments;
      const a0 = i/segments*Math.PI*2, a1 = j/segments*Math.PI*2;
      const o0x = Math.cos(a0)*r[i], o0y = Math.sin(a0)*r[i];
      const o1x = Math.cos(a1)*r[j], o1y = Math.sin(a1)*r[j];
      const i0x = Math.cos(a0)*r[i]*inner, i0y = Math.sin(a0)*r[i]*inner;
      const i1x = Math.cos(a1)*r[j]*inner, i1y = Math.sin(a1)*r[j]*inner;
      pos.push(i0x,i0y,0, o0x,o0y,0, o1x,o1y,0);
      pos.push(i0x,i0y,0, o1x,o1y,0, i1x,i1y,0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }

  function decalGeos(v){
    if(!decalGeoSets){
      decalGeoSets = [];
      for(let i=0;i<DECAL_VARIANTS;i++){
        const seed = 17 + i*911;
        decalGeoSets.push([
          raggedDisc(30, seed, 0.16),        // the charred core
          raggedRing(0.46, 30, seed+3, 0.18), // embers, while it is hot
          raggedRing(0.82, 30, seed, 0.16)    // the ash edge
        ]);
      }
    }
    return decalGeoSets[v % DECAL_VARIANTS];
  }

  /* A burn is three things - a charred core, embers while it is still hot,
     and a pale ash edge once it is not. The ash is what carries the read on a
     dark floor, because it is LIGHTER than what it sits on; but it is an edge,
     not the subject, so it stays well under the core. */
  function spawnScorch(pos, radius, colorHex, life){
    const [gCore, gHot, gAsh] = decalGeos(Math.floor(Math.random()*DECAL_VARIANTS));
    life = life || 7;
    const col = colorHex === undefined ? 0xffb257 : colorHex;

    const core = new THREE.MeshBasicMaterial({color:0x16100b, transparent:true, opacity:0, depthWrite:false,
      polygonOffset:true, polygonOffsetFactor:-3, polygonOffsetUnits:-3});
    const hot  = new THREE.MeshBasicMaterial({color:col, transparent:true, opacity:0, depthWrite:false,
      blending:THREE.AdditiveBlending,
      polygonOffset:true, polygonOffsetFactor:-4, polygonOffsetUnits:-4});
    const ash  = new THREE.MeshBasicMaterial({color:0x8a8072, transparent:true, opacity:0, depthWrite:false,
      polygonOffset:true, polygonOffsetFactor:-5, polygonOffsetUnits:-5});

    const g = new THREE.Group();
    [[gCore, core], [gHot, hot], [gAsh, ash]].forEach(([geo, mat])=>{
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI/2;
      m.userData.noOutline = true;
      g.add(m);
    });
    const fy = floorHeightAt(pos.x, pos.z, pos.y + 3);
    g.position.set(pos.x, Math.max(fy, pos.y) + 0.05, pos.z);
    g.rotation.y = Math.random()*Math.PI*2;
    g.scale.setScalar(radius*0.4);
    g.renderOrder = 2;
    scene.add(g);
    decals.push({group:g, core, hot, ash, t:0, life, grow:radius});
    while(decals.length > DECAL_MAX) removeDecal(decals.shift());
  }

  function removeDecal(d){
    scene.remove(d.group);
    d.core.dispose(); d.hot.dispose(); d.ash.dispose();
  }

  function updateDecals(dt){
    for(let i=decals.length-1;i>=0;i--){
      const d = decals[i];
      d.t += dt;
      // it spreads in a fifth of a second, then stays put
      const g = Math.min(1, d.t/0.20);
      d.group.scale.setScalar(d.grow * (0.4 + 0.6*g));
      // a short absolute fade-in, not a fraction of the lifetime: tying it to
      // the lifetime meant a seven second mark took most of a second to
      // appear, by which point the explosion that made it was over
      const inK = Math.min(1, d.t/0.08);
      const outK = Math.max(0, 1 - Math.max(0, d.t - d.life*0.55) / (d.life*0.45));
      d.core.opacity = 0.72 * inK * outK;
      // the ash is an edge, not the subject: at 0.52 of a near-white it was
      // the brightest thing on screen and read as a drawn circle
      d.ash.opacity  = 0.22 * inK * outK;
      // embers cool over the first second and a bit, but a burn keeps a faint
      // glow - which is also what keeps the mark readable on a black floor
      // once the flash is gone, without resorting to a loud pale rim
      d.hot.opacity = 0.95 * inK * Math.max(0.055, 1 - d.t/1.3) * outK;
      if(d.t >= d.life){ removeDecal(d); decals.splice(i,1); }
    }
  }
  function clearDecals(){
    decals.forEach(removeDecal);
    decals = [];
  }

  function spawnHitSpark(pos, color, power, dir){
    power = power || 1;
    const col = color || 0xffe6a0;
    const mat = nextSparkMat(col, 1);
    const n = Math.min(12, 5 + Math.round(power*4));
    const bits = [];
    const base = dir ? Math.atan2(dir.x, dir.z) : null;
    for(let i=0;i<n;i++){
      const m = takeMesh(sparkPool, SPARK_GEO, mat);
      m.position.copy(pos);
      // a cone about the impact heading, with the odd stray for looseness
      const spread = (i % 5 === 4) ? Math.PI : 0.85;
      const a = base === null ? Math.random()*Math.PI*2
                              : base + (Math.random()-0.5)*2*spread;
      const up = 0.4 + Math.random()*1.5;
      const sp = 3.5 + Math.random()*4.5*power;
      m.rotation.set(Math.random()*3, a, 0);
      m.scale.set(1,1,1);
      bits.push({mesh:m, vx:Math.sin(a)*sp, vy:up*3, vz:Math.cos(a)*sp});
    }
    const glow = takeLight(col, 2.2*power, 5.5);
    glow.position.copy(pos);
    sparks.push({bits, glow, mat, pool:sparkPool, t:0, life:0.34, peak:2.2*power});
  }
  function updateSparks(dt){
    for(let i=sparks.length-1;i>=0;i--){
      const s = sparks[i];
      s.t += dt;
      const k = s.t / s.life;
      s.bits.forEach(b=>{
        b.mesh.position.x += b.vx*dt;
        b.mesh.position.y += b.vy*dt;
        b.mesh.position.z += b.vz*dt;
        b.vy -= 26*dt;
      });
      s.mat.opacity = Math.max(0, 1-k);
      if(s.glow) s.glow.intensity = Math.max(0, (s.peak||2.2)*(1-k*1.6));
      if(k>=1){
        s.bits.forEach(b=> giveMesh(s.pool, b.mesh));
        if(s.glow) giveLight(s.glow);
        sparks.splice(i,1);
      }
    }
  }
  function clearSparks(){
    sparks.forEach(s=>{
      s.bits.forEach(b=> giveMesh(s.pool, b.mesh));
      if(s.glow) giveLight(s.glow);
    });
    sparks = [];
  }



  function getCamOffset(){
    return new THREE.Vector3(
      Math.sin(state.camYaw) * state.camDist,
      state.camHeight,
      Math.cos(state.camYaw) * state.camDist
    );
  }

  function updateCamera(dt){
    if(state.dialogueActive && state.dialogueBoss && !state.dialogueBoss.dead){
      // dramatic close-up on the boss while they're talking
      const bp = state.dialogueBoss.group.position;
      const desiredB = new THREE.Vector3(bp.x, bp.y+2.2, bp.z).add(
        new THREE.Vector3(Math.sin(state.camYaw)*3.5, 0, Math.cos(state.camYaw)*3.5)
      );
      camera.position.lerp(desiredB, 1-Math.pow(0.00002,dt));
      const lookAtB = bp.clone(); lookAtB.y += 1.6;
      camera.lookAt(lookAtB);
      return;
    }
    const desired = new THREE.Vector3().copy(state.pos).add(getCamOffset());
    camera.position.lerp(desired, 1-Math.pow(0.001,dt));
    const lookAt = state.pos.clone(); lookAt.y += 0.6;
    camera.lookAt(lookAt);
    // shake is applied after lookAt so the camera jolts without ever losing
    // the player from frame centre
    camera.position.add(shakeOffset);
  }

  // keep the shadow-casting light (and its small frustum) centered on the
  // player instead of covering the whole spread-out world at once
  function updateSunShadow(){
    if(!sunLight) return;
    sunLight.position.set(state.pos.x+30, state.pos.y+45, state.pos.z+20);
    sunLight.target.position.copy(state.pos);
    sunLight.target.updateMatrixWorld();
  }

  /* =========================================================
