using Microsoft.Extensions.DependencyInjection;
using PDF2SVG;
using PDF2SVG.Interfaces;
using PDF2SVG.Services;

var services = new ServiceCollection();

// Register clean architecture abstractions and implementations
services.AddSingleton<ICssStyleParser, CssStyleParser>();
services.AddSingleton<ISkiaFontLoader, SkiaFontLoader>();
services.AddSingleton<ISvgTextVectoriser, SvgTextVectoriser>();
services.AddSingleton<IFileNamingService, FileNamingService>();
services.AddSingleton<PdfToSvgConverter>();

await using var serviceProvider = services.BuildServiceProvider();

await AppRunner.RunAsync(args, serviceProvider);
