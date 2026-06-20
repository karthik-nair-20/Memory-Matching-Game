// ============================================================================
// Reusable memory matching game.
// Flip/match logic, emoji pool, and the board-building loop are carried over
// from the original gameScript.js, but made instance-scoped (no globals) so the
// easy and hard games never collide, and adapted to use a countdown Timer plus
// a remaining-pairs display, a Restart button, and an onComplete callback.
// ============================================================================

// Emoji pool (34 entries -> enough for the 18 pairs the hard board needs).
const EMOJI_POOL = ["💐","🌹","🌻","🏵️","🌺","🌴","🌈","🍓","🍒","🍎","🍉","🍊","🥭","🍍","🍋","🍏","🍐","🥝","🍇","🥥","🍅","🌶️","🍄","🧅","🥦","🥑","🍔","🍕","🧁","🎂","🍬","🍩","🍫","🎈"];

function shuffle(arr) {
  let c, tmp, p = arr.length;
  while (--p > 0) {
    c = Math.floor(Math.random() * (p + 1));
    tmp = arr[c];
    arr[c] = arr[p];
    arr[p] = tmp;
  }
  return arr;
}

function createGame(container, config, { onComplete } = {}) {
  const rows = config.rows;
  const cols = config.cols;
  const totalPairs = (rows * cols) / 2;

  // Per-instance flip state (mirrors the original change() logic).
  let pre = "";       // emoji of the first flipped card
  let firstInner = null; // the first flipped .inner element
  let firstId = 0;    // id of the first flipped card (prevents re-clicking it)
  let turn = 0;       // 0 = none flipped, 1 = one flipped, 2 = resolving
  let remaining = totalPairs;
  let finished = false;

  const FLIP = "rotateY(180deg)";
  const FLIP_BACK = "rotateY(0deg)";

  // Build the UI shell.
  container.innerHTML = "";
  const hud = document.createElement("div");
  hud.className = "game-hud";
  const pairsEl = document.createElement("span");
  pairsEl.className = "pairs-left";
  const restartBtn = document.createElement("button");
  restartBtn.className = "restart-btn";
  restartBtn.type = "button";
  restartBtn.textContent = "Restart";
  const timerEl = document.createElement("span");
  timerEl.className = "game-timer";
  hud.appendChild(pairsEl);
  hud.appendChild(restartBtn);
  hud.appendChild(timerEl);

  const boardWrap = document.createElement("div");
  boardWrap.className = "board-wrap";
  const table = document.createElement("table");
  table.className = "board";
  boardWrap.appendChild(table);

  container.appendChild(hud);
  container.appendChild(boardWrap);

  function updatePairs() {
    pairsEl.textContent = "Pairs left: " + remaining;
  }

  // Countdown timer using the single configurable value.
  const timer = Timer(TIMER_DURATION_SECONDS, {
    onTick: (formatted) => {
      timerEl.textContent = "Time: " + formatted;
    },
    onExpire: () => finish(),
  });

  function finish() {
    if (finished) return; // guard against double-fire (match + expiry race)
    finished = true;
    timer.stop();
    if (onComplete) onComplete();
  }

  // Build (or rebuild) the board.
  function buildBoard() {
    const items = [];
    for (let i = 0; i < totalPairs; i++) {
      items.push(EMOJI_POOL[i], EMOJI_POOL[i]);
    }
    shuffle(items);

    table.style.setProperty("--cols", cols);
    table.innerHTML = "";
    let n = 1;
    for (let r = 0; r < rows; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c < cols; c++) {
        const td = document.createElement("td");
        const id = n;
        td.dataset.id = String(id);
        td.innerHTML =
          "<div class='inner'><div class='front'></div>" +
          "<div class='back'><p>" + items[n - 1] + "</p></div></div>";
        td.addEventListener("click", () => change(td));
        tr.appendChild(td);
        n++;
      }
      table.appendChild(tr);
    }
  }

  // Flip / match logic (carried over from gameScript.js change()).
  function change(td) {
    if (finished) return;
    const inner = td.querySelector(".inner");
    const backText = td.querySelector(".back p").textContent;
    const id = parseInt(td.dataset.id, 10);

    // Ignore clicks while resolving, on already-matched cards, or re-clicking
    // the first selected card.
    if (turn === 2 || inner.getAttribute("flip") === "block" || firstId === id) {
      return;
    }

    inner.style.transform = FLIP;

    if (turn === 1) {
      turn = 2; // lock to prevent spam clicking

      if (pre !== backText) {
        // Mismatch: flip both back after a beat.
        const prevInner = firstInner;
        setTimeout(() => {
          prevInner.style.transform = FLIP_BACK;
          inner.style.transform = FLIP_BACK;
          firstId = 0;
        }, 1000);
      } else {
        // Match: lock both cards.
        remaining--;
        updatePairs();
        inner.setAttribute("flip", "block");
        firstInner.setAttribute("flip", "block");
        firstId = 0;
      }

      setTimeout(() => {
        turn = 0;
      }, 1150);

      if (remaining === 0) {
        setTimeout(finish, 1200);
      }
    } else {
      pre = backText;
      firstId = id;
      firstInner = inner;
      turn = 1;
    }
  }

  function restart() {
    pre = "";
    firstInner = null;
    firstId = 0;
    turn = 0;
    remaining = totalPairs;
    buildBoard();
    updatePairs();
    timer.reset();
    timer.start();
  }

  restartBtn.addEventListener("click", restart);

  // Initial start.
  buildBoard();
  updatePairs();
  timer.start();

  // Allow the orchestrator to stop the timer if it tears the screen down early.
  return { stop: () => timer.stop() };
}
