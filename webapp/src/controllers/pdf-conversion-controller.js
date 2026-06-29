import { renderPageToSvg } from '../services/pdf-render-service.js';
import * as mupdf from 'mupdf';

export class PdfConversionController {
    constructor(host) {
        this.host = host;
        this.host.addController(this);

        // Core reactive states
        this.status = 'idle'; // 'idle', 'converting', 'done'
        this.progressText = 'Preparing document...';
        this.renderMode = 'live'; // 'vector' or 'live'
        this.fileName = '';
        this.pdfArrayBuffer = null;

        // Isolated multi-mode page caches
        this._vectorPages = [];
        this._livePages = [];
    }

    get activePages() {
        return this.renderMode === 'live' ? this._livePages : this._vectorPages;
    }

    reset() {
        this.status = 'idle';
        this.progressText = 'Preparing document...';
        this.fileName = '';
        this.pdfArrayBuffer = null;
        this._vectorPages = [];
        this._livePages = [];
        this.host.requestUpdate();
    }

    async loadPdf(arrayBuffer, fileName) {
        this.pdfArrayBuffer = arrayBuffer;
        this.fileName = fileName;
        this._vectorPages = [];
        this._livePages = [];
        
        await this.triggerConversion();
    }

    async setRenderMode(mode) {
        if (this.renderMode === mode) return;
        this.renderMode = mode;
        this.host.requestUpdate();

        if (this.pdfArrayBuffer) {
            await this.triggerConversion();
        }
    }

    async triggerConversion() {
        if (!this.pdfArrayBuffer) return;

        // Skip execution if target mode lists are already cached
        const cachedList = this.renderMode === 'vector' ? this._vectorPages : this._livePages;
        if (cachedList.length > 0) {
            this.status = 'done';
            this.host.requestUpdate();
            return;
        }

        this.status = 'converting';
        this.progressText = `Initializing MuPDF WASM core structures...`;
        this.host.requestUpdate();

        let doc = null;
        try {
            // Instantiate MuPDF document over the raw ArrayBuffer stream
            doc = mupdf.Document.openDocument(this.pdfArrayBuffer, "application/pdf");
            const numPages = doc.countPages();
            const results = [];

            for (let i = 0; i < numPages; i++) {
                const pageNumDisplay = i + 1;
                this.progressText = `Processing page ${pageNumDisplay} of ${numPages}...`;
                this.host.requestUpdate();

                // Generate vector or text nodes using our updated render service
                const svgNode = renderPageToSvg(doc, i, this.renderMode);

                if (svgNode) {
                    const cleanName = this.fileName.replace(/\.[^/.]+$/, "");
                    const svgFileName = `${cleanName}_page_${pageNumDisplay}.svg`;
                    
                    const clonedSvg = svgNode.cloneNode(true);
                    const rawXml = new XMLSerializer().serializeToString(svgNode);
                    
                    // Clean namespace attributes for proper presentation vectors
                    const cleanXml = rawXml
                        .replace(/<svg:([a-zA-Z0-9_-]+)/g, '<$1')
                        .replace(/<\/svg:([a-zA-Z0-9_-]+)>/g, '</$1>')
                        .replace(/xmlns:svg="http:\/\/www.w3.org\/2000\/svg"/g, 'xmlns="http://www.w3.org/2000/svg"');

                    results.push({
                        pageNum: pageNumDisplay,
                        fileName: svgFileName,
                        svgElement: clonedSvg,
                        originalSvgHtml: cleanXml
                    });
                }
            }

            // Route pages into their respective caches
            if (this.renderMode === 'vector') {
                this._vectorPages = results;
            } else {
                this._livePages = results;
            }

            this.status = 'done';
            this.host.requestUpdate();
        } catch (error) {
            console.error('Error during MuPDF conversion process:', error);
            alert('An error occurred during vector conversion. Inspect the console log for details.');
            this.status = 'idle';
            this.host.requestUpdate();
        } finally {
            // Clean up allocated memory space inside the WASM instance
            if (doc) {
                doc.destroy();
            }
        }
    }
}