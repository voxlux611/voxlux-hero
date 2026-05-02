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
          background: radial-gradient(ellipse at 50% 30%, #0E141C 0%, #07090D 55%, #030406 100%);
        }

        .stars {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background-image:
            radial-gradient(1px 1px at 14% 16%, rgba(245,241,232,0.45), transparent),
            radial-gradient(1px 1px at 29% 8%, rgba(245,241,232,0.35), transparent),
            radial-gradient(1px 1px at 43% 21%, rgba(201,162,75,0.4), transparent),
            radial-gradient(1px 1px at 61% 12%, rgba(245,241,232,0.4), transparent),
            radial-gradient(1px 1px at 76% 7%, rgba(245,241,232,0.3), transparent),
            radial-gradient(1px 1px at 88% 18%, rgba(201,162,75,0.35), transparent),
            radial-gradient(1px 1px at 22% 30%, rgba(245,241,232,0.25), transparent),
            radial-gradient(1px 1px at 67% 26%, rgba(245,241,232,0.3), transparent);
          opacity: 0.65;
          animation: twinkle 7s ease-in-out infinite alternate;
        }

        @keyframes twinkle {
          0% { opacity: 0.35; }
          100% { opacity: 0.78; }
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
            radial-gradient(ellipse 80% 60% at 50% 45%, transparent 0%, rgba(5,7,11,0.2) 55%, rgba(3,4,6,0.6) 100%),
            linear-gradient(180deg, rgba(5,7,11,0.55) 0%, transparent 22%, transparent 60%, rgba(3,4,6,0.55) 100%);
        }

        .spotlight {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 720px;
          height: 720px;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          background: radial-gradient(circle,
            rgba(201,162,75,0.16) 0%,
            rgba(201,162,75,0.07) 28%,
            rgba(201,162,75,0.02) 50%,
            transparent 65%);
          pointer-events: none;
          filter: blur(20px);
          z-index: 4;
          opacity: 0.8;
          mix-blend-mode: screen;
          transition: opacity 300ms ease;
        }

        .vignette {
          position: absolute;
          inset: 0;
          z-index: 5;
          pointer-events: none;
          background: radial-gradient(ellipse at center, transparent 42%, rgba(3,4,6,0.6) 100%);
        }

        @media (max-width: 768px) {
          .spotlight {
            width: 420px;
            height: 420px;
            opacity: 0.45;
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

  connectedCallback() {
    this.hero = this.shadowRoot.querySelector(".hero");
    this.canvas = this.shadowRoot.querySelector("canvas");
    this.spotlight = this.shadowRoot.querySelector(".spotlight");

    this.loadThree().then(() => {
      this.initScene();
      this.initInteractions();
      this.initObservers();
      this.resize();
      this.animate();
    });
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
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
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

    this.renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setClearColor(0x030406, 0);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x050608, 60, 260);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
    this.camera.position.set(0, 22, 70);
    this.camera.lookAt(0, 8, 0);

    this.world = new THREE.Group();
    this.scene.add(this.world);

    const rng = this.mulberry32(13);
    const Z_START = -200;
    const Z_END = 50;
    const CORRIDOR = Z_END - Z_START;
    this.CORRIDOR = CORRIDOR;
    this.Z_END = Z_END;

    const getTerrainHeight = (x, z) => {
      const n1 = Math.sin(x * 0.045 + z * 0.038) * 0.6;
      const n2 = Math.sin(x * 0.11 - z * 0.08) * 0.35;
      const n3 = Math.sin(x * 0.22 + z * 0.17) * 0.18;
      const n4 = Math.sin(x * 0.5 - z * 0.4) * 0.08;
      const noise = n1 + n2 + n3 + n4;
      const dx = Math.abs(x);
      const centerBias = Math.min(1, dx / 90);
      const heightScale = 0.8 + Math.pow(centerBias, 1.4) * 6.5;
      const centralMound = Math.exp(-((x * x) / 280)) * 1.4;
      return noise * heightScale + centralMound;
    };
    this.getTerrainHeight = getTerrainHeight;

    const terrainSize = 280;
    const terrainSegs = isMobile ? 80 : 160;
    const terrainGeo = new THREE.PlaneGeometry(terrainSize, CORRIDOR + 100, terrainSegs, terrainSegs);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      posAttr.setY(i, getTerrainHeight(vx, vz));
    }
    terrainGeo.computeVertexNormals();

    this.terrainMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorBase: { value: new THREE.Color(0x080A0E) },
        uColorMid: { value: new THREE.Color(0x12161E) },
        uColorRidge: { value: new THREE.Color(0xC9A24B) },
        uColorFog: { value: new THREE.Color(0x050608) },
        uFogNear: { value: 50 },
        uFogFar: { value: 220 }
      },
      vertexShader: `
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying float vElevation;
        void main() {
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          vElevation = position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying float vElevation;
        uniform vec3 uColorBase;
        uniform vec3 uColorMid;
        uniform vec3 uColorRidge;
        uniform vec3 uColorFog;
        uniform float uFogNear;
        uniform float uFogFar;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          float a = hash(i); float b = hash(i + vec2(1.0,0.0));
          float c = hash(i + vec2(0.0,1.0)); float d = hash(i + vec2(1.0,1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
        }

        void main() {
          vec3 lightDir = normalize(vec3(0.3, 1.0, 0.4));
          float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
          float slope = 1.0 - clamp(vNormal.y, 0.0, 1.0);
          float elevBands = sin(vElevation * 4.0) * 0.5 + 0.5;
          float contour = smoothstep(0.92, 0.99, elevBands) * 0.18;
          float micro = vnoise(vPosition.xz * 1.4) * 0.5 + vnoise(vPosition.xz * 4.5) * 0.25;
          micro = pow(micro, 1.6);
          vec2 grid = abs(fract(vPosition.xz * 0.18) - 0.5);
          float gridLine = 1.0 - smoothstep(0.0, 0.035, min(grid.x, grid.y));
          float centerDist = abs(vPosition.x) / 60.0;
          gridLine *= smoothstep(0.5, 1.4, centerDist) * 0.12;
          float elevTint = clamp(vElevation / 5.0, 0.0, 1.0);

          vec3 color = mix(uColorBase, uColorMid, elevTint * 0.85 + diffuse * 0.25);
          color = mix(color, uColorRidge * 0.45, slope * 0.32);
          color += uColorRidge * contour * 0.6;
          color += uColorRidge * gridLine * 0.7;
          color += vec3(micro * 0.04);

          float centerDarken = 1.0 - smoothstep(0.0, 25.0, abs(vPosition.x)) * 0.25;
          color *= centerDarken;

          float fogDepth = -(modelViewMatrix * vec4(vPosition, 1.0)).z;
          float fogFactor = smoothstep(uFogNear, uFogFar, fogDepth);
          color = mix(color, uColorFog, fogFactor);

          gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    const terrain = new THREE.Mesh(terrainGeo, this.terrainMat);
    terrain.position.y = -0.3;
    terrain.position.z = -75;
    this.world.add(terrain);

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xC9A24B,
      transparent: true,
      opacity: 0.22
    });

    const makeBuildingMaterial = () => {
      const tint = 0.85 + rng() * 0.3;
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.96 });
      mat.color.setRGB(0.04 * tint, 0.052 * tint, 0.075 * tint);
      return mat;
    };

    const buildBuilding = (x, z, w, h, d) => {
      const group = new THREE.Group();
      const baseY = getTerrainHeight(x, z);

      const body = new THREE.Mesh(boxGeo, makeBuildingMaterial());
      body.scale.set(w, h, d);
      body.position.set(x, baseY + h / 2, z);
      group.add(body);

      if (rng() > 0.35) {
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), edgeMat.clone());
        edges.scale.set(w, h, d);
        edges.position.set(x, baseY + h / 2, z);
        group.add(edges);
      }

      return group;
    };

    const LANE_WIDTH = 5.2;
    const lanes = [];
    for (let lx = -7; lx >= -14; lx--) lanes.push(lx * LANE_WIDTH);
    for (let rx = 7; rx <= 14; rx++) lanes.push(rx * LANE_WIDTH);

    const Z_SPACING = 7.2;
    const slotCount = Math.ceil(CORRIDOR / Z_SPACING);
    this.buildings = [];

    for (let li = 0; li < lanes.length; li++) {
      const laneX = lanes[li];
      for (let s = 0; s < slotCount; s++) {
        const z = Z_START + s * Z_SPACING + (rng() - 0.5) * 2.5;
        if (rng() < (isMobile ? 0.35 : 0.2)) continue;

        const w = 2.6 + rng() * 3.6;
        const d = 2.6 + rng() * 3.6;
        const laneCenterness = 1 - Math.min(1, Math.abs(laneX) / (14 * LANE_WIDTH));
        const heightBoost = THREE.MathUtils.lerp(1.0, 1.35, laneCenterness);
        const distFactor = (z - Z_START) / CORRIDOR;
        const maxH = THREE.MathUtils.lerp(34, 20, distFactor);
        const h = (5 + Math.pow(rng(), 1.3) * maxH) * heightBoost;

        const xJitter = (rng() - 0.5) * (LANE_WIDTH * 0.4);
        const building = buildBuilding(laneX + xJitter, z, w, h, d);
        this.world.add(building);
        this.buildings.push({ group: building });
      }
    }

    this.world.position.z = CORRIDOR * 0.78;

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.targetMx = 0;
    this.targetMy = 0;
    this.currentMx = 0;
    this.currentMy = 0;
    this.spotTargetX = 50;
    this.spotTargetY = 50;
    this.spotCurrentX = 50;
    this.spotCurrentY = 50;

    if (this._reducedMotion) {
      this.renderFrame();
    }
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

    this.spotTargetX = w / 2;
    this.spotTargetY = h / 2;
  }

  renderFrame() {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
  }

  animate() {
    if (this._reducedMotion) return;

    const tick = () => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.elapsed += dt;

      this.world.position.z += 14 * dt;

      for (let i = 0; i < this.buildings.length; i++) {
        const b = this.buildings[i];
        const worldZ = b.group.position.z + this.world.position.z;
        if (worldZ > this.Z_END) b.group.position.z -= this.CORRIDOR;
      }

      this.terrainMat.uniforms.uTime.value = this.elapsed;

      this.currentMx += (this.targetMx - this.currentMx) * 0.04;
      this.currentMy += (this.targetMy - this.currentMy) * 0.04;
      this.camera.position.x = this.currentMx * 5.5;
      this.camera.position.y = 22 + this.currentMy * 3.5;
      this.camera.lookAt(0, 8, 0);

      this.spotCurrentX += (this.spotTargetX - this.spotCurrentX) * 0.08;
      this.spotCurrentY += (this.spotTargetY - this.spotCurrentY) * 0.08;
      this.spotlight.style.left = \`\${this.spotCurrentX}px\`;
      this.spotlight.style.top = \`\${this.spotCurrentY}px\`;

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
