/* =========================================================
 *  Magic Fruit Splash Breaker - 商店與金錢系統
 *  通關後得分入袋 → 商店買道具 → 下一關用
 * ========================================================= */
(() => {
  'use strict';

  const MONEY_KEY = 'mfsb_money';
  const INV_KEY   = 'mfsb_inventory';

  // 道具定義：價格與效果說明
  const SHOP_ITEMS = [
    { id: 'wide',   emoji: '↔️', name: '擋板變寬', price: 100,
      desc: '進關時擋板 1.5× 大，持續 10 秒。錯失球的容錯神器。' },
    { id: 'slow',   emoji: '🐢', name: '慢速球',  price: 150,
      desc: '所有球速 ×0.7，持續 8 秒。讓你看清楚每一球。' },
    { id: 'multi',  emoji: '⚪', name: '多球',    price: 250,
      desc: '立刻多 2 顆額外球，掉光不算失敗。' },
    { id: 'double', emoji: '✖2', name: '雙倍分',  price: 200,
      desc: '10 秒內所有得分 ×2。配連擊更香。' },
    { id: 'gem',    emoji: '💎', name: '寶石 +50', price: 30,
      desc: '直接加 50 分，可累積。便宜小確幸。' },
    { id: 'extraBall', emoji: '⭕', name: '額外儲備球', price: 180,
      desc: '進該關時 +1 顆儲備球，只限挑戰模式。' },
  ];

  // ===== 狀態 =====
  function getMoney() {
    return parseInt(localStorage.getItem(MONEY_KEY), 10) || 0;
  }
  function setMoney(v) {
    localStorage.setItem(MONEY_KEY, String(Math.max(0, Math.floor(v))));
    syncHUD();
  }
  function addMoney(delta) { setMoney(getMoney() + delta); }

  function getInventory() {
    try {
      const o = JSON.parse(localStorage.getItem(INV_KEY)) || {};
      // 補齊欄位
      for (const it of SHOP_ITEMS) if (!(it.id in o)) o[it.id] = 0;
      return o;
    } catch {
      const o = {}; for (const it of SHOP_ITEMS) o[it.id] = 0;
      return o;
    }
  }
  function setInventory(inv) {
    localStorage.setItem(INV_KEY, JSON.stringify(inv));
    syncHUD();
  }

  function buyItem(id) {
    const it = SHOP_ITEMS.find(x => x.id === id);
    if (!it) return false;
    const money = getMoney();
    if (money < it.price) {
      flashHint('💸 餘額不足');
      return false;
    }
    setMoney(money - it.price);
    const inv = getInventory();
    inv[id] = (inv[id] || 0) + 1;
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

  // ===== HUD 同步 =====
  function syncHUD() {
    const moneyEl = document.getElementById('hud-money');
    if (moneyEl) moneyEl.textContent = '💰' + getMoney();
    renderInventoryBar();
  }

  // ===== 庫存按鈕列（遊戲中 HUD 下方） =====
  function renderInventoryBar() {
    const bar = document.getElementById('inventory-bar');
    if (!bar) return;
    const inv = getInventory();
    const items = SHOP_ITEMS.filter(it => (inv[it.id] || 0) > 0);
    bar.innerHTML = '';
    bar.classList.toggle('hidden', items.length === 0);
    items.forEach(it => {
      const btn = document.createElement('button');
      btn.className = 'inv-btn';
      btn.title = `${it.name}（×${inv[it.id]}）`;
      btn.innerHTML = `<span class="inv-emoji">${it.emoji}</span><span class="inv-count">×${inv[it.id]}</span>`;
      btn.addEventListener('click', () => {
        useInventoryItem(it.id);
      });
      bar.appendChild(btn);
    });
  }

  // 使用道具：套用效果並消耗 1
  function useInventoryItem(id) {
    if (!window.MFSB || !window.MFSB.applyPowerupByType) return;
    if (!consumeItem(id)) return;
    window.MFSB.applyPowerupByType(id);
  }

  // ===== 商店畫面 =====
  function renderShop() {
    const list = document.getElementById('shop-list');
    if (!list) return;
    const money = getMoney();
    document.getElementById('shop-money').textContent = '💰 ' + money;
    const inv = getInventory();
    list.innerHTML = '';
    SHOP_ITEMS.forEach(it => {
      const own = inv[it.id] || 0;
      const canBuy = money >= it.price;
      const row = document.createElement('div');
      row.className = 'shop-item' + (canBuy ? '' : ' disabled');
      row.innerHTML = `
        <div class="shop-icon">${it.emoji}</div>
        <div class="shop-info">
          <div class="shop-name">${it.name} <span class="shop-own">(持有 ×${own})</span></div>
          <div class="shop-desc">${it.desc}</div>
        </div>
        <div class="shop-buy">
          <div class="shop-price">💰 ${it.price}</div>
          <button class="big-btn confirm small shop-buy-btn" ${canBuy ? '' : 'disabled'}>${canBuy ? '購買' : '不夠'}</button>
        </div>`;
      row.querySelector('.shop-buy-btn').addEventListener('click', () => {
        if (buyItem(it.id)) renderShop();
      });
      list.appendChild(row);
    });
  }

  function openShop() {
    renderShop();
    if (window.MFSB) window.MFSB.showOverlay(document.getElementById('shop-screen'));
  }
  function closeShop() {
    if (window.MFSB) window.MFSB.showTitle();
  }
  // 從過關畫面進商店
  function openShopFromClear() {
    renderShop();
    if (window.MFSB) window.MFSB.showOverlay(document.getElementById('shop-screen'));
  }

  // ===== 提示閃字 =====
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
    SHOP_ITEMS,
    getMoney,
    setMoney,
    addMoney,
    getInventory,
    consumeItem,
    syncHUD,
    openShop,
    closeShop,
    openShopFromClear,
    renderInventoryBar,
  };

  // ===== UI 事件 =====
  document.addEventListener('DOMContentLoaded', () => {
    // 開頭同步一次
    syncHUD();
    const closeBtn = document.getElementById('shop-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => {
      if (window.MFSB) window.MFSB.showTitle();
    });
    const fromClearBtn = document.getElementById('shop-from-clear-btn');
    if (fromClearBtn) fromClearBtn.addEventListener('click', () => {
      openShop();
    });
    const homeShopBtn = document.getElementById('home-shop-btn');
    if (homeShopBtn) homeShopBtn.addEventListener('click', () => {
      openShop();
    });
  });
})();
