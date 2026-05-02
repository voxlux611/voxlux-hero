/**
 * VoxLux Strategic — Hero Flythrough
 * --------------------------------------------------------------------------
 * A tilted-aerial flythrough through a wireframe city in pure black + gold.
 *
 * What's happening:
 *   1. Buildings exist as 3D objects in world space (x, z = ground plane,
 *      y = up). The camera flies forward along +z at a controllable speed.
 *   2. Each frame, every building's eight corner points are projected from
 *      world space to 2D screen space with a tilted perspective camera.
 *   3. On load, buildings "draw themselves in" — their wireframe edges trace
 *      from base to top, and windows fade on, in a wave from far to near.
 *   4. After the build-in, the camera glides forward continuously. New
 *      buildings spawn at the far horizon as old ones pass under the camera.
 *   5. Mouse controls: cursor X tilts the camera (steering), cursor velocity
 *      accelerates flight, cursor position casts a warm gold light onto the
 *      nearest buildings.
 *
 * Brand tokens:
 *   Background          #000000  (pure black — no blue tint)
 *   Primary gold        #C9A24B  (the wireframe stroke)
 *   Bright gold         #E6C36E  (highlight edges, near buildings)
 *   Gold glow           rgba(201,162,75, 0.5)  (window pulses, cursor light)
 *   Bone (rare windows) #F5F1E8
 */

