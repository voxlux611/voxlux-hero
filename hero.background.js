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
            radial-gradient(ellipse at 50% 22%, #171b21 0%, #0b0d12 52%, #050608 100%);
        }

        .stars {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          opacity: 0.18;
          background-image:
            radial-gradient(1px 1px at 14% 16%, rgba(245,241,232,0.12), transparent),
            radial-gradient(1px 1px at 32% 12%, rgba(245,241,232,0.08), transparent),
            radial-gradient(1px 1px at 52% 18%, rgba(201,162,75,0.09), transparent),
            radial-gradient(1px 1px at 72% 10%, rgba(245,241,232,0.08), transparent),
            radial-gradient(1px 1px at 86% 16%, rgba(201,162,75,0.08), transparent);
          animation: twinkle 8s ease-in-out infinite alternate;
        }

        @keyframes twinkle {
          0% { opacity: 0.12; }
          100% { opacity: 0.22; }
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
              rgba(4,5,7,0.02) 0%,
              rgba(4,5,7,0.00) 24%,
              rgba(4,5,7,0.00) 62%,
              rgba(3,4,6,0.26) 100%
            ),
            radial-gradient(ellipse at center,
              transparent 32%,
              rgba(4,5,7,0.12) 74%,
              rgba(3,4,6,0.34) 100%);
        }

        .spotlight {
          position: absolute;
          left: 50%;
          top: 54%;
          width: 540px;
          height: 540px;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          z-index: 4;
          pointer-events: none;
          opacity: 0.24;
          filter: blur(24px);
          mix-blend-mode: screen;
          background: radial-gradient(circle,
            rgba(201,162,75,0.10) 0%,
            rgba(201,162,75,0.04) 34%,
            rgba(201,162,75,0.012) 54%,
            transparent 72%);
        }

        .frameGlow {
          position: absolute;
          inset: 0;
          z-index: 5;
          pointer-events: none;
          box-shadow:
            inset 0 0 120px rgba(201,162,75,0.05),
            inset 0 0 220px rgba(255,255,255,0.01),
            inset 0 -80px 120px rgba(0,0,0,0.22);
          border: 1px solid rgba(201,162,75,0.045);
        }

        .vignette {
          position: absolute;
          inset: 0;
          z-index: 6;
          pointer-events: none;
          background:
            radial-gradient(ellipse at center,
              transparent 36%,
              rgba(3,4,6,0.14) 74%,
              rgba(2,3,4,0.42) 100%);
        }

        @media (max-width: 768px) {
          .spotlight {
            width: 360px;
            height: 360px;
            opacity: 0.18;
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
        <div class="frameGlow" aria-hidden="true"></div>
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
        this.renderFrame();
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

    this.renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.4));
    this.renderer.setClearColor(0x050608, 0);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x060709, 26, 150);

    /* STREET-LEVEL START, RIGHT IN FRONT OF THE CITY */
    this.camera = new THREE.PerspectiveCamera(63, 1, 0.1, 1000);
    this.camera.position.set(0, 4.8, 12);
    this.lookTarget = new THREE.Vector3(0, 4.2, -26);
    this.camera.lookAt(this.lookTarget);

    this.world = new THREE.Group();
    this.scene.add(this.world);

    const ambient = new THREE.AmbientLight(0xffffff, 0.50);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0x2c3138, 0x050608, 0.58);
    this.scene.add(hemi);

    const fill = new THREE.DirectionalLight(0xf1e8d8, 0.16);
    fill.position.set(-10, 16, 10);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xc9a24b, 0.42);
    rim.position.set(10, 7, 12);
    this.scene.add(rim);

    /* CLEAN ROAD */
    const roadLength = 260;
    const roadWidth = 16;
    const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLength, 1, 1);
    roadGeo.rotateX(-Math.PI / 2);

    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x090c10,
      roughness: 1,
      metalness: 0.03
    });

    const road = new THREE.Mesh(roadGeo, roadMat);
    road.position.set(0, -2.02, -56);
    this.world.add(road);

    /* SUBTLE SIDEWALKS / CLEAN CITY BASE */
    const sideGeo = new THREE.PlaneGeometry(11, roadLength, 1, 1);
    sideGeo.rotateX(-Math.PI / 2);

    const sideMat = new THREE.MeshStandardMaterial({
      color: 0x0d1118,
      roughness: 0.96,
      metalness: 0.06
    });

    const leftSide = new THREE.Mesh(sideGeo, sideMat);
    leftSide.position.set(-13.6, -1.98, -56);
    this.world.add(leftSide);

    const rightSide = new THREE.Mesh(sideGeo.clone(), sideMat);
    rightSide.position.set(13.6, -1.98, -56);
    this.world.add(rightSide);

    /* GOLD EDGE STRIPS */
    const edgeGeo = new THREE.PlaneGeometry(0.35, roadLength, 1, 180);
    edgeGeo.rotateX(-Math.PI / 2);

    const edgeMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0.0 }
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
          float edgeFade = smoothstep(0.04, 0.20, vUv.y) * (1.0 - smoothstep(0.82, 0.98, vUv.y));
          float shimmer = 0.82 + 0.18 * sin(vUv.y * 26.0 - uTime * 0.75);
          float alpha = edgeFade * shimmer * 0.22;
          vec3 color = vec3(0.788, 0.635, 0.294);
          gl_FragColor = vec4(color, alpha);
        }
      `
    });

    const leftEdge = new THREE.Mesh(edgeGeo, edgeMat);
    leftEdge.position.set(-8.2, -1.95, -56);
    this.world.add(leftEdge);

    const rightEdge = new THREE.Mesh(edgeGeo.clone(), edgeMat.clone());
    rightEdge.position.set(8.2, -1.95, -56);
    this.world.add(rightEdge);

    this.edgeMaterials = [leftEdge.material, rightEdge.material];

    /* BUILDINGS */
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);

    const makeBodyMaterial = () => new THREE.MeshPhongMaterial({
      color: 0x0d141d,
      emissive: 0x06080c,
      shininess: 14,
      transparent: true,
      opacity: 0.97
    });

    const edgeLineMat = new THREE.LineBasicMaterial({
      color: 0xc9a24b,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending
    });

    const windowStreakGeo = new THREE.PlaneGeometry(0.42, 0.075);
    const windowGlowGeo = new THREE.PlaneGeometry(0.74, 0.16);

    const makeWindowMaterial = () => new THREE.MeshBasicMaterial({
      color: 0xf0e6d5,
      transparent: true,
      opacity: 0.20,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const makeGlowMaterial = () => new THREE.MeshBasicMaterial({
      color: 0xc9a24b,
      transparent: true,
      opacity: 0.10,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const rng = this.mulberry32(13);
    this.buildings = [];

    const buildBuilding = (x, z, w, h, d) => {
      const group = new THREE.Group();
      group.position.set(x, -2.0, z);

      const body = new THREE.Mesh(boxGeo, makeBodyMaterial());
      body.scale.set(w, h, d);
      body.position.set(0, h / 2, 0);
      group.add(body);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(boxGeo),
        edgeLineMat.clone()
      );
      edges.scale.set(w, h, d);
      edges.position.copy(body.position);
      group.add(edges);

      if (h > 16 && rng() > 0.42) {
        const topW = w * (0.56 + rng() * 0.18);
        const topD = d * (0.56 + rng() * 0.18);
        const topH = 1.6 + rng() * 3.0;

        const top = new THREE.Mesh(boxGeo, makeBodyMaterial());
        top.scale.set(topW, topH, topD);
        top.position.set(0, h + topH / 2, 0);
        group.add(top);

        const topEdges = new THREE.LineSegments(
          new THREE.EdgesGeometry(boxGeo),
          edgeLineMat.clone()
        );
        topEdges.scale.set(topW, topH, topD);
        topEdges.position.copy(top.position);
        group.add(topEdges);
      }

      /* FRONT-FACING WINDOW STREAKS */
      const floors = Math.max(4, Math.floor(h / 2.25));
      const cols = Math.max(2, Math.floor(w / 1.0));
      const yStart = h * 0.14;
      const usableH = h * 0.70;
      const usableW = w * 0.78;

      for (let fy = 0; fy < floors; fy++) {
        for (let fx = 0; fx < cols; fx++) {
          if (rng() < 0.84) {
            const glow = new THREE.Mesh(windowGlowGeo, makeGlowMaterial());
            glow.scale.x = 0.84 + rng() * 0.20;
            glow.position.set(
              -usableW / 2 + (fx + 0.5) * (usableW / cols),
              yStart + (fy + 0.5) * (usableH / floors),
              d / 2 + 0.035
            );
            group.add(glow);

            const streak = new THREE.Mesh(windowStreakGeo, makeWindowMaterial());
            streak.scale.x = 0.74 + rng() * 0.18;
            streak.position.set(
              glow.position.x,
              glow.position.y,
              d / 2 + 0.045
            );
            group.add(streak);
          }
        }
      }

      if (h > 18 && rng() > 0.62) {
        const antH = 2.6 + rng() * 3.2;
        const antenna = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, antH, 6),
          new THREE.MeshBasicMaterial({
            color: 0xc9a24b,
            transparent: true,
            opacity: 0.32
          })
        );
        antenna.position.set((rng() - 0.5) * w * 0.25, h + antH / 2, 0);
        group.add(antenna);
      }

      return group;
    };

    const columns = [-22, -18, -14, -10, 10, 14, 18, 22];
    const zStart = -150;
    const zSpacing = 10;
    const rows = isMobile ? 20 : 25;

    for (let ci = 0; ci < columns.length; ci++) {
      const laneX = columns[ci];

      for (let r = 0; r < rows; r++) {
        if (rng() < 0.08) continue;

        const z = zStart + r * zSpacing + (rng() - 0.5) * 1.5;
        const innerFactor = 1 - Math.min(1, Math.abs(laneX) / 24);
        const w = 3.0 + rng() * 3.2;
        const d = 3.0 + rng() * 3.0;
        const h = (10 + Math.pow(rng(), 1.18) * 25) * (0.94 + innerFactor * 0.24);

        const x = laneX + (rng() - 0.5) * 0.7;
        const building = buildBuilding(x, z, w, h, d);
        this.world.add(building);
        this.buildings.push(building);
      }
    }

    /* START WITH CITY ALREADY IN FRONT */
    this.corridorLength = 250;
    this.world.position.z = 70;

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

  renderFrame() {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  animate() {
    const tick = () => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.elapsed += dt;

      /* MOVING THROUGH THE CITY */
      const speed = 10.0;
      this.world.position.z += speed * dt;

      for (let i = 0; i < this.buildings.length; i++) {
        const b = this.buildings[i];
        const worldZ = b.position.z + this.world.position.z;
        if (worldZ > 30) {
          b.position.z -= this.corridorLength;
        }
      }

      this.currentMx += (this.targetMx - this.currentMx) * 0.035;
      this.currentMy += (this.targetMy - this.currentMy) * 0.035;

      this.camera.position.x = this.currentMx * 1.2;
      this.camera.position.y = 4.8 + this.currentMy * 0.45 + Math.sin(this.elapsed * 0.30) * 0.04;
      this.camera.position.z = 12 + Math.sin(this.elapsed * 0.12) * 0.06;

      this.lookTarget.x = this.currentMx * 1.7;
      this.lookTarget.y = 4.15 + this.currentMy * 0.20;
      this.lookTarget.z = -26;
      this.camera.lookAt(this.lookTarget);

      if (this.edgeMaterials) {
        for (let i = 0; i < this.edgeMaterials.length; i++) {
          this.edgeMaterials[i].uniforms.uTime.value = this.elapsed;
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
