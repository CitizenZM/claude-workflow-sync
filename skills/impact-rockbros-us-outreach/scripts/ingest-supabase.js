// Impact Rockbros US — Supabase ingest script
// Writes full publisher intel to:
//   pf.publishers          (upsert by publisher_id, built from network_partner_id + program_id)
//   pf.program_publishers  (upsert by program_id + publisher_id, records outreach event)
//   pf.publisher_intel     (insert new row per outreach event — full snapshot)
//
// Usage (called by outreach command after each batch):
//   node ingest-supabase.js '%%PUBLISHERS_JSON%%' '%%PROGRAM_ID%%' '%%DISCOVER_TAB%%'
//
// Or import and call ingestBatch(publishers, programId, discoverTab)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jjjyebydghflmuvumrfs.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqanllYnlkZ2hmbG11dnVtcmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ3MTUwNiwiZXhwIjoyMDkyMDQ3NTA2fQ.LRiyUdIsAtLm6sK4ybLpdz7Ce1nLg-_DoUV3xASuyxQ';

// Rockbros US program_id in pf.programs = 5
const PROGRAM_IDS = {
  '50132': 5,   // Rockbros US — Impact
  '48321': 3,   // TCL US — Impact (gyroor_us is 3, but TCL needs to be added if used)
};

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  db: { schema: 'pf' },
  auth: { persistSession: false },
});

