import { LitElement, html, css } from 'lit';

export class GlobalDragOverlay extends LitElement {
  static styles = css`
    :host {
      position: absolute;
      inset: 0;
      background: var(--glass-bg);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border: 2px dashed var(--color-primary);
      border-radius: var(--radius-xl);
      margin: clamp(0.5rem, 1.2vw, 1.25rem);
      margin-bottom: calc(clamp(0.5rem, 1.2vw, 1.25rem) + var(--safe-area-bottom));
      z-index: 99;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      animation: scaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .global-drag-content {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .global-drag-content svg {
      width: 64px;
      height: 64px;
      color: var(--color-primary);
      filter: drop-shadow(0 4px 12px var(--color-primary-glow));
      animation: pulse 2s infinite ease-in-out;
    }

    .global-drag-content p {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;

  render() {
    return html`
      <div class="global-drag-content">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="14 2 14 8 20 8" stroke-linecap="round" stroke-linejoin="round"/>
          <line x1="12" y1="18" x2="12" y2="12" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="9 15 12 12 15 15" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>Drop PDF to convert</p>
      </div>
    `;
  }
}

customElements.define('global-drag-overlay', GlobalDragOverlay);
