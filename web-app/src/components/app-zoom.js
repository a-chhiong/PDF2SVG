import { LitElement, html, css } from 'lit';

/**
 * AppZoom — A premium floating control bar for zoom and pan settings.
 * Emits:
 * - zoom-in
 * - zoom-out
 * - zoom-reset
 * - pan-mode-change (detail: { panMode })
 */
export class AppZoom extends LitElement {
  static properties = {
    zoom: { type: Number },
    panMode: { type: Boolean },
  };

  static styles = css`
    :host {
      display: inline-block;
      user-select: none;
      -webkit-user-select: none;
    }

    .zoom-bar {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--glass-bg, rgba(255, 255, 255, 0.85));
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--border-color, #e2e4ea);
      border-radius: var(--radius-md, 12px);
      padding: 4px;
      box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.08));
      pointer-events: auto;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    .zoom-bar:hover {
      border-color: var(--border-color-strong, #c8cad2);
      box-shadow: var(--shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.12));
    }

    .ctrl-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      background: transparent;
      color: var(--text-secondary, #4a4a6a);
      border-radius: var(--radius-sm, 8px);
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .ctrl-btn svg {
      width: 16px;
      height: 16px;
      stroke-width: 2.2;
      transition: transform 0.2s ease;
    }

    .ctrl-btn:hover {
      background: var(--bg-surface-hover, #e8e9ee);
      color: var(--text-primary, #1a1a2e);
    }

    .ctrl-btn:active {
      transform: scale(0.95);
    }

    .ctrl-btn.active {
      background: var(--color-primary, #6c5ce7);
      color: var(--text-inverse, #ffffff);
      box-shadow: 0 2px 8px var(--color-primary-glow, rgba(108, 92, 231, 0.2));
    }

    .ctrl-btn.active:hover {
      background: var(--color-primary-hover, #5a4bd1);
      color: var(--text-inverse, #ffffff);
    }

    .divider {
      width: 1px;
      height: 20px;
      background: var(--border-color, #e2e4ea);
      margin: 0 4px;
    }

    .zoom-value {
      min-width: 48px;
      text-align: center;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--text-secondary, #4a4a6a);
      cursor: pointer;
      padding: 0 6px;
      border-radius: var(--radius-xs, 6px);
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .zoom-value:hover {
      background: var(--bg-surface-hover, #e8e9ee);
      color: var(--color-primary, #6c5ce7);
    }
  `;

  constructor() {
    super();
    this.zoom = 1;
    this.panMode = false;
  }

  render() {
    const zoomPct = Math.round(this.zoom * 100);

    return html`
      <div class="zoom-bar">
        <!-- Selection / Pointer Mode Button -->
        <button
          class="ctrl-btn ${!this.panMode ? 'active' : ''}"
          @click=${() => this._setPanMode(false)}
          title="Select Text (Left Click)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
            <path d="M13 13l6 6"/>
          </svg>
        </button>

        <!-- Pan / Hand Mode Button -->
        <button
          class="ctrl-btn ${this.panMode ? 'active' : ''}"
          @click=${() => this._setPanMode(true)}
          title="Pan / Hand Tool (Spacebar + Drag)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5"/>
            <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6"/>
            <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
            <path d="M6 14a4 4 0 0 0-4-4v0a4 4 0 0 0-4 4v5a9 9 0 0 0 9 9h3a9 9 0 0 0 9-9v-3"/>
          </svg>
        </button>

        <div class="divider"></div>

        <!-- Zoom Out Button -->
        <button
          class="ctrl-btn"
          @click=${this._zoomOut}
          title="Zoom Out"
          ?disabled=${this.zoom <= 0.25}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>

        <!-- Clickable Zoom Percentage Label (Resets Zoom) -->
        <div
          class="zoom-value"
          @click=${this._zoomReset}
          title="Click to reset zoom to 100%"
        >
          ${zoomPct}%
        </div>

        <!-- Zoom In Button -->
        <button
          class="ctrl-btn"
          @click=${this._zoomIn}
          title="Zoom In"
          ?disabled=${this.zoom >= 4}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>

        <div class="divider"></div>

        <!-- Reset Button -->
        <button
          class="ctrl-btn"
          @click=${this._zoomReset}
          title="Reset to 100%"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
          </svg>
        </button>
      </div>
    `;
  }

  _setPanMode(val) {
    if (this.panMode !== val) {
      this.panMode = val;
      this.dispatchEvent(new CustomEvent('pan-mode-change', {
        detail: { panMode: val },
        bubbles: true,
        composed: true,
      }));
    }
  }

  _zoomIn() {
    this.dispatchEvent(new CustomEvent('zoom-in', { bubbles: true, composed: true }));
  }

  _zoomOut() {
    this.dispatchEvent(new CustomEvent('zoom-out', { bubbles: true, composed: true }));
  }

  _zoomReset() {
    this.dispatchEvent(new CustomEvent('zoom-reset', { bubbles: true, composed: true }));
  }
}

customElements.define('app-zoom', AppZoom);
