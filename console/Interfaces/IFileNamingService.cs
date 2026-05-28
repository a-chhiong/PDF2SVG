namespace PDF2SVGConsole.Interfaces;

public interface IFileNamingService
{
    string DetermineSavePath(string outputDir, string baseName, int pageNo, int totalPages);
}
