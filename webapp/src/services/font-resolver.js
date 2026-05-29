export const FONT_MAP = [
    { match: /noto.?sans.?sc|cjk.?sc|simplified.?chinese/i, family: 'BundledNotoSC',   file: 'noto-sans-sc.woff' },
    { match: /noto.?sans.?tc|cjk.?tc|traditional.?chinese/i, family: 'BundledNotoTC',  file: 'noto-sans-tc.woff' },
    { match: /noto.?sans.?jp|cjk.?jp|japanese/i,            family: 'BundledNotoJP',   file: 'noto-sans-jp.woff' },
    { match: /noto.?sans.?kr|cjk.?kr|korean/i,              family: 'BundledNotoKR',   file: 'noto-sans-kr.woff' },
    { match: /courier|monospace|mono/i,                      family: 'BundledMono',     file: 'noto-sans-mono.woff' },
    { match: /.*/,                                            family: 'BundledNotoSans', file: 'noto-sans.woff' },
];

export class FontResolver {
    /**
     * Resolves a raw PDF font family name to our fallback mapping.
     * @param {string} rawFontFamily - Raw font-family from PDF.js styles (e.g. "ABCDEF+Arial")
     * @returns {object} The resolved FONT_MAP rule.
     */
    resolveFamily(rawFontFamily) {
        if (!rawFontFamily) return FONT_MAP[FONT_MAP.length - 1];
        
        // Strip PDF subset identifier prefixes (e.g. "ABCDEF+Arial" -> "Arial")
        const cleanName = rawFontFamily.replace(/^[A-Z]{6}\+/, '');
        
        for (const rule of FONT_MAP) {
            if (rule.match.test(cleanName)) {
                return rule;
            }
        }
        return FONT_MAP[FONT_MAP.length - 1]; // Fallback to Latin
    }

    /**
     * Check if a string contains CJK characters.
     * @param {string} str - Input text string
     * @returns {boolean} True if any character is CJK.
     */
    isCjk(str) {
        return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f\uac00-\ud7af]/u.test(str);
    }

    /**
     * Identifies the best fallback font file based on a specific character's Unicode block.
     * @param {string} char - Single character
     * @param {string} rawFontFamily - Raw parent font family name
     * @returns {string} Font file name (e.g. "noto-sans-sc.woff")
     */
    getFallbackFontFile(char, rawFontFamily) {
        if (this.isCjk(char)) {
            // Korean Hangul Syllables
            if (/[\uac00-\ud7af]/u.test(char)) {
                return 'noto-sans-kr.woff';
            }
            // Japanese Hiragana/Katakana
            if (/[\u3040-\u30ff\uff66-\uff9f]/u.test(char)) {
                return 'noto-sans-jp.woff';
            }
            
            // Traditional Chinese checks (common patterns or direct style resolving)
            const resolved = this.resolveFamily(rawFontFamily);
            if (resolved.file.includes('tc')) {
                return 'noto-sans-tc.woff';
            }
            
            // Default CJK to Simplified Chinese
            return 'noto-sans-sc.woff';
        }
        return 'noto-sans.woff';
    }
}
