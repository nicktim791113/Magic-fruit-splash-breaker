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
    tool: 'paint',            // 'paint' | 'rect' | 'pick' | 'bucket'
    rectStart: null,          // { r, c } 框選起點
    rectEnd: null,
    hoverRC: null,            // 滑鼠 hover 中的格子
    history: [],
    redo: [],
    editingId: null,
    drawingActive: false,
  };
  const DRAFT_KEY = 'mfsb_editor_draft';

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

  // ===== 遊玩統計 =====
  function recordPlayStats(id, finalScore, won) {
    if (!id) return;
    const data = loadAll();
    const lv = data.levels.find(l => l.id === id);
    if (!lv) return;
    lv.stats = lv.stats || { playCount: 0, highScore: 0, lastPlayed: 0 };
    lv.stats.playCount++;
    if (won && finalScore > (lv.stats.highScore || 0)) lv.stats.highScore = finalScore;
    lv.stats.lastPlayed = Date.now();
    saveAll(data);
  }

  // ===== 最近編輯 =====
  function recordRecentEdit(id) {
    if (!id) return;
    try {
      const arr = JSON.parse(localStorage.getItem('mfsb_recent_edits') || '[]');
      const filtered = arr.filter(x => x !== id);
      filtered.unshift(id);
      localStorage.setItem('mfsb_recent_edits', JSON.stringify(filtered.slice(0, 5)));
    } catch {}
  }
  function getRecentEdits() {
    try {
      return JSON.parse(localStorage.getItem('mfsb_recent_edits') || '[]');
    } catch { return []; }
  }

  // 對外暴露給 game.js
  window.MFSB_EDITOR = {
    getEnabledCustomLevels,
    recordPlayStats,
    onCustomPlayEnd(won, finalScore) {
      // 從我的關卡試玩過關 → 回我的關卡頁
      setTimeout(() => {
        if (window.MFSB) window.MFSB.showOverlay(mylevelsScreen);
        renderMyLevels();
      }, 800);
    },
  };

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
  const paintBtn = document.getElementById('ed-paint-btn');
  const rectBtn = document.getElementById('ed-rect-btn');
  const pickBtn = document.getElementById('ed-pick-btn');
  const bucketBtn = document.getElementById('ed-bucket-btn');
  const mirrorBtn = document.getElementById('ed-mirror-btn');
  const undoBtn = document.getElementById('ed-undo-btn');
  const redoBtn = document.getElementById('ed-redo-btn');
  const clearBtn = document.getElementById('ed-clear-btn');
  const tplBtn = document.getElementById('ed-template-btn');
  const fillBtn = document.getElementById('ed-fill-btn');
  const replaceBtn = document.getElementById('ed-replace-btn');
  const flipHBtn = document.getElementById('ed-flipH-btn');
  const flipVBtn = document.getElementById('ed-flipV-btn');
  const rotBtn = document.getElementById('ed-rot-btn');
  const randomBtn = document.getElementById('ed-random-btn');
  const helpBtn = document.getElementById('ed-help-btn');
  const helpDrawer = document.getElementById('ed-help-drawer');
  const helpCloseBtn = document.getElementById('ed-help-close');
  const shareBtn = document.getElementById('ed-share-btn');
  // 統計區
  const statTotal = document.getElementById('ed-stat-total');
  const statDiff  = document.getElementById('ed-stat-diff');
  const statBreakdown = document.getElementById('ed-stat-breakdown');
  const statHint  = document.getElementById('ed-stat-hint');

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
    if (ed.history.length > 200) ed.history.shift(); // 撤銷層級從 80 → 200
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

  // 行列標尺尺寸
  const RULER_W = 22, RULER_H = 18;

  // ===== 渲染編輯器 canvas =====
  function render() {
    const W = canvas.width;
    const rows = ed.grid.length;
    const cellW = (W - 12 - RULER_W) / COLS;
    const cellH = cellW * 0.62;
    const totalH = rows * (cellH + 2) + 10 + RULER_H;
    if (Math.abs(canvas.height - totalH) > 2) {
      canvas.height = Math.max(140, Math.min(900, totalH));
    }
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    // 背景
    ctx.fillStyle = '#fff8e1';
    roundRect(ctx, 0, 0, W, H, 10); ctx.fill();

    const ox = 6 + RULER_W;  // 格子起始 X
    const oy = 6 + RULER_H;  // 格子起始 Y

    // 行列標尺（A-L、1-N）
    ctx.fillStyle = '#90a4ae';
    ctx.font = 'bold 11px "Comic Sans MS", "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 上邊：A B C ... L（12 個）
    for (let c = 0; c < COLS; c++) {
      const x = ox + c * cellW + cellW / 2;
      ctx.fillText(String.fromCharCode(65 + c), x, oy - RULER_H / 2);
    }
    // 左邊：1 2 3 ... N
    for (let r = 0; r < rows; r++) {
      const y = oy + r * (cellH + 2) + cellH / 2;
      ctx.fillText(String(r + 1), ox - RULER_W / 2, y);
    }

    // 格線
    ctx.strokeStyle = 'rgba(120,120,120,0.18)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= rows; r++) {
      const y = oy + r * (cellH + 2);
      ctx.beginPath(); ctx.moveTo(ox, y); ctx.lineTo(ox + COLS * cellW, y); ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      const x = ox + c * cellW;
      ctx.beginPath(); ctx.moveTo(x, oy); ctx.lineTo(x, oy + rows * (cellH + 2)); ctx.stroke();
    }
    // 鏡像中軸
    if (ed.mirrorMode) {
      ctx.strokeStyle = 'rgba(120, 30, 200, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      const mx = ox + (COLS / 2) * cellW;
      ctx.moveTo(mx, oy); ctx.lineTo(mx, oy + rows * (cellH + 2));
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
        const x = ox + c * cellW + cellW / 2;
        const y = oy + r * (cellH + 2) + cellH / 2 + 2;
        drawCellGlyph(ch, x, y, cellW, cellH);
      }
    }

    // hover 預覽（半透明顯示要塗的素材）
    if (ed.hoverRC && (ed.tool === 'paint' || ed.tool === 'bucket') && ed.selectedMat !== '.') {
      const { r, c } = ed.hoverRC;
      if (r >= 0 && r < rows && c >= 0 && c < COLS) {
        const x = ox + c * cellW + cellW / 2;
        const y = oy + r * (cellH + 2) + cellH / 2 + 2;
        ctx.globalAlpha = 0.4;
        drawCellGlyph(ed.selectedMat, x, y, cellW, cellH);
        ctx.globalAlpha = 1;
        // 鏡像 hover 預覽
        if (ed.mirrorMode) {
          const mc = COLS - 1 - c;
          if (mc !== c) {
            const x2 = ox + mc * cellW + cellW / 2;
            ctx.globalAlpha = 0.4;
            drawCellGlyph(ed.selectedMat, x2, y, cellW, cellH);
            ctx.globalAlpha = 1;
          }
        }
      }
    }

    // 框選預覽
    if (ed.tool === 'rect' && ed.rectStart && ed.rectEnd) {
      const r0 = Math.min(ed.rectStart.r, ed.rectEnd.r);
      const r1 = Math.max(ed.rectStart.r, ed.rectEnd.r);
      const c0 = Math.min(ed.rectStart.c, ed.rectEnd.c);
      const c1 = Math.max(ed.rectStart.c, ed.rectEnd.c);
      const x = ox + c0 * cellW;
      const y = oy + r0 * (cellH + 2);
      const w = (c1 - c0 + 1) * cellW;
      const h = (r1 - r0 + 1) * (cellH + 2) - 2;
      ctx.fillStyle = 'rgba(255, 152, 0, 0.18)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#ff6f00';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }

    // 更新統計
    updateStats();
  }

  const CELL_COLORS = {
    'B': '#ef5350','W': '#4fc3f7','F': '#e53935','S': '#ec407a','O': '#ffa726',
    'H': '#90a4ae','X': '#37474f','G': '#42a5f5','?': '#ab47bc','N': '#9575cd','Z': '#fdd835',
    'M': '#9c27b0','K': '#ffb300','L': '#6d4c41',
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
      'M':'↔','K':'🔑','L':'🔒',
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
    const cellW = (canvas.width - 12 - RULER_W) / COLS;
    const cellH = cellW * 0.62;
    const c = Math.floor((cx - 6 - RULER_W) / cellW);
    const r = Math.floor((cy - 6 - RULER_H) / (cellH + 2));
    return { r, c };
  }

  let lastRC = { r: -1, c: -1 };
  function onPointerDown(e) {
    e.preventDefault();
    const { r, c } = eventToRC(e);
    if (r < 0 || r >= ed.grid.length || c < 0 || c >= COLS) return;
    ed.drawingActive = true;
    if (ed.tool === 'rect') {
      ed.rectStart = { r: clampRow(r), c: clampCol(c) };
      ed.rectEnd = { ...ed.rectStart };
      render();
      return;
    }
    if (ed.tool === 'pick') {
      const ch = ed.grid[r][c];
      if (ch && ch !== '.') {
        ed.selectedMat = ch;
        syncPaletteUI();
      }
      // 用完滴管自動回塗繪
      setTool('paint');
      return;
    }
    if (ed.tool === 'bucket') {
      pushHistory();
      bucketFill(r, c, ed.selectedMat);
      render();
      return;
    }
    pushHistory();
    paintAt(r, c);
    lastRC = { r, c };
  }
  function onPointerMove(e) {
    const { r, c } = eventToRC(e);
    // 更新 hover
    if (r >= 0 && r < ed.grid.length && c >= 0 && c < COLS) {
      if (!ed.hoverRC || ed.hoverRC.r !== r || ed.hoverRC.c !== c) {
        ed.hoverRC = { r, c };
        if (!ed.drawingActive) render();
      }
    }
    if (!ed.drawingActive) return;
    e.preventDefault();
    if (ed.tool === 'rect') {
      if (!ed.rectStart) return;
      ed.rectEnd = { r: clampRow(r), c: clampCol(c) };
      render();
      return;
    }
    if (ed.tool !== 'paint') return; // 滴管/油漆桶只在 down 觸發
    if (r === lastRC.r && c === lastRC.c) return;
    paintAt(r, c);
    lastRC = { r, c };
  }
  function onPointerLeave() {
    if (ed.hoverRC) {
      ed.hoverRC = null;
      render();
    }
  }
  canvas.addEventListener('mouseleave', onPointerLeave);
  function onPointerUp() {
    if (ed.tool === 'rect' && ed.rectStart && ed.rectEnd) {
      // 落筆：填滿矩形範圍
      const r0 = Math.min(ed.rectStart.r, ed.rectEnd.r);
      const r1 = Math.max(ed.rectStart.r, ed.rectEnd.r);
      const c0 = Math.min(ed.rectStart.c, ed.rectEnd.c);
      const c1 = Math.max(ed.rectStart.c, ed.rectEnd.c);
      pushHistory();
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          setCell(r, c, ed.selectedMat);
          if (ed.mirrorMode) {
            const mc = COLS - 1 - c;
            if (mc !== c) setCell(r, mc, ed.selectedMat);
          }
        }
      }
      ed.rectStart = null;
      ed.rectEnd = null;
      render();
    }
    ed.drawingActive = false;
    lastRC = { r: -1, c: -1 };
  }

  function clampRow(r) { return Math.max(0, Math.min(ed.grid.length - 1, r)); }
  function clampCol(c) { return Math.max(0, Math.min(COLS - 1, c)); }

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
      ed.selectedMat = btn.dataset.mat;
      syncPaletteUI();
    });
  });

  function setTool(t) {
    ed.tool = t;
    paintBtn.classList.toggle('active', t === 'paint');
    rectBtn.classList.toggle('active', t === 'rect');
    pickBtn.classList.toggle('active', t === 'pick');
    bucketBtn.classList.toggle('active', t === 'bucket');
    ed.rectStart = null; ed.rectEnd = null;
    canvas.style.cursor = (t === 'pick') ? 'cell' : 'crosshair';
    render();
  }
  paintBtn.addEventListener('click', () => setTool('paint'));
  rectBtn.addEventListener('click', () => setTool('rect'));
  pickBtn.addEventListener('click', () => setTool('pick'));
  bucketBtn.addEventListener('click', () => setTool('bucket'));

  // 同步素材調色盤 UI
  function syncPaletteUI() {
    palette.querySelectorAll('.ed-tile').forEach(b => {
      b.classList.toggle('active', b.dataset.mat === ed.selectedMat);
    });
  }

  // 連通填充（4 向 flood fill）：把連通的相同字元換成新素材
  function bucketFill(r, c, newCh) {
    const old = ed.grid[r][c];
    if (old === newCh) return;
    const rows = ed.grid.length;
    const stack = [[r, c]];
    let count = 0;
    while (stack.length && count < rows * COLS) {
      const [rr, cc] = stack.pop();
      if (rr < 0 || rr >= rows || cc < 0 || cc >= COLS) continue;
      if (ed.grid[rr][cc] !== old) continue;
      setCell(rr, cc, newCh);
      if (ed.mirrorMode) {
        const mc = COLS - 1 - cc;
        if (mc !== cc) setCell(rr, mc, newCh);
      }
      stack.push([rr - 1, cc], [rr + 1, cc], [rr, cc - 1], [rr, cc + 1]);
      count++;
    }
  }

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
    // 整關填：所有非空格改成當前素材（保留空格）
    ed.grid = ed.grid.map(row => {
      let out = '';
      for (let i = 0; i < row.length; i++) {
        out += (row[i] === '.') ? '.' : ed.selectedMat;
      }
      return out;
    });
    render();
  });
  tplBtn.addEventListener('click', () => openTemplates());

  // ===== 動作工具 =====
  flipHBtn.addEventListener('click', () => {
    pushHistory();
    ed.grid = ed.grid.map(row => row.split('').reverse().join(''));
    render();
  });
  flipVBtn.addEventListener('click', () => {
    pushHistory();
    ed.grid = ed.grid.slice().reverse();
    render();
  });
  rotBtn.addEventListener('click', () => {
    pushHistory();
    ed.grid = ed.grid.slice().reverse().map(row => row.split('').reverse().join(''));
    render();
  });
  replaceBtn.addEventListener('click', () => {
    const from = prompt('要把哪個素材取代掉？\n輸入字元（B/W/F/S/O/H/X/G/?/N/Z 或 . 為空）：', ed.selectedMat);
    if (from === null) return;
    const to = prompt('要換成什麼？\n輸入字元（B/W/F/S/O/H/X/G/?/N/Z 或 . 為空）：', 'B');
    if (to === null) return;
    if (!isValidMat(from) || !isValidMat(to)) { alert('字元無效'); return; }
    pushHistory();
    ed.grid = ed.grid.map(row => row.split('').map(ch => ch === from ? to : ch).join(''));
    render();
  });
  randomBtn.addEventListener('click', () => {
    const sel = prompt('在「空格」隨機填入下列素材（最多 6 個字元，例：BBWF）：\n注意：只填空格，不會覆蓋既有素材。', 'BBWWF');
    if (!sel) return;
    const pool = sel.split('').filter(isValidMat);
    if (!pool.length) { alert('沒有有效素材'); return; }
    const density = parseFloat(prompt('密度 0.1 ~ 1.0（多少比例的空格被填上）', '0.6') || '0.6');
    pushHistory();
    ed.grid = ed.grid.map(row => {
      let out = '';
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch !== '.') { out += ch; continue; }
        if (Math.random() < density) {
          out += pool[Math.floor(Math.random() * pool.length)];
        } else { out += '.'; }
      }
      return out;
    });
    render();
  });

  function isValidMat(ch) {
    return ch === '.' || 'BWFSOHXG?NZMKL'.includes(ch);
  }

  // ===== 屬性面板事件 =====
  const tagsInput = document.getElementById('ed-tags');
  const timerInput = document.getElementById('ed-timer');
  const timerVal = document.getElementById('ed-timer-val');
  const startBallsInput = document.getElementById('ed-startballs');
  const startBallsVal = document.getElementById('ed-startballs-val');

  nameInput.addEventListener('input', () => { ed.name = nameInput.value || '我的關卡'; });
  speedInput.addEventListener('input', () => {
    ed.speed = parseInt(speedInput.value, 10);
    speedVal.textContent = ed.speed;
  });
  if (tagsInput) tagsInput.addEventListener('input', () => {
    ed.tags = (tagsInput.value || '').split(',').map(s => s.trim()).filter(Boolean);
  });
  if (timerInput) timerInput.addEventListener('input', () => {
    ed.timer = parseInt(timerInput.value, 10);
    timerVal.textContent = ed.timer === 0 ? '關閉' : (ed.timer + ' 秒');
  });
  if (startBallsInput) startBallsInput.addEventListener('input', () => {
    ed.startBalls = parseInt(startBallsInput.value, 10);
    startBallsVal.textContent = ed.startBalls;
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
  shareBtn.addEventListener('click', shareCurrent);
  document.getElementById('ed-back-btn').addEventListener('click', () => {
    if (window.MFSB) window.MFSB.showOverlay(document.getElementById('dev-screen'));
  });
  document.getElementById('ed-mylevels-btn').addEventListener('click', () => openMyLevels());

  // ===== 說明抽屜 =====
  helpBtn.addEventListener('click', () => helpDrawer.classList.remove('hidden'));
  helpCloseBtn.addEventListener('click', () => helpDrawer.classList.add('hidden'));

  // ===== 分享 URL =====
  function encodeLevel(lv) {
    // 精簡 payload：去掉時間戳，只留必要欄位
    const slim = { v: 1, n: lv.name, s: lv.speed, t: lv.theme, g: lv.grid };
    const json = JSON.stringify(slim);
    // UTF-8 安全 base64
    const utf8 = unescape(encodeURIComponent(json));
    const b64 = btoa(utf8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return b64;
  }
  function decodeLevel(b64) {
    try {
      const norm = b64.replace(/-/g, '+').replace(/_/g, '/');
      const pad = norm + '='.repeat((4 - norm.length % 4) % 4);
      const utf8 = atob(pad);
      const json = decodeURIComponent(escape(utf8));
      const obj = JSON.parse(json);
      if (!obj.g || !Array.isArray(obj.g)) return null;
      return {
        id: newId(),
        name: obj.n || '分享關卡',
        speed: obj.s || 400,
        theme: obj.t || 'warm',
        grid: obj.g.slice(),
        enabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    } catch (e) { return null; }
  }
  function shareCurrent() {
    const lv = currentLevelObject();
    if (lv.grid.every(row => /^\.+$/.test(row))) {
      alert('還沒有任何素材，先在格子上塗一些再分享');
      return;
    }
    openShareDialog(lv);
  }

  // ===== 分享 dialog（多 pane） =====
  let _activeShareLv = null;
  let _activeSharePane = 'link';
  function openShareDialog(lv) {
    _activeShareLv = lv;
    _activeSharePane = 'link';
    syncSharePanes();
    refreshSharePane();
    if (window.MFSB) window.MFSB.showOverlay(document.getElementById('share-dialog'));
  }
  function syncSharePanes() {
    document.querySelectorAll('.share-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === _activeSharePane);
    });
    document.querySelectorAll('.share-pane').forEach(p => {
      p.classList.toggle('active', p.dataset.pane === _activeSharePane);
    });
    document.getElementById('share-download-btn').classList.toggle('hidden', _activeSharePane !== 'png');
    document.getElementById('share-copy-btn').classList.toggle('hidden', _activeSharePane === 'png' || _activeSharePane === 'qr');
  }
  function refreshSharePane() {
    if (!_activeShareLv) return;
    const lv = _activeShareLv;
    const b64 = encodeLevel(lv);
    const url = location.origin + location.pathname + '#lv=' + b64;
    if (_activeSharePane === 'link') {
      document.getElementById('share-link-text').value = url;
    } else if (_activeSharePane === 'qr') {
      const box = document.getElementById('share-qr-box');
      const enc = encodeURIComponent(url);
      box.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${enc}" alt="QR" onerror="this.replaceWith(Object.assign(document.createElement('p'),{textContent:'⚠️ 離線無法產生 QR，請複製連結'}));" />`;
    } else if (_activeSharePane === 'png') {
      drawSharePNG(lv);
    } else if (_activeSharePane === 'emoji') {
      document.getElementById('share-emoji-text').value = gridToEmoji(lv);
    }
  }
  function gridToEmoji(lv) {
    const map = {'B':'🟥','W':'💧','F':'🍉','S':'🍓','O':'🍊',
                 'H':'🛡️','X':'⛔','G':'💎','?':'🎁','N':'🌑','Z':'⚡','.':'⬛'};
    const lines = lv.grid.map(row => [...row].map(c => map[c] || '⬛').join(''));
    return `🎮 ${lv.name}\n⚡ 球速 ${lv.speed} · ${lv.grid.length} 排\n\n` + lines.join('\n') +
      `\n\n玩法：https://nicktim791113.github.io/Magic-fruit-splash-breaker/`;
  }
  function drawSharePNG(lv) {
    const c = document.getElementById('share-png-canvas');
    const tc = c.getContext('2d');
    const W = 540, H = 540;
    c.width = W; c.height = H;
    // 背景
    const bg = tc.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fff3e0'); bg.addColorStop(1, '#ffccbc');
    tc.fillStyle = bg; tc.fillRect(0, 0, W, H);
    // 標題
    tc.fillStyle = '#d84315';
    tc.font = 'bold 26px "Comic Sans MS", "Microsoft JhengHei", sans-serif';
    tc.textAlign = 'center';
    tc.fillText('🎮 ' + lv.name, W/2, 38);
    tc.fillStyle = '#5d4037';
    tc.font = '14px sans-serif';
    tc.fillText(`球速 ${lv.speed} · ${lv.grid.length} 排`, W/2, 60);
    // 網格
    const padX = 30, padTop = 84, padBottom = 56;
    const gW = W - padX * 2;
    const gH = H - padTop - padBottom;
    const cellW = gW / COLS;
    const cellH = Math.min(cellW * 0.62, gH / lv.grid.length);
    const offY = padTop + (gH - cellH * lv.grid.length) / 2;
    for (let r = 0; r < lv.grid.length; r++) {
      for (let cc = 0; cc < COLS; cc++) {
        const ch = lv.grid[r][cc];
        if (ch === '.') continue;
        const x = padX + cc * cellW;
        const y = offY + r * cellH;
        tc.fillStyle = (CELL_COLORS[ch]) || '#999';
        tc.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
      }
    }
    // 底部水印
    tc.fillStyle = '#6d4c41';
    tc.font = '11px sans-serif';
    tc.textAlign = 'center';
    tc.fillText('Magic Fruit Splash Breaker · 自製關卡', W/2, H - 26);
    tc.fillText('nicktim791113.github.io/Magic-fruit-splash-breaker', W/2, H - 12);
  }

  // tab 切換
  document.querySelectorAll('.share-tab').forEach(t => {
    t.addEventListener('click', () => {
      _activeSharePane = t.dataset.tab;
      syncSharePanes();
      refreshSharePane();
    });
  });
  document.getElementById('share-copy-btn').addEventListener('click', () => {
    let txt = '';
    if (_activeSharePane === 'link') txt = document.getElementById('share-link-text').value;
    else if (_activeSharePane === 'emoji') txt = document.getElementById('share-emoji-text').value;
    if (!txt) return;
    try {
      navigator.clipboard.writeText(txt).then(() => alert('已複製'));
    } catch {
      const t = document.getElementById(_activeSharePane === 'link' ? 'share-link-text' : 'share-emoji-text');
      t.select(); document.execCommand('copy'); alert('已複製');
    }
  });
  document.getElementById('share-download-btn').addEventListener('click', () => {
    const c = document.getElementById('share-png-canvas');
    const link = document.createElement('a');
    link.download = `${(_activeShareLv && _activeShareLv.name) || 'level'}.png`;
    link.href = c.toDataURL('image/png');
    link.click();
  });
  document.getElementById('share-close-btn').addEventListener('click', () => {
    if (window.MFSB) window.MFSB.showOverlay(document.getElementById('editor-screen'));
  });
  // 啟動時檢查 URL hash 自動匯入
  function checkUrlForShare() {
    const h = location.hash;
    if (!h.startsWith('#lv=')) return;
    const b64 = h.slice(4);
    const lv = decodeLevel(b64);
    if (!lv) return;
    if (confirm('從分享連結匯入「' + lv.name + '」？\n（按確定後會打開編輯器）')) {
      const data = loadAll();
      data.levels.push(lv);
      saveAll(data);
      openEditor(lv);
    }
    // 清掉 hash 避免重複觸發
    history.replaceState({}, '', location.pathname);
  }
  window.addEventListener('load', checkUrlForShare);

  function currentLevelObject() {
    return {
      id: ed.editingId || newId(),
      name: ed.name || '我的關卡',
      speed: ed.speed,
      theme: ed.theme,
      grid: ed.grid.slice(),
      tags: ed.tags || [],
      timer: ed.timer || 0,
      startBalls: ed.startBalls || 1,
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
        recordRecentEdit(ed.editingId);
        clearDraft();
        alert('已更新「' + lv.name + '」');
        return;
      }
    }
    ed.editingId = lv.id;
    upsertLevel(lv);
    recordRecentEdit(lv.id);
    clearDraft();
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
      ed.tags = lv.tags || [];
      ed.timer = lv.timer || 0;
      ed.startBalls = lv.startBalls || 1;
    } else {
      // 新增空白關卡前，先檢查是否有草稿可救回
      const draft = loadDraft();
      if (draft && draft.grid && draft.grid.length &&
          !draft.grid.every(row => /^\.+$/.test(row))) {
        const since = Math.floor((Date.now() - draft.ts) / 60000);
        if (confirm(`找到 ${since} 分鐘前的草稿「${draft.name || '未命名'}」\n要繼續編輯嗎？\n（取消會開新空白關卡）`)) {
          ed.editingId = draft.id || null;
          ed.name = draft.name || '我的關卡';
          ed.speed = draft.speed || 400;
          ed.theme = draft.theme || 'warm';
          ed.grid = draft.grid.slice();
          ed.rows = ed.grid.length;
          ed.tags = draft.tags || [];
          ed.timer = draft.timer || 0;
          ed.startBalls = draft.startBalls || 1;
        } else {
          ed.editingId = null;
          ed.name = nextLevelName();
          ed.speed = 400;
          ed.theme = 'warm';
          ed.rows = 7;
          ed.grid = makeEmptyGrid(7);
          ed.tags = []; ed.timer = 0; ed.startBalls = 1;
          clearDraft();
        }
      } else {
        ed.editingId = null;
        ed.name = nextLevelName();
        ed.speed = 400;
        ed.theme = 'warm';
        ed.rows = 7;
        ed.grid = makeEmptyGrid(7);
        ed.tags = []; ed.timer = 0; ed.startBalls = 1;
      }
    }
    ed.history.length = 0;
    ed.redo.length = 0;
    nameInput.value = ed.name;
    speedInput.value = ed.speed;
    speedVal.textContent = ed.speed;
    rowsInput.value = ed.rows;
    rowsVal.textContent = ed.rows;
    themeInput.value = ed.theme;
    if (tagsInput) tagsInput.value = (ed.tags || []).join(', ');
    if (timerInput) {
      timerInput.value = ed.timer || 0;
      timerVal.textContent = (ed.timer || 0) === 0 ? '關閉' : (ed.timer + ' 秒');
    }
    if (startBallsInput) {
      startBallsInput.value = ed.startBalls || 1;
      startBallsVal.textContent = ed.startBalls || 1;
    }
    mirrorBtn.classList.toggle('active', ed.mirrorMode);
    if (window.MFSB) window.MFSB.showOverlay(editorScreen);
    requestAnimationFrame(render);
    // 首次進入顯示教學
    maybeShowFirstTutorial();
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

  // ===== 搜尋 / 排序 / 批次 狀態 =====
  const ml = {
    search: '',
    sort: 'custom',
    batchMode: false,
    selected: new Set(),
  };

  function filterAndSort(arr) {
    let list = arr.slice();
    const kw = ml.search.trim().toLowerCase();
    if (kw) list = list.filter(l => (l.name || '').toLowerCase().includes(kw));
    const targetCountOf = lv => lv.grid.reduce((s, row) => s + [...row].filter(c => c !== '.' && c !== 'X').length, 0);
    switch (ml.sort) {
      case 'name':    list.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
      case 'newest':  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); break;
      case 'updated': list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); break;
      case 'targets': list.sort((a, b) => targetCountOf(b) - targetCountOf(a)); break;
      case 'speed':   list.sort((a, b) => (b.speed || 0) - (a.speed || 0)); break;
      case 'played':  list.sort((a, b) => ((b.stats && b.stats.playCount) || 0) - ((a.stats && a.stats.playCount) || 0)); break;
      default:        break;
    }
    return list;
  }

  function renderMyLevels() {
    const list = document.getElementById('ml-list');
    const empty = document.getElementById('ml-empty');
    const arr = getAllCustomLevels();
    document.getElementById('ml-count').textContent = '(' + arr.length + ')';
    const visible = filterAndSort(arr);
    if (!arr.length) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');
    list.innerHTML = '';
    visible.forEach((lv) => {
      const card = document.createElement('div');
      card.className = 'ml-card' + ((lv.enabled === false) ? ' disabled' : '');
      card.draggable = (ml.sort === 'custom') && !ml.batchMode;
      card.dataset.id = lv.id;
      const targetCount = lv.grid.reduce((s, row) => s + [...row].filter(c => c !== '.').length, 0);
      const stats = lv.stats || {};
      const statTxt = stats.playCount
        ? ` · 🎮${stats.playCount}` + (stats.highScore ? ` · 🏆${stats.highScore}` : '')
        : '';
      card.innerHTML = `
        <input type="checkbox" class="ml-checkbox ${ml.batchMode ? '' : 'hidden'}" />
        <div class="ml-handle" title="拖曳調整順序">☰</div>
        <canvas class="ml-thumb" width="120" height="90"></canvas>
        <div class="ml-info">
          <div class="ml-name"></div>
          <div class="ml-meta"></div>
        </div>
        <button class="ml-toggle ${lv.enabled === false ? '' : 'on'}" title="啟用/停用"></button>
        <div class="ml-actions">
          <button class="ml-action" data-act="edit"   title="編輯">✏️</button>
          <button class="ml-action" data-act="play"   title="試玩">▶</button>
          <button class="ml-action" data-act="copy"   title="複製">📋</button>
          <button class="ml-action" data-act="share"  title="分享">🔗</button>
          <button class="ml-action danger" data-act="del" title="刪除">🗑</button>
        </div>`;
      card.querySelector('.ml-name').textContent = lv.name;
      card.querySelector('.ml-meta').textContent =
        `${lv.grid.length} 排 · ${targetCount} 目標 · 速度 ${lv.speed}${statTxt}`;
      // 縮圖
      drawThumbnail(card.querySelector('.ml-thumb'), lv);
      // 批次 checkbox
      const cb = card.querySelector('.ml-checkbox');
      cb.checked = ml.selected.has(lv.id);
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        if (cb.checked) ml.selected.add(lv.id); else ml.selected.delete(lv.id);
        updateBatchBar();
      });
      card.querySelector('.ml-toggle').addEventListener('click', () => {
        toggleEnabled(lv.id);
        renderMyLevels();
      });
      card.querySelectorAll('.ml-action').forEach(btn => {
        btn.addEventListener('click', () => onCardAction(lv, btn.dataset.act));
      });
      if (card.draggable) attachDragHandlers(card, list);
      list.appendChild(card);
    });
  }

  // ===== 縮圖繪製（縮小版的關卡預覽） =====
  function drawThumbnail(canvasEl, lv) {
    const tctx = canvasEl.getContext('2d');
    const W = canvasEl.width, H = canvasEl.height;
    tctx.clearRect(0, 0, W, H);
    tctx.fillStyle = '#fff8e1';
    tctx.fillRect(0, 0, W, H);
    const rows = lv.grid.length || 1;
    const cellW = W / COLS;
    const cellH = H / rows;
    for (let r = 0; r < rows; r++) {
      const row = lv.grid[r];
      for (let c = 0; c < COLS; c++) {
        const ch = row[c];
        if (ch === '.') continue;
        tctx.fillStyle = (CELL_COLORS && CELL_COLORS[ch]) || '#999';
        tctx.fillRect(c * cellW + 0.5, r * cellH + 0.5, cellW - 1, cellH - 1);
      }
    }
  }

  function onCardAction(lv, act) {
    if (act === 'edit') openEditor(lv);
    else if (act === 'play') {
      // 從我的關卡按 ▶ 試玩：當作正式遊戲（記分數、會更新統計）
      if (window.MFSB) window.MFSB.startCustomPlay(lv);
    } else if (act === 'copy') {
      duplicateLevel(lv.id);
      renderMyLevels();
    } else if (act === 'share') {
      openShareDialog(lv);
    } else if (act === 'del') {
      if (confirm('刪除「' + lv.name + '」？此動作無法復原。')) {
        deleteLevel(lv.id);
        ml.selected.delete(lv.id);
        renderMyLevels();
      }
    }
  }

  // ===== 搜尋 / 排序 / 批次 事件 =====
  document.getElementById('ml-search').addEventListener('input', (e) => {
    ml.search = e.target.value;
    renderMyLevels();
  });
  document.getElementById('ml-sort').addEventListener('change', (e) => {
    ml.sort = e.target.value;
    renderMyLevels();
  });
  document.getElementById('ml-batch-toggle').addEventListener('click', () => {
    ml.batchMode = !ml.batchMode;
    ml.selected.clear();
    document.getElementById('ml-batch-bar').classList.toggle('hidden', !ml.batchMode);
    renderMyLevels();
    updateBatchBar();
  });
  function updateBatchBar() {
    document.getElementById('ml-batch-count').textContent = `已選 ${ml.selected.size} 張`;
  }
  document.getElementById('ml-batch-enable').addEventListener('click', () => batchSetEnabled(true));
  document.getElementById('ml-batch-disable').addEventListener('click', () => batchSetEnabled(false));
  document.getElementById('ml-batch-export').addEventListener('click', () => batchExport());
  document.getElementById('ml-batch-delete').addEventListener('click', () => batchDelete());
  function batchSetEnabled(en) {
    if (!ml.selected.size) { alert('沒有選擇任何關卡'); return; }
    const data = loadAll();
    data.levels.forEach(l => { if (ml.selected.has(l.id)) l.enabled = en; });
    saveAll(data);
    renderMyLevels();
  }
  function batchExport() {
    if (!ml.selected.size) { alert('沒有選擇任何關卡'); return; }
    const data = loadAll();
    const subset = { version: 1, levels: data.levels.filter(l => ml.selected.has(l.id)) };
    openTextDialog('📤 匯出 (複製 JSON)', JSON.stringify(subset, null, 2), null);
  }
  function batchDelete() {
    if (!ml.selected.size) { alert('沒有選擇任何關卡'); return; }
    if (!confirm(`真的刪除這 ${ml.selected.size} 張關卡？此動作無法復原。`)) return;
    const data = loadAll();
    data.levels = data.levels.filter(l => !ml.selected.has(l.id));
    saveAll(data);
    ml.selected.clear();
    renderMyLevels();
    updateBatchBar();
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

  // ===== 開發者模式起始關卡：動態列出啟用中的自製關卡 =====
  const devLevelGroup = document.getElementById('dev-level-group');
  function refreshDevLevels() {
    if (!devLevelGroup) return;
    // 移除舊的自製按鈕
    devLevelGroup.querySelectorAll('.seg-btn.custom').forEach(b => b.remove());
    const enabled = getEnabledCustomLevels();
    enabled.forEach((lv, i) => {
      const btn = document.createElement('button');
      btn.className = 'seg-btn custom';
      btn.dataset.level = String(10 + i);
      const shortName = (lv.name || '自製').slice(0, 6);
      btn.innerHTML = `🎨 ${shortName}`;
      btn.title = lv.name + '（自製關卡）';
      devLevelGroup.appendChild(btn);
    });
  }
  // 主畫面進入開發者模式時 refresh
  document.getElementById('dev-mode-btn').addEventListener('click', refreshDevLevels);
  // 從任何路徑進 dev-screen 都自動 refresh（用 MutationObserver 監聽 class 變化）
  const devScreen = document.getElementById('dev-screen');
  if (devScreen && typeof MutationObserver !== 'undefined') {
    const obs = new MutationObserver(() => {
      if (!devScreen.classList.contains('hidden')) refreshDevLevels();
    });
    obs.observe(devScreen, { attributes: true, attributeFilter: ['class'] });
  }
  // 第一次載入也 refresh 一下（避免 race）
  refreshDevLevels();

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

  // ===== 鍵盤捷徑（撤銷/重做/鏡像） =====
  window.addEventListener('keydown', (e) => {
    if (editorScreen.classList.contains('hidden')) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); return; }
    if (e.key === 'm' || e.key === 'M') {
      ed.mirrorMode = !ed.mirrorMode;
      mirrorBtn.classList.toggle('active', ed.mirrorMode);
      render();
    }
  });

  // ===== 統計 + 難度估算 =====
  const MAT_BADGES = {
    'B': { emoji: '🟥', name: '磚', hp: 1, score: 10 },
    'W': { emoji: '💧', name: '水', hp: 1, score: 15 },
    'F': { emoji: '🍉', name: '西瓜', hp: 2, score: 25 },
    'S': { emoji: '🍓', name: '草莓', hp: 2, score: 25 },
    'O': { emoji: '🍊', name: '橘子', hp: 2, score: 25 },
    'H': { emoji: '🛡', name: '鋼', hp: 3, score: 40 },
    'X': { emoji: '⛔', name: '不可破', hp: 0, score: 0 },
    'G': { emoji: '💎', name: '寶石', hp: 1, score: 100 },
    '?': { emoji: '🎁', name: '神秘', hp: 1, score: 20 },
    'N': { emoji: '🌑', name: '隱藏', hp: 2, score: 30 },
    'Z': { emoji: '⚡', name: '加速', hp: 1, score: 20 },
    'M': { emoji: '🔁', name: '移動', hp: 1, score: 35 },
    'K': { emoji: '🔑', name: '鑰匙', hp: 1, score: 60 },
    'L': { emoji: '🔒', name: '鎖磚', hp: 1, score: 50 },
  };
  function updateStats() {
    if (!statTotal) return;
    const counts = {};
    let totalHp = 0, maxPotentialScore = 0;
    let breakable = 0;
    for (const row of ed.grid) {
      for (const ch of row) {
        if (ch === '.') continue;
        counts[ch] = (counts[ch] || 0) + 1;
        const b = MAT_BADGES[ch];
        if (b && ch !== 'X') {
          totalHp += b.hp;
          maxPotentialScore += b.score;
          breakable++;
        }
      }
    }
    statTotal.textContent = breakable;
    // 分類顯示
    statBreakdown.innerHTML = '';
    const order = ['B','W','F','S','O','H','X','G','?','N','Z'];
    order.forEach(ch => {
      const n = counts[ch] || 0;
      if (n <= 0) return;
      const span = document.createElement('span');
      span.className = 'ed-stat-cell';
      span.textContent = (MAT_BADGES[ch].emoji) + ' ' + n;
      statBreakdown.appendChild(span);
    });
    // 難度估算（規則式）：基於 hp 數、球速、不可破比例
    const speed = ed.speed;
    const xCount = counts['X'] || 0;
    let score = totalHp + Math.floor(speed / 40);
    if (xCount > 0) score += Math.min(20, xCount * 1.5);  // 不可破讓關卡更難
    // 等級映射
    let stars;
    if (score < 30)  stars = '⭐';
    else if (score < 55) stars = '⭐⭐';
    else if (score < 85) stars = '⭐⭐⭐';
    else if (score < 120) stars = '⭐⭐⭐⭐';
    else stars = '⭐⭐⭐⭐⭐';
    statDiff.textContent = stars + ' (' + score + ')';
    // 提示
    const hints = [];
    if (breakable === 0) hints.push('⚠️ 還沒有可破壞目標，遊戲無法過關');
    if (breakable > 100) hints.push('💡 目標超過 100 個，玩起來可能太久');
    if (speed > 700 && breakable > 60) hints.push('💡 球速很快又很多目標，難度爆表');
    if (xCount > breakable * 0.4) hints.push('⚠️ 不可破磚太多，玩家可能找不到角度');
    statHint.textContent = hints.join(' ｜ ');
  }

  // ===== 自動儲存草稿 =====
  function saveDraft() {
    if (document.getElementById('editor-screen').classList.contains('hidden')) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({
        id: ed.editingId,
        name: ed.name,
        speed: ed.speed,
        theme: ed.theme,
        grid: ed.grid,
        rows: ed.rows,
        ts: Date.now(),
      }));
    } catch (e) {}
  }
  function loadDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY));
      if (!d || !d.grid || !d.ts) return null;
      if (Date.now() - d.ts > 7 * 24 * 60 * 60 * 1000) return null; // 7 天過期
      return d;
    } catch { return null; }
  }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch {} }
  setInterval(saveDraft, 30000); // 每 30 秒
  window.addEventListener('beforeunload', saveDraft);

  // ===== 數字鍵 1-9 0 切素材 =====
  const KEY_TO_MAT = { '1':'B','2':'W','3':'F','4':'S','5':'O','6':'H','7':'X','8':'G','9':'?','0':'.' };
  // 補：N (隱藏) Z (加速) 用字母鍵
  window.addEventListener('keydown', (e) => {
    if (document.getElementById('editor-screen').classList.contains('hidden')) return;
    // 不在輸入框內才生效
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const m = KEY_TO_MAT[e.key];
    if (m) {
      ed.selectedMat = m;
      syncPaletteUI();
      e.preventDefault();
    }
    if (e.key === 'n' || e.key === 'N') { ed.selectedMat = 'N'; syncPaletteUI(); }
    if (e.key === 'z' || e.key === 'Z') {
      if (!(e.ctrlKey || e.metaKey)) { ed.selectedMat = 'Z'; syncPaletteUI(); }
    }
    if (e.key === 'e' || e.key === 'E') { setTool('paint'); }
    if (e.key === 'r' && !e.ctrlKey && !e.metaKey) { setTool(ed.tool === 'rect' ? 'paint' : 'rect'); }
    if (e.key === 'i' || e.key === 'I') { setTool('pick'); }
    if (e.key === 'b' || e.key === 'B') { setTool(ed.tool === 'bucket' ? 'paint' : 'bucket'); }
  });

  // ===== 暗色模式 =====
  const darkBtn = document.getElementById('ed-dark-btn');
  if (localStorage.getItem('mfsb_dark') === '1') document.body.classList.add('dark');
  if (darkBtn) {
    darkBtn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
    darkBtn.addEventListener('click', () => {
      const on = !document.body.classList.contains('dark');
      document.body.classList.toggle('dark', on);
      localStorage.setItem('mfsb_dark', on ? '1' : '0');
      darkBtn.textContent = on ? '☀️' : '🌙';
      render();
    });
  }

  // ===== 首次教學 =====
  const TUTORIAL_STEPS = [
    {
      title: '🎓 歡迎來到關卡設計器！',
      body: `
        <h4>👋 兩分鐘學會做關卡</h4>
        <p>這是一個可愛的打磚塊關卡編輯器。你可以：</p>
        <ul>
          <li>自由排列 12 種素材（磚塊、水球、水果、寶石...）</li>
          <li>調整球速、排數、背景主題</li>
          <li>存檔到瀏覽器、分享連結給朋友</li>
          <li>啟用後接在正式 10 關後面玩</li>
        </ul>
        <p>按「下一步」我帶你走一遍。</p>
      `,
    },
    {
      title: '🎨 第 1 步：選素材',
      body: `
        <h4>左欄「素材調色盤」</h4>
        <p>點下任一個素材按鈕，把它設為當前的「筆刷」。</p>
        <ul>
          <li>🟥 磚塊：1 下破，分 10</li>
          <li>💧 水球：水花動畫，分 15</li>
          <li>🍉🍓🍊 水果：2 下破，分 25</li>
          <li>🛡️ 鋼磚（3 下） / ⛔ 不可破 / 💎 寶石 +100</li>
          <li>🎁 神秘箱破時掉道具（變寬/慢速/多球）</li>
        </ul>
        <p>進階：鍵盤 <b>1-9 0 N Z</b> 直接切素材。</p>
      `,
    },
    {
      title: '✏️ 第 2 步：開始畫',
      body: `
        <h4>選好素材後在畫布塗</h4>
        <ul>
          <li>✏️ 塗繪：點/拖過格子</li>
          <li>▭ 框選：拖出範圍，一次填滿</li>
          <li>🎯 滴管：點現有格子，吸取那個素材</li>
          <li>🎨 油漆桶：點空格，連通空格全填滿</li>
          <li>🪞 鏡像：開了之後塗左邊會自動填右邊（做愛心/笑臉必備）</li>
          <li>↩ 撤銷 / ↪ 重做：Ctrl+Z / Ctrl+Y</li>
        </ul>
      `,
    },
    {
      title: '💾 第 3 步：存檔分享',
      body: `
        <h4>右側統計即時顯示</h4>
        <p>左欄底部統計區會即時告訴你：總目標數、各素材計數、難度估算 ⭐。</p>
        <h4>動作按鈕</h4>
        <ul>
          <li>💾 存檔：寫入瀏覽器本機</li>
          <li>▶ 試玩：立刻玩這張，回編輯器繼續改</li>
          <li>📤 匯出：複製 JSON</li>
          <li>🔗 分享：產生短連結、QR、PNG 圖、Emoji 字串</li>
        </ul>
        <p>右上 ❓ 隨時看完整說明。<b>祝你玩得愉快！</b></p>
      `,
    },
  ];
  let _tutStep = 0;
  function showTutorial(step) {
    _tutStep = step;
    const s = TUTORIAL_STEPS[step];
    document.getElementById('tut-title').textContent = s.title;
    document.getElementById('tut-body').innerHTML = s.body;
    document.querySelectorAll('.tut-dot').forEach((d, i) => {
      d.classList.toggle('active', i === step);
    });
    document.getElementById('tut-prev').style.visibility = step === 0 ? 'hidden' : 'visible';
    document.getElementById('tut-next').textContent = (step === TUTORIAL_STEPS.length - 1) ? '✓ 完成' : '下一步 →';
    if (window.MFSB) window.MFSB.showOverlay(document.getElementById('tutorial-dialog'));
  }
  document.getElementById('tut-prev').addEventListener('click', () => showTutorial(Math.max(0, _tutStep - 1)));
  document.getElementById('tut-next').addEventListener('click', () => {
    if (_tutStep === TUTORIAL_STEPS.length - 1) closeTutorial();
    else showTutorial(_tutStep + 1);
  });
  document.getElementById('tut-skip').addEventListener('click', closeTutorial);
  function closeTutorial() {
    localStorage.setItem('mfsb_tutorial_done', '1');
    if (window.MFSB) window.MFSB.showOverlay(document.getElementById('editor-screen'));
  }
  function maybeShowFirstTutorial() {
    if (localStorage.getItem('mfsb_tutorial_done') === '1') return false;
    setTimeout(() => showTutorial(0), 200);
    return true;
  }

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
