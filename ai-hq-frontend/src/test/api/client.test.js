import { describe, expect, it } from "vitest";

import { __test__, apiUrl } from "../../api/client.js";

describe("api client local dev origin handling", () => {
  it("uses the local proxy when the browser origin is 127.0.0.1 and the configured api base is localhost", () => {
    expect(
      __test__.shouldUseDevProxyBase("http://localhost:8080", {
        dev: true,
        browserOrigin: "http://127.0.0.1:5173",
      })
    ).toBe(true);
  });

  it("does not force the local proxy when browser and api origin already match", () => {
    expect(
      __test__.shouldUseDevProxyBase("http://localhost:8080", {
        dev: true,
        browserOrigin: "http://localhost:8080",
      })
    ).toBe(false);
  });

  it("does not double-prefix api paths when local proxy mode is active", () => {
    expect(apiUrl("/api/auth/me")).toBe("/api/auth/me");
  });
});
