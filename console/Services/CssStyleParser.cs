using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using PDF2SVGConsole.Interfaces;

namespace PDF2SVGConsole.Services;

/// <summary>
/// Parses CSS class declarations embedded inside SVG <style> blocks into a structured,
/// case-insensitive lookup dictionary for use during text vectorization.
///
/// Background:
///   PdfToSvg.NET emits styling rules like this inside the SVG's <style> block:
///
///     .tx7mAbp { font-family: fut7LuT; font-size: 8.053px; }
///     .txJlUm1 { font-family: fjP2LEj; font-size: 8.053px; fill: #f00; }
///
///   These class names are then applied to ancestor grouping elements (<g>) wrapping text nodes.
///   Because the styling is inherited and not applied directly on <text> or <tspan> elements,
///   the vectorizer must look up styles by traversing the XML ancestry and matching class names
///   against this parsed dictionary to resolve the correct typeface and size.
/// </summary>
public class CssStyleParser : ICssStyleParser
{
    /// <summary>
    /// Parses all CSS class rules embedded in SVG <style> elements and returns a structured dictionary.
    ///
    /// The result maps each CSS class name to a dictionary of property names and values. Example:
    ///
    ///   cssClasses["tx7mAbp"]["font-family"] = "fut7LuT"
    ///   cssClasses["tx7mAbp"]["font-size"]   = "8.053px"
    ///   cssClasses["txJlUm1"]["fill"]        = "#f00"
    ///
    /// The case-insensitive comparison ensures robust lookups regardless of source capitalisation.
    /// </summary>
    /// <param name="xdoc">The parsed SVG XML document containing embedded CSS.</param>
    /// <returns>
    ///   Nested dictionary: class name → (property name → property value).
    /// </returns>
    public Dictionary<string, Dictionary<string, string>> ParseCssClasses(XDocument xdoc)
    {
        // Use case-insensitive keys so that class lookups are robust across different emitters
        var cssClasses = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
        
        var styleElements = xdoc.Descendants().Where(e => e.Name.LocalName == "style");
        foreach (var style in styleElements)
        {
            string cssText = style.Value;

            // Match CSS class rules of the form:  .className { property: value; ... }
            var matches = Regex.Matches(cssText, @"\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}");
            foreach (Match match in matches)
            {
                string className = match.Groups[1].Value;
                string declarationsText = match.Groups[2].Value;
                
                // Parse each individual property declaration: "property-name: value"
                var declarations = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                var declMatches = Regex.Matches(declarationsText, @"([a-zA-Z0-9_-]+)\s*:\s*([^;]+)");
                foreach (Match declMatch in declMatches)
                {
                    string propName = declMatch.Groups[1].Value.Trim();
                    string propVal  = declMatch.Groups[2].Value.Trim();
                    declarations[propName] = propVal;
                }
                
                cssClasses[className] = declarations;
            }
        }
        
        return cssClasses;
    }
}
