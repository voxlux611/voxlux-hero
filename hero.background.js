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
          min-height: 100%;
          background: radial-gradient(ellipse at 50% 30%, #0E141C 0%, #07090D 55%, #030406 100%);
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: default;
        }

        .stars {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background-image:
            radial-gradient(1px 1px at 14% 16%, rgba(245, 241, 232, 0.45), transparent),
            radial-gradient(1px 1px at 29% 8%, rgba(245, 241, 232, 0.35), transparent),
            radial-gradient(1px 1px at 43% 21%, rgba(201, 162, 75, 0.4), transparent),
            radial-gradient(1px 1px at 61% 12%, rgba(245, 241, 232, 0.4), transparent),
            radial-gradient(1px 1px at 76% 7%, rgba(245, 241, 232, 0.3), transparent),
            radial-gradient(1px 1px at 88% 18%, rgba(201, 162, 75, 0.35), transparent),
            radial-gradient(1px 1px at 22% 30%, rgba(245, 241, 232, 0.25), transparent),
            radial-gradient(1px 1px at 67% 26%, rgba(245, 241, 232, 0.3), transparent);
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
          z-index: 2;
          display: block;
        }

        .atmosphere {
          position: absolute;
          inset: 0;
          z-index: 3;
          pointer-events: none;
          background:
            radial-gradient(ellipse 80% 60% at 50% 45%, transparent 0%, rgba(5, 7, 11, 0.2) 55%, rgba(3, 4, 6, 0.6) 100%),
            linear-gradient(180deg, rgba(5, 7, 11, 0.55) 0%, transparent 22%, transparent 60%, rgba(3, 4, 6, 0.55) 100%);
        }

        .spotlight {
          position: absolute;
          left: 0;
          top: 0;
          width: 720px;
          height: 720px;
          border-radius: 50%;
          background: radial-gradient(circle,
            rgba(201, 162, 75, 0.16) 0%,
            rgba(201, 162, 75, 0.07) 28%,
            rgba(201, 162, 75, 0.02) 50%,
            transparent 65%);
          transform: translate(-50%, -50%);
          pointer-events: none;
          filter: blur(20px);
          z-index: 4;
          opacity: 0;
          transition: opacity 900ms ease;
          mix-blend-mode: screen;
        }

        .hero.ready .spotlight { opacity: 1; }

        .vignette {
          position: absolute;
          inset: 0;
          z-index: 5;
          pointer-events: none;
          background: radial-gradient(ellipse at center, transparent 42%, rgba(3, 4, 6, 0.6) 100%);
        }

        .content {
          position: relative;
          z-index: 10;
          text-align: center;
          padding: 2rem 1.75rem;
          max-width: 1080px;
          width: 100%;
          color: #F5F1E8;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          font-family: Georgia, "Times New Roman", serif;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.85rem;
          font-family: Arial, sans-serif;
          font-weight: 400;
          font-size: 0.68rem;
          letter-spacing: 0.42em;
          text-transform: uppercase;
          color: rgba(245, 241, 232, 0.7);
          margin-bottom: 1.75rem;
          opacity: 0;
          animation: fadeIn 900ms ease-out forwards;
          animation-delay: 100ms;
          text-shadow: 0 0 24px rgba(3, 4, 6, 0.8);
        }

        .eyebrow .bar {
          display: inline-block;
          width: 28px;
          height: 1px;
          background: rgba(201, 162, 75, 0.7);
        }

        .brand-mark {
          font-weight: 700;
          font-size: clamp(3.25rem, 9vw, 7.5rem);
          line-height: 0.98;
          letter-spacing: -0.02em;
          margin: 0 auto 0.6rem;
          opacity: 0;
          transform: translateY(28px);
          animation: fadeUp 1200ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          animation-delay: 200ms;
          text-shadow: 0 4px 50px rgba(3, 4, 6, 0.95), 0 0 90px rgba(201, 162, 75, 0.12);
        }

        .brand-mark .voxlux {
          color: #F5F1E8;
          font-weight: 700;
        }

        .brand-mark .strategic {
          color: #C9A24B;
          font-style: italic;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .divider {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.85rem;
          margin: 1.5rem auto 1.75rem;
          opacity: 0;
          animation: fadeIn 900ms ease-out forwards;
          animation-delay: 450ms;
        }

        .divider .line {
          width: 56px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(201, 162, 75, 0.8), transparent);
        }

        .divider .dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #C9A24B;
          box-shadow: 0 0 12px rgba(201, 162, 75, 0.7);
        }

        .subhead {
          font-weight: 600;
          font-style: italic;
          font-size: clamp(1.1rem, 2vw, 1.6rem);
          line-height: 1.45;
          color: rgba(245, 241, 232, 0.92);
          max-width: 720px;
          margin: 0 auto 2.75rem;
          opacity: 0;
          transform: translateY(20px);
          animation: fadeUp 1100ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          animation-delay: 500ms;
          text-shadow: 0 2px 28px rgba(3, 4, 6, 0.9);
        }

        .subhead .accent {
          color: #C9A24B;
        }

        .cta-wrap {
          opacity: 0;
          transform: translateY(20px);
          animation: fadeUp 1100ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
          animation-delay: 800ms;
        }

        .cta {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 0.65rem;
          font-family: Arial, sans-serif;
          font-weight: 500;
          font-size: 0.88rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #07090D;
          background: #C9A24B;
          padding: 1.05rem 2.5rem;
          border-radius: 2px;
          text-decoration: none;
          overflow: hidden;
          isolation: isolate;
          transition: transform 350ms cubic-bezier(0.22, 1, 0.36, 1),
                      box-shadow 350ms ease,
                      background-color 350ms ease;
          box-shadow: 0 8px 32px rgba(201, 162, 75, 0.3),
                      inset 0 0 0 1px rgba(245, 241, 232, 0.1);
        }

        .cta::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(110deg, transparent 30%, rgba(245, 241, 232, 0.45) 50%, transparent 70%);
          transform: translateX(-120%);
          transition: transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
          z-index: -1;
        }

        .cta:hover {
          transform: translateY(-2px);
          background: #D4AE5A;
          box-shadow: 0 14px 42px rgba(201, 162, 75, 0.42),
                      inset 0 0 0 1px rgba(245, 241, 232, 0.14);
        }

        .cta:hover::before { transform: translateX(120%); }

        .cta:focus-visible {
          outline: 2px solid #F5F1E8;
          outline-offset: 4px;
        }

        .cta .arrow {
          display: inline-block;
          transition: transform 350ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .cta:hover .arrow { transform: translateX(5px); }

        @keyframes fadeUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          to { opacity: 1; }
        }

        @media (max-width: 768px) {
          .content { padding: 1.5rem 1.25rem; }
          .eyebrow {
            font-size: 0.6rem;
            letter-spacing: 0.32em;
            margin-bottom: 1.25rem;
            gap: 0.65rem;
          }
          .eyebrow .bar { width: 20px; }
          .brand-mark { font-size: clamp(2.5rem, 11vw, 4.5rem); }
          .divider { margin: 1.1rem auto 1.4rem; }
          .divider .line { width: 38px; }
          .subhead {
            font-size: clamp(1rem, 4vw, 1.2rem);
            line-height: 1.5;
            margin-bottom: 2.25rem;
          }
          .cta {
            padding: 0.95rem 1.85rem;
            font-size: 0.78rem;
            letter-spacing: 0.14em;
          }
          .spotlight {
            width: 460px;
            height: 460px;
          }
        }

        @media (max-width: 480px) {
          .brand-mark { font-size: clamp(2.1rem, 13vw, 3.2rem); }
        }

        @media (prefers-reduced-motion: reduce) {
          .brand-mark, .subhead, .cta-wrap, .eyebrow, .divider {
            animation: none;
            opacity: 1;
            transform: none;
          }
          .stars { animation: none; }
          .spotlight { display: none; }
        }
      </style>

      <section class="hero" id="hero" role="banner" aria-label="VoxLux Strategic hero">
        <div class="stars" aria-hidden="true"></div>
        <canvas id="city-canvas" aria-hidden="true"></canvas>
        <div class="atmosphere" aria-hidden="true"></div>
        <div class="spotlight" id="spotlight" aria-hidden="true"></div>
        <div class="vignette" aria-hidden="true"></div>

        <div class="content">
          <div class="eyebrow">
            <span class="bar" aria-hidden="true"></span>
            <span>Presence. Perception. Precision.</span>
            <span class="bar" aria-hidden="true"></span>
          </div>

          <h1 class="brand-mark">
            <span class="voxlux">VoxLux</span> <span class="strategic">Strategic</span>
          </h1>

          <div class="divider" aria-hidden="true">
            <span class="line"></span>
            <span class="dot"></span>
            <span class="line"></span>
          </div>

          <p class="subhead">
            Where <span class="accent">strategy</span>, <span class="accent">presence</span>, and <span class="accent">perception</span> align.
          </p>

          <div class="cta-wrap">
            <a class="cta" href="https://www.voxluxstrategic.com/our-expertise" target="_top" rel="noopener">
              <span>Discover Our Services</span>
              <span class="arrow" aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>
    `;
  }

  async connectedCallback() {
    try {
      this.hero = this.shadowRoot.getElementById("hero");
      this.canvas = this.shadowRoot.getElementById("city-canvas");
      this.spotlight = this.shadowRoot.getElementById("spotlight");

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

      requestAnimationFrame(() => this.hero.classList.add("ready"));

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

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          float a = hash(i); float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
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

    const mistGeo = new THREE.PlaneGeometry(300, 300, 1, 1);
    mistGeo.rotateX(-Math.PI / 2);

    this.mistMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          vUv = uv;
          vWorld = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        varying vec3 vWorld;
        uniform float uTime;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          float a = hash(i); float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0)); float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
          vec2 p = vUv * 4.5;
          p.x += uTime * 0.04;
          p.y += uTime * 0.02;
          float n = noise(p) * 0.6 + noise(p * 2.5) * 0.3 + noise(p * 6.0) * 0.1;
          float centerFade = smoothstep(0.0, 0.5, abs(vUv.x - 0.5));
          float alpha = n * 0.14 * (0.3 + centerFade * 0.85);
          vec3 mistColor = vec3(0.039, 0.047, 0.063);
          gl_FragColor = vec4(mistColor, alpha);
        }
      `
    });

    const mist = new THREE.Mesh(mistGeo, this.mistMat);
    mist.position.y = 1.5;
    mist.position.z = -55;
    this.world.add(mist);

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);

    const makeBuildingMaterial = () => {
      const tint = 0.85 + rng() * 0.3;
      const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.96 });
      mat.color.setRGB(0.04 * tint, 0.052 * tint, 0.075 * tint);
      return mat;
    };

    const windowMatGold = new THREE.PointsMaterial({
      color: 0xC9A24B,
      size: 0.42,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const windowMatCream = new THREE.PointsMaterial({
      color: 0xF5F1E8,
      size: 0.34,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xC9A24B,
      transparent: true,
      opacity: 0.32
    });

    const buildBuilding = (x, z, w, h, d) => {
      const group = new THREE.Group();
      const baseY = getTerrainHeight(x, z);

      const body = new THREE.Mesh(boxGeo, makeBuildingMaterial());
      body.scale.set(w, h, d);
      body.position.set(x, baseY + h / 2, z);
      group.add(body);

      if (rng() > 0.3) {
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), edgeMat.clone());
        edges.material.opacity = 0.18 + rng() * 0.22;
        edges.scale.set(w, h, d);
        edges.position.set(x, baseY + h / 2, z);
        group.add(edges);
      }

      if (h > 16 && rng() > 0.55) {
        const stepW = w * (0.55 + rng() * 0.25);
        const stepD = d * (0.55 + rng() * 0.25);
        const stepH = 2 + rng() * 4;

        const stepBody = new THREE.Mesh(boxGeo, makeBuildingMaterial());
        stepBody.scale.set(stepW, stepH, stepD);
        stepBody.position.set(x, baseY + h + stepH / 2, z);
        group.add(stepBody);

        const stepEdges = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), edgeMat.clone());
        stepEdges.material.opacity = 0.22;
        stepEdges.scale.set(stepW, stepH, stepD);
        stepEdges.position.set(x, baseY + h + stepH / 2, z);
        group.add(stepEdges);
      }

      const winCount = Math.max(8, Math.floor(w * h * 1.6));
      const positions = new Float32Array(winCount * 3);
      const floors = Math.max(3, Math.floor(h * 0.95));
      const cols = Math.max(2, Math.floor(w * 1.5));
      let idx = 0;

      for (let f = 0; f < floors && idx < winCount; f++) {
        for (let c = 0; c < cols && idx < winCount; c++) {
          if (rng() < 0.6) {
            const fx = -w / 2 + (c + 0.5) * (w / cols);
            const fy = baseY + (f + 0.5) * (h / floors);
            positions[idx * 3 + 0] = x + fx;
            positions[idx * 3 + 1] = fy;
            positions[idx * 3 + 2] = z + d / 2 + 0.02;
            idx++;
          }
        }
      }

      if (idx > 0) {
        const winGeo = new THREE.BufferGeometry();
        winGeo.setAttribute('position', new THREE.BufferAttribute(positions.slice(0, idx * 3), 3));
        const pts = new THREE.Points(winGeo, (rng() > 0.55 ? windowMatCream : windowMatGold).clone());
        pts.material.opacity *= (0.55 + rng() * 0.45);
        group.add(pts);
      }

      if (h > 14 && rng() > 0.55) {
        const antMat = new THREE.MeshBasicMaterial({ color: 0xC9A24B, transparent: true, opacity: 0.5 });
        const antH = 3 + rng() * 5;
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, antH, 6), antMat);
        ant.position.set(x + (rng() - 0.5) * w * 0.3, baseY + h + antH / 2, z);
        group.add(ant);
      }

      return group;
    };

    const LANE_WIDTH = 5.2;
    const lanes = [];
    for (let lx = -7; lx >= -16; lx--) lanes.push(lx * LANE_WIDTH);
    for (let rx = 7; rx <= 16; rx++) lanes.push(rx * LANE_WIDTH);

    const Z_SPACING = 7.2;
    const slotCount = Math.ceil(CORRIDOR / Z_SPACING);
    this.buildings = [];

    for (let li = 0; li < lanes.length; li++) {
      const laneX = lanes[li];
      for (let s = 0; s < slotCount; s++) {
        const z = Z_START + s * Z_SPACING + (rng() - 0.5) * 2.5;
        if (rng() < 0.2) continue;

        const w = 2.6 + rng() * 3.6;
        const d = 2.6 + rng() * 3.6;
        const laneCenterness = 1 - Math.min(1, Math.abs(laneX) / (16 * LANE_WIDTH));
        const heightBoost = THREE.MathUtils.lerp(1.0, 1.45, laneCenterness);
        const distFactor = (z - Z_START) / CORRIDOR;
        const maxH = THREE.MathUtils.lerp(34, 20, distFactor);
        const h = (5 + Math.pow(rng(), 1.3) * maxH) * heightBoost;

        const xJitter = (rng() - 0.5) * (LANE_WIDTH * 0.4);
        const building = buildBuilding(laneX + xJitter, z, w, h, d);
        this.world.add(building);
        this.buildings.push({ group: building });
      }
    }

    const edgeStripGeo = new THREE.PlaneGeometry(0.6, CORRIDOR + 60);
    edgeStripGeo.rotateX(-Math.PI / 2);

    this.edgeStripMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
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
          float lengthFade = smoothstep(0.0, 0.15, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
          float shimmer = 0.7 + 0.3 * sin(vUv.y * 30.0 - uTime * 1.8);
          float a = lengthFade * 0.5 * shimmer;
          vec3 color = vec3(0.788, 0.635, 0.294);
          gl_FragColor = vec4(color, a);
        }
      `
    });

    const leftEdge = new THREE.Mesh(edgeStripGeo, this.edgeStripMat);
    leftEdge.position.set(-4.2, 0.08, -65);
    this.world.add(leftEdge);

    const rightEdge = new THREE.Mesh(edgeStripGeo.clone(), this.edgeStripMat);
    rightEdge.position.set(4.2, 0.08, -65);
    this.world.add(rightEdge);

    const horizonMat = new THREE.MeshBasicMaterial({
      color: 0xC9A24B,
      transparent: true,
      opacity: 0.12,
      depthWrite: false
    });

    const horizon = new THREE.Mesh(new THREE.PlaneGeometry(420, 6), horizonMat);
    horizon.position.set(0, 4, -180);
    this.world.add(horizon);

    const hazeMat = new THREE.MeshBasicMaterial({
      color: 0x12161E,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    });

    const haze = new THREE.Mesh(new THREE.PlaneGeometry(500, 30), hazeMat);
    haze.position.set(0, 8, -185);
    this.world.add(haze);

    this.world.position.z = CORRIDOR * 0.78;
    for (let i = 0; i < this.buildings.length; i++) {
      const b = this.buildings[i];
      const worldZ = b.group.position.z + this.world.position.z;
      if (worldZ > Z_END) b.group.position.z -= CORRIDOR;
    }

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

      this.world.position.z += 14 * dt;

      for (let i = 0; i < this.buildings.length; i++) {
        const b = this.buildings[i];
        const worldZ = b.group.position.z + this.world.position.z;
        if (worldZ > this.Z_END) b.group.position.z -= this.CORRIDOR;
      }

      this.terrainMat.uniforms.uTime.value = this.elapsed;
      this.mistMat.uniforms.uTime.value = this.elapsed;
      this.edgeStripMat.uniforms.uTime.value = this.elapsed;

      this.currentMx += (this.targetMx - this.currentMx) * 0.04;
      this.currentMy += (this.targetMy - this.currentMy) * 0.04;
      this.camera.position.x = this.currentMx * 5.5;
      this.camera.position.y = 22 + this.currentMy * 3.5;
      this.camera.lookAt(0, 8, 0);

      this.spotCurrentX += (this.spotTargetX - this.spotCurrentX) * 0.1;
      this.spotCurrentY += (this.spotTargetY - this.spotCurrentY) * 0.1;
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
