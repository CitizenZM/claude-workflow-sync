// scrape_helper.js — Browser-side JS to inject into Feishu chat tab
// User pastes this into DevTools console, calls window.__clawd.scrape()

window.__clawd = {
  messages: new Map(),

  capture() {
    const els = document.querySelectorAll('.js-message-item.message-item');
    let added = 0;
    for (const el of els) {
      const id = el.getAttribute('data-id') || el.id || el.getAttribute('data-message-id');
      if (!id) continue;
      if (this.messages.has(id)) continue;

      const text = el.textContent?.trim() || '';
      const isSelf = el.classList.contains('message-self') || el.classList.contains('message-from-self');
      const position = parseInt(el.getAttribute('data-position') || '0');

      // Parse "sender HH:MM content" pattern
      const timeMatch = text.match(/^([^0-9]+?)(\d{1,2}:\d{2})/);
      const sender = timeMatch ? timeMatch[1].trim() : '';
      const time = timeMatch ? timeMatch[2] : '';
      const cleanText = text.replace(/^[^0-9]*\d{1,2}:\d{2}/, '').replace(/展开$/, '').trim();

      const links = Array.from(el.querySelectorAll('a[href]')).map(a => a.href).slice(0, 5);
      const hasFile = !!el.querySelector('[class*="file"]');
      const hasImage = !!el.querySelector('img, [class*="image"]');

      this.messages.set(id, {
        id, position, sender, time, text: cleanText, isSelf,
        hasFile, hasImage, links, capturedAt: Date.now()
      });
      added++;
    }
    return { added, total: this.messages.size };
  },

  reset() { this.messages.clear(); },

  export() {
    return Array.from(this.messages.values()).sort((a,b) => a.position - b.position);
  },

  // Auto-scroll loop with capture between
  async autoScrape(maxScrolls = 50) {
    // Find scrollable msg container
    const items = document.querySelectorAll('.js-message-item');
    if (!items.length) return { error: 'no messages on page' };

    let scroller = items[0].parentElement;
    while (scroller) {
      const s = getComputedStyle(scroller);
      if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && scroller.clientHeight > 200) break;
      scroller = scroller.parentElement;
    }
    if (!scroller) return { error: 'no scroller found' };

    this.capture();
    let lastSize = this.messages.size;
    let stuck = 0;

    for (let i = 0; i < maxScrolls; i++) {
      // Try multiple methods to trigger lazy load
      scroller.scrollTo({ top: 0, behavior: 'instant' });
      scroller.dispatchEvent(new WheelEvent('wheel', { deltaY: -3000, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 1500));

      this.capture();
      console.log(`[clawd] scroll ${i+1}/${maxScrolls} | total: ${this.messages.size} | added: ${this.messages.size - lastSize}`);

      if (this.messages.size === lastSize) stuck++; else stuck = 0;
      if (stuck >= 5) { console.log('[clawd] stopped — no new messages after 5 scrolls'); break; }
      lastSize = this.messages.size;
    }

    return { captured: this.messages.size };
  }
};

console.log('🤖 Clawd scraper loaded. Use:');
console.log('  window.__clawd.capture()  — capture currently visible');
console.log('  window.__clawd.autoScrape(50)  — auto-scroll+capture (NOTE: requires real mouse for trusted events)');
console.log('  window.__clawd.export()  — get JSON');
console.log('  copy(JSON.stringify(window.__clawd.export()))  — copy to clipboard');
