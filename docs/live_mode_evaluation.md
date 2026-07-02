# Live Mode SVG Evaluation Report

**Input**: `中台設定檔 - 登機證QRCode(國際或兩岸).pdf`
**Output**: `中台設定檔 - 登機證QRCode(國際或兩岸)_page_1.svg`

## Visual Evidence

````carousel
![Full SVG overview — the overall table structure renders correctly](/Users/softmobile/.gemini/antigravity-ide/brain/b48ad777-66f1-475d-a7aa-1fdc1f6d743f/svg_top_1782902478935.png)
<!-- slide -->
![Zoomed middle — shows row 13–38 details with Chinese/English mix](/Users/softmobile/.gemini/antigravity-ide/brain/b48ad777-66f1-475d-a7aa-1fdc1f6d743f/svg_zoomed_row21_1782902555049.png)
<!-- slide -->
![Zoomed bottom — footnotes area with dense mixed text](/Users/softmobile/.gemini/antigravity-ide/brain/b48ad777-66f1-475d-a7aa-1fdc1f6d743f/svg_zoomed_bottom_1782902564684.png)
<!-- slide -->
![Scrolled right — reveals clipped备註 column and long footnote lines](/Users/softmobile/.gemini/antigravity-ide/brain/b48ad777-66f1-475d-a7aa-1fdc1f6d743f/svg_zoomed_right_1782902801370.png)
````

---

## Issues Found

### 🔴 Issue 1: Chinese characters rendered with wrong glyphs (font substitution)

The SVG uses `SimHei` and `MS-PGothic` as primary CJK fonts. These are **Windows-only** fonts. On macOS (or any non-Windows system), the browser falls back to its default sans-serif for CJK, which causes **subtle but real glyph differences**.

