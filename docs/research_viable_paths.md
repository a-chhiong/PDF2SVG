# Research: Viable Paths to Close the Webapp Quality Gap

Based on your feedback, I researched **Option B (PdfToSvg.NET via WASM)** and **Option D (Alternative JS PDF Libraries)** in depth.

---

## Option B: PdfToSvg.NET + SkiaSharp via WASM

### How It Would Work

Your intuition about [SkiaSharp.NativeAssets.WebAssembly](https://www.nuget.org/packages/SkiaSharp.NativeAssets.WebAssembly/) is correct — it exists and is the official WASM native asset package for SkiaSharp.

The idea is to compile the **entire consoleapp pipeline** to run inside the browser:

```
┌──────────────────────────────────────────────────────┐
│                Browser (WASM Runtime)                │
│                                                       │
│  PDF File (ArrayBuffer)                               │
│       ↓                                               │
│  PdfToSvg.NET (fully managed .NET → WASM)            │
│       ↓                                               │
│  SVG with real Unicode text + base64 @font-face      │
│       ↓                                               │
│  SkiaSharp (via NativeAssets.WebAssembly)             │
│       ↓                                               │
│  SvgTextVectoriser (your existing C# code)           │
│       ↓                                               │
│  Perfect vectorized SVG output                        │
└──────────────────────────────────────────────────────┘
```

### Feasibility Assessment

| Factor | Status | Notes |
| :--- | :---: | :--- |
| **PdfToSvg.NET WASM compatibility** | ✅ | Fully managed .NET library, no native dependencies. Targets .NET Standard 1.6+. Research confirms it's "likely your best open-source option" for Blazor WASM. |
| **SkiaSharp WASM** | ⚠️ | `SkiaSharp.NativeAssets.WebAssembly` exists. Also need `HarfBuzzSharp.NativeAssets.WebAssembly` for text rendering. Known issues with `DllNotFoundException: libSkiaSharp` in some .NET versions. |
| **MD5 Dependency** | ⚠️ | PdfToSvg.NET uses MD5 hashing internally. Browser WASM sandbox doesn't support `System.Security.Cryptography.MD5`. Requires a pure C# MD5 polyfill or JS interop workaround. |
| **Bundle Size** | ⚠️ | Estimated ~20-40MB total (SkiaSharp WASM ~8MB + .NET runtime ~5MB + PdfToSvg.NET + app code). Can be mitigated with lazy loading and Brotli compression. |
| **Performance** | ⚠️ | CPU-intensive. Would freeze the browser UI unless run in a Web Worker. AOT compilation recommended for speed. |
| **Licensing** | ✅ | PdfToSvg.NET is MIT. SkiaSharp is MIT. No licensing concerns. |

### Implementation Approach

1. Create a **Blazor WASM project** (or standalone .NET WASM with NativeAOT)
2. Add NuGet packages:
   - `PdfToSvg.NET` (v1.8.0)
   - `SkiaSharp` (v3.119.4)
   - `SkiaSharp.NativeAssets.WebAssembly`
   - `HarfBuzzSharp.NativeAssets.WebAssembly`
3. Port the consoleapp services (`PdfToSvgConverter`, `SvgTextVectoriser`, `SkiaFontLoader`, `CssStyleParser`) as-is
4. Expose a JS-callable API: `convertPdfToSvg(arrayBuffer) → svgString`
5. Call from the existing webapp's JS code via JS interop
6. Polyfill MD5 if needed

### Risks
- SkiaSharp WASM is **experimental** — `libSkiaSharp` loading failures reported in .NET 9+
- **Large initial download** — users must wait for ~20-40MB WASM bundle
- Debugging WASM in browsers is painful
- The webapp would effectively ship two runtimes (JS + .NET WASM)

---

## Option D: MuPDF.js (WASM)

### What It Is

**MuPDF** is a high-performance C library by Artifex Software, compiled to WebAssembly. The official npm package is [`mupdf`](https://www.npmjs.com/package/mupdf).

### How It Would Work

```javascript
import mupdf from "mupdf";

// Load PDF
const data = await file.arrayBuffer();
const doc = mupdf.Document.openDocument(data, "application/pdf");
const page = doc.loadPage(0);

// Convert to SVG with text as vector paths (pixel-perfect)
const svg = page.toSVG();  // text rendered as <path> elements
```

### Key Finding: Text-as-Path Mode

MuPDF has two SVG output modes:

| Mode | Output | Pros | Cons |
| :--- | :--- | :--- | :--- |
| `text=path` | Text converted to `<path>` elements | **Pixel-perfect fidelity.** No font dependency. Identical to consoleapp output. | Text is not selectable/searchable. Larger file size. |
| `text=text` | Text as `<text>` elements | Selectable/searchable text | May garble if PDF lacks `/ToUnicode` mapping. Relies on local fonts. |

> [!IMPORTANT]
> **`text=path` mode is exactly what the consoleapp does** — it converts every glyph to vector outlines. This is the mode we need. MuPDF's C engine handles the font parsing and path tracing internally with sub-pixel accuracy.

### Feasibility Assessment

| Factor | Status | Notes |
| :--- | :---: | :--- |
| **SVG Output Quality** | ✅ | MuPDF renders text with "metrics and spacing accurate to within fractions of a pixel." |
| **Text as Paths** | ✅ | Built-in `text=path` mode. No need for separate font loading or vectorisation. |
| **Browser Support** | ✅ | Official WASM build. Proven in production (see [pdf-to-svg.client-side.app](https://pdf-to-svg.client-side.app)). |
| **Bundle Size** | ✅ | Core WASM binary ~2MB. Much lighter than Blazor WASM. |
| **npm Package** | ✅ | `npm install mupdf`. Official, maintained by Artifex. |
| **Integration** | ✅ | Simple API: `page.toSVG()`. Can replace PDF.js + GlyphVectoriser entirely. |
| **Performance** | ✅ | C engine compiled to WASM. Very fast. Can run in Web Worker. |

> [!CAUTION]
> **Licensing: AGPL v3.** MuPDF is licensed under the GNU Affero General Public License. This means:
> - If you use it in a **web application served to users**, you **must open-source your entire webapp** under AGPL.
> - If your webapp is already open-source (your repo is on GitHub), this may be acceptable.
> - For **closed-source/commercial use**, you must purchase a commercial license from Artifex Software.

### Implementation Approach

1. `npm install mupdf` in the webapp
2. Create a new `mupdf-render-service.js` that replaces `pdf-render-service.js`
3. Use `page.toSVG()` with text-as-path mode
4. **Remove entirely**: `glyph-vectoriser.js`, `font-resolver.js`, all bundled Noto Sans fonts (~5MB savings)
5. The SVG output is already vectorized — no post-processing needed
6. Keep the existing UI components (`app-root.js`, `file-drop-zone.js`, `svg-viewer.js`) as-is

### What Gets Simplified

```diff
 webapp/src/services/
-  font-resolver.js        ← DELETE (MuPDF handles fonts internally)
-  glyph-vectoriser.js     ← DELETE (MuPDF renders paths directly)
-  pdf-render-service.js   ← REPLACE with mupdf-render-service.js
+  mupdf-render-service.js ← NEW (~50 lines, simple API)
 
 webapp/src/assets/fonts/
-  noto-sans-sc.woff       ← DELETE (~1.5MB, no longer needed)
-  noto-sans-tc.woff       ← DELETE (~1.3MB)
-  noto-sans-jp.woff       ← DELETE (~1.3MB)
-  noto-sans-kr.woff       ← DELETE (~830KB)
-  noto-sans.woff           ← DELETE
-  noto-sans-mono.woff      ← DELETE
```

---

## Comparison

| Criteria | Option B (PdfToSvg.NET WASM) | Option D (MuPDF.js) |
| :--- | :--- | :--- |
| **Output Quality** | Identical to consoleapp | Equivalent (sub-pixel accuracy) |
| **Bundle Size** | ~20-40MB | ~2MB |
| **Integration Effort** | High (Blazor WASM project, JS interop, MD5 polyfill) | Low (npm install, ~50 lines of code) |
| **Risk Level** | High (experimental SkiaSharp WASM, MD5 issues) | Low (proven in production) |
| **Code Reuse** | 100% reuse of existing C# code | Replace PDF.js pipeline entirely |
| **License** | ✅ MIT (free) | ⚠️ AGPL v3 (open-source or pay) |
| **Existing Proof** | Community reports, no public demo | [pdf-to-svg.client-side.app](https://pdf-to-svg.client-side.app) (live demo) |
| **Live Text Mode** | Can keep (PdfToSvg.NET emits real text) | Only with `text=text` mode (may garble) |

---

## Recommendation

> [!IMPORTANT]
> **If your webapp repo is open-source** (which it appears to be, on GitHub): **MuPDF.js is the clear winner.** It gives you consoleapp-level quality with ~50 lines of integration code, a ~2MB WASM bundle, and eliminates ~700 lines of glyph-vectoriser code + ~5MB of bundled fonts.

> If open-sourcing under AGPL is not acceptable, **Option B (PdfToSvg.NET WASM)** is your best bet — but expect higher engineering effort and a larger bundle.

### Open Question for You
Is the AGPL license acceptable for your project? Your GitHub repo (`a-chhiong/PDF2SVG`) appears to already be on GitHub — is it public or private?
