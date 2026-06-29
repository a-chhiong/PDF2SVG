using System.Text.RegularExpressions;
using System.Xml.Linq;
using PDF2SVG.Interfaces;
using SkiaSharp;

namespace PDF2SVG.Services;

/// <summary>
/// Converts SVG <text> and <tspan> elements into pixel-perfect vector path outlines
/// using subsetted OpenType typefaces embedded inside the SVG's own CSS @font-face declarations.
///
/// ─── Why this class exists ────────────────────────────────────────────────────
/// When PdfToSvg.NET renders a PDF page to SVG, it keeps text as live <text> nodes so the file
/// remains selectable/searchable. However, those text nodes reference obfuscated font names
/// (e.g. "fut7LuT", "fjP2LEj") backed by base64-encoded OpenType subsets embedded in the SVG.
///
/// For archival or cross-platform display, text as paths is far more reliable:
///   • Eliminates font-not-found rendering failures on other machines.
///   • Preserves exact glyph shapes, CJK strokes, and custom spacing.
///   • Removes the dependency on the embedded font data at display time.
///
/// ─── The core problem that was solved ────────────────────────────────────────
/// PdfToSvg.NET places font/style declarations on *ancestor* <g> group elements, NOT on the
/// individual <text> or <tspan> nodes. For example, the raw SVG looks like this:
///
///   <g class="tx7mAbp">          ← CSS class here, NOT on the text element
///     <g>
///       <text x="10.27" y="12.53">項次欄位最大長度顯示範例</text>
///     </g>
///   </g>
///
/// And the style sheet defines:
///   .tx7mAbp { font-family: fut7LuT; font-size: 8.053px; }
///
/// A naïve vectorizer that only inspects the <text> element's own attributes would find NO
/// font-family and NO font-size, and would silently fall back to the system's default sans-serif
/// at 12 px. The resulting glyph shapes would be completely wrong — different strokes, different
/// widths, and shifted baselines (we saw positions drifting to ~4–10 px instead of the correct ~12.5 px).
///
/// ─── Solution ────────────────────────────────────────────────────────────────
/// Every style lookup now performs a recursive upward traversal of the XML ancestor chain
/// (see GetInheritedStyleOrAttribute). This finds the class declaration on the <g> ancestor,
/// resolves "fut7LuT" → the loaded SKTypeface, and extracts "8.053px" as the true render size.
/// The resulting baked paths match the reference SVG glyph-for-glyph at pixel-level precision.
/// </summary>
public class SvgTextVectoriser : ISvgTextVectoriser
{
    /// <summary>
    /// The SVG XML namespace. Required when creating new XElement nodes so they are
    /// recognised as proper SVG elements by renderers and browsers.
    /// </summary>
    private static readonly XNamespace SvgNs = "http://www.w3.org/2000/svg";

