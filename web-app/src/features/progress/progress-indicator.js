import { LitElement, html, css } from 'lit';

export class ProgressIndicator extends LitElement {
  static properties = {
    status: { type: String },
    progress: { type: Number },
  };

  static styles = css`
    :host {
      display: block;
      animation: fadeInUp 0.35s ease forwards;
    }

    .status-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: clamp(1.25rem, 3.5vw, 3rem) clamp(1rem, 2.5vw, 2rem);
      text-align: center;
      gap: clamp(0.75rem, 1.5vw, 1.5rem);
    }

    .spinner-ring {
      position: relative;
      width: clamp(36px, 5vw, 56px);
      height: clamp(36px, 5vw, 56px);
    }

    .spinner-ring svg {
      width: clamp(36px, 5vw, 56px);
      height: clamp(36px, 5vw, 56px);
      animation: spin-rotate 2s linear infinite;
    }

    .spinner-ring .bg {
      fill: none;
      stroke: var(--border-color);
      stroke-width: 3;
    }

    .spinner-ring .fg {
      fill: none;
      stroke: var(--color-primary);
      stroke-width: 3;
      stroke-linecap: round;
      stroke-dasharray: 150.8;
      stroke-dashoffset: 113.1;
      animation: spin-dash 1.5s ease-in-out infinite;
      transform-origin: center;
    }

    .status-icon {
      width: 56px;
      height: 56px;
      color: var(--color-primary);
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .status-text {
      font-size: clamp(0.85rem, 1.2vw, 1rem);
      color: var(--text-primary);
      font-weight: 600;
      margin: 0;
    }

    .status-subtext {
      font-size: clamp(0.7rem, 0.85vw, 0.82rem);
      color: var(--text-muted);
      font-weight: 400;
      margin: -0.75rem 0 0 0;
    }

    .progress-bar-track {
      width: 100%;
      max-width: min(70vw, 360px);
      height: clamp(4px, 0.5vw, 6px);
      background: var(--bg-surface-raised);
      border-radius: 3px;
      overflow: hidden;
      border: 1px solid var(--border-color);
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--color-primary), var(--color-accent));
      border-radius: 3px;
      transition: width 0.3s ease;
      will-change: width;
      position: relative;
    }

    .progress-bar-fill::after {
      content: '';
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: 20px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3));
      border-radius: 3px;
    }

    .progress-label {
      font-size: 0.78rem;
      color: var(--text-muted);
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }

    @keyframes spin-rotate {
      100% { transform: rotate(360deg); }
    }

    @keyframes spin-dash {
      0% {
        stroke-dashoffset: 113.1;
        transform: rotate(0deg);
      }
      50% {
        stroke-dashoffset: 18.85;
        transform: rotate(180deg);
      }
      100% {
        stroke-dashoffset: 113.1;
        transform: rotate(360deg);
      }
    }

    @media (max-width: 640px) {
      .status-container {
        padding: 2rem 1.25rem;
        gap: 1.25rem;
      }
      .spinner-ring {
        width: 44px;
        height: 44px;
      }
      .spinner-ring svg {
        width: 44px;
        height: 44px;
      }
    }

    @media (orientation: landscape) and (max-height: 500px) {
      .status-container {
        padding: 1.25rem 1rem;
        gap: 0.75rem;
      }
      .spinner-ring {
        width: 36px;
        height: 36px;
      }
      .spinner-ring svg {
        width: 36px;
        height: 36px;
      }
      .status-text {
        font-size: 0.9rem;
      }
    }
  `;

  constructor() {
    super();
    this.status = 'Preparing document...';
    this.progress = 0;
  }

  render() {
    return html`
      <div class="status-container">
        <div class="spinner-ring">
          <svg viewBox="0 0 48 48">
            <circle class="bg" cx="24" cy="24" r="20"/>
            <circle class="fg" cx="24" cy="24" r="20"/>
          </svg>
        </div>
        <p class="status-text">Converting to SVG</p>
        <p class="status-subtext">${this.status}</p>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" style="width: ${this.progress}%"></div>
        </div>
        <span class="progress-label">${this.progress}%</span>
      </div>
    `;
  }

  updateStatus(text) {
    this.status = text;
  }

  updateProgress(value) {
    this.progress = value;
  }
}

customElements.define('progress-indicator', ProgressIndicator);
