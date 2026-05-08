using System;
using System.IO;
using System.Threading.Tasks;
using PuppeteerSharp;

namespace PDF2SVG
{
    class Program
    {
        static async Task Main(string[] args)
        {
            global::System.Console.WriteLine("PDF2SVG - PDF to SVG Converter");
            global::System.Console.WriteLine("================================");

            if (args.Length < 1)
            {
                PrintUsage();
                return;
            }

            string inputPath = args[0];
            string? outputPath = args.Length > 1 ? args[1] : null;

            if (!File.Exists(inputPath))
            {
                global::System.Console.WriteLine($"Error: File not found: {inputPath}");
                return;
            }

            try
            {
                // Create a temporary directory for the conversion
                string tempDir = Path.Combine(Path.GetTempPath(), $"PDF2SVG_{Guid.NewGuid()}");
                Directory.CreateDirectory(tempDir);

                try
                {
                    // Copy the PDF to temp dir with a known name
                    string tempPdfPath = Path.Combine(tempDir, "input.pdf");
                    File.Copy(inputPath, tempPdfPath);

                    // Create the conversion HTML page
                    string conversionHtml = CreateConversionHtml(tempPdfPath);
                    string htmlPath = Path.Combine(tempDir, "conversion.html");
                    File.WriteAllText(htmlPath, conversionHtml, System.Text.Encoding.UTF8);

                    // Download Chromium if needed
                    var browserFetcher = new BrowserFetcher();
                    await browserFetcher.DownloadAsync("chrome-mac-119.0.6045.9");

                    // Launch browser
                    using var browser = await Puppeteer.LaunchAsync(new LaunchOptions
                    {
                        Headless = true,
                        Args = new[] { "--no-sandbox", "--disable-setuid-sandbox" }
                    });

                    using var page = await browser.NewPageAsync();

                    // Load the conversion page
                    await page.GoToAsync($"file://{htmlPath}", WaitUntilNavigation.Networkidle0);

                    // Wait for conversion to complete
                    await page.WaitForSelectorAsync("#status-container", new WaitForSelectorOptions { Timeout = 120000 });
                    await page.WaitForSelectorAsync(".svg-item", new WaitForSelectorOptions { Timeout = 120000 });

                    // Get the SVG results
                    var results = await page.EvaluateExpressionAsync<object[]>("getSvgResults()");

                    if (results == null || results.Length == 0)
                    {
                        global::System.Console.WriteLine("Error: No SVG output generated");
                        return;
                    }

                    // Determine output directory
                    string outputDir = outputPath ?? Path.Combine(Path.GetDirectoryName(inputPath) ?? ".", Path.GetFileNameWithoutExtension(inputPath));
                    Directory.CreateDirectory(outputDir);

                    // Save each SVG
                    for (int i = 0; i < results.Length; i++)
                    {
                        var result = (dynamic)results[i];
                        string svgContent = result.svg;
                        string fileName = result.fileName;
                        string savePath = Path.Combine(outputDir, fileName);
                        File.WriteAllText(savePath, svgContent, System.Text.Encoding.UTF8);
                        global::System.Console.WriteLine($"Saved: {savePath}");
                    }

                    global::System.Console.WriteLine($"\nConversion complete! {results.Length} page(s) saved to: {outputDir}");
                }
                finally
                {
                    // Clean up temp directory
                    if (Directory.Exists(tempDir))
                    {
                        try
                        {
                            Directory.Delete(tempDir, true);
                        }
                        catch
                        {
                            // Ignore cleanup errors
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                global::System.Console.WriteLine($"Error: {ex.Message}");
                global::System.Console.WriteLine(ex.ToString());
            }
        }

        static void PrintUsage()
        {
            global::System.Console.WriteLine("Usage: PDF2SVG <input.pdf> [output_directory]");
            global::System.Console.WriteLine();
            global::System.Console.WriteLine("Arguments:");
            global::System.Console.WriteLine("  input.pdf          Path to the input PDF file");
            global::System.Console.WriteLine("  output_directory   Optional: Output directory (default: same folder as input with PDF name)");
            global::System.Console.WriteLine();
            global::System.Console.WriteLine("Example:");
            global::System.Console.WriteLine("  PDF2SVG document.pdf ./output");
        }

        static string CreateConversionHtml(string pdfPath)
        {
            // Escape the PDF path for JavaScript string
            string escapedPdfPath = pdfPath.Replace("\\", "\\\\").Replace("'", "\\'");
            
            return @"<!DOCTYPE html>
<html lang=""en"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>PDF to SVG Converter</title>
    <script src=""https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js""></script>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .hidden { display: none; }
        #status { margin: 10px 0; padding: 10px; background: #f0f0f0; border-radius: 4px; }
        .svg-item { margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
    </style>
</head>
<body>
    <div id=""status-container"">
        <div id=""status"">Initializing...</div>
    </div>
    <div id=""output-container"" class=""hidden"">
        <div id=""svg-list""></div>
    </div>

    <script>
        // Initialize pdf.js
        var pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        var svgResults = [];

        async function convertPdf() {
            var statusEl = document.getElementById('status');
            var statusContainer = document.getElementById('status-container');
            var outputContainer = document.getElementById('output-container');
            var svgList = document.getElementById('svg-list');

            try {
                statusEl.textContent = 'Loading PDF...';

                // Read the PDF file
                var response = await fetch('""" + escapedPdfPath + @"');
                var arrayBuffer = await response.arrayBuffer();
                
                var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                statusEl.textContent = 'Converting ' + pdf.numPages + ' page(s)...';

                for (var i = 1; i <= pdf.numPages; i++) {
                    statusEl.textContent = 'Processing page ' + i + ' of ' + pdf.numPages + '...';
                    
                    var page = await pdf.getPage(i);
                    var viewport = page.getViewport({ scale: 1.5 });

                    var operatorList = await page.getOperatorList();
                    var svgGfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs);
                    var svg = await svgGfx.getSVG(operatorList, viewport);

                    // Clean up SVG
                    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                    svg.setAttribute('width', viewport.width);
                    svg.setAttribute('height', viewport.height);

                    var fileName = 'page_' + i + '.svg';
                    var svgContent = svg.outerHTML;
                    
                    svgResults.push({ svg: svgContent, fileName: fileName, pageNum: i });

                    // Add to DOM
                    var item = document.createElement('div');
                    item.className = 'svg-item';
                    item.innerHTML = '<h3>Page ' + i + '</h3><p>' + fileName + '</p>';
                    svgList.appendChild(item);
                }

                statusContainer.classList.add('hidden');
                outputContainer.classList.remove('hidden');

            } catch (error) {
                console.error('Error converting PDF:', error);
                statusEl.textContent = 'Error: ' + error.message;
            }
        }

        // Expose results for Puppeteer to access
        function getSvgResults() {
            return svgResults;
        }

        // Start conversion
        convertPdf();
    </script>
</body>
</html>";
        }
    }
}
