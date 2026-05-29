import { LitElement, html } from 'lit';
import { PdfConversionController } from '../controllers/pdf-conversion-controller.js';

export class AppRoot extends LitElement {
    constructor() {
        super();
        
        // Instantiate the Reactive Controller, outsourcing all heavy logic and state
        this.pdfController = new PdfConversionController(this);
    }

    // Render inside the Light DOM to inherit all global theme styles from style.css perfectly
    createRenderRoot() {
        return this;
    }

    render() {
        const ctrl = this.pdfController;

        return html`
            <style>
                .app-header-controls {
                    display: flex;
                    justify-content: center;
                    margin-bottom: 2rem;
                }
                .segmented-control {
                    display: inline-flex;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 4px;
                    backdrop-filter: blur(10px);
                }
                .seg-btn {
                    padding: 0.6rem 1.2rem;
                    background: transparent;
                    color: var(--text-muted);
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 600;
                    font-size: 0.9rem;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .seg-btn:hover {
                    color: var(--text-main);
                }
                .seg-btn.active {
                    background: var(--primary);
                    color: white;
                    box-shadow: 0 4px 12px rgba(108, 92, 231, 0.3);
                }
            </style>
            
            <!-- Pure View Toolbar: delegates click events directly to the controller -->
            <div class="app-header-controls">
                <div class="segmented-control">
                    <button class="seg-btn ${ctrl.renderMode === 'vector' ? 'active' : ''}" @click=${() => ctrl.setRenderMode('vector')}>
                        <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                            <polyline points="2 17 12 22 22 17"/>
                            <polyline points="2 12 17 22 12"/>
                        </svg>
                        <span>Vector Outlines</span>
                    </button>
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
                </div>
            </div>

            <!-- Pure View Content Body: renders declaratively based on controller state -->
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
        // Forward loaded PDF file data straight to the controller
        this.pdfController.loadPdf(e.detail.pdf, e.detail.fileName);
    }
}

customElements.define('app-root', AppRoot);
