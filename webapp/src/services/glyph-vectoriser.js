/**
 * GlyphVectoriser — Converts text runs from PDF.js SVG output into clean SVG bezier path data.
 * Matches the style and coordinate cascading architecture of the C# SvgTextVectoriser.
 *
 * Font resolution uses a four-tier fallback chain:
 *   Tier 1: Embedded @font-face fonts parsed from the SVG's own <style> block
 *            (PdfToSvg.NET output; PDF.js output has none, so this is a no-op).
 *   Tier 2: PDF.js commonObjs async font data (rarely available in browser context).
 *   Tier 3: Local bundled Noto Sans WOFF files (CJK + Latin + Mono).
 *   Tier 4: System font fallback via opentype.js's built-in fallback (last resort).
 */

// Vite-resolved font URLs — using ?url suffix so Vite resolves the correct hashed path in production
// Font files are in public/assets/fonts/ which are served verbatim at /assets/fonts/
// The imports also work in development mode via Vite's dev server
import notoSansSCUrl from '../assets/fonts/noto-sans-sc.woff?url';
import notoSansTCUrl from '../assets/fonts/noto-sans-tc.woff?url';
import notoSansJPUrl from '../assets/fonts/noto-sans-jp.woff?url';
import notoSansKRUrl from '../assets/fonts/noto-sans-kr.woff?url';
import notoSansUrl from '../assets/fonts/noto-sans.woff?url';
import notoSansMonoUrl from '../assets/fonts/noto-sans-mono.woff?url';

const CJK_BLOCK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af]/u;

// Map of font files to their Vite-resolved URLs
const FONT_URL_MAP = {
    'noto-sans-sc.woff': notoSansSCUrl,
    'noto-sans-tc.woff': notoSansTCUrl,
    'noto-sans-jp.woff': notoSansJPUrl,
    'noto-sans-kr.woff': notoSansKRUrl,
    'noto-sans.woff':    notoSansUrl,
    'noto-sans-mono.woff': notoSansMonoUrl,
};

// Local font filenames for each CJK language group (served from fonts/ directory)
const CJK_LOCAL_FONTS = {
    sc: 'noto-sans-sc.woff',   // Simplified Chinese (~1.5MB)
    tc: 'noto-sans-tc.woff',   // Traditional Chinese (~1.3MB)
    jp: 'noto-sans-jp.woff',   // Japanese (~1.3MB)
    kr: 'noto-sans-kr.woff',   // Korean (~830KB)
};

export class GlyphVectoriser {
    constructor(fontResolver) {
        this.fontResolver = fontResolver;

        // Cache of loaded opentype.Font objects
        this.fontCache = new Map();

        // Per-language font loading promises (for CJK and Latin fallbacks)
        this._fontPromises = new Map();

        // Flag to track whether embedded fonts have been loaded from the SVG
        this._embeddedFontsLoaded = false;
    }

