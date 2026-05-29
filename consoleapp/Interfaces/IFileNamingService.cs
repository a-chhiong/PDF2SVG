namespace PDF2SVG.Interfaces;

public interface IFileNamingService
{
    string DetermineSavePath(string outputDir, string baseName, int pageNo, int totalPages);
}
