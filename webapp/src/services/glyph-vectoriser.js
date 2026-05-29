/**
 * GlyphVectoriser — Converts text runs from PDF.js SVG output into clean SVG bezier path data.
 *
 * Architecture for CID/CJK fonts (Type0/CIDFont with Identity-H encoding):
 * - Embedded PDF fonts are stripped TrueType subsets with NO cmap table.
 * - Glyphs are addressed by GID = CID (CIDToGIDMap = /Identity).
 * - PDF.js DOES patch fontObj.data to inject a synthetic cmap (Unicode→GID).
 * - If charToGlyphIndex() still returns 0 for CJK →
 *   load the bundled full-size Noto CJK WOFF from the local fonts/ directory.
 *   Real fonts: noto-sans-sc.woff (~1.5MB), noto-sans-tc.woff, noto-sans-jp.woff, noto-sans-kr.woff
 *   These are served locally — no CDN, no CORS issues, works offline.
 */

const CJK_BLOCK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af]/u;

// Local font filenames for each CJK language group (served from fonts/ directory)
const CJK_LOCAL_FONTS = {
    sc: 'noto-sans-sc.woff',   // Simplified Chinese (~1.5MB, 8248 glyphs)
    tc: 'noto-sans-tc.woff',   // Traditional Chinese (~1.3MB, 6666 glyphs)
    jp: 'noto-sans-jp.woff',   // Japanese (~1.3MB, 7466 glyphs)
    kr: 'noto-sans-kr.woff',   // Korean (~830KB, 11596 glyphs)
};

export class GlyphVectoriser {
    constructor(fontResolver) {
        this.fontResolver = fontResolver;

        // Cache of loaded opentype.Font objects (embedded fonts keyed by fontId,
        // CDN fonts keyed by 'cdn:langKey', local fonts keyed by 'local:fileName')
        this.fontCache = new Map();

        // Per-language CDN font loading promises (loaded once per session)
        this._cdnFontPromises = new Map(); // langKey → Promise<opentype.Font|null>
    }

    /**
     * Tier 1: Load embedded PDF font bytes from PDF.js commonObjs.
     * PDF.js injects a synthetic cmap into fontObj.data for Type0/CIDFont fonts.
     */
    async loadFontFromCommonObjs(fontId, commonObjs, onProgress) {
        if (!fontId) return null;
        if (this.fontCache.has(fontId)) return this.fontCache.get(fontId);

        // Bypass immediately if key isn't registered in PDF.js at all
        if (typeof commonObjs.has === 'function' && !commonObjs.has(fontId)) {
            return null;
        }

        return new Promise((resolve) => {
            let resolved = false;

            const timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    console.warn(`Font resolution timed out for: ${fontId}. Falling back.`);
                    resolve(null);
                }
            }, 10000);

