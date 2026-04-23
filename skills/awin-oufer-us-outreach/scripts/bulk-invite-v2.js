async () => {
  const PARTNERSHIP_THRESHOLD = 50;
  const message = "Hi, this is Bob Zabel, reaching out from Oufer Body Jewelry, the NO.1 Piercing Body Jewelry you MUST see. We are offering 10-20% ultra high commission with limited time deal offer, Reply here or to affiliate@celldigital.co to chat in details and get the sample. REPLY now for limited time offer.";
  const commissionValue = "20";
  
  // Collect publishers from current page
  const tableRows = document.querySelectorAll('table tbody tr');
  const results = {
    total: 0,
    sent: [],
    skippedLowQuality: 0,
    skippedDuplicate: 0,
    errors: []
  };

  for (const row of tableRows) {
    try {
      // Extract publisher data from row
      const nameLink = row.querySelector('td a[href*="/profile/"]');
      if (!nameLink) continue;
      
      const publisherName = nameLink.textContent.trim();
      
      // Get partnerships count from 3rd column (index 2)
      const cells = row.querySelectorAll('td');
      let partnerships = 0;
      
      if (cells.length > 2) {
        const partnershipsCell = cells[2];
        const text = partnershipsCell.textContent.trim();
        partnerships = parseInt(text, 10);
        if (isNaN(partnerships)) partnerships = 0;
      }
      
      // Filter by quality threshold
      if (partnerships < PARTNERSHIP_THRESHOLD) {
        results.skippedLowQuality++;
        continue;
      }
      
      // Find and click the invite button
      const inviteBtn = row.querySelector('a.join[data-dwin-handler="invitePublisher"]');
      if (!inviteBtn) {
        results.errors.push({ publisher: publisherName, error: 'Invite button not found' });
        continue;
      }
      
      // Click to open modal
      inviteBtn.click();
      
      // Wait for modal to appear
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Fill message textarea
      const textarea = document.querySelector('textarea[aria-label*="Message"]') || 
                       document.querySelector('textarea');
      if (textarea) {
        textarea.value = message;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      // Select commission rate
      const commissionSelect = document.querySelector('select');
      if (commissionSelect) {
        // Find option with value "20"
        const option20 = Array.from(commissionSelect.querySelectorAll('option')).find(
          opt => opt.value === commissionValue
        );
        if (option20) {
          commissionSelect.value = commissionValue;
          commissionSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      
      // Wait a moment for form to update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Click Send Invite button
      const sendBtn = document.querySelector('button[type="submit"]') || 
                      Array.from(document.querySelectorAll('button')).find(
                        btn => btn.textContent.includes('Send')
                      );
      
      if (sendBtn) {
        sendBtn.click();
        
        // Wait for invite to be sent
        await new Promise(resolve => setTimeout(resolve, 800));
        
        results.total++;
        results.sent.push({
          name: publisherName,
          partnerships: partnerships,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      results.errors.push({
        error: error.message
      });
    }
  }

  return results;
}
