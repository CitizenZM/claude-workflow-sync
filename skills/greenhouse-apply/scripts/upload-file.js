// Prepare file upload on Greenhouse application form — run via browser_evaluate
// Accepts: FILE_TYPE ('resume' or 'cover_letter')
// Returns: { fileInputSelector, removedExisting, sectionFound }
// NOTE: After this script returns the selector, use browser_file_upload to upload the actual file
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const fileType = typeof FILE_TYPE !== 'undefined' ? FILE_TYPE : 'resume';

  // Find the section for this file type
  const labels = Array.from(document.querySelectorAll('label, h3, h4, h5, .field-label, legend, span'));
  const searchTerms = fileType === 'resume'
    ? ['resume', 'cv', 'curriculum']
    : ['cover letter', 'cover_letter', 'coverletter'];

  let targetSection = null;
  let targetLabel = null;

  for (const label of labels) {
    const text = label.textContent.toLowerCase();
    if (searchTerms.some(term => text.includes(term))) {
      targetLabel = label;
      targetSection = label.closest('.field-group, .form-section, .upload-section, .form-group, fieldset, [class*="upload"], [class*="field"]')
                     || label.parentElement?.parentElement
                     || label.parentElement;
      break;
    }
  }

  let removedExisting = false;

  // Remove existing file if present
  if (targetSection) {
    const removeBtn = targetSection.querySelector(
      'button[aria-label="Remove"], button[aria-label="Delete"], ' +
      '.remove-file, [title="Remove"], [title="Delete"], ' +
      'button.remove, a.remove, button[class*="remove"], button[class*="delete"], ' +
      'svg[class*="close"], button:has(svg), [data-testid*="remove"]'
    );
    if (removeBtn) {
      removeBtn.click();
      await sleep(1500);
      removedExisting = true;
    }
  }

  // Find the file input
  let fileInput = null;
  if (targetSection) {
    fileInput = targetSection.querySelector('input[type="file"]');
  }

  // Fallback: find all file inputs and pick by position
  if (!fileInput) {
    const allFileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
    if (fileType === 'resume' && allFileInputs.length >= 1) {
      fileInput = allFileInputs[0];
    } else if (fileType === 'cover_letter' && allFileInputs.length >= 2) {
      fileInput = allFileInputs[1];
    } else if (allFileInputs.length > 0) {
      fileInput = allFileInputs[0];
    }
  }

  // Build the best selector for the file input
  let selector = '';
  if (fileInput) {
    if (fileInput.id) selector = `#${fileInput.id}`;
    else if (fileInput.name) selector = `input[type="file"][name="${fileInput.name}"]`;
    else {
      // Use nth-of-type
      const allFileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
      const idx = allFileInputs.indexOf(fileInput);
      selector = `input[type="file"]:nth-of-type(${idx + 1})`;
    }
  }

  return JSON.stringify({
    fileInputSelector: selector || 'input[type="file"]',
    removedExisting,
    sectionFound: !!targetSection,
    fileInputFound: !!fileInput,
    totalFileInputs: document.querySelectorAll('input[type="file"]').length
  });
})();
