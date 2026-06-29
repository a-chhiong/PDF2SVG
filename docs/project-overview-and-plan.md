# PDF2SVG Project Overview & Plan

## Project Summary

PDF2SVG is a PDF-to-SVG vector converter with **two implementations**:

### 1. Consoleapp (`/consoleapp`) — C# .NET 8
- **Benchmark quality**: Uses `PdfToSvg.NET` + `SkiaSharp` to produce pixel-perfect vector SVGs
- Fully vectorizes fonts to `<path>` outlines with CJK support
- Clean SOLID architecture with DI

### 2. Webapp (`/webapp`) — Lit + Vite SPA
- **Already migrated to MuPDF.js WASM** (replaced PDF.js/opentype.js)
- Dual rendering modes: Vector Outlines (`text=path`) and Editable Text (`text=text`)
- Glassmorphism UI with dark/light theme
- Drag-and-drop, SVG preview, copy-to-Figma clipboard, download

---

## Project Structure

```
PDF2SVG/
├── consoleapp/                 # C# .NET 8 console converter (benchmark)
│   ├── Program.cs              # DI container setup
│   ├── AppRunner.cs            # CLI orchestration
│   ├── PDF2SVG.csproj          # .NET 8, PdfToSvg.NET, SkiaSharp
│   ├── Interfaces/             # ICssStyleParser, ISkiaFontLoader, ISvgTextVectoriser, IFileNamingService
│   └── Services/               # PdfToSvgConverter, CssStyleParser, SkiaFontLoader, SvgTextVectoriser
│
├── webapp/                     # Lit + Vite SPA (MuPDF.js WASM backend)
│   ├── index.html              # Entry point (still references old PDF.js/opentype.js CDNs)
│   ├── mvp.html                # Legacy MVP test page
│   ├── vite.config.js          # Vite config with MuPDF optimization exclusions
│   ├── package.json            # lit, mupdf dependencies
│   ├── public/
│   │   ├── sw.js               # PWA service worker (caches stale assets)
│   │   └── assets/             # Static assets
│   ├── src/
│   │   ├── main.js             # Bootstrap, theme init, SW registration
│   │   ├── controllers/
│   │   │   └── pdf-conversion-controller.js  # State machine: idle → converting → done
│   │   ├── features/
│   │   │   ├── app-root.js              # Shell with mode-switcher, conditional views
│   │   │   ├── file/file-drop-zone.js    # Drag-and-drop PDF input
│   │   │   ├── mode/mode-switcher.js     # Live text / Vector outlines toggle
│   │   │   ├── progress/conversion-progress.js  # Animated progress bar
│   │   │   ├── theme/theme-toggle.js     # Dark/light theme switcher
│   │   │   └── viewer/svg-viewer.js      # SVG preview with copy/download
│   │   ├── services/
│   │   │   └── pdf-render-service.js     # MuPDF page → SVG rendering
│   │   ├── assets/fonts/                 # Noto Sans CJK fallback fonts (6 woff files)
│   │   └── styles/
│   │       ├── main.css                  # Layout, buttons, animations
│   │       └── theme.css                 # Design tokens (light/dark)
│   └── dist/                    # Production build output
│
├── docs/
│   ├── research_viable_paths.md           # MuPDF.js vs PdfToSvg.NET WASM research
│   ├── webapp_completeness_evaluation.md   # Architecture gap analysis
│   └── plans/
│       └── webapp-text-issues-analysis.md  # Root cause analysis of text issues
│
└── demo/
    └── demo.pdf                # Sample PDF for testing
```

---

## Current State Assessment

### ✅ What Works Well
1. **MuPDF.js backend** — Successfully migrated from PDF.js, produces proper SVGs
2. **Vector Outlines mode (`text=path`)** — Uses MuPDF's built-in text-to-path, pixel-perfect
3. **Editable Text mode (`text=text`)** — Uses MuPDF's text rendering
4. **UI** — Clean, responsive, glassmorphism design with dark/light theme
5. **Copy to clipboard** — Copies raw SVG XML for Figma import
6. **Download** — Saves SVG files
7. **Progress tracking** — Per-page progress bar

### ⚠️ Issues & Technical Debt

| Issue | Severity | Details |
|-------|----------|---------|
| **Old CDN scripts still in `index.html`** | Low | PDF.js & opentype.js CDNs are loaded but unused — ~300KB unnecessary download |
| **Service worker caches stale assets** | Low | `sw.js` caches individual source files, but Vite build hashes assets — cache misses in production |
| **No error handling for unsupported PDF structures** | Medium | MuPDF might crash on complex files without graceful fallback |
| **Font files in `src/assets/fonts/` are unused** | Medium | Noto Sans fonts were for the old opentype.js pipeline; MuPDF handles fonts internally |
| **No automated tests** | Medium | No test coverage for either consoleapp or webapp |
| **`demo.pdf` is empty or not in the project** | Low | Listed in structure but may be a placeholder |

### 🔧 Opportunities for Improvement

1. **Cleanup**: Remove dead code (old CDN scripts, unused font files)
2. **Robustness**: Add error boundaries for MuPDF failures, graceful degradation
3. **Performance**: Run MuPDF in a Web Worker to avoid blocking the UI thread
4. **Testing**: Add unit/integration tests for the render service
5. **CI/CD**: Set up GitHub Actions for building both projects
6. **Documentation**: Update README files to reflect the MuPDF migration

---

## Recommended Next Steps

### Phase 1 — Cleanup (Low Effort, Low Risk)
1. Remove unused CDN scripts (PDF.js, opentype.js) from `index.html`
2. Remove unused Noto Sans font files from `src/assets/fonts/`
3. Update service worker to use Vite's import.meta.glob for asset caching
4. Update README files to reflect current architecture

### Phase 2 — Resolve Existing Issue (if any)
The user mentioned a prior text analysis in `plans/webapp-text-issues-analysis.md`. Let's check if those issues are still relevant post-MuPDF migration or if any new issues need attention.

Please let me know what you'd like to work on next!
