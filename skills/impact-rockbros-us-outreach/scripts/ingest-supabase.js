// Impact Rockbros US — Supabase ingest script v2
//
// DATA FLOW (per publisher):
//   1. pf.publishers        — COALESCE upsert via pf.upsert_publisher()
//                             Never overwrites email/contact with NULL
//                             publisher_id = "impact-{network_partner_id}"
//   2. pf.program_publishers — upsert by (program_id=5, publisher_id)
//                              Records the outreach event
//   3. pf.publisher_intel   — INSERT new row every run (event log, never upserted)
//
// MERGE RULES:
//   - email, contact_name, contact_role: only written if non-null/non-empty
//   - arrays: only overwrite if new value is non-empty
//   - jsonb: only overwrite if new value is non-empty array
//   - scraped_at: only updated if newer than existing
//
// Usage:
//   node --input-type=module ingest-supabase.js '<PUBLISHERS_JSON>' '50132' 'CONTENT_REVIEWS'
//   OR import { ingestBatch } from './ingest-supabase.js'

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jjjyebydghflmuvumrfs.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqanllYnlkZ2hmbG11dnVtcmZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQ3MTUwNiwiZXhwIjoyMDkyMDQ3NTA2fQ.LRiyUdIsAtLm6sK4ybLpdz7Ce1nLg-_DoUV3xASuyxQ';

// program_id mapping (pf.programs table)
const PROGRAM_IDS = { '50132': 5 };  // Rockbros US

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  db: { schema: 'pf' },
  auth: { persistSession: false },
});