// Build a stable publisher_id from network + partner_id
// Format: "impact-{partner_id}" or "impact-{program_slug}-{name_slug}" as fallback
const buildPublisherId = (pub, sourceNetworkProgramId) => {
  if (pub.network_partner_id || pub.partner_id) {
    return `impact-${pub.network_partner_id || pub.partner_id}`;
  }
  // Fallback: slug from name
  const slug = (pub.name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  return `impact-${sourceNetworkProgramId}-${slug}`;
};

// Extract country from corporate_address ("City, STATE United States of America" → "US")
const extractCountry = (address) => {
  if (!address) return null;
  if (address.includes('United States')) return 'US';
  if (address.includes('United Kingdom') || address.includes('England') || address.includes('Scotland')) return 'GB';
  if (address.includes('Canada')) return 'CA';
  if (address.includes('Australia')) return 'AU';
  if (address.includes('Germany') || address.includes('Deutschland')) return 'DE';
  return null;
};

// Extract US state from address
const extractState = (address) => {
  if (!address) return null;
  const m = address.match(/,\s+([A-Z]{2})\s+(United States|USA)/);
  return m ? m[1] : null;
};

export async function ingestBatch(publishers, sourceProgramId = '50132', discoverTab = 'CONTENT_REVIEWS') {
  const programId = PROGRAM_IDS[sourceProgramId] || null;
  const results = { inserted: 0, updated: 0, intelRows: 0, errors: [] };

  for (const pub of publishers) {
    if (!pub.name) continue;

    const publisherId = buildPublisherId(pub, sourceProgramId);
    const now = new Date().toISOString();
    const country = extractCountry(pub.corporate_address);
    const state = extractState(pub.corporate_address);

    // ── 1. Upsert pf.publishers ──────────────────────────────────────
    const publisherRow = {
      publisher_id:        publisherId,
      company:             pub.name,
      email:               pub.contact_email || null,
      website:             pub.website || null,
      country:             country,
      state:               state,
      // New extended fields
      network_partner_id:  pub.partner_id || pub.network_partner_id || null,
      contact_name:        pub.contact_name || null,
      contact_role:        pub.contact_role || null,
      status:              pub.status || null,
      partner_size:        pub.partner_size || null,
      business_model:      pub.business_model || null,
      description:         pub.description || null,
      language:            pub.language || null,
      corporate_address:   pub.corporate_address || null,
      content_categories:  pub.content_categories?.length ? pub.content_categories : [],
      legacy_categories:   pub.legacy_categories?.length ? pub.legacy_categories : [],
      niche_tags:          pub.tags?.length ? pub.tags : [],         // existing column
      media_kit_urls:      pub.media_kit_urls?.length ? pub.media_kit_urls : [],
      currency:            pub.currency || null,
      social_properties:   pub.social_properties?.length ? pub.social_properties : [],
      verified:            pub.verified ?? null,
      source_network:      'Impact',
      source_program_id:   sourceProgramId,
      scraped_at:          pub.scraped_at ? new Date(pub.scraped_at).toISOString() : now,
      updated_at:          now,
    };

    const { error: pubError } = await sb
      .from('publishers')
      .upsert(publisherRow, { onConflict: 'publisher_id' });

    if (pubError) {
      results.errors.push({ name: pub.name, step: 'publishers', error: pubError.message });
      continue;
    }
    results.updated++;

    // ── 2. Upsert pf.program_publishers ──────────────────────────────
    if (programId) {
      const ppRow = {
        program_id:       programId,
        publisher_id:     publisherId,
        status:           pub.status === 'Active' ? 'Joined' : 'Pending',
        join_date:        now,
        raw_join_date:    pub.scraped_at || now.slice(0, 10),
        // New outreach fields
        proposal_sent:    pub.proposal_sent ?? false,
        proposal_date:    pub.proposal_sent ? now : null,
        term_text:        pub.termText || pub.term_text || null,
        term_verified:    pub.termVerified ?? pub.term_verified ?? null,
        date_verified:    pub.dateVerified ?? pub.date_verified ?? null,
        outreach_channel: 'Impact',
        outreach_msg:     pub.outreach_msg || null,
        contract_date:    pub.contract_date || null,
        scraped_at:       pub.scraped_at ? new Date(pub.scraped_at).toISOString() : now,
      };

      const { error: ppError } = await sb
        .from('program_publishers')
        .upsert(ppRow, { onConflict: 'program_id,publisher_id' });

      if (ppError) {
        results.errors.push({ name: pub.name, step: 'program_publishers', error: ppError.message });
      }
    }

    // ── 3. Insert pf.publisher_intel (always new row per event) ──────
    const intelRow = {
      publisher_id:       publisherId,
      program_id:         programId,
      scraped_at:         pub.scraped_at ? new Date(pub.scraped_at).toISOString() : now,
      outreach_date:      pub.proposal_sent ? now : null,
      proposal_sent:      pub.proposal_sent ?? false,
      // Identity
      network_partner_id: pub.partner_id || pub.network_partner_id || null,
      company:            pub.name,
      status:             pub.status || null,
      partner_size:       pub.partner_size || null,
      business_model:     pub.business_model || null,
      // Description
      description:        pub.description || null,
      // Contact
      contact_name:       pub.contact_name || null,
      contact_role:       pub.contact_role || null,
      contact_email:      pub.contact_email || null,
      // Location
      language:           pub.language || null,
      corporate_address:  pub.corporate_address || null,
      country:            country,
      currency:           pub.currency || null,
      // Categories & tags
      content_categories: pub.content_categories || [],
      legacy_categories:  pub.legacy_categories || [],
      tags:               pub.tags || [],
      promotional_areas:  pub.promotional_areas || [],
      // Web
      website:            pub.website || null,
      learn_more_url:     pub.learn_more_url || null,
      social_properties:  pub.social_properties || [],
      verified:           pub.verified ?? null,
      // Media
      media_kit_urls:     pub.media_kit_urls || [],
      // Proposal
      term_text:          pub.termText || pub.term_text || null,
      term_verified:      pub.termVerified ?? pub.term_verified ?? null,
      date_verified:      pub.dateVerified ?? pub.date_verified ?? null,
      contract_date:      pub.contract_date || null,
      outreach_msg:       pub.outreach_msg || null,
      // Source
      source_network:     'Impact',
      source_program_id:  sourceProgramId,
      discover_tab:       discoverTab,
      // Full raw snapshot
      raw_json:           pub,
    };

    const { error: intelError } = await sb
      .from('publisher_intel')
      .insert(intelRow);

    if (intelError) {
      results.errors.push({ name: pub.name, step: 'publisher_intel', error: intelError.message });
    } else {
      results.intelRows++;
    }
  }

  return results;
}

// ── CLI entry point ────────────────────────────────────────────────────
if (process.argv[2]) {
  const publishers = JSON.parse(process.argv[2]);
  const programId  = process.argv[3] || '50132';
  const tab        = process.argv[4] || 'CONTENT_REVIEWS';

  const result = await ingestBatch(publishers, programId, tab);
  console.log(JSON.stringify({ ok: true, ...result }));
  process.exit(result.errors.length > 0 ? 1 : 0);
}
