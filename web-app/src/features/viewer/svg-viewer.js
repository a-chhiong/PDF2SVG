import { LitElement, html, css } from 'lit';
import './svg-item.js';

export class SvgViewer extends LitElement {
  static properties = {
    svgList: { type: Object },
    _copiedIndex: { type: Number, state: true },
    _expandedIndex: { type: Number, state: true },
  };

  static styles = css`
    :host {
      display: block;
      animation: fadeInUp 0.35s ease forwards;
    }

    .output-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .svg-viewer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .svg-viewer-header h2 {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text-primary);
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0;
    }

    .svg-viewer-header h2 svg {
      width: 20px;
      height: 20px;
      color: var(--color-accent);
      stroke-linecap: round;
      stroke-linejoin: round;
      filter: drop-shadow(0 0 4px var(--color-accent-light));
    }

    .svg-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    /* ===== Button styles (inlined for Shadow DOM) ===== */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 0.6rem 1.25rem;
      border-radius: var(--radius-sm);
      font-family: 'Inter', sans-serif;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      white-space: nowrap;
      line-height: 1;
      user-select: none;
      -webkit-user-select: none;
      text-decoration: none;
      min-height: 38px;
    }

    .btn svg {
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* "Restart" button — coral/rose, distinct from everything else */
    .btn-restart {
      background: rgba(220, 38, 38, 0.06);
      color: var(--color-error);
      border: 1px solid rgba(220, 38, 38, 0.15);
    }

    .btn-restart:hover {
      background: rgba(220, 38, 38, 0.12);
      color: #b91c1c;
      border-color: rgba(220, 38, 38, 0.3);
      transform: translateY(-1px);
      box-shadow: 0 2px 10px rgba(220, 38, 38, 0.15);
    }

    .btn-restart:active {
      transform: translateY(0);
      box-shadow: none;
    }

    :host-context([data-theme="dark"]) .btn-restart {
      background: rgba(248, 113, 113, 0.08);
      color: #f87171;
      border-color: rgba(248, 113, 113, 0.15);
    }

    :host-context([data-theme="dark"]) .btn-restart:hover {
      background: rgba(248, 113, 113, 0.15);
      color: #fca5a5;
      border-color: rgba(248, 113, 113, 0.3);
    }

    @media (max-width: 560px) {
      .svg-viewer-header {
        flex-direction: column;
        align-items: stretch;
      }
      .svg-viewer-header .btn {
        justify-content: center;
        width: 100%;
      }
    }
  `;

  constructor() {
    super();
    this.svgList = /** @type {any} */([]);
    this._copiedIndex = -1;
    this._expandedIndex = 0;
  }

  render() {
    return html`
      <div class="output-container">
        <div class="svg-viewer-header">
          <h2>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 17 22 12"/>
            </svg>
            Generated SVGs
          </h2>
          <button class="btn btn-restart" @click=${this._onRestart}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
              <path d="M16 3h5v5"/>
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
              <path d="M8 21H3v-5"/>
            </svg>
            Restart
          </button>
        </div>

        <div class="svg-list">
          ${this.svgList.map((item, index) => html`
            <svg-item
              .pageNum=${item.pageNum}
              .fileName=${item.fileName}
              .svgHtml=${item.originalSvgHtml}
              .isExpanded=${this._expandedIndex === index}
              .isCopied=${this._copiedIndex === index}
              @toggle=${() => this._toggleExpand(index)}
              @copy-svg=${() => this._handleCopy(item.originalSvgHtml, index)}
              @download-svg=${() => this._handleDownload(item.originalSvgHtml, item.fileName)}
            ></svg-item>
          `)}
        </div>
      </div>
    `;
  }

  _toggleExpand(index) {
    this._expandedIndex = this._expandedIndex === index ? -1 : index;
  }

  _handleDownload(content, fileName) {
    const blob = new Blob([content], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async _handleCopy(text, index) {
    try {
      await navigator.clipboard.writeText(text);
      this._copiedIndex = index;
      setTimeout(() => {
        this._copiedIndex = -1;
      }, 2000);
    } catch (err) {
      alert('Failed to copy to clipboard');
    }
  }

  _onRestart() {
    this.dispatchEvent(new CustomEvent('restart', { bubbles: true, composed: true }));
  }
}

customElements.define('svg-viewer', SvgViewer);
