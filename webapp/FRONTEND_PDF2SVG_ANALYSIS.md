# Frontend-Only PDF to SVG Conversion: Comprehensive Analysis

## Requirements
1. **True Vector Output** - All elements as SVG paths/shapes
2. **Readable Text** - Actual text characters, not garbled glyphs
3. **Visual Fidelity** - Exact visual reproduction of the PDF

## Current Stack
- **pdf.js** 3.11.174 (Mozilla's PDF rendering library)
- Vanilla JavaScript
- Browser DOM API
- Canvas 2D API

---

## Approach 1: pdf.js SVGGraphics (Current Default)

### How It Works
pdf.js has a built-in `SVGGraphics` class that attempts to convert PDF operators directly to SVG elements.

### Implementation
```javascript
const svgGfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs);
const svg = await svgGfx.getSVG(operatorList, viewport);
```

### Pros
- ✅ True vector output for shapes, lines, paths
- ✅ Built into pdf.js (no new dependencies)
- ✅ Fast execution
- ✅ Preserves PDF structure

### Cons
- ❌ **Text rendering fails for encoded fonts** - Private use area characters (U+E000-U+F8FF)
- ❌ **Font families show as "undefined"** - Cannot resolve font mappings
- ❌ **Custom/encoded fonts not supported** - Google Sheets uses custom font subsets
- ❌ **No font embedding** - Cannot extract glyph paths from PDF fonts

### Root Cause of Text Issues
pdf.js's SVGGraphics only handles text correctly when:
1. The PDF has standard font encodings (WinAnsi, MacRoman, etc.)
2. Font subsetting doesn't use private use area characters
3. Font-to-SVG mapping is complete

Google Sheets exports PDFs with:
- Custom font subsets
- CID-keyed fonts with custom encoding
- Private use area character mappings

**Result:** Text appears as garbled TOFU characters or Unicode private use area characters.

---

## Approach 2: Canvas Rendering + Embedded Image (Current Implementation)

### How It Works
1. Render PDF page to Canvas 2D
2. Convert canvas to PNG data URL
3. Embed PNG in SVG as `<image>` element

### Implementation
```javascript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
await page.render({ canvasContext: ctx, viewport }).promise;
const dataUrl = canvas.toDataURL('image/png');
// Embed in SVG
```

### Pros
- ✅ **Perfect visual fidelity** - Exact reproduction of PDF
- ✅ **All fonts rendered correctly** - Canvas handles all font types
- ✅ **Works with any PDF** - No font compatibility issues
- ✅ **Simple and reliable** - Well-tested approach

### Cons
- ❌ **Not true vector** - Content is rasterized as PNG
- ❌ **Text not selectable** - Embedded as image pixels
- ❌ **Larger file sizes** - PNG embedding increases size
- ❌ **Scaling quality** - Loses crispness when scaling beyond original

---

## Approach 3: Canvas + Vectorization (imagetracerjs / potrace)

### How It Works
1. Render PDF to Canvas
2. Convert raster image to vector paths using tracing algorithm

### Libraries
- **imagetracerjs** - JavaScript vectorization
- **potrace** - Bitmap to vector tracing (port to WASM available)
- **vtracer** - Vectorization library with WASM support

### Implementation
```javascript
const imageData = canvas.getContext('2d').getImageData(0, 0, w, h);
const svgString = ImageTracer.imagedataToSVG(imageData, options, callback);
```

### Pros
- ✅ **True vector output** - All content as paths
- ✅ **Visual fidelity** - Based on rendered canvas
- ✅ **Browser-based** - No server required

### Cons
- ❌ **Text becomes paths** - Not selectable/editable
- ❌ **Large file sizes** - Complex paths for detailed content
- ❌ **Processing time** - Vectorization is slow for complex pages
- ❌ **Quality issues** - Text edges may appear jagged
- ❌ **imagetracerjs compatibility** - Has issues with ImageData format
- ❌ **Not suitable for text-heavy PDFs** - Tables become massive path data

### Verdict
**Not suitable** - Text becomes unselectable paths, defeating the purpose.

---

## Approach 4: pdf.js SVGGraphics + Text Overlay (Hybrid)

### How It Works
1. Render PDF to SVG using SVGGraphics (shapes/lines)
2. Extract text using `page.getTextContent()`
3. Remove garbled text from SVG
4. Overlay proper text elements at correct positions

### Implementation
```javascript
// Get SVG with shapes
const svg = await svgGfx.getSVG(operatorList, viewport);

// Extract text
const textContent = await page.getTextContent();

// Remove garbled text and overlay
for (const item of textContent.items) {
    const textEl = createTextElement(item.str, item.transform, viewport);
    svg.appendChild(textEl);
}
```

### Pros
- ✅ **True vector for shapes** - Lines, tables, boxes preserved
- ✅ **Readable text** - Actual text characters
- ✅ **Text selectable** - Standard SVG text elements
- ✅ **Browser-based** - No new dependencies
- ✅ **Built into pdf.js** - Uses existing APIs

### Cons
- ❌ **Font mismatch** - Must use web-safe fonts (Arial, etc.)
- ❌ **Positioning may vary** - Text may not align perfectly
- ❌ **Font size estimation** - Must calculate from transform matrix
- ❌ **No font styling** - Cannot preserve original font weight/style
- ❌ **CJK text issues** - May require fallback fonts
- ❌ **Text direction** - RTL/LTR may not be handled correctly

### Detailed Analysis

#### Text Position Extraction
PDF text transform matrix: `[a, b, c, d, e, f]`
- `e, f` = x, y position
- `a, d` = scale factors
- `b, c` = skew
- Rotation: `atan2(b, a)`

Font size: `sqrt(a² + b²)`

#### Font Resolution Problem
The critical limitation: **pdf.js does not expose font metrics to the browser**.

When `page.getTextContent()` returns text items, it provides:
- `str` - The text string
- `transform` - Position/scale matrix
- `width` - Advance width
- `height` - Advance height

But it does NOT provide:
- Font family name
- Font weight/style
- Font encoding
- Glyph mappings

#### Workaround Options

**Option A: Default Font**
```javascript
textEl.setAttribute('font-family', 'Arial, sans-serif');
textEl.setAttribute('font-size', fontSize);
```
- Simple but loses original styling

**Option B: Font Detection Heuristics**
```javascript
// Try to detect font from SVGGraphics output
const fontFamily = detectFontFromSVG(svg, item);
```
- Unreliable for encoded fonts
- Requires parsing SVG output

**Option C: PDF Font Dictionary Parsing**
```javascript
// Access PDF font dictionaries directly
const fontDict = page.objs.get(item.fontRef);
const fontFamily = fontDict.fontFace.fontFamily;
```
- Requires accessing internal pdf.js objects
- May not work with all PDF types
- Font faces may not be available in browser

### Verdict
**Best browser-based option** - Achieves vector + readable text, but font styling is lost.

---

## Approach 5: pdf.js Custom Font Rendering

### How It Works
1. Access pdf.js internal font objects
2. Extract font face information
3. Load fonts and use in SVG text elements

### Implementation
```javascript
// Access commonObjs and objs
const fontObj = page.objs.get(fontRef);
const fontFace = fontObj.fontFace; // { fontFamily, src, weight, style }

// Load font
const font = new FontFace(fontFace.fontFamily, fontFace.src, {
    weight: fontFace.weight,
    style: fontFace.style
});
document.fonts.add(font);
await font.load();
```

### Pros
- ✅ **True font preservation** - Original fonts used
- ✅ **Vector text** - Selectable and editable
- ✅ **Visual fidelity** - Matches original PDF

### Cons
- ❌ **Font loading complexity** - Many fonts fail to load
- ❌ **CORS issues** - Embedded fonts may have restrictions
- ❌ **Font size** - Embedded fonts increase page size
- ❌ **Not all fonts embeddable** - Some PDFs strip font data
- ❌ **Browser font API limitations** - Limited font support

### Feasibility
**Low** - Most PDFs don't include embeddable font data in browser-accessible format.

---

## Approach 6: PDF.js Operator List Custom Rendering

### How It Works
1. Parse PDF operator list manually
2. Convert PDF drawing operators to SVG elements
3. Handle text operators specially with custom font handling

### PDF Operators
- `m` - moveto
- `l` - lineto
- `c` - curveto
- `re` - rectangle
- `Tj` - show text
- `TJ` - show text with spacing
- `cm` - set transformation matrix

### Pros
- ✅ **Full control** - Custom rendering logic
- ✅ **Can handle text specially** - Override default behavior

### Cons
- ❌ **Complex implementation** - Must handle all PDF operators
- ❌ **Reinventing pdf.js** - pdf.js already does this
- ❌ **Font handling still broken** - Same font issues as SVGGraphics
- ❌ **Maintenance burden** - Must keep up with PDF spec

### Verdict
**Not recommended** - Too complex, same fundamental limitations.

---

## Approach 7: Canvas + SVG Hybrid (Recommended Browser Approach)

### How It Works
1. Render PDF to Canvas for visual background
2. Extract text and overlay as SVG text elements
3. Extract vector paths from canvas using edge detection
4. Combine all elements in final SVG

### Implementation Steps
```javascript
// 1. Render to canvas
const canvas = await renderToCanvas(page);

// 2. Extract text overlay
const textOverlay = await createTextOverlay(page);

// 3. Optional: Extract vector paths
const vectorPaths = await extractPathsFromCanvas(canvas);

// 4. Combine
const svg = combineElements(canvas, textOverlay, vectorPaths);
```

### Pros
- ✅ **Visual fidelity** - Canvas provides exact rendering
- ✅ **Readable text** - Text overlay is selectable
- ✅ **True vector** - Text and paths are vector
- ✅ **Browser-based** - No server required

### Cons
- ❌ **Complex implementation** - Multiple rendering systems
- ❌ **Font mismatch** - Text overlay may not match original
- ❌ **Layering issues** - Canvas may obscure text
- ❌ **Performance** - Multiple rendering passes

---

## Comparison Table

| Approach | Vector | Readable Text | Visual Fidelity | Complexity | Font Preservation |
|----------|--------|---------------|-----------------|------------|-------------------|
| 1. SVGGraphics | ✅ | ❌ | ⚠️ | Low | ❌ |
| 2. Canvas+Image | ❌ | ❌ | ✅ | Low | N/A |
| 3. Vectorization | ✅ | ❌ | ⚠️ | Medium | ❌ |
| 4. SVGGraphics+Overlay | ✅ | ✅ | ⚠️ | Medium | ❌ |
| 5. Custom Font | ✅ | ✅ | ⚠️ | High | ⚠️ |
| 6. Custom Operators | ✅ | ❌ | ⚠️ | Very High | ❌ |
| 7. Canvas+SVG Hybrid | ⚠️ | ✅ | ⚠️ | High | ❌ |

---

## Conclusion: Browser-Only Limitations

### The Fundamental Problem
**No browser-based library can extract glyph paths from PDF fonts.**

This is because:
1. PDF fonts may use custom encodings
2. Font data may be embedded but not accessible
3. Glyph-to-path conversion requires font parsing
4. Browser security restrictions limit font access

### What CAN Be Done in Browser
1. **Canvas rendering** - Perfect visual output (rasterized)
2. **SVGGraphics + Text Overlay** - Vector shapes + readable text (font loss)
3. **Text extraction** - Get readable text with positions

### What CANNOT Be Done in Browser
1. **True vector text with original fonts** - Requires font parsing
2. **Glyph path extraction** - Requires font file access
3. **Perfect font preservation** - Requires server-side font handling

### Recommended Approach

**For your use case (Google Sheets to Figma):**

The **Canvas + Image approach (Approach 2)** is actually the best browser-only solution because:
1. Google Sheets PDFs are table-heavy with standard fonts
2. Visual fidelity is more important than text selectability in Figma
3. Figma handles embedded images well
4. No font compatibility issues

**If you need true vector text**, you must use a backend solution:
- **pdf2svg** (Linux) - Converts PDF to SVG with text as paths
- **pdfium** (Chrome's engine) - Can extract vector paths
- **Ghostscript** - Powerful PDF processing

---

## Backend Alternatives (For Reference)

### pdf2svg
- Command-line tool
- Uses poppler library
- Produces true vector SVG with text as paths
- Text is selectable and editable
- Requires server/CLI execution

### pdfium
- Chrome/Chromium's PDF engine
- Can be compiled to WASM for browser use
- Better font handling than pdf.js
- Still limited in browser context

### Gerbera / pdf2vec
- Node.js bindings for poppler
- Server-side processing
- Full font support

---

## Final Recommendation

**For pure frontend approach:**
Use **Approach 4 (SVGGraphics + Text Overlay)** if you need:
- Vector shapes
- Readable text
- Accept font styling loss

Use **Approach 2 (Canvas + Image)** if you need:
- Perfect visual fidelity
- Reliability
- Simplicity

**For true vector + readable text + font preservation:**
You **must** use a backend solution with pdf2svg or similar.
