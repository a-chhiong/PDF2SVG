import { renderPageToSvg } from '../services/pdf-service.js';
import * as mupdf from 'mupdf';

export class AppController {
  constructor(host) {
    this.host = host;
    this.host.addController(this);

    // Core reactive states
    this.status = 'idle'; // 'idle', 'converting', 'done'
    this.progressText = 'Preparing document...';
    this.progress = 0;
    this.renderMode = 'live'; // 'vector' or 'live'
    this.fileName = '';
    this.pdfArrayBuffer = null;

    // Isolated multi-mode page caches
    /** @type {Array} */
    this._vectorPages = [];
    /** @type {Array} */
    this._livePages = [];
  }

  /** @returns {Array} */
  get activePages() {
    return this.renderMode === 'live' ? this._livePages : this._vectorPages;
  }

  reset() {
    this.status = 'idle';
    this.progressText = 'Preparing document...';
    this.progress = 0;
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

    const prevMode = this.renderMode;
    this.renderMode = mode;
    this.host.requestUpdate();

    if (!this.pdfArrayBuffer) return;

    // If the target mode is already cached, just flip immediately
    const cachedList = this.renderMode === 'vector' ? this._vectorPages : this._livePages;
    if (cachedList.length > 0) {
      this.status = 'done';
      this.host.requestUpdate();
      return;
    }

    // Show the progress indicator before starting heavy work
    this.status = 'converting';
    this.progress = 0;
    this.progressText = 'Switching mode...';
    this.host.requestUpdate();

    // Yield to the event loop so Lit can render the progress indicator
    await new Promise(r => setTimeout(r, 50));

    await this.triggerConversion();
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
    this.progressText = 'Initializing MuPDF WASM core structures...';
    this.progress = 0;
    this.host.requestUpdate();

    let doc = null;
    try {
      doc = mupdf.Document.openDocument(this.pdfArrayBuffer, 'application/pdf');
      const numPages = doc.countPages();
      const results = [];

      for (let i = 0; i < numPages; i++) {
        const pageNumDisplay = i + 1;
        this.progressText = `Processing page ${pageNumDisplay} of ${numPages}...`;
        this.progress = Math.round(((i) / numPages) * 100);
        this.host.requestUpdate();

        // Yield to the event loop so Lit can paint the progress update
        await new Promise(r => setTimeout(r, 0));

        const svgNode = renderPageToSvg(doc, i, this.renderMode);

        if (svgNode) {
          const cleanName = this.fileName.replace(/\.[^/.]+$/, '');
          const svgFileName = `${cleanName}_page_${pageNumDisplay}.svg`;

          const clonedSvg = svgNode.cloneNode(true);
          const rawXml = new XMLSerializer().serializeToString(svgNode);

          let cleanXml = rawXml
            .replace(/<svg:([a-zA-Z0-9_-]+)/g, '<$1')
            .replace(/<\/svg:([a-zA-Z0-9_-]+)>/g, '</$1>')
            .replace(
              /xmlns:svg="http:\/\/www.w3.org\/2000\/svg"/g,
              'xmlns="http://www.w3.org/2000/svg"'
            );

          const pagePrefix = `p-${pageNumDisplay}-`;
          cleanXml = cleanXml
            .replace(/id="([a-zA-Z0-9_-]+)"/g, `id="${pagePrefix}$1"`)
            .replace(/href="#([a-zA-Z0-9_-]+)"/g, `href="#${pagePrefix}$1"`)
            .replace(/url\(#([a-zA-Z0-9_-]+)\)/g, `url(#${pagePrefix}$1)`);

          results.push({
            pageNum: pageNumDisplay,
            fileName: svgFileName,
            svgElement: clonedSvg,
            originalSvgHtml: cleanXml,
          });
        }
      }

      this.progress = 100;

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
      if (doc) {
        doc.destroy();
      }
    }
  }
}