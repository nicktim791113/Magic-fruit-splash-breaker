/* =========================================================
 *  Magic Fruit Splash Breaker
 *  純 Canvas + JS 實作；參考「打磚塊遊戲設計藍圖.md」
 * ========================================================= */
(() => {
  'use strict';

  // ===== 邏輯解析度（畫布內部座標） =====
  const W = 540;
  const H = 900;

  // ===== DOM =====
  const canvas       = document.getElementById('game-canvas');
  const ctx          = canvas.getContext('2d');
  const titleScreen  = document.getElementById('title-screen');
  const clearScreen  = document.getElementById('clear-screen');
  const victoryScreen= document.getElementById('victory-screen');
  const gameOverScreen = document.getElementById('gameover-screen');
  const pauseScreen  = document.getElementById('pause-screen');
  const hud          = document.getElementById('hud');
  const levelBadge   = document.getElementById('level-badge');
  const scoreBadge   = document.getElementById('score-badge');
  const livesBadge   = document.getElementById('lives-badge');
  const muteBtn      = document.getElementById('mute-btn');
  const pauseBtn     = document.getElementById('pause-btn');
  const clearInfo    = document.getElementById('clear-info');
  const gameOverInfo = document.getElementById('gameover-info');

  // ===== 遊戲狀態 =====
  const STATE = {
    TITLE:    'title',
    READY:    'ready',     // 球黏在擋板上，等玩家發射
    PLAYING:  'playing',
    PAUSED:   'paused',
    CLEARED:  'cleared',
    GAMEOVER: 'gameover',
    VICTORY:  'victory',
  };
  let state = STATE.TITLE;

  let gameMode = 'easy';   // 'easy' | 'challenge'
  let levelIndex = 0;
  let score = 0;
  let lives = 5;
  let speedMultiplier = 1; // 開發者模式可調整

  // ===== 關卡資料 =====
  // 字元意義：
  //   . 空 / B 磚塊 / W 水球 / F 西瓜 / S 草莓 / O 橘子
  //   H 鋼磚(3hp) / X 不可破 / G 寶石+100 / ? 神秘箱(隨機道具)
  //   N 隱藏磚 / Z 加速磚
  // 寬度建議 12 欄
  const COLS = 12;
  const MATERIALS = {
    '.': null,
    'B': { type: 'brick',         hp: 1 },
    'W': { type: 'water',         hp: 1 },
    'F': { type: 'watermelon',    hp: 2 },
    'S': { type: 'strawberry',    hp: 2 },
    'O': { type: 'orange',        hp: 2 },
    'H': { type: 'steel',         hp: 3 },
    'X': { type: 'indestructible',hp: 999 },
    'G': { type: 'gem',           hp: 1 },
    '?': { type: 'mystery',       hp: 1 },
    'N': { type: 'hidden',        hp: 1, hidden: true },
    'Z': { type: 'speedup',       hp: 1 },
  };
  const MAT_EMOJI = {
    'B':'🟥','W':'💧','F':'🍉','S':'🍓','O':'🍊',
    'H':'🛡️','X':'⛔','G':'💎','?':'🎁','N':'🌑','Z':'⚡','.':'⬜',
  };
  const LEVELS = [
    {
      name: '第 1 關 · 暖身',
      speed: 300,
      grid: [
        'BBBBBBBBBBBB',
        'BBBBBBBBBBBB',
        'BBBBBBBBBBBB',
      ],
    },
    {
      name: '第 2 關 · 水花來了',
      speed: 330,
      grid: [
        'BBBBBBBBBBBB',
        'BWBWBWBWBWBW',
        'BBBBBBBBBBBB',
        'WBWBWBWBWBWB',
      ],
    },
    {
      name: '第 3 關 · 笑臉',
      speed: 360,
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
    {
      name: '第 4 關 · 果園',
      speed: 400,
      grid: [
        'FOSFOSFOSFOS',
        'BWBWBWBWBWBW',
        'OSFOSFOSFOSF',
        'BBBBBBBBBBBB',
        'SFOSFOSFOSFO',
        'WBWBWBWBWBWB',
      ],
    },
    {
      name: '第 5 關 · 愛心大魔王',
      speed: 460,
      grid: [
        '.BB.BBBB.BB.',
        'BFBBFBBFBBFB',
        'BWFFFFFFFFWB',
        'BWFFOOOOFFWB',
        '.BWFFOOFFWB.',
        '..BWFFFFWB..',
        '...BWFFWB...',
        '....BWWB....',
        '.....BB.....',
      ],
    },
    {
      name: '第 6 關 · 彩虹拱橋',
      speed: 500,
      grid: [
        '....BBBB....',
        '..BBBBBBBB..',
        '.BBWWWWWWBB.',
        'BBWBBBBBBWBB',
        'BBBBOOOOBBBB',
        'BBBBBBBBBBBB',
      ],
    },
    {
      name: '第 7 關 · 雙星閃耀',
      speed: 540,
      grid: [
        '.B........B.',
        'BSB......BSB',
        'BFFB....BFFB',
        '.BFB....BFB.',
        '..B..WW..B..',
        '.....WW.....',
      ],
    },
    {
      name: '第 8 關 · 鎖鏈圍城',
      speed: 580,
      grid: [
        'FFFFFFFFFFFF',
        'F..........F',
        'F.BWBWBWBW.F',
        'F.WBWBWBWB.F',
        'F.BWBWBWBW.F',
        'F..........F',
        'FFFFFFFFFFFF',
      ],
    },
    {
      name: '第 9 關 · 漏斗陷阱',
      speed: 620,
      grid: [
        'BBBBBBBBBBBB',
        '.WWWWWWWWWW.',
        '..OOOOOOOO..',
        '...SSSSSS...',
        '....FFFF....',
        '.....BB.....',
        '......B.....',
      ],
    },
    {
      name: '第 10 關 · 終極大魔王',
      speed: 680,
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
  ];

  // ===== 渲染配置 =====
  const PLAY_AREA = {
    left:   18,
    right:  W - 18,
    top:    18,
    bottom: H - 18,
  };
  const TOP_INFO_BAND = 60;            // 上方資訊帶（顯示關卡名/分數）
  const BLOCK_AREA_TOP    = PLAY_AREA.top + TOP_INFO_BAND;
  const BLOCK_AREA_BOTTOM = H - 220;   // 磚塊區下界（之上排目標）

  const BLOCK_GAP = 4;
  const BLOCK_W = (PLAY_AREA.right - PLAY_AREA.left - (COLS + 1) * BLOCK_GAP) / COLS;
  const BLOCK_H = BLOCK_W * 0.55;

  // ===== 球與擋板 =====
  const BALL_R = 12;
  const PADDLE_W_BASE = 140;
  const PADDLE_H = 26;
  const PADDLE_Y = H - 110;  // 從底部抬高，避免太貼視窗底
  const PADDLE_COLOR_TOP = '#ffca28';
  const PADDLE_COLOR_BTM = '#e65100';

  const ball = {
    x: W / 2,
    y: PADDLE_Y - 30,
    vx: 0,
    vy: 0,
    r: BALL_R,
    stuck: true,
  };

  const paddle = {
    w: PADDLE_W_BASE,
    h: PADDLE_H,
    x: (W - PADDLE_W_BASE) / 2,
    y: PADDLE_Y,
  };

  // 目標陣列
  /** @type {Array<{x:number,y:number,w:number,h:number,type:string,hp:number,maxHp:number,dead:boolean,fadeT:number}>} */
  let targets = [];

  // 粒子
  /** @type {Array<{x:number,y:number,vx:number,vy:number,life:number,maxLife:number,color:string,r:number,gravity:number}>} */
  const particles = [];

  // 飄字
  /** @type {Array<{x:number,y:number,text:string,life:number,maxLife:number,color:string}>} */
  const floatTexts = [];

  // 道具（從神秘箱掉落）
  /** @type {Array<{x:number,y:number,vy:number,type:string,r:number}>} */
  const powerups = [];

  // 額外球（多球道具會 spawn）
  /** @type {Array<{x:number,y:number,vx:number,vy:number,r:number,speed:number}>} */
  const extraBalls = [];

  // 效果計時器（秒）
  const fx = { paddleWideT: 0, slowT: 0, doubleT: 0 };

  // 當前關卡資料（含主題）
  let currentLevel = null;
  let bgTheme = 'warm';

  // ===== 輸入控制 =====
  let pointerActive = false;
  let pointerX = 0;
  const keysPressed = { left: false, right: false };

  // ===== 音效 =====
  let audioCtx = null;
  let isMuted = localStorage.getItem('mfsb_muted') === '1';
  syncMuteUI();

  function ensureAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playTone(opts) {
    if (isMuted) return;
    const ctxA = ensureAudio(); if (!ctxA) return;
    const {
      freq = 440, type = 'sine', dur = 0.1,
      gain = 0.18, freqEnd = null, attack = 0.005,
      detune = 0,
    } = opts;
    const osc = ctxA.createOscillator();
    const g = ctxA.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctxA.currentTime);
    if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), ctxA.currentTime + dur);
    osc.detune.value = detune;
    g.gain.setValueAtTime(0, ctxA.currentTime);
    g.gain.linearRampToValueAtTime(gain, ctxA.currentTime + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, ctxA.currentTime + dur);
    osc.connect(g).connect(ctxA.destination);
    osc.start();
    osc.stop(ctxA.currentTime + dur + 0.02);
  }

  function playNoise(opts) {
    if (isMuted) return;
    const ctxA = ensureAudio(); if (!ctxA) return;
    const { dur = 0.15, gain = 0.18, filterFreq = 1200, filterQ = 1 } = opts || {};
    const sr = ctxA.sampleRate;
    const len = Math.floor(sr * dur);
    const buf = ctxA.createBuffer(1, len, sr);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1);
    const src = ctxA.createBufferSource(); src.buffer = buf;
    const filt = ctxA.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = filterFreq; filt.Q.value = filterQ;
    const g = ctxA.createGain();
    g.gain.setValueAtTime(gain, ctxA.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctxA.currentTime + dur);
    src.connect(filt).connect(g).connect(ctxA.destination);
    src.start(); src.stop(ctxA.currentTime + dur + 0.02);
  }

  const SFX = {
    paddle()    { playTone({ freq: 320, freqEnd: 220, dur: 0.08, type: 'triangle', gain: 0.18 }); },
    wall()      { playTone({ freq: 240, freqEnd: 160, dur: 0.06, type: 'sine', gain: 0.12 }); },
    brick()     { playTone({ freq: 880, freqEnd: 1320, dur: 0.09, type: 'square', gain: 0.14 }); },
    waterball() { playNoise({ dur: 0.18, gain: 0.22, filterFreq: 900, filterQ: 0.8 });
                  playTone({ freq: 700, freqEnd: 300, dur: 0.12, type: 'sine', gain: 0.1 }); },
    fruitCrack(){ playTone({ freq: 520, freqEnd: 360, dur: 0.07, type: 'square', gain: 0.14 }); },
    fruitPop()  { playNoise({ dur: 0.18, gain: 0.25, filterFreq: 1500, filterQ: 1.2 });
                  playTone({ freq: 460, freqEnd: 200, dur: 0.16, type: 'sawtooth', gain: 0.14 }); },
    miss()      { playTone({ freq: 380, freqEnd: 180, dur: 0.3, type: 'sine', gain: 0.16 }); },
    clear()     {
      const seq = [523, 659, 784, 1047];
      seq.forEach((f, i) => setTimeout(() => playTone({ freq: f, dur: 0.18, type: 'triangle', gain: 0.18 }), i * 110));
    },
    gameOver()  {
      const seq = [440, 392, 330, 262];
      seq.forEach((f, i) => setTimeout(() => playTone({ freq: f, dur: 0.25, type: 'triangle', gain: 0.18 }), i * 160));
    },
    button()    { playTone({ freq: 660, freqEnd: 990, dur: 0.06, type: 'triangle', gain: 0.14 }); },
  };

  function syncMuteUI() {
    if (muteBtn) muteBtn.textContent = isMuted ? '🔇' : '🔊';
  }

  // ===== 工具 =====
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function addParticles(x, y, color, count, opts = {}) {
    const speed = opts.speed || 200;
    const gravity = opts.gravity ?? 600;
    const r = opts.r || 4;
    const life = opts.life || 0.6;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - Math.random() * 60,
        life, maxLife: life,
        color, r: r * (0.6 + Math.random() * 0.8),
        gravity,
      });
    }
  }

  function addText(x, y, text, color = '#d84315') {
    floatTexts.push({ x, y, text, color, life: 1.0, maxLife: 1.0 });
  }

  // ===== 關卡載入 =====
  // 從 idx 載入正式或自製關卡。levelIndex < 0 代表「試玩」狀態。
  // lvOverride 可直接傳入一個 {name, speed, grid} 物件做臨時關卡
  function loadLevel(idx, lvOverride) {
    levelIndex = idx;
    const lv = lvOverride || LEVELS[idx] || getCustomLevelByIndex(idx);
    if (!lv) return;
    currentLevel = lv;
    targets = [];
    powerups.length = 0;
    extraBalls.length = 0;
    fx.paddleWideT = 0;
    fx.slowT = 0;
    fx.doubleT = 0;
    const rows = lv.grid;
    const totalH = rows.length * (BLOCK_H + BLOCK_GAP) - BLOCK_GAP;
    const offsetY = BLOCK_AREA_TOP + Math.max(0, ((BLOCK_AREA_BOTTOM - BLOCK_AREA_TOP) * 0.18));
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < COLS && c < row.length; c++) {
        const ch = row[c];
        const mat = MATERIALS[ch];
        if (!mat) continue;
        const x = PLAY_AREA.left + BLOCK_GAP + c * (BLOCK_W + BLOCK_GAP);
        const y = offsetY + r * (BLOCK_H + BLOCK_GAP);
        targets.push({
          x, y, w: BLOCK_W, h: BLOCK_H,
          type: mat.type, hp: mat.hp, maxHp: mat.hp,
          dead: false, fadeT: 0,
          hidden: !!mat.hidden,
          colorSeed: (r * 7 + c * 13) % 360,
        });
      }
    }
    bgTheme = lv.theme || 'warm';
    resetBall(lv.speed);
    updateHUD();
  }

  // 從 editor 取啟用中的自製關卡
  function getEnabledCustomLevels() {
    return (window.MFSB_EDITOR && typeof window.MFSB_EDITOR.getEnabledCustomLevels === 'function')
      ? window.MFSB_EDITOR.getEnabledCustomLevels() : [];
  }

  // 自製關卡：依「正式 10 關 + 啟用中的自製關卡序列」對 idx 取關卡
  function getCustomLevelByIndex(idx) {
    const enabled = getEnabledCustomLevels();
    const customIdx = idx - LEVELS.length;
    if (customIdx >= 0 && customIdx < enabled.length) return enabled[customIdx];
    return null;
  }

  function totalLevelCount() {
    return LEVELS.length + getEnabledCustomLevels().length;
  }

  function resetBall(speed) {
    paddle.w = PADDLE_W_BASE;
    paddle.x = (W - paddle.w) / 2;
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - ball.r - 4;
    const angle = -Math.PI / 2 + rand(-0.3, 0.3); // 約垂直向上、略偏
    const baseSpeed = speed || LEVELS[levelIndex].speed;
    const s = baseSpeed * speedMultiplier;
    ball.vx = Math.cos(angle) * s;
    ball.vy = Math.sin(angle) * s;
    ball.speed = s;
    ball.stuck = true;
    state = STATE.READY;
  }

  function launchBall() {
    if (!ball.stuck) return;
    ball.stuck = false;
    state = STATE.PLAYING;
  }

  // ===== 更新 =====
  let last = 0;
  function loop(t) {
    if (!last) last = t;
    let dt = (t - last) / 1000;
    if (dt > 0.05) dt = 0.05; // 防止分頁切回時跳太大
    last = t;

    if (state === STATE.PLAYING || state === STATE.READY) {
      update(dt);
    }
    // 即使非主動遊戲狀態也持續更新粒子/文字（餘味）
    updateParticles(dt);
    updateFloatTexts(dt);

    render();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    // 擋板鍵盤
    const paddleSpeed = 720;
    if (keysPressed.left)  paddle.x -= paddleSpeed * dt;
    if (keysPressed.right) paddle.x += paddleSpeed * dt;
    if (pointerActive) {
      const target = pointerX - paddle.w / 2;
      paddle.x += (target - paddle.x) * Math.min(1, dt * 18);
    }
    paddle.x = clamp(paddle.x, PLAY_AREA.left, PLAY_AREA.right - paddle.w);

    // 效果計時遞減
    if (fx.paddleWideT > 0) {
      fx.paddleWideT -= dt;
      if (fx.paddleWideT <= 0) paddle.w = PADDLE_W_BASE;
    }
    if (fx.slowT > 0) fx.slowT -= dt;
    if (fx.doubleT > 0) fx.doubleT -= dt;

    if (ball.stuck) {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r - 4;
      updatePowerups(dt);
      return;
    }

    // 主球
    const stepsMain = Math.ceil(Math.max(Math.abs(ball.vx), Math.abs(ball.vy)) * dt / 8);
    const subDtMain = dt / Math.max(1, stepsMain);
    for (let s = 0; s < Math.max(1, stepsMain); s++) {
      if (stepOneBall(ball, subDtMain, true)) break;
    }

    // 額外球
    for (let i = extraBalls.length - 1; i >= 0; i--) {
      const b = extraBalls[i];
      const steps = Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)) * dt / 8);
      const subDt = dt / Math.max(1, steps);
      let lost = false;
      for (let s = 0; s < Math.max(1, steps); s++) {
        if (stepOneBall(b, subDt, false)) { lost = true; break; }
      }
      if (lost) extraBalls.splice(i, 1);
    }

    updatePowerups(dt);

    // 檢查過關（不可破磚不算需清除）
    if (targets.every(t => t.dead || t.type === 'indestructible')) onLevelClear();
  }

  // 推進單顆球。回傳 true 表示這顆球已落地（呼叫端決定處理方式）
  function stepOneBall(b, dt, isPrimary) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // 牆壁
    if (b.x - b.r < PLAY_AREA.left) {
      b.x = PLAY_AREA.left + b.r;
      b.vx = Math.abs(b.vx);
      SFX.wall();
    } else if (b.x + b.r > PLAY_AREA.right) {
      b.x = PLAY_AREA.right - b.r;
      b.vx = -Math.abs(b.vx);
      SFX.wall();
    }
    if (b.y - b.r < PLAY_AREA.top + TOP_INFO_BAND - 10) {
      b.y = PLAY_AREA.top + TOP_INFO_BAND - 10 + b.r;
      b.vy = Math.abs(b.vy);
      SFX.wall();
    }

    // 死亡線
    if (b.y - b.r > H + 10) {
      if (isPrimary) {
        // 若還有副球，從副球中選一顆升為主球
        if (extraBalls.length > 0) {
          const promoted = extraBalls.shift();
          ball.x = promoted.x; ball.y = promoted.y;
          ball.vx = promoted.vx; ball.vy = promoted.vy;
          ball.speed = promoted.speed; ball.stuck = false;
          addText(W/2, H - 240, '🔄 還有球！', '#7b1fa2');
          return false;
        }
        onBallLost();
      }
      return true;
    }

    // 擋板碰撞
    if (b.vy > 0 &&
        b.y + b.r >= paddle.y &&
        b.y - b.r <= paddle.y + paddle.h &&
        b.x >= paddle.x - b.r && b.x <= paddle.x + paddle.w + b.r) {
      const hitPos = clamp((b.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2), -1, 1);
      const bounceAngle = hitPos * (Math.PI / 3);
      const speed = Math.hypot(b.vx, b.vy) || b.speed;
      const newSpeed = Math.max(speed, b.speed);
      b.vx = Math.sin(bounceAngle) * newSpeed;
      b.vy = -Math.abs(Math.cos(bounceAngle) * newSpeed);
      b.y = paddle.y - b.r - 0.5;
      const minVy = newSpeed * 0.42;
      if (Math.abs(b.vy) < minVy) b.vy = -minVy;
      SFX.paddle();
      addParticles(b.x, paddle.y, '#fff59d', 6, { speed: 140, life: 0.35, r: 3, gravity: 200 });
    }

    // 目標碰撞
    for (const tg of targets) {
      if (tg.dead) continue;
      if (collideCircleRect(b, tg)) {
        resolveCollision(b, tg);
        damageTarget(tg);
        break;
      }
    }
    return false;
  }

  // 圓-矩形碰撞
  function collideCircleRect(c, r) {
    const cx = clamp(c.x, r.x, r.x + r.w);
    const cy = clamp(c.y, r.y, r.y + r.h);
    const dx = c.x - cx, dy = c.y - cy;
    return (dx * dx + dy * dy) <= c.r * c.r;
  }

  // 依碰撞點推回並反彈
  function resolveCollision(c, r) {
    const cx = clamp(c.x, r.x, r.x + r.w);
    const cy = clamp(c.y, r.y, r.y + r.h);
    const dx = c.x - cx;
    const dy = c.y - cy;
    const dist = Math.hypot(dx, dy) || 0.0001;
    // 內部碰撞時：選最小推出距離方向
    const inside = (dx === 0 && dy === 0);
    if (inside) {
      // 取最靠近的邊
      const leftD = c.x - r.x;
      const rightD = (r.x + r.w) - c.x;
      const topD = c.y - r.y;
      const botD = (r.y + r.h) - c.y;
      const m = Math.min(leftD, rightD, topD, botD);
      if (m === topD)        { c.y = r.y - c.r;          c.vy = -Math.abs(c.vy); }
      else if (m === botD)   { c.y = r.y + r.h + c.r;    c.vy = Math.abs(c.vy);  }
      else if (m === leftD)  { c.x = r.x - c.r;          c.vx = -Math.abs(c.vx); }
      else                   { c.x = r.x + r.w + c.r;    c.vx = Math.abs(c.vx);  }
    } else {
      // 推回到圓心距離 = r
      const nx = dx / dist, ny = dy / dist;
      const overlap = c.r - dist;
      c.x += nx * overlap;
      c.y += ny * overlap;
      // 反射
      const vdotn = c.vx * nx + c.vy * ny;
      c.vx = c.vx - 2 * vdotn * nx;
      c.vy = c.vy - 2 * vdotn * ny;
    }
  }

  function damageTarget(tg) {
    // 不可破：純反彈、無傷害
    if (tg.type === 'indestructible') {
      SFX.wall();
      return;
    }
    // 隱藏磚：第一次碰到「揭曉」，不算扣血
    if (tg.hidden) {
      tg.hidden = false;
      SFX.fruitCrack();
      addParticles(tg.x + tg.w / 2, tg.y + tg.h / 2, '#fff59d', 10,
                   { speed: 220, life: 0.5, r: 3 });
      return;
    }
    tg.hp -= 1;
    if (tg.hp <= 0) {
      tg.dead = true;
      tg.fadeT = 0.3;
      onTargetBroken(tg);
    } else {
      // 第一下未破：裂痕音效 + 小粒子
      SFX.fruitCrack();
      addParticles(tg.x + tg.w / 2, tg.y + tg.h / 2, fruitJuiceColor(tg), 6,
                   { speed: 160, life: 0.35, r: 3 });
    }
  }

  function fruitJuiceColor(tg) {
    if (tg.type === 'watermelon') return '#ef5350';
    if (tg.type === 'strawberry') return '#ec407a';
    if (tg.type === 'orange')     return '#ffa726';
    return '#fff';
  }

  function onTargetBroken(tg) {
    const cx = tg.x + tg.w / 2, cy = tg.y + tg.h / 2;
    let scoreGain = 10;
    if (tg.type === 'brick') {
      SFX.brick();
      addParticles(cx, cy, `hsl(${tg.colorSeed}, 80%, 60%)`, 14, { speed: 280, life: 0.6, r: 4 });
      scoreGain = 10;
    } else if (tg.type === 'water') {
      SFX.waterball();
      addParticles(cx, cy, '#4fc3f7', 22, { speed: 320, life: 0.7, r: 5, gravity: 800 });
      addParticles(cx, cy, '#b3e5fc', 16, { speed: 200, life: 0.6, r: 3, gravity: 600 });
      scoreGain = 15;
    } else if (tg.type === 'watermelon' || tg.type === 'strawberry' || tg.type === 'orange') {
      SFX.fruitPop();
      const c = fruitJuiceColor(tg);
      addParticles(cx, cy, c, 26, { speed: 320, life: 0.75, r: 5, gravity: 700 });
      addParticles(cx, cy, '#fff59d', 8, { speed: 180, life: 0.5, r: 3 });
      scoreGain = 25;
    } else if (tg.type === 'steel') {
      SFX.brick();
      addParticles(cx, cy, '#90a4ae', 18, { speed: 320, life: 0.6, r: 4 });
      addParticles(cx, cy, '#eceff1', 10, { speed: 240, life: 0.5, r: 3 });
      scoreGain = 40;
    } else if (tg.type === 'gem') {
      SFX.brick();
      SFX.clear();
      addParticles(cx, cy, '#42a5f5', 24, { speed: 380, life: 0.8, r: 5 });
      addParticles(cx, cy, '#fff', 12, { speed: 260, life: 0.6, r: 3 });
      scoreGain = 100;
    } else if (tg.type === 'mystery') {
      SFX.brick();
      addParticles(cx, cy, `hsl(${(Date.now() / 10) % 360}, 80%, 60%)`, 22, { speed: 340, life: 0.7, r: 4 });
      spawnPowerup(cx, cy);
      scoreGain = 20;
    } else if (tg.type === 'hidden') {
      SFX.brick();
      addParticles(cx, cy, '#7e57c2', 14, { speed: 260, life: 0.55, r: 4 });
      scoreGain = 30; // 揭曉後再打一下才破，給更多分
    } else if (tg.type === 'speedup') {
      SFX.brick();
      addParticles(cx, cy, '#ffeb3b', 18, { speed: 340, life: 0.55, r: 4 });
      // 球加速 10%
      ball.speed = Math.min(ball.speed * 1.1, 1200);
      ball.vx *= 1.1; ball.vy *= 1.1;
      for (const b of extraBalls) { b.speed = Math.min(b.speed * 1.1, 1200); b.vx *= 1.1; b.vy *= 1.1; }
      addText(cx, cy - 14, '⚡ 加速！', '#ff6f00');
      scoreGain = 20;
    }
    if (fx.doubleT > 0) scoreGain *= 2;
    score += scoreGain;
    addText(cx, cy - 8, `+${scoreGain}`, '#d84315');
    updateHUD();
  }

  function onBallLost() {
    SFX.miss();
    addParticles(ball.x, H - 20, '#90caf9', 20, { speed: 220, life: 0.6, r: 4 });
    if (gameMode === 'easy') {
      // 無限重生
      addText(W / 2, H - 240, '球回來啦！', '#1976d2');
      resetBall();
    } else {
      lives -= 1;
      updateHUD();
      if (lives <= 0) {
        state = STATE.GAMEOVER;
        showOverlay(gameOverScreen);
        gameOverInfo.textContent = `分數：${score}　關卡：${levelIndex + 1}`;
        SFX.gameOver();
        return;
      }
      addText(W / 2, H - 240, '小心！剩 ' + lives + ' 顆 ❤️', '#c62828');
      resetBall();
    }
  }

  function onLevelClear() {
    state = STATE.CLEARED;
    SFX.clear();
    spawnFireworks();
    setTimeout(() => {
      // 試玩單張關卡：levelIndex === -1，過關後回編輯器
      if (levelIndex === -1) {
        state = STATE.TITLE;
        if (window.MFSB_EDITOR && window.MFSB_EDITOR.onTestPlayEnd) {
          window.MFSB_EDITOR.onTestPlayEnd(true, score);
        }
        return;
      }
      const total = totalLevelCount();
      const nextIdx = levelIndex + 1;
      if (nextIdx >= total) {
        state = STATE.VICTORY;
        showOverlay(victoryScreen);
        document.getElementById('victory-info').textContent = `最終分數：${score} 🎊`;
      } else {
        const nextLv = LEVELS[nextIdx] || getCustomLevelByIndex(nextIdx);
        clearInfo.textContent = `分數：${score}　準備迎接「${nextLv ? nextLv.name : '下一關'}」`;
        showOverlay(clearScreen);
      }
    }, 800);
  }

  function spawnFireworks() {
    const cx = W / 2, cy = H / 2;
    for (let i = 0; i < 5; i++) {
      const x = rand(W * 0.2, W * 0.8);
      const y = rand(H * 0.25, H * 0.55);
      const hue = Math.floor(rand(0, 360));
      setTimeout(() => {
        addParticles(x, y, `hsl(${hue}, 90%, 60%)`, 40,
                     { speed: 380, life: 0.9, r: 4, gravity: 500 });
      }, i * 140);
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  // ===== 道具系統 =====
  const POWERUP_TYPES = ['wide', 'slow', 'multi', 'double', 'gem'];
  const POWERUP_VISUAL = {
    wide:   { emoji: '↔️', label: '擋板變寬', color: '#ffca28' },
    slow:   { emoji: '🐢', label: '慢速球',   color: '#66bb6a' },
    multi:  { emoji: '⚪', label: '多球',     color: '#ec407a' },
    double: { emoji: '✖2', label: '雙倍分',   color: '#ab47bc' },
    gem:    { emoji: '💎', label: '+50',     color: '#42a5f5' },
  };

  function spawnPowerup(x, y) {
    const t = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerups.push({ x, y, vy: 140, type: t, r: 14 });
    addText(x, y - 20, '🎁 道具!', '#ab47bc');
  }

  function updatePowerups(dt) {
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.vy * dt;
      // 碰擋板？
      if (p.y + p.r >= paddle.y && p.y - p.r <= paddle.y + paddle.h &&
          p.x >= paddle.x - p.r && p.x <= paddle.x + paddle.w + p.r) {
        applyPowerup(p);
        powerups.splice(i, 1);
        continue;
      }
      if (p.y > H + 30) powerups.splice(i, 1);
    }
  }

  function applyPowerup(p) {
    const v = POWERUP_VISUAL[p.type];
    SFX.clear();
    addText(W / 2, paddle.y - 40, `${v.emoji} ${v.label}`, v.color);
    if (p.type === 'wide') {
      fx.paddleWideT = 10;
      paddle.w = PADDLE_W_BASE * 1.5;
    } else if (p.type === 'slow') {
      fx.slowT = 8;
      // 把所有球速縮短到 0.7×（只調當下速度，下次擋板碰撞會用 ball.speed 計）
      const apply = b => { b.vx *= 0.7; b.vy *= 0.7; b.speed *= 0.7; };
      apply(ball); for (const b of extraBalls) apply(b);
    } else if (p.type === 'multi') {
      // 從主球的位置 spawn 兩顆額外球，左右兩個角度
      const baseSpeed = ball.speed || 400;
      for (let i = 0; i < 2; i++) {
        const angle = -Math.PI / 2 + (i === 0 ? -0.6 : 0.6);
        extraBalls.push({
          x: ball.x, y: ball.y, r: ball.r,
          vx: Math.cos(angle) * baseSpeed,
          vy: Math.sin(angle) * baseSpeed,
          speed: baseSpeed,
        });
      }
    } else if (p.type === 'double') {
      fx.doubleT = 10;
    } else if (p.type === 'gem') {
      score += 50;
      addText(paddle.x + paddle.w / 2, paddle.y - 30, '+50', '#1976d2');
    }
    updateHUD();
  }

  function updateFloatTexts(dt) {
    for (let i = floatTexts.length - 1; i >= 0; i--) {
      const t = floatTexts[i];
      t.life -= dt;
      t.y -= 40 * dt;
      if (t.life <= 0) floatTexts.splice(i, 1);
    }
  }

  // ===== 渲染 =====
  function render() {
    ctx.clearRect(0, 0, W, H);

    // 背景：柔和漸層 + 圓點
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#fff3e0');
    bg.addColorStop(0.55, '#ffe0b2');
    bg.addColorStop(1, '#ffccbc');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 上方資訊條
    drawTopBand();

    // 邊框
    ctx.strokeStyle = 'rgba(141, 110, 99, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(PLAY_AREA.left, PLAY_AREA.top + TOP_INFO_BAND - 10,
                   PLAY_AREA.right - PLAY_AREA.left,
                   PLAY_AREA.bottom - (PLAY_AREA.top + TOP_INFO_BAND - 10));

    // 死亡線指示（淡）
    ctx.strokeStyle = 'rgba(244, 67, 54, 0.18)';
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(PLAY_AREA.left, H - 22);
    ctx.lineTo(PLAY_AREA.right, H - 22);
    ctx.stroke();
    ctx.setLineDash([]);

    // 目標
    for (const tg of targets) {
      if (tg.dead) continue;
      drawTarget(tg);
    }

    // 擋板
    drawPaddle();

    // 額外球
    for (const b of extraBalls) drawBallAt(b);
    // 主球
    drawBall();
    // 道具
    for (const p of powerups) drawPowerup(p);

    // 粒子
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 飄字
    for (const t of floatTexts) {
      ctx.globalAlpha = clamp(t.life / t.maxLife, 0, 1);
      ctx.fillStyle = t.color;
      ctx.font = 'bold 26px "Comic Sans MS", "Microsoft JhengHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    // READY 提示
    if (state === STATE.READY) {
      ctx.fillStyle = 'rgba(93, 64, 55, 0.85)';
      ctx.font = 'bold 22px "Comic Sans MS", "Microsoft JhengHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👇 點一下螢幕發射！', W / 2, H - 110);
    }
  }

  function drawTopBand() {
    if (state === STATE.TITLE) return;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    roundRect(ctx, PLAY_AREA.left, PLAY_AREA.top, PLAY_AREA.right - PLAY_AREA.left, TOP_INFO_BAND - 14, 14);
    ctx.fill();
    ctx.fillStyle = '#5d4037';
    ctx.font = 'bold 20px "Comic Sans MS", "Microsoft JhengHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const lv = LEVELS[levelIndex];
    ctx.fillText(`${lv ? lv.name : ''}`, PLAY_AREA.left + 16, PLAY_AREA.top + (TOP_INFO_BAND - 14) / 2);

    ctx.textAlign = 'right';
    if (gameMode === 'challenge') {
      ctx.fillText(`❤️×${lives}  ${score}`, PLAY_AREA.right - 16, PLAY_AREA.top + (TOP_INFO_BAND - 14) / 2);
    } else {
      ctx.fillText(`分數 ${score}`, PLAY_AREA.right - 16, PLAY_AREA.top + (TOP_INFO_BAND - 14) / 2);
    }
  }

  function drawPaddle() {
    const x = paddle.x, y = paddle.y, w = paddle.w, h = paddle.h;
    // 陰影（加深）
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    roundRect(ctx, x + 3, y + 6, w, h, 14); ctx.fill();
    // 深色描邊（讓擋板更顯眼）
    ctx.fillStyle = '#bf360c';
    roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 16); ctx.fill();
    // 主體漸層
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, PADDLE_COLOR_TOP);
    g.addColorStop(1, PADDLE_COLOR_BTM);
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, 14); ctx.fill();
    // 亮邊
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    roundRect(ctx, x + 8, y + 4, w - 16, 6, 4); ctx.fill();
    // 中央小錨點（讓正中央位置可被看見）
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBall() { drawBallAt(ball); }
  function drawBallAt(b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    // 陰影
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.arc(1.5, 3, b.r, 0, Math.PI * 2); ctx.fill();
    // 球體
    const g = ctx.createRadialGradient(-3, -3, 2, 0, 0, b.r);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.5, '#ffeb3b');
    g.addColorStop(1, '#ef6c00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, b.r, 0, Math.PI * 2); ctx.fill();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(-3.5, -3.5, b.r * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawPowerup(p) {
    const v = POWERUP_VISUAL[p.type];
    ctx.save();
    ctx.translate(p.x, p.y);
    // 外殼
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.arc(1, 2, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = v.color;
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.stroke();
    // 圖示
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${p.r * 1.2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(v.emoji, 0, 1);
    ctx.restore();
  }

  function drawTarget(tg) {
    if (tg.hidden) { drawHiddenTarget(tg); return; }
    const cx = tg.x + tg.w / 2;
    const cy = tg.y + tg.h / 2;
    if (tg.type === 'brick')              drawBrick(tg);
    else if (tg.type === 'water')         drawWater(tg);
    else if (tg.type === 'watermelon' ||
             tg.type === 'strawberry' ||
             tg.type === 'orange')        drawFruit(tg);
    else if (tg.type === 'steel')         drawSteel(tg);
    else if (tg.type === 'indestructible')drawIndestructible(tg);
    else if (tg.type === 'gem')           drawGem(tg);
    else if (tg.type === 'mystery')       drawMystery(tg);
    else if (tg.type === 'speedup')       drawSpeedup(tg);
    else if (tg.type === 'hidden')        drawBrick(tg); // 揭曉後當磚

    // 受傷裂痕（鋼磚與多 hp 目標）
    if (tg.hp < tg.maxHp && tg.type !== 'indestructible') {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tg.x + tg.w * 0.3, tg.y + tg.h * 0.25);
      ctx.lineTo(tg.x + tg.w * 0.45, tg.y + tg.h * 0.55);
      ctx.lineTo(tg.x + tg.w * 0.6,  tg.y + tg.h * 0.4);
      ctx.lineTo(tg.x + tg.w * 0.75, tg.y + tg.h * 0.75);
      ctx.stroke();
    }
  }

  function drawBrick(tg) {
    const hue = tg.colorSeed;
    const g = ctx.createLinearGradient(tg.x, tg.y, tg.x, tg.y + tg.h);
    g.addColorStop(0, `hsl(${hue}, 85%, 70%)`);
    g.addColorStop(1, `hsl(${hue}, 80%, 50%)`);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    roundRect(ctx, tg.x + 1, tg.y + 3, tg.w, tg.h, 8); ctx.fill();
    ctx.fillStyle = g;
    roundRect(ctx, tg.x, tg.y, tg.w, tg.h, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    roundRect(ctx, tg.x + 4, tg.y + 3, tg.w - 8, 5, 3); ctx.fill();
  }

  function drawSteel(tg) {
    // 金屬鋼磚
    const g = ctx.createLinearGradient(tg.x, tg.y, tg.x, tg.y + tg.h);
    g.addColorStop(0, '#cfd8dc');
    g.addColorStop(0.5, '#90a4ae');
    g.addColorStop(1, '#546e7a');
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ctx, tg.x + 1, tg.y + 3, tg.w, tg.h, 6); ctx.fill();
    ctx.fillStyle = g;
    roundRect(ctx, tg.x, tg.y, tg.w, tg.h, 6); ctx.fill();
    // 鉚釘
    ctx.fillStyle = '#37474f';
    [0.18, 0.82].forEach(fx => {
      [0.25, 0.75].forEach(fy => {
        ctx.beginPath();
        ctx.arc(tg.x + tg.w * fx, tg.y + tg.h * fy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    // 顯示剩餘 hp
    if (tg.hp < tg.maxHp) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tg.hp, tg.x + tg.w / 2, tg.y + tg.h / 2);
    }
  }

  function drawIndestructible(tg) {
    // 深灰純反彈
    const g = ctx.createLinearGradient(tg.x, tg.y, tg.x, tg.y + tg.h);
    g.addColorStop(0, '#37474f');
    g.addColorStop(1, '#1c2833');
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, tg.x + 1, tg.y + 3, tg.w, tg.h, 4); ctx.fill();
    ctx.fillStyle = g;
    roundRect(ctx, tg.x, tg.y, tg.w, tg.h, 4); ctx.fill();
    // 十字斜線
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tg.x + 2, tg.y + 2); ctx.lineTo(tg.x + tg.w - 2, tg.y + tg.h - 2);
    ctx.moveTo(tg.x + tg.w - 2, tg.y + 2); ctx.lineTo(tg.x + 2, tg.y + tg.h - 2);
    ctx.stroke();
  }

  function drawGem(tg) {
    const cx = tg.x + tg.w / 2, cy = tg.y + tg.h / 2;
    const w = tg.w * 0.5, h = tg.h * 0.7;
    // 菱形
    ctx.save();
    ctx.translate(cx, cy);
    const g = ctx.createLinearGradient(0, -h/2, 0, h/2);
    g.addColorStop(0, '#e1f5fe');
    g.addColorStop(0.5, '#29b6f6');
    g.addColorStop(1, '#0277bd');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -h/2);
    ctx.lineTo(w/2, 0);
    ctx.lineTo(0, h/2);
    ctx.lineTo(-w/2, 0);
    ctx.closePath();
    ctx.fill();
    // 高光線
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-w/2, 0); ctx.lineTo(0, -h/2); ctx.lineTo(w/2, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawMystery(tg) {
    const cx = tg.x + tg.w / 2, cy = tg.y + tg.h / 2;
    // 彩虹漸層磚
    const hue = (Date.now() / 8 + tg.colorSeed) % 360;
    const g = ctx.createLinearGradient(tg.x, tg.y, tg.x + tg.w, tg.y + tg.h);
    g.addColorStop(0, `hsl(${hue}, 85%, 70%)`);
    g.addColorStop(0.5, `hsl(${(hue + 120) % 360}, 85%, 60%)`);
    g.addColorStop(1, `hsl(${(hue + 240) % 360}, 85%, 55%)`);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    roundRect(ctx, tg.x + 1, tg.y + 3, tg.w, tg.h, 8); ctx.fill();
    ctx.fillStyle = g;
    roundRect(ctx, tg.x, tg.y, tg.w, tg.h, 8); ctx.fill();
    // ? 符號
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(tg.h * 0.7)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, cy);
  }

  function drawHiddenTarget(tg) {
    // 隱藏磚未揭曉：只畫一個淡淡輪廓提示
    ctx.fillStyle = 'rgba(120, 100, 90, 0.05)';
    roundRect(ctx, tg.x, tg.y, tg.w, tg.h, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(120, 100, 90, 0.15)';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(tg.x + 2, tg.y + 2, tg.w - 4, tg.h - 4);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawSpeedup(tg) {
    const cx = tg.x + tg.w / 2, cy = tg.y + tg.h / 2;
    const g = ctx.createLinearGradient(tg.x, tg.y, tg.x, tg.y + tg.h);
    g.addColorStop(0, '#fff176');
    g.addColorStop(1, '#fbc02d');
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    roundRect(ctx, tg.x + 1, tg.y + 3, tg.w, tg.h, 6); ctx.fill();
    ctx.fillStyle = g;
    roundRect(ctx, tg.x, tg.y, tg.w, tg.h, 6); ctx.fill();
    // 閃電符號
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(tg.h * 0.75)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', cx, cy);
  }

  function drawWater(tg) {
    const cx = tg.x + tg.w / 2;
    const cy = tg.y + tg.h / 2;
    const r = Math.min(tg.w, tg.h) * 0.55;
    // 陰影
    ctx.fillStyle = 'rgba(2, 119, 189, 0.25)';
    ctx.beginPath(); ctx.arc(cx + 1, cy + 3, r, 0, Math.PI * 2); ctx.fill();
    // 主體
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    g.addColorStop(0, 'rgba(225, 245, 254, 0.95)');
    g.addColorStop(0.6, 'rgba(79, 195, 247, 0.85)');
    g.addColorStop(1, 'rgba(2, 136, 209, 0.85)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.35, cy - r * 0.4, r * 0.25, r * 0.15, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFruit(tg) {
    const cx = tg.x + tg.w / 2;
    const cy = tg.y + tg.h / 2;
    const r = Math.min(tg.w, tg.h) * 0.55;
    let main, dark, leaf = '#66bb6a';
    if (tg.type === 'watermelon') { main = '#ef5350'; dark = '#c62828'; }
    else if (tg.type === 'strawberry') { main = '#ec407a'; dark = '#ad1457'; }
    else { main = '#ffa726'; dark = '#ef6c00'; }

    // 陰影
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.arc(cx + 1, cy + 3, r, 0, Math.PI * 2); ctx.fill();
    // 果身
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,0.6)');
    g.addColorStop(0.4, main);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    // 裝飾
    if (tg.type === 'watermelon') {
      // 西瓜籽
      ctx.fillStyle = '#3e2723';
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + tg.colorSeed * 0.01;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * r * 0.35, cy + Math.sin(a) * r * 0.35, 1.5, 2.8, a, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (tg.type === 'strawberry') {
      // 草莓白點
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + tg.colorSeed * 0.01;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r * 0.4, cy + Math.sin(a) * r * 0.4, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // 橘子紋
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
        ctx.stroke();
      }
    }

    // 葉子
    ctx.fillStyle = leaf;
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.1, cy - r * 0.9, r * 0.18, r * 0.32, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.35, cy - r * 0.35, r * 0.22, r * 0.13, -0.5, 0, Math.PI * 2);
    ctx.fill();
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

  // ===== UI 控制 =====
  function updateHUD() {
    const devTag = (speedMultiplier !== 1) ? ` · ⚙️${speedMultiplier}×` : '';
    if (levelIndex === -1) {
      levelBadge.textContent = `🎨 試玩中`;
    } else {
      levelBadge.textContent = `第 ${levelIndex + 1} 關${devTag}`;
    }
    scoreBadge.textContent = `分數 ${score}`;
    if (gameMode === 'challenge') {
      livesBadge.classList.remove('hidden');
      livesBadge.textContent = '❤️'.repeat(lives) || '—';
    } else {
      livesBadge.classList.add('hidden');
    }
  }

  function hideAllOverlays() {
    [titleScreen, clearScreen, victoryScreen, gameOverScreen, pauseScreen,
     document.getElementById('dev-screen'),
     document.getElementById('editor-screen'),
     document.getElementById('mylevels-screen'),
     document.getElementById('template-screen'),
     document.getElementById('text-dialog')]
      .forEach(o => o && o.classList.add('hidden'));
  }
  function showOverlay(el) {
    hideAllOverlays();
    el.classList.remove('hidden');
  }

  function startGame(mode) {
    SFX.button();
    gameMode = mode;
    score = 0;
    lives = 5;
    speedMultiplier = 1; // 正常模式回到 1×
    hideAllOverlays();
    hud.classList.remove('hidden');
    pauseBtn.classList.remove('hidden');
    loadLevel(0);
    ensureAudio();
  }

  function startGameDev(mode, levelIdx, speedMul) {
    SFX.button();
    gameMode = mode;
    score = 0;
    lives = 5;
    speedMultiplier = speedMul;
    hideAllOverlays();
    hud.classList.remove('hidden');
    pauseBtn.classList.remove('hidden');
    loadLevel(Math.max(0, Math.min(LEVELS.length - 1, levelIdx)));
    ensureAudio();
  }

  function goToNextLevel() {
    SFX.button();
    hideAllOverlays();
    loadLevel(levelIndex + 1);
  }

  function retryFromGameOver() {
    SFX.button();
    score = 0;
    lives = 5;
    hideAllOverlays();
    loadLevel(0);
  }

  function backToTitle() {
    SFX.button();
    state = STATE.TITLE;
    hud.classList.add('hidden');
    pauseBtn.classList.add('hidden');
    showOverlay(titleScreen);
  }

  function togglePause() {
    if (state === STATE.PLAYING || state === STATE.READY) {
      state = STATE.PAUSED;
      showOverlay(pauseScreen);
    } else if (state === STATE.PAUSED) {
      hideAllOverlays();
      state = ball.stuck ? STATE.READY : STATE.PLAYING;
    }
  }

  // ===== 事件綁定 =====
  // 模式選擇
  document.querySelectorAll('.mode-buttons .big-btn').forEach(btn => {
    btn.addEventListener('click', () => startGame(btn.dataset.mode));
  });

  // 開發者模式
  const devScreen = document.getElementById('dev-screen');
  const devLevelGroup = document.getElementById('dev-level-group');
  const devSpeedGroup = document.getElementById('dev-speed-group');
  const devModeGroup  = document.getElementById('dev-mode-group');
  let devLevel = 0, devSpeed = 1, devMode = 'easy';

  function makeSegHandler(group, onPick) {
    group.querySelectorAll('.seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        SFX.button();
        group.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onPick(btn);
      });
    });
  }
  makeSegHandler(devLevelGroup, btn => { devLevel = parseInt(btn.dataset.level, 10) || 0; });
  makeSegHandler(devSpeedGroup, btn => { devSpeed = parseFloat(btn.dataset.speed) || 1; });
  makeSegHandler(devModeGroup,  btn => { devMode = btn.dataset.devmode || 'easy'; });

  document.getElementById('dev-mode-btn').addEventListener('click', () => {
    SFX.button();
    showOverlay(devScreen);
  });
  document.getElementById('dev-back-btn').addEventListener('click', () => {
    SFX.button();
    showOverlay(titleScreen);
  });
  document.getElementById('dev-start-btn').addEventListener('click', () => {
    startGameDev(devMode, devLevel, devSpeed);
  });
  document.getElementById('next-level-btn').addEventListener('click', goToNextLevel);
  document.getElementById('play-again-btn').addEventListener('click', () => { score = 0; lives = 5; loadLevel(0); hideAllOverlays(); });
  document.getElementById('retry-btn').addEventListener('click', retryFromGameOver);
  document.getElementById('back-title-btn').addEventListener('click', backToTitle);
  document.getElementById('resume-btn').addEventListener('click', togglePause);
  document.getElementById('quit-btn').addEventListener('click', backToTitle);
  pauseBtn.addEventListener('click', togglePause);

  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    localStorage.setItem('mfsb_muted', isMuted ? '1' : '0');
    syncMuteUI();
    if (!isMuted) SFX.button();
  });

  // ===== 指針輸入（觸控/滑鼠） =====
  function canvasPointFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    return cx * (W / rect.width);
  }

  function onPointerDown(e) {
    if (state === STATE.TITLE || state === STATE.PAUSED ||
        state === STATE.GAMEOVER || state === STATE.VICTORY ||
        state === STATE.CLEARED) return;
    e.preventDefault();
    pointerActive = true;
    pointerX = canvasPointFromEvent(e);
    // 容錯：當在 ready 狀態，點下去就發射
    if (state === STATE.READY) launchBall();
    ensureAudio();
  }

  function onPointerMove(e) {
    if (!pointerActive) return;
    e.preventDefault();
    pointerX = canvasPointFromEvent(e);
  }

  function onPointerUp() { pointerActive = false; }

  canvas.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  canvas.addEventListener('touchstart', onPointerDown, { passive: false });
  canvas.addEventListener('touchmove', onPointerMove,  { passive: false });
  canvas.addEventListener('touchend', onPointerUp);
  canvas.addEventListener('touchcancel', onPointerUp);

  // 鍵盤
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA')  keysPressed.left = true;
    if (e.code === 'ArrowRight'|| e.code === 'KeyD')  keysPressed.right = true;
    if (e.code === 'Space' || e.code === 'Enter') {
      if (state === STATE.READY) launchBall();
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (state === STATE.PLAYING || state === STATE.READY || state === STATE.PAUSED) togglePause();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA')  keysPressed.left = false;
    if (e.code === 'ArrowRight'|| e.code === 'KeyD')  keysPressed.right = false;
  });

  // 視窗失焦自動暫停
  window.addEventListener('blur', () => {
    if (state === STATE.PLAYING) togglePause();
  });

  // ===== Canvas 響應式（高 DPI + 自動 fit） =====
  function fitCanvas() {
    const stage = canvas.parentElement;
    const rect = stage.getBoundingClientRect();
    // 多扣 6px 緩衝，避免擠到視窗邊
    const availW = Math.max(0, rect.width  - 6);
    const availH = Math.max(0, rect.height - 6);
    if (availW <= 10 || availH <= 10) return;
    const aspect = W / H; // 0.6
    // 先以可用高度為基準，再 fit 寬度（保證高度不超過 stage）
    let dispH = availH;
    let dispW = dispH * aspect;
    if (dispW > availW) {
      dispW = availW;
      dispH = dispW / aspect;
    }
    canvas.style.width  = dispW + 'px';
    canvas.style.height = dispH + 'px';

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fitCanvas();
  window.addEventListener('resize', fitCanvas);
  window.addEventListener('orientationchange', fitCanvas);
  // 用 ResizeObserver 跟蹤 stage 變化（更可靠，layout 完成後會自動觸發）
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => fitCanvas()).observe(canvas.parentElement);
  }
  // 雙保險：layout 完成後再 fit 一次
  requestAnimationFrame(fitCanvas);

  // ===== 啟動 =====
  showOverlay(titleScreen);
  hud.classList.add('hidden');
  pauseBtn.classList.add('hidden');
  requestAnimationFrame(loop);

  // ===== 對外 API（給 editor.js） =====
  window.MFSB = {
    startGameDev,
    startTestPlay(lvObj) {
      SFX.button();
      gameMode = 'easy';
      score = 0;
      lives = 5;
      speedMultiplier = 1;
      hideAllOverlays();
      hud.classList.remove('hidden');
      pauseBtn.classList.remove('hidden');
      loadLevel(-1, lvObj);
      ensureAudio();
    },
    showTitle: backToTitle,
    showOverlay,
    getMaterials() { return MATERIALS; },
    getMatEmoji() { return MAT_EMOJI; },
    getLevels() { return LEVELS; },
  };
})();
