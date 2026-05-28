/* =========================================================
 *  Magic Fruit Splash Breaker - 商店與金錢系統
 *  通關後得分入袋 → 商店買道具 / 攻擊球 / 擋板裝備
 * ========================================================= */
(() => {
  'use strict';

  const MONEY_KEY  = 'mfsb_money';
  const INV_KEY    = 'mfsb_inventory';
  const PADDLE_GEAR_USES_PER_BUY = 3;   // 買一次擋板可用 3 關

  // ===== 商品定義（按分類） =====
  const ITEMS = [
    // 一次性道具（神秘箱類）
    { id: 'wide',   cat: 'item', emoji: '↔️', name: '擋板變寬', price: 100,
      desc: '進關時擋板 1.5× 大，持續 30 秒。錯失球的容錯神器。' },
    { id: 'slow',   cat: 'item', emoji: '🐢', name: '慢速球',   price: 150,
      desc: '所有球速 ×0.7，持續 8 秒。讓你看清楚每一球。' },
    { id: 'multi',  cat: 'item', emoji: '⚪', name: '多球',     price: 250,
      desc: '立刻多 2 顆額外球，掉光不算失敗。' },
    { id: 'double', cat: 'item', emoji: '✖2', name: '雙倍分',   price: 200,
      desc: '10 秒內所有得分 ×2。配連擊更香。' },
    { id: 'gem',    cat: 'item', emoji: '💎', name: '寶石 +50', price: 30,
      desc: '直接加 50 分，可累積。便宜小確幸。' },
    { id: 'extraBall', cat: 'item', emoji: '⭕', name: '額外儲備球', price: 180,
      desc: '進該關時 +1 顆儲備球，只限挑戰模式。' },
  ];

  const ATTACK_BALLS = [
    { id: 'ballFire', emoji: '🔥', name: '火球',  price: 200, color: '#ef5350',
      desc: '碰磚塊瞬間點燃周圍 3×3，0.5 秒後一起爆破（連環）。最暴力。' },
    { id: 'ballIce',  emoji: '❄️', name: '冰球',  price: 180, color: '#4fc3f7',
      desc: '碰目標時凍結 3 秒，凍結中無視 hp 直接破。對鋼磚/水果神效。' },
    { id: 'ballWind', emoji: '💨', name: '風球',  price: 150, color: '#80deea',
      desc: '推開周圍移動磚、讓其他球角度旋 30°、自身減速 -10% 3 秒。' },
    { id: 'ballWood', emoji: '🪵', name: '木球',  price: 120, color: '#8d6e63',
      desc: '碰磚塊時球速 ×0.5 短暫停留，每彈一次造成 2 倍傷害（hp-2）。' },
    { id: 'ballIron', emoji: '🔩', name: '鐵球',  price: 250, color: '#90a4ae',
      desc: '穿透 1.5 秒（不反彈直接穿過、扣 1 hp 連續），碰鋼磚/不可破中止。' },
  ];

  const PADDLE_GEARS = [
    { id: 'pgLightning', emoji: '⚡', name: '雷擋板',    price: 300, color: '#ffd54f',
      desc: '30% 機率讓彈回的球變「⚡電球」5 秒，對目標 +1 hp 額外傷害。' },
    { id: 'pgLight',     emoji: '🔆', name: '光擋板',    price: 200, color: '#fff59d',
      desc: '每次碰擋板瞬間閃光全螢幕 0.3 秒，所有隱藏磚立刻揭曉。' },
    { id: 'pgVortex',    emoji: '🌪', name: '旋風擋板',  price: 250, color: '#80deea',
      desc: '球碰擋板強制讓 vy 變強，打偏邊也不會水平來回死循環。' },
    { id: 'pgLucky',     emoji: '🎁', name: '福袋擋板',  price: 280, color: '#ce93d8',
      desc: '每碰擋板 5 次，下一發球變 ⭐ 福袋球、碰目標 +50 分 bonus。' },
    { id: 'pgMagnet',    emoji: '🧲', name: '磁吸擋板',  price: 400, color: '#ef9a9a',
      desc: '球距擋板上方 100px 內自動吸向擋板中心、不用 100% 精準。' },
  ];

  // 給 game.js 取用的查找表
  const ALL_ITEMS = ITEMS.concat(ATTACK_BALLS).concat(PADDLE_GEARS);
  const itemById = (id) => ALL_ITEMS.find(x => x.id === id);

  // ===== 狀態 =====
  function getMoney() { return parseInt(localStorage.getItem(MONEY_KEY), 10) || 0; }
  function setMoney(v) {
    localStorage.setItem(MONEY_KEY, String(Math.max(0, Math.floor(v))));
    syncHUD();
  }
  function addMoney(delta) { setMoney(getMoney() + delta); }

  function defaultInventory() {
    const inv = {};
    for (const it of ITEMS) inv[it.id] = 0;
    for (const it of ATTACK_BALLS) inv[it.id] = 0;
    inv.paddleGears = {};  // { pgLightning: 6 (=2次buy = 6關次), ... }
    for (const pg of PADDLE_GEARS) inv.paddleGears[pg.id] = 0;
    inv.equippedPaddle = null;  // 當前裝備的擋板 id
    inv.nextBallEffect = null;  // 下一發球的攻擊球效果（一次性）
    return inv;
  }
  function getInventory() {
    try {
      const o = JSON.parse(localStorage.getItem(INV_KEY)) || {};
      const def = defaultInventory();
      // 補齊新欄位
      for (const k in def) if (!(k in o)) o[k] = def[k];
      if (typeof o.paddleGears !== 'object' || !o.paddleGears) o.paddleGears = def.paddleGears;
      for (const pg of PADDLE_GEARS) if (!(pg.id in o.paddleGears)) o.paddleGears[pg.id] = 0;
      return o;
    } catch { return defaultInventory(); }
  }
  function setInventory(inv) {
    localStorage.setItem(INV_KEY, JSON.stringify(inv));
    syncHUD();
  }

  function buyItem(id) {
    const it = itemById(id);
    if (!it) return false;
    const money = getMoney();
    if (money < it.price) { flashHint('💸 餘額不足'); return false; }
    setMoney(money - it.price);
    const inv = getInventory();
    if (it.cat === 'item' || ATTACK_BALLS.includes(it)) {
      inv[id] = (inv[id] || 0) + 1;
    } else {
      // 擋板裝備：每買一次 +3 關次
      inv.paddleGears[id] = (inv.paddleGears[id] || 0) + PADDLE_GEAR_USES_PER_BUY;
    }
    setInventory(inv);
    flashHint(`✓ 買了 ${it.emoji} ${it.name}`);
    return true;
  }

  function consumeItem(id) {
    const inv = getInventory();
    if (!inv[id]) return false;
    inv[id]--;
    setInventory(inv);
    return true;
  }

  function equipPaddle(id) {
    const inv = getInventory();
    if (id && (!inv.paddleGears[id] || inv.paddleGears[id] <= 0)) return false;
    inv.equippedPaddle = id;
    setInventory(inv);
    return true;
  }
  function unequipPaddle() { equipPaddle(null); }

  // 通關時扣裝備次數
  function consumeEquippedPaddle() {
    const inv = getInventory();
    if (!inv.equippedPaddle) return;
    inv.paddleGears[inv.equippedPaddle] = Math.max(0, (inv.paddleGears[inv.equippedPaddle] || 0) - 1);
    if (inv.paddleGears[inv.equippedPaddle] <= 0) {
      flashHint(`⚠️ 裝備已用完，請至商店重買`);
      inv.equippedPaddle = null;
    }
    setInventory(inv);
  }

  // 設定下一發攻擊球（玩家點 HUD 攻擊球按鈕觸發）
  function setNextBallEffect(effect) {
    const inv = getInventory();
    inv.nextBallEffect = effect;
    setInventory(inv);
  }
  function takeNextBallEffect() {
    const inv = getInventory();
    const e = inv.nextBallEffect;
    inv.nextBallEffect = null;
    setInventory(inv);
    return e;
  }

  // ===== HUD =====
  function syncHUD() {
    const moneyEl = document.getElementById('hud-money');
    if (moneyEl) moneyEl.textContent = '💰' + getMoney();
    renderInventoryBar();
    renderEquippedBadge();
  }

  function renderEquippedBadge() {
    const b = document.getElementById('equipped-badge');
    if (!b) return;
    const inv = getInventory();
    if (!inv.equippedPaddle) { b.classList.add('hidden'); return; }
    const pg = PADDLE_GEARS.find(p => p.id === inv.equippedPaddle);
    if (!pg) { b.classList.add('hidden'); return; }
    const left = inv.paddleGears[pg.id] || 0;
    b.classList.remove('hidden');
    b.innerHTML = `${pg.emoji} ${pg.name} <span class="badge-uses">×${left}</span>`;
  }

  function renderInventoryBar() {
    const bar = document.getElementById('inventory-bar');
    if (!bar) return;
    const inv = getInventory();
    bar.innerHTML = '';
    let hasAny = false;
    // 一次性道具
    ITEMS.forEach(it => {
      if ((inv[it.id] || 0) > 0) {
        hasAny = true;
        bar.appendChild(makeInvBtn(it, inv[it.id], () => useItemFromInv(it.id)));
      }
    });
    // 下一發球指示（如果有預設）
    if (inv.nextBallEffect) {
      const ab = ATTACK_BALLS.find(b => b.id === inv.nextBallEffect);
      if (ab) {
        hasAny = true;
        const btn = makeInvBtn(ab, '✓', () => {
          // 取消下一發效果
          setNextBallEffect(null);
        });
        btn.classList.add('inv-btn-active');
        btn.title = '下一發：' + ab.name + '（點取消）';
        bar.appendChild(btn);
      }
    }
    // 攻擊球（庫存中）
    ATTACK_BALLS.forEach(ab => {
      if ((inv[ab.id] || 0) > 0 && inv.nextBallEffect !== ab.id) {
        hasAny = true;
        bar.appendChild(makeInvBtn(ab, inv[ab.id], () => useAttackBall(ab.id)));
      }
    });
    bar.classList.toggle('hidden', !hasAny);
  }

  function makeInvBtn(item, count, onClick) {
    const btn = document.createElement('button');
    btn.className = 'inv-btn';
    btn.title = `${item.name}（×${count}）`;
    btn.innerHTML = `<span class="inv-emoji">${item.emoji}</span><span class="inv-count">×${count}</span>`;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function useItemFromInv(id) {
    if (!window.MFSB || !window.MFSB.applyPowerupByType) return;
    if (!consumeItem(id)) return;
    window.MFSB.applyPowerupByType(id);
  }
  function useAttackBall(id) {
    // 設定下一發效果（不立刻消耗——直到實際發射才消耗）
    if (!consumeItem(id)) return;
    setNextBallEffect(id);
    flashHint(`🎯 下一發：${ATTACK_BALLS.find(a => a.id === id).name}`);
  }

  // ===== 商店畫面 =====
  let activeTab = 'item';
  function renderShop() {
    const money = getMoney();
    document.getElementById('shop-money').textContent = '💰 ' + money;
    // tab 同步
    document.querySelectorAll('.shop-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === activeTab);
    });
    const list = document.getElementById('shop-list');
    list.innerHTML = '';
    let arr;
    if (activeTab === 'item')   arr = ITEMS;
    else if (activeTab === 'ball') arr = ATTACK_BALLS;
    else arr = PADDLE_GEARS;
    const inv = getInventory();
    // 擋板 tab 頂部顯示「目前裝備」區
    if (activeTab === 'paddle') {
      const eq = document.createElement('div');
      eq.className = 'shop-equip-bar';
      if (inv.equippedPaddle) {
        const pg = PADDLE_GEARS.find(p => p.id === inv.equippedPaddle);
        const left = inv.paddleGears[pg.id] || 0;
        eq.innerHTML = `<span>目前裝備：${pg.emoji} <b>${pg.name}</b>（剩 ${left} 關）</span>
          <button class="ghost-btn small" id="shop-unequip-btn">取下</button>`;
      } else {
        eq.innerHTML = `<span>目前未裝備</span>`;
      }
      list.appendChild(eq);
      const u = eq.querySelector('#shop-unequip-btn');
      if (u) u.addEventListener('click', () => { unequipPaddle(); renderShop(); });
    }
    arr.forEach(it => {
      const own = (it.cat === 'item' || ATTACK_BALLS.includes(it))
        ? (inv[it.id] || 0)
        : (inv.paddleGears[it.id] || 0);
      const canBuy = money >= it.price;
      const isPaddle = PADDLE_GEARS.includes(it);
      const isEquipped = isPaddle && inv.equippedPaddle === it.id;
      const row = document.createElement('div');
      row.className = 'shop-item' + (canBuy ? '' : ' disabled');
      const ownText = isPaddle ? `(可用 ${own} 關)` : `(持有 ×${own})`;
      row.innerHTML = `
        <div class="shop-icon" style="color:${it.color || ''}">${it.emoji}</div>
        <div class="shop-info">
          <div class="shop-name">${it.name} <span class="shop-own">${ownText}</span>
            ${isEquipped ? '<span class="shop-equipped-tag">已裝備</span>' : ''}
          </div>
          <div class="shop-desc">${it.desc}</div>
        </div>
        <div class="shop-buy">
          <div class="shop-price">💰 ${it.price}</div>
          ${isPaddle ? `
            <button class="big-btn confirm small shop-buy-btn" ${canBuy ? '' : 'disabled'}>${canBuy ? '+3 關' : '不夠'}</button>
            ${own > 0 && !isEquipped ? `<button class="ghost-btn small shop-equip-btn">裝備</button>` : ''}
          ` : `
            <button class="big-btn confirm small shop-buy-btn" ${canBuy ? '' : 'disabled'}>${canBuy ? '購買' : '不夠'}</button>
          `}
        </div>`;
      const buy = row.querySelector('.shop-buy-btn');
      if (buy) buy.addEventListener('click', () => { if (buyItem(it.id)) renderShop(); });
      const eqBtn = row.querySelector('.shop-equip-btn');
      if (eqBtn) eqBtn.addEventListener('click', () => { equipPaddle(it.id); renderShop(); });
      list.appendChild(row);
    });
  }

  function openShop() {
    renderShop();
    if (window.MFSB) window.MFSB.showOverlay(document.getElementById('shop-screen'));
  }

  function flashHint(text) {
    const el = document.getElementById('shop-hint');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
    clearTimeout(flashHint._t);
    flashHint._t = setTimeout(() => el.classList.add('hidden'), 1800);
  }

  // ===== 對外 =====
  window.MFSB_SHOP = {
    ITEMS, ATTACK_BALLS, PADDLE_GEARS,
    getMoney, setMoney, addMoney,
    getInventory, consumeItem, equipPaddle, unequipPaddle, consumeEquippedPaddle,
    setNextBallEffect, takeNextBallEffect,
    syncHUD, openShop,
  };

  // ===== UI 事件 =====
  document.addEventListener('DOMContentLoaded', () => {
    syncHUD();
    document.querySelectorAll('.shop-tab').forEach(t => {
      t.addEventListener('click', () => {
        activeTab = t.dataset.tab;
        renderShop();
      });
    });
    const closeBtn = document.getElementById('shop-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => {
      if (window.MFSB) window.MFSB.showTitle();
    });
    const fromClearBtn = document.getElementById('shop-from-clear-btn');
    if (fromClearBtn) fromClearBtn.addEventListener('click', openShop);
    const homeShopBtn = document.getElementById('home-shop-btn');
    if (homeShopBtn) homeShopBtn.addEventListener('click', openShop);
  });
})();
