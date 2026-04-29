// Fill Wellfound application form fields using career-db answers
// Pass db as a JSON string argument, or inline the values
// Returns: { filled: string[], skipped: string[], unknowns: string[] }
(() => {
  const db = {
    first_name: 'Barron',
    last_name: 'Zuo',
    legal_first_name: 'Xiao',
    email: 'xz429@cornell.edu',
    phone: '+1 9094132840',
    location: 'San Francisco',
    linkedin: 'https://www.linkedin.com/in/barron-z-15226126a/',
    website: 'barronzuo.com',
    current_company: 'Alibaba INC',
    salary: '160000',
    salary_display: '$160,000 - $200,000'
  };

  const boolMap = {
    authorized_us: true,
    sponsorship_required: false,
    previously_worked: false,
    willing_to_relocate: true,
    onsite_3days: true,
    non_compete: false,
    receive_updates: true,
    receive_communication: true
  };

  const result = { filled: [], skipped: [], unknowns: [] };

  // Helper: fill an input element
  function fillInput(el, value) {
    if (!el || !value) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'select') {
      const opts = Array.from(el.options);
      const match = opts.find(o =>
        o.text.toLowerCase().includes(value.toLowerCase()) ||
        o.value.toLowerCase().includes(value.toLowerCase())
      );
      if (match) { el.value = match.value; el.dispatchEvent(new Event('change', { bubbles: true })); return true; }
      return false;
    }
    el.focus();
    el.value = value;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  // Map label text → value
  const labelMap = {
    'first name': db.first_name,
    'given name': db.first_name,
    'last name': db.last_name,
    'family name': db.last_name,
    'surname': db.last_name,
    'legal first': db.legal_first_name,
    'email': db.email,
    'phone': db.phone,
    'mobile': db.phone,
    'location': db.location,
    'city': db.location,
    'linkedin': db.linkedin,
    'website': db.website,
    'portfolio': db.website,
    'company': db.current_company,
    'employer': db.current_company,
    'salary': db.salary_display,
    'compensation': db.salary_display,
    'expected salary': db.salary_display
  };

  // Find all form inputs, selects, textareas
  const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), select, textarea'));

  for (const input of inputs) {
    // Get label text
    let label = '';
    const id = input.id;
    if (id) {
      const labelEl = document.querySelector(`label[for="${id}"]`);
      label = labelEl?.textContent?.toLowerCase()?.trim() || '';
    }
    if (!label) {
      const placeholder = input.placeholder?.toLowerCase()?.trim() || '';
      label = placeholder;
    }
    if (!label) {
      const parent = input.closest('[class*="field"], [class*="Field"], .form-group, .input-group');
      label = parent?.querySelector('label, [class*="label"]')?.textContent?.toLowerCase()?.trim() || '';
    }

    let matched = false;
    for (const [key, value] of Object.entries(labelMap)) {
      if (label.includes(key)) {
        if (fillInput(input, value)) {
          result.filled.push(label || input.name || 'unknown');
          matched = true;
          break;
        }
      }
    }

    if (!matched && label) {
      result.unknowns.push(label);
    }
  }

  // Handle checkboxes for yes/no questions
  const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]'));
  for (const cb of checkboxes) {
    const labelEl = cb.closest('label') || document.querySelector(`label[for="${cb.id}"]`);
    const labelText = labelEl?.textContent?.toLowerCase() || '';
    if (labelText.includes('receive') || labelText.includes('update') || labelText.includes('communication')) {
      if (!cb.checked) { cb.click(); result.filled.push(labelText.substring(0, 50)); }
    }
  }

  return result;
})();
