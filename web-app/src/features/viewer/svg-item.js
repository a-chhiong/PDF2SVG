import { LitElement, html, css } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { buttonBase } from '../../components/shared-styles.js';
import { ZoomController } from '../../controllers/zoom-controller.js';

export class SvgItem extends LitElement {
  static properties = {
    pageNum: { type: Number },
    fileName: { type: String },
    svgHtml: { type: String },
    isCopied: { type: Boolean, reflect: true },
    isExpanded: { type: Boolean, reflect: true },
  };

  static styles = [
    buttonBase,
    css`
      :host {
        display: block;
        animation: fadeIn 0.35s ease forwards;
      }

      .svg-item {
        background: var(--bg-surface);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        overflow: hidden;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      .svg-item:hover {
        border-color: var(--border-color-strong);
        box-shadow: var(--shadow-md);
      }

      .svg-item-header {
        display: flex;
        align-items: center;
        padding: var(--svg-item-header-padding);
        gap: var(--svg-item-header-gap);
        cursor: pointer;
        user-select: none;
        transition: background 0.2s ease;
      }

      .svg-item-header:hover {
        background: var(--bg-overlay);
      }

      .page-info {
        display: flex;
        align-items: center;
        gap: clamp(0.4rem, 0.7vw, 0.75rem);
        min-width: 0;
        flex: 1;
      }

      .page-badge {
        display: flex;
        align-items: center;
        justify-content: center;
        width: var(--svg-item-badge-size);
        height: var(--svg-item-badge-size);
        border-radius: var(--radius-xs);
        background: var(--color-primary-light);
        color: var(--color-primary);
        font-weight: 700;
        font-size: var(--svg-item-badge-font-size);
        flex-shrink: 0;
      }

      .page-info h3 {
        font-size: clamp(0.8rem, 1vw, 0.95rem);
        font-weight: 600;
        color: var(--text-primary);
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .page-info p {
        font-size: clamp(0.65rem, 0.75vw, 0.75rem);
        color: var(--text-muted);
        margin: 0;
        display: var(--svg-item-filename-display);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: clamp(80px, 10vw, 140px);
      }

      /* Overrides for shared btn-sm button styles */
      .btn-sm {
        padding: var(--svg-item-btn-padding);
        min-height: var(--svg-item-btn-min-height);
        gap: clamp(3px, 0.4vw, 5px);
        font-size: clamp(0.7rem, 0.8vw, 0.78rem);
      }

      .btn-sm svg {
        width: var(--svg-item-btn-svg-size);
        height: var(--svg-item-btn-svg-size);
      }

      .actions .btn span {
        display: var(--svg-item-btn-span-display);
      }

      /* Copy button — teal / cyan accent (distinct from mode-switcher purple) */
      .btn-copy {
        background: var(--color-accent-light);
        color: var(--color-accent);
        border: 1px solid transparent;
      }

      .btn-copy:hover {
        background: rgba(0, 150, 199, 0.2);
        color: var(--color-accent);
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 150, 199, 0.15);
      }

      .btn-copy:active {
        transform: translateY(0);
      }

      .btn-copy.copied {
        background: var(--color-success);
        color: #fff;
        border-color: var(--color-success);
      }

      .btn-copy.copied:hover {
        background: var(--color-success);
        box-shadow: 0 2px 8px rgba(22, 163, 74, 0.25);
        color: #fff;
      }

      /* Download button — warm orange/amber accent (distinct from mode-switcher purple) */
      .btn-download {
        background: rgba(217, 119, 6, 0.12);
        color: var(--color-warning);
        border: 1px solid transparent;
      }

      .btn-download:hover {
        background: rgba(217, 119, 6, 0.2);
        color: #c06806;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(217, 119, 6, 0.15);
      }

      .btn-download:active {
        transform: translateY(0);
      }

      /* Dark mode variants */
      :host-context([data-theme="dark"]) .btn-copy {
        background: rgba(0, 212, 255, 0.1);
        color: #00d4ff;
      }

      :host-context([data-theme="dark"]) .btn-copy:hover {
        background: rgba(0, 212, 255, 0.18);
        color: #33ddff;
      }

      :host-context([data-theme="dark"]) .btn-download {
        background: rgba(245, 158, 11, 0.1);
        color: #f59e0b;
      }

      :host-context([data-theme="dark"]) .btn-download:hover {
        background: rgba(245, 158, 11, 0.18);
        color: #fbbf24;
      }

      .actions {
        display: flex;
        gap: clamp(0.2rem, 0.35vw, 0.35rem);
        flex-shrink: 0;
        margin-left: auto;
        margin-right: 0.25rem;
      }

      .expand-icon {
        width: clamp(16px, 1.4vw, 20px);
        height: clamp(16px, 1.4vw, 20px);
        color: var(--text-muted);
        transition: transform 0.3s ease, color 0.2s ease;
        flex-shrink: 0;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      :host(:hover) .expand-icon {
        color: var(--text-secondary);
      }

      .expand-icon.expanded {
        transform: rotate(180deg);
        color: var(--color-primary);
      }

      .svg-preview-wrapper {
        display: grid;
        grid-template-rows: 0fr;
        transition: grid-template-rows 0.35s ease, opacity 0.25s ease;
        opacity: 0;
      }

      .svg-preview-wrapper.expanded {
        grid-template-rows: 1fr;
        opacity: 1;
      }

      .svg-preview-wrapper > * {
        overflow: hidden;
      }

      .preview-outer-wrapper {
        position: relative;
        width: 100%;
        display: flex;
        flex-direction: column;
      }

      .zoom-control-wrapper {
        position: absolute;
        bottom: 12px;
        right: 12px;
        z-index: 10;
        pointer-events: none;
      }

      .svg-preview-container {
        background: var(--bg-surface-raised);
        padding: var(--svg-item-preview-padding);
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: auto;
        box-shadow: inset 0 2px 8px var(--bg-overlay);
        border-top: 1px solid var(--border-color);
        max-height: var(--svg-item-preview-max-height);
        width: 100%;
      }

      .svg-preview-container.pan-mode {
        cursor: grab;
      }

      .svg-preview-container.grabbing {
        cursor: grabbing !important;
      }

      .svg-preview-wrapper:not(.expanded) .svg-preview-container {
        border-top: none;
        padding: 0;
      }

      .native-svg-wrapper {
        width: calc(100% * var(--zoom-level, 1));
        margin: auto;
        display: flex;
        justify-content: center;
        align-items: center;
        transition: width 0.15s ease-out;
      }

      .native-svg-wrapper svg {
        width: 100%;
        max-width: none;
        height: auto;
        background: var(--svg-preview-bg);
        border-radius: 4px;
        box-shadow: var(--svg-preview-shadow);
      }

      .native-svg-wrapper text {
        text-rendering: optimizeLegibility !important;
      }
    `
  ];

