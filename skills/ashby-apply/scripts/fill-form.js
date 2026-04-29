// Fill Ashby application form — run via browser_run_code (Playwright API required for combobox)
// Key differences from Greenhouse:
//   - Single name field (_systemfield_name), not first/last
//   - UUID-keyed custom fields (phone, linkedin, website)
//   - Location is a combobox (autocomplete), not a plain text field
//   - Yes/No questions use radio-style checkboxes, not select dropdowns
//   - Submit button text: "Submit Application"
//
// Usage: paste into browser_run_code as:
//   async (page) => { /* this script */ }

const PERSONAL_INFO = {
  fullName: 'Barron Zuo',
  email: 'xz429@cornell.edu',
  phone: '9094132840',
  location: 'San Francisco, CA',
  linkedin: 'https://www.linkedin.com/in/barron-z-15226126a/',
  website: 'barronzuo.com',
  authorized: 'Yes',
  sponsorship: 'No',
  previouslyWorked: 'No',
};

// --- Standard text fields ---
const fillText = async (page, sel, val) => {
  const el = page.locator(sel).first();
  if (await el.count() > 0) { await el.fill(val); return true; }
  return false;
};

await fillText(page, '#_systemfield_name', PERSONAL_INFO.fullName);
await fillText(page, '#_systemfield_email', PERSONAL_INFO.email);
await fillText(page, 'input[type="tel"]', PERSONAL_INFO.phone);
await fillText(page, 'input[id*="linkedin" i], input[placeholder*="linkedin" i]', PERSONAL_INFO.linkedin);
await fillText(page, 'input[id*="website" i], input[id*="portfolio" i], input[placeholder*="website" i], input[placeholder*="portfolio" i]', PERSONAL_INFO.website);

// --- Location combobox ---
const locInput = page.locator('input[role="combobox"]').first();
if (await locInput.count() > 0) {
  await locInput.click();
  await locInput.fill(PERSONAL_INFO.location);
  await page.waitForTimeout(900);
  const opt = page.getByRole('option').first();
  if (await opt.count() > 0) await opt.click({ force: true });
}
await page.waitForTimeout(300);

// --- Yes/No checkbox questions ---
// Ashby renders these as pairs of checkboxes with the same name
const yesNoMap = {
  authorized: PERSONAL_INFO.authorized,
  sponsor: PERSONAL_INFO.sponsorship,
  'previously worked': PERSONAL_INFO.previouslyWorked,
  'previously employed': PERSONAL_INFO.previouslyWorked,
  'legally authorized': PERSONAL_INFO.authorized,
  'require.*sponsor': PERSONAL_INFO.sponsorship,
  'require.*visa': PERSONAL_INFO.sponsorship,
  'require.*immigration': PERSONAL_INFO.sponsorship,
};

const filled = [];
const unknown = [];

// Get all checkbox groups
const checkboxGroups = await page.evaluate(() => {
  const groups = {};
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    const name = cb.name;
    if (!name) return;
    const container = cb.closest('[class*="field"], [class*="Field"], [class*="question"], fieldset') || cb.parentElement?.parentElement?.parentElement;
    const questionText = container ? Array.from(container.querySelectorAll('[class*="label"], [class*="Label"], label, p, span'))
      .map(e => e.textContent?.trim()).filter(t => t && t.length > 5)[0] : '';
    const labelEl = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
    const optionLabel = labelEl?.textContent?.trim() || cb.value || '';
    if (!groups[name]) groups[name] = { question: questionText || '', options: [] };
    groups[name].options.push({ id: cb.id, value: cb.value, label: optionLabel });
  });
  return groups;
});

for (const [name, group] of Object.entries(checkboxGroups)) {
  const q = group.question.toLowerCase();
  let answer = null;
  for (const [pattern, val] of Object.entries(yesNoMap)) {
    if (new RegExp(pattern, 'i').test(q)) { answer = val; break; }
  }
  if (!answer) { unknown.push(group.question); continue; }

  const target = group.options.find(o => o.label.toLowerCase().includes(answer.toLowerCase()));
  if (target) {
    const cb = target.id
      ? page.locator(`#${target.id}`)
      : page.locator(`input[type="checkbox"][name="${name}"]`).filter({ hasText: answer }).first();
    await cb.check({ force: true }).catch(() => {});
    filled.push(group.question);
  }
}

return { filled, unknown };
