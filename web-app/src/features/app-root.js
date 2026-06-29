import { LitElement, html, css } from 'lit';
import { AppController } from '../controllers/app-controller.js';
import { animations } from '../styles/shared-styles.js';
import './theme/theme-toggle.js';
import './mode/mode-switcher.js';
import '../components/app-loader.js';

export class AppRoot extends LitElement {
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
    }

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
      .top-bar {
        padding: 0.4rem 0.75rem;
        min-height: 48px;
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
      .top-bar-subtitle {
        display: inline;
      }
      .top-bar {
        padding: 0.5rem 1.25rem;
        min-height: 52px;
      }
      .logo {
        font-size: clamp(1.1rem, 2vw, 1.3rem);
      }
    }

    /* Tablet landscape — tighter top-bar */
    @media (min-width: 800px) and (max-width: 1439px) and (orientation: landscape) {
      .top-bar {
        padding: 0.4rem 1.25rem;
        min-height: 48px;
      }
      .logo {
        font-size: 1.15rem;
      }
    }

    /* Desktop (1440px – 1799px) */
    @media (min-width: 1440px) and (max-width: 1799px) {
      .top-bar-subtitle {
        display: inline;
      }
      .top-bar {
        padding: 0.3rem 1rem;
        padding-top: calc(0.3rem + var(--safe-area-top));
        min-height: 42px;
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
      .top-bar-subtitle {
        display: inline;
      }
      .top-bar {
        padding: 0.25rem 0.75rem;
        padding-top: calc(0.25rem + var(--safe-area-top));
        min-height: 38px;
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
      .top-bar {
        min-height: 38px;
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

      <main class="main-content">
        <div class="card">
          ${!ctrl.contentRevealed
            ? html`<app-loader .ready=${ctrl.appReady}></app-loader>`
            : html`
              <div class="app-content-body">
                ${ctrl.status === 'idle'
                  ? html`<file-drop-zone @file-loaded=${this._onFileLoaded}></file-drop-zone>`
                  : ''}

                ${ctrl.status === 'converting'
                  ? html`<progress-indicator .status=${ctrl.progressText} .progress=${ctrl.progress}></progress-indicator>`
                  : ''}

                ${ctrl.status === 'done'
                  ? html`<svg-viewer .svgList=${ctrl.activePages} @restart=${this._onRestart}></svg-viewer>`
                  : ''}
              </div>
            `}
        </div>
      </main>
    `;
  }

  _onFileLoaded(e) {
    this.pdfController.loadPdf(e.detail.arrayBuffer, e.detail.fileName);
  }

  _onModeChange(e) {
    this.pdfController.setRenderMode(e.detail.mode);
  }

  _onRestart() {
    this.pdfController.reset();
  }
}

customElements.define('app-root', AppRoot);
