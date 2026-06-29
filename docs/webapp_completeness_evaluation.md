# PDF2SVG: Completeness & Comparison Evaluation

This evaluation report compares the **Webapp** (`webapp`) against the **Consoleapp** (`consoleapp`) benchmark. Both projects are designed to convert PDF documents to SVG vector graphics on the fly with text vectorization.

> [!CAUTION]
> **MVP Test Results Invalidated Original Theories.** The "Dynamic Font Harvesting from CSS" and "2D Nearest-Neighbor Text Matching" approaches proposed in the original evaluation were tested against 3 real PDFs and achieved only **38–48% accuracy**. The root causes are architectural, not implementation bugs. This evaluation has been rewritten with honest findings.

---

## 📊 Comparison Matrix

| Dimension | 🖥️ Consoleapp (Benchmark) | 🌐 Webapp | Gap Status |
| :--- | :--- | :--- | :--- |
| **PDF Parser / SVG Emitter** | `PdfToSvg.NET` — outputs real Unicode text + embedded font subsets | `PDF.js SVGGraphics` — outputs glyph-mapped characters + no embedded fonts | **Architectural Gap (Unbridgeable in Browser)** |
| **Font Data** | Exact subsetted OpenType fonts embedded as base64 in SVG `<style>` | PDF.js registers fonts via `document.fonts` API as glyph-ID-mapped subsets | **Unbridgeable Gap** |
| **Text Content** | SVG `<text>` elements contain real Unicode strings | SVG `<text>` elements contain glyph-mapped garbled characters | **Unbridgeable Gap** |
| **Vectorization Engine** | SkiaSharp (`SKFont.GetTextPath`) | opentype.js (`font.getPath().toPathData`) | *Equivalent capabilities* |
| **Style/Class Parsing** | Ancestor climbing resolver | Ancestor climbing resolver | **Parity** |
| **Coordinate Handling** | Full cascading list support (`x`, `y`, `dx`, `dy`) | Full cascading list support (`x`, `y`, `dx`, `dy`) | **Parity** |
| **Rendering Modes** | Vector Outlines only | Vector Outlines & Editable Live Text | **Webapp Advantage** |
| **UX** | CLI file writes | Drag-drop, preview, copy-to-Figma, download | **Webapp Advantage** |
| **Fault Tolerance** | Exception logging | Canvas-PNG fallback | **Webapp Advantage** |

---

## 🔬 MVP Test Findings (What We Proved)

