import * as mupdf from 'mupdf';

/**
 * Renders a PDF page to a fully resolved SVG element using MuPDF.js.
 * @param {object} doc - Active MuPDF document instance
 * @param {number} pageIndex - The 0-based page index to extract
 * @param {string} renderMode - UI switch: 'vector' (text=path) or 'live' (text=text)
 * @returns {SVGElement} Self-contained SVG DOM element
 */
export function renderPageToSvg(doc, pageIndex, renderMode = 'vector') {
    const page = doc.loadPage(pageIndex);
    const bounds = page.getBounds();

    const buf = new mupdf.Buffer();
    // Vector Outlines mode enforces path generation, Editable Text maps to string streams
    const textOption = renderMode === 'vector' ? 'text=path' : 'text=text';
    
    const writer = new mupdf.DocumentWriter(buf, "svg", textOption);
    const dev = writer.beginPage([bounds[0], bounds[1], bounds[2], bounds[3]]);
    
    // Execute content streams alongside interactive annotations
    page.runPageContents(dev, mupdf.Matrix.identity);
    page.runPageAnnots(dev, mupdf.Matrix.identity);
    
    writer.endPage();
    writer.close();

    const svgString = buf.asString();
    page.destroy(); // Safely release page reference from WASM heap allocation

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    return svgDoc.documentElement;
}