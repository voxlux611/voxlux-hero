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
            radial-gradient(ellipse at 50% 24%, #1a1d22 0%, #0b0d12 48%, #050608 100%);
        }

        .stars {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          opacity: 0.26;
          background-image:
            radial-gradient(1px 1px at 12% 16%, rgba(245,241,232,0.14), transparent),
            radial-gradient(1px 1px at 28% 10%, rgba(245,241,232,0.12), transparent),
            radial-gradient(1px 1px at 42% 18%, rgba(201,162,75,0.12), transparent),
            radial-gradient(1px 1px at 58% 12%, rgba(245,241,232,0.10), transparent),
            radial-gradient(1px 1px at 72% 9%, rgba(245,241,232,0.08), transparent),
            radial-gradient(1px 1px at 86% 15%, rgba(201,162,75,0.10), transparent),
            radial-gradient(1px 1px at 22% 28%, rgba(245,241,232,0.07), transparent),
            radial-gradient(1px 1px at 64% 26%, rgba(245,241,232,0.06), transparent);
          animation: twinkle 8s ease-in-out infinite alternate;
        }

        @keyframes twinkle {
          0% { opacity: 0.16; }
          100% { opacity: 0.30; }
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
              rgba(6,8,10,0.02) 0%,
              rgba(6,8,10,0.00) 18%,
              rgba(6,8,10,0.00) 58%,
              rgba(4,5,7,0.34) 100%
            ),
            radial-gradient(ellipse at center,
              transparent 26%,
              rgba(4,5,7,0.16) 72%,
              rgba(3,4,6,0.42) 100%);
        }

        .spotlight {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          z-index: 4;
          pointer-events: none;
          opacity: 0.34;
          filter: blur(24px);
          mix-blend-mode: screen;
          background: radial-gradient(circle,
            rgba(201,162,75,0.11) 0%,
            rgba(201,162,75,0.05) 28%,
            rgba(201,162,75,0.015) 52%,
            transparent 70%);
        }

        .frameGlow {
          position: absolute;
          inset: 0;
          z-index: 5;
          pointer-events: none;
          box-shadow:
            inset 0 0 120px rgba(201,162,75,0.07),
            inset 0 0 210px rgba(255,255,255,0.015),
            inset 0 -85px 120px rgba(0,0,0,0.28);
          border: 1px solid rgba(201,162,75,0.05);
        }

        .vignette {
          position: absolute;
          inset: 0;
          z-index: 6;
          pointer-events: none;
          background:
            radial-gradient(ellipse at center,
              transparent 34%,
              rgba(3,4,6,0.18) 72%,
              rgba(2,3,4,0.48) 100%);
        }

        @media (max-width: 768px) {
          .spotlight {
            width: 400px;
            height: 400px;
            opacity: 0.24;
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
    this.scene.fog = new THREE.Fog(0x060709, 52, 195);

    /* START EVEN CLOSER TO CITY */
    this.startCamPos = new THREE.Vector3(0, 10.6, 27);
    this.endCamPos = new THREE.Vector3(0, 7.6, 20);

    this.startLookAt = new THREE.Vector3(0, 6.3, -14);
    this.endLookAt = new THREE.Vector3(0, 4.6, -6);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.camera.position.copy(this.startCamPos);
    this.camera.lookAt(this.startLookAt);

    this.tempCam = new THREE.Vector3();
    this.tempLook = new THREE.Vector3();

    this.world = new THREE.Group();
    this.scene.add(this.world);

    const ambient = new THREE.AmbientLight(0xffffff, 0.52);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0x2d3138, 0x050608, 0.62);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xf2ead8, 0.18);
    key.position.set(-12, 18, 14);
    this.scene.add(key);

    const goldRim = new THREE.DirectionalLight(0xc9a24b, 0.42);
    goldRim.position.set(12, 10, 16);
    this.scene.add(goldRim);

    /* BLACK + GOLD HILLY LUXURY FLOOR */
    const terrainHeight = (x, z) => {
      const broad = Math.sin(z * 0.034) * 1.08;
      const secondary = Math.sin((z + x * 0.34) * 0.060) * 0.40;
      const tertiary = Math.sin((z * 0.090) + (x * 0.055)) * 0.18;
      const micro = Math.sin((z * 0.18) - (x * 0.07)) * 0.08;

      const sideRise = Math.pow(Math.min(1, Math.abs(x) / 40), 1.55) * 8.8;
      const roadCut = Math.exp(-(x * x) / 120) * 2.75;

      let h = -3.9 + broad + secondary + tertiary + micro + sideRise - roadCut;

      /* terrace effect for layered hills */
      h = Math.round(h * 4.2) / 4.2;

      return h;
    };

    const roadHeight = (x, z) => {
      const base = terrainHeight(x, z);
      const crown = 0.10 - Math.pow(x / 7.2, 2) * 0.10;
      return base + 0.20 + crown;
    };

    this.terrainHeight = terrainHeight;

    const terrainGeo = new THREE.PlaneGeometry(260, 320, 100, 150);
    terrainGeo.rotateX(-Math.PI / 2);

    const tPos = terrainGeo.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
      const x = tPos.getX(i);
      const z = tPos.getZ(i);
      tPos.setY(i, terrainHeight(x, z));
    }
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.ShaderMaterial({
      uniforms: {
        uBase: { value: new THREE.Color(0x090a0d) },
        uMid: { value: new THREE.Color(0x131419) },
        uGold: { value: new THREE.Color(0xc9a24b) }
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
        uniform vec3 uBase;
        uniform vec3 uMid;
        uniform vec3 uGold;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
          float slope = 1.0 - clamp(vNormal.y, 0.0, 1.0);
          float elev = clamp((vElevation + 8.0) / 16.0, 0.0, 1.0);
          float contour = smoothstep(0.88, 0.98, sin(vElevation * 5.5) * 0.5 + 0.5);
          float n = noise(vPosition.xz * 0.28) * 0.6 + noise(vPosition.xz * 0.95) * 0.4;
          float grain = smoothstep(0.50, 0.88, n) * 0.18;

          vec3 color = mix(uBase, uMid, elev * 0.55 + grain * 0.5);
          color = mix(color, uGold * 0.32, contour * 0.18 + slope * 0.10);

          gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.position.z = -36;
    this.world.add(terrain);

    /* shoulders / luxury floor */
    const shoulderLeftGeo = new THREE.PlaneGeometry(16, 320, 20, 150);
    shoulderLeftGeo.rotateX(-Math.PI / 2);
    const slPos = shoulderLeftGeo.attributes.position;
    for (let i = 0; i < slPos.count; i++) {
      const x = slPos.getX(i) - 16.2;
      const z = slPos.getZ(i) - 36;
      slPos.setY(i, terrainHeight(x, z) + 0.06);
    }
    shoulderLeftGeo.computeVertexNormals();

    const shoulderRightGeo = new THREE.PlaneGeometry(16, 320, 20, 150);
    shoulderRightGeo.rotateX(-Math.PI / 2);
    const srPos = shoulderRightGeo.attributes.position;
    for (let i = 0; i < srPos.count; i++) {
      const x = srPos.getX(i) + 16.2;
      const z = srPos.getZ(i) - 36;
      srPos.setY(i, terrainHeight(x, z) + 0.06);
    }
    shoulderRightGeo.computeVertexNormals();

    const shoulderMat = new THREE.ShaderMaterial({
      uniforms: {
        uBase: { value: new THREE.Color(0x0b0c10) },
        uMid: { value: new THREE.Color(0x14161b) },
        uGold: { value: new THREE.Color(0xc9a24b) }
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
        uniform vec3 uBase;
        uniform vec3 uMid;
        uniform vec3 uGold;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
        }

        void main() {
          float slope = 1.0 - clamp(vNormal.y, 0.0, 1.0);
          float contour = smoothstep(0.86, 0.98, sin(vElevation * 6.4) * 0.5 + 0.5);
          float n = noise(vPosition.xz * 0.35) * 0.65 + noise(vPosition.xz * 1.2) * 0.35;
          float textureVal = smoothstep(0.50, 0.90, n);

          vec3 color = mix(uBase, uMid, textureVal * 0.55);
          color = mix(color, uGold * 0.34, contour * 0.16 + slope * 0.08);

          gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    const leftShoulder = new THREE.Mesh(shoulderLeftGeo, shoulderMat);
    leftShoulder.position.set(-16.2, 0, -36);
    this.world.add(leftShoulder);

    const rightShoulder = new THREE.Mesh(shoulderRightGeo, shoulderMat);
    rightShoulder.position.set(16.2, 0, -36);
    this.world.add(rightShoulder);

    /* road */
    const roadWidth = 14.6;
    const roadLength = 295;
    const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLength, 28, 150);
    roadGeo.rotateX(-Math.PI / 2);

    const rPos = roadGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const x = rPos.getX(i);
      const z = rPos.getZ(i) - 36;
      rPos.setY(i, roadHeight(x, z));
    }
    roadGeo.computeVertexNormals();

    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x0a0d11,
      roughness: 1,
      metalness: 0.03
    });

    const road = new THREE.Mesh(roadGeo, roadMat);
    road.position.z = -36;
    this.world.add(road);

    /* subtle road edge glow */
    const edgeStripGeo = new THREE.PlaneGeometry(0.42, roadLength, 1, 220);
    edgeStripGeo.rotateX(-Math.PI / 2);

    const ePos = edgeStripGeo.attributes.position;
    for (let i = 0; i < ePos.count; i++) {
      const x = ePos.getX(i);
      const z = ePos.getZ(i) - 36;
      ePos.setY(i, roadHeight(x, z) + 0.05);
    }

    const edgeStripMat = new THREE.ShaderMaterial({
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
          float fadeEnds = smoothstep(0.03, 0.18, vUv.y) * (1.0 - smoothstep(0.84, 0.98, vUv.y));
          float shimmer = 0.80 + 0.20 * sin(vUv.y * 28.0 - uTime * 0.7);
          float alpha = fadeEnds * shimmer * 0.22;
          vec3 color = vec3(0.788, 0.635, 0.294);
          gl_FragColor = vec4(color, alpha);
        }
      `
    });

    const leftEdge = new THREE.Mesh(edgeStripGeo, edgeStripMat);
    leftEdge.position.set(-6.95, 0, -36);
    this.world.add(leftEdge);

    const rightEdge = new THREE.Mesh(edgeStripGeo.clone(), edgeStripMat.clone());
    rightEdge.position.set(6.95, 0, -36);
    this.world.add(rightEdge);

    this.edgeStripMaterials = [leftEdge.material, rightEdge.material];

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
      shininess: 14,
      transparent: true,
      opacity: 0.97
    });

    /* brighter soft streak windows with glow */
    const streakGeo = new THREE.PlaneGeometry(0.42, 0.075);
    const glowGeo = new THREE.PlaneGeometry(0.72, 0.16);

    const makeWindowMaterial = () => new THREE.MeshBasicMaterial({
      color: 0xf0e6d3,
      transparent: true,
      opacity: 0.22,
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

      if (h > 15 && rng() > 0.40) {
        const stepW = w * (0.58 + rng() * 0.16);
        const stepD = d * (0.58 + rng() * 0.16);
        const stepH = 1.8 + rng() * 3.0;

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

      const floors = Math.max(4, Math.floor(h / 2.2));
      const cols = Math.max(2, Math.floor(w / 1.02));
      const yStart = baseY + h * 0.12;
      const usableH = h * 0.72;
      const usableW = w * 0.78;

      for (let fy = 0; fy < floors; fy++) {
        for (let fx = 0; fx < cols; fx++) {
          if (rng() < 0.88) {
            const glow = new THREE.Mesh(glowGeo, makeGlowMaterial());
            glow.scale.x = 0.85 + rng() * 0.25;
            glow.position.set(
              x - usableW / 2 + (fx + 0.5) * (usableW / cols),
              yStart + (fy + 0.5) * (usableH / floors),
              z + d / 2 + 0.038
            );
            group.add(glow);

            const streak = new THREE.Mesh(streakGeo, makeWindowMaterial());
            streak.scale.x = 0.76 + rng() * 0.18;
            streak.position.set(
              glow.position.x,
              glow.position.y,
              z + d / 2 + 0.046
            );
            group.add(streak);
          }
        }
      }

      if (h > 18 && rng() > 0.65) {
        const antH = 2.8 + rng() * 3.4;
        const antenna = new THREE.Mesh(
          new THREE.CylinderGeometry(0.035, 0.035, antH, 6),
          new THREE.MeshBasicMaterial({
            color: 0xc9a24b,
            transparent: true,
            opacity: 0.34
          })
        );
        antenna.position.set(x + (rng() - 0.5) * w * 0.22, baseY + h + antH / 2, z);
        group.add(antenna);
      }

      return group;
    };

    this.buildings = [];
    this.corridorLength = 270;

    const zStart = -170;
    const zSpacing = 8.2;
    const rows = isMobile ? 20 : 26;

    const columns = [
      -42, -36, -30, -24, -18, -13, -9,
        9,  13,  18,  24,  30,  36,  42
    ];

    for (let ci = 0; ci < columns.length; ci++) {
      const laneX = columns[ci];

      for (let r = 0; r < rows; r++) {
        if (rng() < 0.08) continue;

        const z = zStart + r * zSpacing + (rng() - 0.5) * 1.4;
        const sideFactor = 1 - Math.min(1, Math.abs(laneX) / 44);
        const w = 2.8 + rng() * 3.2;
        const d = 2.8 + rng() * 3.0;
        const h = (9 + Math.pow(rng(), 1.18) * 22) * (0.95 + sideFactor * 0.28);

        const x = laneX + (rng() - 0.5) * 0.8;
        const group = buildBuilding(x, z, w, h, d);

        this.world.add(group);
        this.buildings.push(group);
      }
    }

    this.world.position.z = 82;

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

    this.currentMx += (this.targetMx - this.currentMx) * 0.035;
    this.currentMy += (this.targetMy - this.currentMy) * 0.035;

    this.tempCam.lerpVectors(this.startCamPos, this.endCamPos, progress);
    this.tempLook.lerpVectors(this.startLookAt, this.endLookAt, progress);

    this.tempCam.x += this.currentMx * 1.3;
    this.tempCam.y += this.currentMy * 0.60 + Math.sin(this.elapsed * 0.22) * 0.08;
    this.tempCam.z += Math.sin(this.elapsed * 0.10) * 0.12;

    this.tempLook.x += this.currentMx * 1.7;
    this.tempLook.y += this.currentMy * 0.28;

    this.camera.position.copy(this.tempCam);
    this.camera.lookAt(this.tempLook);
  }

  animate() {
    const tick = () => {
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.elapsed += dt;

      const speed = 9.2;
      this.world.position.z += speed * dt;

      for (let i = 0; i < this.buildings.length; i++) {
        const b = this.buildings[i];
        const worldZ = b.position.z + this.world.position.z;
        if (worldZ > 36) {
          b.position.z -= this.corridorLength;
        }
      }

      const introProgress = Math.min(1, this.elapsed / 4.6);
      this.updateCamera(introProgress);

      if (this.edgeStripMaterials) {
        for (let i = 0; i < this.edgeStripMaterials.length; i++) {
          this.edgeStripMaterials[i].uniforms.uTime.value = this.elapsed;
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
