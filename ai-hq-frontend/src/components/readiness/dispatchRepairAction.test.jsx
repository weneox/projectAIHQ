import { describe, expect, it, vi } from "vitest";

import { dispatchRepairAction } from "./dispatchRepairAction.js";

describe("dispatchRepairAction", () => {
  it("routes safe route actions through window.location.assign", async () => {
    const assign = vi.fn();

    const result = await dispatchRepairAction(
      {
        kind: "route",
        allowed: true,
        target: {
          path: "/setup/runtime",
        },
      },
      {
        windowRef: {
          location: { assign },
        },
      }
    );

    expect(result.ok).toBe(true);
    expect(assign).toHaveBeenCalledWith("/setup/runtime");
  });

  it("executes oauth handlers for oauth repair actions", async () => {
    const assign = vi.fn();

    const result = await dispatchRepairAction(
      {
        id: "connect_meta_channel",
        kind: "oauth",
        allowed: true,
        target: {
          provider: "meta",
        },
      },
      {
        windowRef: {
          location: { assign },
        },
        oauthHandlers: {
          meta: vi.fn().mockResolvedValue("https://meta.example.test/connect"),
        },
      }
    );

    expect(result.ok).toBe(true);
    expect(assign).toHaveBeenCalledWith("https://meta.example.test/connect");
  });

  it("focuses local targets for focus actions", async () => {
    const scrollIntoView = vi.fn();
    const focus = vi.fn();
    const node = { scrollIntoView, focus };

    const result = await dispatchRepairAction(
      {
        id: "repair_voice_phone_number",
        kind: "focus",
        allowed: true,
        target: {
          panel: "voice",
          field: "twilioPhoneNumber",
        },
      },
      {
        focusTargets: {
          "voice.twilioPhoneNumber": node,
        },
      }
    );

    expect(result.ok).toBe(true);
    expect(scrollIntoView).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });
});
