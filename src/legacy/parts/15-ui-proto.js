// Combat HUD Visual Prototype(UI-002-C2)
// (15-ui-proto.js - concatenated with the other src/legacy/parts/*.js
// files into one shared scope at build time; see src/legacy/concat-plugin.js)

  /* =========================================================
     COMBAT HUD VISUAL PROTOTYPE(UI-002-C2)

     V(Human Visual Decision)の V-1〜V-7 を実画面で確かめるための
     見本オーバーレイ。?dev=1&uiproto=1 の時だけ作る(AP-C2-08)。
     通常 URL・?dev=1 だけでは DOM も作らない。

     守ること(Human Approval AP-C2-01〜12):
       - 既存 state を読むだけ。書き込まない・セーブに触れない
       - 入力に接続しない(見本のボタンは押しても何も起きない。
         #uip-root は pointer-events:none で、下のゲーム操作も妨げない)
       - 既存 HUD の DOM・CSS・更新関数(updateHUD 等)に手を入れない。
         更新は自前の requestAnimationFrame で行う
       - 本番 HUD のアイコンは置き換えない(E の範囲)
       - 並びは仮配置。HUD の配置案ではない(D を先取りしない)
     ========================================================= */
  (function setupUiProto(){
    if(!uiProtoEnabled(location.search)) return;

    const icon = name => `<span class="uip-icon">${uiProtoIcon(name)}</span>`;
    // 見本のボタン(Live / 見本板で共通)。data-uip は E2E 用
    const plate = (cls, name, extra='') => `<div class="uip-plate ${cls}" data-uip="${name}">${icon(name)}${extra}</div>`;
    const actions = pfx => [
      plate('uip-btn-heal', 'heal', `<span class="uip-count uip-txt" data-uip-count="${pfx}">0</span>`),
      plate('uip-btn-skill', 'skill1'),
      plate('uip-btn-skill', 'skill2'),
      plate('uip-btn-ult', 'ultimate'),
      plate('uip-btn-attack', 'attack'),
    ].join('');

    /* 見本板: 各ボタン × 状態(normal / pressed / disabled / cooldown / ready)。
       値は固定(state を読まない) */
    const row = (cls, name, states) => states.map(st => {
      if(st === '-') return '<span></span>';
      const extra = name === 'heal' ? '<span class="uip-count uip-txt">3</span>' : '';
      const style = st === 'is-cd' ? ' style="--cd:0.6"' : (name === 'ultimate' ? ` style="--g:${st === 'is-ready' ? 1 : 0.4}"` : '');
      return `<div class="uip-plate ${cls} ${st}"${style}>${icon(name)}${extra}</div>`;
    }).join('');
    const ALL = ['', 'is-pressed', 'is-disabled', 'is-cd'];
    const board =
      `<div class="uip-board" data-uip-board>` +
        `<div class="uip-grid">` +
          ['normal', 'pressed', 'disabled', 'cooldown', 'ready'].map(h => `<span class="uip-grid-h uip-txt">${h}</span>`).join('') +
          row('uip-btn-attack', 'attack', [...ALL, '-']) +
          row('uip-btn-skill', 'skill1', [...ALL, '-']) +
          row('uip-btn-skill', 'skill2', [...ALL, '-']) +
          row('uip-btn-ult', 'ultimate', ['', 'is-pressed', 'is-disabled', '-', 'is-ready']) +
          row('uip-btn-heal', 'heal', [...ALL, '-']) +
        `</div>` +
        `<div class="uip-ladder">` +
          ['attack', 'ultimate', 'heal'].map(n =>
            ['l16', 'l20', 'l24', 'l48'].map(l => `<span class="uip-ladder-cell ${l}">${uiProtoIcon(n)}</span>`).join('')
          ).join('<span class="uip-ladder-sep"></span>') +
        `</div>` +
      `</div>`;

    const root = document.createElement('div');
    root.id = 'uip-root';
    root.innerHTML =
      `<div class="uip-tag">` +
        `<span class="uip-tag-label uip-txt">C2 Prototype（配置は未定）</span>` +
        `<div class="uip-plate uip-tool" data-uip-tool="board" title="見本板">${icon('board')}</div>` +
        `<div class="uip-plate uip-tool" data-uip-tool="close" title="閉じる">${icon('close')}</div>` +
      `</div>` +
      `<div class="uip-live-status uip-status" data-uip="status">` +
        `<div class="uip-plate uip-portrait">${icon('portrait')}` +
          `<div class="uip-plate uip-badge" data-uip="weapon"><span class="uip-icon"></span></div>` +
        `</div>` +
        `<div class="uip-status-body">` +
          `<span class="uip-name uip-txt" data-uip-name></span>` +
          `<div class="uip-hp"><span class="uip-hp-mark">${uiProtoIcon('hp')}</span>` +
            `<div class="uip-hp-track"><div class="uip-hp-fill" data-uip-hp></div></div>` +
            `<span class="uip-hp-num uip-txt" data-uip-hpnum></span>` +
          `</div>` +
        `</div>` +
      `</div>` +
      `<div class="uip-notes">` +
        `<div class="uip-plate uip-note uip-note-recovery" data-uip="note-recovery">` +
          `<div class="uip-plate uip-note-icon">${icon('heal')}</div><span class="uip-note-val uip-txt">+40</span></div>` +
        `<div class="uip-plate uip-note uip-note-interact" data-uip="note-interact">` +
          `<div class="uip-plate uip-note-icon">${icon('interact')}</div></div>` +
      `</div>` +
      `<div class="uip-live-actions" data-uip-live>${actions('live')}</div>` +
      board;
    document.body.appendChild(root);

    // 見本オーバーレイ自身の表示だけを切り替える(ゲームには何もしない)
    let closed = false;
    root.querySelector('[data-uip-tool="close"]').addEventListener('click', ()=>{ closed = true; });
    root.querySelector('[data-uip-tool="board"]').addEventListener('click', ()=>{ root.classList.toggle('board-off'); });

    const live = root.querySelector('[data-uip-live]');
    const el = {
      name: root.querySelector('[data-uip-name]'),
      hp: root.querySelector('[data-uip-hp]'),
      hpNum: root.querySelector('[data-uip-hpnum]'),
      weapon: root.querySelector('[data-uip="weapon"]'),
      heal: live.querySelector('[data-uip="heal"]'),
      healCount: live.querySelector('[data-uip-count="live"]'),
      skill1: live.querySelector('[data-uip="skill1"]'),
      skill2: live.querySelector('[data-uip="skill2"]'),
      ult: live.querySelector('[data-uip="ultimate"]'),
    };
    el.ult.addEventListener('animationend', ()=> el.ult.classList.remove('uip-pop'));
    const clamp01 = v => Math.max(0, Math.min(1, v));
    let weaponKey = undefined;
    let wasReady = false;

    // 既存 state を読むだけ(書き込まない)
    function update(){
      const cls = state.classDef;
      el.name.textContent = cls ? cls.name : '';
      const hpRatio = state.maxHp > 0 ? clamp01(state.hp / state.maxHp) : 0;
      el.hp.style.width = `${hpRatio * 100}%`;
      el.hpNum.textContent = `${Math.max(0, Math.ceil(state.hp))}/${Math.round(state.maxHp)}`;

      const def = cls ? weaponDefFor(cls.key, state.usingAltWeapon) : null;
      const key = def ? def.key : null;
      if(key !== weaponKey){
        weaponKey = key;
        const name = uiProtoWeaponIcon(key);
        el.weapon.querySelector('.uip-icon').innerHTML = name ? uiProtoIcon(name) : '';
        el.weapon.classList.toggle('is-placeholder', !name);   // 剣士以外の武器アイコンは E の範囲
      }

      const s1 = state.skillCD > 0 ? clamp01(state.skillCD / 1.6) : 0;   // updateCooldownRings と同じ満了値
      el.skill1.classList.toggle('is-cd', s1 > 0);
      el.skill1.style.setProperty('--cd', s1);

      const learned = hasSkill2(state);
      const s2def = cls ? activeSkill2Def(cls.key) : null;
      const s2 = learned && s2def && state.skill2CD > 0 ? clamp01(state.skill2CD / s2def.cd) : 0;
      el.skill2.classList.toggle('is-disabled', !learned);
      el.skill2.classList.toggle('is-cd', s2 > 0);
      el.skill2.style.setProperty('--cd', s2);

      const g = clamp01(state.ultGauge / ULT_GAUGE_MAX);
      const ready = g >= 1;
      el.ult.style.setProperty('--g', g);
      el.ult.classList.toggle('is-ready', ready);
      if(ready && !wasReady) el.ult.classList.add('uip-pop');   // 満ちた瞬間だけ 1 回
      wasReady = ready;

      const n = (state.inventory && state.inventory.potion) || 0;
      el.healCount.textContent = String(n);
      el.heal.classList.toggle('is-disabled', n <= 0);
    }

    function frame(){
      const show = !closed && !!state.started;
      root.classList.toggle('show', show);
      if(show){
        try{ update(); }catch(err){ console.warn('[uiproto] update skipped:', err); }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();
