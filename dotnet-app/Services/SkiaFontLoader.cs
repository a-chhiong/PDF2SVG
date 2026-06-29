using System.Text.RegularExpressions;
using System.Xml.Linq;
using PDF2SVG.Interfaces;
using SkiaSharp;

namespace PDF2SVG.Services;

/// <summary>
/// Extracts and loads subsetted OpenType fonts embedded as base64-encoded data URIs inside the SVG's
/// CSS <style> blocks, converting them into in-memory SkiaSharp typefaces for use during vector rendering.
///
/// Background:
///   When PdfToSvg.NET converts a PDF to SVG, it embeds the subsetted PDF fonts (e.g. CJK typefaces)
///   as base64-encoded OpenType data URIs inside @font-face declarations in the SVG's <style> block.
///   These fonts reference obfuscated family names (e.g. "fut7LuT", "fjP2LEj", "ffsmtzu") that map
///   one-to-one with CSS class rules applied to <g> or <text> containers.
///   Without loading and using those exact typefaces during vectorization, SkiaSharp would fall back
///   to the system default font, producing completely wrong glyph shapes and sizes.
/// </summary>
public class SkiaFontLoader : ISkiaFontLoader
{
    /// <summary>
    /// Loads all embedded @font-face fonts from the SVG document into memory as SkiaSharp typefaces.
    ///
    /// Internally, this:
    ///   1. Extracts @font-face declarations from SVG <style> tags.
    ///   2. Decodes each base64 font payload to raw bytes.
    ///   3. Creates an in-memory SKTypeface from the raw bytes, ready for SkiaSharp rendering.
    /// </summary>
    /// <param name="xdoc">The parsed SVG XML document.</param>
    /// <returns>
    ///   A dictionary mapping the CSS font-family name (e.g. "fut7LuT") to its loaded SKTypeface.
    /// </returns>
    public Dictionary<string, SKTypeface> LoadFonts(XDocument xdoc)
    {
        // Step 1: Extract all @font-face declarations into a family-name → base64-data mapping
        var fontFaces = ExtractFontFaces(xdoc);
        var loadedFonts = new Dictionary<string, SKTypeface>();
        
        // Step 2: Decode each font's base64 payload and instantiate an SKTypeface from raw bytes
        foreach (var kvp in fontFaces)
        {
            try
            {
                byte[] bytes = Convert.FromBase64String(kvp.Value);

                // SKTypeface.FromStream reads the raw OpenType/TrueType binary and returns a usable typeface.
                // This typeface will be looked up by exact family name during vectorization.
                var typeface = SKTypeface.FromStream(new MemoryStream(bytes));
                if (typeface != null)
                {
                    loadedFonts[kvp.Key] = typeface;
                }
            }
            catch (Exception ex)
            {
                // Non-fatal: warn and skip broken font declarations so the rest of the conversion proceeds.
                Console.ForegroundColor = ConsoleColor.Yellow;
                Console.WriteLine($"[Font Warning] Failed to parse font '{kvp.Key}': {ex.Message}");
                Console.ResetColor();
            }
        }

        return loadedFonts;
    }

    /// <summary>
    /// Removes all @font-face declaration blocks from the SVG's CSS style elements after vectorization.
    ///
    /// After text elements have been vectorized into paths, the embedded fonts are no longer needed
    /// (and would bloat the output file). Any <style> element that becomes empty after stripping
    /// is removed entirely. Elements with remaining non-font CSS rules are preserved.
    /// </summary>
    /// <param name="xdoc">The parsed SVG XML document to clean up in-place.</param>
    public void CleanUpEmbedFonts(XDocument xdoc)
    {
        var styleElements = xdoc.Descendants().Where(e => e.Name.LocalName == "style").ToList();
        foreach (var style in styleElements)
        {
            string cssText = style.Value;

            // Strip out all @font-face { ... } blocks using a simple greedy regex.
            // The resulting CSS may still contain class selectors used for fill/color definitions.
            string cleanedCss = Regex.Replace(cssText, @"@font-face\s*\{[^}]+\}", "");
            
            if (string.IsNullOrWhiteSpace(cleanedCss))
            {
                // If nothing useful remains, remove the entire <style> element
                style.Remove();
            }
            else
            {
                // Otherwise, update the style content with only the non-font CSS rules
                style.Value = cleanedCss;
            }
        }
    }

    /// <summary>
    /// Parses all @font-face declarations from SVG <style> elements and extracts
    /// the font-family name and base64-encoded font data for each one.
    ///
    /// CSS structure expected:
    ///   @font-face {
    ///     font-family: fut7LuT;
    ///     src: url('data:font/opentype;base64,AAAA...');
    ///   }
    /// </summary>
    /// <param name="xdoc">The parsed SVG XML document.</param>
    /// <returns>
    ///   A dictionary mapping each font-family name to its raw base64 font data string.
    /// </returns>
    private Dictionary<string, string> ExtractFontFaces(XDocument xdoc)
    {
        var fontFaces = new Dictionary<string, string>();
        
        var styleElements = xdoc.Descendants().Where(e => e.Name.LocalName == "style");
        foreach (var style in styleElements)
        {
            string cssText = style.Value;

            // Match each @font-face { ... } rule block
            var fontFaceMatches = Regex.Matches(cssText, @"@font-face\s*\{([^}]+)\}");
            
            foreach (Match match in fontFaceMatches)
            {
                string rule = match.Groups[1].Value;

                // Extract the font-family name from the rule body
                var familyMatch = Regex.Match(rule, @"font-family\s*:\s*['""]?([^'"";]+?)['""]?\s*(?:;|$)");

                // Extract the base64 font data from the data URI in the src property
                // The data URI format is: data:<mime>;base64,<data>
                var srcMatch = Regex.Match(rule, @"src\s*:\s*url\s*\(\s*['""]?data:[^;]+;base64,([^'"")]+?)['""]?\s*\)");
                
                if (familyMatch.Success && srcMatch.Success)
                {
                    string family = familyMatch.Groups[1].Value.Trim('\'', '"');

                    // Strip whitespace/newlines that may be folded into the base64 data across lines
                    string base64 = srcMatch.Groups[1].Value.Replace(" ", "").Replace("\r", "").Replace("\n", "");
                    fontFaces[family] = base64;
                }
            }
        }

        return fontFaces;
    }
}
