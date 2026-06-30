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
    const svgElement = svgDoc.documentElement;

    if (renderMode === 'live') {
        const textElements = svgElement.querySelectorAll('text, tspan');
        textElements.forEach(el => {
            // 1. Clean subset prefix from font-family and add generic fallback (e.g. MUFUZY+Consolas -> Consolas, monospace)
            const fontFamily = el.getAttribute('font-family');
            if (fontFamily) {
                let cleanFont = fontFamily.replace(/^[A-Z]{6}\+/, '');
                if (/consolas|mono|courier/i.test(cleanFont)) {
                    cleanFont = `${cleanFont}, monospace`;
                } else if (/gothic|sans|arial|helvetica/i.test(cleanFont)) {
                    cleanFont = `${cleanFont}, sans-serif`;
                } else if (/simsun|ming|serif|times/i.test(cleanFont)) {
                    cleanFont = `${cleanFont}, serif`;
                } else {
                    cleanFont = `${cleanFont}, sans-serif`;
                }
                el.setAttribute('font-family', cleanFont);
            }

            // 2. Fix spacing scramble for Latin/numeric text elements by keeping only the first x-coordinate
            const xAttr = el.getAttribute('x');
            if (xAttr && xAttr.trim().includes(' ')) {
                const textContent = el.textContent || '';
                if (/[a-zA-Z0-9]/.test(textContent)) {
                    const xCoords = xAttr.trim().split(/\s+/);
                    if (xCoords.length > 0) {
                        el.setAttribute('x', xCoords[0]);
                    }
                }
            }
        });
    }

    return svgElement;
}