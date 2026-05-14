"""Shopify Admin GraphQL via Shopify CLI session (no raw token needed).

Run `shopify store auth --store <shop> --scopes <...>` once per 24h.
"""
import json
import subprocess


class AdminAPI:
    def __init__(self, shop_domain: str, api_version: str = "2026-04"):
        self.shop = shop_domain
        self.api_version = api_version

    def query(self, gql: str, variables: "dict | None" = None) -> dict:
        cmd = [
            "shopify", "store", "execute",
            "--store", self.shop,
            "--query", gql,
            "--version", self.api_version,
            "--json",
        ]
        if variables:
            cmd += ["--variables", json.dumps(variables)]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if proc.returncode != 0:
            raise RuntimeError(f"shopify CLI failed: {proc.stderr[:500]}")
        # CLI prints loading lines then JSON; extract last JSON block
        out = proc.stdout
        # Find first '{' on a line by itself
        start = out.find("\n{")
        if start < 0:
            start = out.find("{")
        if start < 0:
            raise RuntimeError(f"no JSON in output: {out[:300]}")
        return json.loads(out[start:].strip())

    def shop_info(self) -> dict:
        return self.query("""
          { shop { name myshopifyDomain primaryDomain { url host } currencyCode plan { displayName } } }
        """)

    def all_products(self, limit: int = 250) -> list:
        out, cursor = [], None
        gql = """
          query($cursor: String) {
            products(first: 100, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              nodes {
                id handle title status
                seo { title description }
                onlineStoreUrl tags productType vendor createdAt updatedAt
                images(first: 5) { nodes { altText url } }
                variants(first: 25) { nodes { id sku price } }
              }
            }
          }
        """
        while True:
            data = self.query(gql, {"cursor": cursor})
            page = data["products"]
            out.extend(page["nodes"])
            if not page["pageInfo"]["hasNextPage"] or len(out) >= limit:
                return out[:limit]
            cursor = page["pageInfo"]["endCursor"]

    def all_pages(self) -> list:
        gql = """
          { pages(first: 100) {
              nodes { id handle title createdAt updatedAt }
            } }
        """
        return self.query(gql)["pages"]["nodes"]

    def all_collections(self) -> list:
        gql = """
          { collections(first: 100) {
              nodes { id handle title seo { title description } updatedAt }
            } }
        """
        return self.query(gql)["collections"]["nodes"]


def get_api(shop_domain: str, api_version: str = "2026-04") -> AdminAPI:
    return AdminAPI(shop_domain, api_version)


if __name__ == "__main__":
    import sys
    api = get_api(sys.argv[1])
    print(json.dumps(api.shop_info(), indent=2))