  constructor() {
    super();
    this.pageNum = 0;
    this.fileName = '';
    this.svgHtml = '';
    this.isCopied = false;
    this.isExpanded = true;

    // Instantiate our reactive zoom/pan controller
    this.zoomController = new ZoomController(this);
  }

  render() {
    const copyBtnClass = `btn btn-sm ${this.isCopied ? 'btn-copy copied' : 'btn-copy'}`;
    const ctrl = this.zoomController;
    const isPanActive = ctrl.panMode || ctrl.isSpacePressed;
    const isTouchActionNone = ctrl.zoom > 1 || isPanActive;

    return html`
      <div class="svg-item">
        <div class="svg-item-header" @click=${this._onToggle}>
          <div class="page-info">
            <span class="page-badge">${this.pageNum}</span>
            <h3>Page ${this.pageNum}</h3>
            <p>${this.fileName}</p>
          </div>
          <div class="actions" @click=${(e) => e.stopPropagation()}>
            <button class="${copyBtnClass}" @click=${this._onCopy} title="Copy SVG">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              <span>${this.isCopied ? 'Copied!' : 'Copy'}</span>
            </button>
            <button class="btn btn-sm btn-download" @click=${this._onDownload} title="Download SVG">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Download</span>
            </button>
          </div>
          <svg class="expand-icon ${this.isExpanded ? 'expanded' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        <div class="svg-preview-wrapper ${this.isExpanded ? 'expanded' : ''}">
          <div class="preview-outer-wrapper">
            <div
              class="svg-preview-container ${isPanActive ? 'pan-mode' : ''} ${ctrl.isDragging ? 'grabbing' : ''}"
              style="touch-action: ${isTouchActionNone ? 'none' : 'pan-y'}"
              @mousedown=${ctrl.handleMouseDown}
              @mousemove=${ctrl.handleMouseMove}
              @mouseup=${ctrl.handleMouseUp}
              @mouseleave=${ctrl.handleMouseUp}
              @touchstart=${ctrl.handleTouchStart}
              @touchmove=${ctrl.handleTouchMove}
              @touchend=${ctrl.handleTouchEnd}
              @wheel=${ctrl.handleWheel}
            >
              <div class="native-svg-wrapper" style="--zoom-level: ${ctrl.zoom}">
                ${unsafeSVG(this.svgHtml)}
              </div>
            </div>
            <div class="zoom-control-wrapper">
              <app-zoom
                .zoom=${ctrl.zoom}
                .panMode=${ctrl.panMode}
                @zoom-in=${ctrl.zoomIn}
                @zoom-out=${ctrl.zoomOut}
                @zoom-reset=${ctrl.zoomReset}
                @pan-mode-change=${(e) => ctrl.setPanMode(e.detail.panMode)}
              ></app-zoom>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _onToggle() {
    this.isExpanded = !this.isExpanded;
    this.dispatchEvent(new CustomEvent('toggle', {
      detail: { expanded: this.isExpanded },
      bubbles: true,
      composed: true,
    }));
  }

  _onCopy() {
    this.dispatchEvent(new CustomEvent('copy-svg', {
      detail: { svgHtml: this.svgHtml },
      bubbles: true,
      composed: true,
    }));
  }

  _onDownload() {
    this.dispatchEvent(new CustomEvent('download-svg', {
      detail: { svgHtml: this.svgHtml, fileName: this.fileName },
      bubbles: true,
      composed: true,
    }));
  }
}

customElements.define('svg-item', SvgItem);
