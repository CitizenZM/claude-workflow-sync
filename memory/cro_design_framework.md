---
name: CRO Design Evaluation Framework
description: Three-dimensional design assessment framework for user conversion, e-commerce CRO, and brand consistency
type: feedback
---

## Framework Overview (三维评估框架)

### Dimension 1: User Conversion (用户转化)
**Focus:** Behavioral psychology, friction reduction, clarity of value proposition

**Evaluation Criteria (评估标准):**
- **CTA Clarity** (CTA清晰度): Primary action visible above fold, contrast ratio ≥ 4.5:1
- **Friction Audit** (摩擦力评估): Form fields, clicks to conversion, unexpected navigation patterns
- **Value Proposition** (价值主张): Core benefit stated in <8 words, compelling headline hierarchy
- **Social Proof** (社会证明): Reviews, testimonials, user count, trust badges placement
- **Mobile Usability** (移动可用性): Touch targets ≥48px, font ≥14px, viewport optimization

**Target Metric:** Conversion Rate Lift (+8-18% range)

---

### Dimension 2: E-Commerce CRO (电商转化优化)
**Focus:** Transaction friction, pricing psychology, inventory scarcity, checkout optimization

**Evaluation Criteria (评估标准):**
- **Pricing Transparency** (价格透明): Real-time pricing, tax display, shipping cost visibility
- **Scarcity/Urgency** (稀缺/紧急感): Stock levels, countdown timers, limited-time offers, placement impact
- **Product Information** (产品信息): Specs, dimensions, materials, warranty, returns policy clarity
- **Payment Friction** (支付摩擦): Checkout steps, payment methods, guest checkout option
- **Price Stack Analysis** (价格堆栈): Sale price, original price, discount clarity, savings visualization
- **Guarantee/Trust** (保障/信任): Money-back guarantee, return window, warranty prominence

**Target Metric:** Cart-to-Conversion Rate, AOV, Return Rate

---

### Dimension 3: Brand Design (品牌设计)
**Focus:** Visual consistency, brand identity preservation, professional aesthetics

**Evaluation Criteria (评估标准):**
- **Color Palette Adherence** (色彩准确): Primary/secondary colors match brand guidelines ±5% WCAG variance
- **Typography Consistency** (字体一致性): Font family, weights, sizes follow brand spec
- **Visual Hierarchy** (视觉层级): Contrast, size, spacing create clear information priority
- **Imagery Style** (图像风格): Photography tone, product showcase consistency, lifestyle alignment
- **Component System** (组件系统): Reusable patterns, spacing grid (8px/16px), button/card standards
- **Brand Voice** (品牌声调): Copy tone, language formality, messaging alignment

**Target Metric:** Brand Consistency Score (100%), Visual Coherence

---

## Design Refinement Process (设计细化流程)

### 3-Pass Refinement (三轮细化)

**Pass 1 — Conversion Focus (转化焦点)**
- Optimize CTA visibility, placement, and contrast
- Reduce form friction, simplify checkout flow
- Enhance value proposition clarity
- Annotate all changes in English + Chinese
- Record hypothesis for each change

**Pass 2 — CRO Optimization (CRO优化)**
- Strengthen pricing presentation and scarcity signals
- Test urgency messaging variations (high/medium/low)
- Improve product trust signals (guarantees, reviews)
- Refine inventory visibility and purchase psychology
- Annotate variations with percentage-based uplift assumptions

**Pass 3 — Brand + Polish (品牌+完善)**
- Audit color, typography, spacing for brand consistency
- Refine image assets and component styling
- Ensure WCAG accessibility (contrast, readability)
- Final visual coherence review
- Document all design rationale in bilingual format

---

## Asset Sourcing Protocol (素材获取协议)

**Priority Order:**
1. **Brand website assets** (品牌网站素材) → Screenshot or download directly
2. **Product images** (产品图片) → Use official brand photography
3. **Price/specs** (价格/规格) → Copy verbatim from official source
4. **Fallback generation** (备用生成) → AI-generated mockups only if official assets unavailable
5. **Never** (禁止): Use competitor imagery, modify official prices, alter brand claims

---

## Annotation Standard (标注标准)

All design changes must include:
- **English Label:** [CRO: Urgency Signal - Red Countdown Timer]
- **Chinese Label:** [CRO: 紧急感信号 - 红色倒计时器]
- **Hypothesis:** "Countdown timer increases perceived scarcity, expected CVR lift +12%"
- **Design Rationale:** "Placed above fold, contrasts with neutral background, aligns with urgency variant"
- **Metric:** GA4 event: cro_signal_view, cro_signal_click

---

## Success Criteria (成功标准)

- ✅ All three passes complete with no element change undocumented
- ✅ Bilingual annotation on 100% of optimized elements
- ✅ Original brand text, pricing, specs preserved verbatim
- ✅ Brand design consistency score = 100%
- ✅ A/B variant differentiation clear (Control vs. Urgency vs. Trust-Heavy)
