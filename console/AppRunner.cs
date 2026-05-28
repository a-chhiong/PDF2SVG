using System;
using System.IO;
using Microsoft.Extensions.DependencyInjection;
using PDF2SVGConsole.Services;

namespace PDF2SVGConsole;

public static class AppRunner
{
    public static async Task RunAsync(string[] args, IServiceProvider serviceProvider)
    {
        Console.ForegroundColor = ConsoleColor.Blue;
        Console.WriteLine("==================================================");
        Console.WriteLine("   PDF2SVG - Pure Backend Vector Outline Converter");
        Console.WriteLine("==================================================");
        Console.ResetColor();

        string? inputPath = null;
        string? outputPath = null;

        if (args.Length == 0)
        {
            Console.Write("Enter the path to your PDF file: ");
            string? selectedPath = Console.ReadLine()?.Trim();

            if (!string.IsNullOrEmpty(selectedPath))
            {
                inputPath = selectedPath.Trim('\'', '"');
            }

            if (string.IsNullOrEmpty(inputPath) || !File.Exists(inputPath))
            {
                Console.ForegroundColor = ConsoleColor.Red;
                Console.WriteLine($"\nError: File '{inputPath}' does not exist.");
                Console.ResetColor();
                return;
            }

            Console.WriteLine();
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("Select output directory option:");
            Console.WriteLine("  [1] Next to the PDF (default)");
            Console.WriteLine("  [2] Current running folder");
            Console.WriteLine("  [3] Custom folder path");
            Console.Write("Enter choice (1, 2, or 3, default is 1): ");
            Console.ResetColor();

            string? outputChoice = Console.ReadLine()?.Trim();
            if (outputChoice == "2")
            {
                outputPath = Directory.GetCurrentDirectory();
            }
            else if (outputChoice == "3")
            {
                Console.Write("Enter custom output directory path: ");
                string? customDir = Console.ReadLine()?.Trim();
                if (!string.IsNullOrEmpty(customDir))
                {
                    outputPath = customDir.Trim('\'', '"');
                }
            }
            else
            {
                outputPath = null;
            }
        }
        else
        {
            inputPath = args[0];
            if (args.Length > 1)
            {
                outputPath = args[1];
            }
        }

        var converter = serviceProvider.GetRequiredService<PdfToSvgConverter>();

        try
        {
            await converter.ConvertFileAsync(inputPath!, outputPath);
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"\nConversion failed: {ex.Message}");
            Console.WriteLine(ex.ToString());
            Console.ResetColor();
        }
    }
}
