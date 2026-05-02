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

        .vignette {
          position: absolute;
          inset: 0;
          z-index: 4;
          pointer-events: none;
          background: radial-gradient(ellipse at center, transparent 42%, rgba(3,4,6,0.6) 100%);
        }
      </style>

      <div class="hero">
        <div class="stars"></div>
        <canvas></canvas>
        <div class="atmosphere"></div>
        <div class="vignette"></div>
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
      script.onload = () => resolve();
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
      alpha: true
    });

    this.renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setClearColor(0x030406, 0);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
    this.camera.position.set(0, 14, 55);
    this.camera.lookAt(0, 6, 0);

    this.world = new THREE.Group();
    this.scene.add(this.world);

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0x0f1520,
      transparent: true,
      opacity: 0.95
    });

    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xC9A24B,
      transparent: true,
      opacity: 0.18
    });

    this.buildings = [];
    const cols = isMobile ? 10 : 16;
    const rows = isMobile ? 16 : 24;

    for (let side of [-1, 1]) {
      for (let x = 0; x < cols; x++) {
        for (let z = 0; z < rows; z++) {
          const w = 2 + Math.random() * 2.5;
          const h = 5 + Math.random() * 22;
          const d = 2 + Math.random() * 2.5;

          const mesh = new THREE.Mesh(boxGeo, material.clone());
          mesh.scale.set(w, h, d);
          mesh.position.set(
            side * (8 + x * 4.8 + Math.random() * 1.2),
            h / 2 - 2,
            -120 + z * 8
          );
          this.world.add(mesh);

          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), edgeMat.clone());
          edges.scale.set(w, h, d);
          edges.position.copy(mesh.position);
          this.world.add(edges);

          this.buildings.push({ mesh, edges });
        }
      }
    }

    const roadGeo = new THREE.PlaneGeometry(18, 260);
    roadGeo.rotateX(-Math.PI / 2);

    const roadMat = new THREE.MeshBasicMaterial({
      color: 0x07090d
    });

    this.road = new THREE.Mesh(roadGeo, roadMat);
    this.road.position.set(0, -2, -20);
    this.world.add(this.road);

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

      this.world.position.z += 10 * dt;

      for (const b of this.buildings) {
        if (b.mesh.position.z + this.world.position.z > 30) {
          b.mesh.position.z -= 192;
          b.edges.position.z -= 192;
        }
      }

      this.renderer.render(this.scene, this.camera);
      this._raf = requestAnimationFrame(tick);
    };

    this._raf = requestAnimationFrame(tick);
  }
}

customElements.define("voxlux-hero", VoxluxHero);
