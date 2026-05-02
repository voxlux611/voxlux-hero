/**
 * VoxLux Strategic — Hero Background Animation
 * --------------------------------------------------------------------------
 * A luminous wireframe city skyline rendered on canvas.
 * Three parallax layers drift slowly to evoke depth and quiet movement.
 * Gold accents are reserved for signature window-glints and the horizon line,
 * keeping the white wireframe as the dominant visual register (luxury, editorial,
 * architectural — not "tech demo").
 *
 * Performance philosophy:
 *   - Canvas, not SVG (smoother for hundreds of strokes per frame)
 *   - devicePixelRatio capped at 2 (mobile battery)
 *   - requestAnimationFrame loop, paused on visibilitychange
 *   - Buildings generated once, transformed on each frame (no garbage churn)
 *   - Respects prefers-reduced-motion (renders a still frame)
 *
 * Brand tokens (must match the brand spec):
 *   Oxford Blue background  #0B1E3F
 *   Deep horizon            #061528
 *   VoxLux Gold             #C9A24B
 *   Warm Bone (accent text) #F5F1E8
 *   Wireframe White         #FFFFFF at low alpha — the "drawing" tone
 */

(function () {
  'use strict';

  // ---------- Brand tokens ----------
  const COLORS = {
    bgTop:        '#0B1E3F',
    bgBottom:     '#061528',
    gold:         '#C9A24B',
    goldGlow:     'rgba(201, 162, 75, 0.45)',
    wireframe:    'rgba(255, 255, 255, 0.55)',
    wireframeDim: 'rgba(255, 255, 255, 0.18)',
    wireframeHi:  'rgba(255, 255, 255, 0.85)',
    starLight:    'rgba(245, 241, 232, 0.7)'
  };

  // ---------- Setup ----------
  const canvas = document.getElementById('voxlux-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  let width = 0;
  let height = 0;
  let dpr = 1;
  let running = true;
  let reducedMotion = false;

  // ---------- Sizing ----------
  function resize() {
    const rect = { w: window.innerWidth, h: window.innerHeight };
    // Cap DPR at 2: the difference between 2x and 3x is invisible at this
    // line weight, but the GPU cost on iPhones is real.
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.w;
    height = rect.h;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rebuildScene();
  }

  // ---------- Reduced motion check ----------
  function checkReducedMotion() {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ---------- Procedural city generation ----------
  // Three parallax layers. Far layer = slowest drift, smallest buildings, lowest opacity.
  // This is what makes it feel like an architectural rendering instead of a video game.
  let layers = [];
  let stars = [];
  let goldGlints = [];

  function rebuildScene() {
    layers = [
      buildLayer({
        depth:    0.30,    // slow drift
        density:  0.55,
        minH:     0.08,    // building height as fraction of canvas
        maxH:     0.22,
        minW:     38,
        maxW:     90,
        opacity:  0.35,
        baseY:    0.78,    // horizon line
        weight:   0.7
      }),
      buildLayer({
        depth:    0.55,
        density:  0.65,
        minH:     0.16,
        maxH:     0.36,
        minW:     46,
        maxW:     120,
        opacity:  0.65,
        baseY:    0.86,
        weight:   0.9
      }),
      buildLayer({
        depth:    1.0,     // foreground — fastest drift, brightest, biggest
        density:  0.55,
        minH:     0.22,
        maxH:     0.50,
        minW:     60,
        maxW:     170,
        opacity:  1.0,
        baseY:    0.96,
        weight:   1.1
      })
    ];

    // A scatter of pinprick "stars" / distant lights above the skyline
    stars = [];
    const starCount = Math.floor((width * height) / 9000);
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.55,
        r: Math.random() * 0.9 + 0.2,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.0015 + Math.random() * 0.002
      });
    }

    // Pick a few "signature windows" per layer to glow gold — the rare luxury accent.
    goldGlints = [];
    layers.forEach((layer, layerIdx) => {
      layer.buildings.forEach((b) => {
        // Roughly 1 in 14 buildings gets a gold-glint window pattern.
        if (Math.random() < 0.07) {
          goldGlints.push({
            layerIdx,
            buildingRef: b,
            phase: Math.random() * Math.PI * 2,
            speed: 0.0008 + Math.random() * 0.0008
          });
        }
      });
    });
  }

  function buildLayer(opts) {
    const buildings = [];
    let cursorX = -opts.maxW; // start off-screen left so the drift is seamless
    const baseY = height * opts.baseY;

    // Lay buildings end-to-end with small gaps; we'll wrap them around the
    // canvas in the draw loop for an infinite scroll effect.
    while (cursorX < width + opts.maxW) {
      const w = opts.minW + Math.random() * (opts.maxW - opts.minW);
      const h = height * (opts.minH + Math.random() * (opts.maxH - opts.minH));
      const gap = Math.random() < opts.density ? 1 + Math.random() * 4 : 8 + Math.random() * 14;

      // Roof style — flat, stepped, antenna, or pitched. Adds variety without noise.
      const roofRoll = Math.random();
      let roof;
      if (roofRoll < 0.55)      roof = 'flat';
      else if (roofRoll < 0.80) roof = 'stepped';
      else if (roofRoll < 0.93) roof = 'antenna';
      else                      roof = 'pitched';

      // Window grid — luxury skyline reads better with sparse, regular windows
      // than dense random ones. Aim for ~3-4 columns per building.
      const cols = Math.max(2, Math.floor(w / 22));
      const rows = Math.max(3, Math.floor(h / 26));

      buildings.push({
        x: cursorX,
        y: baseY - h,
        w,
        h,
        roof,
        cols,
        rows,
        // Per-building random phase for shimmer
        seed: Math.random() * 1000
      });

      cursorX += w + gap;
    }

    return {
      depth:    opts.depth,
      buildings,
      totalWidth: cursorX, // for wraparound math
      opacity:  opts.opacity,
      weight:   opts.weight,
      baseY,
      offset:   0          // drift offset, mutated each frame
    };
  }

  // ---------- Drawing ----------
  function drawBackground() {
    // Vertical gradient sky: Oxford Blue → deep horizon
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, COLORS.bgTop);
    grad.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // A soft warm glow on the horizon — this is what makes it feel "lit"
    // rather than dead. Painted as a wide, low-opacity radial.
    const horizonY = height * 0.86;
    const horizonGlow = ctx.createRadialGradient(
      width * 0.5, horizonY,
      0,
      width * 0.5, horizonY,
      width * 0.7
    );
    horizonGlow.addColorStop(0, 'rgba(201, 162, 75, 0.10)');
    horizonGlow.addColorStop(0.5, 'rgba(201, 162, 75, 0.03)');
    horizonGlow.addColorStop(1, 'rgba(201, 162, 75, 0)');
    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, 0, width, height);
  }

  function drawStars(t) {
    stars.forEach((s) => {
      const tw = 0.6 + Math.sin(s.twinkle + t * s.twinkleSpeed) * 0.4;
      ctx.fillStyle = `rgba(245, 241, 232, ${0.35 * tw})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawLayer(layer, t) {
    // Drift speed scales with depth (foreground moves fastest)
    if (!reducedMotion) {
      layer.offset = (layer.offset + 0.12 * layer.depth) % layer.totalWidth;
    }

    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.lineWidth = layer.weight;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    layer.buildings.forEach((b) => {
      // Wraparound: draw each building twice if needed so the drift loops cleanly
      drawBuilding(b, layer, -layer.offset, t);
      drawBuilding(b, layer, -layer.offset + layer.totalWidth, t);
    });

    ctx.restore();
  }

  function drawBuilding(b, layer, dx, t) {
    const x = b.x + dx;

    // Skip buildings fully off-screen — meaningful perf win on dense layers
    if (x + b.w < -10 || x > width + 10) return;

    const y = b.y;
    const w = b.w;
    const h = b.h;

    // ---- Outline ----
    ctx.strokeStyle = COLORS.wireframe;
    ctx.beginPath();
    ctx.moveTo(x, layer.baseY);
    ctx.lineTo(x, y);

    // Roof variants
    if (b.roof === 'flat') {
      ctx.lineTo(x + w, y);
    } else if (b.roof === 'stepped') {
      const stepX = w * 0.7;
      const stepUp = h * 0.12;
      ctx.lineTo(x + stepX, y);
      ctx.lineTo(x + stepX, y - stepUp);
      ctx.lineTo(x + w, y - stepUp);
    } else if (b.roof === 'antenna') {
      ctx.lineTo(x + w, y);
    } else { // pitched
      ctx.lineTo(x + w * 0.5, y - h * 0.10);
      ctx.lineTo(x + w, y);
    }
    ctx.lineTo(x + w, layer.baseY);
    ctx.stroke();

    // Antenna mast (rendered separately so it's a thin highlight line)
    if (b.roof === 'antenna') {
      ctx.save();
      ctx.strokeStyle = COLORS.wireframeHi;
      ctx.lineWidth = layer.weight * 0.7;
      ctx.beginPath();
      const mastX = x + w * 0.5;
      ctx.moveTo(mastX, y);
      ctx.lineTo(mastX, y - h * 0.18);
      ctx.stroke();
      ctx.restore();
    }

    // ---- Window grid (the luxury detail) ----
    // Drawn dim by default; selected windows are highlighted bright or gold.
    const padX = w * 0.12;
    const padY = h * 0.06;
    const innerW = w - padX * 2;
    const innerH = h - padY * 2;
    const cellW = innerW / b.cols;
    const cellH = innerH / b.rows;
    const winW = Math.max(2, cellW * 0.55);
    const winH = Math.max(2, cellH * 0.45);

    for (let r = 0; r < b.rows; r++) {
      for (let c = 0; c < b.cols; c++) {
        const wx = x + padX + c * cellW + (cellW - winW) / 2;
        const wy = y + padY + r * cellH + (cellH - winH) / 2;

        // Deterministic-but-varied "lit" pattern using the building seed.
        // This avoids per-frame randomness (which would flicker ugly).
        const lit = ((Math.sin(b.seed + r * 1.3 + c * 2.1) + 1) / 2) > 0.55;

        if (lit) {
          ctx.fillStyle = COLORS.wireframeHi;
        } else {
          ctx.fillStyle = COLORS.wireframeDim;
        }
        ctx.fillRect(wx, wy, winW, winH);
      }
    }
  }

  function drawGoldGlints(t) {
    // The rare warm accents — a handful of windows pulse gold.
    // This is what reads as "luxury" rather than "blueprint."
    goldGlints.forEach((g) => {
      const layer = layers[g.layerIdx];
      const b = g.buildingRef;
      if (!b) return;

      const pulse = 0.5 + 0.5 * Math.sin(g.phase + t * g.speed);
      const x = b.x - layer.offset;
      const wrappedX = ((x % layer.totalWidth) + layer.totalWidth) % layer.totalWidth;
      const finalX = wrappedX > width + 50 ? wrappedX - layer.totalWidth : wrappedX;

      if (finalX + b.w < -10 || finalX > width + 10) return;

      // Pick a single window position deterministically per glint
      const padX = b.w * 0.12;
      const padY = b.h * 0.06;
      const innerW = b.w - padX * 2;
      const innerH = b.h - padY * 2;
      const cellW = innerW / b.cols;
      const cellH = innerH / b.rows;
      const winW = Math.max(2, cellW * 0.55);
      const winH = Math.max(2, cellH * 0.45);

      const cIdx = Math.floor(b.cols / 2);
      const rIdx = Math.floor(b.rows * 0.4);
      const wx = finalX + padX + cIdx * cellW + (cellW - winW) / 2;
      const wy = b.y + padY + rIdx * cellH + (cellH - winH) / 2;

      // Outer glow
      ctx.save();
      ctx.globalAlpha = layer.opacity * pulse;
      const glow = ctx.createRadialGradient(
        wx + winW / 2, wy + winH / 2, 0,
        wx + winW / 2, wy + winH / 2, winW * 4
      );
      glow.addColorStop(0, COLORS.goldGlow);
      glow.addColorStop(1, 'rgba(201, 162, 75, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(wx - winW * 4, wy - winW * 4, winW * 9, winW * 9);

      // The window itself
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(wx, wy, winW, winH);
      ctx.restore();
    });
  }

  function drawHorizonLine() {
    // A single warm-gold hairline along the horizon — the most architectural
    // detail in the composition. This is the move that elevates it.
    const horizonY = height * 0.96;
    ctx.save();
    ctx.strokeStyle = 'rgba(201, 162, 75, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(width, horizonY);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- Animation loop ----------
  let lastT = 0;

  function frame(t) {
    if (!running) return;
    requestAnimationFrame(frame);

    // Cap update rate to ~60fps even on 120Hz displays — saves significant
    // battery without any perceptible difference for this kind of animation.
    if (t - lastT < 16) return;
    lastT = t;

    drawBackground();
    drawStars(t);
    layers.forEach((layer) => drawLayer(layer, t));
    drawGoldGlints(t);
    drawHorizonLine();
  }

  // ---------- Visibility / lifecycle ----------
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  window.matchMedia('(prefers-reduced-motion: reduce)')
    .addEventListener('change', checkReducedMotion);

  // ---------- Boot ----------
  checkReducedMotion();
  resize();
  requestAnimationFrame(frame);
})();
