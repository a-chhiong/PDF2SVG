import { LitElement, html } from 'lit';
// Import the unsafeSVG directive to allow high-fidelity inline vector markup injection
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

export class SvgViewer extends LitElement {
    static properties = {
        svgList: { type: Array }
    };

    constructor() {
        super();
        this.svgList = []; // Array of { pageNum, fileName, svgElement, originalSvgHtml }
    }

    // Render inside the Light DOM to inherit global theme styles from style.css perfectly
    createRenderRoot() {
        return this;
    }

    render() {
        return html`
            <div id="output-container" class="output-container">
                <div class="svg-viewer-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; width: 100%;">
                    <h2 style="margin: 0; color: #38bdf8;">Generated SVGs</h2>
                    <button class="btn btn-secondary" style="border-radius: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255,255,255,0.1); padding: 0.55rem 1rem; font-size: 0.85rem; color: #e2e8f0; cursor: pointer;" @click=${this._onRestart}>
                        <svg style="width:14px;height:14px; margin-right: 6px; vertical-align: middle;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                            <path d="M16 3h5v5"/>
                            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                            <path d="M8 21H3v-5"/>
                        </svg>
                        <span>Convert Another</span>
                    </button>
                </div>
                
                <div id="svg-list" class="svg-list" style="display: flex; flex-direction: column; gap: 2rem;">
                    ${this.svgList.map(item => html`
                        <div class="svg-item" style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 1.2rem;">
                            
                            <div class="svg-item-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                <div class="page-info">
                                    <h3 style="color: #e2e8f0; margin-bottom: 4px;">Page ${item.pageNum}</h3>
                                    <p style="color: #94a3b8; font-size: 13px; word-break: break-all;">${item.fileName}</p>
                                </div>
                                <div class="actions" style="display: flex; gap: 10px;">
                                    <button class="btn btn-secondary" style="background: #334155; color: #e2e8f0; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px;" @click=${(e) => this.copyToClipboard(item.originalSvgHtml, e.currentTarget)}>
                                        <svg style="width:15px;height:15px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                        </svg>
                                        <span>Copy SVG</span>
                                    </button>
                                    <button class="btn btn-primary" style="background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px;" @click=${() => this.downloadFile(item.originalSvgHtml, item.fileName)}>
                                        <svg style="width:15px;height:15px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                            <polyline points="7 10 12 15 17 10"/>
                                            <line x1="12" y1="15" x2="12" y2="3"/>
                                        </svg>
                                        <span>Download</span>
                                    </button>
                                </div>
                            </div>
                            
                            <div class="svg-preview-container" style="width: 100%; background: rgba(0, 0, 0, 0.25); border: 1px solid var(--glass-border); border-radius: 12px; padding: 12px; display: flex; justify-content: center; align-items: center; box-shadow: inset 0 4px 12px rgba(0,0,0,0.4); overflow: auto;">
                                <div class="native-svg-wrapper" style="width: 100%; display: flex; justify-content: center; align-items: center;">
                                    ${unsafeSVG(item.originalSvgHtml)}
                                </div>
                            </div>

                        </div>
                    `)}
                </div>
            </div>
        `;
    }

    downloadFile(content, fileName) {
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

    async copyToClipboard(text, btn) {
        try {
            await navigator.clipboard.writeText(text);
            const originalHTML = btn.innerHTML;
            btn.innerHTML = `
                <svg style="width:15px;height:15px;" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span style="color: #22c55e;">Copied!</span>
            `;
            setTimeout(() => {
                btn.innerHTML = originalHTML;
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