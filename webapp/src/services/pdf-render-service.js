import { FontResolver } from './font-resolver.js';
import { GlyphVectoriser } from './glyph-vectoriser.js';

const fontResolver = new FontResolver();
const vectoriser = new GlyphVectoriser(fontResolver);

// Local font files for live-text mode @font-face injection.
// These point to the bundled full-size Noto WOFF files in the fonts/ directory.
const LOCAL_FONT_FILES = {
    sc:    { family: 'Noto Sans SC',   file: 'noto-sans-sc.woff' },
    tc:    { family: 'Noto Sans TC',   file: 'noto-sans-tc.woff' },
    jp:    { family: 'Noto Sans JP',   file: 'noto-sans-jp.woff' },
    kr:    { family: 'Noto Sans KR',   file: 'noto-sans-kr.woff' },
    mono:  { family: 'Noto Sans Mono', file: 'noto-sans-mono.woff' },
    latin: { family: 'Noto Sans',      file: 'noto-sans.woff' },
};

// CJK block detector
const CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af]/u;

/**
 * Renders a PDF page to a fully resolved SVG element.
 * @param {object} page - The PDF.js page object
 * @param {string} renderMode - 'vector' (outline shapes) or 'live' (selectable text)
 * @param {Function} onProgress - Progress status callback
 * @returns {Promise<SVGElement>} Rendered SVG DOM node
 */
export async function renderPageToSvg(page, renderMode = 'vector', onProgress) {
    let opList, textContent;
    
    if (renderMode === 'vector') {
        opList = await page.getOperatorList();
    } else {
        [opList, textContent] = await Promise.all([
            page.getOperatorList(),
            page.getTextContent({ includeMarkedContent: true })
        ]);
    }

    const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
    const svgGfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs);

    // Scale 1.5 for premium crispness in Figma imports
    const viewport = page.getViewport({ scale: 1.5 });
    const svgElement = await svgGfx.getSVG(opList, viewport);

    if (renderMode === 'vector') {
        await vectoriser.vectorizeTextElements(svgElement, page.commonObjs, onProgress);
    } else {
        const textNodes = svgElement.querySelectorAll('text');
        const textItems = textContent.items.filter(item => item.str !== undefined);
        await _applyLiveText(svgElement, textNodes, textItems, page, viewport.scale);
    }

    return svgElement;
}

/**
 * Editable Text Mode: Replace garbled PDF font strings with correct Unicode,
 * and inject @font-face rules via Google Fonts CDN.
 */
async function _applyLiveText(svgElement, textNodes, textItems, page, viewportScale = 1.5) {
    const neededLangKeys = new Set();
    let textItemIdx = 0;

    for (let i = 0; i < textNodes.length; i++) {
        const textNode = textNodes[i];

        // Skip empty textContent items
        while (textItemIdx < textItems.length && textItems[textItemIdx].str === '') {
            textItemIdx++;
        }
        if (textItemIdx >= textItems.length) {
            textNode.remove();
            continue;
        }

        const textItem = textItems[textItemIdx];
        textItemIdx++;

        const unicodeStr = textItem.str;
        
        // Set correct Unicode text
        textNode.textContent = unicodeStr;

        // --- Set font-size explicitly ---
        // PDF.js SVGGraphics does NOT put font-size on <text> elements as an inline attribute;
        // it uses a CSS class on the parent <g> (which we strip). Without this, text renders
        // at the browser's default 16px instead of the correct PDF font size.
        //
        // textItem.height = character height in PDF user space (points).
        // Multiply by viewportScale to get SVG pixel size.
        // Fallback: read from textItem.transform[3] (the font size component).
        let fontSize = 8; // fallback (px)
        if (textItem.height > 0) {
            fontSize = textItem.height * viewportScale;
        } else if (textItem.transform && textItem.transform.length >= 4) {
            const pdfFontSize = Math.abs(textItem.transform[3]);
            if (pdfFontSize > 0) fontSize = pdfFontSize * viewportScale;
        }
        textNode.setAttribute('font-size', `${fontSize.toFixed(3)}px`);

        // Determine font family
        let fontFamily = 'Noto Sans';
        let langKey = 'latin';

        if (CJK_RE.test(unicodeStr)) {
            langKey = _detectCjkScript(unicodeStr);
            fontFamily = _cjkLangToFamily(langKey);
        } else if (/[0-9a-zA-Z]/.test(unicodeStr)) {
            // Keep existing PDF font for basic Latin (usually embedded correctly)
            const rawFamily = textNode.getAttribute('font-family') || '';
            if (/mono|consolas|courier/i.test(rawFamily)) {
                langKey = 'mono';
                fontFamily = 'Noto Sans Mono';
            }
        }

        textNode.setAttribute('font-family', `'${fontFamily}', sans-serif`);
        neededLangKeys.add(langKey);

        // Propagate font family to child tspans
        textNode.querySelectorAll('tspan').forEach(tspan => {
            tspan.setAttribute('font-family', `'${fontFamily}', sans-serif`);
        });
    }

    // Inject a single <style> block with Google Fonts @import rules into <defs>
    if (neededLangKeys.size > 0) {
        _injectGoogleFontsFaces(svgElement, neededLangKeys);
    }
}

/**
 * Detect primary CJK script in a string.
 * Returns 'sc', 'tc', 'jp', or 'kr'.
 */
function _detectCjkScript(str) {
    for (const char of str) {
        const code = char.charCodeAt(0);
        if (code >= 0xAC00 && code <= 0xD7AF) return 'kr'; // Korean Hangul
        if (code >= 0x3040 && code <= 0x30FF) return 'jp'; // Hiragana/Katakana
        if (code >= 0xFF66 && code <= 0xFF9F) return 'jp'; // Half-width Katakana
    }
    // Default to SC for CJK Unified ideographs (most common for Taiwan/China PDFs)
    // Note: TC vs SC can't be determined from character codes alone without context
    return 'sc';
}

/** Map lang key to Google Fonts family name */
function _cjkLangToFamily(langKey) {
    return {
        sc: 'Noto Sans SC',
        tc: 'Noto Sans TC',
        jp: 'Noto Sans JP',
        kr: 'Noto Sans KR',
        mono: 'Noto Sans Mono',
        latin: 'Noto Sans',
    }[langKey] || 'Noto Sans';
}

/**
 * Inject a <style> element into the SVG <defs> with @font-face rules
 * pointing to the bundled local Noto WOFF files.
 * Uses absolute URLs so fonts resolve correctly when the SVG is rendered
 * inside a blob: URL iframe (which has no base URL for relative paths).
 */
function _injectGoogleFontsFaces(svgElement, langKeys) {
    let defs = svgElement.querySelector('defs');
    if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svgElement.insertBefore(defs, svgElement.firstChild);
    }

    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    let css = '';

    for (const key of langKeys) {
        const entry = LOCAL_FONT_FILES[key];
        if (entry) {
            const fontUrl = new URL(`../assets/fonts/${entry.file}`, import.meta.url).href;
            css += `@font-face {
  font-family: '${entry.family}';
  src: url('${fontUrl}') format('woff');
  font-weight: 400 700;
  font-style: normal;
}\n`;
        }
    }

    css += `text, tspan { font-synthesis: none; }\n`;

    styleEl.textContent = css;
    defs.appendChild(styleEl);
}
