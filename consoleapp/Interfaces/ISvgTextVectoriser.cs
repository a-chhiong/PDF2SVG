using System.Xml.Linq;
using SkiaSharp;

namespace PDF2SVG.Interfaces;

public interface ISvgTextVectoriser
{
    void VectorizeTextElements(XDocument xdoc, Dictionary<string, SKTypeface> loadedFonts, Dictionary<string, Dictionary<string, string>> cssClasses);
}
