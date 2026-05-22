import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Voice from "../../pages/Voice.jsx";
import {
  linkBrowserVoiceRealtimeSessionFromSdpResponse,
  normalizeRealtimeProviderCallId,
} from "../../pages/hooks/useBrowserVoiceCall.js";

describe("Voice", () => {
  it("stays intentionally stripped while this legacy surface is frozen for v1", () => {
    const { container } = render(<Voice />);
    expect(container.innerHTML).toBe("");
  });

  it("links the browser realtime session after OpenAI returns an rtc Location header", async () => {
    const linkSession = vi.fn().mockResolvedValue({
      ok: true,
      sidebandLifecycle: { state: "ready" },
      sidebandRunner: { enabled: true, attempted: true },
    });
    const linkedRealtimeCallRef = { current: "" };

    const result = await linkBrowserVoiceRealtimeSessionFromSdpResponse({
      browserCallId: "voice-call-1",
      response: {
        headers: new Headers({
          location: "/v1/realtime/calls/rtc_u7_abc",
        }),
      },
      model: "gpt-realtime-1.5",
      voice: "coral",
      linkedRealtimeCallRef,
      linkSession,
      warn: vi.fn(),
    });

    expect(result.ok).toBe(true);
    expect(result.attempted).toBe(true);
    expect(linkSession).toHaveBeenCalledTimes(1);
    expect(linkSession).toHaveBeenCalledWith("voice-call-1", {
      provider: "openai",
      transport: "webrtc",
      providerRealtimeCallId: "rtc_u7_abc",
      locationHeader: "/v1/realtime/calls/rtc_u7_abc",
      model: "gpt-realtime-1.5",
      voice: "coral",
    });

    const duplicate = await linkBrowserVoiceRealtimeSessionFromSdpResponse({
      browserCallId: "voice-call-1",
      response: {
        headers: new Headers({
          Location: "/v1/realtime/calls/rtc_u7_abc",
        }),
      },
      linkedRealtimeCallRef,
      linkSession,
      warn: vi.fn(),
    });

    expect(duplicate.attempted).toBe(false);
    expect(duplicate.reasonCode).toBe("realtime_link_already_attempted");
    expect(linkSession).toHaveBeenCalledTimes(1);
  });

  it("does not crash or link when the OpenAI Location header is missing", async () => {
    const linkSession = vi.fn();
    const result = await linkBrowserVoiceRealtimeSessionFromSdpResponse({
      browserCallId: "voice-call-1",
      response: { headers: new Headers() },
      linkSession,
      warn: vi.fn(),
    });

    expect(result.ok).toBe(true);
    expect(result.attempted).toBe(false);
    expect(result.reasonCode).toBe("provider_realtime_call_id_missing");
    expect(linkSession).not.toHaveBeenCalled();
  });

  it("normalizes rtc provider ids from OpenAI realtime call locations", () => {
    expect(normalizeRealtimeProviderCallId("/v1/realtime/calls/rtc_u7_abc")).toBe(
      "rtc_u7_abc"
    );
    expect(
      normalizeRealtimeProviderCallId(
        "https://api.openai.com/v1/realtime/calls/rtc_full_url"
      )
    ).toBe("rtc_full_url");
  });
});
