/* =========================================================
 *  Magic Fruit Splash Breaker - 關卡編輯器
 *  獨立模組；透過 window.MFSB API 控制遊戲
 * ========================================================= */
(() => {
  'use strict';

  const COLS = 12;
  const STORAGE_KEY = 'mfsb_custom_levels';

  // ===== 狀態 =====
  const ed = {
    grid: [],
    rows: 7,
    name: '我的關卡',
    speed: 400,
    theme: 'warm',
    selectedMat: 'B',
    mirrorMode: false,
    history: [],
    redo: [],
    editingId: null,
    drawingActive: false,
  };

  // ===== localStorage CRUD =====
  function loadAll() {
    try {
      const d = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (d && Array.isArray(d.levels)) return d;
    } catch (e) {}
    return { version: 1, levels: [] };
  }
  function saveAll(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
  function getEnabledCustomLevels() {
    return loadAll().levels.filter(l => l.enabled !== false);
  }
  function getAllCustomLevels() {
    return loadAll().levels;
  }
  function upsertLevel(lv) {
    const data = loadAll();
    const idx = data.levels.findIndex(l => l.id === lv.id);
    if (idx >= 0) data.levels[idx] = lv;
    else data.levels.push(lv);
    saveAll(data);
  }
  function deleteLevel(id) {
    const data = loadAll();
    data.levels = data.levels.filter(l => l.id !== id);
    saveAll(data);
  }
  function duplicateLevel(id) {
    const data = loadAll();
    const lv = data.levels.find(l => l.id === id);
    if (!lv) return;
    const copy = JSON.parse(JSON.stringify(lv));
    copy.id = newId();
    copy.name = lv.name + ' (副本)';
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    data.levels.push(copy);
    saveAll(data);
  }
  function toggleEnabled(id) {
    const data = loadAll();
    const lv = data.levels.find(l => l.id === id);
    if (!lv) return;
    lv.enabled = !(lv.enabled !== false); // 預設 enabled=true，切換
    saveAll(data);
  }
  function reorderLevels(orderIds) {
    const data = loadAll();
    data.levels.sort((a, b) => orderIds.indexOf(a.id) - orderIds.indexOf(b.id));
    saveAll(data);
  }
  function newId() {
    return 'lv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  // 對外暴露給 game.js
  window.MFSB_EDITOR = { getEnabledCustomLevels };

  // ===== DOM =====
  const editorScreen   = document.getElementById('editor-screen');
  const mylevelsScreen = document.getElementById('mylevels-screen');
  const templateScreen = document.getElementById('template-screen');
  const textDialog     = document.getElementById('text-dialog');
  const canvas = document.getElementById('ed-canvas');
  const ctx = canvas.getContext('2d');

  const nameInput = document.getElementById('ed-name');
  const speedInput = document.getElementById('ed-speed');
  const speedVal = document.getElementById('ed-speed-val');
  const rowsInput = document.getElementById('ed-rows');
  const rowsVal = document.getElementById('ed-rows-val');
  const themeInput = document.getElementById('ed-theme');
  const palette = document.getElementById('ed-palette');
  const mirrorBtn = document.getElementById('ed-mirror-btn');
  const undoBtn = document.getElementById('ed-undo-btn');
  const redoBtn = document.getElementById('ed-redo-btn');
  const clearBtn = document.getElementById('ed-clear-btn');
  const tplBtn = document.getElementById('ed-template-btn');
  const fillBtn = document.getElementById('ed-fill-btn');

  // ===== 工具：空 grid =====
  function makeEmptyGrid(rows) {
    return Array.from({ length: rows }, () => '.'.repeat(COLS));
  }

  // ===== 樣板 =====
  const TEMPLATES = [
    {
      name: '空白', emoji: '⬜', desc: '從零開始',
      data: { speed: 400, grid: makeEmptyGrid(7) },
    },
    {
      name: '整齊磚牆', emoji: '🟥', desc: '純磚 12×5，當熱身',
      data: {
        speed: 320,
        grid: [
          'BBBBBBBBBBBB',
          'BBBBBBBBBBBB',
          'BBBBBBBBBBBB',
          'BBBBBBBBBBBB',
          'BBBBBBBBBBBB',
        ],
      },
    },
    {
      name: '笑臉', emoji: '😊', desc: '可愛笑臉，初試水果',
      data: {
        speed: 380,
        grid: [
          '...BBBBBB...',
          '..BWWBBWWB..',
          '..BWWBBWWB..',
          '..BBBBBBBB..',
          '...B....B...',
          '...BFFFFB...',
          '....BBBB....',
        ],
      },
    },
    {
      name: '愛心', emoji: '❤️', desc: '愛心輪廓 + 水果填心',
      data: {
        speed: 420,
        grid: [
          '.BB.BBBB.BB.',
          'BFBBFBBFBBFB',
          'BWFFFFFFFFWB',
          '.BWFFFFFFWB.',
          '..BWFFFFWB..',
          '...BWFFWB...',
          '....BWWB....',
          '.....BB.....',
        ],
      },
    },
    {
      name: '星星', emoji: '⭐', desc: '五角星造型',
      data: {
        speed: 440,
        grid: [
          '.....BB.....',
          '.....FF.....',
          'BBBBBFFBBBBB',
          'BWWWWFFWWWWB',
          '.BBBFFFBBBB.',
          '...BBFFBB...',
          '..BB....BB..',
        ],
      },
    },
    {
      name: '漏斗', emoji: '⏳', desc: '倒三角，越底越硬',
      data: {
        speed: 480,
        grid: [
          'BBBBBBBBBBBB',
          '.WWWWWWWWWW.',
          '..OOOOOOOO..',
          '...SSSSSS...',
          '....FFFF....',
          '.....BB.....',
        ],
      },
    },
    {
      name: 'BOSS 臉', emoji: '👑', desc: '皇冠 + 雙眼 + 嘴',
      data: {
        speed: 600,
        grid: [
          '.B.B.BB.B.B.',
          'BBBBBBBBBBBB',
          'BWWBBBBBBWWB',
          'BWWB.OO.BWWB',
          'BBBBOOOOBBBB',
          'BBBBBBBBBBBB',
          '.FFFFSSFFFF.',
          '..FFSFFSFF..',
          '...FFFFFF...',
        ],
      },
    },
    {
      name: '鋼鐵迷宮', emoji: '🛡️', desc: '鋼磚 + 不可破，挑戰角度',
      data: {
        speed: 460,
        grid: [
          'XHXHXHXHXHXH',
          'HBBBBBBBBBBH',
          'X.W?G?W.G?WX',
          'HBBBBBBBBBBH',
          'X.GZ.NN.ZG.X',
          'HBBBBBBBBBBH',
        ],
      },
    },
    {
      name: '隨機寶藏', emoji: '🎁', desc: '神秘箱+寶石+鋼磚混搭',
      data: {
        speed: 420,
        grid: [
          '?G?G?G?G?G?G',
          'BWBWBWBWBWBW',
          'HBHBHBHBHBHB',
          '..NNNNNNNN..',
          'GHGHGHGHGHGH',
          'BBBBBBBBBBBB',
        ],
      },
    },
  ];

  // ===== 歷史 =====
  function snapshot() {
    return ed.grid.slice();
  }
  function pushHistory() {
    ed.history.push(snapshot());
    if (ed.history.length > 80) ed.history.shift();
    ed.redo.length = 0;
  }
  function undo() {
    if (!ed.history.length) return;
    ed.redo.push(snapshot());
    ed.grid = ed.history.pop();
    render();
  }
  function redo() {
    if (!ed.redo.length) return;
    ed.history.push(snapshot());
    ed.grid = ed.redo.pop();
    render();
  }

  // ===== 編輯 grid 一格 =====
  function setCell(r, c, ch) {
    if (r < 0 || r >= ed.grid.length || c < 0 || c >= COLS) return false;
    const row = ed.grid[r];
    if (row[c] === ch) return false;
    ed.grid[r] = row.slice(0, c) + ch + row.slice(c + 1);
    return true;
  }
  function paintAt(r, c) {
    let changed = setCell(r, c, ed.selectedMat);
    if (ed.mirrorMode) {
      const mirrorC = COLS - 1 - c;
      if (mirrorC !== c) changed = setCell(r, mirrorC, ed.selectedMat) || changed;
    }
    if (changed) render();
  }

  // ===== 渲染編輯器 canvas =====
  function render() {
    const W = canvas.width;
    const rows = ed.grid.length;
    const cellW = (W - 12) / COLS;
    const cellH = cellW * 0.62;
    const totalH = rows * (cellH + 2) + 10;
    if (Math.abs(canvas.height - totalH) > 2) {
      canvas.height = Math.max(120, Math.min(900, totalH));
    }
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    // 背景
    ctx.fillStyle = '#fff8e1';
    roundRect(ctx, 0, 0, W, H, 10); ctx.fill();
    // 格線
    ctx.strokeStyle = 'rgba(120,120,120,0.18)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= rows; r++) {
      const y = 6 + r * (cellH + 2);
      ctx.beginPath(); ctx.moveTo(6, y); ctx.lineTo(W - 6, y); ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      const x = 6 + c * cellW;
      ctx.beginPath(); ctx.moveTo(x, 6); ctx.lineTo(x, 6 + rows * (cellH + 2)); ctx.stroke();
    }
    // 鏡像中軸
    if (ed.mirrorMode) {
      ctx.strokeStyle = 'rgba(120, 30, 200, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      const mx = 6 + (COLS / 2) * cellW;
      ctx.moveTo(mx, 6); ctx.lineTo(mx, 6 + rows * (cellH + 2));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // 格子內容
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.floor(cellH * 0.8)}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`;
    for (let r = 0; r < rows; r++) {
      const row = ed.grid[r];
      for (let c = 0; c < COLS; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        const x = 6 + c * cellW + cellW / 2;
        const y = 6 + r * (cellH + 2) + cellH / 2 + 2;
        drawCellGlyph(ch, x, y, cellW, cellH);
      }
    }
  }

  const CELL_COLORS = {
    'B': '#ef5350','W': '#4fc3f7','F': '#e53935','S': '#ec407a','O': '#ffa726',
    'H': '#90a4ae','X': '#37474f','G': '#42a5f5','?': '#ab47bc','N': '#9575cd','Z': '#fdd835',
  };

  function drawCellGlyph(ch, x, y, w, h) {
    const r = Math.min(w, h) * 0.4;
    const bg = CELL_COLORS[ch] || '#999';
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(h * 0.55)}px "Apple Color Emoji","Segoe UI Emoji","Comic Sans MS",sans-serif`;
    const emoji = ({
      'B':'■','W':'💧','F':'🍉','S':'🍓','O':'🍊',
      'H':'🛡','X':'⛔','G':'💎','?':'?','N':'?','Z':'⚡',
    })[ch] || ch;
    ctx.fillText(emoji, x, y);
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ===== 觸控 / 滑鼠 =====
  function eventToRC(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) * (canvas.width / rect.width);
    const cy = ((e.touches ? e.touches[0].clientY : e.clientY) - rect.top)  * (canvas.height / rect.height);
    const cellW = (canvas.width - 12) / COLS;
    const cellH = cellW * 0.62;
    const c = Math.floor((cx - 6) / cellW);
    const r = Math.floor((cy - 6) / (cellH + 2));
    return { r, c };
  }

  let lastRC = { r: -1, c: -1 };
  function onPointerDown(e) {
    e.preventDefault();
    pushHistory();
    ed.drawingActive = true;
    const { r, c } = eventToRC(e);
    paintAt(r, c);
    lastRC = { r, c };
  }
  function onPointerMove(e) {
    if (!ed.drawingActive) return;
    e.preventDefault();
    const { r, c } = eventToRC(e);
    if (r === lastRC.r && c === lastRC.c) return;
    paintAt(r, c);
    lastRC = { r, c };
  }
  function onPointerUp() { ed.drawingActive = false; lastRC = { r: -1, c: -1 }; }

  canvas.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('touchstart', onPointerDown, { passive: false });
  canvas.addEventListener('touchmove',  onPointerMove,  { passive: false });
  canvas.addEventListener('touchend',   onPointerUp);
  canvas.addEventListener('touchcancel',onPointerUp);

  // ===== 工具列事件 =====
  palette.querySelectorAll('.ed-tile').forEach(btn => {
    btn.addEventListener('click', () => {
      palette.querySelectorAll('.ed-tile').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ed.selectedMat = btn.dataset.mat;
    });
  });

  mirrorBtn.addEventListener('click', () => {
    ed.mirrorMode = !ed.mirrorMode;
    mirrorBtn.classList.toggle('active', ed.mirrorMode);
    render();
  });
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  clearBtn.addEventListener('click', () => {
    if (!confirm('確定全部清空？')) return;
    pushHistory();
    ed.grid = makeEmptyGrid(ed.rows);
    render();
  });
  fillBtn.addEventListener('click', () => {
    pushHistory();
    ed.grid = ed.grid.map(() => ed.selectedMat.repeat(COLS));
    render();
  });
  tplBtn.addEventListener('click', () => openTemplates());

  // ===== 屬性面板事件 =====
  nameInput.addEventListener('input', () => { ed.name = nameInput.value || '我的關卡'; });
  speedInput.addEventListener('input', () => {
    ed.speed = parseInt(speedInput.value, 10);
    speedVal.textContent = ed.speed;
  });
  rowsInput.addEventListener('input', () => {
    const newRows = parseInt(rowsInput.value, 10);
    rowsVal.textContent = newRows;
    if (newRows === ed.rows) return;
    pushHistory();
    if (newRows > ed.rows) {
      while (ed.grid.length < newRows) ed.grid.push('.'.repeat(COLS));
    } else {
      ed.grid.length = newRows;
    }
    ed.rows = newRows;
    render();
  });
  themeInput.addEventListener('change', () => { ed.theme = themeInput.value; });

  // ===== 動作 =====
  document.getElementById('ed-save-btn').addEventListener('click', saveCurrent);
  document.getElementById('ed-test-btn').addEventListener('click', testPlayCurrent);
  document.getElementById('ed-export-btn').addEventListener('click', exportCurrent);
  document.getElementById('ed-back-btn').addEventListener('click', () => {
    if (window.MFSB) window.MFSB.showOverlay(document.getElementById('dev-screen'));
  });
  document.getElementById('ed-mylevels-btn').addEventListener('click', () => openMyLevels());

  function currentLevelObject() {
    return {
      id: ed.editingId || newId(),
      name: ed.name || '我的關卡',
      speed: ed.speed,
      theme: ed.theme,
      grid: ed.grid.slice(),
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  function saveCurrent() {
    const lv = currentLevelObject();
    if (ed.editingId) {
      const data = loadAll();
      const exist = data.levels.find(l => l.id === ed.editingId);
      if (exist) {
        Object.assign(exist, lv, { id: ed.editingId, createdAt: exist.createdAt });
        saveAll(data);
        alert('已更新「' + lv.name + '」');
        return;
      }
    }
    ed.editingId = lv.id;
    upsertLevel(lv);
    alert('已存檔「' + lv.name + '」');
  }

  function testPlayCurrent() {
    const lv = currentLevelObject();
    // 空關卡？至少有一個目標再讓他玩
    if (lv.grid.every(row => /^\.+$/.test(row))) {
      alert('還沒有任何素材，先在格子上塗一些再試玩');
      return;
    }
    if (!window.MFSB) return;
    window.MFSB.startTestPlay(lv);
  }

  function exportCurrent() {
    const lv = currentLevelObject();
    openTextDialog('📤 匯出關卡 (複製 JSON)', JSON.stringify(lv, null, 2), null);
  }

  // ===== 開啟編輯器：新建 / 編輯 =====
  function openEditor(lv) {
    if (lv) {
      ed.editingId = lv.id;
      ed.name = lv.name;
      ed.speed = lv.speed;
      ed.theme = lv.theme || 'warm';
      ed.grid = lv.grid.slice();
      ed.rows = ed.grid.length;
    } else {
      ed.editingId = null;
      ed.name = nextLevelName();
      ed.speed = 400;
      ed.theme = 'warm';
      ed.rows = 7;
      ed.grid = makeEmptyGrid(7);
    }
    ed.history.length = 0;
    ed.redo.length = 0;
    nameInput.value = ed.name;
    speedInput.value = ed.speed;
    speedVal.textContent = ed.speed;
    rowsInput.value = ed.rows;
    rowsVal.textContent = ed.rows;
    themeInput.value = ed.theme;
    mirrorBtn.classList.toggle('active', ed.mirrorMode);
    if (window.MFSB) window.MFSB.showOverlay(editorScreen);
    requestAnimationFrame(render);
  }

  function nextLevelName() {
    const arr = getAllCustomLevels();
    return '我的關卡 ' + (arr.length + 1);
  }

  // ===== 我的關卡列表 =====
  function openMyLevels() {
    renderMyLevels();
    if (window.MFSB) window.MFSB.showOverlay(mylevelsScreen);
  }

  function renderMyLevels() {
    const list = document.getElementById('ml-list');
    const empty = document.getElementById('ml-empty');
    const arr = getAllCustomLevels();
    document.getElementById('ml-count').textContent = '(' + arr.length + ')';
    if (!arr.length) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    list.innerHTML = '';
    arr.forEach((lv, idx) => {
      const card = document.createElement('div');
      card.className = 'ml-card' + ((lv.enabled === false) ? ' disabled' : '');
      card.draggable = true;
      card.dataset.id = lv.id;
      const targetCount = lv.grid.reduce((s, row) => s + [...row].filter(c => c !== '.').length, 0);
      card.innerHTML = `
        <div class="ml-handle" title="拖曳調整順序">☰</div>
        <div class="ml-info">
          <div class="ml-name"></div>
          <div class="ml-meta"></div>
        </div>
        <button class="ml-toggle ${lv.enabled === false ? '' : 'on'}" title="啟用/停用"></button>
        <div class="ml-actions">
          <button class="ml-action" data-act="edit"   title="編輯">✏️</button>
          <button class="ml-action" data-act="play"   title="試玩">▶</button>
          <button class="ml-action" data-act="copy"   title="複製">📋</button>
          <button class="ml-action danger" data-act="del" title="刪除">🗑</button>
        </div>`;
      card.querySelector('.ml-name').textContent = lv.name;
      card.querySelector('.ml-meta').textContent =
        `${lv.grid.length} 排 · ${targetCount} 目標 · 速度 ${lv.speed}`;
      card.querySelector('.ml-toggle').addEventListener('click', () => {
        toggleEnabled(lv.id);
        renderMyLevels();
      });
      card.querySelectorAll('.ml-action').forEach(btn => {
        btn.addEventListener('click', () => onCardAction(lv, btn.dataset.act));
      });
      attachDragHandlers(card, list);
      list.appendChild(card);
    });
  }

  function onCardAction(lv, act) {
    if (act === 'edit') openEditor(lv);
    else if (act === 'play') {
      if (window.MFSB) window.MFSB.startTestPlay(lv);
    } else if (act === 'copy') {
      duplicateLevel(lv.id);
      renderMyLevels();
    } else if (act === 'del') {
      if (confirm('刪除「' + lv.name + '」？此動作無法復原。')) {
        deleteLevel(lv.id);
        renderMyLevels();
      }
    }
  }

  // ===== 拖曳排序 =====
  let dragSrc = null;
  function attachDragHandlers(card, list) {
    card.addEventListener('dragstart', (e) => {
      dragSrc = card;
      card.classList.add('dragging');
      try { e.dataTransfer.setData('text/plain', card.dataset.id); } catch (_) {}
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      dragSrc = null;
      const order = [...list.children].map(el => el.dataset.id);
      reorderLevels(order);
    });
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!dragSrc || dragSrc === card) return;
      const rect = card.getBoundingClientRect();
      const before = (e.clientY - rect.top) < rect.height / 2;
      if (before) list.insertBefore(dragSrc, card);
      else list.insertBefore(dragSrc, card.nextSibling);
    });
  }

  // ===== 樣板選單 =====
  function openTemplates() {
    const grid = document.getElementById('tpl-grid');
    grid.innerHTML = '';
    TEMPLATES.forEach((tpl, i) => {
      const card = document.createElement('button');
      card.className = 'tpl-card';
      card.innerHTML = `
        <div class="tpl-card-emoji">${tpl.emoji}</div>
        <div class="tpl-card-name"></div>
        <div class="tpl-card-desc"></div>`;
      card.querySelector('.tpl-card-name').textContent = tpl.name;
      card.querySelector('.tpl-card-desc').textContent = tpl.desc;
      card.addEventListener('click', () => {
        pushHistory();
        ed.grid = tpl.data.grid.slice();
        ed.rows = ed.grid.length;
        rowsInput.value = ed.rows;
        rowsVal.textContent = ed.rows;
        if (tpl.data.speed) {
          ed.speed = tpl.data.speed;
          speedInput.value = ed.speed;
          speedVal.textContent = ed.speed;
        }
        if (window.MFSB) window.MFSB.showOverlay(editorScreen);
        render();
      });
      grid.appendChild(card);
    });
    if (window.MFSB) window.MFSB.showOverlay(templateScreen);
  }

  document.getElementById('tpl-back-btn').addEventListener('click', () => {
    if (window.MFSB) window.MFSB.showOverlay(editorScreen);
  });

  // ===== 我的關卡頁的按鈕 =====
  document.getElementById('ml-back-btn').addEventListener('click', () => {
    if (window.MFSB) window.MFSB.showOverlay(document.getElementById('dev-screen'));
  });
  document.getElementById('ml-editor-btn').addEventListener('click', () => openEditor(null));
  document.getElementById('ml-new-btn').addEventListener('click', () => openEditor(null));
  document.getElementById('ml-template-btn').addEventListener('click', () => {
    openEditor(null);
    setTimeout(() => openTemplates(), 50);
  });
  document.getElementById('ml-import-btn').addEventListener('click', importDialog);
  document.getElementById('ml-export-all-btn').addEventListener('click', () => {
    const data = loadAll();
    openTextDialog('📤 匯出全部 (複製 JSON)', JSON.stringify(data, null, 2), null);
  });

  // ===== 開發者模式入口按鈕（綁定到主畫面開發者面板） =====
  document.getElementById('dev-open-editor-btn').addEventListener('click', () => openEditor(null));
  document.getElementById('dev-open-mylevels-btn').addEventListener('click', () => openMyLevels());

  // ===== 文字 dialog（匯入/匯出共用） =====
  function openTextDialog(title, content, onConfirm) {
    document.getElementById('td-title').textContent = title;
    const ta = document.getElementById('td-textarea');
    ta.value = content || '';
    ta.readOnly = !onConfirm;
    document.getElementById('td-confirm-btn').style.display = onConfirm ? '' : 'none';
    document.getElementById('td-copy-btn').style.display = onConfirm ? 'none' : '';
    if (window.MFSB) window.MFSB.showOverlay(textDialog);
    textDialog._onConfirm = onConfirm;
  }
  document.getElementById('td-copy-btn').addEventListener('click', () => {
    const ta = document.getElementById('td-textarea');
    ta.select();
    try {
      navigator.clipboard.writeText(ta.value).then(() => alert('已複製到剪貼簿'));
    } catch {
      document.execCommand('copy');
      alert('已複製');
    }
  });
  document.getElementById('td-confirm-btn').addEventListener('click', () => {
    const ta = document.getElementById('td-textarea');
    const cb = textDialog._onConfirm;
    if (cb) cb(ta.value);
  });
  document.getElementById('td-cancel-btn').addEventListener('click', () => {
    if (window.MFSB) window.MFSB.showOverlay(mylevelsScreen);
  });

  function importDialog() {
    openTextDialog('📥 貼上 JSON 匯入關卡', '', (text) => {
      try {
        const obj = JSON.parse(text);
        const data = loadAll();
        // 支援單張關卡或整包格式
        if (Array.isArray(obj.levels)) {
          obj.levels.forEach(lv => {
            if (!lv.id) lv.id = newId();
            const exist = data.levels.find(l => l.id === lv.id);
            if (exist) Object.assign(exist, lv);
            else data.levels.push(lv);
          });
        } else if (obj.grid) {
          if (!obj.id) obj.id = newId();
          obj.createdAt = obj.createdAt || Date.now();
          obj.updatedAt = Date.now();
          const exist = data.levels.find(l => l.id === obj.id);
          if (exist) Object.assign(exist, obj);
          else data.levels.push(obj);
        } else {
          alert('JSON 格式不正確'); return;
        }
        saveAll(data);
        alert('匯入成功');
        if (window.MFSB) window.MFSB.showOverlay(mylevelsScreen);
        renderMyLevels();
      } catch (e) {
        alert('JSON 解析失敗: ' + e.message);
      }
    });
  }

  // ===== 鍵盤捷徑 =====
  window.addEventListener('keydown', (e) => {
    if (!editorScreen.classList.contains('hidden')) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); }
      if (e.key === 'm' || e.key === 'M') {
        ed.mirrorMode = !ed.mirrorMode;
        mirrorBtn.classList.toggle('active', ed.mirrorMode);
        render();
      }
    }
  });

  // ===== 試玩結束的 callback =====
  window.MFSB_EDITOR.onTestPlayEnd = (won, finalScore) => {
    setTimeout(() => {
      if (window.MFSB) window.MFSB.showOverlay(editorScreen);
      alert(won ? `試玩過關！分數 ${finalScore}` : '試玩結束');
    }, 600);
  };

  // 初始化 grid（避免 render 時 ed.grid 為空）
  ed.grid = makeEmptyGrid(ed.rows);
  // 初始 render 在開啟時做
})();
