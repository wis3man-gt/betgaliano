window.addEventListener('load', () => {
  const screen = document.getElementById('loading-screen');
  const btn = document.getElementById('start-playing-btn');
  const img = document.getElementById('start-playing-img');

  const IMGS = {
    default: 'assets/ui/start-playing-default.png',
    hover: 'assets/ui/start-playing-hover.png',
    pressed: 'assets/ui/start-playing-pressed.png',
  };

  // Preload all three states
  [IMGS.hover, IMGS.pressed].forEach(src => { const i = new Image(); i.src = src; });

  function openDoors() {
    img.src = IMGS.pressed;

    // Small visual pause on pressed, then open
    setTimeout(() => {
      screen.classList.add('open');

      setTimeout(() => {
        document.body.classList.add('loading-complete');
      }, 1200);

      setTimeout(() => {
        screen.classList.add('hidden');
      }, 1600);
    }, 120);
  }

  btn.addEventListener('mouseenter', () => {
    if (screen.classList.contains('open')) return;
    img.src = IMGS.hover;
  });
  btn.addEventListener('mouseleave', () => {
    if (screen.classList.contains('open')) return;
    img.src = IMGS.default;
  });
  btn.addEventListener('mousedown', () => {
    if (screen.classList.contains('open')) return;
    img.src = IMGS.pressed;
  });
  btn.addEventListener('mouseup', () => {
    if (screen.classList.contains('open')) return;
    img.src = IMGS.hover;
  });

  btn.addEventListener('click', () => {
    if (screen.classList.contains('open')) return;
    openDoors();
  });

  // Touch support
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (screen.classList.contains('open')) return;
    img.src = IMGS.pressed;
  }, { passive: false });
  btn.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (screen.classList.contains('open')) return;
    openDoors();
  }, { passive: false });
});


const state = {
  balance: 1000,
  bet: 10,
  minesCount: 3,
  board: [], // array of 25 cells: { isMine: boolean, revealed: boolean }
  active: false,
  safePicks: 0,
  multiplier: 1,
  currentProfit: 0,
  recentResults: [],
  selectedHistoryId: null,
};

const GRID_SIZE = 25;

const balanceEl = document.getElementById("balance");
const statusEl = document.getElementById("status");
const betInput = document.getElementById("betInput");
const minesInput = document.getElementById("minesInput");
const betValueTextEl = document.getElementById("betValueText");
const minesValueTextEl = document.getElementById("minesValueText");
const betPlusBtn = document.getElementById("betPlusBtn");
const betMinusBtn = document.getElementById("betMinusBtn");
const minesPlusBtn = document.getElementById("minesPlusBtn");
const minesMinusBtn = document.getElementById("minesMinusBtn");
const startBtn = document.getElementById("startBtn");
const cashoutBtn = document.getElementById("cashoutBtn");
const multiplierEl = document.getElementById("multiplier");
const profitEl = document.getElementById("profit");
const safePicksEl = document.getElementById("safePicks");
const gridEl = document.getElementById("grid");
const appShellEl = document.querySelector(".app-shell");
const halfBetBtn = document.getElementById("halfBetBtn");
const doubleBetBtn = document.getElementById("doubleBetBtn");
const clearBetBtn = document.getElementById("clearBetBtn");
const mineCounterEl = document.getElementById("mineCounter");
const backgroundVideoEl = document.getElementById("backgroundVideo");
let recentResizeBound = false;
let startShimmerTimeoutIds = [];
let startPopAllTimeoutId = null;
let randomTileShimmerIntervalId = null;
let randomTileShimmerTimeoutIds = [];
const BET_MIN = 1;
const BET_STEP = 1;
const MINES_MIN = 1;
const MINES_MAX = 24;
const MINES_STEP = 1;

function playClick() {
  const s = new Audio("assets/audio/btn-click.mp3");
  s.volume = 0.6;
  s.play().catch(() => { });
}

function playGameStart() {
  const s = new Audio("assets/audio/game-start.mp3");
  s.volume = 0.6;
  s.play().catch(() => { });
}

function playCashOut() {
  const s = new Audio("assets/audio/cash-out.mp3");
  s.volume = 0.6;
  s.play().catch(() => { });
}

function playTileFlip() {
  const s = new Audio("assets/audio/flip-tile.mp3");
  s.volume = 0.6;
  s.play().catch(() => { });
}

function playSnakeReveal() {
  const s = new Audio("assets/audio/snake-reveal.mp3");
  s.volume = 0.6;
  s.play().catch(() => { });
}

