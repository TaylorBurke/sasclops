// SALVO: Battleship on the radar, inside the room. Type `salvo` in the terminal.
// Nothing appears or gets reported until the sweep bar crosses it: shots are fired
// instantly but revealed on the next pass.
(() => {
  const N = 10;
  const COLS = 'abcdefghij';
  const FLEET = [4, 4, 4];     // three ships, four tiles each
  const FADE = 1800;           // ms: phosphor decay after the bar passes
  const FLOOR = 0.3;           // refreshed elements never fade below this
  const SHOT_FADE = 2600;      // ms: a white shot lights once, then fades for good
  const END_FADE = 2000;       // ms: the whole board after the game ends
  const RGB = {
    grid: '40, 150, 255', ship: '40, 150, 255', shot: '255, 255, 255', hit: '255, 70, 70',
    plot: '255, 130, 0',       // remembered misses, with plot memory on
  };

  const key = (c, r) => r * N + c;
  const label = (k) => `${COLS[k % N]}${Math.floor(k / N) + 1}`;

  function parseCell(text) {
    const m = text.trim().toLowerCase().match(/^([a-j])\s*(10|[1-9])$/);
    return m ? key(COLS.indexOf(m[1]), Number(m[2]) - 1) : null;
  }

  // Random, non-overlapping, horizontal or vertical; never on the player's cell.
  function placeFleet(avoid) {
    const taken = new Set([avoid]);
    for (const len of FLEET) {
      for (;;) {
        const across = Math.random() < 0.5;
        const c0 = Math.floor(Math.random() * (across ? N - len + 1 : N));
        const r0 = Math.floor(Math.random() * (across ? N : N - len + 1));
        const cells = Array.from({ length: len }, (_, i) => key(c0 + (across ? i : 0), r0 + (across ? 0 : i)));
        if (cells.some((k) => taken.has(k))) continue;
        cells.forEach((k) => taken.add(k));
        break;
      }
    }
    taken.delete(avoid);
    return taken;
  }

  let game = null;
  let board = null; // this frame's layout: { x0, y0, s }

  const print = (text, kind) => sasclops.term.print(text, kind);

  function start() {
    // Upgrade: `echo plot_memory=on > .fire_control` keeps your past strikes on the grid.
    const plotMemory = /^\s*plot_memory\s*=\s*on\s*$/m.test(sasclops.term.readConfig('.fire_control'));
    game = {
      phase: 'place',          // place → wait ⇄ aim → over
      plotMemory,
      player: null,
      fleet: null,
      startedAt: 0,
      endedAt: 0,
      shots: [],               // { cell, by: 'you' | 'enemy', at, hit, revealAt }
      yours: new Set(),
      theirs: new Set(),
      hits: 0,
    };
    sasclops.term.takeOver({ prompt: 'salvo>', onLine });
    sasclops.showGrid(false); // the game grid is the only grid while playing
    print('SALVO — fire control online.');
    print('the grid is 10×10: columns a–j, rows 1–10. type quit to stand down.');
    if (plotMemory) print('plot memory online: past strikes stay on the grid.');
    print('where do we launch counterstrikes from? (e.g. e5)');
  }

  function end(message, kind) {
    print(message, kind);
    if (!game.startedAt) {        // quit before the board ever came up
      sasclops.term.release();
      sasclops.showGrid(true);
      game = null;
      return;
    }
    game.phase = 'over';
    game.endedAt = performance.now();
    sasclops.term.release();
  }

  function enemyFires(now) {
    const open = [];
    for (let k = 0; k < N * N; k++) if (!game.theirs.has(k) && !game.fleet.has(k)) open.push(k);
    const cell = open[Math.floor(Math.random() * open.length)];
    game.theirs.add(cell);
    game.shots.push({ cell, by: 'enemy', at: now, hit: cell === game.player });
  }

  function onLine(line) {
    const text = line.trim().toLowerCase();
    if (['quit', 'exit', 'abort'].includes(text)) return end('fire control offline.');
    const now = performance.now();

    if (game.phase === 'wait') return print('stand by — waiting for the sweep.');

    const cell = parseCell(text);
    if (cell === null) return print('give a coordinate like e5 (columns a–j, rows 1–10).', 'err');

    if (game.phase === 'place') {
      game.player = cell;
      game.fleet = placeFleet(cell);
      game.startedAt = now;
      game.phase = 'wait';
      print(`position locked at ${label(cell)}. the sweep will bring the grid up.`);
      enemyFires(now);
      return;
    }

    // Aiming.
    if (cell === game.player) return print("that's your own position.", 'err');
    if (game.yours.has(cell)) return print(`already fired on ${label(cell)}.`, 'err');
    const hit = game.fleet.has(cell);
    game.yours.add(cell);
    if (hit) game.hits++;
    game.shots.push({ cell, by: 'you', at: now, hit });
    game.phase = 'wait';
    print(`firing on ${label(cell)}…`);
    if (game.hits < game.fleet.size) enemyFires(now); // no reply to the winning shot
  }

  // Report each shot the moment the sweep reveals it; hand the turn back once all are in.
  function reveal(now) {
    if (game.phase !== 'wait') return;
    for (const shot of game.shots) {
      if (shot.revealAt) continue;
      const at = sasclops.nextCross(cellY(shot.cell), shot.at);
      if (now < at) continue;
      shot.revealAt = at;
      if (shot.by === 'you') {
        print(`${label(shot.cell)}: ${shot.hit ? 'hit.' : 'miss.'}`);
        if (shot.hit && game.hits === game.fleet.size) return end('the returns have all been cleared, stand by');
      } else if (shot.hit) {
        return end(`incoming at ${label(shot.cell)}. direct hit on your position. transmission lost.`, 'err');
      } else {
        print(`incoming at ${label(shot.cell)}: miss.`);
      }
    }
    if (game.shots.every((s) => s.revealAt)) {
      game.phase = 'aim';
      print('your turn. fire at (a–j)(1–10):');
    }
  }

  // ---- drawing -------------------------------------------------------------

  // Centered in the space above the terminal, with room for labels on the top and left.
  function layout(w, h) {
    const term = document.querySelector('.term');
    const bottom = term.open ? Math.min(term.getBoundingClientRect().top, h) : h;
    const s = Math.max(10, Math.min(32, Math.floor(Math.min(w * 0.9, bottom * 0.88) / (N + 1.5))));
    return {
      s,
      x0: Math.round((w - N * s) / 2 + s / 2),
      y0: Math.round((bottom - N * s) / 2 + s / 2),
    };
  }

  const cellY = (k) => board.y0 + (Math.floor(k / N) + 0.5) * board.s;
  const cellX = (k) => board.x0 + (k % N) * board.s;

  // Brightness of something at height y that exists from `since` and is refreshed every pass.
  function lit(y, now, since) {
    if (now < sasclops.nextCross(y, since)) return 0;
    const age = now - sasclops.lastCross(y, now);
    let b = FLOOR + (1 - FLOOR) * Math.exp(-age / FADE);
    if (game.endedAt) b *= Math.exp(-(now - game.endedAt) / END_FADE);
    return b;
  }

  function fillCell(ctx, k, rgb, alpha) {
    if (alpha < 0.01) return;
    const { s } = board;
    const pad = Math.max(2, Math.round(s * 0.14));
    ctx.fillStyle = `rgba(${rgb}, ${alpha})`;
    ctx.shadowColor = `rgba(${rgb}, ${alpha})`;
    ctx.fillRect(cellX(k) + pad, cellY(k) - s / 2 + pad, s - 2 * pad, s - 2 * pad);
  }

  function draw(ctx, now, w, h) {
    if (!game) return;
    if (!sasclops.inRoom()) {                     // left the room mid-game
      if (game.phase !== 'over') sasclops.term.release();
      sasclops.showGrid(true);
      game = null;
      return;
    }
    if (game.phase === 'place') return;
    // Bring the background grid back only once the board has mostly faded,
    // so the two grids are never both on screen.
    if (game.endedAt && !game.gridBack && now - game.endedAt > END_FADE * 2) {
      sasclops.showGrid(true);
      game.gridBack = true;
    }
    if (game.endedAt && now - game.endedAt > END_FADE * 5) {
      game = null;
      return;
    }

    // Laid out once per game (and on resize), so opening or closing the terminal
    // doesn't move the board out from under the sweep.
    if (!game.board || game.board.w !== w || game.board.h !== h) game.board = { ...layout(w, h), w, h };
    board = game.board;
    reveal(now);
    if (!game) return;
    const { x0, y0, s } = board;

    ctx.save();
    ctx.lineWidth = 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(s * 0.45)}px 'JetBrains Mono', ui-monospace, monospace`;

    // Column labels.
    const lb = lit(y0 - s / 2, now, game.startedAt);
    ctx.fillStyle = `rgba(${RGB.grid}, ${0.8 * lb})`;
    for (let c = 0; c < N; c++) ctx.fillText(COLS[c].toUpperCase(), x0 + (c + 0.5) * s, y0 - s / 2);

    // Grid, one row at a time so each row takes its brightness from the sweep.
    for (let r = 0; r < N; r++) {
      const top = y0 + r * s;
      const b = lit(top + s / 2, now, game.startedAt);
      if (b < 0.01) continue;
      ctx.fillStyle = `rgba(${RGB.grid}, ${0.8 * b})`;
      ctx.fillText(String(r + 1), x0 - s / 2, top + s / 2);
      for (let c = 0; c <= N; c++) {
        const edge = c === 0 || c === N;
        ctx.strokeStyle = `rgba(${RGB.grid}, ${(edge ? 0.9 : 0.3) * b})`;
        ctx.beginPath();
        ctx.moveTo(x0 + c * s + 0.5, top);
        ctx.lineTo(x0 + c * s + 0.5, top + s);
        ctx.stroke();
      }
      for (const [y, edge] of [[top, r === 0], [top + s, r === N - 1]]) {
        if (!edge && y === top + s) continue;   // interior lines are drawn once, as a row's top
        ctx.strokeStyle = `rgba(${RGB.grid}, ${(edge ? 0.9 : 0.3) * b})`;
        ctx.beginPath();
        ctx.moveTo(x0, y + 0.5);
        ctx.lineTo(x0 + N * s, y + 0.5);
        ctx.stroke();
      }
    }

    // Cells: the player's ship and hits persist; shots flash white once.
    ctx.shadowBlur = s * 0.4;
    fillCell(ctx, game.player, RGB.ship, 0.9 * lit(cellY(game.player), now, game.startedAt));
    for (const shot of game.shots) {
      if (shot.by !== 'you') continue;
      if (shot.hit) fillCell(ctx, shot.cell, RGB.hit, 0.95 * lit(cellY(shot.cell), now, shot.at));
      else if (game.plotMemory) fillCell(ctx, shot.cell, RGB.plot, 0.85 * lit(cellY(shot.cell), now, shot.at));
    }
    for (const shot of game.shots) {
      const at = shot.revealAt ?? sasclops.nextCross(cellY(shot.cell), shot.at);
      if (now >= at) fillCell(ctx, shot.cell, RGB.shot, 0.95 * Math.exp(-(now - at) / SHOT_FADE));
    }
    ctx.restore();
  }

  sasclops.addOverlay(draw);
  sasclops.salvo = { start };
})();
