import { FontResolver } from './font-resolver.js';
import { GlyphVectoriser } from './glyph-vectoriser.js';

const fontResolver = new FontResolver();
const vectoriser = new GlyphVectoriser(fontResolver);

// Vite-resolved font URLs for embedding fonts as base64 data URIs
// These resolve to the correct hashed paths in production builds
import notoSansSCUrl from '../assets/fonts/noto-sans-sc.woff?url';
import notoSansTCUrl from '../assets/fonts/noto-sans-tc.woff?url';
import notoSansJPUrl from '../assets/fonts/noto-sans-jp.woff?url';
import notoSansKRUrl from '../assets/fonts/noto-sans-kr.woff?url';
import notoSansUrl from '../assets/fonts/noto-sans.woff?url';
import notoSansMonoUrl from '../assets/fonts/noto-sans-mono.woff?url';

// Map of font files to their Vite-resolved URLs
const FONT_URL_MAP = {
    'noto-sans-sc.woff': notoSansSCUrl,
    'noto-sans-tc.woff': notoSansTCUrl,
    'noto-sans-jp.woff': notoSansJPUrl,
    'noto-sans-kr.woff': notoSansKRUrl,
    'noto-sans.woff':    notoSansUrl,
    'noto-sans-mono.woff': notoSansMonoUrl,
};

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

// Characters that differ between Traditional and Simplified Chinese
// Used for TC-vs-SC detection in CJK Unified Ideographs
const TC_SPECIAL_CHARS = /[\u5ef6\u8f2a\u7e41\u6215\u93a3\u8d81\u8a20\u96a8\u500d\u52d9\u904e\u5ed6\u958b\u9d0e\u51fa\u93ab\u9b3c\u5c60\u5d11\u8ca0\u8ced\u8cb4\u8dd6\u96c6\u96d6\u96b6\u9a37\u9a2e\u9a36\u9a4a\u9a4d\u9a4e\u9a52\u9a5a\u9a5b\u9a62\u9a65\u9a6a\u9a66\u9a6b\u9a6c\u9a6d]/u;

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
    
    // Always fetch textContent — vector mode needs Unicode strings to replace garbled SVG text nodes
    [opList, textContent] = await Promise.all([
        page.getOperatorList(),
        page.getTextContent({ includeMarkedContent: true })
    ]);

    const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
    const svgGfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs);

    // Scale 1.5 for premium crispness in Figma imports
    const viewport = page.getViewport({ scale: 1.5 });
    const svgElement = await svgGfx.getSVG(opList, viewport);

    if (renderMode === 'vector') {
        await vectoriser.vectorizeTextElements(svgElement, textContent, page.commonObjs, onProgress);
    } else {
        const textNodes = svgElement.querySelectorAll('text');
        const textItems = textContent.items.filter(item => item.str !== undefined);
        await _applyLiveText(svgElement, textNodes, textItems, page, viewport.scale);
    }

    return svgElement;
}

/**
 * Editable Text Mode: Replace garbled PDF font strings with correct Unicode,
 * and inject @font-face rules with base64-embedded fonts for blob: URL iframe compatibility.
 */