Look at the character **「值」** — the SVG specifies `font-family="SimHei, sans-serif"` for this single character, while the surrounding text uses `MS-PGothic, sans-serif`. This is because MuPDF saw different embedded fonts in the PDF and the [live mode fix](file:///Users/softmobile/Documents/Git/GitHub/a-chhiong/PDF2SVG/web-app/src/services/pdf-service.js#L38-L52) correctly strips the subset prefix, but **doesn't normalize/unify** the CJK font family.

**Affected code**: [pdf-service.js L42-L50](file:///Users/softmobile/Documents/Git/GitHub/a-chhiong/PDF2SVG/web-app/src/services/pdf-service.js#L42-L50)

```
SimHei  → "SimHei, sans-serif"   (no CJK-specific fallback)
MS-PGothic → "MS-PGothic, sans-serif"  (no CJK-specific fallback)
```

> [!IMPORTANT]
> Neither `SimHei` nor `MS-PGothic` exists on macOS. The generic `sans-serif` fallback works, but there's no explicit CJK fallback chain like `"Noto Sans CJK TC", "PingFang TC", "Microsoft JhengHei"`.

---

### 🔴 Issue 2: Mixed Chinese+English text segments have visible spacing artifacts

In the **footnotes area** (bottom of the SVG), text like:

> `註5：baggageAllowance --> CheckedBaggageDetails --> NumWeight有  Number押 xPC有  Weight押 xK。`

This line is composed of **~20 separate `<text>` elements**, each with its own `x` coordinate and individual `textLength`. When the browser renders these, you can see:

- Uneven micro-gaps between Chinese segments and English segments
- The word `Number` and `Weight` have visible extra space around them compared to the original PDF
- The `押` and `有` characters don't sit flush against their neighbors

**Root cause**: Each `<text>` element is independently positioned and sized. When fonts differ from the original PDF (because `SimHei`/`MS-PGothic` aren't available), the `textLength` constraint stretches/compresses each fragment independently, creating a **mosaic effect** where gaps appear between fragments.

---

### 🟡 Issue 3: `textLength` over-constrains short Chinese text

There are **49 Chinese text elements** with `textLength` + `lengthAdjust="spacingAndGlyphs"`. For example:

| Text | textLength | Chars | Effective width/char |
|------|-----------|-------|---------------------|
| `華航` | 26.000 | 2 | 13.0 |
| `欄位名稱` | 52.000 | 4 | 13.0 |
| `固定` | 26.000 | 2 | 13.0 |
| `前三碼。` | 52.000 | 4 | 13.0 |
| `｛留三個空白｝` | 83.417 | 7 | ~11.9 |

The `textLength` values were computed from the **original font metrics** in the PDF (MS-PGothic at 13px). On macOS where the fallback font has different natural widths, `spacingAndGlyphs` forcibly stretches or compresses glyphs to fit, which can make CJK characters look **slightly squished or stretched**.

---

### 🟡 Issue 4: Row 21 — long mixed text gets clipped at the table edge

Row 21's 備註 column contains:

> `<FlightDepartureDate>抓取"年"的最後一碼。Julian Date依列印日期計算。`

This text **overflows the grid cell** and gets clipped by `clipPath` boundaries. Looking at the zoomed screenshot, you can see the text is cut off after `Julian Dat` — the remainder `e依列印日期計算。` is partially visible but runs past the cell boundary.

**This is not a live-mode bug** — it's a faithful reproduction of the PDF's clipping behavior. But it's worth noting as a visual imperfection.

---

### 🟡 Issue 5: Row 25/26 — underlined text with strikethrough rendering

Rows 25 and 26 (`1st-Non Consecutive Baggage Tag`, `2nd-Non Consecutive Baggage Tag`) have **strikethrough text** rendered via `<path>` elements overlaying the text. These render correctly, but the `<clipPath>` elements (`clip_7`, `clip_10`) tightly clip these rows to prevent overflow.

The field names are **clipped mid-word**: visible as `1st-Non Consecutive Baggage Tag |` with the end truncated. Again, this matches the PDF source.

---

### 🟢 Issue 6: Multi-x coordinate fix is working correctly

The programmatic analysis confirms **0 remaining multi-x coordinates** — the [fix in pdf-service.js L57-L90](file:///Users/softmobile/Documents/Git/GitHub/a-chhiong/PDF2SVG/web-app/src/services/pdf-service.js#L57-L90) successfully collapses all per-character `x` arrays to single `x` + `textLength`. English text like `Format Code`, `Passenger Name`, etc. renders with proper spacing.

---

### 🟢 Issue 7: Vertical text labels render correctly

The left-side vertical labels (`Mandatory Items`, `Conditional items`) use a rotation matrix and render correctly.

---

## Summary Table

| # | Severity | Issue | Root Cause |
|---|----------|-------|-----------|
| 1 | 🔴 High | CJK fonts (SimHei, MS-PGothic) missing on macOS | No CJK-specific fallback chain in font cleanup |
| 2 | 🔴 High | Micro-gaps in mixed CJK+English footnotes | Each text fragment independently `textLength`-constrained |
| 3 | 🟡 Medium | Chinese chars slightly squished/stretched | `textLength` values from original font metrics don't match fallback font |
| 4 | 🟡 Medium | Long text clipped at cell boundaries | Faithful to PDF `clipPath`, not a bug |
| 5 | 🟡 Medium | Strikethrough text clipped mid-word | Faithful to PDF `clipPath`, not a bug |
| 6 | 🟢 OK | Multi-x fix works | All per-char x arrays collapsed correctly |
| 7 | 🟢 OK | Vertical labels render | Rotation matrix handled properly |

## Suggested Fixes

### For Issue 1 — Add CJK fallback chain
```diff
- cleanFont = `${cleanFont}, sans-serif`;
+ // Add explicit CJK fallback for known CJK fonts
+ if (/gothic|simhei|mingliu|simsun|heiti|songti|kaiti|fangsong/i.test(cleanFont)) {
+   cleanFont = `${cleanFont}, "Noto Sans CJK TC", "PingFang TC", "Microsoft JhengHei", sans-serif`;
+ }
```

### For Issue 2 — Consider merging adjacent same-line text fragments
Adjacent `<text>` elements on the same `y` that share the same transform could be merged into a single `<text>` with `<tspan>` children, which would let the browser handle inter-glyph spacing more naturally.

### For Issue 3 — Remove textLength for CJK-only text
For `<text>` elements where **all characters are CJK**, removing `textLength` and `lengthAdjust` and relying on natural glyph widths may produce better visual results, since CJK fonts are typically monospaced within a family.
