// Awin login script — run via browser_evaluate on https://app.awin.com login page
// Accepts: EMAIL, PASSWORD as injected JS vars (string-replace in caller)
async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const ck = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Accept all'));
  if (ck) { ck.click(); await sleep(800); }
  const email = document.querySelector('input[type="email"], input[name="username"]');
  if (email) {
    email.focus();
    email.value = EMAIL;
    email.dispatchEvent(new Event('input', {bubbles: true}));
    email.dispatchEvent(new Event('change', {bubbles: true}));
    await sleep(400);
  }
  const cont = Array.from(document.querySelectorAll('button')).find(b => /continue/i.test(b.textContent));
  if (cont) { cont.click(); await sleep(2000); }
  const pw = document.querySelector('input[type="password"]');
  if (pw) {
    pw.focus();
    pw.value = PASSWORD;
    pw.dispatchEvent(new Event('input', {bubbles: true}));
    pw.dispatchEvent(new Event('change', {bubbles: true}));
    await sleep(400);
  }
  const signin = Array.from(document.querySelectorAll('button')).find(b => /sign in|log in|submit/i.test(b.textContent));
  if (signin) { signin.click(); }
  return JSON.stringify({ stage: 'submitted', emailFilled: !!email, pwFilled: !!pw });
}
