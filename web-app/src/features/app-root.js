import { LitElement, html, css } from 'lit';
import { AppController } from '../controllers/app-controller.js';
import { animations } from '../styles/shared-styles.js';
import './theme/theme-toggle.js';
import './mode/mode-switcher.js';
import '../components/app-loader.js';
import './file/global-drag-overlay.js';

export class AppRoot extends LitElement {
  static properties = {
    _isGlobalDragOver: { type: Boolean, state: true },
  };

  static styles = [
    animations,
    css`
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
      padding: 0.5rem 1rem;
      padding-top: calc(0.5rem + var(--safe-area-top));
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
      gap: 0.75rem;
      min-width: 0;
    }

    .top-bar-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .logo {
      font-family: 'Outfit', sans-serif;
      font-weight: 800;
      font-size: clamp(1rem, 1.6vw, 1.35rem);
      letter-spacing: -0.5px;
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
      font-size: clamp(0.65rem, 0.85vw, 0.78rem);
      color: var(--text-muted);
      font-weight: 400;
      display: none;
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
      border-radius: var(--radius-xl);
      padding: clamp(0.85rem, 2vw, 1.75rem);
      box-shadow: var(--shadow-md);
      transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
      max-width: 90vw;
      width: 100%;
      margin: auto;
    }



    /* (global-drag-overlay styles are now encapsulated inside global-drag-overlay component) */

    .app-content-body {
      width: 100%;
      max-width: 100%;
    }

    .app-content-body > * {
      animation: fadeInUp 0.35s ease forwards;
    }

    /* ── Responsive ─────────────────────── */

    /* Phone (< 640px): full-width card, tight spacing */
    @media (max-width: 639px) {
      :host {
        --topbar-height: 48px;
      }
      .top-bar {
        padding: 0.4rem 0.75rem;
        min-height: var(--topbar-height);
      }
      .logo {
        font-size: 1.1rem;
      }
      .top-bar-right {
        gap: 0.25rem;
      }
      .card {
        max-width: 100%;
        padding: 1.25rem;
      }
    }

    /* Very small phone */
    @media (max-width: 380px) {
      .top-bar {
        padding: 0.3rem 0.6rem;
      }
      .logo {
        font-size: 1rem;
      }
      .card {
        padding: 1rem;
        border-radius: var(--radius-md);
      }
    }

    /* Tablet & iPad Pro (≥640px) */
    @media (min-width: 640px) and (max-width: 1439px) {
      :host {
        --topbar-height: 52px;
      }
      .top-bar-subtitle {
        display: inline;
      }
      .top-bar {
        padding: 0.5rem 1.25rem;
        min-height: var(--topbar-height);
      }
      .logo {
        font-size: clamp(1.1rem, 2vw, 1.3rem);
      }
    }

    /* Tablet landscape — tighter top-bar */
    @media (min-width: 800px) and (max-width: 1439px) and (orientation: landscape) {
      :host {
        --topbar-height: 48px;
      }
      .top-bar {
        padding: 0.4rem 1.25rem;
        min-height: var(--topbar-height);
      }
      .logo {
        font-size: 1.15rem;
      }
    }

    /* Desktop (1440px – 1799px) */
    @media (min-width: 1440px) and (max-width: 1799px) {
      :host {
        --topbar-height: 42px;
      }
      .top-bar-subtitle {
        display: inline;
      }
      .top-bar {
        padding: 0.3rem 1rem;
        padding-top: calc(0.3rem + var(--safe-area-top));
        min-height: var(--topbar-height);
      }
      .top-bar-left {
        gap: 0.5rem;
      }
      .top-bar-right {
        gap: 0.35rem;
      }
      .logo {
        font-size: 1rem;
        letter-spacing: -0.3px;
      }
      .top-bar-subtitle {
        font-size: 0.68rem;
      }
    }

    /* Large desktop (≥1800px) */
    @media (min-width: 1800px) {
      :host {
        --topbar-height: 38px;
      }
      .top-bar-subtitle {
        display: inline;
      }
      .top-bar {
        padding: 0.25rem 0.75rem;
        padding-top: calc(0.25rem + var(--safe-area-top));
        min-height: var(--topbar-height);
      }
      .top-bar-left {
        gap: 0.45rem;
      }
      .top-bar-right {
        gap: 0.3rem;
      }
      .logo {
        font-size: 0.9rem;
        letter-spacing: -0.2px;
      }
      .top-bar-subtitle {
        font-size: 0.65rem;
      }
    }

    /* Landscape constrained — card goes full-width, tighter */
    @media (orientation: landscape) and (max-height: 600px) {
      .card {
        max-width: 100%;
        border-radius: var(--radius-md);
        padding: 0.85rem 1.25rem;
      }
    }

    /* Landscape extra-compact */
    @media (orientation: landscape) and (max-height: 500px) {
      :host {
        --topbar-height: 38px;
      }
      .top-bar {
        min-height: var(--topbar-height);
        padding: 0.2rem 0.6rem;
      }
      .logo {
        font-size: 0.9rem;
      }
      .top-bar-subtitle {
        display: none;
      }
      .card {
        padding: 0.65rem 0.85rem;
      }
    }
  `];

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
