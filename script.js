(() => {
  const navToggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.site-nav');
  let activeGame = 'snake';

  function setActiveGame(name) {
    activeGame = name;
  }

  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  const snake = createSnakeGame();
  const pinball = createPinballGame();

  document.addEventListener('keydown', (event) => {
    const handled = activeGame === 'pinball'
      ? pinball.handleKeyDown(event)
      : snake.handleKeyDown(event);
    if (handled) {
      event.preventDefault();
    }
  });

  document.addEventListener('keyup', (event) => {
    if (pinball.handleKeyUp(event)) {
      event.preventDefault();
    }
  });

  window.addEventListener('resize', () => {
    snake.render();
    pinball.render();
  });

  window.addEventListener('blur', () => {
    snake.pauseIfRunning();
    pinball.pauseIfRunning();
  });

  function bindActiveGame(target, name) {
    if (!target) return;
    target.addEventListener('pointerdown', () => setActiveGame(name));
    target.addEventListener('focusin', () => setActiveGame(name));
  }

  bindActiveGame(document.getElementById('game-canvas'), 'snake');
  bindActiveGame(document.getElementById('pinball-canvas'), 'pinball');

  function createSnakeGame() {
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
    const baseDelay = 240;
    const minDelay = 75;
    const delayStep = 45;
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

    if (bestEl) {
      bestEl.textContent = String(state.bestScore);
    }

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        setActiveGame('snake');
        startGame();
      });
    }
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        setActiveGame('snake');
        togglePause();
      });
    }
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        setActiveGame('snake');
        restartGame();
      });
    }

    dirButtons.forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        setActiveGame('snake');
        const dir = button.dataset.dir;
        if (dir === 'up') queueDirection({ x: 0, y: -1 });
        if (dir === 'down') queueDirection({ x: 0, y: 1 });
        if (dir === 'left') queueDirection({ x: -1, y: 0 });
        if (dir === 'right') queueDirection({ x: 1, y: 0 });
      });
    });

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
      if (speedEl) speedEl.textContent = `${state.delay}ms`;
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

    function togglePause() {
      if (state.status === 'running') {
        pauseRound();
        return;
      }
      if (state.status === 'paused') {
        resumeRound();
        return;
      }
      startGame();
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
        return;
      }
      if (state.status === 'paused') {
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

    function resizeCanvas() {
      if (!canvas || !ctx) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const logicalSize = Math.max(240, Math.floor(rect.width || rect.height || 600));
      const dpr = window.devicePixelRatio || 1;
      const nextWidth = Math.floor(logicalSize * dpr);
      if (canvas.width !== nextWidth || canvas.height !== nextWidth) {
        canvas.width = nextWidth;
        canvas.height = nextWidth;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      state.renderSize = logicalSize;
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

    function drawBoard(size) {
      const cell = size / boardSize;
      ctx.fillStyle = '#1f103c';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= boardSize; i += 1) {
        const pos = i * cell;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, size);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(size, pos);
        ctx.stroke();
      }
    }

    function drawSnake(cell) {
      state.snake.forEach((segment, index) => {
        const x = segment.x * cell;
        const y = segment.y * cell;
        const alpha = index === 0 ? 1 : Math.max(0.45, 1 - index * 0.12);
        ctx.fillStyle = index === 0 ? `rgba(255, 224, 77, ${alpha})` : `rgba(122, 255, 114, ${alpha})`;
        roundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, 5);
        ctx.fill();
      });
    }

    function drawFood(cell) {
      const x = state.food.x * cell + cell / 2;
      const y = state.food.y * cell + cell / 2;
      const radius = cell * 0.28;
      ctx.beginPath();
      ctx.fillStyle = '#5df4ff';
      ctx.shadowColor = 'rgba(93, 244, 255, 0.65)';
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
      gradient.addColorStop(0, 'rgba(255, 95, 162, 0.26)');
      gradient.addColorStop(1, 'rgba(255, 95, 162, 0)');
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

    function handleKeyDown(event) {
      const dir = directions[event.key];
      if (dir) {
        if (state.status === 'idle' || state.status === 'gameover') {
          startFreshRound(dir);
        } else {
          queueDirection(dir);
        }
        setActiveGame('snake');
        return true;
      }

      if (event.key === ' ' || event.key === 'Spacebar') {
        togglePause();
        setActiveGame('snake');
        return true;
      }

      if (event.key === 'Enter') {
        restartGame();
        setActiveGame('snake');
        return true;
      }

      return false;
    }

    function pauseIfRunning() {
      if (state.status === 'running') {
        pauseRound();
      }
    }

    function init() {
      resetRound();
      state.status = 'idle';
      setStatus('Not started');
      setOverlay('Ready to launch', 'Start를 누르거나 방향키 / WASD / 터치를 사용하세요.', true);
      syncScoreboard();
      render();
    }

    init();

    return {
      handleKeyDown,
      pauseIfRunning,
      render
    };
  }

  function createPinballGame() {
    const canvas = document.getElementById('pinball-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const overlay = document.querySelector('[data-pinball-overlay]');
    const launchBtn = document.querySelector('[data-pinball-launch]');
    const pauseBtn = document.querySelector('[data-pinball-pause]');
    const restartBtn = document.querySelector('[data-pinball-restart]');
    const launchTouch = document.querySelector('[data-pinball-launch-touch]');
    const scoreEl = document.querySelector('[data-pinball-score]');
    const bestEl = document.querySelector('[data-pinball-best]');
    const stateEl = document.querySelector('[data-pinball-state]');
    const statusEl = document.querySelector('[data-pinball-status]');
    const flipperButtons = document.querySelectorAll('[data-pinball-flipper]');

    const baseWidth = 640;
    const baseHeight = 780;
    const drainStartY = 772;
    const drainHalfWidth = 22;
    const bestScoreKey = 'kkinippyong-pinball-best';

    const state = {
      status: 'ready',
      score: 0,
      bestScore: readBestScore(),
      renderWidth: baseWidth,
      renderHeight: baseHeight,
      lastFrameTime: 0,
      animationId: 0,
      ball: createBall(),
      launchPressed: false,
      flippers: {
        left: {
          pivot: { x: 204, y: 694 },
          length: 104,
          thickness: 14,
          restAngle: 0.42,
          activeAngle: -0.88,
          angle: 0.42,
          pressed: false,
          keyActive: false,
          cooldown: 0,
          tipKick: { x: 230, y: -120 }
        },
        right: {
          pivot: { x: 436, y: 694 },
          length: 104,
          thickness: 14,
          restAngle: Math.PI - 0.42,
          activeAngle: Math.PI + 0.88,
          angle: Math.PI - 0.42,
          pressed: false,
          keyActive: false,
          cooldown: 0,
          tipKick: { x: -230, y: -120 }
        }
      },
      bumpers: [
        { x: 214, y: 186, r: 24, score: 90, glow: '#5df4ff', cooldown: 0 },
        { x: 320, y: 136, r: 28, score: 140, glow: '#ffe04d', cooldown: 0 },
        { x: 426, y: 186, r: 24, score: 90, glow: '#ff5fa2', cooldown: 0 },
        { x: 176, y: 288, r: 22, score: 110, glow: '#7aff72', cooldown: 0 },
        { x: 468, y: 288, r: 22, score: 110, glow: '#5df4ff', cooldown: 0 }
      ],
      targets: [
        { x: 108, y: 92, w: 92, h: 34, score: 40, color: '#ffe04d', cooldown: 0 },
        { x: 272, y: 96, w: 96, h: 30, score: 55, color: '#5df4ff', cooldown: 0 },
        { x: 430, y: 92, w: 92, h: 34, score: 40, color: '#7aff72', cooldown: 0 },
        { x: 112, y: 248, w: 88, h: 30, score: 60, color: '#ff5fa2', cooldown: 0 },
        { x: 240, y: 310, w: 96, h: 32, score: 70, color: '#ffe04d', cooldown: 0 },
        { x: 372, y: 248, w: 88, h: 30, score: 60, color: '#7aff72', cooldown: 0 },
        { x: 500, y: 310, w: 90, h: 32, score: 70, color: '#5df4ff', cooldown: 0 }
      ]
    };

    if (scoreEl) scoreEl.textContent = String(state.score);
    if (bestEl) bestEl.textContent = String(state.bestScore);
    if (stateEl) stateEl.textContent = 'Ready';

    if (launchBtn) {
      launchBtn.addEventListener('click', () => {
        setActiveGame('pinball');
        launchOrResume();
      });
    }
    if (launchTouch) {
      launchTouch.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        setActiveGame('pinball');
        launchOrResume();
      });
    }
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        setActiveGame('pinball');
        togglePause();
      });
    }
    if (restartBtn) {
      restartBtn.addEventListener('click', () => {
        setActiveGame('pinball');
        restartGame();
      });
    }

    flipperButtons.forEach((button) => {
      const side = button.dataset.pinballFlipper;
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        setActiveGame('pinball');
        setFlipperPressed(side, true);
      });
      button.addEventListener('pointerup', () => setFlipperPressed(side, false));
      button.addEventListener('pointercancel', () => setFlipperPressed(side, false));
      button.addEventListener('pointerleave', () => setFlipperPressed(side, false));
    });

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

    function createBall() {
      return {
        x: 512,
        y: 656,
        vx: 0,
        vy: 0,
        r: 9,
        launched: false
      };
    }

    function syncScoreboard() {
      if (scoreEl) scoreEl.textContent = String(state.score);
      if (bestEl) bestEl.textContent = String(state.bestScore);
      if (stateEl) {
        stateEl.textContent = state.status === 'gameover'
          ? 'Game Over'
          : state.status === 'paused'
            ? 'Paused'
            : state.status === 'running'
              ? 'Running'
              : 'Ready';
      }
      if (statusEl) {
        statusEl.textContent = state.status === 'gameover'
          ? 'Ball drained. Restart to try again.'
          : state.status === 'paused'
            ? 'Paused'
            : state.status === 'running'
              ? 'Ball in play'
              : 'Ready';
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

    function setStatus(nextStatus) {
      state.status = nextStatus;
      syncScoreboard();
      if (state.status === 'running') {
        setOverlay('In play', 'Use the flippers and keep the ball alive.', false);
      } else if (state.status === 'paused') {
        setOverlay('Paused', 'Press Pause or launch again to continue.');
      } else if (state.status === 'gameover') {
        setOverlay('Game over', 'Restart to shoot a new ball.');
      } else {
        setOverlay('Ready to shoot', 'Launch the ball, then use the left and right arrows to move the flippers.', true);
      }
    }

    function resetRound(keepBest = true) {
      state.score = 0;
      state.ball = createBall();
      state.ball.launched = false;
      state.launchPressed = false;
      state.flippers.left.pressed = false;
      state.flippers.left.keyActive = false;
      state.flippers.right.pressed = false;
      state.flippers.right.keyActive = false;
      state.flippers.left.angle = state.flippers.left.restAngle;
      state.flippers.right.angle = state.flippers.right.restAngle;
      state.bumpers.forEach((item) => { item.cooldown = 0; });
      state.targets.forEach((item) => { item.cooldown = 0; });
      if (!keepBest) {
        state.bestScore = 0;
      }
      state.status = 'ready';
      syncScoreboard();
      setStatus('ready');
      render();
    }

    function restartGame() {
      resetRound(true);
    }

    function launchBall() {
      if (state.status === 'paused') {
        state.status = 'running';
        syncScoreboard();
        return;
      }

      if (state.status === 'gameover' || state.status === 'ready') {
        state.ball = createBall();
        state.score = 0;
      }

      if (!state.ball.launched) {
        state.ball.x = 512;
        state.ball.y = 656;
        state.ball.vx = randomBetween(-90, -40);
        state.ball.vy = randomBetween(-1220, -1080);
        state.ball.launched = true;
        state.status = 'running';
        syncScoreboard();
        setStatus('running');
        render();
      }
    }

    function launchOrResume() {
      if (state.status === 'paused') {
        state.status = 'running';
        syncScoreboard();
        setOverlay('In play', 'Use the flippers and keep the ball alive.', false);
        return;
      }
      if (state.status === 'gameover') {
        resetRound(true);
      }
      launchBall();
    }

    function togglePause() {
      if (state.status === 'running') {
        state.status = 'paused';
        syncScoreboard();
        setOverlay('Paused', 'Press Pause or launch again to continue.');
        return;
      }
      if (state.status === 'paused') {
        state.status = 'running';
        syncScoreboard();
        setOverlay('In play', 'Use the flippers and keep the ball alive.', false);
        return;
      }
      if (state.status === 'ready') {
        setOverlay('Ready to shoot', 'Launch the ball, then use the left and right arrows to move the flippers.', true);
      }
    }

    function pauseIfRunning() {
      if (state.status === 'running') {
        togglePause();
      }
    }

    function setFlipperPressed(side, pressed) {
      const flipper = state.flippers[side];
      if (!flipper) {
        return;
      }
      flipper.pressed = pressed;
      if (pressed) {
        flipper.keyActive = true;
      } else {
        flipper.keyActive = false;
      }
      setActiveGame('pinball');
    }

    function handleKeyDown(event) {
      const key = event.key;
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
        setFlipperPressed('left', true);
        return true;
      }
      if (key === 'ArrowRight' || key === 'd' || key === 'D') {
        setFlipperPressed('right', true);
        return true;
      }
      if (key === ' ' || key === 'Spacebar') {
        launchOrResume();
        setActiveGame('pinball');
        return true;
      }
      if (key === 'p' || key === 'P') {
        togglePause();
        setActiveGame('pinball');
        return true;
      }
      if (key === 'Enter') {
        restartGame();
        setActiveGame('pinball');
        return true;
      }
      return false;
    }

    function handleKeyUp(event) {
      const key = event.key;
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
        setFlipperPressed('left', false);
        return true;
      }
      if (key === 'ArrowRight' || key === 'd' || key === 'D') {
        setFlipperPressed('right', false);
        return true;
      }
      return false;
    }

    function update(dt) {
      updateFlipper(state.flippers.left, dt);
      updateFlipper(state.flippers.right, dt);

      if (state.status !== 'running') {
        return;
      }

      const ball = state.ball;
      ball.vy += 1450 * dt;
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      ball.vx *= Math.pow(0.9995, dt * 60);
      ball.vy *= Math.pow(0.9995, dt * 60);

      collideWalls(ball);
      collideBumpers(ball);
      collideTargets(ball);
      collideFlippers(ball);

      if (ball.y + ball.r > drainStartY && Math.abs(ball.x - (baseWidth - 120)) < drainHalfWidth) {
        state.status = 'gameover';
        if (state.score > state.bestScore) {
          state.bestScore = state.score;
          writeBestScore(state.bestScore);
        }
        syncScoreboard();
        setStatus('gameover');
      }
    }

    function updateFlipper(flipper, dt) {
      const target = flipper.pressed ? flipper.activeAngle : flipper.restAngle;
      const speed = Math.min(1, dt * 14);
      flipper.angle = lerp(flipper.angle, target, speed);
      flipper.cooldown = Math.max(0, flipper.cooldown - dt);
    }

    function collideWalls(ball) {
      const left = 22;
      const right = baseWidth - 22;
      const top = 22;

      if (ball.x - ball.r < left) {
        ball.x = left + ball.r;
        ball.vx = Math.abs(ball.vx) * 0.9;
      }
      if (ball.x + ball.r > right) {
        ball.x = right - ball.r;
        ball.vx = -Math.abs(ball.vx) * 0.9;
      }
      if (ball.y - ball.r < top) {
        ball.y = top + ball.r;
        ball.vy = Math.abs(ball.vy) * 1.08;
      }
    }

    function collideBumpers(ball) {
      const now = performance.now();
      state.bumpers.forEach((bumper) => {
        if (bumper.cooldown > now) {
          return;
        }
        const dx = ball.x - bumper.x;
        const dy = ball.y - bumper.y;
        const dist = Math.hypot(dx, dy);
        const minDist = ball.r + bumper.r;
        if (dist === 0 || dist > minDist) {
          return;
        }
        const nx = dx / dist;
        const ny = dy / dist;
        ball.x = bumper.x + nx * minDist;
        ball.y = bumper.y + ny * minDist;
        reflectBall(ball, nx, ny, 1.18);
        score(bumper.score);
        bumper.cooldown = now + 180;
      });
    }

    function collideTargets(ball) {
      const now = performance.now();
      state.targets.forEach((target) => {
        if (target.cooldown > now) {
          return;
        }
        const inside =
          ball.x + ball.r > target.x &&
          ball.x - ball.r < target.x + target.w &&
          ball.y + ball.r > target.y &&
          ball.y - ball.r < target.y + target.h;
        if (!inside) {
          return;
        }
        const centerX = target.x + target.w / 2;
        const centerY = target.y + target.h / 2;
        const nx = ball.x >= centerX ? 1 : -1;
        const ny = ball.y >= centerY ? 1 : -1;
        ball.vx += nx * 65;
        ball.vy = Math.min(ball.vy, -Math.abs(ball.vy) * 0.45 - 120);
        ball.y = target.y + (ball.y < centerY ? -ball.r - 1 : target.h + ball.r + 1);
        score(target.score);
        target.cooldown = now + 260;
      });
    }

    function collideFlippers(ball) {
      const flippers = [
        { item: state.flippers.left, side: 'left' },
        { item: state.flippers.right, side: 'right' }
      ];

      flippers.forEach(({ item, side }) => {
        const tip = getFlipperTip(item);
        const nearest = closestPointOnSegment(ball.x, ball.y, item.pivot.x, item.pivot.y, tip.x, tip.y);
        const dx = ball.x - nearest.x;
        const dy = ball.y - nearest.y;
        const dist = Math.hypot(dx, dy);
        const limit = ball.r + item.thickness / 2 + 2;
        if (dist > limit) {
          return;
        }

        const nx = dist === 0 ? 0 : dx / dist;
        const ny = dist === 0 ? -1 : dy / dist;
        const approaching = ball.vx * nx + ball.vy * ny < 40;
        if (!approaching && !item.pressed) {
          return;
        }

        ball.x = nearest.x + nx * limit;
        ball.y = nearest.y + ny * limit;
        reflectBall(ball, nx, ny, item.pressed ? 1.34 : 1.12);
        ball.vy -= item.pressed ? 460 : 240;
        if (side === 'left') {
          ball.vx += item.pressed ? 280 : 140;
        } else {
          ball.vx -= item.pressed ? 280 : 140;
        }
        ball.y -= 6;
      });
    }

    function reflectBall(ball, nx, ny, power = 1) {
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx = (ball.vx - 2 * dot * nx) * power;
      ball.vy = (ball.vy - 2 * dot * ny) * power;
    }

    function getFlipperTip(flipper) {
      return {
        x: flipper.pivot.x + Math.cos(flipper.angle) * flipper.length,
        y: flipper.pivot.y + Math.sin(flipper.angle) * flipper.length
      };
    }

    function score(amount) {
      state.score += amount;
      if (state.score > state.bestScore) {
        state.bestScore = state.score;
        writeBestScore(state.bestScore);
      }
      syncScoreboard();
    }

    function resizeCanvas() {
      if (!canvas || !ctx) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const logicalWidth = Math.max(320, Math.floor(rect.width || baseWidth));
      const logicalHeight = Math.max(390, Math.floor((rect.height || (logicalWidth * (78 / 64)))));
      const dpr = window.devicePixelRatio || 1;
      const nextWidth = Math.floor(logicalWidth * dpr);
      const nextHeight = Math.floor(logicalHeight * dpr);
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      state.renderWidth = logicalWidth;
      state.renderHeight = logicalHeight;
    }

    function render() {
      if (!ctx || !canvas) {
        return;
      }
      resizeCanvas();
      const width = state.renderWidth;
      const height = state.renderHeight;
      const scaleX = width / baseWidth;
      const scaleY = height / baseHeight;
      const scale = Math.min(scaleX, scaleY);

      ctx.clearRect(0, 0, width, height);
      drawBackground(width, height);
      drawWalls(scale);
      drawTargets(scale);
      drawBumpers(scale);
      drawFlippers(scale);
      drawBall(scale);
      drawScoreHud(width, height);
      drawLauncher(scale);
    }

    function drawBackground(width, height) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#2a0f57');
      gradient.addColorStop(0.55, '#190b35');
      gradient.addColorStop(1, '#090716');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      for (let i = 0; i < 11; i += 1) {
        const y = 42 + i * 60;
        ctx.fillRect(54, y, width - 108, 2);
      }
    }

    function drawWalls(scale) {
      const wall = 18 * scale;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
      ctx.lineWidth = 3 * scale;
      ctx.beginPath();
      ctx.moveTo(wall, 26 * scale);
      ctx.lineTo(wall, 648 * scale);
      ctx.lineTo(146 * scale, 740 * scale);
      ctx.lineTo(494 * scale, 740 * scale);
      ctx.lineTo(baseWidth - wall, 648 * scale);
      ctx.lineTo(baseWidth - wall, 26 * scale);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(93, 244, 255, 0.24)';
      ctx.lineWidth = 2 * scale;
      ctx.beginPath();
      ctx.moveTo(520 * scale, 48 * scale);
      ctx.lineTo(520 * scale, 704 * scale);
      ctx.stroke();
    }

    function drawTargets(scale) {
      state.targets.forEach((target) => {
        roundRect(ctx, target.x * scale, target.y * scale, target.w * scale, target.h * scale, 10 * scale);
        ctx.fillStyle = target.color;
        ctx.globalAlpha = 0.22;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = target.color;
        ctx.lineWidth = 2 * scale;
        ctx.stroke();
      });
    }

    function drawBumpers(scale) {
      state.bumpers.forEach((bumper) => {
        const x = bumper.x * scale;
        const y = bumper.y * scale;
        const r = bumper.r * scale;
        const glow = ctx.createRadialGradient(x, y, 2, x, y, r * 2.5);
        glow.addColorStop(0, bumper.glow);
        glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - r * 2.5, y - r * 2.5, r * 5, r * 5);
        ctx.beginPath();
        ctx.fillStyle = '#fff8ef';
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.strokeStyle = bumper.glow;
        ctx.lineWidth = 4 * scale;
        ctx.arc(x, y, r + 4 * scale, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    function drawFlippers(scale) {
      drawFlipper(state.flippers.left, '#ffe04d', scale);
      drawFlipper(state.flippers.right, '#5df4ff', scale);
    }

    function drawFlipper(flipper, color, scale) {
      const tip = getFlipperTip(flipper);
      const x1 = flipper.pivot.x * scale;
      const y1 = flipper.pivot.y * scale;
      const x2 = tip.x * scale;
      const y2 = tip.y * scale;
      ctx.strokeStyle = color;
      ctx.lineWidth = flipper.thickness * scale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x1, y1, 10 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawBall(scale) {
      const ball = state.ball;
      const x = ball.x * scale;
      const y = ball.y * scale;
      const r = ball.r * scale;
      const glow = ctx.createRadialGradient(x, y, 2, x, y, r * 3.2);
      glow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      glow.addColorStop(0.4, 'rgba(255, 224, 77, 0.75)');
      glow.addColorStop(1, 'rgba(255, 224, 77, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
      ctx.beginPath();
      ctx.fillStyle = '#fff8ef';
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawScoreHud(width, height) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      roundRect(ctx, 26, 18, width - 52, 34, 10);
      ctx.fill();
      ctx.fillStyle = '#fff8ef';
      ctx.font = '600 15px Segoe UI, sans-serif';
      ctx.fillText(`Score ${state.score}`, 42, 40);
      ctx.fillText(`Best ${state.bestScore}`, width - 132, 40);
      ctx.fillText(state.status === 'running' ? 'Ball in play' : state.status === 'paused' ? 'Paused' : 'Ready', width / 2 - 42, 40);
      ctx.font = '500 12px Segoe UI, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.74)';
      ctx.fillText('Space launches, arrows or A / D move flippers.', 42, height - 18);
    }

    function drawLauncher(scale) {
      const x = 520 * scale;
      const y1 = 64 * scale;
      const y2 = 704 * scale;
      ctx.strokeStyle = 'rgba(255, 95, 162, 0.35)';
      ctx.lineWidth = 3 * scale;
      ctx.setLineDash([8 * scale, 8 * scale]);
      ctx.beginPath();
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
      ctx.stroke();
      ctx.setLineDash([]);
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

    function closestPointOnSegment(px, py, x1, y1, x2, y2) {
      const vx = x2 - x1;
      const vy = y2 - y1;
      const lenSq = vx * vx + vy * vy;
      if (lenSq === 0) {
        return { x: x1, y: y1 };
      }
      const t = clamp(((px - x1) * vx + (py - y1) * vy) / lenSq, 0, 1);
      return {
        x: x1 + vx * t,
        y: y1 + vy * t
      };
    }

    function launchFrame(time) {
      if (!state.lastFrameTime) {
        state.lastFrameTime = time;
      }
      const dt = Math.min(0.032, (time - state.lastFrameTime) / 1000 || 0);
      state.lastFrameTime = time;
      update(dt);
      render();
      state.animationId = requestAnimationFrame(launchFrame);
    }

    function init() {
      resetRound(true);
      state.status = 'ready';
      syncScoreboard();
      setStatus('ready');
      setOverlay('Ready to shoot', 'Launch the ball, then use the left and right arrows to move the flippers.', true);
      render();
      state.animationId = requestAnimationFrame(launchFrame);
    }

    init();

    return {
      handleKeyDown,
      handleKeyUp,
      pauseIfRunning,
      render
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }
})();
