import { LitElement, html, css } from 'lit';

export class ModeSwitcher extends LitElement {
  static properties = {
    mode: { type: String, reflect: true },
  };

  static styles = css`
    :host {
      display: flex;
      justify-content: center;
    }

    .segmented-control {
      display: inline-flex;
      background: var(--bg-surface-raised);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      padding: clamp(2px, 0.25vw, 3px);
      gap: clamp(2px, 0.25vw, 3px);
    }

    .seg-btn {
      display: inline-flex;
      align-items: center;
      justify-content: var(--mode-switcher-btn-justify);
      gap: clamp(3px, 0.5vw, 6px);
      background: transparent;
      border: none;
      color: var(--text-muted);
      padding: var(--mode-switcher-btn-padding);
      border-radius: var(--radius-sm);
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      font-size: var(--mode-switcher-btn-font-size);
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
      white-space: nowrap;
      user-select: none;
      -webkit-user-select: none;
      -webkit-tap-highlight-color: transparent;
    }

    .seg-btn span {
      display: var(--mode-switcher-span-display);
    }

    .seg-btn svg {
      width: var(--mode-switcher-btn-svg-size);
      height: var(--mode-switcher-btn-svg-size);
      opacity: 0.7;
      transition: opacity 0.2s ease, transform 0.2s ease;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .seg-btn:hover {
      color: var(--text-secondary);
      background: var(--bg-overlay);
    }

    .seg-btn:hover svg {
      opacity: 1;
    }

    .seg-btn:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 1px;
    }

    .seg-btn.active {
      background: var(--color-primary);
      color: var(--text-inverse);
      box-shadow: 0 4px 12px var(--color-primary-glow);
    }

    .seg-btn.active svg {
      opacity: 1;
      filter: drop-shadow(0 0 2px rgba(255,255,255,0.3));
    }
  `;

  constructor() {
    super();
    this.mode = 'live';
  }

  render() {
    return html`
      <div class="segmented-control">
        <button
          class="seg-btn ${this.mode === 'live' ? 'active' : ''}"
          @click=${this._setLive}
          aria-label="Editable Text"
          title="Editable Text"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          <span>Editable Text</span>
        </button>
        <button
          class="seg-btn ${this.mode === 'vector' ? 'active' : ''}"
          @click=${this._setVector}
          aria-label="Vector Outlines"
          title="Vector Outlines"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 17 22 12"/>
          </svg>
          <span>Vector Outlines</span>
        </button>
      </div>
    `;
  }

  _setLive() {
    if (this.mode !== 'live') {
      this.mode = 'live';
      this._dispatchChange();
    }
  }

  _setVector() {
    if (this.mode !== 'vector') {
      this.mode = 'vector';
      this._dispatchChange();
    }
  }

  _dispatchChange() {
    this.dispatchEvent(new CustomEvent('mode-change', {
      detail: { mode: this.mode },
      bubbles: true,
      composed: true,
    }));
  }
}

customElements.define('mode-switcher', ModeSwitcher);
