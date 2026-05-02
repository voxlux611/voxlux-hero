class VoxluxHero extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._raf = null;
    this._cleanup = [];
    this._reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
        }

        .hero {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background:
            radial-gradient(ellipse at 50% 24%, #151a21 0%, #0b0d12 48%, #050608 100%);
        }

        .stars {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          opacity: 0.35;
          background-image:
            radial-gradient(1px 1px at 12% 16%, rgba(245,241,232,0.22), transparent),
            radial-gradient(1px 1px at 28% 10%, rgba(245,241,232,0.18), transparent),
            radial-gradient(1px 1px at 41% 18%, rgba(201,162,75,0.18), transparent),
            radial-gradient(1px 1px at 58% 12%, rgba(245,241,232,0.18), transparent),
            radial-gradient(1px 1px at 73% 9%, rgba(245,241,232,0.14), transparent),
            radial-gradient(1px 1px at 86% 15%, rgba(201,162,75,0.18), transparent),
            radial-gradient(1px 1px at 22% 28%, rgba(245,241,232,0.10), transparent),
            radial-gradient(1px 1px at 64% 26%, rgba(245,241,232,0.12), transparent);
          animation: twinkle 8s ease-in-out infinite alternate;
        }

        @keyframes twinkle {
          0% { opacity: 0.22; }
          100% { opacity: 0.42; }
        }

        canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
          z-index: 2;
        }

        .atmosphere {
          position: absolute;
          inset: 0;
          z-index: 3;
          pointer-events: none;
          background:
            linear-gradient(180deg,
              rgba(6,8,10,0.05) 0%,
              rgba(6,8,10,0.00) 18%,
              rgba(6,8,10,0.00) 58%,
              rgba(4,5,7,0.34) 100%
            ),
            radial-gradient(ellipse at center,
              transparent 30%,
              rgba(4,5,7,0.18) 72%,
              rgba(3,4,6,0.42) 100%
            );
        }

        .spotlight {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 680px;
          height: 680px;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          z-index: 4;
          pointer-events: none;
          opacity: 0.42;
          filter: blur(24px);
          mix-blend-mode: screen;
          background: radial-gradient(circle,
            rgba(201,162,75,0.13) 0%,
            rgba(201,162,75,0.06) 28%,
            rgba(201,162,75,0.02) 46%,
            transparent 66%);
        }

        .vignette {
          position: absolute;
          inset: 0;
          z-index: 5;
          pointer-events: none;
          background:
            radial-gradient(ellipse at center,
              transparent 34%,
              rgba(3,4,6,0.20) 72%,
              rgba(2,3,4,0.52) 100%);
        }

        @media (max-width: 768px) {
          .spotlight {
            width: 420px;
            height: 420px;
            opacity: 0.30;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .stars { animation: none; }
          .spotlight { display: none; }
        }
      </style>

      <div class="hero">
        <div class="stars" aria-hidden="true"></div>
        <canvas aria-hidden="true"></canvas>
        <div class="atmosphere" aria-hidden="true"></div>
        <div class="spotlight" aria-hidden="true"></div>
        <div class="vignette" aria-hidden="true"></div>
      </div>
    `;
  }

  async connectedCallback() {
    try {
      this.hero = this.shadowRoot.querySelector(".hero");
      this.canvas = this.shadowRoot.querySelector("canvas");
      this.spotlight = this.shadowRoot.querySelector(".spotlight");

      await this.loadThree();
      this.initScene();
      this.initInteractions();
      this.initObservers();
      this.resize();

      this.spotCurrentX = this.hero.clientWidth / 2;
      this.spotCurrentY = this.hero.clientHeight / 2;
      this.spotTargetX = this.spotCurrentX;
      this.spotTargetY = this.spotCurrentY;

      this.spotlight.style.left = this.spotCurrentX + "px";
      this.spotlight.style.top = this.spotCurrentY + "px";

      if (this._reducedMotion) {
        this.renderFrame(1);
      } else {
        this.animate();
      }
    } catch (err) {
      console.error("VoxLux hero failed:", err);
    }
  }

  disconnectedCallback() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._cleanup.forEach(fn => fn());
    this._cleanup = [];
    if (this.renderer) this.renderer.dispose();
  }

  async loadThree() {
    if (window.THREE) return;

    await new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-three="true"]');
      if (existing && window.THREE) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      script.dataset.three = "true";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Three.js failed to load"));
      document.head.appendChild(script);
    });

    if (!window.THREE) {
      throw new Error("Three.js loaded but window.THREE is unavailable");
    }
  }

  initScene() {
    const THREE = window.THREE;
    const isMobile = window.innerWidth <= 768;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !isMobile,
      alpha: true,
      powerPreference: "high-performance"
    });

    this.renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.35));
    this.renderer.setClearColor(0x050608, 0);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x060709, 78, 250);

    this.startCamPos = new THREE.Vector3(0, 18, 58);
    this.endCamPos = new THREE.Vector3(0, 9.5, 34);

    this.startLookAt = new THREE.Vector3(0, 9, -105);
    this.endLookAt = new THREE.Vector3(0, 5.5, -42);

    this.camera = new THREE.PerspectiveCamera(56, 1, 0.1, 1000);
    this.camera.position.copy(this.startCamPos);
    this.camera.lookAt(this.startLookAt);

    this.tempCam = new THREE.Vector3();
    this.tempLook = new THREE.Vector3();

    this.world = new THREE.Group();
    this.scene.add(this.world);

    const ambient = new THREE.AmbientLight(0xffffff, 0.52);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0x2a2f38, 0x060709, 0.65);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xf2ead8, 0.22);
    key.position.set(-10, 18, 12);
    this.scene.add(key);

    const goldRim = new THREE.DirectionalLight(0xc9a24b, 0.48);
    goldRim.position.set(10, 8, 16);
    this.scene.add(goldRim);

    const terrainHeight = (x, z) => {
      const roadInfluence = Math.exp(-(x * x) / 180);
      const broadRoll = Math.sin(z * 0.034) * 0.65;
      const softBreak = Math.sin((z + x * 0.45) * 0.055) * 0.28;
      const sideRise = Math.pow(Math.min(1, Math.abs(x) / 48), 1.7) * 5.6;
      const centerCut = roadInfluence * 1.8;
      return -2.85 + (broadRoll + softBreak) * (0.4 + Math.min(1, Math.abs(x) / 55) * 0.75) + sideRise - centerCut;
    };

    const roadHeight = (x, z) => {
      const base = terrainHeight(x, z);
      const crown = 0.14 - Math.pow(x / 8, 2) * 0.14;
      return base + 0.28 + crown;
    };

    this.terrainHeight = terrainHeight;

    const terrainGeo = new THREE.PlaneGeometry(240, 390, 96, 180);
    terrainGeo.rotateX(-Math.PI / 2);

    const tPos = terrainGeo.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
      const x = tPos.getX(i);
      const z = tPos.getZ(i);
      tPos.setY(i, terrainHeight(x, z));
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d12,
      roughness: 0.96,
      metalness: 0.06
    });

    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.position.z = -85;
    this.world.add(terrain);

    const roadWidth = 16;
    const roadLength = 360;
    const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLength, 34, 180);
    roadGeo.rotateX(-Math.PI / 2);

    const rPos = roadGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const x = rPos.getX(i);
      const z = rPos.getZ(i) - 85;
      rPos.setY(i, roadHeight(x, z));
    }
    roadGeo.computeVertexNormals();

    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x090c10,
      roughness: 1,
      metalness: 0.04
    });

    const road = new THREE.Mesh(roadGeo, roadMat);
    road.position.z = -85;
    this.world.add(road);

    const shoulderGeo = new THREE.PlaneGeometry(1.4, roadLength, 6, 180);
    shoulderGeo.rotateX(-Math.PI / 2);

    const sPos = shoulderGeo.attributes.position;
    for (let i = 0; i < sPos.count; i++) {
      const x = sPos.getX(i);
      const z = sPos.getZ(i) - 85;
      const worldX = x;
      sPos.setY(i, roadHeight(worldX, z) + 0.01);
    }
    shoulderGeo.computeVertexNormals();

    const shoulderMat = new THREE.MeshStandardMaterial({
      color: 0x11151b,
      roughness: 0.95,
      metalness: 0.08
    });

    const leftShoulder = new THREE.Mesh(shoulderGeo, shoulderMat);
    leftShoulder.position.set(-8.4, 0, -85);
    this.world.add(leftShoulder);

    const rightShoulder = new THREE.Mesh(shoulderGeo.clone(), shoulderMat);
    rightShoulder.position.set(8.4, 0, -85);
    this.world.add(rightShoulder);

    const laneGeo = new THREE.PlaneGeometry(0.22, roadLength, 1, 240);
    laneGeo.rotateX(-Math.PI / 2);

    const lPos = laneGeo.attributes.position;
    for (let i = 0; i < lPos.count; i++) {
      const x = lPos.getX(i);
      const z = lPos.getZ(i) - 85;
      lPos.setY(i, roadHeight(x, z) + 0.055);
    }

    const laneMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        uniform float uTime;

        void main() {
          float edgeFade = smoothstep(0.02, 0.15, vUv.y) * (1.0 - smoothstep(0.88, 0.98, vUv.y));
          float pulse = 0.55 + 0.45 * sin(vUv.y * 42.0 - uTime * 1.05);
          float alpha = edgeFade * pulse * 0.28;
          vec3 color = vec3(0.788, 0.635, 0.294);
          gl_FragColor = vec4(color, alpha);
        }
      `
    });

    const laneLeft = new THREE.Mesh(laneGeo, laneMat);
    laneLeft.position.set(-3.1, 0, -85);
    this.world.add(laneLeft);

    const laneRight = new THREE.Mesh(laneGeo.clone(), laneMat.clone());
    laneRight.position.set(3.1, 0, -85);
    this.world.add(laneRight);

    this.laneMaterials = [laneLeft.material, laneRight.material];

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const edgeBaseMat = new THREE.LineBasicMaterial({
      color: 0xc9a24b,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending
    });

    const makeBodyMaterial = () => new THREE.MeshPhongMaterial({
      color: 0x0d141d,
      emissive: 0x07090d,
      shininess: 12,
      transparent: true,
      opacity: 0.97
    });

    const makeWindowMaterial = () => new THREE.PointsMaterial({
      color: 0xe7dcc5,
      size: isMobile ? 0.14 : 0.18,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.54,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const rng = this.mulberry32(13);

    const buildBuilding = (x, z, w, h, d) => {
      const group = new THREE.Group();
      const baseY = terrainHeight(x, z);

      const body = new THREE.Mesh(boxGeo, makeBodyMaterial());
      body.scale.set(w, h, d);
      body.position.set(x, baseY + h / 2, z);
      group.add(body);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(boxGeo),
        edgeBaseMat.clone()
      );
      edges.scale.set(w, h, d);
      edges.position.copy(body.position);
      group.add(edges);

      if (h > 16 && rng() > 0.45) {
        const stepW = w * (0.55 + rng() * 0.20);
        const stepD = d * (0.55 + rng() * 0.20);
        const stepH = 2 + rng() * 3.5;

        const top = new THREE.Mesh(boxGeo, makeBodyMaterial());
        top.scale.set(stepW, stepH, stepD);
        top.position.set(x, baseY + h + stepH / 2, z);
        group.add(top);

        const topEdges = new THREE.LineSegments(
          new THREE.EdgesGeometry(boxGeo),
          edgeBaseMat.clone()
        );
        topEdges.scale.set(stepW, stepH, stepD);
        topEdges.position.copy(top.position);
        group.add(topEdges);
      }

      const floors = Math.max(3, Math.floor(h / 2.3));
      const cols = Math.max(2, Math.floor(w / 0.95));
      const positions = [];

      for (let fy = 0; fy < floors; fy++) {
        for (let fx = 0; fx < cols; fx++) {
          if (rng() < 0.55) {
            positions.push(
              x - w / 2 + (fx + 0.5) * (w / cols),
              baseY + (fy + 0.58) * (h / floors),
              z + d / 2 + 0.03
            );
          }
        }
      }

      if (positions.length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        const windows = new THREE.Points(geo, makeWindowMaterial());
        group.add(windows);
      }

      if (h > 20 && rng() > 0.62) {
        const antH = 3 + rng() * 4;
        const antenna = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, antH, 6),
          new THREE.MeshBasicMaterial({
            color: 0xc9a24b,
            transparent: true,
            opacity: 0.42
          })
        );
        antenna.position.set(x + (rng() - 0.5) * w * 0.25, baseY + h + antH / 2, z);
        group.add(antenna);
      }

      return group;
    };

    this.buildings = [];
    const corridorLength = 330;
    const zStart = -245;
    const zSpacing = 9.5;
    const rows = isMobile ? 22 : 30;

    const columns = [
      -48, -42, -36, -30, -24, -18, -12,
       12,  18,  24,  30,  36,  42,  48
    ];

    for (let ci = 0; ci < columns.length; ci++) {
      const laneX = columns[ci];
      for (let r = 0; r < rows; r++) {
        if (rng() < 0.12) continue;

        const z = zStart + r * zSpacing + (rng() - 0.5) * 2.5;
        const sideFactor = 1 - Math.min(1, Math.abs(laneX) / 50);
        const w = 2.8 + rng() * 3.6;
        const d = 2.8 + rng() * 3.4;
        const h = (8 + Math.pow(rng(), 1.25) * 25) * (0.92 + sideFactor * 0.35);

        const x = laneX + (rng() - 0.5) * 1.3;
        const group = buildBuilding(x, z, w, h, d);
        this.world.add(group);
        this.buildings.push(group);
      }
    }

    this.corridorLength = corridorLength;
    this.world.position.z = 110;

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.targetMx = 0;
    this.targetMy = 0;
    this.currentMx = 0;
    this.currentMy = 0;
  }

  initInteractions() {
    const moveHandler = (clientX, clientY) => {
      const rect = this.hero.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      this.targetMx = (x / rect.width) * 2 - 1;
      this.targetMy = -((y / rect.height) * 2 - 1);

      this.spotTargetX = x;
      this.spotTargetY = y;
    };

    const onMouseMove = (e) => moveHandler(e.clientX, e.clientY);
    const onTouchMove = (e) => {
      if (e.touches && e.touches[0]) {
        moveHandler(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onLeave = () => {
      this.targetMx = 0;
      this.targetMy = 0;
      this.spotTargetX = this.hero.clientWidth / 2;
      this.spotTargetY = this.hero.clientHeight / 2;
    };

    this.hero.addEventListener("mousemove", onMouseMove);
    this.hero.addEventListener("touchmove", onTouchMove, { passive: true });
    this.hero.addEventListener("mouseleave", onLeave);

    this._cleanup.push(() => this.hero.removeEventListener("mousemove", onMouseMove));
    this._cleanup.push(() => this.hero.removeEventListener("touchmove", onTouchMove));
    this._cleanup.push(() => this.hero.removeEventListener("mouseleave", onLeave));
  }

  initObservers() {
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this);
    this._cleanup.push(() => ro.disconnect());

    const visHandler = () => {
      if (document.hidden) {
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = null;
      } else if (!this._raf && !this._reducedMotion) {
        this.animate();
      }
    };

    document.addEventListener("visibilitychange", visHandler);
    this._cleanup.push(() => document.removeEventListener("visibilitychange", visHandler));
  }

  resize() {
    if (!this.renderer || !this.camera) return;

    const w = this.clientWidth || 1200;
    const h = this.clientHeight || 800;

    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();

    if (!this.spotTargetX || !this.spotTargetY) {
      this.spotTargetX = w / 2;
      this.spotTargetY = h / 2;
    }
  }

  renderFrame(forceProgress = 1) {
    this.updateCamera(forceProgress);
    this.renderer.render(this.scene, this.camera);
  }

  updateCamera(progressRaw) {
    const progress = progressRaw * progressRaw * (3 - 2 * progressRaw);

    this.currentMx += (this.targetMx - this.currentMx) * 0.03;
    this.currentMy += (this.targetMy - this.currentMy) * 0.03;

    this.tempCam.lerpVectors(this.startCamPos, this.endCamPos, progress);
    this.tempLook.lerpVectors(this.startLookAt, this.endLookAt, progress);

    this.tempCam.x += this.currentMx * 1.8;
    this.tempCam.y += this.currentMy * 0.9 + Math.sin(this.elapsed * 0.20) * 0.15;
    this.tempCam.z += Math.sin(this.elapsed * 0.10) * 0.25;

    this.tempLook.x += this.currentMx * 2.4;
    this.tempLook.y += this.currentMy * 0.4;

    this.camera.position.copy(this.tempCam);
    this.camera.lookAt(this.tempLook);
  }

  animate() {
    const tick = () => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.elapsed += dt;

      const speed = 7.2;
      this.world.position.z += speed * dt;

      for (let i = 0; i < this.buildings.length; i++) {
        const b = this.buildings[i];
        const worldZ = b.position.z + this.world.position.z;
        if (worldZ > 52) {
          b.position.z -= this.corridorLength;
        }
      }

      const introProgress = Math.min(1, this.elapsed / 10.0);
      this.updateCamera(introProgress);

      if (this.laneMaterials) {
        for (let i = 0; i < this.laneMaterials.length; i++) {
          this.laneMaterials[i].uniforms.uTime.value = this.elapsed;
        }
      }

      this.spotCurrentX += (this.spotTargetX - this.spotCurrentX) * 0.06;
      this.spotCurrentY += (this.spotTargetY - this.spotCurrentY) * 0.06;
      this.spotlight.style.left = this.spotCurrentX + "px";
      this.spotlight.style.top = this.spotCurrentY + "px";

      this.renderer.render(this.scene, this.camera);
      this._raf = requestAnimationFrame(tick);
    };

    this._raf = requestAnimationFrame(tick);
  }

  mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
}

customElements.define("voxlux-hero", VoxluxHero);
