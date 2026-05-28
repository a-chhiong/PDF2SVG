using System.Xml.Linq;

namespace PDF2SVGConsole.Interfaces;

public interface ICssStyleParser
{
    Dictionary<string, Dictionary<string, string>> ParseCssClasses(XDocument xdoc);
}