Three real PDFs from [.examples/](file:///Users/softmobile/Documents/Git/GitHub/a-chhiong/PDF2SVG/.examples) were tested:

| PDF Test Case | SVG Text Elements | textContent Items | Matched | Accuracy |
| :--- | :---: | :---: | :---: | :---: |
| 登機證票面(國內) | 199 | ~292 | 77 | **38.7%** |
| 登機證QRCode(國內) | 285 | ~400+ | 136 | **47.7%** |
| 登機證QRCode(國際或兩岸) | 399 | ~550+ | 151 | **37.8%** |

### Why Matching Cannot Reach ~100%

> [!IMPORTANT]
> The low accuracy is **not a tuning problem** — it's an **architectural incompatibility** between PDF.js's two separate output pipelines.

#### Problem 1: Cardinality Mismatch
- `page.getTextContent()` produces **N** text items (segmented by PDF text operators)
- `SVGGraphics.getSVG()` produces **M** SVG `<text>` elements (segmented by rendering operators)
- **N ≠ M** — they are produced by different code paths that segment text differently
- Example: 199 SVG text elements vs ~292 textContent items. There is no 1:1 mapping.

#### Problem 2: Coordinate Space Inversion
- PDF user space: origin at **bottom-left**, Y-axis points **up**
- SVG screen space: origin at **top-left**, Y-axis points **down**
- PDF.js's `SVGGraphics` wraps all elements in `<g transform="matrix(1,0,0,-1,0,H)">` groups
- Raw `<text x="..." y="...">` attributes are in **local group space**, not absolute page space
- `getBoundingClientRect()` partially solves this but introduces CSS layout artifacts (padding, scrolling, scaling of the preview container)

#### Problem 3: Font Data is Unusable
- PDF.js registers fonts via `document.fonts.add(new FontFace(...))` — NOT via `<style>` blocks
- These fonts are **glyph-ID-mapped subsets**, not Unicode-mapped fonts
- Even if extracted, passing them to `opentype.js` would produce wrong glyphs because the cmap table maps glyph IDs, not Unicode code points
- `harvestFontFromCSS()` correctly found **zero fonts** in all 3 tests

---

## 🏗️ Why the Consoleapp Works and the Webapp Can't Match It

The fundamental difference is in the **PDF library**, not in the vectorisation code:

```
┌─────────────────────────────────────────────────────────┐
│                    CONSOLEAPP                           │
│                                                         │
│   PDF ──► PdfToSvg.NET ──► SVG with:                   │
│              • Real Unicode text in <text> elements     │
│              • Exact font subsets as base64 @font-face  │
│              • Standard CSS classes for styling         │
│           ──► SkiaFontLoader reads embedded fonts       │
│           ──► SvgTextVectoriser processes text directly │
│           ──► Perfect output                            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                     WEBAPP                              │
│                                                         │
│   PDF ──► PDF.js SVGGraphics ──► SVG with:             │
│              • Glyph-mapped garbled characters          │
│              • NO embedded @font-face in SVG            │
│              • Fonts in document.fonts (glyph-ID maps)  │
│           ──► Must call getTextContent() separately     │
│           ──► Must spatially match N items to M nodes   │
│           ──► Cardinality mismatch → ~40% accuracy      │
│           ──► Fonts can't be used → Noto Sans fallback  │
└─────────────────────────────────────────────────────────┘
```

The consoleapp's `PdfToSvg.NET` library does the heavy lifting by producing an SVG that already contains everything needed: real Unicode text AND the exact font subsets. The C# vectoriser simply reads what's already there.

PDF.js was designed for **screen rendering**, not for producing self-contained SVG documents. Its SVG output is an internal rendering artefact, not a proper SVG interchange format.

---

## 🛣️ Realistic Paths Forward

> [!WARNING]
> There is **no browser-side fix** that can make PDF.js produce the same quality SVG as PdfToSvg.NET. The gap is in the PDF library, not in the webapp code.

### Option A: Server-Side Conversion (Recommended)
Run the consoleapp (or its core logic) as a backend API service. The webapp sends the PDF to the server and receives the vectorized SVG back.
- **Pros**: Identical quality to consoleapp. Webapp keeps its superior UX.
- **Cons**: Requires a server. Not purely client-side anymore.

### Option B: PdfToSvg.NET via WASM
Compile the .NET/SkiaSharp pipeline to WebAssembly (Blazor WASM or NativeAOT WASM).
- **Pros**: Runs entirely in the browser. Same quality.
- **Cons**: Large WASM bundle (~20-40MB). SkiaSharp WASM support is experimental. Significant engineering effort.

### Option C: Accept the Current Quality
Keep the webapp's current approach with Noto Sans fallback fonts and the ~40% text matching heuristic.
- **Pros**: Zero additional work. Good enough for many use cases.
- **Cons**: Not comparable to consoleapp quality for precision-critical documents.

### Option D: Alternative JS PDF Library
Investigate whether a different browser-side PDF library (e.g., `pdf-lib`, `mupdf.js WASM`) can produce SVG output with embedded fonts similar to PdfToSvg.NET.
- **Pros**: Could close the gap without a server.
- **Cons**: Research required. May not exist.

---

## 🌟 Webapp Strengths (Features Missing in Consoleapp)

Despite the parser gap, the webapp implements several features that make it valuable:

1. **Dual Rendering Modes**: Supports **Live Editable Text** mode with base64-embedded fonts for selectable/copyable text.
2. **Superior UX**: Drag-and-drop, interactive previews, **Copy SVG to Figma** clipboard integration.
3. **Robust Fault Tolerance**: Automatic canvas-rasterized PNG fallback when vector conversion fails.

---

## 📝 Conclusion

The original evaluation correctly identified the two core gaps (font fidelity and text matching) but proposed solutions that are **architecturally impossible** given PDF.js's design. The MVP test proved this definitively with 38–48% matching accuracy across all three test PDFs.

**The webapp cannot achieve consoleapp-level quality using PDF.js alone.** The path forward requires either a server-side component or a different PDF parsing library that produces Unicode text + embedded fonts.
