// Radar placeholder: dark field, subtle grid, pulsing bar wiping top → bottom.
// Orange in the lobby; blue in the secret room. Switching rooms repaints on the sweep.
(() => {
  const THEMES = {
    lobby: { bg: '#0b0704', accent: '255, 130, 0', core: '255, 200, 140' },
    room:  { bg: '#04070b', accent: '40, 150, 255', core: '170, 215, 255' },
  };
  // Only the digest lives here; the room's hash rotates daily (scripts/rotate-room.mjs).
  const ROOM_SHA256 = '2323a2328e471f7a42bccdf8c15aca89127e2f910278e506b08cade72538a07e';
  const CELL = 28;          // grid cell, CSS px
  const MAJOR_EVERY = 4;    // every Nth line is brighter
  const TRAIL = 220;        // lit wake behind the bar, CSS px

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SWEEP_MS = reduceMotion ? 18000 : 7200;
  const SWITCH_MS = reduceMotion ? 0 : 2400;   // how long the room-change sweep takes
  const GRID_FADE_MS = reduceMotion ? 0 : 1200; // background grid hiding/showing (e.g. during salvo)
  // Logo phosphor: burned back in by each pass of the bar, then fading until the next.
  const LOGO_FLOOR = 0.15;  // dimmest it gets, just before the bar returns
  const LOGO_TAU = 2600;    // ms: fade after the bar passes
  const FLARE_TAU = 320;    // ms: the hot band riding just behind the bar

  const canvas = document.getElementById('radar');
  const ctx = canvas.getContext('2d');
  const logo = document.querySelector('.logo');
  const logoImg = logo.querySelector('img');
  // Offscreen layers: the masked logo, a hot-tinted silhouette, and that silhouette masked to the flare.
  const logoLayer = document.createElement('canvas');
  const tint = document.createElement('canvas');
  const flare = document.createElement('canvas');

  let w = 0, h = 0, dpr = 1;
  let vignette;
  let theme = THEMES.lobby;
  // While switching rooms: { from, to, start } — `to` is painted above the bar.
  let change = null;
  let gridAlpha = 1, gridTarget = 1, lastFrame = 0;
  const overlays = [];      // extra layers drawn each frame, e.g. salvo.js's board
  const wake = document.createElement('canvas');
  const wakeCtx = wake.getContext('2d');

  function makeGrid(accent, minorAlpha, majorAlpha) {
    const c = document.createElement('canvas');
    c.width = w * dpr;
    c.height = h * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const ox = Math.round((w % CELL) / 2);
    const oy = Math.round((h % CELL) / 2);
    const line = (x0, y0, x1, y1, i) => {
      g.strokeStyle = `rgba(${accent}, ${i % MAJOR_EVERY === 0 ? majorAlpha : minorAlpha})`;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
    };
    g.lineWidth = 1 / dpr;
    // Index lines from the center so the major lines stay symmetric.
    const cols = Math.ceil(w / CELL), rows = Math.ceil(h / CELL);
    const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
    for (let i = 0; i <= cols; i++) {
      const x = ox + i * CELL + 0.5 / dpr;
      line(x, 0, x, h, Math.abs(i - cx));
    }
    for (let j = 0; j <= rows; j++) {
      const y = oy + j * CELL + 0.5 / dpr;
      line(0, y, w, y, Math.abs(j - cy));
    }
    return c;
  }

  function makeVignette() {
    const c = document.createElement('canvas');
    c.width = w * dpr;
    c.height = h * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const r = Math.hypot(w, h) / 2;
    const grad = g.createRadialGradient(w / 2, h / 2, r * 0.35, w / 2, h / 2, r);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    // Faint LCD scanlines.
    g.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    return c;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    for (const t of Object.values(THEMES)) {
      t.dimGrid = makeGrid(t.accent, 0.09, 0.18);
      t.litGrid = makeGrid(t.accent, 0.35, 0.6);
    }
    vignette = makeVignette();
    wake.width = canvas.width;
    wake.height = Math.ceil(TRAIL * dpr);
  }

  // One full layer of the scene in a theme: field, grid, lit wake, bar.
  function paint(t, y, pulse) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = gridAlpha;
    ctx.drawImage(t.dimGrid, 0, 0);
    ctx.globalAlpha = 1;

    // Wake: the bright grid, masked by a gradient that fades out above the bar.
    const top = (y - TRAIL) * dpr;
    wakeCtx.globalCompositeOperation = 'source-over';
    wakeCtx.clearRect(0, 0, wake.width, wake.height);
    wakeCtx.globalAlpha = gridAlpha;
    wakeCtx.drawImage(t.litGrid, 0, -top);
    wakeCtx.globalAlpha = 1;
    const fill = wakeCtx.createLinearGradient(0, 0, 0, wake.height);
    fill.addColorStop(0, `rgba(${t.accent}, 0)`);
    fill.addColorStop(1, `rgba(${t.accent}, ${0.10 * pulse})`);
    wakeCtx.fillStyle = fill;
    wakeCtx.fillRect(0, 0, wake.width, wake.height);
    wakeCtx.globalCompositeOperation = 'destination-in';
    const mask = wakeCtx.createLinearGradient(0, 0, 0, wake.height);
    mask.addColorStop(0, 'rgba(0, 0, 0, 0)');
    mask.addColorStop(1, `rgba(0, 0, 0, ${pulse})`);
    wakeCtx.fillStyle = mask;
    wakeCtx.fillRect(0, 0, wake.width, wake.height);
    ctx.drawImage(wake, 0, top);

    // The bar itself: a soft glow band with a hot core line.
    ctx.scale(dpr, dpr);
    const glow = ctx.createLinearGradient(0, y - 18, 0, y + 18);
    glow.addColorStop(0, `rgba(${t.accent}, 0)`);
    glow.addColorStop(0.5, `rgba(${t.accent}, ${0.35 * pulse})`);
    glow.addColorStop(1, `rgba(${t.accent}, 0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, y - 18, w, 36);
    ctx.fillStyle = `rgba(${t.core}, ${0.85 * pulse})`;
    ctx.fillRect(0, y - 1, w, 2);
  }

  // A vertical destination-in mask over the logo rect r: each row's alpha is brightness(age),
  // where age is how long ago the bar crossed that row.
  function ageMask(g, r, now, barY, brightness) {
    const stops = [];
    for (let i = 0; i <= 24; i++) {
      const f = i / 24;
      stops.push([f, brightness(now - lastCross(r.top + f * r.height, now))]);
    }
    // Hard edge at the bar: freshly burned just above it, oldest just below.
    const fb = (barY - r.top) / r.height;
    if (fb > 0 && fb < 1) stops.push([fb - 0.0005, brightness(0)], [fb + 0.0005, brightness(SWEEP_MS)]);
    const grad = g.createLinearGradient(0, 0, 0, g.canvas.height);
    for (const [f, a] of stops.sort((p, q) => p[0] - q[0])) grad.addColorStop(Math.min(1, Math.max(0, f)), `rgba(0, 0, 0, ${a})`);
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = grad;
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.globalCompositeOperation = 'source-over';
  }

  // The logo lives in the lobby, drawn as phosphor. During a room switch it's cut off at the bar.
  function drawLogo(now, y) {
    if ((theme === THEMES.room && !change) || !logoImg.complete || !logoImg.naturalWidth) return;
    const r = logo.getBoundingClientRect();
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (!W || !H) return;
    if (logoLayer.width !== W || logoLayer.height !== H) {
      for (const c of [logoLayer, tint, flare]) { c.width = W; c.height = H; }
      const t = tint.getContext('2d');
      t.drawImage(logoImg, 0, 0, W, H);
      t.globalCompositeOperation = 'source-in';
      t.fillStyle = `rgb(${THEMES.lobby.core})`;
      t.fillRect(0, 0, W, H);
    }

    const lg = logoLayer.getContext('2d');
    lg.clearRect(0, 0, W, H);
    lg.drawImage(logoImg, 0, 0, W, H);
    if (!reduceMotion) ageMask(lg, r, now, y, (age) => LOGO_FLOOR + (1 - LOGO_FLOOR) * Math.exp(-age / LOGO_TAU));

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (change) {
      ctx.beginPath();
      if (change.to === THEMES.room) ctx.rect(0, y * dpr, canvas.width, canvas.height); // erased from the top
      else ctx.rect(0, 0, canvas.width, y * dpr);                                       // redrawn from the top
      ctx.clip();
    }
    const x0 = r.left * dpr, y0 = r.top * dpr;
    ctx.shadowColor = 'rgba(255, 130, 0, 0.45)';
    ctx.shadowBlur = 6 * dpr;
    ctx.drawImage(logoLayer, x0, y0);

    // The burn: a hot, whitish copy riding just behind the bar, with bloom and a little jitter.
    if (!reduceMotion && !change && y > r.top && y < r.bottom + 60) {
      const fg = flare.getContext('2d');
      fg.clearRect(0, 0, W, H);
      fg.drawImage(tint, 0, 0);
      ageMask(fg, r, now, y, (age) => 0.9 * Math.exp(-age / FLARE_TAU));
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = `rgba(${THEMES.lobby.core}, 0.9)`;
      ctx.shadowBlur = 10 * dpr;
      ctx.drawImage(flare, x0 + (Math.random() - 0.5) * 2 * dpr, y0);
    }
    ctx.restore();
  }

  function frame(now) {
    const step = GRID_FADE_MS ? (now - lastFrame) / GRID_FADE_MS : 1;
    gridAlpha = gridTarget > gridAlpha ? Math.min(gridTarget, gridAlpha + step) : Math.max(gridTarget, gridAlpha - step);
    lastFrame = now;
    const pulse = reduceMotion ? 1 : 0.7 + 0.3 * Math.sin(now / 1000 * Math.PI * 2 * 0.7);
    let y = ((now % SWEEP_MS) / SWEEP_MS) * (h + TRAIL); // bar position, CSS px

    if (change) {
      const p = (now - change.start) / SWITCH_MS;
      if (p >= 1) {
        finishChange();
      } else {
        y = p * h;
        paint(change.from, y, pulse);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width, y * dpr);
        ctx.clip();
        paint(change.to, y, pulse);
        ctx.restore();
      }
    }
    if (!change) paint(theme, y, pulse);
    drawLogo(now, y);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const draw of overlays) draw(ctx, now, w, h);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(vignette, 0, 0);
    requestAnimationFrame(frame);
  }

  function setRoom(inRoom, animate) {
    const next = inRoom ? THEMES.room : THEMES.lobby;
    if (next === (change ? change.to : theme)) return;
    if (change) finishChange();
    if (animate && SWITCH_MS > 0) {
      change = { from: theme, to: next, start: performance.now() };
      if (!inRoom) document.documentElement.classList.remove('room'); // logo back in the DOM flow
    } else {
      theme = next;
      document.documentElement.classList.toggle('room', inRoom);
    }
  }

  function finishChange() {
    theme = change.to;
    document.documentElement.classList.toggle('room', theme === THEMES.room);
    change = null;
  }

  async function isRoom(tag) {
    if (!tag || !crypto.subtle) return false;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tag));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex === ROOM_SHA256;
  }

  async function checkRoom(animate) {
    setRoom(await isRoom(location.hash.slice(1)), animate);
  }

  // Offset into the sweep cycle at which the bar reaches height y (CSS px).
  const phase = (y) => (y / (h + TRAIL)) * SWEEP_MS;
  const lastCross = (y, t) => Math.floor((t - phase(y)) / SWEEP_MS) * SWEEP_MS + phase(y);

  // Used by terminal.js and salvo.js.
  window.sasclops = {
    addOverlay: (draw) => overlays.push(draw),
    showGrid: (on) => { gridTarget = on ? 1 : 0; },
    // When the bar last crossed / next crosses height y, on its steady rhythm
    // (times on the performance.now() clock, same as requestAnimationFrame).
    lastCross,
    nextCross: (y, t) => Math.ceil((t - phase(y)) / SWEEP_MS) * SWEEP_MS + phase(y),
    isRoom,
    inRoom: () => (change ? change.to : theme) === THEMES.room,
    leave() {
      history.pushState(null, '', location.pathname);
      setRoom(false, true);
    },
  };

  window.addEventListener('resize', resize);
  window.addEventListener('hashchange', () => checkRoom(true));
  resize();
  checkRoom(false);
  requestAnimationFrame(frame);
})();
