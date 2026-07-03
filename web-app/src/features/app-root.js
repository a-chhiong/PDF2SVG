import { LitElement, html, css } from 'lit';
import { AppController } from '../controllers/app-controller.js';
import './theme/theme-toggle.js';
import './mode/mode-switcher.js';
import '../components/app-loader.js';
import './file/global-drag-overlay.js';

export class AppRoot extends LitElement {
  static properties = {
    _isGlobalDragOver: { type: Boolean, state: true },
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      height: 100vh;
      max-width: 100%;
      margin: 0 auto;
      overflow: hidden;
    }

    /* ── Top Bar ────────────────────────── */
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--topbar-padding);
      padding-top: var(--topbar-padding-top);
      min-height: var(--topbar-height);
      background: var(--bg-nav);
      backdrop-filter: blur(var(--glass-blur));
      -webkit-backdrop-filter: blur(var(--glass-blur));
      border-bottom: 1px solid var(--bg-nav-border);
      flex-shrink: 0;
      z-index: 100;
      position: sticky;
      top: 0;
      transition: min-height 0.25s ease, padding 0.25s ease;
    }

    .top-bar-left {
      display: flex;
      align-items: center;
      gap: var(--topbar-left-gap);
      min-width: 0;
    }

    .top-bar-right {
      display: flex;
      align-items: center;
      gap: var(--topbar-right-gap);
      flex-shrink: 0;
    }

    .logo {
      font-family: 'Outfit', sans-serif;
      font-weight: 800;
      font-size: var(--logo-font-size);
      letter-spacing: var(--logo-letter-spacing);
      background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-muted) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
      white-space: nowrap;
    }

    .logo span {
      background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .top-bar-subtitle {
      font-size: var(--logo-subtitle-font-size);
      color: var(--text-muted);
      font-weight: 400;
      display: var(--topbar-subtitle-display);
      white-space: nowrap;
    }

    /* ── Main Content ───────────────────── */
    .main-content {
      position: relative;
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
      padding: clamp(0.5rem, 1.2vw, 1.25rem);
      padding-bottom: calc(clamp(0.5rem, 1.2vw, 1.25rem) + var(--safe-area-bottom));
    }

    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--card-radius);
      padding: var(--card-padding);
      box-shadow: var(--shadow-md);
      transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
      max-width: var(--card-max-width);
      width: 100%;
      margin: auto;
    }

    .app-content-body {
      width: 100%;
      max-width: 100%;
    }

    .app-content-body > * {
      animation: fadeInUp 0.35s ease forwards;
    }
  `;

  constructor() {
    super();
    this.pdfController = new AppController(this);
    this._isGlobalDragOver = false;
    this._dragCounter = 0;
  }

  /** Delegate the loader → content transition to the controller */
  firstUpdated() {
    this.pdfController.onFirstRender();
  }

  render() {
    const ctrl = this.pdfController;

    return html`
      <header class="top-bar">
        <div class="top-bar-left">
          <h1 class="logo">PDF<span>2</span>SVG</h1>
          <span class="top-bar-subtitle">Convert PDF pages to vector SVG outlines</span>
        </div>
        <div class="top-bar-right">
          <mode-switcher
            .mode=${ctrl.renderMode}
            @mode-change=${this._onModeChange}
          ></mode-switcher>
          <theme-toggle></theme-toggle>
        </div>
      </header>

      <main class="main-content"
        @dragenter=${this._onGlobalDragEnter}
        @dragover=${this._onGlobalDragOver}
        @dragleave=${this._onGlobalDragLeave}
        @drop=${this._onGlobalDrop}
      >
        ${ctrl.status === 'idle'
          ? html`<file-drop-zone @file-loaded=${this._onFileLoaded}></file-drop-zone>`
          : html`
            <div class="card">
              <div class="app-content-body">
                ${ctrl.status === 'converting'
                  ? html`<progress-indicator .status=${ctrl.progressText} .progress=${ctrl.progress}></progress-indicator>`
                  : ''}

                ${ctrl.status === 'done'
                  ? html`<svg-viewer .svgList=${ctrl.activePages} .fileName=${ctrl.fileName} @restart=${this._onRestart}></svg-viewer>`
                  : ''}
              </div>
            </div>
          `}
      </main>

      ${this._isGlobalDragOver
        ? html`<global-drag-overlay></global-drag-overlay>`
        : ''}

      ${!ctrl.contentRevealed
        ? html`<app-loader .ready=${ctrl.appReady}></app-loader>`
        : ''}
    `;
  }

  scrollToTop() {
    const mainContent = this.shadowRoot?.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }
  }

  async _onFileLoaded(e) {
    await this.pdfController.loadPdf(e.detail.arrayBuffer, e.detail.fileName);
    await this.updateComplete;
    this.scrollToTop();
  }

  _onModeChange(e) {
    this.pdfController.setRenderMode(e.detail.mode);
  }

  _onRestart() {
    this.pdfController.reset();
    this.scrollToTop();
  }

  _onGlobalDragEnter(e) {
    if (this.pdfController.status !== 'done') return;
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      this._dragCounter++;
      this._isGlobalDragOver = true;
    }
  }

  _onGlobalDragOver(e) {
    if (this.pdfController.status !== 'done') return;
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  _onGlobalDragLeave(e) {
    if (this.pdfController.status !== 'done') return;
    this._dragCounter--;
    if (this._dragCounter <= 0) {
      this._dragCounter = 0;
      this._isGlobalDragOver = false;
    }
  }

  _onGlobalDrop(e) {
    if (this.pdfController.status !== 'done') return;
    e.preventDefault();
    this._dragCounter = 0;
    this._isGlobalDragOver = false;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        this._loadDraggedFile(file);
      } else {
        alert('Please select a valid PDF file.');
      }
    }
  }

  async _loadDraggedFile(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      await this.pdfController.loadPdf(arrayBuffer, file.name);
      await this.updateComplete;
      this.scrollToTop();
    } catch (error) {
      console.error('Error reading dropped file:', error);
      alert('Failed to process file selection.');
    }
  }
}

customElements.define('app-root', AppRoot);
