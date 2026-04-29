// Upload resume + cover letter and submit Ashby application
// Run via browser_run_code
// Requires: RESUME_PATH and COVER_LETTER_PATH to be set before running

const RESUME_PATH = typeof RESUME_PATH_VAR !== 'undefined' ? RESUME_PATH_VAR : '';
const COVER_PATH = typeof COVER_LETTER_PATH_VAR !== 'undefined' ? COVER_LETTER_PATH_VAR : '';

// --- Upload resume ---
// Ashby resume input: #_systemfield_resume
const resumeInput = page.locator('#_systemfield_resume');
if (await resumeInput.count() > 0 && RESUME_PATH) {
  await resumeInput.setInputFiles(RESUME_PATH);
  await page.waitForTimeout(1500);
}

// --- Upload cover letter (optional — first file input that is NOT #_systemfield_resume) ---
if (COVER_PATH) {
  const coverInput = page.locator('input[type="file"]:not(#_systemfield_resume)').first();
  if (await coverInput.count() > 0) {
    await coverInput.setInputFiles(COVER_PATH);
    await page.waitForTimeout(1500);
  }
}

// --- Verify uploads ---
const uploads = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('[class*="filename"], [class*="file-name"], [class*="fileName"], [class*="attachment"]'))
    .map(e => e.textContent?.trim()).filter(Boolean);
});

// --- Submit ---
const submitBtn = page.locator('button[type="submit"]').filter({ hasText: /submit/i }).first();
const btnCount = await submitBtn.count();
if (!btnCount) return { error: 'Submit button not found', uploads };

await submitBtn.click({ force: true });
await page.waitForTimeout(8000);

// --- Verify success ---
const result = await page.evaluate(() => {
  const txt = document.body.innerText;
  const success = /thank you|application.*received|successfully.*submitted|we.*received.*application/i.test(txt);
  const errors = Array.from(document.querySelectorAll('[class*="error"], [role="alert"], [class*="Error"]'))
    .map(e => e.textContent?.trim()).filter(t => t?.length > 3).slice(0, 5);
  return { success, errors, snippet: txt.substring(0, 300), url: window.location.href };
});

return { uploads, ...result };
