---
name: brand-ab-test
description: Research a brand's visual identity, analyze top 5 competitors, extract real site content, and build a Figma file with 2 AB test homepage designs using actual copy, pricing, and CRO patterns from competitor research. Usage - /brand-ab-test <url>
origin: ECC
tags: [design, figma, CRO, AB-test, branding, UIUX]
---

# Brand AB Test Design

End-to-end brand research + Figma homepage AB test generator. Takes a URL, researches the brand's VI and top competitors, then produces a research-informed Figma file with 2 distinct homepage variants using real site content.

## When to Activate

- User provides a brand URL and wants AB test homepage designs
- User says "design AB test", "create homepage variants", "build AB test in Figma"
- User wants competitor-informed design work for a DTC/e-commerce brand
- User asks for CRO-focused homepage redesign with research backing

## Input

The user provides a URL (e.g., `https://aoniclife.com/`). If no URL is given, ask for one.

## Workflow (5 Phases)

### Phase 1: VI Extraction (WebFetch)

Fetch the target site and extract:

1. **Color palette** — ALL hex codes from CSS, inline styles, SVGs
2. **Typography** — Font families, weights, sizing scale
3. **Logo** — Treatment, variants, spacing
4. **Content** — EXACT text for every section: headlines, subheads, body, CTAs, testimonials, product names/prices, team bios, trust signals
5. **Section structure** — Full page architecture top to bottom
6. **Photography style** — Image descriptions, aesthetic

Fetch multiple pages in parallel:
- Homepage: `<url>/`
- Product page: `<url>/products/` or `<url>/collections/all`
- About page: `<url>/pages/about-us` or `<url>/pages/about`

Save to: `~/Projects/Design-System-Reference/<brand>-vi-extraction.md`

### Phase 2: Competitor Research (Agent — background)

Launch a background agent to research the top 5 competitors in the brand's category:

1. Identify 5 competing brands (same price tier, same product category)
2. For each competitor, extract via WebFetch:
   - Color palette with hex codes
   - Typography (font families, weights)
   - Hero section strategy (headline, CTA, layout)
   - CRO/conversion elements (trust badges, social proof, urgency)
   - User journey design (homepage flow)
   - Unique UI/UX patterns worth stealing
3. Create comparative matrix (color, typography, hero, trust, pricing, aesthetic)
4. Write 10 prioritized design takeaways (P0-P3)

Save to: `~/Projects/Design-System-Reference/<brand>-competitor-research.md`

### Phase 3: Content Harvesting

From Phase 1 data, compile a clean content sheet:

- All headlines and subheadlines (exact wording)
- Product names, descriptions, prices (subscription + one-time)
- Testimonials with full attribution (name, title, credentials)
- Team members with roles
- Trust signals and guarantees
- Promotional offers and coupon codes
- Footer content and social links
- Navigation items

### Phase 4: Figma Design Build

Create a new Figma file named `<Brand> AB Test — Research-Informed`:

**Get Figma access:**
1. Call `whoami` to get planKey
2. Call `create_new_file` with the file name

**Version A — Page 1:**
Apply the brand's TRUE color palette (from Phase 1, not invented colors).
Design pattern: Choose the highest-impact competitor pattern from Phase 2.
Common choice: AG1-style risk-reversal hero with split layout.

Build 10 sections using `use_figma` Plugin API:
1. Announcement bar (real promo text)
2. Navigation (real nav items)
3. Hero (risk-reversal or outcome-focused headline, real product name)
4. Social proof bar (real media logos)
5. "How It Works" section (3 steps)
6. Product promise / value props
7. Products (real names, prices, badges)
8. Expert testimonial (real quote, real attribution)
9. Newsletter CTA (real copy)
10. Footer (real links, real social handles)

**Version B — Page 2:**
Create a NEW page via `figma.createPage()`, then `setCurrentPageAsync()`.
Apply a DIFFERENT design approach from Phase 2 research.
Common choice: Ritual/Seed editorial trust style with warm palette.

Differentiate on:
- Color accent (different from Version A)
- Hero layout (centered vs. split)
- Trust architecture (inline text vs. tiered cards)
- Product display (individual cards vs. protocol bundles)
- Navigation approach (product-name vs. goal-based)

### Phase 5: Documentation

Output a summary table comparing the two versions:
- List every AB test variable (hero, color, trust, products, nav, CTA)
- Include the Figma file URL
- Suggest next steps (photography, Shopify integration, metrics to track)

## Figma Plugin API Rules

Critical patterns to avoid errors:

1. **FILL sizing order** — ALWAYS `parent.appendChild(child)` BEFORE `child.layoutSizingHorizontal = "FILL"`. Setting FILL on a node not yet in an auto-layout parent throws an error.

2. **Page switching** — Use `figma.createPage()` then `await figma.setCurrentPageAsync(page)`. Verify the page exists before switching.

3. **Font loading** — Load ALL fonts before creating text:
```js
await Promise.all([
  figma.loadFontAsync({family:"Inter",style:"Regular"}),
  figma.loadFontAsync({family:"Inter",style:"Medium"}),
  figma.loadFontAsync({family:"Inter",style:"Semi Bold"}),
  figma.loadFontAsync({family:"Inter",style:"Bold"}),
  figma.loadFontAsync({family:"Inter",style:"Extra Bold"}),
  figma.loadFontAsync({family:"Inter",style:"Light"}),
]);
```

4. **Text helper** — Use a reusable function:
```js
function tx(chars, size, style, color, align) {
  const t = figma.createText();
  t.characters = chars; t.fontSize = size;
  t.fontName = {family:"Inter", style};
  t.fills = [{type:"SOLID", color}];
  if (align) t.textAlignHorizontal = align;
  return t;
}
```

5. **Auto-layout frames** — Always set `layoutMode`, `layoutSizingHorizontal/Vertical`, and `itemSpacing` explicitly.

6. **Fixed-width text** — For multi-line text that should wrap: `t.resize(width, t.height); t.textAutoResize = "HEIGHT";`

7. **Verify with screenshots** — After building each version, use `get_screenshot` to verify the output.

## Output Files

All files saved to `~/Projects/Design-System-Reference/`:
- `<brand>-vi-extraction.md` — Brand visual identity
- `<brand>-competitor-research.md` — Competitor analysis with recommendations
- Figma file link in the summary

## Quality Checklist

Before reporting done:
- [ ] ALL text is real content from the site (zero placeholder/invented copy)
- [ ] Color palette matches the actual brand (verified against site)
- [ ] All product names, prices, and descriptions are accurate
- [ ] Testimonials use real quotes with real attribution
- [ ] Both versions are visually distinct (different hero, color, layout, trust pattern)
- [ ] Screenshots taken of both versions to verify
- [ ] Research docs saved to Design-System-Reference folder
- [ ] Figma file URL provided to user
