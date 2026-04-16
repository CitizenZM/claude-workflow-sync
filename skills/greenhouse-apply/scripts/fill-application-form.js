// Fill Greenhouse application form — run via browser_evaluate
// Accepts injected variables: PERSONAL_INFO (object), ANSWER_BANK (object)
// Returns: { filled: [], unknown: [], totalFields: number }
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(2000); // Wait for form to load

  const info = typeof PERSONAL_INFO !== 'undefined' ? PERSONAL_INFO : {
    firstName: 'Barron',
    lastName: 'Zuo',
    legalFirstName: 'Xiao',
    email: 'xz429@cornell.edu',
    phone: '9094132840',
    location: 'San Francisco',
    linkedin: 'https://www.linkedin.com/in/barron-z-15226126a/',
    website: 'barronzuo.com',
    currentCompany: 'Alibaba INC',
    authorized: 'Yes',
    sponsorship: 'No',
    previouslyWorked: 'No',
    onsite: 'Yes',
    relocate: 'Yes',
    subjectToAgreement: 'No',
    receiveUpdates: 'Yes',
    hearAboutUs: 'LinkedIn',
    receiveCommunication: 'Yes',
    gender: 'Man',
    genderIdentity: 'Straight',
    race: 'East Asian',
    sexualOrientation: 'Asexual',
    transgender: 'No',
    disability: 'No',
    veteran: 'No'
  };

  // Helper: find field by label text
  const findField = (labelText) => {
    const labels = Array.from(document.querySelectorAll('label'));
    for (const label of labels) {
      if (label.textContent.toLowerCase().includes(labelText.toLowerCase())) {
        const forId = label.getAttribute('for');
        if (forId) {
          const el = document.getElementById(forId);
          if (el) return el;
        }
        const child = label.querySelector('input, select, textarea');
        if (child) return child;
        const next = label.nextElementSibling;
        if (next && (next.tagName === 'INPUT' || next.tagName === 'SELECT' || next.tagName === 'TEXTAREA')) {
          return next;
        }
      }
    }
    // Also try by name/placeholder/aria-label
    const byName = document.querySelector(`input[name*="${labelText}" i], select[name*="${labelText}" i], textarea[name*="${labelText}" i]`);
    if (byName) return byName;
    const byPlaceholder = document.querySelector(`input[placeholder*="${labelText}" i]`);
    if (byPlaceholder) return byPlaceholder;
    const byAriaLabel = document.querySelector(`[aria-label*="${labelText}" i]`);
    if (byAriaLabel) return byAriaLabel;
    return null;
  };

  // Helper: set input value with events
  const setInput = (field, value) => {
    if (!field || !value) return false;

    if (field.tagName === 'SELECT') {
      const options = Array.from(field.options);
      const match = options.find(o =>
        o.text.toLowerCase().includes(value.toLowerCase()) ||
        o.value.toLowerCase().includes(value.toLowerCase())
      );
      if (match) {
        field.value = match.value;
        field.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    }

    if (field.type === 'radio' || field.type === 'checkbox') {
      const group = document.querySelectorAll(`input[name="${field.name}"]`);
      for (const r of group) {
        const labelText = r.closest('label')?.textContent?.trim() ||
                          document.querySelector(`label[for="${r.id}"]`)?.textContent?.trim() ||
                          r.value;
        if (labelText.toLowerCase().includes(value.toLowerCase())) {
          r.checked = true;
          r.dispatchEvent(new Event('change', { bubbles: true }));
          r.dispatchEvent(new Event('click', { bubbles: true }));
          return true;
        }
      }
      return false;
    }

    // Text input, textarea
    field.focus();
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.blur();
    return true;
  };

  // Field mapping: [search pattern, value]
  const mappings = [
    ['first name', info.firstName],
    ['last name', info.lastName],
    ['legal first', info.legalFirstName],
    ['legal name', info.legalFirstName],
    ['email', info.email],
    ['phone', info.phone],
    ['location', info.location],
    ['city', info.location],
    ['linkedin', info.linkedin],
    ['website', info.website],
    ['portfolio', info.website],
    ['current company', info.currentCompany],
    ['current employer', info.currentCompany],
    ['authorized', info.authorized],
    ['legally authorized', info.authorized],
    ['sponsorship', info.sponsorship],
    ['visa', info.sponsorship],
    ['previously worked', info.previouslyWorked],
    ['previously employed', info.previouslyWorked],
    ['onsite', info.onsite],
    ['in-office', info.onsite],
    ['hybrid', info.onsite],
    ['relocate', info.relocate],
    ['relocation', info.relocate],
    ['non-compete', info.subjectToAgreement],
    ['agreement', info.subjectToAgreement],
    ['non-solicitation', info.subjectToAgreement],
    ['updates', info.receiveUpdates],
    ['hear about', info.hearAboutUs],
    ['how did you', info.hearAboutUs],
    ['source', info.hearAboutUs],
    ['communication', info.receiveCommunication],
    ['gender', info.gender],
    ['race', info.race],
    ['ethnicity', info.race],
    ['sexual orientation', info.sexualOrientation],
    ['transgender', info.transgender],
    ['disability', info.disability],
    ['veteran', info.veteran],
  ];

  const filled = [];
  const unknown = [];
  const attempted = new Set();

  // Fill mapped fields
  for (const [pattern, value] of mappings) {
    if (attempted.has(pattern)) continue;
    attempted.add(pattern);
    const field = findField(pattern);
    if (field && value) {
      const success = setInput(field, value);
      if (success) {
        filled.push(pattern);
      }
    }
  }

  // Scan for unfilled required fields
  const allRequired = document.querySelectorAll('[required], [aria-required="true"]');
  allRequired.forEach(field => {
    if (!field.value || field.value.trim() === '') {
      const label = field.closest('label')?.textContent?.trim() ||
                    document.querySelector(`label[for="${field.id}"]`)?.textContent?.trim() ||
                    field.name || field.placeholder || field.id || 'unknown';
      unknown.push({
        label: label.substring(0, 100),
        type: field.type || field.tagName,
        name: field.name || '',
        id: field.id || '',
        selector: field.name ? `[name="${field.name}"]` : field.id ? `#${field.id}` : ''
      });
    }
  });

  // Count all form fields
  const allFields = document.querySelectorAll('form input, form select, form textarea');

  return JSON.stringify({
    filled,
    unknown,
    totalFields: allFields.length,
    requiredFields: allRequired.length,
    filledCount: filled.length,
    unknownCount: unknown.length
  });
})();
