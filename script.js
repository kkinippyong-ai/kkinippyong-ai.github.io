(() => {
  const navToggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const overlay = document.querySelector('[data-overlay]');
  const startBtn = document.querySelector('[data-start]');
  const pauseBtn = document.querySelector('[data-pause]');
  const restartBtn = document.querySelector('[data-restart]');
  const scoreEl = document.querySelector('[data-score]');
  const bestEl = document.querySelector('[data-best]');
  const speedEl = document.querySelector('[data-speed]');
  const statusEl = document.querySelector('[data-status]');
  const dirButtons = document.querySelectorAll('[data-dir]');

  const boardSize = 20;
  const baseDelay = 220;
  const minDelay = 90;
  const delayStep = 12;
  const speedIntervalMs = 10000;
  const bestScoreKey = 'kkinippyong-snake-best';

  const state = {
    status: 'idle',
    snake: [],
    food: { x: 0, y: 0 },
    direction: { x: 1, y: 0 },
    queuedDirection: { x: 1, y: 0 },
    score: 0,
    bestScore: readBestScore(),
    delay: baseDelay,
    speedLevel: 1,
    gameTimer: null,
    speedTimer: null,
    renderSize: 0
  };

  if (bestEl) {
    bestEl.textContent = String(state.bestScore);
  }

  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  const directions = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    w: { x: 0, y: -1 },
    W: { x: 0, y: -1 },
    s: { x: 0, y: 1 },
    S: { x: 0, y: 1 },
    a: { x: -1, y: 0 },
    A: { x: -1, y: 0 },
    d: { x: 1, y: 0 },
    D: { x: 1, y: 0 }
  };

  function readBestScore() {
    try {
      return Number(localStorage.getItem(bestScoreKey) || 0);
    } catch {
      return 0;
    }
  }

  function writeBestScore(value) {
    try {
      localStorage.setItem(bestScoreKey, String(value));
    } catch {
      // ignore storage errors
    }
  }

  function setStatus(text) {
    if (statusEl) {
      statusEl.textContent = text;
    }
  }

  function setOverlay(title, copy, visible = true) {
    if (!overlay) {
      return;
    }
    overlay.innerHTML = `
      <p class="overlay-title">${title}</p>
      <p class="overlay-copy">${copy}</p>
    `;
    overlay.hidden = !visible;
  }

  function clearTimers() {
    if (state.gameTimer) {
      clearTimeout(state.gameTimer);
      state.gameTimer = null;
    }
    if (state.speedTimer) {
      clearInterval(state.speedTimer);
      state.speedTimer = null;
    }
  }

  function syncScoreboard() {
    if (scoreEl) scoreEl.textContent = String(state.score);
    if (bestEl) bestEl.textContent = String(state.bestScore);
    if (speedEl) speedEl.textContent = String(state.speedLevel);
  }

  function resetRound() {
    state.snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 }
    ];
    state.direction = { x: 1, y: 0 };
    state.queuedDirection = { x: 1, y: 0 };
    state.score = 0;
    state.delay = baseDelay;
    state.speedLevel = 1;
    placeFood();
    syncScoreboard();
  }

  function startFreshRound(initialDirection = { x: 1, y: 0 }) {
    clearTimers();
    resetRound();
    state.direction = initialDirection;
    state.queuedDirection = initialDirection;
    state.status = 'running';
    setStatus('Running');
    setOverlay('In play', 'Use the controls to guide the snake.', false);
    startLoops();
    render();
  }

  function resumeRound() {
    if (state.status !== 'paused') {
      return;
    }
    state.status = 'running';
    setStatus('Running');
    setOverlay('In play', 'Use the controls to guide the snake.', false);
    startLoops();
  }

  function pauseRound() {
    if (state.status !== 'running') {
      return;
    }
    state.status = 'paused';
    setStatus('Paused');
    setOverlay('Paused', 'Press Pause, Space, or Start to continue.');
    clearTimers();
  }

  function gameOver() {
    state.status = 'gameover';
    clearTimers();
    if (state.score > state.bestScore) {
      state.bestScore = state.score;
      writeBestScore(state.bestScore);
    }
    syncScoreboard();
    setStatus('Game over');
    setOverlay('Game over', 'Restart to launch a fresh run.');
    render();
  }

  function startGame() {
    if (state.status === 'paused') {
      resumeRound();
      return;
    }
    startFreshRound();
  }

  function restartGame() {
    startFreshRound();
  }

  function startLoops() {
    if (state.gameTimer) {
      clearTimeout(state.gameTimer);
      state.gameTimer = null;
    }
    state.gameTimer = setTimeout(step, state.delay);

    if (state.speedTimer) {
      clearInterval(state.speedTimer);
      state.speedTimer = null;
    }
    state.speedTimer = setInterval(() => {
      if (state.status !== 'running') {
        return;
      }
      const nextDelay = Math.max(minDelay, state.delay - delayStep);
      if (nextDelay !== state.delay) {
        state.delay = nextDelay;
        state.speedLevel += 1;
        syncScoreboard();
        if (state.gameTimer) {
          clearTimeout(state.gameTimer);
        }
        state.gameTimer = setTimeout(step, state.delay);
      }
    }, speedIntervalMs);
  }

  function step() {
    if (state.status !== 'running') {
      return;
    }

    if (state.queuedDirection && !isOpposite(state.direction, state.queuedDirection)) {
      state.direction = state.queuedDirection;
    }

    const head = state.snake[0];
    const nextHead = {
      x: head.x + state.direction.x,
      y: head.y + state.direction.y
    };

    if (hitsWall(nextHead) || hitsSelf(nextHead)) {
      gameOver();
      return;
    }

    state.snake.unshift(nextHead);

    if (nextHead.x === state.food.x && nextHead.y === state.food.y) {
      state.score += 10;
      if (state.score > state.bestScore) {
        state.bestScore = state.score;
        writeBestScore(state.bestScore);
      }
      syncScoreboard();
      placeFood();
    } else {
      state.snake.pop();
    }

    render();
    if (state.status === 'running') {
      state.gameTimer = setTimeout(step, state.delay);
    }
  }

  function hitsWall(point) {
    return point.x < 0 || point.y < 0 || point.x >= boardSize || point.y >= boardSize;
  }

  function hitsSelf(point) {
    return state.snake.some((segment) => segment.x === point.x && segment.y === point.y);
  }

  function isOpposite(current, next) {
    return current.x + next.x === 0 && current.y + next.y === 0;
  }

  function placeFood() {
    let food;
    do {
      food = {
        x: Math.floor(Math.random() * boardSize),
        y: Math.floor(Math.random() * boardSize)
      };
    } while (state.snake.some((segment) => segment.x === food.x && segment.y === food.y));
    state.food = food;
  }

  function queueDirection(nextDirection) {
    if (state.status === 'idle' || state.status === 'gameover') {
      startFreshRound(nextDirection);
    } else if (state.status === 'paused') {
      resumeRound();
    }

    if (state.status !== 'running') {
      return;
    }

    if (isOpposite(state.direction, nextDirection)) {
      return;
    }
    state.queuedDirection = nextDirection;
  }

  function render() {
    if (!ctx || !canvas) {
      return;
    }

    resizeCanvas();

    const size = state.renderSize;
    const cell = size / boardSize;

    ctx.clearRect(0, 0, size, size);
    drawBoard(size);
    drawFood(cell);
    drawSnake(cell);
    drawFrame(cell);
  }

  function resizeCanvas() {
    if (!canvas || !ctx) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const logicalSize = Math.floor(rect.width || rect.height || 600);
    const dpr = window.devicePixelRatio || 1;
    const nextWidth = Math.max(240, logicalSize);
    const scaledWidth = Math.floor(nextWidth * dpr);

    if (canvas.width !== scaledWidth || canvas.height !== scaledWidth) {
      canvas.width = scaledWidth;
      canvas.height = scaledWidth;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    state.renderSize = nextWidth;
  }

  function drawBoard(size) {
    const cell = size / boardSize;
    ctx.fillStyle = '#041109';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(114, 255, 157, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= boardSize; i += 1) {
      const position = i * cell;
      ctx.beginPath();
      ctx.moveTo(position, 0);
      ctx.lineTo(position, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, position);
      ctx.lineTo(size, position);
      ctx.stroke();
    }
  }

  function drawSnake(cell) {
    state.snake.forEach((segment, index) => {
      const x = segment.x * cell;
      const y = segment.y * cell;
      const alpha = index === 0 ? 1 : Math.max(0.45, 1 - index * 0.12);
      ctx.fillStyle = index === 0 ? `rgba(161, 255, 195, ${alpha})` : `rgba(114, 255, 157, ${alpha})`;
      roundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, 5);
      ctx.fill();
    });
  }

  function drawFood(cell) {
    const x = state.food.x * cell + cell / 2;
    const y = state.food.y * cell + cell / 2;
    const radius = cell * 0.28;
    ctx.beginPath();
    ctx.fillStyle = '#f7ff9b';
    ctx.shadowColor = 'rgba(247, 255, 155, 0.6)';
    ctx.shadowBlur = 18;
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawFrame(cell) {
    const head = state.snake[0];
    if (!head) {
      return;
    }
    const glowX = head.x * cell + cell / 2;
    const glowY = head.y * cell + cell / 2;
    const gradient = ctx.createRadialGradient(glowX, glowY, 2, glowX, glowY, cell * 1.8);
    gradient.addColorStop(0, 'rgba(114, 255, 157, 0.28)');
    gradient.addColorStop(1, 'rgba(114, 255, 157, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, state.renderSize, state.renderSize);
  }

  function roundRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function bindButton(target, handler) {
    if (!target) {
      return;
    }
    target.addEventListener('click', handler);
  }

  bindButton(startBtn, startGame);
  bindButton(pauseBtn, () => {
    if (state.status === 'running') {
      pauseRound();
    } else if (state.status === 'paused') {
      resumeRound();
    } else {
      startGame();
    }
  });
  bindButton(restartBtn, restartGame);

  dirButtons.forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const key = button.dataset.dir;
      if (key === 'up') queueDirection({ x: 0, y: -1 });
      if (key === 'down') queueDirection({ x: 0, y: 1 });
      if (key === 'left') queueDirection({ x: -1, y: 0 });
      if (key === 'right') queueDirection({ x: 1, y: 0 });
    });
  });

  document.addEventListener('keydown', (event) => {
    const key = event.key;
    if (directions[key]) {
      event.preventDefault();
      queueDirection(directions[key]);
      return;
    }

    if (key === ' ' || key === 'Spacebar') {
      event.preventDefault();
      if (state.status === 'running') {
        pauseRound();
      } else if (state.status === 'paused') {
        resumeRound();
      } else {
        startGame();
      }
      return;
    }

    if (key === 'Enter') {
      event.preventDefault();
      if (state.status === 'gameover') {
        restartGame();
      } else if (state.status === 'idle') {
        startGame();
      }
    }
  });

  window.addEventListener('resize', () => {
    render();
  });

  function init() {
    resetRound();
    state.status = 'idle';
    setStatus('Not started');
    setOverlay('Ready to launch', 'Start를 누르거나 방향키 / WASD / 터치를 사용하세요.', true);
    syncScoreboard();
    render();
  }

  init();
})();
