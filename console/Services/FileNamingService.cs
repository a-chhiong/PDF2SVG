using System;
using System.IO;
using PDF2SVGConsole.Interfaces;

namespace PDF2SVGConsole.Services;

/// <summary>
/// Determines the final output file path for each converted SVG page, applying collision-safe
/// timestamped naming to prevent overwriting existing files.
///
/// Naming conventions:
///   - Single-page PDF:  {baseName}.svg
///       If a file with that name already exists: {baseName}_{yyyyMMdd_HHmmss}.svg
///
///   - Multi-page PDF:   {baseName}_page_{pageNo}.svg
///       If a file with that name already exists: {baseName}_page_{pageNo}_{yyyyMMdd_HHmmss}.svg
///
/// The input file name and output file name are always kept identical except for the file extension,
/// preserving the original document identity.
/// </summary>
public class FileNamingService : IFileNamingService
{
    /// <summary>
    /// Computes the full absolute save path for a single converted SVG page.
    ///
    /// For multi-page PDFs, the page number is embedded in the file name so that each page
    /// is written to a unique file in the output directory.
    ///
    /// Collision protection: if the target file path already exists (e.g. a previous run),
    /// a timestamp suffix (yyyyMMdd_HHmmss) is appended to the name so no data is ever silently
    /// overwritten.
    /// </summary>
    /// <param name="outputDir">The directory where the SVG file should be saved.</param>
    /// <param name="baseName">The base file name derived from the input PDF (without extension).</param>
    /// <param name="pageNo">The 1-based page number being saved.</param>
    /// <param name="totalPages">Total number of pages in the document (used to decide naming style).</param>
    /// <returns>The final, collision-safe absolute file path for the output SVG.</returns>
    public string DetermineSavePath(string outputDir, string baseName, int pageNo, int totalPages)
    {
        string fileName;

        if (totalPages == 1)
        {
            // Single-page PDF: use the base name directly without a page suffix
            fileName = $"{baseName}.svg";
            string fullPath = Path.Combine(outputDir, fileName);

            // If a file with the same name already exists, append a timestamp to avoid overwriting
            if (File.Exists(fullPath))
            {
                string timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                fileName = $"{baseName}_{timestamp}.svg";
            }
        }
        else
        {
            // Multi-page PDF: append the page number so each page is saved as a separate file
            fileName = $"{baseName}_page_{pageNo}.svg";
            string fullPath = Path.Combine(outputDir, fileName);

            // Same collision protection for multi-page output
            if (File.Exists(fullPath))
            {
                string timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                fileName = $"{baseName}_page_{pageNo}_{timestamp}.svg";
            }
        }

        return Path.Combine(outputDir, fileName);
    }
}
