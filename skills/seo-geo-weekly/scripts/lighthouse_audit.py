"""Run Lighthouse against top URLs, parse Core Web Vitals."""
import json
import subprocess
import tempfile
from pathlib import Path


def run_lighthouse(url: str, strategy: str = "mobile") -> dict:
    """Run lighthouse CLI and return parsed metrics."""
    flags = ["--chrome-flags=--headless --no-sandbox", "--quiet"]
    if strategy == "mobile":
        flags.append("--preset=desktop") if False else flags.append("--form-factor=mobile")

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tf:
        out = tf.name

    cmd = [
        "lighthouse", url,
        "--output=json", f"--output-path={out}",
        "--only-categories=performance,seo,accessibility,best-practices",
        "--chrome-flags=--headless --no-sandbox",
        "--quiet",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if proc.returncode != 0 or not Path(out).exists():
        return {"url": url, "error": (proc.stderr or "no output")[:200]}

    d = json.loads(Path(out).read_text())
    Path(out).unlink(missing_ok=True)

    cats = d.get("categories", {})
    a = d.get("audits", {})

    def score(c):
        s = cats.get(c, {}).get("score")
        return None if s is None else round(s * 100)

    def disp(k):
        return a.get(k, {}).get("displayValue")

    return {
        "url": url,
        "strategy": strategy,
        "scores": {
            "performance": score("performance"),
            "seo": score("seo"),
            "accessibility": score("accessibility"),
            "best_practices": score("best-practices"),
        },
        "vitals": {
            "lcp": disp("largest-contentful-paint"),
            "cls": disp("cumulative-layout-shift"),
            "tbt": disp("total-blocking-time"),
            "fcp": disp("first-contentful-paint"),
            "si": disp("speed-index"),
            "tti": disp("interactive"),
        },
        "opportunities": [
            {"title": v.get("title"), "savings_ms": v.get("details", {}).get("overallSavingsMs", 0)}
            for k, v in a.items()
            if v.get("scoreDisplayMode") == "metricSavings" and (v.get("score") or 1) < 0.9
        ][:10],
    }


def audit_top_urls(urls: list[str], max_urls: int = 5) -> list:
    return [run_lighthouse(u) for u in urls[:max_urls]]


if __name__ == "__main__":
    import sys
    print(json.dumps(run_lighthouse(sys.argv[1]), indent=2))
