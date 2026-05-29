import { renderPageToSvg } from '../services/pdf-render-service.js';

export class PdfConversionController {
    constructor(host) {
        this.host = host;
        
        // Register this controller with the host component's lifecycle
        this.host.addController(this);

        // Core reactive states
        this.status = 'idle'; // 'idle', 'converting', 'done'
        this.progressText = 'Preparing document...';
        this.renderMode = 'vector'; // 'vector' or 'live'
        this.fileName = '';
        this.pdfDocument = null;

        // Decoupled cached pages to enable sub-millisecond mode switching
        this._vectorPages = [];
        this._livePages = [];
    }

    // Lit Controller lifecycle hooks (optional for this context)
    hostConnected() {}
    hostDisconnected() {}

    /**
     * Get the generated pages for the active render mode.
     */
    get activePages() {
        return this.renderMode === 'vector' ? this._vectorPages : this._livePages;
    }

    /**
     * Resets the controller state to allow uploading another document.
     */
    reset() {
        this.status = 'idle';
        this.progressText = 'Preparing document...';
        this.fileName = '';
        this.pdfDocument = null;
        this._vectorPages = [];
        this._livePages = [];
        this.host.requestUpdate();
    }

    /**
     * Loads a new PDF document, resets caches, and runs the converter.
     * @param {object} pdf - Loaded PDF.js document object
     * @param {string} fileName - Original filename
     */
    async loadPdf(pdf, fileName) {
        this.pdfDocument = pdf;
        this.fileName = fileName;
        this._vectorPages = [];
        this._livePages = [];
        
        await this.triggerConversion();
    }

    /**
     * Toggles the render mode between vector outlines and live text.
     * Triggers the converter immediately if a PDF is loaded.
     * @param {string} mode - 'vector' or 'live'
     */
    async setRenderMode(mode) {
        if (this.renderMode === mode) return;
        this.renderMode = mode;
        this.host.requestUpdate(); // Request host visual refresh for toggled button state

        if (this.pdfDocument) {
            await this.triggerConversion();
        }
    }

    /**
     * Coordinates the page conversion loop. Updates progressive status 
     * and caches rendered SVG page nodes in memory.
     */
    async triggerConversion() {
        if (!this.pdfDocument) return;

        // Instantly transition if pages for the active mode are already cached
        const cachedList = this.renderMode === 'vector' ? this._vectorPages : this._livePages;
        if (cachedList.length === this.pdfDocument.numPages) {
            this.status = 'done';
            this.host.requestUpdate();
            return;
        }

        this.status = 'converting';
        const numPages = this.pdfDocument.numPages;
        this.progressText = `Starting conversion of ${numPages} page(s)...`;
        this.host.requestUpdate();

        try {
            const results = [];

            for (let i = 1; i <= numPages; i++) {
                this.progressText = `Processing page ${i} of ${numPages}...`;
                this.host.requestUpdate();

                const page = await this.pdfDocument.getPage(i);
                
                let svgNode;
                try {
                    // Call shapes/outlines converter service, passing a progress callback to show real-time font loading countdowns
                    svgNode = await renderPageToSvg(page, this.renderMode, (subStatus) => {
                        this.progressText = `Processing page ${i} of ${numPages}: ${subStatus}`;
                        this.host.requestUpdate();
                    });
                } catch (err) {
                    console.warn(`Vector shaper failed on page ${i}, fallback to canvas.`, err);
                    this.progressText = `Vector failed on page ${i}, applying canvas fallback...`;
                    this.host.requestUpdate();
                    
                    svgNode = await this.renderPageToCanvasSvg(page);
                }

                if (svgNode) {
                    const cleanName = this.fileName.replace(/\.[^/.]+$/, "");
                    const svgFileName = `${cleanName}_page_${i}.svg`;
                    
                    // Clone the element for cache node isolation in DOM mounts
                    const clonedSvg = svgNode.cloneNode(true);
                    const rawXml = new XMLSerializer().serializeToString(svgNode);
                    const cleanXml = rawXml
                        .replace(/<svg:([a-zA-Z0-9_-]+)/g, '<$1')
                        .replace(/<\/svg:([a-zA-Z0-9_-]+)>/g, '</$1>')
                        .replace(/xmlns:svg="http:\/\/www.w3.org\/2000\/svg"/g, 'xmlns="http://www.w3.org/2000/svg"');

                    results.push({
                        pageNum: i,
                        fileName: svgFileName,
                        svgElement: clonedSvg,
                        originalSvgHtml: cleanXml
                    });
                }
            }

            // Cache output elements for instant mode transitions
            if (this.renderMode === 'vector') {
                this._vectorPages = results;
            } else {
                this._livePages = results;
            }

            this.status = 'done';
            this.host.requestUpdate();
        } catch (error) {
            console.error('Error during conversion process:', error);
            alert('An error occurred during conversion. Check console log for details.');
            
            this.status = 'idle';
            this.host.requestUpdate();
        }
    }

    /**
     * Decoupled canvas fallback shaper to ensure rendering safety.
     */
    async renderPageToCanvasSvg(page) {
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        await page.render(renderContext).promise;

        const dataUrl = canvas.toDataURL('image/png');
        const imageId = `fallback-image-${Math.random().toString(36).substring(2, 9)}`;

        const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     xmlns:xlink="http://www.w3.org/1999/xlink"
     version="1.1" 
     width="${viewport.width}" 
     height="${viewport.height}"
     viewBox="0 0 ${viewport.width} ${viewport.height}">
  <defs>
    <image id="${imageId}" width="${viewport.width}" height="${viewport.height}" xlink:href="${dataUrl}"/>
  </defs>
  <rect width="${viewport.width}" height="${viewport.height}" fill="white"/>
  <use href="#${imageId}"/>
</svg>`;

        const parser = new DOMParser();
        const doc = parser.parseFromString(svgString, 'image/svg+xml');
        return doc.documentElement;
    }
}
