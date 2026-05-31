/**
 * GlyphVectoriser — Converts text runs from PDF.js SVG output into clean SVG bezier path data.
 * Matches the style and coordinate cascading architecture of the C# SvgTextVectoriser.
 */

const CJK_BLOCK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af]/u;

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

        // Per-language CDN font loading promises
        this._cdnFontPromises = new Map();
    }

    /**
     * Entry point: processes all <text> elements inside the SVG DOM node.
     * Replaces them with equivalent <g> nodes containing vectorized <path> shapes.
     * Implements coordinate cascading and ancestor style resolution.
     */
    async vectorizeTextElements(svgElement, commonObjs, onProgress) {
        // 1. Parse CSS rules from the SVG's <style> block
        const cssClasses = this._parseCssClasses(svgElement);

        // 2. Query all <text> nodes and collect them to prevent DOM mutation errors during loop
        const textElements = Array.from(svgElement.querySelectorAll('text'));

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

            // Build chunks of text inside the <text> element (text nodes and <tspan> children)
            const chunks = [];
            for (const node of textEl.childNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                    const textStr = node.nodeValue;
                    if (textStr && textStr.trim()) {
                        chunks.push({ text: textStr, element: textEl });
                    }
                } else if (node.nodeType === Node.ELEMENT_NODE && node.localName === 'tspan') {
                    const textStr = node.textContent;
                    if (textStr && textStr.trim()) {
                        chunks.push({ text: textStr, element: node });
                    }
                }
            }

            let currentX = 0;
            let currentY = 0;
            let globalCharIndex = 0;
            let isFirstChar = true;

            for (const chunk of chunks) {
                const text = chunk.text;
                const element = chunk.element;

                // Resolve styling parameters using ancestor style climbing
                const fontId = this._getInheritedStyleOrAttribute(element, 'font-family', cssClasses) || '';
                const fontSize = this._getFontSizeAttribute(element, cssClasses);

                // Load the primary embedded PDF font if registered
                const primaryFont = await this.loadFontFromCommonObjs(fontId, commonObjs, onProgress);

                // Parse local overrides of the chunk element (e.g. <tspan>)
                const localXCoords = this._parseCoordinateList(element.getAttribute('x'));
                const localYCoords = this._parseCoordinateList(element.getAttribute('y'));
                const localDxCoords = this._parseCoordinateList(element.getAttribute('dx'));
                const localDyCoords = this._parseCoordinateList(element.getAttribute('dy'));

                const paths = [];

                for (let i = 0; i < text.length; i++) {
                    // 1. Resolve absolute X position
                    if (localXCoords.length > 0 && i < localXCoords.length) {
                        currentX = localXCoords[i];
                    } else if (parentXCoords.length > 0 && globalCharIndex < parentXCoords.length) {
                        currentX = parentXCoords[globalCharIndex];
                    } else if (isFirstChar) {
                        currentX = parentXCoords.length > 0 ? parentXCoords[0] : 0;
                    }

                    // 2. Resolve absolute Y position
                    if (localYCoords.length > 0 && i < localYCoords.length) {
                        currentY = localYCoords[i];
                    } else if (parentYCoords.length > 0 && globalCharIndex < parentYCoords.length) {
                        currentY = parentYCoords[globalCharIndex];
                    } else if (isFirstChar) {
                        currentY = parentYCoords.length > 0 ? parentYCoords[0] : 0;
                    }

                    // 3. Apply relative DX shifts
                    if (localDxCoords.length > 0 && i < localDxCoords.length) {
                        currentX += localDxCoords[i];
                    } else if (parentDxCoords.length > 0 && globalCharIndex < parentDxCoords.length) {
                        currentX += parentDxCoords[globalCharIndex];
                    }

                    // 4. Apply relative DY shifts
                    if (localDyCoords.length > 0 && i < localDyCoords.length) {
                        currentY += localDyCoords[i];
                    } else if (parentDyCoords.length > 0 && globalCharIndex < parentDyCoords.length) {
                        currentY += parentDyCoords[globalCharIndex];
                    }

                    isFirstChar = false;

                    const char = text[i];

                    // Multi-tier glyph and font loader
                    const { font: activeFont, glyphIdx } = await this._resolveFontAndGlyph(char, fontId, primaryFont, onProgress);

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

                    // Transfer styling rules from the chunk element
                    for (const attr of element.attributes) {
                        if (!['x', 'y', 'dx', 'dy', 'font-family', 'font-size', 'font-weight', 'data-font-name'].includes(attr.name)) {
                            pathEl.setAttribute(attr.name, attr.value);
                        }
                    }

                    // Assure fill defaults
                    this._ensureDefaultFill(pathEl, element, cssClasses);

                    gEl.appendChild(pathEl);
                }
            }

            textEl.replaceWith(gEl);
        }
    }

    /**
     * Resolves the active font and glyph index using sequential fallbacks.
     */
    async _resolveFontAndGlyph(char, fontId, primaryFont, onProgress) {
        let activeFont = primaryFont;
        let glyphIdx = activeFont ? activeFont.charToGlyphIndex(char) : 0;
        if (glyphIdx !== 0) {
            return { font: activeFont, glyphIdx };
        }

        // CJK Fallback Sequence
        if (CJK_BLOCK.test(char)) {
            const preferredLang = this._getCjkLangKey(char, fontId);
            if (onProgress) onProgress(`Resolving fallback CJK font...`);
            const preferredFont = await this.loadCdnFontForLang(preferredLang);
            if (preferredFont) {
                glyphIdx = preferredFont.charToGlyphIndex(char);
                if (glyphIdx !== 0) return { font: preferredFont, glyphIdx };
            }

            // Fallback through remaining CJK languages sequentially
            const cjkLangs = ['tc', 'sc', 'jp', 'kr'].filter(l => l !== preferredLang);
            for (const lang of cjkLangs) {
                const font = await this.loadCdnFontForLang(lang);
                if (font) {
                    glyphIdx = font.charToGlyphIndex(char);
                    if (glyphIdx !== 0) return { font, glyphIdx };
                }
            }
        }

        // Standard Noto Sans Latin Fallback
        const latinFile = this.fontResolver.getFallbackFontFile(char, fontId);
        const latinFont = await this._loadLocalFallback(latinFile);
        if (latinFont) {
            glyphIdx = latinFont.charToGlyphIndex(char);
            if (glyphIdx !== 0) return { font: latinFont, glyphIdx };
        }

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
     * Tier 1: Load embedded PDF font bytes from PDF.js commonObjs.
     */
    async loadFontFromCommonObjs(fontId, commonObjs, onProgress) {
        if (!fontId) return null;
        if (this.fontCache.has(fontId)) return this.fontCache.get(fontId);

        // Bypass immediately if key isn't registered in PDF.js
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
     * Detects CJK script type.
     */
    _getCjkLangKey(char, fontId) {
        const code = char.charCodeAt(0);

        // Korean Hangul
        if (code >= 0xAC00 && code <= 0xD7AF) return 'kr';
        // Japanese Hiragana/Katakana
        if (code >= 0x3040 && code <= 0x30FF) return 'jp';
        if (code >= 0xFF66 && code <= 0xFF9F) return 'jp';
        // Japanese Kanji
        if (fontId && /gothic|mincho|jp|japanese/i.test(fontId)) return 'jp';
        // Traditional Chinese
        if (fontId && /tc|trad|hongkong|taiwan|tw|hk/i.test(fontId)) return 'tc';
        // Default CJK to Simplified Chinese
        return 'sc';
    }

    /**
     * Tier 2: Load a CJK font from local assets.
     */
    async loadCdnFontForLang(langKey) {
        const cacheKey = `cjk:${langKey}`;

        if (this.fontCache.has(cacheKey)) {
            return this.fontCache.get(cacheKey);
        }
        if (this._cdnFontPromises.has(langKey)) {
            return this._cdnFontPromises.get(langKey);
        }

        const fontFile = CJK_LOCAL_FONTS[langKey] || 'noto-sans-sc.woff';

        const promise = (async () => {
            try {
                const fontUrl = new URL(`../assets/fonts/${fontFile}`, import.meta.url).href;
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

        this._cdnFontPromises.set(langKey, promise);
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
            const fontUrl = new URL(`../assets/fonts/${fontFile}`, import.meta.url).href;
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
