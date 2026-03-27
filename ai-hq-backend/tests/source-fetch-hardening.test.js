import test from "node:test";
import assert from "node:assert/strict";

import { validatePublicFetchUrl } from "../src/utils/publicFetchSafety.js";
import { safeFetchText } from "../src/utils/http.js";
import { extractWebsiteSource } from "../src/services/sourceSync/websiteExtractor.js";

function publicDnsLookup() {
  return Promise.resolve([{ address: "93.184.216.34", family: 4 }]);
}

test("localhost URLs are denied before network access", async () => {
  const checked = await validatePublicFetchUrl("http://localhost");

  assert.equal(checked.ok, false);
  assert.equal(checked.reasonCode, "unsafe_hostname_localhost_denied");
});

test("private/internal IPv4 targets are denied", async () => {
  const checked = await validatePublicFetchUrl("http://192.168.1.25");

  assert.equal(checked.ok, false);
  assert.equal(checked.reasonCode, "unsafe_ip_private_denied");
});

test("metadata endpoints are denied", async () => {
  const checked = await validatePublicFetchUrl("http://169.254.169.254/latest/meta-data");

  assert.equal(checked.ok, false);
  assert.equal(checked.reasonCode, "unsafe_ip_link_local_denied");
});

test("non-http and non-https schemes are denied", async () => {
  const checked = await validatePublicFetchUrl("file:///etc/passwd");

  assert.equal(checked.ok, false);
  assert.equal(checked.reasonCode, "unsafe_scheme_denied");
});

test("unsafe redirects are denied hop-by-hop", async () => {
  let fetchCount = 0;

  const result = await safeFetchText("https://public.example", {
    dnsLookup: publicDnsLookup,
    fetchImpl: async (url) => {
      fetchCount += 1;

      if (url === "https://public.example/") {
        return {
          ok: false,
          status: 302,
          statusText: "Found",
          url,
          headers: new Headers({
            location: "http://127.0.0.1/admin",
          }),
          text: async () => "",
        };
      }

      throw new Error(`unexpected url: ${url}`);
    },
  });

  assert.equal(fetchCount, 1);
  assert.equal(result.ok, false);
  assert.equal(result.denied, true);
  assert.equal(result.error, "unsafe_ip_loopback_denied");
  assert.deepEqual(result.errorDetail?.redirectChain, [
    "https://public.example/",
    "http://127.0.0.1/admin",
  ]);
});

test("safe public URLs still pass the guarded fetch path", async () => {
  const result = await safeFetchText("https://public.example", {
    dnsLookup: publicDnsLookup,
    fetchImpl: async (url) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      url,
      headers: new Headers({
        "content-type": "text/html; charset=utf-8",
      }),
      text: async () => "<html><body>Hello</body></html>",
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.match(result.text, /Hello/);
});

test("website source extraction returns explicit unsafe-destination semantics", async () => {
  const result = await extractWebsiteSource({
    source_url: "http://localhost",
  });

  assert.equal(result.finalUrl, "http://localhost");
  assert.ok(Array.isArray(result.crawl?.warnings));
  assert.ok(result.crawl.warnings.includes("unsafe_hostname_localhost_denied"));
  assert.ok(result.crawl.warnings.includes("blocked_entry_fetch"));
});
