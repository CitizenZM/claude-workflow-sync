---
name: Stitch Design Workflow Configuration
description: Comprehensive 6-phase design system with competitive research, CRO annotation, and Figma output. Trigger with design brief inputs.
type: project
---

**Workflow:** Stitch Design Workflow v1.0

## Execution Parameters (User-Specified)

1. **Scope**: Prepare ALL pages/screens needed for complete project (not single-page design)
2. **Target User Analysis**: User persona/demographics inferred from Phase 1 competitive research (do not assume — research identifies the audience)
3. **Trigger Method**: User inputs design brief each time workflow is called (no standing brief)
4. **Device Priority**: Mobile-first (generate mobile Stitch prompts separately; don't scale-down desktop designs)

## Phase Sequence

**Phase 0** → Input parsing (brief, reference URLs, output spec)
**Phase 1** → Competitive crawl + visual extraction + infer target user from market analysis
**Phase 2** → User journey mapping (for inferred persona) + conversion flow + CRO checklist  
**Phase 3** → Stitch prompt generation for ALL pages/screens (desktop + mobile variants)
**Phase 4** → Annotated analysis (CRO callouts: 🔴🟢🟡🔵⚪ legend)
**Phase 5** → Figma structure (5-page org: Research → System → Mobile Designs → Desktop → States)
**Phase 6** → Final deliverables (report + annotated PNGs + Figma file + CRO scorecard)

## How to Trigger

User provides:
- What: [product/brand/page type to design]
- References: [competitor URLs or design briefs]
- Any brand constraints or existing assets

I execute Phase 0-6 autonomously. No confirmation loops; default to mobile-first execution unless desktop is explicitly stated as primary.

## Output Standard

- Competitive research findings with user persona inference
- Annotated competitor screenshots (min. 5-8 callouts each)
- Stitch-generated designs for ALL screens (annotated, 8-12 callouts each)
- Figma file ready for handoff
- CRO scorecard (x/100)

---

**Why:** Mobile-first, comprehensive coverage, autonomous execution matches user's fast-moving affiliate marketing pace. Competitive research infers target user rather than assuming — ensures designs match actual market demand.

**How to apply:** When user says "design X", activate Phase 0 intake, confirm understanding of brief + references, then execute all 6 phases autonomously. Always start with mobile Stitch prompts. Always include target user persona analysis in final report.
