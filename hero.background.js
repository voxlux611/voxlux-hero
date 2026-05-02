class VoxluxHero extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

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
            radial-gradient(ellipse at 50% 30%, #0E141C 0%, #07090D 55%, #030406 100%);
        }

        .stars {
          position: absolute;
          inset: 0;
          background-image:
            radial-gradient(1px 1px at 20% 20%, rgba(245,241,232,0.45), transparent),
            radial-gradient(1px 1px at 40% 15%, rgba(245,241,232,0.3), transparent),
            radial-gradient(1px 1px at 65% 25%, rgba(201,162,75,0.35), transparent),
            radial-gradient(1px 1px at 80% 10%, rgba(245,241,232,0.25), transparent);
          opacity: 0.7;
          animation: twinkle 4s ease-in-out infinite alternate;
        }

        .glow {
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          background: radial-gradient(circle,
            rgba(201,162,75,0.22) 0%,
            rgba(201,162,75,0.08) 35%,
            rgba(201,162,75,0.02) 55%,
            transparent 70%);
          filter: blur(18px);
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          animation: drift 8s ease-in-out infinite alternate;
          mix-blend-mode: screen;
        }

        .vignette {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, transparent 42%, rgba(3,4,6,0.6) 100%);
        }

        @keyframes twinkle {
          0% { opacity: 0.35; }
          100% { opacity: 0.78; }
        }

        @keyframes drift {
          0%   { transform: translate(-55%, -50%); }
          50%  { transform: translate(-45%, -52%); }
          100% { transform: translate(-52%, -46%); }
        }
      </style>

      <div class="hero">
        <div class="stars"></div>
        <div class="glow"></div>
        <div class="vignette"></div>
      </div>
    `;
  }
}

customElements.define("voxlux-hero", VoxluxHero);
