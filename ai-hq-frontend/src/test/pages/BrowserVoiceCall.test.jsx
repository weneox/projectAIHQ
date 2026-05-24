import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BrowserVoiceCall from "../../pages/BrowserVoiceCall.jsx";
import useBrowserVoiceCall from "../../pages/hooks/useBrowserVoiceCall.js";
import {
  createPioneroLiveKitSession,
  getVoiceSpeechGatewayReadiness,
} from "../../api/voice.js";

vi.mock("../../pages/hooks/useBrowserVoiceCall.js", () => ({
  default: vi.fn(),
}));

vi.mock("../../api/voice.js", () => ({
  createPioneroLiveKitSession: vi.fn(),
  getVoiceSpeechGatewayReadiness: vi.fn(),
}));

function buildHook(overrides = {}) {
  return {
    status: "idle",
    error: "",
    voice: "coral",
    runtimeMeta: null,
    events: [],
    remoteAudioRef: { current: null },
    speechBridge: {
      available: true,
      error: "",
      mode: "speech_bridge",
      playbackStatus: "idle",
      recording: false,
      speakText: vi.fn(),
      startRecording: vi.fn(),
      status: "idle",
      stopRecording: vi.fn(),
      text: "Salam",
    },
    startCall: vi.fn(),
    stopCall: vi.fn(),
    ...overrides,
  };
}

describe("BrowserVoiceCall", () => {
  beforeEach(() => {
    useBrowserVoiceCall.mockReset();
    createPioneroLiveKitSession.mockReset();
    createPioneroLiveKitSession.mockResolvedValue({
      ok: true,
      version: "pionero_livekit_token.v1",
      provider: "livekit",
      configured: true,
      url: "wss://livekit.example.test",
      roomName: "pionero-browser-test",
      identity: "user-test",
      token: "token-test",
      pipeline: {
        transport: "livekit",
        stt: "soniox",
        llm: "fast_text_llm",
        tts: "cartesia",
      },
    });
    getVoiceSpeechGatewayReadiness.mockReset();
    getVoiceSpeechGatewayReadiness.mockResolvedValue({
      ok: true,
      version: "voice_speech_gateway_readiness.v1",
      runtimeApplied: false,
      runtimeReasonCode: "db_unavailable",
      gateway: {
        language: "az",
        providers: {
          stt: "soniox",
          tts: "soniox",
        },
        readiness: {
          liveInferenceReady: false,
          reasonCode: "speech_gateway_live_inference_not_implemented",
        },
      },
      soniox: {
        configured: true,
        reasonCode: "",
        stt: {
          ok: true,
        },
        tts: {
          ok: true,
        },
      },
    });
  });

  it("renders GPT Realtime and speech bridge test lanes together", async () => {
    const hook = buildHook();
    useBrowserVoiceCall.mockReturnValue(hook);

    const { getByText, getByLabelText } = render(<BrowserVoiceCall />);

    expect(getByText("GPT Realtime WebRTC")).toBeTruthy();
    expect(getByText("Pionero LiveKit realtime lane")).toBeTruthy();
    expect(getByText("Speech Bridge / Soniox lane")).toBeTruthy();
    expect(getByText("Soniox readiness")).toBeTruthy();
    expect(getByLabelText("Speech bridge text")).toBeTruthy();

    await waitFor(() => {
      expect(getVoiceSpeechGatewayReadiness).toHaveBeenCalledWith({
        language: "az",
        provider: "browser",
        sttProvider: "soniox",
        toNumber: "browser",
        ttsProvider: "soniox",
      });
    });

    fireEvent.click(getByText("Start GPT Realtime call"));
    expect(hook.startCall).toHaveBeenCalledTimes(1);

    fireEvent.click(getByText("Start speech bridge recording"));
    expect(hook.speechBridge.startRecording).toHaveBeenCalledTimes(1);

    fireEvent.click(getByText("Speak via speech bridge"));
    expect(hook.speechBridge.speakText).toHaveBeenCalledWith("Salam");

    fireEvent.click(getByText("Refresh readiness"));
    await waitFor(() => {
      expect(getVoiceSpeechGatewayReadiness).toHaveBeenCalledTimes(2);
    });
  });

  it("uses stop controls when both voice lanes are active", () => {
    const hook = buildHook({
      status: "live",
      speechBridge: {
        ...buildHook().speechBridge,
        recording: true,
        status: "recording",
      },
    });
    useBrowserVoiceCall.mockReturnValue(hook);

    const { getByText } = render(<BrowserVoiceCall />);

    fireEvent.click(getByText("End GPT Realtime call"));
    expect(hook.stopCall).toHaveBeenCalledTimes(1);

    fireEvent.click(getByText("Stop speech bridge recording"));
    expect(hook.speechBridge.stopRecording).toHaveBeenCalledTimes(1);
  });
});
