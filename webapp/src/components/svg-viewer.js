import { LitElement, html } from 'lit';

export class SvgViewer extends LitElement {
    static properties = {
        svgList: { type: Array }
    };

    constructor() {
        super();
        this.svgList = []; // Array of { pageNum, fileName, svgElement }
    }

    // Render inside the Light DOM to inherit all global theme styles from style.css perfectly
    createRenderRoot() {
        return this;
    }

    /**
     * Resets the viewer list and cleans up any blob URLs.
     */
    clear() {
        // Revoke all previously created blob URLs to free memory
        for (const item of this.svgList) {
            if (item._blobUrl) URL.revokeObjectURL(item._blobUrl);
        }
        this.svgList = [];
    }

    /**
     * Appends a newly generated SVG page to the reactive list.
     * Triggers LitElement's reactive rendering pipeline automatically.
     * @param {SVGElement} svg - The converted SVG DOM node
     * @param {number} pageNum - PDF Page number index
     * @param {string} fileName - Original PDF filename
     */
    addSvgPage(svg, pageNum, fileName) {
        const cleanName = fileName.replace(/\.[^/.]+$/, "");
        const svgFileName = `${cleanName}_page_${pageNum}.svg`;

        // Clone the SVG DOM element so it can be mounted and manipulated inside the preview viewport
        const clonedSvg = svg.cloneNode(true);

        const rawXml = new XMLSerializer().serializeToString(svg);
        const cleanXml = rawXml
            .replace(/<svg:([a-zA-Z0-9_-]+)/g, '<$1')
            .replace(/<\/svg:([a-zA-Z0-9_-]+)>/g, '</$1>')
            .replace(/xmlns:svg="http:\/\/www.w3.org\/2000\/svg"/g, 'xmlns="http://www.w3.org/2000/svg"');

        this.svgList = [
            ...this.svgList,
            { pageNum, fileName: svgFileName, svgElement: clonedSvg, originalSvgHtml: cleanXml }
        ];
    }

    render() {
        return html`
            <div id="output-container" class="output-container">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; width: 100%;">
                    <h2 style="margin: 0;">Generated SVGs</h2>
                    <button class="btn btn-secondary" style="border-radius: 12px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--glass-border); padding: 0.55rem 1rem; font-size: 0.85rem;" @click=${this._onRestart}>
                        <svg style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                            <path d="M16 3h5v5"/>
                            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                            <path d="M8 21H3v-5"/>
                        </svg>
                        <span>Convert Another</span>
                    </button>
                </div>
                <div id="svg-list" class="svg-list">
                    ${this.svgList.map(item => html`
                        <div class="svg-item" style="flex-direction: column; align-items: stretch; gap: 1rem;">
                            <!-- Header Action Row -->
                            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                <div class="page-info">
                                    <h3>Page ${item.pageNum}</h3>
                                    <p>${item.fileName}</p>
                                </div>
                                <div class="actions">
                                    <button class="btn btn-secondary" @click=${(e) => this.copyToClipboard(item.originalSvgHtml, e.currentTarget)}>
                                        <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                        </svg>
                                        <span>Copy SVG</span>
                                    </button>
                                    <button class="btn btn-primary" @click=${() => this.downloadFile(item.originalSvgHtml, item.fileName)}>
                                        <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                            <polyline points="7 10 12 15 17 10"/>
                                            <line x1="12" y1="15" x2="12" y2="3"/>
                                        </svg>
                                        <span>Download</span>
                                    </button>
                                </div>
                            </div>
                            <!-- SVG Preview Viewport: iframe with blob URL so @import and external fonts load -->
                            <div class="svg-preview-container" style="width: 100%; height: 350px; background: #ffffff; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; overflow: hidden; display: flex; justify-content: center; align-items: center; position: relative; box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.1);">
                                <iframe
                                    src="${this.getSvgBlobUrl(item)}"
                                    style="width: 100%; height: 100%; border: none; display: block;"
                                    title="SVG Preview Page ${item.pageNum}"
                                ></iframe>
                            </div>
                        </div>
                    `)}
                </div>
            </div>
        `;
    }

    /**
     * Create a Blob URL for the SVG so it can be loaded into an iframe.
     * Blob URLs allow external resources (@import, Google Fonts) to load
     * because the browser treats them as same-origin.
     * We wrap the raw SVG in a minimal HTML shell that fits the SVG to the viewport.
     */
    getSvgBlobUrl(item) {
        // Only create the blob URL once per item (Lit re-renders must not recreate it)
        if (item._blobUrl) return item._blobUrl;

        const svgContent = item.originalSvgHtml;
        // Wrap SVG in an HTML page that fills the iframe viewport cleanly
        const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #fff; display: flex; justify-content: center; align-items: flex-start; overflow: auto; }
  svg { max-width: 100%; height: auto; display: block; }
</style></head>
<body>${svgContent}</body></html>`;

        const blob = new Blob([html], { type: 'text/html' });
        item._blobUrl = URL.createObjectURL(blob);
        return item._blobUrl;
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
                <svg style="width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span>Copied!</span>
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
