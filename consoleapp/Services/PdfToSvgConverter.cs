using System.Xml.Linq;
using PDF2SVG.Interfaces;
using PdfToSvg;

namespace PDF2SVG.Services;

public class PdfToSvgConverter
{
    private readonly ICssStyleParser _cssStyleParser;
    private readonly ISkiaFontLoader _skiaFontLoader;
    private readonly ISvgTextVectoriser _svgTextVectoriser;
    private readonly IFileNamingService _fileNamingService;

    public float Scale { get; set; } = 1.5f;
    
    public PdfToSvgConverter(
        ICssStyleParser cssStyleParser,
        ISkiaFontLoader skiaFontLoader,
        ISvgTextVectoriser svgTextVectoriser,
        IFileNamingService fileNamingService)
    {
        _cssStyleParser = cssStyleParser;
        _skiaFontLoader = skiaFontLoader;
        _svgTextVectoriser = svgTextVectoriser;
        _fileNamingService = fileNamingService;
    }

    public async Task ConvertFileAsync(string inputPath, string? outputPath = null)
    {
        if (string.IsNullOrEmpty(inputPath) || !File.Exists(inputPath))
        {
            throw new FileNotFoundException("Input PDF file not found.", inputPath);
        }

        System.Console.WriteLine($"Converting file: {inputPath}");
        byte[] pdfBytes = await File.ReadAllBytesAsync(inputPath);
        
        string targetOutputDir = outputPath ?? "";
        if (string.IsNullOrEmpty(targetOutputDir))
        {
            targetOutputDir = Path.GetDirectoryName(Path.GetFullPath(inputPath)) ?? Directory.GetCurrentDirectory();
        }
        
        string baseName = Path.GetFileNameWithoutExtension(inputPath);
        
        await ConvertPdfBytesAsync(pdfBytes, targetOutputDir, baseName);
    }

    private async Task ConvertPdfBytesAsync(byte[] pdfBytes, string outputDir, string baseName)
    {
        Directory.CreateDirectory(outputDir);
        
        System.Console.WriteLine("Loading PDF document...");
        using (var ms = new MemoryStream(pdfBytes))
        using (var doc = PdfDocument.Open(ms))
        {
            System.Console.WriteLine($"Found {doc.Pages.Count} page(s). Converting to SVG vector...");
            
            int pageNo = 1;
            foreach (var page in doc.Pages)
            {
                System.Console.WriteLine($"Processing page {pageNo} of {doc.Pages.Count}...");
                
                var conversionOptions = new SvgConversionOptions
                {
                    FontResolver = FontResolver.EmbedOpenType
                };

                string svgContent;
                using (var memoryStream = new MemoryStream())
                {
                    page.SaveAsSvg(memoryStream, conversionOptions);
                    memoryStream.Position = 0;
                    using (var reader = new StreamReader(memoryStream))
                    {
                        svgContent = await reader.ReadToEndAsync();
                    }
                }

                System.Console.WriteLine($"Vectorizing fonts for page {pageNo}...");
                string processedSvg = PostProcessSvgContent(svgContent);

                string savePath = _fileNamingService.DetermineSavePath(outputDir, baseName, pageNo, doc.Pages.Count);
                await File.WriteAllTextAsync(savePath, processedSvg, System.Text.Encoding.UTF8);

                System.Console.ForegroundColor = ConsoleColor.Cyan;
                System.Console.WriteLine($"Saved Vector Outline SVG: {savePath}");
                System.Console.ResetColor();

                pageNo++;
            }
        }
    }

    private string PostProcessSvgContent(string svgContent)
    {
        var xdoc = XDocument.Parse(svgContent);
        
        var cssClasses = _cssStyleParser.ParseCssClasses(xdoc);
        var loadedFonts = _skiaFontLoader.LoadFonts(xdoc);
        
        _svgTextVectoriser.VectorizeTextElements(xdoc, loadedFonts, cssClasses);
        _skiaFontLoader.CleanUpEmbedFonts(xdoc);

        return xdoc.ToString();
    }
}
