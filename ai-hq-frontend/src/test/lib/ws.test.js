import { describe, expect, it } from "vitest";

import { __test__ } from "../../lib/ws.js";

describe("realtime local dev origin handling", () => {
  it("uses the local websocket proxy when browser origin is 127.0.0.1 and configured ws url is localhost", () => {
    expect(
      __test__.shouldUseDevProxyWs("ws://localhost:8080/ws", {
        dev: true,
        browserOrigin: "http://127.0.0.1:5173",
      })
    ).toBe(true);
  });

  it("builds a relative realtime session endpoint when using the local proxy", () => {
    expect(__test__.buildRealtimeSessionEndpoint()).toMatch(/\/api\/auth\/realtime-session$/);
  });
});
