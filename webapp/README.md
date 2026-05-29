# PDF2SVG Webapp — Google Sheets to Figma Vector Converter

A premium, highly optimized browser-based SPA utility designed to translate PDF tables (such as Google Sheets exports) into resolution-independent, pixel-perfect SVG vector graphics ready for instant Figma import.

---

## 🏛️ Architecture & Core Technologies

The application is engineered using an industry-standard **MVVM (Model-View-ViewModel)** decoupled design, offering the perfect balance: **build-agnostic** in development (modular ES Modules running natively) and **compile-ready** in production (turnkey Vite bundling & minification).

- **UI Views (LitElements)**: Built using standard `LitElement` components rendering inside the Light DOM (`createRenderRoot() { return this; }`) to cleanly inherit our premium, custom glassmorphism theme (`style.css`) without Shadow DOM bloat or CSS duplication.
- **Logic Controller (Lit ReactiveController)**: All state management, PDF parsing loops, canvas fallback, and results caching are completely outsourced to the reactive controller `src/controllers/pdf-conversion-controller.js`.
- **Shapes & Fills Layer (PDF.js SVGGraphics)**: Shapes, clipping paths, grids, and table cells are rendered natively using PDF.js's native `SVGGraphics` to ensure 100% rendering fidelity.
- **Dynamic Text Shaper (opentype.js & FontResolver)**: Renders character runs into resolution-independent Bezier `<path>` shapes.

---

## 🎨 Dual Rendering Modes

Switch between two core render pipelines instantly in the UI with sub-millisecond, memory-cached transitions:

### 1. Vector Outlines (Recommended for Figma)
* **What it does**: Traces each character run into geometric Bezier curves (SVG `<path>` elements).
* **Figma Compat**: **Perfect**. Imports as pure vector nodes instantly. Zero "Missing Font" errors, zero rendering drift, and completely font-independent.
* **Fidelity**: **100% Exact**. Outlines are generated using custom font subsets extracted directly from the PDF itself.

### 2. Editable Live Text
* **What it does**: Maps and resolves the characters into standard, selectable SVG `<text>` elements.
* **Figma Compat**: **Medium**. Keeps text elements copyable and editable, provided the matching fonts are loaded.
* **Fidelity**: **Excellent**. Matches characters to clean, lazy-loaded local Noto Sans CJK and Latin fallback fonts via `@font-face` injection inside `<defs>`.

---

## 🗂️ Project Directory Layout

```
webapp/
├── package.json         → NPM scripts & Vite dev dependencies (at root)
├── vite.config.js       → Turnkey Vite production configuration (at root)
├── dist/                → Compiled, minified output assets folder (sibling to src/)
│
└── src/                 → Raw, editable source code
    ├── index.html       → SPA entry HTML point
    ├── style.css        → Glassmorphic custom theme, loaders, and variables
    ├── main.js          → Main app bootstrapper & Custom Elements registration
    │
    ├── controllers/     → Lit Reactive Controllers (MVVM State Machine)
    │   └── pdf-conversion-controller.js
    │
    ├── components/      → Lit Component UI Views (Light DOM templates)
    │   ├── app-root.js             → Layout shell and mode toggle toolbar
    │   ├── file-drop-zone.js       → Drag-and-drop listener and uploader
    │   ├── svg-viewer.js           → SVG pan & zoom (svg-pan-zoom) canvas lists
    │   └── conversion-progress.js  → Animated progressive loading status
    │
    └── services/        → Core business logic (pure JS classes)
        ├── font-resolver.js        → Range matching of PDF fonts to Noto styles
        ├── glyph-vectoriser.js     → opentype.js binary parsing & outline generator
        └── pdf-render-service.js   → Operator list shapes & text coordinator
```

---

## 🚀 Getting Started & Local Commands

To install dependencies and run the webapp locally:

### 1. Install Dependencies
```bash
# Navigate to webapp root
cd webapp

# Install Vite and Lit packages
npm install
```

### 2. Run Development Server (Build-Free HMR)
Vite acts as a zero-config, lightning-fast dev server with Hot Module Replacement:
```bash
npm run dev
```
Open `http://localhost:3000` in the browser to develop.

### 3. Production Bundling & Minification
Triggers a high-efficiency compilation that packs standard `Lit`, our controllers, views, and shaper logic into a single optimized static bundle:
```bash
npm run build
```
Vite transforms and compiles all modules in **under 150ms**, producing a tiny, static bundle size:
- **`dist/index.html`** (1.89 kB)
- **`dist/assets/index.BdRFRLiA.css`** (3.64 kB)
- **`dist/assets/index.IOjar4Gs.js`** (34.84 kB — **only 11.54 kB gzipped!**)

### 4. Preview the Production Build
```bash
npm run preview
```
Open `http://localhost:4173` to verify the minified distribution build locally.

---

## 🛡️ Robust Failure Safeguard
If the advanced vector shaper or `SVGGraphics` throws an unhandled error on a highly complex or malformed page, the rendering pipeline automatically catches the error and falls back to a high-resolution **Canvas Bitmap wrapper** for that page. This guarantees that a valid, highly accurate, and readable SVG is always produced without stopping the conversion process.
