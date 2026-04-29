# Greenhouse Application Answer Bank

## Standard Fields

| Question Pattern | Answer |
|-----------------|--------|
| first name | Barron |
| last name | Zuo |
| legal first name | Xiao |
| email | xz429@cornell.edu |
| phone | +1 9094132840 |
| location / city | San Francisco |
| linkedin | https://www.linkedin.com/in/barron-z-15226126a/ |
| website / portfolio | barronzuo.com |
| current company / employer | Alibaba INC |
| authorized to work | Yes |
| require sponsorship | No |
| previously worked at | No |
| work onsite / hybrid | Yes |
| willing to relocate | Yes |
| non-compete / agreement | No |
| receive updates | Yes |
| how did you hear | LinkedIn |
| receive communication | Yes |

## EEO / Demographic

| Question Pattern | Answer |
|-----------------|--------|
| gender | Man |
| gender identity | Straight |
| race / ethnicity | East Asian |
| sexual orientation | Asexual |
| transgender | No |
| disability | No |
| veteran status | No |

## Common Open-Ended

| Question Pattern | Answer |
|-----------------|--------|
| salary expectations | $160,000 - $200,000 base, flexible on total compensation |
| years of experience | 15+ years in growth marketing, product-led growth, and digital strategy |
| management experience | Managed cross-functional teams of 5-20 across marketing, partnerships, product, and operations |
| start date / availability | Available to start within 2 weeks |
| notice period | 2 weeks |
| referral | N/A |
| why this role | [GENERATE: tailored to JD - reference specific company mission and how Barron's Alibaba/Next2Market/Indiegogo experience directly maps] |
| greatest strength | Data-driven growth operator with deep technical literacy — I build AI automation stacks and own end-to-end funnels from acquisition to retention |
| work style | Scrappy, autonomous, data-obsessed. I thrive in high-velocity environments where I can operate as connective tissue between Product, Eng, and Marketing |

## Learned Answers
<!-- New Q&A pairs discovered during application runs are appended below -->

| Question Pattern | Answer | Source |
|-----------------|--------|--------|
| GDPR / CCPA privacy notice acknowledgment | Acknowledged | Ingenio |
| SF Bay Area local / currently local to SF Bay Area | Yes | Ingenio |
| Korean PIPA collection/use/consignment consent (Coupang) | Agree to the collection and use, provision and consignment of my personal information | Coupang |
| relatives employed at company / working relatives | False | Coupang |
| applicant privacy / background / document policy acknowledgment | Acknowledged | Coupang |
| interview transcription consent (Korean/bilingual) | 동의합니다 / I agree | Coupang |
| recruitment notifications by call/text consent | Agree to receive recruitment notifications by call or text messages | Coupang |
| recruitment notifications by email consent | Agree to receive recruitment notifications by email | Coupang |

## Ashby-Specific Patterns

| Pattern | Approach | Source |
|---------|----------|--------|
| Arbitration/certification checkboxes | Click `label` element (not input) — label clicks trigger React checkbox | OpenAI Ashby |
| Toggle Yes/No (Ashby) | Use `page.evaluate()` to find container by label text + click button inside | All Ashby |
| Combobox location (Ashby) | `input[role="combobox"]` — fill + waitForTimeout(900) + click first option | All Ashby |
| College/university field | Use `document.querySelector('label[for="${id}"]')` to find by label[for] | Decagon |
| Breezy HR (AngularJS) forms | Use `angular.element(el).triggerHandler('input')` + `scope.$apply()` — NOT standard DOM events or Playwright .fill() | ShipScience |
