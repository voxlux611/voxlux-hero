(() => {
  const canvas = document.getElementById("hero-canvas");
  const ctx = canvas.getContext("2d", { alpha: true });

  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  let width = 0;
  let height = 0;
  let centerX = 0;
  let horizonY = 0;
  let fov = 0;

  const world = {
    near: 4.5,
    far: 180,
    ground: 11.5,
    streetHalf: 14,
    speed: 0.48,
    buildingCount: 80,
    particleCount: 42,
  };

  let buildings = [];
  let particles = [];
  let skyline = [];
  let lastTime = performance.now();

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpPoint(a, b, t) {
    return {
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
    };
  }

  function quadPoint(p1, p2, p3, p4, u, v) {
    const bottom = lerpPoint(p1, p2, u);
    const top = lerpPoint(p4, p3, u);
    return lerpPoint(bottom, top, v);
  }

  function fract(n) {
    return n - Math.floor(n);
  }

  function hash(n) {
    return fract(Math.sin(n) * 43758.5453123);
  }

  function rgba(r, g, b, a) {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();

    width = Math.max(320, Math.floor(rect.width || window.innerWidth));
    height = Math.max(320, Math.floor(rect.height || window.innerHeight));

    canvas.width = Math.floor(width * DPR);
    canvas.height = Math.floor(height * DPR);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    centerX = width / 2;
    horizonY = height * 0.355;
    fov = Math.max(720, Math.min(width, height) * 1.22);

    world.streetHalf = 11 + width / 360;

    buildSkyline();
    buildScene();
  }

  function buildSkyline() {
    skyline = [];
    let x = -60;

    while (x < width + 100) {
      const w = rand(24, 88);
      skyline.push({
        x,
        w,
        h: rand(height * 0.05, height * 0.2),
      });
      x += w + rand(8, 24);
    }
  }

  function makeBuilding(zValue, sideOverride = null) {
    const side = sideOverride ?? (Math.random() < 0.5 ? -1 : 1);
    const depth = rand(8, 20);
    const heightValue = rand(22, 72);
    const thickness = rand(3.5, 9.5);
    const facadeX = side * (world.streetHalf + rand(0.2, 1.7));
    const outerX = side * (Math.abs(facadeX) + thickness);

    return {
      side,
      z: zValue ?? rand(8, world.far),
      depth,
      height: heightValue,
      facadeX,
      outerX,
      seed: Math.random() * 1000,
      shimmer: rand(0.75, 1.4),
      edgeAlpha: rand(0.3, 0.72),
    };
  }

  function makeParticle(zValue) {
    return {
      x: rand(-world.streetHalf * 2.8, world.streetHalf * 2.8),
      y: rand(-2.5, world.ground + 1.5),
      z: zValue ?? rand(8, world.far),
      r: rand(0.8, 2.2),
      alpha: rand(0.02, 0.09),
      warm: Math.random() < 0.72,
    };
  }

  function buildScene() {
    buildings = [];
    particles = [];

    for (let i = 0; i < world.buildingCount; i++) {
      const z = 8 + (i / world.buildingCount) * (world.far - 8) + rand(-2, 2);
      const side = i % 2 === 0 ? -1 : 1;
      buildings.push(makeBuilding(z, side));
    }

    for (let i = 0; i < world.particleCount; i++) {
      particles.push(makeParticle(rand(8, world.far)));
    }
  }

  function project(x, y, z) {
    const safeZ = Math.max(0.1, z);
    const scale = fov / safeZ;
    return {
      x: centerX + x * scale,
      y: horizonY + y * scale,
      scale,
    };
  }

  function drawPolygon(points, fillStyle, strokeStyle = null, lineWidth = 1, shadowBlur = 0, shadowColor = "transparent") {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();

    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }

    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle;
      ctx.lineWidth = lineWidth;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowColor = shadowColor;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawBackdrop() {
    const skyGlow = ctx.createLinearGradient(0, 0, 0, height);
    skyGlow.addColorStop(0, rgba(255, 255, 255, 0.018));
    skyGlow.addColorStop(0.35, rgba(214, 175, 101, 0.02));
    skyGlow.addColorStop(1, rgba(0, 0, 0, 0));
    ctx.fillStyle = skyGlow;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    for (const block of skyline) {
      const y = horizonY + 8 - block.h;
      ctx.fillStyle = rgba(8, 8, 8, 0.95);
      ctx.fillRect(block.x, y, block.w, block.h);

      ctx.strokeStyle = rgba(214, 175, 101, 0.12);
      ctx.lineWidth = 1;
      ctx.shadowBlur = 10;
      ctx.shadowColor = rgba(214, 175, 101, 0.15);
      ctx.beginPath();
      ctx.moveTo(block.x, y);
      ctx.lineTo(block.x + block.w, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    const haze = ctx.createLinearGradient(0, horizonY - 50, 0, horizonY + 120);
    haze.addColorStop(0, rgba(214, 175, 101, 0.03));
    haze.addColorStop(1, rgba(214, 175, 101, 0));
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizonY - 50, width, 170);
    ctx.restore();
  }

  function drawStreet() {
    const zNear = 7;
    const zFar = world.far;

    const leftNear = project(-world.streetHalf, world.ground, zNear);
    const rightNear = project(world.streetHalf, world.ground, zNear);
    const leftFar = project(-world.streetHalf, world.ground, zFar);
    const rightFar = project(world.streetHalf, world.ground, zFar);

    const roadGradient = ctx.createLinearGradient(0, horizonY, 0, height);
    roadGradient.addColorStop(0, rgba(0, 0, 0, 0));
    roadGradient.addColorStop(0.42, rgba(8, 8, 8, 0.65));
    roadGradient.addColorStop(1, rgba(0, 0, 0, 0.98));

    drawPolygon(
      [leftFar, rightFar, rightNear, leftNear],
      roadGradient
    );

    ctx.save();
    ctx.strokeStyle = rgba(214, 175, 101, 0.22);
    ctx.lineWidth = 1.3;
    ctx.shadowBlur = 16;
    ctx.shadowColor = rgba(214, 175, 101, 0.18);

    ctx.beginPath();
    ctx.moveTo(leftFar.x, leftFar.y);
    ctx.lineTo(leftNear.x, leftNear.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightFar.x, rightFar.y);
    ctx.lineTo(rightNear.x, rightNear.y);
    ctx.stroke();
    ctx.restore();

    const reflectionGradient = ctx.createLinearGradient(0, horizonY, 0, height);
    reflectionGradient.addColorStop(0, rgba(214, 175, 101, 0));
    reflectionGradient.addColorStop(0.6, rgba(214, 175, 101, 0.045));
    reflectionGradient.addColorStop(1, rgba(255, 255, 255, 0.015));

    const innerNearLeft = project(-world.streetHalf * 0.38, world.ground, zNear + 1);
    const innerNearRight = project(world.streetHalf * 0.38, world.ground, zNear + 1);
    const innerFarLeft = project(-world.streetHalf * 0.07, world.ground, zFar);
    const innerFarRight = project(world.streetHalf * 0.07, world.ground, zFar);

    drawPolygon(
      [innerFarLeft, innerFarRight, innerNearRight, innerNearLeft],
      reflectionGradient
    );
  }

  function drawBuilding(building, time) {
    const zFront = building.z;
    const zBack = building.z + building.depth;

    if (zBack <= world.near) return;

    const p1 = project(building.facadeX, world.ground, zFront);
    const p2 = project(building.facadeX, world.ground, zBack);
    const p3 = project(building.facadeX, world.ground - building.height, zBack);
    const p4 = project(building.facadeX, world.ground - building.height, zFront);

    const front1 = project(building.facadeX, world.ground, zFront);
    const front2 = project(building.outerX, world.ground, zFront);
    const front3 = project(building.outerX, world.ground - building.height, zFront);
    const front4 = project(building.facadeX, world.ground - building.height, zFront);

    const roof1 = project(building.facadeX, world.ground - building.height, zFront);
    const roof2 = project(building.outerX, world.ground - building.height, zFront);
    const roof3 = project(building.outerX, world.ground - building.height, zBack);
    const roof4 = project(building.facadeX, world.ground - building.height, zBack);

    const visibleHeight = Math.abs(p4.y - p1.y);
    const visibleDepth = Math.hypot(p2.x - p1.x, p2.y - p1.y);

    if (
      Math.max(p1.x, p2.x, p3.x, p4.x, front2.x, front3.x) < -150 ||
      Math.min(p1.x, p2.x, p3.x, p4.x, front2.x, front3.x) > width + 150
    ) {
      return;
    }

    const edgeAlpha = Math.min(0.7, 0.08 + building.edgeAlpha * Math.min(1, p1.scale / 42));
    const lineWidth = Math.max(1, Math.min(2.8, p1.scale * 0.045));
    const blur = Math.max(6, Math.min(24, p1.scale * 0.18));

    drawPolygon(
      [p1, p2, p3, p4],
      rgba(8, 8, 8, 0.86),
      rgba(214, 175, 101, edgeAlpha),
      lineWidth,
      blur,
      rgba(214, 175, 101, 0.2)
    );

    drawPolygon(
      [front1, front2, front3, front4],
      rgba(10, 10, 10, 0.95),
      rgba(255, 255, 255, 0.05),
      1,
      0,
      "transparent"
    );

    drawPolygon(
      [roof1, roof2, roof3, roof4],
      rgba(15, 15, 15, 0.32),
      rgba(214, 175, 101, 0.08),
      1,
      0,
      "transparent"
    );

    ctx.save();
    ctx.strokeStyle = rgba(255, 255, 255, 0.06);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p4.x, p4.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.stroke();
    ctx.restore();

    if (visibleHeight > 48 && visibleDepth > 36) {
      drawWindows(building, p1, p2, p3, p4, time);
    }
  }

  function drawWindows(building, p1, p2, p3, p4, time) {
    const depthPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const heightPx = Math.hypot(p4.x - p1.x, p4.y - p1.y);

    const cols = Math.max(2, Math.min(7, Math.floor(depthPx / 24)));
    const rows = Math.max(4, Math.min(11, Math.floor(heightPx / 22)));

    ctx.save();

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const lit = hash(building.seed + c * 17.31 + r * 9.13) > 0.34;
        if (!lit) continue;

        const u0 = c / cols;
        const u1 = (c + 1) / cols;
        const v0 = r / rows;
        const v1 = (r + 1) / rows;

        const padU = 0.18 / cols;
        const padTop = 0.24 / rows;
        const padBottom = 0.46 / rows;

        const a = quadPoint(p1, p2, p3, p4, u0 + padU, v0 + padTop);
        const b = quadPoint(p1, p2, p3, p4, u1 - padU, v0 + padTop);
        const cpt = quadPoint(p1, p2, p3, p4, u1 - padU, v1 - padBottom);
        const d = quadPoint(p1, p2, p3, p4, u0 + padU, v1 - padBottom);

        const pulse = 0.78 + 0.22 * Math.sin(time * (0.9 + building.shimmer * 0.18) + c * 0.9 + r * 0.6 + building.seed);
        const warm = hash(building.seed + c * 3.9 + r * 1.7) > 0.18;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(cpt.x, cpt.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();

        if (warm) {
          ctx.fillStyle = rgba(214, 175, 101, 0.11 * pulse);
          ctx.shadowBlur = 8;
          ctx.shadowColor = rgba(214, 175, 101, 0.22);
        } else {
          ctx.fillStyle = rgba(255, 255, 255, 0.06 * pulse);
          ctx.shadowBlur = 6;
          ctx.shadowColor = rgba(255, 255, 255, 0.12);
        }

        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    for (const particle of particles) {
      if (particle.z <= world.near || particle.z >= world.far) continue;

      const p = project(particle.x, particle.y, particle.z);
      const radius = Math.max(0.35, Math.min(2.3, particle.r * (p.scale / 80)));

      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);

      if (particle.warm) {
        ctx.fillStyle = rgba(214, 175, 101, particle.alpha);
        ctx.shadowBlur = 10;
        ctx.shadowColor = rgba(214, 175, 101, 0.18);
      } else {
        ctx.fillStyle = rgba(255, 255, 255, particle.alpha);
        ctx.shadowBlur = 8;
        ctx.shadowColor = rgba(255, 255, 255, 0.12);
      }

      ctx.fill();
    }
    ctx.restore();
  }

  function update(delta) {
    for (const building of buildings) {
      building.z -= world.speed * delta * 1.8;

      if (building.z + building.depth < world.near) {
        const farthest = buildings.reduce(
          (max, current) => Math.max(max, current.z + current.depth),
          world.far
        );
        Object.assign(
          building,
          makeBuilding(farthest + rand(6, 16), Math.random() < 0.5 ? -1 : 1)
        );
      }
    }

    for (const particle of particles) {
      particle.z -= world.speed * delta * 0.8;

      if (particle.z < world.near) {
        Object.assign(particle, makeParticle(world.far + rand(4, 18)));
      }
    }
  }

  function render(time) {
    ctx.clearRect(0, 0, width, height);

    drawBackdrop();
    drawStreet();

    buildings.sort((a, b) => b.z - a.z);
    for (const building of buildings) {
      drawBuilding(building, time);
    }

    drawParticles();

    const glow = ctx.createRadialGradient(
      centerX,
      horizonY + height * 0.05,
      0,
      centerX,
      horizonY + height * 0.05,
      height * 0.8
    );
    glow.addColorStop(0, rgba(214, 175, 101, 0.04));
    glow.addColorStop(0.55, rgba(214, 175, 101, 0.012));
    glow.addColorStop(1, rgba(214, 175, 101, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  function animate(now) {
    const delta = Math.min(2.2, (now - lastTime) / 16.6667);
    lastTime = now;

    update(delta);
    render(now * 0.001);

    requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize);

  resize();
  requestAnimationFrame(animate);
})();
