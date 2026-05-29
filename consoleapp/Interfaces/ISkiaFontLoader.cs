using System.Xml.Linq;
using SkiaSharp;

namespace PDF2SVG.Interfaces;

public interface ISkiaFontLoader
{
    Dictionary<string, SKTypeface> LoadFonts(XDocument xdoc);
    void CleanUpEmbedFonts(XDocument xdoc);
}
