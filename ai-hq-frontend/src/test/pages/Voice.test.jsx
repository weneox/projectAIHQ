import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Voice from "../../pages/Voice.jsx";
import { apiPost } from "../../api/client.js";
import {
  normalizeBrowserSpeechSynthesisResult,
  synthesizeBrowserSpeech,
  transcribeBrowserSpeech,
} from "../../api/voice.js";

vi.mock("../../api/client.js", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));
import {
  linkBrowserVoiceRealtimeSessionFromSdpResponse,
  normalizeRealtimeProviderCallId,
} from "../../pages/hooks/useBrowserVoiceCall.js";

import {
  arrayBufferToBase64,
  blobToBrowserSpeechPayload,
  transcribeBrowserAudioBlob,
} from "../../pages/hooks/useBrowserSpeechBridge.js";

describe("Voice", () => {
  beforeEach(() => {
    apiPost.mockReset();
  });

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
    const warn = vi.fn();
    const result = await linkBrowserVoiceRealtimeSessionFromSdpResponse({
      browserCallId: "voice-call-1",
      response: { headers: new Headers() },
      linkSession,
      warn,
    });

    expect(result.ok).toBe(true);
    expect(result.attempted).toBe(false);
    expect(result.reasonCode).toBe("provider_realtime_call_id_missing");
    expect(warn).toHaveBeenCalledWith("Browser voice realtime-link skipped", {
      reasonCode: "provider_realtime_call_id_missing",
    });
    expect(linkSession).not.toHaveBeenCalled();
  });

  it("does not crash when browserCallId is missing and records a warning", async () => {
    const linkSession = vi.fn();
    const warn = vi.fn();
    const result = await linkBrowserVoiceRealtimeSessionFromSdpResponse({
      browserCallId: "",
      response: {
        headers: new Headers({
          location: "/v1/realtime/calls/rtc_u7_abc",
        }),
      },
      linkSession,
      warn,
    });

    expect(result.ok).toBe(true);
    expect(result.attempted).toBe(false);
    expect(result.reasonCode).toBe("browser_voice_call_id_missing");
    expect(warn).toHaveBeenCalledWith("Browser voice realtime-link skipped", {
      reasonCode: "browser_voice_call_id_missing",
    });
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
  it("posts browser speech bridge API requests", async () => {
    apiPost
      .mockResolvedValueOnce({
        ok: true,
        version: "voice_speech_browser_bridge.v1",
        stage: "stt",
        text: "Salam",
        result: {
          ok: true,
          text: "Salam",
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        version: "voice_speech_browser_bridge.v1",
        stage: "tts",
        result: {
          ok: true,
          audioBase64: "ZmFrZS1hdWRpbw==",
          audioByteLength: 10,
          audioEncoding: "base64",
        },
      });

    const transcript = await transcribeBrowserSpeech({
      audioBase64: "ZmFrZS1hdWRpbw==",
      encoding: "base64",
      finalize: true,
    });

    expect(transcript.text).toBe("Salam");
    expect(apiPost).toHaveBeenNthCalledWith(1, "/api/voice/speech/browser/transcribe", {
      audioBase64: "ZmFrZS1hdWRpbw==",
      encoding: "base64",
      finalize: true,
    });

    const speech = await synthesizeBrowserSpeech({
      text: "Oldu.",
      streamId: "stream-test",
    });

    expect(speech.result.audioBase64).toBe("ZmFrZS1hdWRpbw==");
    expect(speech.result.audioByteLength).toBe(10);
    expect(speech.result.audioEncoding).toBe("base64");
    expect(apiPost).toHaveBeenNthCalledWith(2, "/api/voice/speech/browser/synthesize", {
      text: "Oldu.",
      streamId: "stream-test",
    });
  });

  it("fails closed before browser speech bridge API calls when required input is missing", async () => {
    await expect(transcribeBrowserSpeech({})).rejects.toThrow("audio is required");
    await expect(synthesizeBrowserSpeech({})).rejects.toThrow("text is required");

    expect(normalizeBrowserSpeechSynthesisResult({}).audioEncoding).toBe("base64");
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("converts browser audio blobs into speech bridge payloads", async () => {
    const blob = new Blob(["fake-audio"], { type: "audio/webm" });
    const payload = await blobToBrowserSpeechPayload(blob, { finalize: false });

    expect(payload.audioBase64).toBe("ZmFrZS1hdWRpbw==");
    expect(payload.encoding).toBe("base64");
    expect(payload.mimeType).toBe("audio/webm");
    expect(payload.audioByteLength).toBe(10);
    expect(payload.finalize).toBe(false);

    expect(arrayBufferToBase64(new TextEncoder().encode("ok"))).toBe("b2s=");
  });

  it("transcribes browser audio blobs through an injected speech client", async () => {
    const transcribe = vi.fn().mockResolvedValue({
      ok: true,
      text: "Salam",
    });

    const result = await transcribeBrowserAudioBlob(
      new Blob(["fake-audio"], { type: "audio/webm" }),
      { finalize: true },
      transcribe
    );

    expect(result.text).toBe("Salam");
    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(transcribe.mock.calls[0][0]).toEqual({
      audioBase64: "ZmFrZS1hdWRpbw==",
      encoding: "base64",
      mimeType: "audio/webm",
      audioByteLength: 10,
      finalize: true,
    });
  });

});