async function _applyLiveText(svgElement, textNodes, textItems, page, viewportScale = 1.5) {
    const neededLangKeys = new Set();

    // ── Phase 3.2: Coordinate-based text node matching ──
    // Instead of sequential indexing (which breaks when SVG <text> node order
    // doesn't match textContent.items order), match by spatial proximity.
    
    // Build a spatial index of textItems by their anchor positions
    const indexedItems = textItems.map((item, idx) => ({
        item,
        idx,
        anchorX: item.transform ? item.transform[4] : 0,
        anchorY: item.transform ? item.transform[5] : 0,
        rect: item.rect || null,
    }));
    // Sort top-to-bottom, left-to-right
    indexedItems.sort((a, b) => {
        if (Math.abs(a.anchorY - b.anchorY) > 5) return a.anchorY - b.anchorY;
        return a.anchorX - b.anchorX;
    });

    let consumedIdx = 0;

    for (const textNode of textNodes) {
        // Get SVG text node position from its x/y attributes
        const svgX = parseFloat(textNode.getAttribute('x')) || 0;
        const svgY = parseFloat(textNode.getAttribute('y')) || 0;

        // Find the best matching unconsumed textItem by Y proximity (within 10px tolerance)
        let bestMatch = null;
        let bestIdx = -1;
        for (let j = consumedIdx; j < indexedItems.length; j++) {
            const st = indexedItems[j];
            const yDelta = Math.abs(st.anchorY - svgY);
            if (yDelta <= 10) {
                bestMatch = st.item;
                bestIdx = j;
                break;
            }
        }

        let matchedItem = null;
        if (bestMatch && bestIdx >= consumedIdx) {
            matchedItem = bestMatch;
            consumedIdx = bestIdx + 1;
        }

        if (!matchedItem) {
            // No matching textItem found — skip this text node
            continue;
        }

        const unicodeStr = matchedItem.str;
        
        // Set correct Unicode text
        textNode.textContent = unicodeStr;

        // --- Set font-size explicitly ---
        let fontSize = 8; // fallback (px)
        if (matchedItem.height > 0) {
            fontSize = matchedItem.height * viewportScale;
        } else if (matchedItem.transform && matchedItem.transform.length >= 4) {
            const pdfFontSize = Math.abs(matchedItem.transform[3]);
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

    // Inject @font-face rules with base64-embedded fonts for blob: URL iframe compatibility
    if (neededLangKeys.size > 0) {
        await _injectFontsAsBase64(svgElement, neededLangKeys);
    }
}

/**
 * Detect primary CJK script in a string.
 * Returns 'sc', 'tc', 'jp', or 'kr'.
 *
 * Phase 3.1 improvement: detects TC-specific characters to prefer
 * Traditional Chinese over Simplified Chinese for Taiwanese PDFs.
 */
function _detectCjkScript(str) {
    let hasTC = false;
    
    for (const char of str) {
        const code = char.charCodeAt(0);
        if (code >= 0xAC00 && code <= 0xD7AF) return 'kr'; // Korean Hangul
        if (code >= 0x3040 && code <= 0x30FF) return 'jp'; // Hiragana/Katakana
        if (code >= 0xFF66 && code <= 0xFF9F) return 'jp'; // Half-width Katakana

        // Check for TC-specific characters (differing glyph forms)
        if (TC_SPECIAL_CHARS.test(char)) hasTC = true;
    }

    // If TC-specific characters are found, prefer TC
    if (hasTC) return 'tc';

    // Default to SC for CJK Unified ideographs
    return 'sc';
}

/** Map lang key to font family name */
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
 * Inject @font-face rules with base64-embedded font data URIs into the SVG.
 * This solves the blob: URL iframe issue — external font URLs don't resolve
 * inside blob: origins, but base64 data URIs are self-contained.
 */
async function _injectFontsAsBase64(svgElement, langKeys) {
    let defs = svgElement.querySelector('defs');
    if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svgElement.insertBefore(defs, svgElement.firstChild);
    }

    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    let css = '';

    for (const key of langKeys) {
        const entry = LOCAL_FONT_FILES[key];
        if (!entry) continue;

        try {
            // Fetch the font file using the Vite-resolved URL
            const fontUrl = FONT_URL_MAP[entry.file] || `/assets/fonts/${entry.file}`;
            const res = await fetch(fontUrl);
            
            if (!res.ok) {
                console.warn(`Failed to fetch font for base64 injection: ${entry.file}`);
                continue;
            }

            const arrayBuf = await res.arrayBuffer();
            const byteArray = new Uint8Array(arrayBuf);
            
            // Convert to base64
            let binary = '';
            for (let i = 0; i < byteArray.length; i++) {
                binary += String.fromCharCode(byteArray[i]);
            }
            const base64 = btoa(binary);

            css += `@font-face {
  font-family: '${entry.family}';
  src: url('data:font/woff;base64,${base64}') format('woff');
  font-weight: 400 700;
  font-style: normal;
}
`;
        } catch (e) {
            console.warn(`Failed to embed font '${entry.file}' as base64:`, e.message);
        }
    }

    css += `text, tspan { font-synthesis: none; }
`;

    styleEl.textContent = css;
    defs.appendChild(styleEl);
}
