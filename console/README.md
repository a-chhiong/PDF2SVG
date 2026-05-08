# PDF2SVG - C# .NET Core Console Application

A command-line tool for converting PDF files to SVG format with full CJK (Chinese/Japanese/Korean) character support.

## Why this approach?

This console application uses Puppeteer Sharp to control a headless Chrome browser, which runs pdf.js for PDF to SVG conversion. This ensures consistent output with the webapp version and proper handling of all character types including CJK.

## Prerequisites

- .NET 8.0 SDK or later
- Internet connection (for initial Chromium download)

## Building

```bash
dotnet restore
dotnet build
```

## Usage

```bash
# Basic usage
dotnet run -- <input.pdf>

# With output directory
dotnet run -- <input.pdf> <output_directory>
```

### Arguments

| Argument | Description |
|----------|-------------|
| `input.pdf` | Path to the input PDF file (required) |
| `output_directory` | Optional output directory (default: same folder as input with PDF name) |

### Examples

```bash
# Convert and save to default location
dotnet run -- ..\assets\sample-local-pdf-1.pdf

# Convert and save to specific directory
dotnet run -- ..\assets\test.pdf .\output\
```

## Output

The tool generates one SVG file per PDF page:
- `page_1.svg`
- `page_2.svg`
- etc.

## Features

- **Full CJK Support**: All Chinese, Japanese, and Korean characters are preserved
- **Multi-page Support**: Each page is saved as a separate SVG file
- **Figma Compatible**: Output SVGs can be dragged directly into Figma
- **High Quality**: Uses 1.5x scale for better fidelity

## How it Works

1. Creates a temporary directory with the PDF and an HTML conversion page
2. Launches headless Chrome with Puppeteer Sharp
3. Loads pdf.js to convert each PDF page to SVG
4. Extracts the SVG output and saves to the specified directory
5. Cleans up temporary files

## Technical Details

- **Framework**: .NET 8.0
- **PDF Rendering**: pdf.js (version 3.11.174) via headless Chrome
- **Browser Automation**: Puppeteer Sharp
- **Font Handling**: Chrome's built-in font rendering ensures CJK characters are properly displayed