            try {
                commonObjs.get(fontId, (fontObj) => {
                    if (resolved) return;
                    resolved = true;
                    clearTimeout(timeoutId);

                    if (fontObj && fontObj.data) {
                        try {
                            const buffer = fontObj.data.buffer || fontObj.data;
                            const font = window.opentype.parse(buffer);
                            this.fontCache.set(fontId, font);
                            resolve(font);
                            return;
                        } catch (e) {
                            console.warn(`Failed to parse embedded PDF font: ${fontId}`, e.message);
                        }
                    }
                    this.fontCache.set(fontId, null);
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
     * Determine which Google Fonts family key to use for a character.
     * Returns 'sc', 'tc', 'jp', or 'kr'.
     */
    _getCjkLangKey(char, fontId) {
        const code = char.charCodeAt(0);

        // Korean Hangul
        if (code >= 0xAC00 && code <= 0xD7AF) return 'kr';
        // Japanese Hiragana/Katakana
        if (code >= 0x3040 && code <= 0x30FF) return 'jp';
        if (code >= 0xFF66 && code <= 0xFF9F) return 'jp';
        // Japanese Kanji (check if font references Japanese)
        if (fontId && /gothic|mincho|jp|japanese/i.test(fontId)) return 'jp';
        // Simplified Chinese is the default for CJK Unified
        return 'sc';
    }

    /**
     * Tier 2: Load a bundled full-size Noto CJK WOFF from the local fonts/ directory.
     * These are real fonts with 6,000–11,000 CJK glyphs, served without any CORS restrictions.
     * One font per language, loaded once and cached for the entire session.
     * @param {string} char - The character needing a glyph
     * @param {string} fontId - Raw PDF font ID (for CJK script detection)
     * @returns {Promise<opentype.Font|null>}
     */
    async loadCdnFontForChar(char, fontId) {
        const langKey = this._getCjkLangKey(char, fontId);
        const cacheKey = `cjk:${langKey}`;

        // Return cached font immediately (synchronous hit after first load)
        if (this.fontCache.has(cacheKey)) {
            return this.fontCache.get(cacheKey);
        }

        // Return existing in-flight promise (prevents duplicate parallel fetches)
        if (this._cdnFontPromises.has(langKey)) {
            return this._cdnFontPromises.get(langKey);
        }

        const fontFile = CJK_LOCAL_FONTS[langKey] || 'noto-sans-sc.woff';

        const promise = (async () => {
            try {
                const res = await fetch(`fonts/${fontFile}`);
                if (!res.ok) throw new Error(`Local font not found: ${fontFile} (HTTP ${res.status})`);

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

        this._cdnFontPromises.set(langKey, promise);
        return promise;
    }

    /**
     * Main entry point: vectorize a text run into SVG path data.
     * Handles CID/CJK fonts via multi-tier font resolution:
     *   1. Try embedded font with charToGlyphIndex (works if PDF.js patched cmap)
     *   2. If glyph index = 0 (notdef/missing) → fetch Google Fonts CDN shard
     *   3. If all else fails → skip character (advance width only)
     *
     * @param {SVGTextElement} textNode - Original SVG <text> node
     * @param {string} unicodeStr - Correct Unicode text run (from PDF.js textContent)
     * @param {object} commonObjs - PDF.js page.commonObjs
     * @param {Function} onProgress - Progress callback
     * @returns {Promise<string>} SVG path data string
     */
    async vectorizeTextNode(textNode, unicodeStr, commonObjs, onProgress) {
        const fontId = textNode.getAttribute('data-font-name') || 
                       textNode.getAttribute('font-family') || '';
        const fontSize = parseFloat(textNode.getAttribute('font-size')) || 12;

        let primaryFont = await this.loadFontFromCommonObjs(fontId, commonObjs, onProgress);

        const paths = [];

        // Parse per-character x coordinates from PDF.js SVG output
        const xAttr = textNode.getAttribute('x') || '0';
        const xCoords = xAttr.split(/[\s,]+/).map(parseFloat);
        let currentX = xCoords[0] || 0;

        const yAttr = textNode.getAttribute('y') || '0';
        const yCoords = yAttr.split(/[\s,]+/).map(parseFloat);
        const currentY = yCoords[0] || 0;

        for (let i = 0; i < unicodeStr.length; i++) {
            const char = unicodeStr[i];

            // Apply per-character absolute x position from PDF.js layout
            if (i < xCoords.length) {
                currentX = xCoords[i];
            }

            let activeFont = primaryFont;
            let glyphIdx = activeFont ? activeFont.charToGlyphIndex(char) : 0;

            // If glyph not found in embedded font, load full Noto CJK WOFF from CDN
            if (glyphIdx === 0 && CJK_BLOCK.test(char)) {
                if (onProgress) onProgress(`Loading CJK font from CDN...`);
                const cdnFont = await this.loadCdnFontForChar(char, fontId);
                if (cdnFont) {
                    activeFont = cdnFont;
                    glyphIdx = cdnFont.charToGlyphIndex(char);
                }
            }

            // Final fallback: try our local bundled font resolver for non-CJK
            if (glyphIdx === 0 && activeFont === primaryFont) {
                const fallbackFile = this.fontResolver.getFallbackFontFile(char, fontId);
                const fallbackFont = await this._loadLocalFallback(fallbackFile);
                if (fallbackFont) {
                    const idx = fallbackFont.charToGlyphIndex(char);
                    if (idx !== 0) {
                        activeFont = fallbackFont;
                        glyphIdx = idx;
                    }
                }
            }

            if (activeFont && glyphIdx !== 0) {
                try {
                    const glyphPath = activeFont.getPath(char, currentX, currentY, fontSize);
                    const pathStr = glyphPath.toPathData(2);
                    if (pathStr && pathStr.length > 0) {
                        paths.push(pathStr);
                    }
                } catch (e) {
                    // Skip glyphs that fail to render
                }
                currentX += activeFont.getAdvanceWidth(char, fontSize);
            } else {
                // Advance by estimated width without drawing
                currentX += fontSize * 0.6;
            }
        }

        return paths.join(' ');
    }

    /**
     * Load a local bundled WOFF file for Latin/non-CJK fallback.
     */
    async _loadLocalFallback(fontFile) {
        if (this.fontCache.has('local:' + fontFile)) {
            return this.fontCache.get('local:' + fontFile);
        }
        try {
            const res = await fetch(`fonts/${fontFile}`);
            if (!res.ok) throw new Error(`Not found: ${fontFile}`);
            const buffer = await res.arrayBuffer();
            const font = window.opentype.parse(buffer);
            this.fontCache.set('local:' + fontFile, font);
            return font;
        } catch (e) {
            this.fontCache.set('local:' + fontFile, null);
            return null;
        }
    }
}