// Build stable publisher_id: "impact-{network_partner_id}"
const buildPublisherId = (pub, programId) => {
  const pid = pub.partner_id || pub.network_partner_id;
  if (pid) return `impact-${pid}`;
  const slug = (pub.name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  return `impact-${programId}-${slug}`;
};

// Extract country code from "City, STATE United States of America" pattern
const extractCountry = (addr) => {
  if (!addr) return null;
  if (addr.includes('United States') || addr.includes('USA')) return 'US';
  if (addr.includes('United Kingdom') || addr.includes('England')) return 'GB';
  if (addr.includes('Canada')) return 'CA';
  if (addr.includes('Australia')) return 'AU';
  if (addr.includes('Germany')) return 'DE';
  return null;
};

const extractState = (addr) => {
  if (!addr) return null;
  const m = addr.match(/,\s+([A-Z]{2})\s+(United States|USA)/);
  return m ? m[1] : null;
};

export async function ingestBatch(publishers, sourceProgramId = '50132', discoverTab = 'CONTENT_REVIEWS') {
  const programId = PROGRAM_IDS[sourceProgramId] || null;
  const results = { inserted: 0, updated: 0, intelRows: 0, errors: [] };
  const now = new Date().toISOString();

  for (const pub of publishers) {
    if (!pub.name) continue;

    const publisherId = buildPublisherId(pub, sourceProgramId);
    const country = extractCountry(pub.corporate_address);
    const state = extractState(pub.corporate_address);

    // ── 1. pf.publishers — COALESCE upsert via stored procedure ──────────
    // This NEVER overwrites existing email/contact_name/contact_role with null
    const publisherPayload = {
      publisher_id:          publisherId,
      company:               pub.name || null,
      // email maps to pf.publishers.email (the original column)
      email:                 pub.contact_email || null,
      website:               pub.website || null,
      state:                 state,
      country:               country,
      // Extended fields
      network_partner_id:    pub.partner_id || pub.network_partner_id || null,
      contact_name:          pub.contact_name || null,
      contact_role:          pub.contact_role || null,
      status:                pub.status || null,
      partner_size:          pub.partner_size || null,
      business_model:        pub.business_model || null,
      description:           pub.description || null,
      language:              pub.language || null,
      corporate_address:     pub.corporate_address || null,
      // Categories — use full expanded list if available
      content_categories:    pub.content_categories?.length ? pub.content_categories : [],
      legacy_categories:     pub.legacy_categories_full?.length ? pub.legacy_categories_full
                             : (pub.legacy_categories?.length ? pub.legacy_categories : []),
      legacy_categories_full: pub.legacy_categories_full?.length ? pub.legacy_categories_full : [],
      // Tags — use full expanded list if available
      niche_tags:            pub.tags_full?.length ? pub.tags_full
                             : (pub.tags?.length ? pub.tags : []),
      tags_full:             pub.tags_full?.length ? pub.tags_full : [],
      // JSON fields
      media_kit_urls:        pub.media_kit_urls?.length ? pub.media_kit_urls : [],
      currency:              pub.currency || null,
      social_properties:     pub.social_properties?.length ? pub.social_properties : [],
      verified:              pub.verified ?? null,
      all_contacts:          pub.all_contacts?.length ? pub.all_contacts : [],
      // Web metrics
      semrush_global_rank:   pub.semrush_global_rank || null,
      monthly_visitors:      pub.monthly_visitors || null,
      moz_spam_score:        pub.moz_spam_score || null,
      moz_domain_authority:  pub.moz_domain_authority || null,
      // Source
      source_network:        'Impact',
      source_program_id:     sourceProgramId,
      scraped_at:            pub.scraped_at || now,
    };

    // Call the COALESCE upsert stored procedure
    const { error: pubError } = await sb.rpc('upsert_publisher', { p: publisherPayload });

    if (pubError) {
      // Fallback to direct upsert on RPC failure
      const { error: fallbackError } = await sb
        .from('publishers')
        .upsert(publisherPayload, {
          onConflict: 'publisher_id',
          ignoreDuplicates: false,
        });
      if (fallbackError) {
        results.errors.push({ name: pub.name, step: 'publishers', error: fallbackError.message });
        continue;
      }
    }
    results.updated++;

    // ── 2. pf.program_publishers — outreach event ─────────────────────────
    if (programId) {
      const ppRow = {
        program_id:       programId,
        publisher_id:     publisherId,
        // Status: map publisher status to relationship status
        status:           pub.status === 'Active' ? 'Joined'
                          : pub.proposal_sent ? 'Pending'
                          : 'Pending',
        join_date:        now,
        raw_join_date:    (pub.scraped_at || now).slice(0, 10),
        proposal_sent:    pub.proposal_sent ?? false,
        proposal_date:    pub.proposal_sent ? now : null,
        term_text:        pub.termText || pub.term_text || null,
        term_verified:    pub.termVerified ?? pub.term_verified ?? null,
        date_verified:    pub.dateVerified ?? pub.date_verified ?? null,
        outreach_channel: 'Impact',
        outreach_msg:     pub.outreach_msg || null,
        contract_date:    pub.contract_date || null,
        scraped_at:       pub.scraped_at || now,
      };

      const { error: ppError } = await sb
        .from('program_publishers')
        .upsert(ppRow, { onConflict: 'program_id,publisher_id' });

      if (ppError) {
        results.errors.push({ name: pub.name, step: 'program_publishers', error: ppError.message });
      }
    }

    // ── 3. pf.publisher_intel — full snapshot (INSERT, never upsert) ─────
    const intelRow = {
      publisher_id:          publisherId,
      program_id:            programId,
      scraped_at:            pub.scraped_at ? new Date(pub.scraped_at).toISOString() : now,
      outreach_date:         pub.proposal_sent ? now : null,
      proposal_sent:         pub.proposal_sent ?? false,
      // Identity
      network_partner_id:    pub.partner_id || pub.network_partner_id || null,
      company:               pub.name,
      status:                pub.status || null,
      partner_size:          pub.partner_size || null,
      business_model:        pub.business_model || null,
      description:           pub.description || null,
      // Contact — these are the key fields
      contact_name:          pub.contact_name || null,
      contact_role:          pub.contact_role || null,
      contact_email:         pub.contact_email || null,
      // Location
      language:              pub.language || null,
      corporate_address:     pub.corporate_address || null,
      country:               country,
      currency:              pub.currency || null,
      // Categories
      content_categories:    pub.content_categories || [],
      legacy_categories:     pub.legacy_categories_full?.length ? pub.legacy_categories_full
                             : (pub.legacy_categories || []),
      tags:                  pub.tags_full?.length ? pub.tags_full : (pub.tags || []),
      promotional_areas:     pub.promotional_areas || [],
      // Web presence
      website:               pub.website || null,
      learn_more_url:        pub.learn_more_url || null,
      social_properties:     pub.social_properties || [],
      verified:              pub.verified ?? null,
      // Media
      media_kit_urls:        pub.media_kit_urls || [],
      // Proposal
      term_text:             pub.termText || pub.term_text || null,
      term_verified:         pub.termVerified ?? pub.term_verified ?? null,
      date_verified:         pub.dateVerified ?? pub.date_verified ?? null,
      contract_date:         pub.contract_date || null,
      outreach_msg:          pub.outreach_msg || null,
      // Additional intel
      all_contacts:          pub.all_contacts || [],
      legacy_categories_full: pub.legacy_categories_full || [],
      tags_full:             pub.tags_full || [],
      media_kit_count:       pub.media_kit_count || pub.media_kit_urls?.length || 0,
      semrush_global_rank:   pub.semrush_global_rank || null,
      monthly_visitors:      pub.monthly_visitors || null,
      moz_spam_score:        pub.moz_spam_score || null,
      moz_domain_authority:  pub.moz_domain_authority || null,
      // Source
      source_network:        'Impact',
      source_program_id:     sourceProgramId,
      discover_tab:          discoverTab,
      // Full snapshot
      raw_json:              pub,
    };

    const { error: intelError } = await sb.from('publisher_intel').insert(intelRow);

    if (intelError) {
      results.errors.push({ name: pub.name, step: 'publisher_intel', error: intelError.message });
    } else {
      results.intelRows++;
    }
  }

  return results;
}

// ── CLI entry point ────────────────────────────────────────────────────────
if (process.argv[2]) {
  const publishers = JSON.parse(process.argv[2]);
  const programId  = process.argv[3] || '50132';
  const tab        = process.argv[4] || 'CONTENT_REVIEWS';
  const result = await ingestBatch(publishers, programId, tab);
  console.log(JSON.stringify({ ok: true, ...result }));
  process.exit(result.errors.length > 0 ? 1 : 0);
}
