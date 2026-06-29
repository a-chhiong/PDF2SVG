import { LitElement, html, css } from 'lit';
import { AppController } from '../controllers/app-controller.js';
import '../features/theme/theme-toggle.js';
import '../features/mode/mode-switcher.js';

export class AppRoot extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      width: 100%;
      max-width: 100%;
    }

    .app-header-controls {
      display: flex;
      justify-content: center;
      width: 100%;
    }

    .app-content-body {
      width: 100%;
      max-width: 100%;
    }

    .app-content-body > * {
      animation: fadeInUp 0.35s ease forwards;
    }

    @media (orientation: landscape) and (max-height: 600px) {
      :host {
        gap: 0.75rem;
      }
    }
  `;

  constructor() {
    super();
    this.pdfController = new AppController(this);
  }

  render() {
    const ctrl = this.pdfController;

    return html`
      <div class="app-header-controls">
        <mode-switcher
          .mode=${ctrl.renderMode}
          @mode-change=${this._onModeChange}
        ></mode-switcher>
      </div>

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