import { LitElement, html } from 'lit';
import { PdfConversionController } from '../controllers/pdf-conversion-controller.js';

export class AppRoot extends LitElement {
    constructor() {
        super();
        this.pdfController = new PdfConversionController(this);
    }

    createRenderRoot() {
        return this;
    }

    render() {
        const ctrl = this.pdfController;

        return html`
            <div class="app-header-controls">
                <div class="segmented-control">
                    <button class="seg-btn ${ctrl.renderMode === 'live' ? 'active' : ''}" @click=${() => ctrl.setRenderMode('live')}>
                        <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14 2 14 8 20 8"/>
                            <line x1="16" y1="13" x2="8" y2="13"/>
                            <line x1="16" y1="17" x2="8" y2="17"/>
                            <polyline points="10 9 9 9 8 9"/>
                        </svg>
                        <span>Editable Text</span>
                    </button>
                    <button class="seg-btn ${ctrl.renderMode === 'vector' ? 'active' : ''}" @click=${() => ctrl.setRenderMode('vector')}>
                        <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                            <polyline points="2 17 12 22 22 17"/>
                            <polyline points="2 12 17 22 12"/>
                        </svg>
                        <span>Vector Outlines</span>
                    </button>
                </div>
            </div>

            <div class="app-content-body">
                ${ctrl.status === 'idle' ? html`
                    <file-drop-zone @file-loaded=${this._onFileLoaded}></file-drop-zone>
                ` : ''}

                ${ctrl.status === 'converting' ? html`
                    <conversion-progress .status=${ctrl.progressText}></conversion-progress>
                ` : ''}

                ${ctrl.status === 'done' ? html`
                    <svg-viewer .svgList=${ctrl.activePages} @restart=${() => ctrl.reset()}></svg-viewer>
                ` : ''}
            </div>
        `;
    }

    _onFileLoaded(e) {
        // Unpack the correct target array buffer detail properties
        this.pdfController.loadPdf(e.detail.arrayBuffer, e.detail.fileName);
    }
}
customElements.define('app-root', AppRoot);