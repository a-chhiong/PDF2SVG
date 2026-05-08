# PDF2SVG - Google Sheets to Figma Converter

A premium, browser-based tool to seamlessly import complicated Google Sheet tables into Figma by using PDF as an intermediary format.

## Why this approach?

Directly copying and pasting complicated tables from Google Sheets to Figma often results in lost formatting, broken borders, or merged cells being split. By exporting to **PDF** first, Google Sheets' rendering engine handles the layout perfectly. This tool then converts that PDF into a clean **SVG**, which Figma can import as perfectly layered vector paths and text.

## How to use

1.  **Export from Google Sheets**: Go to `File > Download > PDF document (.pdf)`. Ensure the formatting looks correct in the preview.
2.  **Convert to SVG**: Drag and drop the downloaded PDF into `index.html` (this tool).
3.  **Import to Figma**: Click **Copy SVG** or **Download** and drag/paste the SVG into your Figma canvas.

## Features

- **High Fidelity**: Uses `pdf.js` SVG backend for perfect vector reproduction.
- **Privacy First**: All processing happens in your browser. No files are uploaded to any server.
- **Static Ready**: No database or complex backend required. Just plain HTML/CSS/JS.

## Setup

Since this is a static project, you can simply open `index.html` in any modern browser. To run it as a local server:

```powershell
python -m http.server 8000
```

Then visit `http://localhost:8000`.