    /// <summary>
    /// Entry point: traverses all <text> elements in the document, converts each one into a
    /// <g> group containing <path> outline elements, then replaces the original <text> in-place.
    ///
    /// The overall pipeline per <text> element is:
    ///   1.  Collect all text chunks (raw text nodes and <tspan> children) in document order.
    ///   2.  For each chunk, resolve the typeface and font-size by walking up the ancestor tree.
    ///   3.  For each character in the chunk, determine its (X, Y) position using the SVG
    ///       coordinate list attributes (x, y, dx, dy) at both the <text> level and the
    ///       local <tspan> level, following the SVG specification's cascading rule.
    ///   4.  Render the character's glyph outline via SkiaSharp into a combined path.
    ///   5.  Emit a <path d="..."> element carrying all the chunk's glyph outlines.
    ///   6.  Replace the original <text> node with a <g> wrapping all resulting <path> elements.
    /// </summary>
    /// <param name="xdoc">
    ///   The parsed SVG XML document to transform in-place. All <text> elements will be
    ///   replaced with equivalent <path> outlines after this call returns.
    /// </param>
    /// <param name="loadedFonts">
    ///   Map of CSS font-family name → SKTypeface loaded from the SVG's embedded base64 fonts.
    ///   Produced by <see cref="SkiaFontLoader.LoadFonts"/>.
    /// </param>
    /// <param name="cssClasses">
    ///   Map of CSS class name → (property → value) declarations.
    ///   Produced by <see cref="CssStyleParser.ParseCssClasses"/>.
    ///   Used during ancestor traversal to resolve font-family, font-size, and fill values.
    /// </param>
    public void VectorizeTextElements(XDocument xdoc, Dictionary<string, SKTypeface> loadedFonts, Dictionary<string, Dictionary<string, string>> cssClasses)
    {
        // Collect all <text> elements upfront (ToList) because we will replace them
        // in-place during the loop; mutating the tree while iterating Descendants() would throw.
        var textElements = xdoc.Descendants().Where(e => e.Name.LocalName == "text").ToList();
        
        foreach (var textEl in textElements)
        {
            // Create a <g> group that will hold all vectorized <path> children produced from
            // this <text> element. Using a group preserves any transform, clip-path, or other
            // structural attributes that were on the original <text>.
            var gEl = new XElement(SvgNs + "g");
            
            // Transfer non-layout attributes from <text> to the replacement <g>.
            // We deliberately exclude positioning attributes (x, y, dx, dy) and font attributes
            // (font-family, font-size) because those values are baked into the path geometry itself
            // and must not appear as redundant or conflicting attributes on the group.
            foreach (var attr in textEl.Attributes())
            {
                if (attr.Name.LocalName != "x" && attr.Name.LocalName != "y" && 
                    attr.Name.LocalName != "dx" && attr.Name.LocalName != "dy" &&
                    attr.Name.LocalName != "font-family" && attr.Name.LocalName != "font-size")
                {
                    gEl.SetAttributeValue(attr.Name, attr.Value);
                }
            }

            // SVG allows x/y/dx/dy attributes to be space-separated or comma-separated lists,
            // enabling per-character absolute positions or kerning offsets in a single attribute.
            // Example: x="10.27 18.32 26.38" means character 0 is at x=10.27, char 1 at x=18.32, etc.
            // We parse these from the <text> element as the "parent" coordinate arrays.
            float[] parentXCoords  = ParseCoordinateList(textEl.Attribute("x")?.Value);
            float[] parentYCoords  = ParseCoordinateList(textEl.Attribute("y")?.Value);
            float[] parentDxCoords = ParseCoordinateList(textEl.Attribute("dx")?.Value);
            float[] parentDyCoords = ParseCoordinateList(textEl.Attribute("dy")?.Value);

            // Build an ordered list of text chunks.
            // A chunk pairs a string of text with the element that owns its style context.
            // Two sources:
            //   • Bare XText nodes directly inside <text>  → scoped to the <text> element itself.
            //   • <tspan> child elements                   → scoped to the <tspan> (may override
            //     coordinates or styles locally, as commonly used for justified/kerned text).
            var chunks = new List<TextChunk>();
            foreach (var node in textEl.Nodes())
            {
                if (node is XText textNode)
                {
                    string textStr = textNode.Value;
                    if (!string.IsNullOrEmpty(textStr))
                    {
                        chunks.Add(new TextChunk { Text = textStr, Element = textEl });
                    }
                }
                else if (node is XElement childEl && childEl.Name.LocalName == "tspan")
                {
                    string textStr = childEl.Value;
                    if (!string.IsNullOrEmpty(textStr))
                    {
                        // The tspan element is the style scope for its content — it may carry
                        // its own x/y/dx/dy overrides and even its own class or fill attributes.
                        chunks.Add(new TextChunk { Text = textStr, Element = childEl });
                    }
                }
            }

            // Layout state shared across all chunks within one <text> element.
            // globalCharIndex tracks the character's position relative to the full <text> node,
            // so parent coordinate arrays are addressed correctly even across multiple chunks.
            float currentX       = 0;
            float currentY       = 0;
            int   globalCharIndex = 0;
            bool  isFirstChar    = true;

            foreach (var chunk in chunks)
            {
                string   text    = chunk.Text;
                XElement element = chunk.Element;

                // ── CRITICAL: Ancestral Style Resolution ──────────────────────────────────
                // PdfToSvg.NET places font declarations on ancestor <g> elements, not on <text>.
                // We must walk UP the XML tree from the current element to find the right style.
                //
                // Without this traversal:
                //   • fontFamily resolves to "" → typeface falls back to SKTypeface.Default (system sans-serif)
                //   • fontSize resolves to 12px  → wrong scale (actual is 8.053px)
                //   • Resulting glyphs are the wrong shape, wrong size, and placed at wrong coordinates.
                //
                // With this traversal:
                //   • We find class="tx7mAbp" on an ancestor <g>
                //   • We look up "tx7mAbp" in cssClasses
                //   • We extract font-family="fut7LuT" and font-size="8.053px"
                //   • We load the matching SKTypeface from the preloaded font dictionary
                string fontFamily = GetInheritedStyleOrAttribute(element, "font-family", cssClasses) ?? "";
                float  fontSize   = GetFontSizeAttribute(element, cssClasses);
                
                // Look up the exact typeface by the CSS font-family name. If the name is not found
                // in our preloaded set (shouldn't happen for well-formed PdfToSvg.NET output),
                // fall back to the system default to avoid a crash.
                if (!loadedFonts.TryGetValue(fontFamily, out var typeface))
                {
                    typeface = SKTypeface.Default;
                }

                // Parse local coordinate overrides from the chunk's own element.
                // A <tspan> may specify its own x/y to absolutely reposition a sub-run,
                // or dx/dy to apply kerning/baseline shifts relative to the current position.
                float[] localXCoords  = ParseCoordinateList(element.Attribute("x")?.Value);
                float[] localYCoords  = ParseCoordinateList(element.Attribute("y")?.Value);
                float[] localDxCoords = ParseCoordinateList(element.Attribute("dx")?.Value);
                float[] localDyCoords = ParseCoordinateList(element.Attribute("dy")?.Value);

                // All glyphs in this chunk are accumulated into a single SKPath.
                // Combining into one path per chunk (rather than one path per character) keeps the
                // output SVG compact while preserving all exact glyph geometries.
                using (var combinedPath = new SKPath())
                {
                    for (int i = 0; i < text.Length; i++)
                    {
                        // ── Step 1: Determine absolute X position ────────────────────────
                        // Priority order (SVG spec §10.3):
                        //   a) Local (tspan-level) x[i] — absolute, per character
                        //   b) Parent (text-level)  x[globalCharIndex] — absolute, per character
                        //   c) Keep previous currentX (advance is handled by MeasureText below)
                        //   d) If this is the very first character and nothing else matched, anchor at 0
                        if (localXCoords.Length > 0 && i < localXCoords.Length)
                        {
                            currentX = localXCoords[i];
                        }
                        else if (parentXCoords.Length > 0 && globalCharIndex < parentXCoords.Length)
                        {
                            currentX = parentXCoords[globalCharIndex];
                        }
                        else if (isFirstChar)
                        {
                            currentX = parentXCoords.Length > 0 ? parentXCoords[0] : 0;
                        }

                        // ── Step 2: Determine absolute Y position ────────────────────────
                        // Identical priority cascade to X above.
                        if (localYCoords.Length > 0 && i < localYCoords.Length)
                        {
                            currentY = localYCoords[i];
                        }
                        else if (parentYCoords.Length > 0 && globalCharIndex < parentYCoords.Length)
                        {
                            currentY = parentYCoords[globalCharIndex];
                        }
                        else if (isFirstChar)
                        {
                            currentY = parentYCoords.Length > 0 ? parentYCoords[0] : 0;
                        }

                        // ── Step 3: Apply relative DX offset (horizontal kerning/shift) ──
                        // dx is applied ON TOP of the resolved absolute X, not instead of it.
                        if (localDxCoords.Length > 0 && i < localDxCoords.Length)
                        {
                            currentX += localDxCoords[i];
                        }
                        else if (parentDxCoords.Length > 0 && globalCharIndex < parentDxCoords.Length)
                        {
                            currentX += parentDxCoords[globalCharIndex];
                        }

                        // ── Step 4: Apply relative DY offset (vertical shift / superscript) ─
                        if (localDyCoords.Length > 0 && i < localDyCoords.Length)
                        {
                            currentY += localDyCoords[i];
                        }
                        else if (parentDyCoords.Length > 0 && globalCharIndex < parentDyCoords.Length)
                        {
                            currentY += parentDyCoords[globalCharIndex];
                        }

                        isFirstChar = false;

                        string charStr = text[i].ToString();

                        // ── Step 5: Dynamic Glyph Fallback ───────────────────────────────
                        // OpenType subsets embedded in PDFs only contain the glyphs actually used
                        // in the document. A character that appears in the text string but was
                        // NOT present in the original PDF (e.g. a punctuation mark in a mixed run)
                        // may have glyph ID 0 (the "missing glyph" notdef) in the subsetted font.
                        //
                        // When glyph ID 0 is returned, we ask SkiaSharp's system font manager
                        // to find any installed typeface that can render this character
                        // (SKFontManager.MatchCharacter). The fallback is rendered at the SAME
                        // font-size to keep metrics consistent across the text run.
                        SKFont  activeFont  ;
                        SKFont  primaryFont  = new SKFont(typeface, fontSize);
                        SKFont? fallbackFont = null;

                        ushort[] glyphs = primaryFont.GetGlyphs(charStr);
                        if (glyphs == null || glyphs.Length == 0 || glyphs[0] == 0)
                        {
                            // The primary subsetted font cannot render this character.
                            // Ask the OS for the best matching fallback typeface.
                            var fallbackTypeface = SKFontManager.Default.MatchCharacter(text[i]);
                            if (fallbackTypeface != null)
                            {
                                fallbackFont = new SKFont(fallbackTypeface, fontSize);
                                activeFont   = fallbackFont;
                            }
                            else
                            {
                                // No system fallback found either; use the primary font anyway
                                // so we at least emit the notdef glyph at the correct position.
                                activeFont = primaryFont;
                            }
                        }
                        else
                        {
                            activeFont = primaryFont;
                        }

                        try
                        {
                            // ── Step 6: Render glyph to vector path ──────────────────────
                            // GetTextPath returns an SKPath whose contours are the exact glyph
                            // outlines anchored at (currentX, currentY) as the baseline origin.
                            // The path is expressed in the same coordinate space as the SVG viewport.
                            using (var charPath = activeFont.GetTextPath(charStr, new SKPoint(currentX, currentY)))
                            {
                                if (charPath != null)
                                {
                                    combinedPath.AddPath(charPath);
                                }
                            }

                            // ── Step 7: Advance the layout cursor ────────────────────────
                            // MeasureText returns the typographic advance width of this character
                            // in the active font, correctly accounting for the subsetted metrics.
                            // This advances currentX so the next character is placed correctly
                            // when no explicit per-character x coordinate is available.
                            currentX += activeFont.MeasureText(charStr);
                        }
                        finally
                        {
                            // Always dispose SKFont objects; they hold unmanaged Skia resources.
                            primaryFont.Dispose();
                            fallbackFont?.Dispose();
                        }

                        globalCharIndex++;
                    }

                    // ── Step 8: Emit the SVG <path> element ──────────────────────────────
                    // ToSvgPathData() serialises the accumulated SkiaSharp path to the standard
                    // SVG path data mini-language (M, L, C, Q, Z commands).
                    string pathData = combinedPath.ToSvgPathData();
                    if (!string.IsNullOrEmpty(pathData))
                    {
                        var pathEl = new XElement(SvgNs + "path", new XAttribute("d", pathData));

                        // Transfer non-layout attributes from the chunk's source element (e.g. fill,
                        // stroke, class, style) to the output path so colours and clip rules carry over.
                        // Layout and font attributes are excluded — they have been baked into the path.
                        // We also exclude 'transform' and 'id' to prevent duplicate attributes and double-transformations
                        // since they are already applied to the parent group element.
                        foreach (var attr in element.Attributes())
                        {
                            if (attr.Name.LocalName != "x" && attr.Name.LocalName != "y" && 
                                attr.Name.LocalName != "dx" && attr.Name.LocalName != "dy" &&
                                attr.Name.LocalName != "font-family" && attr.Name.LocalName != "font-size" &&
                                attr.Name.LocalName != "transform" && attr.Name.LocalName != "id")
                            {
                                pathEl.SetAttributeValue(attr.Name, attr.Value);
                            }
                        }

                        // ── Step 9: Colour Fill Safeguard ────────────────────────────────
                        // If no fill was copied from the element (or its ancestors in the CSS),
                        // default to "currentColor" so text renders as the document's inherited
                        // foreground colour instead of transparent (SVG default for paths is black,
                        // but "currentColor" is more semantically correct for text-derived paths).
                        // If a fill IS already inherited (e.g. fill="#f00" for red labels),
                        // we leave it untouched to preserve the original document colours.
                        EnsureDefaultFill(pathEl, element, cssClasses);

                        gEl.Add(pathEl);
                    }
                }
            }

            // ── Final: Replace <text> with <g> ───────────────────────────────────────
            // ReplaceWith swaps the original <text> node in the document tree with our
            // newly constructed <g> containing all vectorized <path> outlines.
            // After this point the SVG contains no live text — only resolution-independent
            // vector geometry that will render identically on every platform and viewer.
            textEl.ReplaceWith(gEl);
        }
    }

