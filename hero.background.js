(() => {
  const canvas = document.getElementById("hero-canvas");
  const ctx = canvas.getContext("2d");

  let width = 0;
  let height = 0;
  let centerX = 0;
  let horizonY = 0;

  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const COLORS = {
    bgTop: "#050505",
    bgBottom: "#000000",
    gold: "214,175,101",
    white: "255,255,255",
    black: "8,8,8"
  };

  const SETTINGS = {
    speed: 1.25,
    roadWidthNear: 420,
    roadWidthFar: 28,
    buildingRows: 18,
    sideSpread: 760,
    minHeight: 80,
    maxHeight: 420,
    minWidth: 40,
    maxWidth: 130,
    nearZ: 0.2,
    farZ: 1.0
  };

  let buildings = [];
  let last = performance.now();

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;

    canvas.width = Math.floor(width * DPR);
    canvas.height = Math.floor(height * DPR);
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    centerX = width / 2;
    horizonY = height * 0.34;

    generateBuildings();
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function generateBuildings() {
    buildings = [];

    for (let i = 0; i < SETTINGS.buildingRows; i++) {
      const z = SETTINGS.nearZ + (i / SETTINGS.buildingRows) * (SETTINGS.farZ - SETTINGS.nearZ);

      const leftCount = 2 + Math.floor(Math.random() * 3);
      const rightCount = 2 + Math.floor(Math.random() * 3);

      for (let j = 0; j < leftCount; j++) {
        buildings.push(makeBuilding("left", z + rand(-0.015, 0.015)));
      }

      for (let j = 0; j < rightCount; j++) {
        buildings.push(makeBuilding("right", z + rand(-0.015, 0.015)));
      }
    }
  }

  function makeBuilding(side, z) {
    const width3d = rand(50, 150);
    const depth = rand(30, 90);
    const height3d = rand(90, 380);

    let xBase;
    if (side === "left") {
      xBase = -rand(120, SETTINGS.sideSpread);
    } else {
      xBase = rand(120, SETTINGS.sideSpread);
    }

    return {
      side,
      x: xBase,
      z,
      width: width3d,
      depth,
      height: height3d,
      glow: rand(0.18, 0.42),
      whiteEdge: Math.random() > 0.65
    };
  }

  function projectX(x, z) {
    const scale = 1 / z;
    return centerX + x * scale;
  }

  function projectY(y, z) {
    const scale = 1 / z;
    return horizonY + y * scale;
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, COLORS.bgTop);
    grad.addColorStop(0.55, "#030303");
    grad.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(
      centerX,
      horizonY + 20,
      0,
      centerX,
      horizonY + 20,
      width * 0.7
    );
    glow.addColorStop(0, `rgba(${COLORS.gold},0.12)`);
    glow.addColorStop(0.35, `rgba(${COLORS.gold},0.06)`);
    glow.addColorStop(1, `rgba(${COLORS.gold},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  function drawRoad() {
    const leftNear = centerX - SETTINGS.roadWidthNear;
    const rightNear = centerX + SETTINGS.roadWidthNear;
    const leftFar = centerX - SETTINGS.roadWidthFar;
    const rightFar = centerX + SETTINGS.roadWidthFar;

    ctx.beginPath();
    ctx.moveTo(leftFar, horizonY);
    ctx.lineTo(rightFar, horizonY);
    ctx.lineTo(rightNear, height);
    ctx.lineTo(leftNear, height);
    ctx.closePath();

    const roadGrad = ctx.createLinearGradient(0, horizonY, 0, height);
    roadGrad.addColorStop(0, "rgba(12,12,12,0.0)");
    roadGrad.addColorStop(0.2, "rgba(10,10,10,0.75)");
    roadGrad.addColorStop(1, "rgba(0,0,0,1)");
    ctx.fillStyle = roadGrad;
    ctx.fill();

    ctx.strokeStyle = `rgba(${COLORS.gold},0.28)`;
    ctx.lineWidth = 1.2;
    ctx.shadowBlur = 18;
    ctx.shadowColor = `rgba(${COLORS.gold},0.24)`;

    ctx.beginPath();
    ctx.moveTo(leftFar, horizonY);
    ctx.lineTo(leftNear, height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(rightFar, horizonY);
    ctx.lineTo(rightNear, height);
    ctx.stroke();

    ctx.shadowBlur = 0;
  }

  function drawBuilding(b) {
    const zFront = b.z;
    const zBack = b.z + 0.08;

    const x1 = projectX(b.x, zFront);
    const x2 = projectX(b.x + (b.side === "left" ? b.width : -b.width), zFront);
    const x3 = projectX(b.x + (b.side === "left" ? b.width : -b.width), zBack);
    const x4 = projectX(b.x, zBack);

    const yBottomFront = projectY(240, zFront);
    const yBottomBack = projectY(240, zBack);

    const yTopFront = projectY(240 - b.height, zFront);
    const yTopBack = projectY(240 - b.height, zBack);

    const minX = Math.min(x1, x2, x3, x4);
    const maxX = Math.max(x1, x2, x3, x4);

    if (maxX < -200 || minX > width + 200) return;

    ctx.beginPath();
    ctx.moveTo(x1, yBottomFront);
    ctx.lineTo(x4, yBottomBack);
    ctx.lineTo(x4, yTopBack);
    ctx.lineTo(x1, yTopFront);
    ctx.closePath();

    ctx.fillStyle = "rgba(10,10,10,0.96)";
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(x1, yBottomFront);
    ctx.lineTo(x2, yBottomFront);
    ctx.lineTo(x2, yTopFront);
    ctx.lineTo(x1, yTopFront);
    ctx.closePath();

    const faceGrad = ctx.createLinearGradient(x1, yTopFront, x2, yBottomFront);
    faceGrad.addColorStop(0, "rgba(16,16,16,0.98)");
    faceGrad.addColorStop(1, "rgba(6,6,6,0.98)");
    ctx.fillStyle = faceGrad;
    ctx.fill();

    ctx.strokeStyle = b.whiteEdge
      ? `rgba(${COLORS.white},0.18)`
      : `rgba(${COLORS.gold},${0.26 + b.glow})`;

    ctx.lineWidth = Math.max(1, 2.2 / zFront);
    ctx.shadowBlur = 18;
    ctx.shadowColor = b.whiteEdge
      ? `rgba(${COLORS.white},0.12)`
      : `rgba(${COLORS.gold},0.32)`;

    ctx.beginPath();
    ctx.moveTo(x1, yTopFront);
    ctx.lineTo(x1, yBottomFront);
    ctx.lineTo(x4, yBottomBack);
    ctx.lineTo(x4, yTopBack);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x1, yTopFront);
    ctx.lineTo(x2, yTopFront);
    ctx.lineTo(x2, yBottomFront);
    ctx.stroke();

    ctx.shadowBlur = 0;

    drawWindows(x1, x2, yTopFront, yBottomFront, zFront);
  }

  function drawWindows(left, right, top, bottom, z) {
    const w = Math.abs(right - left);
    const h = Math.abs(bottom - top);

    if (w < 25 || h < 80) return;

    const cols = Math.max(2, Math.floor(w / 22));
    const rows = Math.max(3, Math.floor(h / 30));

    const windowW = w / cols;
    const windowH = h / rows;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (Math.random() > 0.42) continue;

        const x = Math.min(left, right) + c * windowW + windowW * 0.22;
        const y = top + r * windowH + windowH * 0.2;
        const ww = windowW * 0.42;
        const wh = windowH * 0.32;

        const goldWindow = Math.random() > 0.25;

        ctx.fillStyle = goldWindow
          ? `rgba(${COLORS.gold},0.14)`
          : `rgba(${COLORS.white},0.08)`;

        ctx.shadowBlur = goldWindow ? 10 : 6;
        ctx.shadowColor = goldWindow
          ? `rgba(${COLORS.gold},0.25)`
          : `rgba(${COLORS.white},0.14)`;

        ctx.fillRect(x, y, ww, wh);
      }
    }

    ctx.shadowBlur = 0;
  }

  function drawCenterGlow() {
    const glow = ctx.createLinearGradient(0, horizonY - 60, 0, height);
    glow.addColorStop(0, `rgba(${COLORS.gold},0.00)`);
    glow.addColorStop(0.35, `rgba(${COLORS.gold},0.04)`);
    glow.addColorStop(1, `rgba(${COLORS.gold},0.00)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const vignette = ctx.createRadialGradient(
      centerX,
      height * 0.55,
      height * 0.1,
      centerX,
      height * 0.55,
      height * 0.9
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
  }

  function update(dt) {
    for (const b of buildings) {
      b.z -= 0.0032 * SETTINGS.speed * dt;

      if (b.z <= SETTINGS.nearZ) {
        b.z = SETTINGS.farZ + rand(0.03, 0.12);
        b.height = rand(SETTINGS.minHeight, SETTINGS.maxHeight);
        b.width = rand(SETTINGS.minWidth, SETTINGS.maxWidth);
        b.glow = rand(0.18, 0.42);
        b.whiteEdge = Math.random() > 0.65;

        if (b.side === "left") {
          b.x = -rand(120, SETTINGS.sideSpread);
        } else {
          b.x = rand(120, SETTINGS.sideSpread);
        }
      }
    }
  }

  function render() {
    ctx.clearRect(0, 0, width, height);

    drawBackground();
    drawRoad();

    buildings.sort((a, b) => b.z - a.z);
    for (const building of buildings) {
      drawBuilding(building);
    }

    drawCenterGlow();
  }

  function animate(now) {
    const dt = Math.min(2.2, (now - last) / 16.6667);
    last = now;

    update(dt);
    render();

    requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(animate);
})();