function playSnakeHiss() {
  const s = new Audio("assets/audio/snake-hiss.mp3");
  s.volume = 0.6;
  s.play().catch(() => { });
}

function playMuteToggle() {
  const s = new Audio("assets/audio/mute.mp3");
  s.volume = 0.7;
  s.play().catch(() => { });
}

function clampInteger(value, min, max = Number.POSITIVE_INFINITY) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  const intValue = Math.floor(parsed);
  return Math.min(max, Math.max(min, intValue));
}

function getStateButtonImage(button, imageSelector = ".icon-btn-img") {
  return button?.querySelector(imageSelector) || null;
}

function preloadStateImages(button, imageSelector = ".icon-btn-img") {
  const image = getStateButtonImage(button, imageSelector);
  if (!image) return;

  const sources = [
    image.dataset.defaultSrc,
    image.dataset.hoverSrc,
    image.dataset.pressedSrc,
    image.dataset.disabledSrc,
  ].filter(Boolean);

  for (const source of sources) {
    const preloaded = new Image();
    preloaded.src = source;
  }
}

function setStateButtonImage(button, state, imageSelector = ".icon-btn-img") {
  if (!button) return;
  const image = getStateButtonImage(button, imageSelector);
  if (!image) return;

  const source = image.dataset[`${state}Src`] || image.dataset.defaultSrc;
  if (!source) return;
  if (image.src.endsWith(source)) return;
  image.src = source;
}

function refreshStateButtonVisual(button, options = {}) {
  const imageSelector = options.imageSelector || ".icon-btn-img";
  if (!button) return;

  if (button.disabled) {
    setStateButtonImage(button, "disabled", imageSelector);
    return;
  }

  const isPressed = button.dataset.pressed === "1";
  if (isPressed) {
    setStateButtonImage(button, "pressed", imageSelector);
    return;
  }

  if (button.matches(":hover") || button.matches(":focus-visible")) {
    setStateButtonImage(button, "hover", imageSelector);
    return;
  }

  setStateButtonImage(button, "default", imageSelector);
}

function bindStateImageButton(button, options = {}) {
  const imageSelector = options.imageSelector || ".icon-btn-img";
  if (!button) return;

  preloadStateImages(button, imageSelector);

  const release = () => {
    button.dataset.pressed = "0";
    refreshStateButtonVisual(button, { imageSelector });
  };

  button.dataset.pressed = "0";
  button.addEventListener("mouseenter", () => refreshStateButtonVisual(button, { imageSelector }));
  button.addEventListener("mouseleave", release);
  button.addEventListener("mousedown", () => {
    if (button.disabled) return;
    button.dataset.pressed = "1";
    refreshStateButtonVisual(button, { imageSelector });
  });
  button.addEventListener("mouseup", release);
  button.addEventListener("focus", () => refreshStateButtonVisual(button, { imageSelector }));
  button.addEventListener("blur", release);

  refreshStateButtonVisual(button, { imageSelector });
}

function syncBetBarUI() {
  const value = clampInteger(betInput.value, BET_MIN);
  betInput.value = String(value);
  if (betValueTextEl) betValueTextEl.textContent = `$${value}`;

  if (betMinusBtn) betMinusBtn.disabled = value <= BET_MIN;
  if (betPlusBtn) betPlusBtn.disabled = false;

  refreshStateButtonVisual(betMinusBtn);
  refreshStateButtonVisual(betPlusBtn);
}

function syncMinesBarUI() {
  const value = clampInteger(minesInput.value, MINES_MIN, MINES_MAX);
  minesInput.value = String(value);
  if (minesValueTextEl) minesValueTextEl.textContent = String(value);

  if (minesMinusBtn) minesMinusBtn.disabled = value <= MINES_MIN;
  if (minesPlusBtn) minesPlusBtn.disabled = value >= MINES_MAX;

  refreshStateButtonVisual(minesMinusBtn);
  refreshStateButtonVisual(minesPlusBtn);
}

function changeBetBy(delta) {
  const current = clampInteger(betInput.value, BET_MIN);
  betInput.value = String(Math.max(BET_MIN, current + delta));
  updateUI();
}

function changeMinesBy(delta) {
  const current = clampInteger(minesInput.value, MINES_MIN, MINES_MAX);
  const next = Math.min(MINES_MAX, Math.max(MINES_MIN, current + delta));
  minesInput.value = String(next);
  updateUI();
}