    /// <summary>
    /// Parses an SVG coordinate attribute value into an array of floats.
    ///
    /// SVG allows x/y/dx/dy attributes to contain either a single number or a
    /// whitespace- or comma-separated list of numbers, one per character. Examples:
    ///   "10.27"                    → [10.27]
    ///   "10.27 18.32 26.38"        → [10.27, 18.32, 26.38]
    ///   "10.27,18.32,26.38"        → [10.27, 18.32, 26.38]
    ///
    /// Returns an empty array for null/empty input so callers can safely check .Length.
    /// </summary>
    private static float[] ParseCoordinateList(string? value)
    {
        if (string.IsNullOrEmpty(value)) return Array.Empty<float>();
        return value.Split(new[] { ' ', ',' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(s => float.TryParse(s, out var f) ? f : 0f)
                    .ToArray();
    }

    /// <summary>
    /// Resolves a CSS property value for a given element by climbing the XML ancestor chain.
    ///
    /// This is the key fix for the "terrible font handling" bug. PdfToSvg.NET emits styles
    /// on ancestor <g> elements rather than on <text> or <tspan> nodes directly. Without
    /// this upward traversal, every style lookup returns null and the vectorizer silently
    /// degrades to the system default font at 12 px.
    ///
    /// For font-family, the first entry in a comma-separated font stack is returned (the
    /// custom subset name), stripping surrounding quotes that CSS syntax may include.
    /// </summary>
    /// <param name="element">The element to start from (usually a <text> or <tspan>).</param>
    /// <param name="attrName">CSS property name to resolve, e.g. "font-family" or "fill".</param>
    /// <param name="cssClasses">Parsed CSS class declarations from the SVG's <style> blocks.</param>
    /// <returns>The resolved property value, or null if not found anywhere in the tree.</returns>
    private static string? GetInheritedStyleOrAttribute(XElement element, string attrName, Dictionary<string, Dictionary<string, string>> cssClasses)
    {
        XElement? current = element;
        while (current != null)
        {
            string? val = GetElementStyleOrAttribute(current, attrName, cssClasses);
            if (!string.IsNullOrEmpty(val))
            {
                if (attrName == "font-family")
                {
                    // CSS font-family may be a comma-separated fallback stack: "fut7LuT, sans-serif"
                    // We only want the first name — the specific subsetted font family key.
                    var parts = val.Split(',');
                    if (parts.Length > 0)
                    {
                        return parts[0].Trim('\'', '"', ' ');
                    }
                }
                return val.Trim();
            }
            // Move up one level in the XML tree and try again
            current = current.Parent;
        }
        return null;
    }

    /// <summary>
    /// Resolves a CSS property from a single element's own attributes, CSS class declarations,
    /// or inline style string — without climbing the parent tree.
    ///
    /// Resolution order (highest → lowest priority):
    ///   1. Direct XML attribute:  font-family="fut7LuT"
    ///   2. CSS class lookup:      class="tx7mAbp" → .tx7mAbp { font-family: fut7LuT; }
    ///   3. Inline style string:   style="font-family: fut7LuT; font-size: 8.053px;"
    /// </summary>
    private static string? GetElementStyleOrAttribute(XElement element, string attrName, Dictionary<string, Dictionary<string, string>> cssClasses)
    {
        // Priority 1: Direct XML attribute on the element (fastest lookup, least common in PdfToSvg output)
        string? val = element.Attribute(attrName)?.Value;
        if (!string.IsNullOrEmpty(val)) return val;

        // Priority 2: CSS class-based lookup
        // PdfToSvg.NET's primary styling mechanism — class names reference rules in the <style> block.
        // An element may carry multiple classes; we check each one in order and return the first match.
        string? classVal = element.Attribute("class")?.Value;
        if (!string.IsNullOrEmpty(classVal))
        {
            var classes = classVal.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var cls in classes)
            {
                if (cssClasses.TryGetValue(cls, out var declarations))
                {
                    if (declarations.TryGetValue(attrName, out var decVal) && !string.IsNullOrEmpty(decVal))
                    {
                        return decVal;
                    }
                }
            }
        }

        // Priority 3: Inline style attribute parsing
        // Handles edge cases where style is embedded inline, e.g. style="fill: #f00;"
        // Uses a regex to extract the property value without splitting on semicolons naïvely
        // (values can legitimately contain colons in some CSS functions).
        string? styleText = element.Attribute("style")?.Value;
        if (!string.IsNullOrEmpty(styleText))
        {
            var match = Regex.Match(styleText, $"(?:^|;)\\s*{attrName}\\s*:\\s*([^;]+)");
            if (match.Success)
            {
                return match.Groups[1].Value.Trim();
            }
        }

        return null;
    }

    /// <summary>
    /// Resolves the effective font-size for an element, returning a usable float in pixels.
    ///
    /// Calls GetInheritedStyleOrAttribute so the size is resolved through the full ancestor
    /// chain. Strips any non-numeric unit suffix (e.g. "px", "pt") before parsing.
    /// Falls back to 12f if the style is missing or unparseable — though in practice
    /// this fallback should never be hit for well-formed PdfToSvg.NET output.
    /// </summary>
    private static float GetFontSizeAttribute(XElement element, Dictionary<string, Dictionary<string, string>> cssClasses)
    {
        string? val = GetInheritedStyleOrAttribute(element, "font-size", cssClasses);
        if (string.IsNullOrEmpty(val)) return 12f;

        // Strip unit suffix (px, pt, em, etc.) — we treat all values as if they are already
        // in SVG user units, which for PdfToSvg.NET output are equivalent to CSS pixels.
        string digitsOnly = Regex.Replace(val, @"[^\d\.]", "");
        return float.TryParse(digitsOnly, out var size) ? size : 12f;
    }

    /// <summary>
    /// Ensures a generated <path> element carries an explicit fill value.
    ///
    /// SVG paths default to black (fill="black") if no fill is specified, but "currentColor"
    /// is semantically more appropriate for text-derived paths as it inherits the document's
    /// foreground colour. However, if the original text element (or any ancestor) already
    /// declares a specific fill (e.g. fill="#f00" for a coloured label), we must NOT override
    /// it — that would silently convert coloured text to solid black.
    ///
    /// Logic:
    ///   • If the path already has a fill attribute → leave it alone (was copied from source element).
    ///   • If any ancestor declares a fill (via attribute, class, or inline style) → leave it alone.
    ///   • Otherwise → set fill="currentColor" as the safe default.
    /// </summary>
    private static void EnsureDefaultFill(XElement pathEl, XElement element, Dictionary<string, Dictionary<string, string>> cssClasses)
    {
        if (pathEl.Attribute("fill") == null)
        {
            if (HasInheritedFill(element, cssClasses))
            {
                // A fill colour is already declared somewhere in the ancestry; do not override.
                return;
            }
            pathEl.SetAttributeValue("fill", "currentColor");
        }
    }

    /// <summary>
    /// Walks up the XML ancestor chain to determine whether a fill colour is declared anywhere.
    ///
    /// Checks three sources at each level (matching GetElementStyleOrAttribute's priority order):
    ///   1. A direct fill="..." XML attribute on the element.
    ///   2. A CSS class that includes a fill property.
    ///   3. An inline style="..." string that contains "fill:".
    ///
    /// Stops and returns true as soon as any fill declaration is found, false if the root is reached
    /// without finding one.
    /// </summary>
    private static bool HasInheritedFill(XElement element, Dictionary<string, Dictionary<string, string>> cssClasses)
    {
        XElement? current = element;
        while (current != null)
        {
            // Check 1: direct fill attribute
            if (current.Attribute("fill") != null) return true;
            
            // Check 2: CSS class with a fill declaration
            string? classVal = current.Attribute("class")?.Value;
            if (!string.IsNullOrEmpty(classVal))
            {
                var classes = classVal.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                foreach (var cls in classes)
                {
                    if (cssClasses.TryGetValue(cls, out var declarations))
                    {
                        if (declarations.ContainsKey("fill")) return true;
                    }
                }
            }
            
            // Check 3: inline style string containing "fill:"
            string? styleText = current.Attribute("style")?.Value;
            if (!string.IsNullOrEmpty(styleText) && styleText.Contains("fill:")) return true;
            
            current = current.Parent;
        }
        return false;
    }

    /// <summary>
    /// Pairs a string of text with the XML element that provides its style context.
    ///
    /// For bare text nodes directly inside <text>, the element is the <text> itself.
    /// For <tspan> children, the element is the <tspan>, which may carry local coordinate
    /// or style overrides that take precedence over the parent <text> element's values.
    /// </summary>
    private class TextChunk
    {
        public required string   Text    { get; set; }
        public required XElement Element { get; set; }
    }
}
