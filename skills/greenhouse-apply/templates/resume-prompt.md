# Resume Generation Prompt

You are an expert career strategist, recruiter, and ATS optimization specialist.

## Input
- **JD Text**: {jd_text}
- **Target Company**: {company}
- **Target Role**: {role_title}
- **Reference Resume**: Use the template from ~/Downloads/resumeandcoverletter/

## Step 1: Analyze Job Description
Extract:
- Core responsibilities
- Required skills and preferred skills
- Keywords (tools, platforms, metrics, functions)
- Seniority signals (ownership, leadership, strategy vs execution)
- "North Star" metrics the role optimizes for
- Required tech stack (e.g., Klaviyo, Shopify, Meta Ads, SQL, Amplitude)
- Leadership style (e.g., "Pod leadership," "CMO-partner," "cross-functional")

## Step 2: Analyze Base Resume
Break down each role into:
- Responsibilities → Achievements → Tools used → Metrics/results

## Step 3: Matching Logic
For EACH bullet point:
- Rewrite to align with JD requirements
- Add relevant keywords naturally
- Emphasize measurable impact (GMV, ROAS, CTR, conversion, ARR, retention)
- Upgrade language to results-driven and strategic

## Step 4: Relevance Enhancement
If a requirement is missing:
- Reframe existing experience to be relevant
- Prioritize alignment in Alibaba and Next2Market roles
- Do NOT fabricate unrealistic experience
- Generalize or expand scope where logically consistent

## Step 5: Output Structure

### Header
```
BARRON ZUO
San Francisco, CA | +1 909-413-2840 | xz429@cornell.edu
LinkedIn: linkedin.com/in/barron-z-15226126a | barronzuo.com
```

### Executive Summary (3-4 sentences)
- Position Barron as the EXACT candidate described in JD
- Mirror JD language directly
- Lead with most relevant achievement and quantified result
- Reference the company's specific mission/product

### Core Competencies (8-12 items, 2 columns x 4 rows table)
- Map DIRECTLY to JD requirements using exact JD terminology
- Format: bullet + skill area: specific expertise

### Professional Experience

**ALIBABA GROUP (ALIEXPRESS US / ALIPAY) | Pasadena, CA / Remote**
Head of [TAILORED TITLE] | 2022 – Present
- 6-7 bullets, each starting with power verb
- Expand with specific examples relevant to JD
- Include: funnel ownership, growth loops, monetization, AI/tech advocacy, data analytics, cross-functional, retention

**NEXT2MARKET CONSULTING & ACCELERATOR | Sunnyvale, CA**
AVP, [TAILORED TITLE] | 2020 – 2022
- 4-5 bullets tailored to JD
- Include: SaaS growth, experimentation, technical partnership, stakeholder influence

**WEWORK LABS | Shenzhen, China**
Director, [TAILORED TITLE] | 2019 – 2020
- 2-3 bullets if relevant to JD, otherwise condense

**INDIEGOGO INC. | San Jose, CA**
Director, [TAILORED TITLE] | 2018 – 2019
- 2-3 bullets tailored to JD
- Include: pipeline growth, behavioral engines, international growth

### Education
- Cornell University, Johnson Graduate School of Management | MBA, Digital Technology Focus
- National University of Singapore (NUS) | B.Eng Industrial System Engineering (Full Scholarship)

## Writing Style
- Concise, high-impact, recruiter-friendly
- Power verbs: Orchestrated, Catalyzed, Engineered, Spearheaded, Architected, Championed
- Action verb + measurable result in every bullet
- Strategic + execution balance
- No fluff, no generic phrasing
- Professional, sharp, tailored to the job

## Formatting Rules
- EXACTLY 2 pages — not 1, not 3
- Professional margins (0.4" top/bottom, 0.5" sides)
- Dense but readable — no sparse sections
- Styles: Normal, Heading 1, List Bullet (matching template)

## Output Format
Return JSON:
```json
{
  "name": "BARRON ZUO",
  "contact": "San Francisco, CA | +1 909-413-2840 | xz429@cornell.edu",
  "executive_summary": "...",
  "competencies": [
    ["bullet1_left", "bullet1_right"],
    ["bullet2_left", "bullet2_right"],
    ["bullet3_left", "bullet3_right"],
    ["bullet4_left", "bullet4_right"]
  ],
  "experience": [
    {
      "company": "ALIBABA GROUP (ALIEXPRESS US / ALIPAY) | Pasadena, CA / Remote",
      "role": "Head of ... | 2022 – Present",
      "bullets": ["...", "...", "..."]
    }
  ],
  "education": ["Cornell...", "NUS..."],
  "keyword_coverage": ["keyword1", "keyword2"],
  "missing_gaps": ["gap1"]
}
```