function bindAcceleratedValueButton(button, onStep, onPressSound = playClick) {
  if (!button) return;

  let holdStartTimeoutId = null;
  let repeatTimeoutId = null;
  let isHolding = false;
  let repeatDelayMs = 220;
  let suppressClickUntil = 0;

  const clearTimers = () => {
    if (holdStartTimeoutId) {
      clearTimeout(holdStartTimeoutId);
      holdStartTimeoutId = null;
    }
    if (repeatTimeoutId) {
      clearTimeout(repeatTimeoutId);
      repeatTimeoutId = null;
    }
  };

  const stepOnce = () => {
    if (button.disabled) return;
    onPressSound();
    onStep();
  };

  const repeatStep = () => {
    if (!isHolding || button.disabled) return;
    stepOnce();
    repeatDelayMs = Math.max(45, Math.floor(repeatDelayMs * 0.82));
    repeatTimeoutId = setTimeout(repeatStep, repeatDelayMs);
  };

  const startHold = (event) => {
    if (button.disabled) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (isHolding) return;

    isHolding = true;
    repeatDelayMs = 220;
    suppressClickUntil = performance.now() + 450;

    stepOnce();

    holdStartTimeoutId = setTimeout(() => {
      if (!isHolding || button.disabled) return;
      repeatTimeoutId = setTimeout(repeatStep, repeatDelayMs);
    }, 280);
  };

  const stopHold = () => {
    if (!isHolding) return;
    isHolding = false;
    clearTimers();
  };

  button.addEventListener("pointerdown", startHold);
  button.addEventListener("pointerleave", stopHold);
  button.addEventListener("pointercancel", stopHold);
  document.addEventListener("pointerup", stopHold);
  document.addEventListener("pointercancel", stopHold);

  button.addEventListener("click", (event) => {
    if (performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    stepOnce();
  });
}

function initBackgroundVideo() {
  if (!backgroundVideoEl) return;
  const startPlayback = () => {
    backgroundVideoEl.loop = true;
    backgroundVideoEl.playbackRate = 1;
    backgroundVideoEl.currentTime = 0;
    backgroundVideoEl.play().catch(() => {
      // Autoplay can be blocked by browser policy.
    });
  };

  if (backgroundVideoEl.readyState >= 1) startPlayback();
  else backgroundVideoEl.addEventListener("loadedmetadata", startPlayback, { once: true });
}

function clearStartShimmerSequence() {
  for (const timeoutId of startShimmerTimeoutIds) {
    clearTimeout(timeoutId);
  }
  startShimmerTimeoutIds = [];

  const tiles = gridEl.querySelectorAll(".tile");
  tiles.forEach((tile) => tile.classList.remove("tile-start-shimmer", "tile-start-bounce"));
}

function clearRandomTileShimmerSequence() {
  for (const timeoutId of randomTileShimmerTimeoutIds) {
    clearTimeout(timeoutId);
  }
  randomTileShimmerTimeoutIds = [];

  const tiles = gridEl.querySelectorAll(".tile");
  tiles.forEach((tile) => tile.classList.remove("tile-random-shimmer"));
}

function runRandomTileShimmerSequence() {
  if (state.active) return;

  const candidates = Array.from(gridEl.querySelectorAll(".tile:not(.revealed):not(:disabled)"));
  if (!candidates.length) return;

  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const waveSize = Math.min(6, shuffled.length);
  const selectedTiles = shuffled.slice(0, waveSize);

  const tileDelayMs = 180;
  const shimmerDurationMs = 420;

  selectedTiles.forEach((tile, index) => {
    const startTimeoutId = setTimeout(() => {
      if (state.active) return;

      tile.classList.remove("tile-random-shimmer");
      void tile.offsetWidth;
      tile.classList.add("tile-random-shimmer");

      const stopTimeoutId = setTimeout(() => {
        tile.classList.remove("tile-random-shimmer");
      }, shimmerDurationMs + 24);

      randomTileShimmerTimeoutIds.push(stopTimeoutId);
    }, index * tileDelayMs);

    randomTileShimmerTimeoutIds.push(startTimeoutId);
  });

  const cleanupTimeoutId = setTimeout(() => {
    randomTileShimmerTimeoutIds = [];
  }, selectedTiles.length * tileDelayMs + shimmerDurationMs + 40);

  randomTileShimmerTimeoutIds.push(cleanupTimeoutId);
}

function startRandomTileShimmerLoop() {
  if (randomTileShimmerIntervalId) return;

  randomTileShimmerIntervalId = setInterval(() => {
    if (document.hidden) return;
    runRandomTileShimmerSequence();
  }, 5000);
}

function runStartPopAllSequence() {
  if (startPopAllTimeoutId) {
    clearTimeout(startPopAllTimeoutId);
    startPopAllTimeoutId = null;
  }

  gridEl.classList.remove("tile-start-pop-all");
  void gridEl.offsetWidth;
  gridEl.classList.add("tile-start-pop-all");

  startPopAllTimeoutId = setTimeout(() => {
    gridEl.classList.remove("tile-start-pop-all");
    startPopAllTimeoutId = null;
  }, 380);
}

function runStartShimmerSequence() {
  clearStartShimmerSequence();

  const tiles = Array.from(gridEl.querySelectorAll(".tile"));
  if (!tiles.length) return;

  const tileDelayMs = 34;
  const shimmerDurationMs = 194;
  const popDurationMs = 260;

  tiles.forEach((tile, index) => {
    const startTimeoutId = setTimeout(() => {
      tile.classList.remove("tile-start-shimmer", "tile-start-bounce");
      void tile.offsetWidth;
      tile.classList.add("tile-start-shimmer");
      tile.classList.add("tile-start-bounce");

      const stopTimeoutId = setTimeout(() => {
        tile.classList.remove("tile-start-shimmer", "tile-start-bounce");
      }, Math.max(shimmerDurationMs, popDurationMs) + 20);

      startShimmerTimeoutIds.push(stopTimeoutId);
    }, index * tileDelayMs);

    startShimmerTimeoutIds.push(startTimeoutId);
  });

  const cleanupTimeoutId = setTimeout(() => {
    startShimmerTimeoutIds = [];
  }, tiles.length * tileDelayMs + shimmerDurationMs + 40);

  startShimmerTimeoutIds.push(cleanupTimeoutId);
}

function init() {
  const bgMusic = document.getElementById('bgMusic');
  let wasMusicPlayingBeforeHidden = false;
  let wasVideoPlayingBeforeHidden = false;

  if (bgMusic) {
    bgMusic.volume = 0.35;
    document.addEventListener('click', function startMusic() {
      bgMusic.play().catch(() => { });
      document.removeEventListener('click', startMusic);
    }, { once: true });
  }

  const muteBtn = document.getElementById('muteBtn');
  muteBtn.addEventListener('click', () => {
    playMuteToggle();
    if (bgMusic.muted) {
      bgMusic.muted = false;
      muteBtn.classList.remove('muted');
    } else {
      bgMusic.muted = true;
      muteBtn.classList.add('muted');
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      wasMusicPlayingBeforeHidden = Boolean(bgMusic && !bgMusic.paused);
      wasVideoPlayingBeforeHidden = Boolean(backgroundVideoEl && !backgroundVideoEl.paused);

      if (bgMusic) bgMusic.pause();
      if (backgroundVideoEl) backgroundVideoEl.pause();
      return;
    }

    if (wasMusicPlayingBeforeHidden && bgMusic) {
      bgMusic.play().catch(() => { });
    }

    if (wasVideoPlayingBeforeHidden && backgroundVideoEl) {
      backgroundVideoEl.play().catch(() => { });
    }
  });

  initBackgroundVideo();
  renderGrid();
  startRandomTileShimmerLoop();
  updateUI();
  renderRecentResults();
  renderHistoryPreview();
  attachEvents();
}

function attachEvents() {
  startBtn.addEventListener("click", () => {
    playGameStart();
    startGame();
  });
  cashoutBtn.addEventListener("click", cashOut);
  betInput.addEventListener("input", updateUI);
  minesInput.addEventListener("input", updateUI);

  bindStateImageButton(betPlusBtn);
  bindStateImageButton(betMinusBtn);
  bindStateImageButton(minesPlusBtn);
  bindStateImageButton(minesMinusBtn);
  bindStateImageButton(halfBetBtn, { imageSelector: ".quick-icon" });
  bindStateImageButton(doubleBetBtn, { imageSelector: ".quick-icon" });
  bindStateImageButton(clearBetBtn, { imageSelector: ".quick-icon" });

  bindAcceleratedValueButton(betPlusBtn, () => changeBetBy(BET_STEP));
  bindAcceleratedValueButton(betMinusBtn, () => changeBetBy(-BET_STEP));
  bindAcceleratedValueButton(minesPlusBtn, () => changeMinesBy(MINES_STEP), playSnakeHiss);
  bindAcceleratedValueButton(minesMinusBtn, () => changeMinesBy(-MINES_STEP), playSnakeHiss);

  halfBetBtn?.addEventListener("click", () => {
    playClick();
    const current = clampInteger(betInput.value, BET_MIN);
    betInput.value = String(Math.max(BET_MIN, Math.floor(current / 2)));
    updateUI();
  });

  doubleBetBtn?.addEventListener("click", () => {
    playClick();
    const current = clampInteger(betInput.value, BET_MIN);
    betInput.value = String(Math.max(BET_MIN, Math.floor(current * 2)));
    updateUI();
  });

  clearBetBtn?.addEventListener("click", () => {
    playClick();
    betInput.value = String(BET_MIN);
    updateUI();
  });

  if (!recentResizeBound) {
    recentResizeBound = true;
    window.addEventListener("resize", renderRecentResults);
  }
}

function renderGrid() {
  gridEl.innerHTML = "";

  for (let i = 0; i < GRID_SIZE; i++) {
    const tile = document.createElement("button");
    tile.className = "tile";
    tile.dataset.index = String(i);

    const tileLogo = document.createElement("span");
    tileLogo.className = "tile-logo";
    tileLogo.setAttribute("aria-hidden", "true");

    const tileContent = document.createElement("span");
    tileContent.className = "tile-content";

    tile.appendChild(tileLogo);
    tile.appendChild(tileContent);

    tile.addEventListener("click", () => onTileClick(i));
    gridEl.appendChild(tile);
  }
}

function getTileEl(index) {
  return gridEl.querySelector(`.tile[data-index="${index}"]`);
}

function setTileContent(tile, value) {
  if (!tile) return;
  const contentEl = tile.querySelector(".tile-content");
  if (contentEl) {
    contentEl.textContent = value;
    return;
  }
  tile.textContent = value;
}

function updateUI() {
  syncBetBarUI();
  syncMinesBarUI();

  gridEl.classList.toggle("tile-idle-tint", !state.active);

  balanceEl.textContent = `$${state.balance.toFixed(2)}`;
  multiplierEl.textContent = `${state.multiplier.toFixed(2)}x`;
  profitEl.textContent = state.currentProfit.toFixed(2);
  safePicksEl.textContent = String(state.safePicks);

  const minesPreview = Number(minesInput.value);
  const minesDisplay = state.active
    ? state.minesCount
    : Number.isInteger(minesPreview) && minesPreview >= 1 && minesPreview <= 24
      ? minesPreview
      : state.minesCount;
  mineCounterEl.textContent = String(minesDisplay);

  startBtn.disabled = state.active;
  // animate Cash Out briefly when it becomes enabled
  const wasDisabled = cashoutBtn.disabled;
  const willBeDisabled = !state.active || state.safePicks === 0;
  cashoutBtn.disabled = willBeDisabled;
  if (wasDisabled && !willBeDisabled) {
    cashoutBtn.classList.add("pulse");
    setTimeout(() => cashoutBtn.classList.remove("pulse"), 900);
  }
}

function setStatus(message) {
  statusEl.textContent = message;
}

function resetVisualBoard() {
  clearStartShimmerSequence();
  clearRandomTileShimmerSequence();
  if (startPopAllTimeoutId) {
    clearTimeout(startPopAllTimeoutId);
    startPopAllTimeoutId = null;
  }
  gridEl.classList.remove("tile-start-pop-all");
  gridEl.classList.remove("round-win", "round-lose");
  for (let i = 0; i < GRID_SIZE; i++) {
    const tile = getTileEl(i);
    tile.className = "tile";
    setTileContent(tile, "");
    tile.disabled = false;
  }
}

function validateInputs() {
  const bet = Number(betInput.value);
  const minesCount = Number(minesInput.value);

  if (!Number.isFinite(bet) || bet <= 0) {
    setStatus("Invalid bet amount.");
    return null;
  }

  if (bet > state.balance) {
    setStatus("Not enough balance.");
    return null;
  }

  if (!Number.isInteger(minesCount) || minesCount < 1 || minesCount > 24) {
    setStatus("Snakes count must be between 1 and 24.");
    return null;
  }

  return { bet, minesCount };
}

function startGame() {
  if (state.active) return;

  const values = validateInputs();
  if (!values) return;

  state.bet = values.bet;
  state.minesCount = values.minesCount;

  // Deduct bet
  state.balance -= state.bet;

  // Reset round state
  state.board = Array.from({ length: GRID_SIZE }, () => ({
    isMine: false,
    revealed: false,
  }));
  state.active = true;
  state.safePicks = 0;
  state.multiplier = 1.0;
  state.currentProfit = 0;

  // Place mines randomly
  placeMines(state.minesCount);

  // Reset visuals
  resetVisualBoard();
  runStartShimmerSequence();

  setStatus("Round started. Pick a tile.");
  updateUI();
}

function placeMines(minesCount) {
  const used = new Set();

  while (used.size < minesCount) {
    const idx = Math.floor(Math.random() * GRID_SIZE);
    used.add(idx);
  }

  for (const idx of used) {
    state.board[idx].isMine = true;
  }
}

function onTileClick(index) {
  if (!state.active) {
    // Bounce the clicked tile
    const tile = getTileEl(index);
    tile.style.transition = 'transform 0.3s cubic-bezier(.36,.07,.19,.97)';
    tile.style.transform = 'scale(1.08)';
    setTimeout(() => {
      tile.style.transform = 'scale(1)';
    }, 150);
    setTimeout(() => {
      tile.style.transition = '';
    }, 300);

    // Create arrow elements (left + right)
    const btnRect = startBtn.getBoundingClientRect();
    const arrowSize = 192;
    const arrowPadding = 24;

    const createHintArrow = (left, animationName) => {
      const arrow = document.createElement('img');
      arrow.src = 'assets/ui/hint-arrow.png';
      arrow.className = 'hint-arrow';
      arrow.style.cssText = `
        position: fixed;
        width: ${arrowSize}px;
        height: auto;
        left: ${left}px;
        top: ${btnRect.top + btnRect.height / 2 - arrowSize / 2}px;
        pointer-events: none;
        z-index: 999;
        opacity: 0;
      `;
      document.body.appendChild(arrow);
      arrow.style.animation = `${animationName} 1.2s ease forwards`;
      setTimeout(() => arrow.remove(), 1200);
    };

    createHintArrow(btnRect.left - arrowSize - arrowPadding, 'arrow-hint-left');

    // Dim background + pop the START GAME button
    appShellEl?.classList.add("hint-overlay-active");
    setTimeout(() => appShellEl?.classList.remove("hint-overlay-active"), 700);

    startBtn.classList.add("hint-pop");
    setTimeout(() => startBtn.classList.remove("hint-pop"), 600);
    return;
  }

  const cell = state.board[index];
  if (!cell || cell.revealed) return;

  playTileFlip();

  cell.revealed = true;
  const tile = getTileEl(index);
  tile.classList.remove("tile-start-shimmer", "tile-start-bounce");
  tile.classList.add("revealed");
  tile.classList.add("picked");

  if (cell.isMine) {
    playSnakeReveal();

    // Lose round
    tile.classList.add("mine");
    gridEl.classList.remove("round-win");
    gridEl.classList.add("round-lose");
    setTileContent(tile, "");
    revealAllMines();
    state.active = false;
    clearStartShimmerSequence();
    // record recent loss (store round snapshot)
    addRecentResult({
      type: "lose",
      bet: state.bet,
      minesCount: state.minesCount,
      safePicks: state.safePicks,
      multiplier: null,
      payout: 0,
      lostAmount: state.bet,
      timestamp: Date.now(),
    });
    // brief shake feedback on mine hit
    gridEl.classList.add("shake");
    setTimeout(() => gridEl.classList.remove("shake"), 420);
    setStatus("Boom! You hit a snake.");
    updateUI();
    return;
  }

  // Safe pick
  state.safePicks += 1;
  tile.classList.add("safe");
  setTileContent(tile, "");

  updateMultiplier();
  state.currentProfit = state.bet * state.multiplier;

  setStatus(`Safe pick! Multiplier: ${state.multiplier.toFixed(2)}x`);
  updateUI();
}

function updateMultiplier() {
  // Simple prototype formula (not final math)
  // Increases with more mines + each safe pick
  const riskFactor = 1 + state.minesCount * 0.06;
  const pickFactor = 1 + state.safePicks * 0.12;
  state.multiplier = Math.max(1, riskFactor * pickFactor);
}

// Recent results: keep last 10 in memory and render into .history-row
// Add a recent result object. Keeps newest-first, max 10.
function addRecentResult(result) {
  // ensure id + timestamp
  const id = result.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  const timestamp = result.timestamp || Date.now();

  const r = {
    id,
    type: result.type,
    bet: Number(result.bet) || 0,
    minesCount: Number(result.minesCount) || 0,
    safePicks: Number(result.safePicks) || 0,
    multiplier: result.multiplier == null ? null : Number(result.multiplier),
    payout: Number(result.payout) || 0,
    lostAmount: Number(result.lostAmount) || 0,
    timestamp,
  };

  state.recentResults.unshift(r);
  if (state.recentResults.length > 10) state.recentResults.length = 10;

  // image-strip only (newest first)
  renderRecentResults();
  renderHistoryPreview();
}

function getOrCreateResultHoverHint() {
  let hint = document.querySelector(".result-hover-hint");
  if (hint) return hint;

  hint = document.createElement("div");
  hint.className = "result-hover-hint";
  document.body.appendChild(hint);
  return hint;
}

function hideResultHoverHint() {
  const hint = document.querySelector(".result-hover-hint");
  if (!hint) return;
  hint.classList.remove("active", "win", "loss");
}

function updateResultHoverHintPosition(hint, clientX, clientY) {
  const margin = 12;
  const offset = 12;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const width = hint.offsetWidth;
  const height = hint.offsetHeight;

  let left = clientX - width / 2;
  if (left < margin) left = margin;
  if (left + width > viewportWidth - margin) left = viewportWidth - margin - width;

  let top = clientY - height - offset;
  if (top < margin) top = clientY + offset;
  if (top + height > viewportHeight - margin) top = viewportHeight - margin - height;

  hint.style.left = `${left}px`;
  hint.style.top = `${top}px`;
}

function showResultHoverHint(resultId, clientX, clientY) {
  const item = state.recentResults.find((entry) => entry.id === resultId);
  if (!item) return;

  const hint = getOrCreateResultHoverHint();
  const isWin = item.type === "win";

  hint.classList.remove("win", "loss");
  hint.classList.add(isWin ? "win" : "loss", "active");
  hint.innerHTML = `
    <div class="result-hover-hint-title">${isWin ? "WIN" : "LOSS"}</div>
    <div class="result-hover-hint-row"><span>Bet</span><strong>$${item.bet.toFixed(2)}</strong></div>
    <div class="result-hover-hint-row"><span>Snakes</span><strong>${item.minesCount}</strong></div>
    <div class="result-hover-hint-row"><span>Safe Picks</span><strong>${item.safePicks}</strong></div>
    <div class="result-hover-hint-row"><span>Multiplier</span><strong>${item.multiplier != null ? item.multiplier.toFixed(2) + "x" : "—"}</strong></div>
    <div class="result-hover-hint-row"><span>${isWin ? "Payout" : "Loss"}</span><strong>$${isWin ? item.payout.toFixed(2) : item.lostAmount.toFixed(2)}</strong></div>
  `;

  updateResultHoverHintPosition(hint, clientX, clientY);
}

function renderRecentResults() {
  const container = document.querySelector(".rail-carts");
  if (!container) return;
  const beforePositions = new Map();
  const existingNodes = new Map();
  container.querySelectorAll(".result-cart").forEach((node) => {
    const id = node.dataset.id;
    if (!id) return;
    beforePositions.set(id, node.getBoundingClientRect().left);
    existingNodes.set(id, node);
  });

  const cartWidth = 87;
  const cartGap = 12;
  const laneWidth = container.clientWidth
    || container.parentElement?.clientWidth
    || window.innerWidth;
  const visibleCount = Math.max(1, Math.floor((laneWidth + cartGap) / (cartWidth + cartGap)));
  const visibleResults = state.recentResults.slice(0, visibleCount);

  const usedIds = new Set();
  for (const r of visibleResults) {
    let card = existingNodes.get(r.id);
    if (!card) {
      card = document.createElement("div");
      const isLoss = r.type === "lose";
      card.className = `result-cart ${isLoss ? "loss" : "win"}`;
      card.dataset.id = r.id;

      const img = document.createElement("img");
      img.className = "result-cart-image";
      img.src = isLoss ? "assets/branding/loss-cart.png" : "assets/branding/win-cart.png";
      img.alt = isLoss ? "Loss cart" : "Win cart";
      img.loading = "eager";
      card.appendChild(img);

      card.addEventListener("click", () => selectHistoryItem(r.id));
      card.addEventListener("mouseenter", (event) => {
        showResultHoverHint(r.id, event.clientX, event.clientY);
      });
      card.addEventListener("mousemove", (event) => {
        showResultHoverHint(r.id, event.clientX, event.clientY);
      });
      card.addEventListener("mouseleave", hideResultHoverHint);
    }

    if (state.selectedHistoryId === r.id) card.classList.add("active");
    else card.classList.remove("active");

    container.appendChild(card);
    usedIds.add(r.id);
  }

  existingNodes.forEach((node, id) => {
    if (!usedIds.has(id)) node.remove();
  });

  container.querySelectorAll(".result-cart").forEach((node) => {
    const id = node.dataset.id;
    if (!id) return;

    const newLeft = node.getBoundingClientRect().left;
    const oldLeft = beforePositions.get(id);
    const deltaX = oldLeft == null ? -(cartWidth + cartGap) : oldLeft - newLeft;
    if (!deltaX) return;

    node.style.transition = "none";
    node.style.transform = `translateX(${deltaX}px)`;
    requestAnimationFrame(() => {
      node.style.transition = "transform 420ms cubic-bezier(.22,.61,.36,1), filter 0.2s cubic-bezier(.22,.61,.36,1), box-shadow 0.2s cubic-bezier(.22,.61,.36,1)";
      node.style.transform = "translateX(0)";
    });
  });

  renderHistoryPreview();
}

function selectHistoryItem(id) {
  if (state.selectedHistoryId === id) {
    state.selectedHistoryId = null; // toggle off
  } else {
    state.selectedHistoryId = id;
  }

  // update active classes
  const cards = document.querySelectorAll(".rail-carts .result-cart");
  cards.forEach((p) => {
    if (p.dataset.id === state.selectedHistoryId) p.classList.add("active");
    else p.classList.remove("active");
  });

  renderHistoryPreview();
}

function renderHistoryPreview() {
  let overlay = document.querySelector(".history-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "history-overlay";
    overlay.addEventListener("click", (event) => {
      if (event.target !== overlay) return;
      state.selectedHistoryId = null;
      const cards = document.querySelectorAll(".rail-carts .result-cart");
      cards.forEach((p) => p.classList.remove("active"));
      renderHistoryPreview();
    });
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = "";
  overlay.classList.remove("active");

  if (!state.selectedHistoryId) return;

  const item = state.recentResults.find((r) => r.id === state.selectedHistoryId);
  if (!item) return;

  const popup = document.createElement("div");
  popup.className = `history-popup ${item.type === "lose" ? "loss" : "win"}`;
  popup.innerHTML = `
    <div class="history-popup-title">Result: ${item.type === "win" ? "WIN" : "LOSS"}</div>
    <div class="history-popup-row"><span>Bet</span><strong>$${item.bet.toFixed(2)}</strong></div>
    <div class="history-popup-row"><span>Snakes</span><strong>${item.minesCount}</strong></div>
    <div class="history-popup-row"><span>Safe Picks</span><strong>${item.safePicks}</strong></div>
    <div class="history-popup-row"><span>Multiplier</span><strong>${item.multiplier != null ? item.multiplier.toFixed(2) + "x" : "—"}</strong></div>
    <div class="history-popup-row"><span>${item.type === "win" ? "Payout" : "Loss"}</span><strong>$${item.type === "win" ? item.payout.toFixed(2) : item.lostAmount.toFixed(2)}</strong></div>
  `;

  overlay.appendChild(popup);
  overlay.classList.add("active");
}

function revealAllMines() {
  for (let i = 0; i < GRID_SIZE; i++) {
    const cell = state.board[i];
    const tile = getTileEl(i);

    if (!cell) continue;

    if (cell.isMine) {
      tile.classList.add("mine", "revealed");
      const contentEl = tile.querySelector(".tile-content");
      if (contentEl && contentEl.textContent === "") {
        contentEl.textContent = "";
      }
    }

    tile.disabled = true;
  }
}

function cashOut() {
  if (!state.active) return;
  if (state.safePicks === 0) {
    setStatus("Open at least one safe tile before cashing out.");
    return;
  }

  playCashOut();

  const winAmount = state.currentProfit;

  state.balance += winAmount;
  state.active = false;
  clearStartShimmerSequence();

  // record recent win (store round snapshot)
  addRecentResult({
    type: "win",
    bet: state.bet,
    minesCount: state.minesCount,
    safePicks: state.safePicks,
    multiplier: state.multiplier,
    payout: winAmount,
    lostAmount: 0,
    timestamp: Date.now(),
  });

  // Disable all tiles after cashout
  gridEl.classList.remove("round-lose");
  gridEl.classList.add("round-win");
  for (let i = 0; i < GRID_SIZE; i++) {
    const tile = getTileEl(i);
    tile.disabled = true;
  }

  setStatus(`Cashed out! You won ${winAmount.toFixed(2)}.`);
  updateUI();
  // brief flash on multiplier after successful cashout
  multiplierEl.classList.add("flash");
  setTimeout(() => multiplierEl.classList.remove("flash"), 420);
}

init();