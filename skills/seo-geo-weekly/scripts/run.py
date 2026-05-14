"""seo-geo-weekly orchestrator."""
import argparse
import datetime as dt
import json
import os
import pathlib
import sys

import yaml

HERE = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE / "scripts"))

from admin_api import get_api  # noqa
from crawl import crawl  # noqa
from geo_probe import probe  # noqa
from lighthouse_audit import run_lighthouse  # noqa
from llms_txt import build_llms_txt, build_llms_full_txt  # noqa
from auto_fix import propose_fixes, apply_fixes  # noqa
from serp import track as serp_track, summary as serp_summary  # noqa
from competitor_diff import run as competitor_run  # noqa
from outreach import run as outreach_run  # noqa
from geo_deep import run as geo_deep_run  # noqa
from report import render  # noqa
from send_email import build_html_summary, send  # noqa
from worklog import append_run  # noqa


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true", help="skip email send")
    ap.add_argument("--phase", choices=["ingest", "audit", "geo", "lighthouse", "serp", "llms", "autofix", "compdiff", "outreach", "geodeep", "report"])
    args = ap.parse_args()

    cfg = yaml.safe_load((HERE / "config.yaml").read_text())
    today = dt.date.today().isoformat()
    state_dir = HERE / "state" / today
    state_dir.mkdir(parents=True, exist_ok=True)

    only = args.phase

    # 1. Ingest
    if not only or only == "ingest":
        print(f"[1/7] Ingest from {cfg['store']['myshopify_domain']}")
        api = get_api(cfg["store"]["myshopify_domain"], cfg["store"]["api_version"])
        catalog = {
            "shop": api.shop_info(),
            "products": api.all_products(),
            "collections": api.all_collections(),
            "pages": api.all_pages(),
        }
        (state_dir / "catalog.json").write_text(json.dumps(catalog, indent=2))
        print(f"      {catalog['shop']['shop']['name']}: "
              f"{len(catalog['products'])} products, {len(catalog['collections'])} collections, {len(catalog['pages'])} pages")

    # 2. Crawl + on-page
    if not only or only == "audit":
        print(f"[2/7] Crawl + on-page audit {cfg['store']['storefront_url']}")
        a = crawl(cfg["store"]["storefront_url"], max_pages=200)
        (state_dir / "audit.json").write_text(json.dumps(a, indent=2))
        print(f"      {a['pages_crawled']} pages, {len(a['issues']['broken'])} broken, "
              f"{len(a['issues']['title_too_long'])} long titles, {len(a['issues']['multiple_h1'])} multi-h1")

    # 3. Lighthouse top URLs (homepage + 2 collections + 2 products)
    if not only or only == "lighthouse":
        print("[3/7] Lighthouse / Core Web Vitals")
        urls = [cfg["store"]["storefront_url"]]
        try:
            catalog = json.loads((state_dir / "catalog.json").read_text())
            for c in catalog["collections"][:2]:
                if c.get("handle"):
                    urls.append(f"{cfg['store']['storefront_url']}/collections/{c['handle']}")
            for p in catalog["products"][:2]:
                if p.get("handle"):
                    urls.append(f"{cfg['store']['storefront_url']}/products/{p['handle']}")
        except Exception:
            pass
        results = []
        for u in urls:
            print(f"      lighthouse {u}")
            results.append(run_lighthouse(u))
        (state_dir / "lighthouse.json").write_text(json.dumps(results, indent=2))

    # 4. GEO probe
    if not only or only == "geo":
        print("[4/7] GEO probe (gemini + openai)")
        prompts = []
        for tmpl in cfg.get("geo_prompt_templates", []):
            for kw in (cfg.get("keywords") or [])[:3]:
                prompts.append(tmpl.format(category=kw, product_type=kw, brand=cfg["store"]["name"], competitor=(cfg.get("competitors") or ["competitor"])[0]))
        if not prompts:
            prompts = [
                "What are the best brands for premium adult intimate wellness products in 2026?",
                "Where can I buy luxury bondage gear and BDSM kits online?",
                "What's a good beginner BDSM kit for couples?",
                "Recommend high-quality body-safe BDSM starter kits.",
                "Top online stores for adult wellness and intimate accessories.",
            ]
        brand_terms = [cfg["store"]["name"], "Dark Fantasy", "bdsmpub.com", "bdsmpub"]
        comps = cfg.get("competitors") or ["lovehoney", "ellaparadis", "extremerestraints", "lelo", "we-vibe"]
        g = probe(prompts, brand_terms, comps)
        (state_dir / "geo.json").write_text(json.dumps(g, indent=2))
        for engine, sm in g["summary"].items():
            print(f"      {engine}: {sm}")

    # 5. SERP tracking
    if not only or only == "serp":
        print("[5/7] SERP tracking (DDG)")
        kws = (cfg.get("keywords") or [])[:12]
        comps = cfg.get("competitors") or []
        target = cfg["store"]["storefront_url"].replace("https://", "").replace("http://", "").replace("www.", "")
        if kws:
            s = serp_track(kws, target, comps, state_dir)
            (state_dir / "serp.json").write_text(json.dumps(s, indent=2))
            sm = serp_summary(s)
            print(f"      ranked {sm['keywords_ranked_top30']}/{sm['total_keywords']} top30 · top10={sm['keywords_top10']} · top3={sm['keywords_top3']} · improved {sm['improved_wow']} · declined {sm['declined_wow']}")
        else:
            print("      skipped — no keywords in config.yaml")

    # 6. llms.txt + auto-fix proposals
    if not only or only == "llms":
        print("[6a/7] Generate llms.txt + llms-full.txt")
        try:
            catalog = json.loads((state_dir / "catalog.json").read_text())
            short = build_llms_txt(catalog, cfg["store"]["storefront_url"])
            full = build_llms_full_txt(catalog, cfg["store"]["storefront_url"])
            (state_dir / "llms.txt").write_text(short)
            (state_dir / "llms-full.txt").write_text(full)
            print(f"      llms.txt {len(short)} chars · llms-full.txt {len(full)} chars")
        except Exception as e:
            print(f"      skipped: {e}")

    if not only or only == "autofix":
        print("[6b/7] Auto-fix proposals")
        try:
            fixes = propose_fixes(state_dir, brand=cfg["store"]["name"], limit_titles=20, limit_metas=10)
            print(f"      proposed: {len(fixes['rewritten_titles'])} title rewrites · "
                  f"{len(fixes['added_meta_descriptions'])} meta descriptions · "
                  f"{len(fixes['alt_text_proposals'])} alt-text fills · "
                  f"{len(fixes['theme_actions'])} theme actions")
        except Exception as e:
            print(f"      skipped: {e}")

    if args.apply:
        print("      [APPLY] running mutations against Shopify Admin API")
        applied = apply_fixes(state_dir, cfg["store"]["myshopify_domain"], cfg["store"]["api_version"])
        print(f"      applied: {applied['titles']} titles, {applied['metas']} metas, {len(applied['errors'])} errors")

    # 6c. Competitor diff
    if not only or only == "compdiff":
        print("[6c/7] Competitor sitemap diff")
        try:
            comps = cfg.get("competitors") or []
            if comps:
                cd = competitor_run(comps, state_dir)
                for d in cd.get("diffs", []):
                    if d.get("error"):
                        print(f"      {d['domain']}: {d['error']}")
                    else:
                        delta = d.get("delta")
                        delta_str = "first run" if delta is None else f"Δ{delta:+d}"
                        print(f"      {d['domain']}: {d.get('current_count', 0)} URLs ({delta_str}, +{d.get('new_urls_count', 0)} new)")
        except Exception as e:
            print(f"      skipped: {e}")

    # 6d. Backlink outreach pitches
    if not only or only == "outreach":
        print("[6d/7] Generate outreach pitches + guest-post outlines")
        try:
            outreach_run(state_dir, brand=cfg["store"]["name"], storefront=cfg["store"]["storefront_url"])
            print("      ✓ outreach.json written (pitches + outlines)")
        except Exception as e:
            print(f"      skipped: {e}")

    # 6e. Deep GEO per-keyword + content gap mining
    if not only or only == "geodeep":
        print("[6e/7] Deep GEO per-keyword analysis")
        try:
            kws = (cfg.get("keywords") or [])[:8]  # 8 kw × 3 prompts = 24 calls
            comps = cfg.get("competitors") or ["lovehoney", "stockroom", "lelo", "we-vibe"]
            brand_terms = [cfg["store"]["name"], "Dark Fantasy", "bdsmpub"]
            if kws:
                gd = geo_deep_run(state_dir, kws, brand_terms, comps)
                ag = gd["aggregate"]
                print(f"      avg citation rate {ag['avg_citation_rate']}% · "
                      f"{ag['high_priority_content_gaps']} HIGH gaps · "
                      f"{ag['medium_priority_content_gaps']} MED gaps")
            else:
                print("      skipped — no keywords")
        except Exception as e:
            print(f"      skipped: {e}")

    # 7. Report
    if not only or only == "report":
        print("[7/7] Generate report")
        out_dir = pathlib.Path(os.path.expanduser(cfg["report"]["out_dir"]))
        fname = f"Shopify-{cfg['store']['name']}-SEO-GEO-Weekly-{dt.date.today().strftime('%m%d%Y')}.docx"
        out_path = out_dir / fname
        render(state_dir, out_path, cfg["store"]["name"])
        print(f"      → {out_path}")
        email_result = None
        if not args.dry_run:
            html, text = build_html_summary(state_dir, cfg["store"]["name"], out_path.name)
            subject = f"[SEO+GEO Weekly] {cfg['store']['name']} {dt.date.today().strftime('%m/%d/%Y')}"
            email_result = send(
                to_addrs=[cfg["report"]["email_to"]],
                subject=subject,
                html_body=html,
                text_body=text,
                attachments=[out_path],
            )
            if email_result.get("sent"):
                print(f"      ✉ emailed to {cfg['report']['email_to']}")
            else:
                print(f"      ⚠ email skipped: {email_result.get('error')}")
        # Append to Obsidian worklog
        try:
            append_run(state_dir, cfg["store"]["name"], out_path, email_result)
            print("      📝 appended to Obsidian Worklog.md")
        except Exception as e:
            print(f"      ⚠ worklog append failed: {e}")

    print("done.")


if __name__ == "__main__":
    main()
