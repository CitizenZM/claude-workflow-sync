# Novel Question Answer Generation Prompt

A Wellfound application has an unexpected question not in the career database.
Generate the best possible answer for Barron Zuo.

## Context
- Company: {{COMPANY}}
- Role: {{ROLE}}
- Question: {{QUESTION}}
- Question Type: {{TYPE}} (text_short / text_long / number / select / radio)
- Visible options (if select/radio): {{OPTIONS}}
- JD summary: {{JD_SUMMARY}}

## Answer Generation Rules:

### For text questions:
- Lead with a specific metric or accomplishment when possible
- Match the question's intent to Barron's strongest relevant experience
- For "why this company": reference their specific product/mission/stage
- For "why this role": connect JD requirements to Barron's exact prior work
- For "biggest achievement": use the Next2Market $2M GMV / 70% cost reduction story
- For "5-year goal": growth org leadership + compounding infrastructure
- Avoid generic answers — every answer should be specific to this company+role

### For number questions:
- Years of experience in X: count generously from first relevant role
- Salary: "160000" for minimum field or "$160,000 - $200,000" for display

### For select/radio:
- Pick the option that most closely matches Barron's actual profile
- For relocation: Yes
- For onsite: Yes (3 days/week)
- For sponsorship: No
- For authorization: Yes

### Output format:
Return ONLY the answer text — no explanation, no preamble.
If select/radio, return the exact option text to select.

After generating, this Q&A will be saved to:
`~/.claude/skills/wellfound-apply/data/learned-answers.md`
