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
        const CJK_ONLY = /^[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f。、，：；！？「」『』（）【】\s]+$/;
        const textElements = Array.from(svgElement.querySelectorAll('text, tspan'));

        // Resolution helpers for parent/tspan coordinates
        const getAttr = (el, attrName) => {
            const val = el.getAttribute(attrName);
            if (val) return val;
            const firstTspan = el.querySelector('tspan');
            if (firstTspan) return firstTspan.getAttribute(attrName);
            return null;
        };

        const getX = (el) => {
            const x = getAttr(el, 'x');
            return x ? parseFloat(x.trim().split(/\s+/)[0]) || 0 : 0;
        };

        const getY = (el) => {
            const y = getAttr(el, 'y');
            return y ? parseFloat(y.trim().split(/\s+/)[0]) || 0 : 0;
        };

        const cleanFontFamily = (font) => {
            if (!font) return 'sans-serif';
            let cleanFont = font.replace(/^[A-Z]{6}\+/, '');
            if (/consolas|mono|courier/i.test(cleanFont)) {
                return `${cleanFont}, monospace`;
            } else if (/gothic|sans|arial|helvetica/i.test(cleanFont)) {
                if (/ms-pgothic/i.test(cleanFont)) {
                    return `${cleanFont}, "PingFang TC", "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif`;
                } else {
                    return `${cleanFont}, sans-serif`;
                }
            } else if (/simsun|ming|serif|times/i.test(cleanFont)) {
                if (/simsun|simhei|ming/i.test(cleanFont)) {
                    return `${cleanFont}, "PingFang TC", "Microsoft JhengHei", "Noto Sans CJK TC", serif`;
                } else {
                    return `${cleanFont}, serif`;
                }
            }
            return `${cleanFont}, "PingFang TC", "Microsoft JhengHei", "Noto Sans CJK TC", sans-serif`;
        };

        const originalWidths = new Map();

        // ── Pass 1: Clean font-family fallbacks and record original widths ──
        textElements.forEach(el => {
            const fontFamily = el.getAttribute('font-family');
            if (fontFamily) {
                el.setAttribute('font-family', cleanFontFamily(fontFamily));
            }

            const xAttr = el.getAttribute('x');
            if (xAttr && xAttr.trim().includes(' ')) {
                const xCoords = xAttr.trim().split(/\s+/).map(Number);
                const textContent = el.textContent || '';
                
                el.setAttribute('x', xCoords[0].toString());

                if (xCoords.length > 1) {
                    const x0 = xCoords[0];
                    const xLast = xCoords[xCoords.length - 1];
                    const n = xCoords.length;
                    const wAvg = (xLast - x0) / (n - 1);
                    const originalWidth = xLast - x0 + wAvg;
                    
                    // Map to both tspan and parent text node to resolve coordinate mappings
                    originalWidths.set(el, originalWidth);
                    if (el.parentElement && el.parentElement.tagName.toLowerCase() === 'text') {
                        originalWidths.set(el.parentElement, originalWidth);
                    }

                    if (!CJK_ONLY.test(textContent)) {
                        el.setAttribute('textLength', originalWidth.toFixed(3));
                        el.setAttribute('lengthAdjust', 'spacingAndGlyphs');
                    } else {
                        el.removeAttribute('textLength');
                        el.removeAttribute('lengthAdjust');
                    }
                }
            }
        });

        // ── Pass 2: Merge adjacent same-line text elements into natural flows ──
        const textEls = Array.from(svgElement.querySelectorAll('text'));
        const groups = new Map();

        for (const tel of textEls) {
            const parent = tel.parentElement;
            if (!parent) continue;
            const y = getY(tel);
            const parentIndex = Array.from(svgElement.querySelectorAll('*')).indexOf(parent);
            const groupKey = `${parentIndex}:${y.toFixed(0)}`;
            if (!groups.has(groupKey)) groups.set(groupKey, []);
            groups.get(groupKey).push(tel);
        }

        for (const [, group] of groups) {
            if (group.length < 2) continue;

            group.sort((a, b) => getX(a) - getX(b));

            const runs = [];
            let currentRun = [group[0]];

            for (let i = 1; i < group.length; i++) {
                const prevEl = group[i - 1];
                const currEl = group[i];
                
                const prevX = getX(prevEl);
                const fontSizeAttr = getAttr(prevEl, 'font-size');
                const fontSize = parseFloat(fontSizeAttr) || 12;
                
                let prevLen = originalWidths.get(prevEl) || parseFloat(prevEl.getAttribute('textLength')) || parseFloat(getAttr(prevEl, 'textLength')) || 0;
                
                if (prevLen === 0) {
                    const text = prevEl.textContent || '';
                    let estimatedEm = 0;
                    for (const char of text) {
                        if (/[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(char)) {
                            estimatedEm += 1.0;
                        } else {
                            estimatedEm += 0.5;
                        }
                    }
                    prevLen = estimatedEm * fontSize;
                }
                
                const currX = getX(currEl);
                const gap = Math.abs(currX - (prevX + prevLen));
                
                // Dynamic adjacency tolerance: scales with 0.52em of the preceding font size,
                // sitting precisely between a 0.5em CJK-punctuation font transition gap and a >0.54em column gap.
                const tolerance = 0.52 * fontSize;

                if (gap <= tolerance) {
                    currentRun.push(currEl);
                } else {
                    runs.push(currentRun);
                    currentRun = [currEl];
                }
            }
            runs.push(currentRun);

            for (const run of runs) {
                if (run.length < 2) continue;

                const container = run[0];
                const containerX = getX(container);
                const containerY = getY(container);

                const elLast = run[run.length - 1];
                let lastLen = originalWidths.get(elLast) || parseFloat(elLast.getAttribute('textLength')) || parseFloat(getAttr(elLast, 'textLength')) || 0;
                if (lastLen === 0) {
                    const text = elLast.textContent || '';
                    const fontSizeAttr = getAttr(elLast, 'font-size');
                    const fontSize = parseFloat(fontSizeAttr) || 12;
                    let estimatedEm = 0;
                    for (const char of text) {
                        if (/[\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(char)) {
                            estimatedEm += 1.0;
                        } else {
                            estimatedEm += 0.5;
                        }
                    }
                    lastLen = estimatedEm * fontSize;
                }
                const totalOriginalWidth = (getX(elLast) + lastLen) - containerX;

                const children = Array.from(container.childNodes);
                if (children.length === 0) {
                    const textNode = parser.parseFromString(container.textContent, 'image/svg+xml').createTextNode(container.textContent);
                    // Standard browser DOM allows creating text nodes via parent document
                    container.appendChild(svgElement.ownerDocument.createTextNode(container.textContent));
                }

                for (let i = 1; i < run.length; i++) {
                    const el = run[i];
                    const tspan = svgElement.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                    tspan.textContent = el.textContent;
                    
                    const copyAttrs = ['font-family', 'font-size', 'fill'];
                    for (const attr of copyAttrs) {
                        const val = getAttr(el, attr);
                        if (val && val !== getAttr(container, attr)) {
                            tspan.setAttribute(attr, val);
                        }
                    }
                    container.appendChild(tspan);
                    el.remove();
                }

                container.setAttribute('x', containerX.toString());
                container.setAttribute('y', containerY.toString());

                container.setAttribute('textLength', totalOriginalWidth.toFixed(3));
                container.setAttribute('lengthAdjust', 'spacingAndGlyphs');
                
                const firstTspan = container.querySelector('tspan');
                if (firstTspan) {
                    firstTspan.removeAttribute('x');
                    firstTspan.removeAttribute('y');
                }
            }
        }
    }

    return svgElement;
}