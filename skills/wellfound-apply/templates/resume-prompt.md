# Resume Generation Prompt — Wellfound Applications

You are generating a tailored resume for Barron Zuo for a specific job application. This resume MUST be exactly 2 full pages.

## Job Details
- Company: {{COMPANY}}
- Role: {{ROLE}}
- Location: {{LOCATION}}
- Compensation: {{COMP}}

## JD Analysis (extracted)
{{JD_TEXT}}

## Generation Rules

### MANDATORY RULES (never violate):
1. NO China locations — use "San Francisco, CA" for Alibaba
2. NO Zhejiang University — use "National University of Singapore — Bachelor of Arts in Economics (International)"
3. Every JD requirement must appear in the resume
4. Executive summary must mirror JD language specifically — NOT generic
5. Length: EXACTLY 2 full pages — dense content, no padding
6. Power verbs: Orchestrated, Catalyzed, Engineered, Spearheaded, Architected
7. Lead every bullet with a metric: GMV, ROAS, CVR, ARR, CAC, LTV, retention rate

### Resume Structure:
1. **Header**: Barron Zuo | xz429@cornell.edu | +1 (909) 413-2840 | San Francisco, CA | linkedin.com/in/barron-z-15226126a | barronzuo.com
2. **Executive Summary** (4-5 sentences): Mirror JD keywords exactly. Highlight the 3 most critical requirements the JD asks for.
3. **Core Competencies** (2-col table, 8 items): Match JD's language for skills and tools
4. **Professional Experience**:
   - **Alibaba INC** — Growth Marketing Director | San Francisco, CA | 2022–Present
     - 6-8 bullets, each with metric, each mapping to a specific JD requirement
   - **Next2Market** — Founder & Marketing Director | San Francisco, CA | 2021–Present
     - 5-6 bullets, focus on entrepreneurial/growth hacking angle
   - **Indiegogo** — Growth Marketing Manager | San Francisco, CA | 2019–2021
     - 4-5 bullets, platform/marketplace growth angle
5. **Education**:
   - Cornell University — MS Applied Economics and Management (2022)
   - National University of Singapore — BA Economics, International (2020)

### python-docx generation:
Use `~/.claude/skills/greenhouse-apply/scripts/generate-resume.py` as template.
Save to: `/Users/xiaozuo/Downloads/resumeandcoverletter/Barron_Zuo_{{COMPANY_SLUG}}_{{ROLE_SLUG}}_Resume.docx`
