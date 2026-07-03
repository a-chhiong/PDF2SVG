import { LitElement, html, css } from 'lit';
import { buttonBase } from '../../styles/shared-styles.js';
import './svg-item.js';

export class SvgViewer extends LitElement {
  static properties = {
    svgList: { type: Object },
    fileName: { type: String },
    _copiedIndex: { type: Number, state: true },
    _expandedIndex: { type: Number, state: true },
  };

  static styles = [
    buttonBase,
    css`
      :host {
        display: block;
        animation: fadeInUp 0.35s ease forwards;
      }

      .output-container {
        display: flex;
        flex-direction: column;
        gap: clamp(0.75rem, 1.5vw, 1.25rem);
      }

      .svg-viewer-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .svg-viewer-header h2 {
        font-size: clamp(0.85rem, 1.2vw, 1.1rem);
        font-weight: 700;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
      }

      .svg-viewer-header h2 svg {
        width: clamp(16px, 1.4vw, 20px);
        height: clamp(16px, 1.4vw, 20px);
        color: var(--color-accent);
        stroke-linecap: round;
        stroke-linejoin: round;
        filter: drop-shadow(0 0 4px var(--color-accent-light));
      }

      .svg-viewer-header h2 .page-count {
        font-size: clamp(0.72rem, 1vw, 0.85rem);
        font-weight: 500;
        color: var(--text-muted);
        margin-left: 0.25rem;
      }

      .svg-list {
        display: flex;
        flex-direction: column;
        gap: clamp(0.6rem, 1vw, 1rem);
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
    `
  ];

  constructor() {
    super();
    this.svgList = [];
    this.fileName = '';
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
            <span>${this.fileName || 'Generated SVGs'}</span>
            <span class="page-count">${this.svgList?.length ? `(${this.svgList.length} pages)` : ''}</span>
          </h2>
          <button class="btn btn-secondary" @click=${this._onRestart}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Convert Another
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