    /**
     * Tier 1: Parse embedded @font-face fonts from the SVG's <style> block.
     *
     * PdfToSvg.NET embeds subsetted OpenType fonts as base64 data URIs inside
     * @font-face declarations. This method extracts them, decodes the base64,
     * parses with opentype.js, and caches by CSS font-family name.
     *
     * PDF.js SVGGraphics does NOT produce @font-face declarations, so this
     * is a no-op for PDF.js output — but the method is kept for API parity
     * and to support any future SVG source that does include them.
     *
     * @param {SVGElement} svgElement - The rendered SVG DOM node
     * @returns {Promise<void>} Resolves when all embedded fonts are parsed
     */
    async loadEmbeddedFonts(svgElement) {
        if (this._embeddedFontsLoaded) return;
        this._embeddedFontsLoaded = true;

        const styleEls = svgElement.querySelectorAll('style');
        for (const styleEl of styleEls) {
            const cssText = styleEl.textContent || '';

            // Match @font-face { ... } blocks
            const fontFaceRegex = /@font-face\s*\{([^}]+)\}/g;
            let match;
            while ((match = fontFaceRegex.exec(cssText)) !== null) {
                const rule = match[1];

                // Extract font-family name
                const familyMatch = rule.match(/font-family\s*:\s*['"]?([^'";]+?)['"]?\s*(?:;|$)/);
                // Extract base64 font data from src: url('data:font/opentype;base64,...')
                const srcMatch = rule.match(/src\s*:\s*url\s*\(\s*['"]?data:[^;]+;base64,([^'")\s]+(?:[^'")]*[^'")\s])*)['"]?\s*\)/);

                if (familyMatch && srcMatch) {
                    const familyName = familyMatch[1].trim().replace(/^['"]|['"]$/g, '');
                    const base64Data = srcMatch[1].replace(/\s/g, '');

                    if (this.fontCache.has(familyName)) continue; // already loaded

                    try {
                        const binaryString = atob(base64Data);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        const font = window.opentype.parse(bytes.buffer || bytes);
                        this.fontCache.set(familyName, font);
                        console.info(`GlyphVectoriser: Loaded embedded font '${familyName}' (${font.numGlyphs} glyphs)`);
                    } catch (e) {
                        console.warn(`GlyphVectoriser: Failed to parse embedded font '${familyName}':`, e.message);
                        this.fontCache.set(familyName, null);
                    }
                }
            }
        }
    }

    /**
     * Entry point: processes all <text> elements inside the SVG DOM node.
     * Replaces them with equivalent <g> nodes containing vectorized <path> shapes.
     * Implements coordinate cascading and ancestor style resolution.
     */
    async vectorizeTextElements(svgElement, textContent, commonObjs, onProgress) {
        // ── Tier 0: Load embedded @font-face fonts from SVG (PdfToSvg.NET output) ──
        await this.loadEmbeddedFonts(svgElement);

        // ── Build a position-keyed map of text items from PDF.js textContent ──
        // textContent.items[] contains Unicode strings with bounding rects.
        // We match SVG <text> nodes to text items by coordinate proximity.
        const textItems = textContent?.items?.filter(item => item.str !== undefined) || [];

        // 1. Parse CSS rules from the SVG's <style> block
        const cssClasses = this._parseCssClasses(svgElement);

        // 2. Query all <text> nodes and collect them to prevent DOM mutation errors during loop
        const textElements = Array.from(svgElement.querySelectorAll('text'));

        // ── Build a spatial index of textItems by their Y+mid-X position ──
        // PDF.js textContent items have a bounding rect (item.rect) and transform.
        // We sort them top-to-bottom, left-to-right for matching.
        const sortedTextItems = textItems.map((item, idx) => ({
            item,
            idx,
            // Use transform[4] (X), transform[5] (Y) as the anchor point
            anchorX: item.transform ? item.transform[4] : 0,
            anchorY: item.transform ? item.transform[5] : 0,
        }));
        // Sort by Y then X (top-to-bottom, left-to-right)
        sortedTextItems.sort((a, b) => {
            if (Math.abs(a.anchorY - b.anchorY) > 5) return a.anchorY - b.anchorY;
            return a.anchorX - b.anchorX;
        });

        // Track which text items have been consumed
        let consumedIdx = 0;

        for (const textEl of textElements) {
            // Create a <g> container to wrap the vectorized paths
            const gEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');

            // Transfer all non-layout attributes from <text> to the replacement <g> node
            for (const attr of textEl.attributes) {
                if (!['x', 'y', 'dx', 'dy', 'font-family', 'font-size', 'font-weight', 'data-font-name'].includes(attr.name)) {
                    gEl.setAttribute(attr.name, attr.value);
                }
            }

            // Parse coordinate lists from the parent <text> node
            const parentXCoords = this._parseCoordinateList(textEl.getAttribute('x'));
            const parentYCoords = this._parseCoordinateList(textEl.getAttribute('y'));
            const parentDxCoords = this._parseCoordinateList(textEl.getAttribute('dx'));
            const parentDyCoords = this._parseCoordinateList(textEl.getAttribute('dy'));

            // ── Find the best matching textItem for this SVG <text> node ──
            // Use the first character position from SVG coordinates as anchor
            const svgAnchorX = parentXCoords.length > 0 ? parentXCoords[0] : 0;
            const svgAnchorY = parentYCoords.length > 0 ? parentYCoords[0] : 0;

            // Find the closest unconsumed textItem by Y proximity (within 10px tolerance)
            let bestMatch = null;
            let bestIdx = -1;
            for (let j = consumedIdx; j < sortedTextItems.length; j++) {
                const st = sortedTextItems[j];
                const yDelta = Math.abs(st.anchorY - svgAnchorY);
                if (yDelta <= 10) {
                    bestMatch = st.item;
                    bestIdx = j;
                    break;
                }
            }

            // If we found a match, consume it (advance consumedIdx past it)
            let matchedItem = null;
            if (bestMatch && bestIdx >= consumedIdx) {
                matchedItem = bestMatch;
                consumedIdx = bestIdx + 1;
            }

            // Determine the Unicode string to render: from matched textItem if available
            const unicodeStr = matchedItem ? matchedItem.str : '';
            const hasUnicode = unicodeStr.length > 0;

            let currentX = 0;
            let currentY = 0;
            let globalCharIndex = 0;
            let isFirstChar = true;

            // Build chunks of text from the SVG <text> element for structure only
            // We use the Unicode string for actual rendering, but preserve tspan structure
            const svgChunks = [];
            for (const node of textEl.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const textStr = node.nodeValue;
                    if (textStr && textStr.trim()) {
                        svgChunks.push({ element: textEl });
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE && node.localName === 'tspan') {
                    svgChunks.push({ element: node });
                }
            }

            // If we have a matched textItem, use its Unicode string.
            // Otherwise fall back to the garbled SVG text content (which will tofu).
            const renderingStr = hasUnicode ? unicodeStr : (() => {
                // Fallback: collect garbled text from SVG child nodes
                let fallback = '';
                for (const node of textEl.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE) fallback += node.nodeValue || '';
                    else if (node.nodeType === Node.ELEMENT_NODE && node.localName === 'tspan') fallback += node.textContent || '';
                }
                return fallback;
            })();

            // ── Render the Unicode string character by character ──
            const paths = [];
            const chars = renderingStr;
            const fontSize = this._getFontSizeAttribute(textEl, cssClasses);

            for (let i = 0; i < chars.length; i++) {
                // Resolve absolute X position (same logic as before)
                if (parentXCoords.length > 0 && globalCharIndex < parentXCoords.length) {
                    currentX = parentXCoords[globalCharIndex];
                } else if (isFirstChar) {
                    currentX = parentXCoords.length > 0 ? parentXCoords[0] : 0;
                }

                // Resolve absolute Y position
                if (parentYCoords.length > 0 && globalCharIndex < parentYCoords.length) {
                    currentY = parentYCoords[globalCharIndex];
                } else if (isFirstChar) {
                    currentY = parentYCoords.length > 0 ? parentYCoords[0] : 0;
                }

                // Apply relative DX/DY shifts
                if (parentDxCoords.length > 0 && globalCharIndex < parentDxCoords.length) {
                    currentX += parentDxCoords[globalCharIndex];
                }
                if (parentDyCoords.length > 0 && globalCharIndex < parentDyCoords.length) {
                    currentY += parentDyCoords[globalCharIndex];
                }

                isFirstChar = false;

                const char = chars[i];

                // Resolve font-family for this text node
                const fontId = this._getInheritedStyleOrAttribute(textEl, 'font-family', cssClasses) || '';

                // Multi-tier glyph and font loader
                const { font: activeFont, glyphIdx } = await this._resolveFontAndGlyph(char, fontId, commonObjs, onProgress);

                if (activeFont && glyphIdx !== 0) {
                    try {
                        const glyphPath = activeFont.getPath(char, currentX, currentY, fontSize);
                        const pathStr = glyphPath.toPathData(2);
                        if (pathStr && pathStr.trim()) {
                            paths.push(pathStr);
                        }
                        // Advance cursor by font metrics width
                        currentX += activeFont.getAdvanceWidth(char, fontSize);
                    } catch (e) {
                        currentX += fontSize * 0.6;
                    }
                } else {
                    // Estimate character advance width
                    currentX += fontSize * 0.6;
                }

                globalCharIndex++;
            }

            if (paths.length > 0) {
                const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathEl.setAttribute('d', paths.join(' '));

                // Transfer styling rules from the original text element
                for (const attr of textEl.attributes) {
                    if (!['x', 'y', 'dx', 'dy', 'font-family', 'font-size', 'font-weight', 'data-font-name'].includes(attr.name)) {
                        pathEl.setAttribute(attr.name, attr.value);
                    }
                }

                // Assure fill defaults
                this._ensureDefaultFill(pathEl, textEl, cssClasses);

                gEl.appendChild(pathEl);
            }

            textEl.replaceWith(gEl);
        }
    }

    /**
     * Resolves the active font and glyph index using a four-tier fallback chain.
     *
     * Tier 1: Embedded @font-face fonts (already loaded into this.fontCache by key).
     * Tier 2: PDF.js commonObjs async font data.
     * Tier 3: Local bundled Noto Sans WOFF files (CJK + Latin + Mono).
     * Tier 4: Return null — character cannot be vectorized.
     */
    async _resolveFontAndGlyph(char, fontId, commonObjs, onProgress) {
        // ── Tier 1: Embedded @font-face fonts (from SVG's own <style> block) ──
        // These are the exact subsetted fonts from PdfToSvg.NET output.
        // Keyed by the CSS font-family name (e.g. "fut7LuT", "f8V5y9G").
        if (fontId) {
            const cachedFont = this.fontCache.get(fontId);
            if (cachedFont) {
                const glyphIdx = cachedFont.charToGlyphIndex(char);
                if (glyphIdx !== 0) {
                    return { font: cachedFont, glyphIdx };
                }
            }
        }

        // ── Tier 2: PDF.js commonObjs async font data ──
        // PDF.js may have font bytes in commonObjs, but in browser context this
        // is rarely available. We attempt it but don't block on it.
        if (fontId) {
            const primaryFont = await this.loadFontFromCommonObjs(fontId, commonObjs, onProgress);
            if (primaryFont) {
                const glyphIdx = primaryFont.charToGlyphIndex(char);
                if (glyphIdx !== 0) {
                    return { font: primaryFont, glyphIdx };
                }
            }
        }

        // ── Tier 3: Local bundled Noto Sans fallback fonts ──
        if (CJK_BLOCK.test(char)) {
            const langKey = this._getCjkLangKey(char, fontId);
            if (onProgress) onProgress(`Resolving fallback CJK font (${langKey})...`);
            const cjkFont = await this._loadLocalFontForLang(langKey);
            if (cjkFont) {
                const glyphIdx = cjkFont.charToGlyphIndex(char);
                if (glyphIdx !== 0) return { font: cjkFont, glyphIdx };

                // Fallback through remaining CJK languages sequentially
                const fallbackLangs = ['tc', 'sc', 'jp', 'kr'].filter(l => l !== langKey);
                for (const fallbackLang of fallbackLangs) {
                    const fallbackFont = await this._loadLocalFontForLang(fallbackLang);
                    if (fallbackFont) {
                        const fallbackGlyphIdx = fallbackFont.charToGlyphIndex(char);
                        if (fallbackGlyphIdx !== 0) return { font: fallbackFont, glyphIdx: fallbackGlyphIdx };
                    }
                }
            }
        } else {
            // Latin / non-CJK: resolve to appropriate local font file
            const fontFile = this.fontResolver.getFallbackFontFile(char, fontId);
            const latinFont = await this._loadLocalFallback(fontFile);
            if (latinFont) {
                const glyphIdx = latinFont.charToGlyphIndex(char);
                if (glyphIdx !== 0) return { font: latinFont, glyphIdx };
            }
        }

        // ── Tier 4: No font could render this character ──
        return { font: null, glyphIdx: 0 };
    }

    /**
     * Parses the SVG's internal CSS block to build a selector map.
     */
    _parseCssClasses(svgElement) {
        const cssClasses = {};
        const styleEls = svgElement.querySelectorAll('style');
        
        for (const styleEl of styleEls) {
            const cssText = styleEl.textContent;
            const regex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g;
            let match;
            while ((match = regex.exec(cssText)) !== null) {
                const className = match[1];
                const rulesText = match[2];
                const declarations = {};
                
                const ruleRegex = /([a-zA-Z0-9_-]+)\s*:\s*([^;]+)/g;
                let ruleMatch;
                while ((ruleMatch = ruleRegex.exec(rulesText)) !== null) {
                    declarations[ruleMatch[1].trim()] = ruleMatch[2].trim();
                }
                
                cssClasses[className] = declarations;
            }
        }
        return cssClasses;
    }

    /**
     * Splits list attributes into float lists.
     */
    _parseCoordinateList(val) {
        if (!val) return [];
        return val.trim().split(/[\s,]+/).map(parseFloat).filter(n => !isNaN(n));
    }

    /**
     * Ancestor tree climber resolving style values.
     */
    _getInheritedStyleOrAttribute(element, attrName, cssClasses) {
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            const val = this._getElementStyleOrAttribute(current, attrName, cssClasses);
            if (val) {
                if (attrName === 'font-family') {
                    const parts = val.split(',');
                    return parts[0].trim().replace(/['"]/g, '');
                }
                return val.trim();
            }
            current = current.parentElement;
        }
        return null;
    }

    /**
     * Resolves the CSS property directly declared on an element.
     */
    _getElementStyleOrAttribute(element, attrName, cssClasses) {
        // 1. Attribute
        const attrVal = element.getAttribute(attrName);
        if (attrVal) return attrVal;

        // 2. Class declarations
        const classVal = element.getAttribute('class');
        if (classVal) {
            const classes = classVal.split(/\s+/);
            for (const cls of classes) {
                if (cssClasses[cls] && cssClasses[cls][attrName]) {
                    return cssClasses[cls][attrName];
                }
            }
        }

        // 3. Inline style
        const styleText = element.getAttribute('style');
        if (styleText) {
            const regex = new RegExp(`(?:^|;)\\s*${attrName}\\s*:\\s*([^;]+)`);
            const match = regex.exec(styleText);
            if (match) {
                return match[1].trim();
            }
        }

        return null;
    }

    /**
     * Computes the numeric font size of an element.
     */
    _getFontSizeAttribute(element, cssClasses) {
        const val = this._getInheritedStyleOrAttribute(element, 'font-size', cssClasses);
        if (!val) return 12;
        const num = parseFloat(val.replace(/[^\d\.]/g, ''));
        return isNaN(num) ? 12 : num;
    }

    /**
     * Assures default path fills are set.
     */
    _ensureDefaultFill(pathEl, element, cssClasses) {
        if (!pathEl.getAttribute('fill')) {
            if (this._hasInheritedFill(element, cssClasses)) {
                return;
            }
            pathEl.setAttribute('fill', 'currentColor');
        }
    }

    /**
     * Checks if fill values are declared in the ancestry chain.
     */
    _hasInheritedFill(element, cssClasses) {
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            if (current.getAttribute('fill')) return true;
            const classVal = current.getAttribute('class');
            if (classVal) {
                const classes = classVal.split(/\s+/);
                for (const cls of classes) {
                    if (cssClasses[cls] && cssClasses[cls]['fill']) return true;
                }
            }
            const styleText = current.getAttribute('style');
            if (styleText && styleText.includes('fill:')) return true;
            current = current.parentElement;
        }
        return false;
    }

    /**
     * Tier 2: Load embedded PDF font bytes from PDF.js commonObjs.
     *
     * In browser context, PDF.js rarely provides font binary data through
     * commonObjs. This method attempts the async callback but returns null
     * gracefully if no data is available, allowing the fallback chain to
     * continue to Tier 3 (local bundled fonts).
     */
    async loadFontFromCommonObjs(fontId, commonObjs, onProgress) {
        if (!fontId) return null;
        if (this.fontCache.has(fontId)) return this.fontCache.get(fontId);

        // Check if PDF.js has this font registered
        if (typeof commonObjs?.has === 'function' && !commonObjs.has(fontId)) {
            this.fontCache.set(fontId, null);
            return null;
        }

        // ── Attempt with increased timeout and retry mechanism ──
        const MAX_RETRIES = 2;
        const TIMEOUT_MS = 15000; // Increased from 5000ms to 15000ms

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            const result = await this._tryLoadFontFromCommonObjs(fontId, commonObjs, TIMEOUT_MS, attempt);
            if (result !== null) {
                // Cache the result (font or null) so subsequent calls reuse it
                if (result) {
                    this.fontCache.set(fontId, result);
                }
                return result;
            }
        }

        // All attempts failed — cache null to avoid retrying
        this.fontCache.set(fontId, null);
        return null;
    }

    /**
     * Single attempt to load a font from PDF.js commonObjs with timeout.
     * Returns font or null on failure.
     */
    async _tryLoadFontFromCommonObjs(fontId, commonObjs, timeoutMs, attempt) {
        return new Promise((resolve) => {
            let resolved = false;

            const timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    if (attempt === 0) {
                        console.warn(`Font resolution timed out for: ${fontId} (attempt ${attempt + 1}). Retrying...`);
                    } else {
                        console.warn(`Font resolution timed out for: ${fontId} (attempt ${attempt + 1}). Falling back.`);
                    }
                    resolve(null);
                }
            }, timeoutMs);

            try {
                commonObjs?.get(fontId, (fontObj) => {
                    if (resolved) return;
                    resolved = true;
                    clearTimeout(timeoutId);

                    if (fontObj && fontObj.data) {
                        try {
                            const buffer = fontObj.data.buffer || fontObj.data;
                            const font = window.opentype.parse(buffer);
                            console.info(`GlyphVectoriser: Loaded font from commonObjs '${fontId}' (${font.numGlyphs} glyphs)`);
                            resolve(font);
                            return;
                        } catch (e) {
                            console.warn(`Failed to parse embedded PDF font: ${fontId}`, e.message);
                        }
                    }
                    resolve(null);
                });
            } catch (err) {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeoutId);
                    console.warn(`Failed to query commonObjs for: ${fontId}`, err);
                    resolve(null);
                }
            }
        });
    }

    /**
     * Detects CJK script type from a single character's Unicode code point.
     *
     * When fontId is available (from PdfToSvg.NET output), it provides hints
     * about the intended language (e.g. font-family names containing "gothic"
     * or "mincho" suggest Japanese). When fontId is empty (PDF.js output),
     * detection relies purely on Unicode ranges.
     *
     * For CJK Unified Ideographs ([\u4E00-\u9FFF]), we use a heuristic:
     * characters that have different forms in Traditional vs Simplified Chinese
     * are preferentially mapped to Traditional Chinese, as TC fonts contain
     * a superset of SC characters. This ensures the widest glyph coverage.
     */
    _getCjkLangKey(char, fontId) {
        const code = char.charCodeAt(0);

        // Korean Hangul Syllables
        if (code >= 0xAC00 && code <= 0xD7AF) return 'kr';
        // Japanese Hiragana
        if (code >= 0x3040 && code <= 0x309F) return 'jp';
        // Japanese Katakana
        if (code >= 0x30A0 && code <= 0x30FF) return 'jp';
        // Japanese Half-width Katakana
        if (code >= 0xFF66 && code <= 0xFF9F) return 'jp';

        // Japanese Kanji — only if fontId provides a hint
        if (fontId && /gothic|mincho|jp|japanese/i.test(fontId)) return 'jp';
        // Traditional Chinese — only if fontId provides a hint
        if (fontId && /tc|trad|hongkong|taiwan|tw|hk/i.test(fontId)) return 'tc';

        // CJK Unified Ideographs — use TC as primary (superset of SC glyphs)
        // TC fonts contain all SC characters plus additional Traditional forms.
        if (code >= 0x4E00 && code <= 0x9FFF) return 'tc';
        // CJK Extension A
        if (code >= 0x3400 && code <= 0x4DBF) return 'tc';
        // CJK Compatibility Ideographs
        if (code >= 0xF900 && code <= 0xFAFF) return 'tc';

        // Default to Simplified Chinese for any other CJK-range character
        return 'sc';
    }

    /**
     * Tier 3: Load a local bundled font for a given CJK language key.
     *
     * Uses a shared promise cache so that concurrent character lookups for the
     * same language don't trigger duplicate fetches.
     */
    async _loadLocalFontForLang(langKey) {
        const cacheKey = `cjk:${langKey}`;

        if (this.fontCache.has(cacheKey)) {
            return this.fontCache.get(cacheKey);
        }
        if (this._fontPromises.has(cacheKey)) {
            return this._fontPromises.get(cacheKey);
        }

        const fontFile = CJK_LOCAL_FONTS[langKey] || 'noto-sans-sc.woff';

        const promise = (async () => {
            try {
                // Use Vite-resolved URL from FONT_URL_MAP, fall back to public path
                const fontUrl = FONT_URL_MAP[fontFile] || `/assets/fonts/${fontFile}`;
                const res = await fetch(fontUrl);
                if (!res.ok) throw new Error(`Local font not found: ${fontFile}`);

                const buffer = await res.arrayBuffer();
                const font = window.opentype.parse(buffer);
                this.fontCache.set(cacheKey, font);
                console.info(`GlyphVectoriser: Loaded local CJK font '${fontFile}' (${font.numGlyphs} glyphs)`);
                return font;
            } catch (e) {
                console.error(`GlyphVectoriser: Failed to load local CJK font '${fontFile}'`, e);
                this.fontCache.set(cacheKey, null);
                return null;
            }
        })();

        this._fontPromises.set(cacheKey, promise);
        return promise;
    }

    /**
     * Load a local bundled WOFF file for Latin/non-CJK fallback.
     */
    async _loadLocalFallback(fontFile) {
        const cacheKey = 'local:' + fontFile;
        if (this.fontCache.has(cacheKey)) {
            return this.fontCache.get(cacheKey);
        }
        try {
            // Use Vite-resolved URL from FONT_URL_MAP, fall back to public path
            const fontUrl = FONT_URL_MAP[fontFile] || `/assets/fonts/${fontFile}`;
            const res = await fetch(fontUrl);
            if (!res.ok) throw new Error(`Not found: ${fontFile}`);
            const buffer = await res.arrayBuffer();
            const font = window.opentype.parse(buffer);
            this.fontCache.set(cacheKey, font);
            return font;
        } catch (e) {
            this.fontCache.set(cacheKey, null);
            return null;
        }
    }
}
