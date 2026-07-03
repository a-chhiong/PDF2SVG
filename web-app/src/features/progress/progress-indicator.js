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
      padding: var(--progress-container-padding);
      text-align: center;
      gap: var(--progress-container-gap);
    }

    .spinner-ring {
      position: relative;
      width: var(--progress-spinner-size);
      height: var(--progress-spinner-size);
    }

    .spinner-ring svg {
      width: var(--progress-spinner-size);
      height: var(--progress-spinner-size);
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
      font-size: var(--progress-status-font-size);
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