(function () {
  'use strict';

  // ============================================================
  // BRAND + CONFIG
  // ============================================================
  const COLORS = {
    bg:           '#000000',
    gold:         '#C9A24B',
    goldBright:   '#E6C36E',
    goldDim:      'rgba(201, 162, 75, 0.35)',
    goldGlow:     'rgba(201, 162, 75, 0.55)',
    bone:         '#F5F1E8',
    starDim:      'rgba(245, 241, 232, 0.45)'
  };

  // World/camera constants — these are the dials that shape the feel.
  const CONFIG = {
    // Camera
    cameraHeight:       180,    // how high above the ground plane
    cameraTilt:         0.35,   // pitch in radians (~20° looking down)
    fov:                520,    // focal length in pixels — bigger = flatter, smaller = wider angle
    farPlane:           2400,   // buildings beyond this aren't drawn
    nearPlane:          40,
    // Flight
    baseSpeed:          1.4,    // world-units per frame at rest
    maxSpeedBoost:      2.6,    // multiplier when cursor is moving fast
    // City layout
    streetWidth:        220,    // gap down the middle (the "street" we fly down)
    blockDepth:         360,    // distance between building rows
    buildingsPerRow:    5,      // per side
    rowsAhead:          14,     // how many rows of buildings exist at once
    // Construction
    buildInDuration:    3200,   // ms for the dramatic load-in
    // Interactivity smoothing
    tiltSmoothing:      0.06,   // lower = smoother/slower response
    speedSmoothing:     0.04,
    lightSmoothing:     0.10
  };

  // ============================================================
  // SETUP
  // ============================================================
  const canvas = document.getElementById('voxlux-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });

  let W = 0, H = 0, dpr = 1;
  let running = true;
  let reducedMotion = false;
  let startTime = performance.now();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function checkReducedMotion() {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ============================================================
  // INTERACTIVITY STATE
  // ============================================================
  // Cursor — normalized to [-1, 1] from center.
  const mouse = {
    x: 0, y: 0,           // current normalized position
    targetX: 0, targetY: 0,
    velocity: 0,          // smoothed cursor speed (0–1)
    targetVelocity: 0,
    rawX: 0, rawY: 0,     // raw pixel position (for the gold light)
    rawTargetX: -9999, rawTargetY: -9999,
    lastMoveTime: 0,
    inWindow: false
  };

  function onMove(e) {
    const x = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const y = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    // Detect speed: how far did the cursor move since last event?
    const now = performance.now();
    const dt = Math.max(1, now - mouse.lastMoveTime);
    const dx = x - mouse.rawTargetX;
    const dy = y - mouse.rawTargetY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    mouse.targetVelocity = Math.min(1, dist / dt * 0.6);
    mouse.lastMoveTime = now;

    mouse.targetX = (x / W) * 2 - 1;
    mouse.targetY = (y / H) * 2 - 1;
    mouse.rawTargetX = x;
    mouse.rawTargetY = y;
    mouse.inWindow = true;
  }
  function onLeave() {
    mouse.inWindow = false;
    mouse.targetX = 0;
    mouse.targetY = 0;
    mouse.targetVelocity = 0;
  }

  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('mouseleave', onLeave);
  document.addEventListener('mouseleave', onLeave);

  // ============================================================
  // CITY GENERATION
  // ============================================================
  // Each building has a footprint and height in world coordinates.
  // We pre-generate enough buildings to fill `rowsAhead` rows, then
  // recycle them as the camera flies past — infinite city, fixed memory.

  let buildings = [];
  let stars = [];

  function rng(seed) {
    // Deterministic per-building randomness. Avoids re-rolling each frame.
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function() {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function buildCity() {
    buildings = [];
    let id = 0;
    for (let row = 0; row < CONFIG.rowsAhead; row++) {
      for (let i = 0; i < CONFIG.buildingsPerRow; i++) {
        // Left side of street
        buildings.push(makeBuilding(id++, 'left', row, i));
        // Right side
        buildings.push(makeBuilding(id++, 'right', row, i));
      }
    }
  }

  function makeBuilding(id, side, row, idxInRow) {
    const r = rng(id * 13 + 7);

    // Footprint width (along x) and depth (along z) in world units
    const w = 70 + r() * 90;
    const d = 70 + r() * 90;

    // Height — varied to create skyline rhythm; some tall, most medium
    const heightRoll = r();
    let h;
    if (heightRoll < 0.08)      h = 320 + r() * 220;   // rare skyscraper
    else if (heightRoll < 0.30) h = 180 + r() * 120;   // tall
    else                        h = 80  + r() * 90;    // medium

    // Position along x (perpendicular to flight direction)
    // Each side of the street has multiple buildings stacked outward.
    const sideMul = side === 'left' ? -1 : 1;
    const xCenter = sideMul * (CONFIG.streetWidth / 2 + d / 2 + idxInRow * (90 + r() * 30));
    // Position along z (depth, flight axis)
    const zCenter = row * CONFIG.blockDepth + r() * 80 - CONFIG.blockDepth * 0.4;

    // Roof variation
    const roofRoll = r();
    let roof = 'flat';
    if (roofRoll > 0.85) roof = 'antenna';
    else if (roofRoll > 0.70) roof = 'stepped';

    // Window grid (sparse, regular — luxury reads as ordered)
    const cols = Math.max(2, Math.floor(d / 28));
    const floors = Math.max(3, Math.floor(h / 32));

    // Pick a few "lit" gold windows per building (deterministic)
    const lit = [];
    const litCount = Math.floor(cols * floors * (0.18 + r() * 0.14));
    for (let i = 0; i < litCount; i++) {
      lit.push({
        c: Math.floor(r() * cols),
        f: Math.floor(r() * floors),
        gold: r() > 0.30, // mostly gold, occasional bone
        phase: r() * Math.PI * 2,
        speed: 0.0006 + r() * 0.0010
      });
    }

    // Signature antenna height
    const antennaH = roof === 'antenna' ? 30 + r() * 40 : 0;

    return {
      id,
      side,
      row,
      // Footprint
      x: xCenter, z: zCenter,
      w, d, h,
      roof, antennaH,
      cols, floors,
      lit,
      // Per-building seed so its construction reveal timing is varied
      revealSeed: r()
    };
  }

  function buildStars() {
    stars = [];
    const count = Math.floor((W * H) / 5500);
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.5,
        r: Math.random() * 0.8 + 0.2,
        twinkle: Math.random() * Math.PI * 2,
        speed: 0.0008 + Math.random() * 0.002
      });
    }
  }

  // ============================================================
  // CAMERA / PROJECTION
  // ============================================================
  // World axes:
  //   +x = right, +y = up, +z = forward (camera flies in +z direction)
  //
  // Camera sits at (camOffsetX, cameraHeight, camZ), looking toward +z
  // tilted down by `cameraTilt` radians. We add a yaw based on mouse.x.

  let camZ = 0;             // distance flown so far along +z
  let camOffsetX = 0;       // smoothed lateral steering from mouse
  let camYaw = 0;           // smoothed yaw rotation from mouse
  let camPitchOffset = 0;   // smoothed extra pitch from mouse Y
  let currentSpeed = 0;     // smoothed flight speed
  let goldLight = { x: -9999, y: -9999, intensity: 0 };

  function projectPoint(wx, wy, wz) {
    // Translate to camera space
    let ex = wx - camOffsetX;
    let ey = wy - CONFIG.cameraHeight;
    let ez = wz - camZ;

    // Apply yaw (rotation around y axis) — steering left/right
    const cy = Math.cos(camYaw), sy = Math.sin(camYaw);
    const rx = ex * cy - ez * sy;
    const rz = ex * sy + ez * cy;
    ex = rx;
    ez = rz;

    // Apply pitch (rotation around x axis) — looking down/up
    const totalPitch = CONFIG.cameraTilt + camPitchOffset;
    const cp = Math.cos(totalPitch), sp = Math.sin(totalPitch);
    const ry = ey * cp - ez * sp;
    const rz2 = ey * sp + ez * cp;
    ey = ry;
    ez = rz2;

    // Behind the camera? Cull.
    if (ez < CONFIG.nearPlane) return null;

    // Perspective project
    const sx = (ex * CONFIG.fov / ez) + W / 2;
    const sy2 = -(ey * CONFIG.fov / ez) + H / 2;

    return { x: sx, y: sy2, z: ez };
  }

  // ============================================================
  // BUILDING DRAW
  // ============================================================
  function drawBuilding(b, t, buildProgress) {
    // Each building's z position in world space
    const bz = b.z;
    // Distance from camera along flight axis
    const distFromCam = bz - camZ;

    // Cull buildings behind us (with margin to prevent pop-out flicker)
    if (distFromCam < -CONFIG.blockDepth) {
      // Recycle: push this building far ahead
      b.z += CONFIG.rowsAhead * CONFIG.blockDepth;
      // Mark fully revealed (so it doesn't re-animate when recycled)
      b.recycled = true;
    }
    if (distFromCam > CONFIG.farPlane) return;

    // Per-building reveal progress during the load-in.
    // Wave from far buildings (reveal first) to near buildings (reveal last).
    let reveal = 1;
    if (!b.recycled && buildProgress < 1) {
      const distNorm = Math.min(1, Math.max(0, distFromCam / CONFIG.farPlane));
      // Far buildings start at progress 0, near start at progress 0.6
      const startOffset = (1 - distNorm) * 0.6;
      reveal = Math.max(0, Math.min(1, (buildProgress - startOffset) / 0.4));
      // Add per-building stagger so they don't all draw at the same instant
      reveal = Math.max(0, Math.min(1, reveal - b.revealSeed * 0.15 + 0.075));
    }
    if (reveal <= 0) return;

    // Eight corners of the box (in world coords)
    const x0 = b.x - b.w / 2;
    const x1 = b.x + b.w / 2;
    const z0 = b.z - b.d / 2;
    const z1 = b.z + b.d / 2;
    const y0 = 0;        // ground
    const y1 = b.h;      // roof

    // Project all 8 corners
    const c = [
      projectPoint(x0, y0, z0),
      projectPoint(x1, y0, z0),
      projectPoint(x1, y0, z1),
      projectPoint(x0, y0, z1),
      projectPoint(x0, y1, z0),
      projectPoint(x1, y1, z0),
      projectPoint(x1, y1, z1),
      projectPoint(x0, y1, z1)
    ];
    // If any corner is behind camera, skip (avoids weird stretched lines)
    for (let i = 0; i < 8; i++) if (!c[i]) return;

    // Distance fade — buildings fade in from far, brighten as they approach
    const distFade = Math.min(1, Math.max(0.15, 1 - distFromCam / CONFIG.farPlane));
    // Near boost — when buildings are close, edges brighten
    const nearBoost = distFromCam < 600 ? 1 + (1 - distFromCam / 600) * 0.6 : 1;

    // Gold light from cursor — affects buildings near where cursor points
    let cursorBoost = 0;
    if (goldLight.intensity > 0.05) {
      // Use the bottom-front-center of the building as proxy for distance
      const centerProj = c[2]; // front-bottom-right corner is fine as a proxy
      if (centerProj) {
        const ddx = centerProj.x - goldLight.x;
        const ddy = centerProj.y - goldLight.y;
        const dist2D = Math.sqrt(ddx*ddx + ddy*ddy);
        cursorBoost = Math.max(0, 1 - dist2D / 320) * goldLight.intensity;
      }
    }

    // ---- Fill silhouette (subtle, deepens when near) ----
    // A faint warm fill makes the wireframe read as "solid building" instead of
    // floating lines. Black+almost-black, never lighter than ~5% gold.
    ctx.save();
    ctx.globalAlpha = reveal * (0.08 + nearBoost * 0.04 + cursorBoost * 0.12);
    ctx.fillStyle = COLORS.gold;
    ctx.beginPath();
    // Front face (the one facing the camera)
    ctx.moveTo(c[2].x, c[2].y);
    ctx.lineTo(c[3].x, c[3].y);
    ctx.lineTo(c[7].x, c[7].y);
    ctx.lineTo(c[6].x, c[6].y);
    ctx.closePath();
    ctx.fill();
    // Side face
    if (b.side === 'left') {
      ctx.beginPath();
      ctx.moveTo(c[1].x, c[1].y);
      ctx.lineTo(c[2].x, c[2].y);
      ctx.lineTo(c[6].x, c[6].y);
      ctx.lineTo(c[5].x, c[5].y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(c[0].x, c[0].y);
      ctx.lineTo(c[3].x, c[3].y);
      ctx.lineTo(c[7].x, c[7].y);
      ctx.lineTo(c[4].x, c[4].y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // ---- Wireframe edges ----
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const edgeAlpha = reveal * distFade * (0.6 + cursorBoost * 0.5);
    ctx.globalAlpha = Math.min(1, edgeAlpha);
    ctx.strokeStyle = cursorBoost > 0.3 ? COLORS.goldBright : COLORS.gold;
    ctx.lineWidth = 1 + nearBoost * 0.3 + cursorBoost * 0.6;

    // Verticals (4)
    drawEdgeProgressive(c[0], c[4], reveal, 0.0);
    drawEdgeProgressive(c[1], c[5], reveal, 0.05);
    drawEdgeProgressive(c[2], c[6], reveal, 0.10);
    drawEdgeProgressive(c[3], c[7], reveal, 0.15);
    // Top edges (4) — these draw last in the construction
    drawEdgeProgressive(c[4], c[5], reveal, 0.55);
    drawEdgeProgressive(c[5], c[6], reveal, 0.60);
    drawEdgeProgressive(c[6], c[7], reveal, 0.65);
    drawEdgeProgressive(c[7], c[4], reveal, 0.70);
    // Bottom edges (4) — drawn first, very dim
    ctx.globalAlpha *= 0.5;
    drawEdgeProgressive(c[0], c[1], reveal, 0.0);
    drawEdgeProgressive(c[1], c[2], reveal, 0.0);
    drawEdgeProgressive(c[2], c[3], reveal, 0.0);
    drawEdgeProgressive(c[3], c[0], reveal, 0.0);
    ctx.restore();

    // Antenna mast
    if (b.roof === 'antenna' && reveal > 0.7) {
      const mastBase = projectPoint(b.x, b.h, b.z);
      const mastTop  = projectPoint(b.x, b.h + b.antennaH, b.z);
      if (mastBase && mastTop) {
        ctx.save();
        ctx.globalAlpha = reveal * distFade;
        ctx.strokeStyle = COLORS.goldBright;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(mastBase.x, mastBase.y);
        ctx.lineTo(mastTop.x, mastTop.y);
        ctx.stroke();
        // Tip glow
        ctx.fillStyle = COLORS.goldGlow;
        ctx.beginPath();
        ctx.arc(mastTop.x, mastTop.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // ---- Windows (the "lit city" detail) ----
    if (reveal > 0.65) {
      const winReveal = (reveal - 0.65) / 0.35;
      drawWindows(b, c, winReveal, distFade, t, cursorBoost);
    }
  }

  function drawEdgeProgressive(p1, p2, reveal, startAt) {
    // During load-in, edges trace from p1 to p2 progressively.
    // After load-in (reveal == 1), edges are drawn fully every frame.
    if (reveal >= 1) {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      return;
    }
    const localReveal = Math.max(0, Math.min(1, (reveal - startAt) / (1 - startAt)));
    if (localReveal <= 0) return;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(
      p1.x + (p2.x - p1.x) * localReveal,
      p1.y + (p2.y - p1.y) * localReveal
    );
    ctx.stroke();
  }

  function drawWindows(b, c, winReveal, distFade, t, cursorBoost) {
    // Front face quadrilateral: c[3] (bottom-front-left), c[2] (bottom-front-right),
    // c[6] (top-front-right), c[7] (top-front-left)
    // We grid windows in screen space across this quad.
    const cols = b.cols;
    const floors = b.floors;
    const padX = 0.15, padY = 0.10;

    for (let f = 0; f < floors; f++) {
      for (let col = 0; col < cols; col++) {
        const u = padX + ((col + 0.5) / cols) * (1 - 2 * padX);
        const v = padY + ((f + 0.5) / floors) * (1 - 2 * padY);
        // Bilinear interpolation across the front face quad
        const bottomX = c[3].x + (c[2].x - c[3].x) * u;
        const bottomY = c[3].y + (c[2].y - c[3].y) * u;
        const topX    = c[7].x + (c[6].x - c[7].x) * u;
        const topY    = c[7].y + (c[6].y - c[7].y) * u;
        const wx = bottomX + (topX - bottomX) * v;
        const wy = bottomY + (topY - bottomY) * v;

        // Window size scales with building screen size
        const refW = Math.abs(c[2].x - c[3].x) / cols * 0.45;
        const refH = Math.abs(c[6].y - c[2].y) / floors * 0.50;
        const ww = Math.max(0.8, refW);
        const wh = Math.max(0.8, refH);

        // Is this window "lit" (gold/bone) or just a faint dim square?
        const litMatch = b.lit.find(l => l.c === col && l.f === f);
        if (litMatch) {
          const pulse = 0.7 + 0.3 * Math.sin(litMatch.phase + t * litMatch.speed);
          ctx.save();
          ctx.globalAlpha = winReveal * distFade * pulse * (0.85 + cursorBoost * 0.4);
          ctx.fillStyle = litMatch.gold ? COLORS.gold : COLORS.bone;
          ctx.fillRect(wx - ww/2, wy - wh/2, ww, wh);
          ctx.restore();
        } else {
          // Faint unlit window — barely visible, adds texture
          ctx.save();
          ctx.globalAlpha = winReveal * distFade * 0.18;
          ctx.fillStyle = COLORS.goldDim;
          ctx.fillRect(wx - ww/2, wy - wh/2, ww, wh);
          ctx.restore();
        }
      }
    }
  }

  // ============================================================
  // ATMOSPHERIC OVERLAYS
  // ============================================================
  function drawSky(t) {
    // Pure black with a subtle warm glow at the horizon.
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // Horizon glow — very subtle, pulled below center because of camera tilt
    const horizonY = H * 0.55;
    const grad = ctx.createRadialGradient(W/2, horizonY, 0, W/2, horizonY, W * 0.65);
    grad.addColorStop(0, 'rgba(201, 162, 75, 0.10)');
    grad.addColorStop(0.5, 'rgba(201, 162, 75, 0.025)');
    grad.addColorStop(1, 'rgba(201, 162, 75, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawStars(t) {
    stars.forEach(s => {
      const tw = 0.5 + Math.sin(s.twinkle + t * s.speed) * 0.5;
      ctx.fillStyle = `rgba(245, 241, 232, ${0.30 * tw})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawGroundPlane() {
    // A subtle grid on the ground — sells the perspective hard.
    // We draw lines at fixed z-intervals receding into the distance.
    ctx.save();
    ctx.strokeStyle = COLORS.goldDim;
    ctx.lineWidth = 0.6;

    // Lines perpendicular to flight (cross-streets)
    const stepZ = 120;
    const startZ = camZ - (camZ % stepZ);
    for (let z = startZ; z < camZ + CONFIG.farPlane; z += stepZ) {
      const left  = projectPoint(-1400, 0, z);
      const right = projectPoint( 1400, 0, z);
      if (!left || !right) continue;
      const dist = z - camZ;
      const fade = Math.max(0, 1 - dist / CONFIG.farPlane) * 0.4;
      ctx.globalAlpha = fade;
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
    }

    // Lines along flight (the street lines)
    ctx.globalAlpha = 0.35;
    for (let lx = -CONFIG.streetWidth/2; lx <= CONFIG.streetWidth/2; lx += CONFIG.streetWidth) {
      const near = projectPoint(lx, 0, camZ + 40);
      const far  = projectPoint(lx, 0, camZ + CONFIG.farPlane * 0.8);
      if (!near || !far) continue;
      ctx.beginPath();
      ctx.moveTo(near.x, near.y);
      ctx.lineTo(far.x, far.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCursorLight() {
    // Soft warm radial that follows the cursor.
    if (goldLight.intensity < 0.05) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const r = 220;
    const grad = ctx.createRadialGradient(goldLight.x, goldLight.y, 0, goldLight.x, goldLight.y, r);
    grad.addColorStop(0, `rgba(230, 195, 110, ${0.22 * goldLight.intensity})`);
    grad.addColorStop(0.5, `rgba(201, 162, 75, ${0.10 * goldLight.intensity})`);
    grad.addColorStop(1, 'rgba(201, 162, 75, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(goldLight.x - r, goldLight.y - r, r * 2, r * 2);
    ctx.restore();
  }

  function drawVignette() {
    // Dark frame around the edges to keep eye on center.
    const grad = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.4, W/2, H/2, Math.max(W,H)*0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // ============================================================
  // ANIMATION LOOP
  // ============================================================
  let lastT = 0;

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    if (now - lastT < 16) return;
    lastT = now;

    const elapsed = now - startTime;
    const buildProgress = reducedMotion ? 1 : Math.min(1, elapsed / CONFIG.buildInDuration);

    // ---- Update interactivity (smoothed) ----
    // Decay cursor velocity so it eases back to zero when mouse stops
    mouse.targetVelocity *= 0.92;
    mouse.velocity += (mouse.targetVelocity - mouse.velocity) * CONFIG.speedSmoothing;
    mouse.x += (mouse.targetX - mouse.x) * CONFIG.tiltSmoothing;
    mouse.y += (mouse.targetY - mouse.y) * CONFIG.tiltSmoothing;

    // Camera lateral steering & yaw from mouse X
    camOffsetX = mouse.x * 60;        // shift sideways subtly
    camYaw = mouse.x * 0.12;          // turn the camera ~7° max
    camPitchOffset = mouse.y * 0.06;  // tilt up/down ~3.5° max

    // Speed: base + boost from cursor velocity
    const targetSpeed = reducedMotion
      ? 0
      : CONFIG.baseSpeed * (1 + mouse.velocity * (CONFIG.maxSpeedBoost - 1));
    currentSpeed += (targetSpeed - currentSpeed) * 0.05;

    // Hold camera still during the dramatic load-in for the first ~1.5s,
    // then ramp speed up as the city finishes building.
    let speedScale = 1;
    if (buildProgress < 0.5) speedScale = 0;
    else if (buildProgress < 0.85) speedScale = (buildProgress - 0.5) / 0.35;
    camZ += currentSpeed * speedScale;

    // Cursor light position smoothing
    if (mouse.inWindow) {
      goldLight.x += (mouse.rawTargetX - goldLight.x) * CONFIG.lightSmoothing;
      goldLight.y += (mouse.rawTargetY - goldLight.y) * CONFIG.lightSmoothing;
      goldLight.intensity += (1 - goldLight.intensity) * 0.05;
    } else {
      goldLight.intensity += (0 - goldLight.intensity) * 0.03;
    }

    // ---- Render ----
    drawSky(now);
    drawStars(now);
    drawGroundPlane();

    // Sort buildings back-to-front for proper overdraw of the warm fills
    buildings.sort((a, b) => (b.z - camZ) - (a.z - camZ));
    for (let i = 0; i < buildings.length; i++) {
      drawBuilding(buildings[i], now, buildProgress);
    }

    drawCursorLight();
    drawVignette();
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      lastT = 0;
      requestAnimationFrame(frame);
    }
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      buildStars();
    }, 120);
  });

  window.matchMedia('(prefers-reduced-motion: reduce)')
    .addEventListener('change', checkReducedMotion);

  // ---- Boot ----
  checkReducedMotion();
  resize();
  buildCity();
  buildStars();
  startTime = performance.now();
  requestAnimationFrame(frame);
})();
