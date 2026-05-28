using System.Xml.Linq;
using SkiaSharp;

namespace PDF2SVGConsole.Interfaces;

public interface ISkiaFontLoader
{
    Dictionary<string, SKTypeface> LoadFonts(XDocument xdoc);
    void CleanUpEmbedFonts(XDocument xdoc);
}
