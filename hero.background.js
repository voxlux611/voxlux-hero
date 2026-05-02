class VoxluxHero extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._raf = null;
    this._cleanup = [];

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
            radial-gradient(1px 1px at 88% 18%, rgba(201,162,75,0.35), transparent);
          opacity: 0.55;
          animation: twinkle 6s ease-in-out infinite alternate;
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
            linear-gradient(180deg, rgba(5,7,11,0.20) 0%, transparent 28%, transparent 70%, rgba(3,4,6,0.45) 100%),
            radial-gradient(ellipse at center, transparent 35%, rgba(3,4,6,0.45) 100%);
        }

        @keyframes twinkle {
          0% { opacity: 0.3; }
          100% { opacity: 0.7; }
        }
      </style>

      <div class="hero">
        <div class="stars"></div>
        <canvas></canvas>
        <div class="atmosphere"></div>
      </div>
    `;
  }

  async connectedCallback() {
    try {
      this.hero = this.shadowRoot.querySelector(".hero");
      this.canvas = this.shadowRoot.querySelector("canvas");

      await this.loadThree();
      this.initScene();
      this.initObservers();
      this.resize();
      this.animate();
    } catch (err) {
      console.error("VoxLux city failed:", err);
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
    this.scene.fog = new THREE.Fog(0x050608, 80, 220);

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    this.camera.position.set(0, 10, 38);
    this.camera.lookAt(0, 6, -40);

    this.world = new THREE.Group();
    this.scene.add(this.world);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xc9a24b, 0.5);
    dir.position.set(8, 12, 10);
    this.scene.add(dir);

    const roadGeo = new THREE.PlaneGeometry(18, 300);
    roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.position.set(0, -2, -90);
    this.world.add(road);

    const laneGeo = new THREE.PlaneGeometry(0.18, 300);
    laneGeo.rotateX(-Math.PI / 2);
    const laneMat = new THREE.MeshBasicMaterial({
      color: 0xc9a24b,
      transparent: true,
      opacity: 0.55
    });

    const laneLeft = new THREE.Mesh(laneGeo, laneMat);
    laneLeft.position.set(-3.2, -1.98, -90);
    this.world.add(laneLeft);

    const laneRight = new THREE.Mesh(laneGeo, laneMat);
    laneRight.position.set(3.2, -1.98, -90);
    this.world.add(laneRight);

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    this.buildings = [];

    const makeBodyMaterial = () => new THREE.MeshBasicMaterial({
      color: 0x111826,
      transparent: true,
      opacity: 0.96
    });

    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0xc9a24b,
      transparent: true,
      opacity: 0.32
    });

    const windowMaterial = new THREE.PointsMaterial({
      color: 0xf5f1e8,
      size: isMobile ? 0.16 : 0.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const sides = [-1, 1];
    const columns = isMobile ? 8 : 12;
    const rows = isMobile ? 20 : 28;

    for (const side of sides) {
      for (let c = 0; c < columns; c++) {
        for (let r = 0; r < rows; r++) {
          const w = 2.4 + Math.random() * 2.8;
          const d = 2.4 + Math.random() * 2.8;
          const h = 8 + Math.random() * 28;

          const xBase = side * (9 + c * 5.2);
          const x = xBase + (Math.random() - 0.5) * 1.4;
          const z = -210 + r * 10;

          const body = new THREE.Mesh(boxGeo, makeBodyMaterial());
          body.scale.set(w, h, d);
          body.position.set(x, h / 2 - 2, z);
          this.world.add(body);

          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(boxGeo),
            edgeMaterial.clone()
          );
          edges.scale.set(w, h, d);
          edges.position.copy(body.position);
          this.world.add(edges);

          const floors = Math.max(3, Math.floor(h / 2.2));
          const cols = Math.max(2, Math.floor(w / 0.9));
          const windowPositions = [];

          for (let fy = 0; fy < floors; fy++) {
            for (let fx = 0; fx < cols; fx++) {
              if (Math.random() < 0.58) {
                windowPositions.push(
                  x - w / 2 + (fx + 0.5) * (w / cols),
                  body.position.y - h / 2 + (fy + 0.6) * (h / floors),
                  z + d / 2 + 0.03
                );
              }
            }
          }

          if (windowPositions.length) {
            const windowGeo = new THREE.BufferGeometry();
            windowGeo.setAttribute(
              "position",
              new THREE.Float32BufferAttribute(windowPositions, 3)
            );
            const windows = new THREE.Points(windowGeo, windowMaterial.clone());
            this.world.add(windows);
            this.buildings.push({ body, edges, windows });
          } else {
            this.buildings.push({ body, edges, windows: null });
          }
        }
      }
    }

    this.world.position.z = 120;
    this.clock = new THREE.Clock();
  }

  initObservers() {
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this);
    this._cleanup.push(() => ro.disconnect());
  }

  resize() {
    if (!this.renderer || !this.camera) return;

    const w = this.clientWidth || 1200;
    const h = this.clientHeight || 800;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  animate() {
    const tick = () => {
      const dt = Math.min(this.clock.getDelta(), 0.05);

      this.world.position.z += 14 * dt;

      for (const item of this.buildings) {
        const zNow = item.body.position.z + this.world.position.z;
        if (zNow > 40) {
          item.body.position.z -= 280;
          item.edges.position.z -= 280;
          if (item.windows) item.windows.position.z -= 280;
        }
      }

      this.renderer.render(this.scene, this.camera);
      this._raf = requestAnimationFrame(tick);
    };

    this._raf = requestAnimationFrame(tick);
  }
}

customElements.define("voxlux-hero", VoxluxHero);
