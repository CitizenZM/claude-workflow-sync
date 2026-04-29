// Locate file upload input on Wellfound application form
// Returns: { selector: string, found: boolean, existingFileName: string }
// NOTE: Actual file upload done via browser_file_upload after running this script
(() => {
  const result = { found: false, selector: '', existingFileName: '', allFileInputs: [] };

  const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
  result.allFileInputs = fileInputs.map((inp, i) => ({
    index: i,
    id: inp.id,
    name: inp.name,
    accept: inp.accept,
    selector: inp.id ? `#${inp.id}` : `input[type="file"]:nth-of-type(${i + 1})`
  }));

  if (fileInputs.length === 0) {
    result.error = 'No file input found';
    return result;
  }

  // Prefer resume-specific input
  const resumeInput = fileInputs.find(inp => {
    const context = (inp.id + inp.name + inp.closest('label, div, section')?.textContent || '').toLowerCase();
    return context.includes('resume') || context.includes('cv');
  }) || fileInputs[0];

  result.found = true;
  result.selector = resumeInput.id ? `#${resumeInput.id}` : 'input[type="file"]';
  result.accept = resumeInput.accept;

  // Check for existing uploaded file name
  const container = resumeInput.closest('div, section');
  if (container) {
    const nameEl = container.querySelector('[class*="file-name"], [class*="fileName"], [class*="filename"], span');
    result.existingFileName = nameEl?.textContent?.trim() || '';
  }

  return result;
})();
