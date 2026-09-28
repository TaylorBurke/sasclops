// Radar placeholder: dark field, subtle orange grid, pulsing bar wiping top → bottom.
(() => {
  const THEMES = {
    lobby: { bg: '#0b0704', accent: '255, 130, 0', core: '255, 200, 140' },
    room:  { bg: '#04070b', accent: '40, 150, 255', core: '170, 215, 255' },
  };
  // Only the digest lives here; the room's hash rotates (see issue tracker).
  const ROOM_SHA256 = 'e878cdf2c8a09012ef364515a3a9f99ad81eb7d8730fea7bf03ac92eaf7d99a1';
  let theme = THEMES.lobby;
  const CELL = 28;          // grid cell, CSS px
  const MAJOR_EVERY = 4;    // every Nth line is brighter
  const TRAIL = 220;        // lit wake behind the bar, CSS px

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SWEEP_MS = reduceMotion ? 18000 : 7200;

  const canvas = document.getElementById('radar');
  const ctx = canvas.getContext('2d');

  let w = 0, h = 0, dpr = 1;
  let dimGrid, litGrid, vignette;
  const wake = document.createElement('canvas');
  const wakeCtx = wake.getContext('2d');

  function makeGrid(minorAlpha, majorAlpha) {
    const c = document.createElement('canvas');
    c.width = w * dpr;
    c.height = h * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const ox = Math.round((w % CELL) / 2);
    const oy = Math.round((h % CELL) / 2);
    const line = (x0, y0, x1, y1, i) => {
      g.strokeStyle = `rgba(${theme.accent}, ${i % MAJOR_EVERY === 0 ? majorAlpha : minorAlpha})`;
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
    dimGrid = makeGrid(0.09, 0.18);
    litGrid = makeGrid(0.35, 0.6);
    vignette = makeVignette();
    wake.width = canvas.width;
    wake.height = Math.ceil(TRAIL * dpr);
  }

  function frame(now) {
    const travel = h + TRAIL;
    const y = ((now % SWEEP_MS) / SWEEP_MS) * travel; // bar position, CSS px
    const pulse = reduceMotion ? 1 : 0.7 + 0.3 * Math.sin(now / 1000 * Math.PI * 2 * 0.7);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(dimGrid, 0, 0);

    // Wake: the bright grid, masked by a gradient that fades out above the bar.
    const top = (y - TRAIL) * dpr;
    wakeCtx.globalCompositeOperation = 'source-over';
    wakeCtx.clearRect(0, 0, wake.width, wake.height);
    wakeCtx.drawImage(litGrid, 0, -top);
    const fill = wakeCtx.createLinearGradient(0, 0, 0, wake.height);
    fill.addColorStop(0, `rgba(${theme.accent}, 0)`);
    fill.addColorStop(1, `rgba(${theme.accent}, ${0.10 * pulse})`);
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
    glow.addColorStop(0, `rgba(${theme.accent}, 0)`);
    glow.addColorStop(0.5, `rgba(${theme.accent}, ${0.35 * pulse})`);
    glow.addColorStop(1, `rgba(${theme.accent}, 0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, y - 18, w, 36);
    ctx.fillStyle = `rgba(${theme.core}, ${0.85 * pulse})`;
    ctx.fillRect(0, y - 1, w, 2);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(vignette, 0, 0);

    requestAnimationFrame(frame);
  }

  async function checkRoom() {
    const tag = location.hash.slice(1);
    let inRoom = false;
    if (tag && crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tag));
      const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
      inRoom = hex === ROOM_SHA256;
    }
    theme = inRoom ? THEMES.room : THEMES.lobby;
    document.documentElement.classList.toggle('room', inRoom);
    resize();
  }

  window.addEventListener('resize', resize);
  window.addEventListener('hashchange', checkRoom);
  resize();
  checkRoom();
  requestAnimationFrame(frame);
})();
