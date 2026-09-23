/**
 * main.js
 * Wires the Game Hub UI together: view switching, mounting/unmounting
 * the active game (Three.js or Canvas — both share the same start/
 * onScore/onGameOver/destroy lifecycle), the start/game-over overlay
 * flow, and per-game leaderboard rendering.
 */
(function () {
  "use strict";
 
  const GAME_META = {
    "stellar-drift": {
      title: "Stellar Drift",
      instructions:
        "Dodge the asteroids. Use <kbd>&larr;</kbd><kbd>&rarr;</kbd> / <kbd>A</kbd><kbd>D</kbd> (or drag on mobile) to steer. Survive.",
      create: (canvas) => new StellarDriftGame(canvas),
    },
    "void-runner": {
      title: "Void Runner",
      instructions:
        "Switch lanes with <kbd>&larr;</kbd><kbd>&rarr;</kbd> / <kbd>A</kbd><kbd>D</kbd> (or tap left/right on mobile). Dodge blocks, grab cyan pickups.",
      create: (canvas) => new VoidRunnerGame(canvas),
    },
  };
 
  const views = {
    hub: document.getElementById("hub"),
    gameView: document.getElementById("game-view"),
    leaderboard: document.getElementById("leaderboard"),
  };
  const navLinks = {
    hub: document.getElementById("nav-hub"),
    leaderboard: document.getElementById("nav-leaderboard"),
  };
 
  // FIX: a <canvas> can only ever be handed ONE kind of rendering context
  // (2D *or* WebGL) for its whole lifetime. Stellar Drift asks for a
  // WebGL context and Void Runner asks for a 2D context — reusing a
  // single persistent #game-canvas across both meant whichever game you
  // opened *second* got `getContext()` returning null and broke instantly
  // (only a full page reload gave you a virgin canvas again). We now
  // discard and recreate the canvas node every time a game is opened, so
  // each session always starts from a context-free element.
  let gameCanvas = document.getElementById("game-canvas");
 
  function getFreshCanvas() {
    const fresh = document.createElement("canvas");
    fresh.id = "game-canvas";
    gameCanvas.replaceWith(fresh);
    gameCanvas = fresh;
    return fresh;
  }
 
  const backBtn = document.getElementById("back-to-hub");
  const hudScore = document.getElementById("hud-score");
  const hudBest = document.getElementById("hud-best");
 
  const overlay = document.getElementById("game-overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayText = document.getElementById("overlay-text");
  const overlayStartBtn = document.getElementById("overlay-start-btn");
  const scoreEntry = document.getElementById("overlay-score-entry");
  const playerNameInput = document.getElementById("player-name");
  const saveScoreBtn = document.getElementById("save-score-btn");
 
  const leaderboardList = document.getElementById("leaderboard-list");
  const clearLeaderboardBtn = document.getElementById("clear-leaderboard-btn");
  const leaderboardTabs = document.querySelectorAll(".lb-tab");
 
  let activeGame = null;
  let activeGameId = null;
  let lastFinalScore = 0;
  let currentLeaderboardGameId = "stellar-drift";
 
  /* --------------------------------------------------------- view switch */
 
  function showView(name) {
    if (!views[name]) return;
 
    if (name !== "gameView" && activeGame) {
      activeGame.destroy();
      activeGame = null;
      activeGameId = null;
    }
 
    Object.values(views).forEach((v) => {
      v.classList.remove("view--active");
    });
 
    views[name].classList.add("view--active");
 
    Object.values(navLinks).forEach((l) => {
      if (l) l.classList.remove("active");
    });
 
    if (navLinks[name]) {
      navLinks[name].classList.add("active");
    }
 
    if (name === "leaderboard") {
      renderLeaderboard();
    }
  }
 
  window.addEventListener("hashchange", () => {
    const hash = location.hash.replace("#", "");
    if (views[hash]) showView(hash);
  });
 
  navLinks.hub.addEventListener("click", (e) => {
    e.preventDefault();
    location.hash = "hub";
    showView("hub");
  });
  navLinks.leaderboard.addEventListener("click", (e) => {
    e.preventDefault();
    location.hash = "leaderboard";
    showView("leaderboard");
  });
 
  backBtn.addEventListener("click", () => {
    location.hash = "hub";
    showView("hub");
  });
 
  /* --------------------------------------------------------- hub cards */
 
  document.querySelectorAll(".game-card:not(.game-card--locked)").forEach((card) => {
    const open = () => openGame(card.dataset.game);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
 
  function openGame(gameId) {
    const meta = GAME_META[gameId];
    if (!meta) return;
 
    // Destroy any currently running game before creating a new one
    if (activeGame) {
      activeGame.destroy();
      activeGame = null;
      activeGameId = null;
    }
 
    showView("gameView");
 
    const freshCanvas = getFreshCanvas();
 
    activeGameId = gameId;
    activeGame = meta.create(freshCanvas);
 
    activeGame.onScore = (score) => {
      hudScore.textContent = score;
    };
 
    activeGame.onGameOver = handleGameOver;
 
    hudScore.textContent = "0";
    hudBest.textContent = Leaderboard.getBest(gameId);
 
    resetOverlayForStart(meta);
    overlay.classList.remove("hidden");
  }
 
  /* --------------------------------------------------------- overlay flow */
 
  function resetOverlayForStart(meta) {
    overlayTitle.textContent = meta.title;
    overlayText.innerHTML = meta.instructions;
    scoreEntry.classList.add("hidden");
    overlayStartBtn.textContent = "Start Game";
    overlayStartBtn.classList.remove("hidden");
  }
 
  overlayStartBtn.addEventListener("click", () => {
    overlay.classList.add("hidden");
    if (activeGame) activeGame.start();
  });
 
  function handleGameOver(finalScore) {
    lastFinalScore = finalScore;
    overlayTitle.textContent = "Run over";
    overlayText.textContent = `You scored ${finalScore}.`;
    overlayStartBtn.textContent = "Play again";
    overlay.classList.remove("hidden");
 
    const best = Leaderboard.getBest(activeGameId);
    if (finalScore > 0 && finalScore >= best) {
      scoreEntry.classList.remove("hidden");
      playerNameInput.value = "";
      playerNameInput.focus();
    } else {
      scoreEntry.classList.add("hidden");
    }
    hudBest.textContent = Math.max(best, finalScore);
  }
 
  saveScoreBtn.addEventListener("click", () => {
    if (!activeGameId) return;
    Leaderboard.addScore(activeGameId, playerNameInput.value.trim(), lastFinalScore);
    scoreEntry.classList.add("hidden");
    hudBest.textContent = Leaderboard.getBest(activeGameId);
  });
  playerNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveScoreBtn.click();
  });
 
  /* --------------------------------------------------------- leaderboard */
 
  leaderboardTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      leaderboardTabs.forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("active");
      tab.setAttribute("aria-selected", "true");
      currentLeaderboardGameId = tab.dataset.lbGame;
      renderLeaderboard();
    });
  });
 
  function renderLeaderboard() {
    const scores = Leaderboard.getScores(currentLeaderboardGameId);
    leaderboardList.innerHTML = "";
 
    if (!scores.length) {
      const li = document.createElement("li");
      li.className = "leaderboard-empty";
      li.textContent = "No scores yet — go play a round!";
      leaderboardList.appendChild(li);
      return;
    }
 
    scores.forEach((entry) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.className = "leaderboard-name";
      name.textContent = entry.name;
      const score = document.createElement("span");
      score.className = "leaderboard-score";
      score.textContent = entry.score;
      li.appendChild(name);
      li.appendChild(score);
      leaderboardList.appendChild(li);
    });
  }
 
  clearLeaderboardBtn.addEventListener("click", () => {
    Leaderboard.clearScores(currentLeaderboardGameId);
    renderLeaderboard();
  });
 
  /* --------------------------------------------------------- initial view */
 
  const initialHash = location.hash.replace("#", "");
  showView(views[initialHash] ? initialHash : "hub");
})();
 