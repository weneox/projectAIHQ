import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BrowserVoiceCall from "../../pages/BrowserVoiceCall.jsx";
import useBrowserVoiceCall from "../../pages/hooks/useBrowserVoiceCall.js";
import usePioneroLiveKitRoom from "../../pages/hooks/usePioneroLiveKitRoom.js";
import { getVoiceSpeechGatewayReadiness } from "../../api/voice.js";

vi.mock("../../pages/hooks/useBrowserVoiceCall.js", () => ({
  default: vi.fn(),
}));

vi.mock("../../pages/hooks/usePioneroLiveKitRoom.js", () => ({
  default: vi.fn(),
}));

vi.mock("../../api/voice.js", () => ({
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

function buildPioneroHook(overrides = {}) {
  return {
    status: "idle",
    error: "",
    session: null,
    roomName: "",
    identity: "",
    participants: [],
    connect: vi.fn(),
    disconnect: vi.fn(),
    localMicEnabled: false,
    ...overrides,
  };
}

describe("BrowserVoiceCall", () => {
  beforeEach(() => {
    useBrowserVoiceCall.mockReset();
    usePioneroLiveKitRoom.mockReset();
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
    const pioneroHook = buildPioneroHook();
    useBrowserVoiceCall.mockReturnValue(hook);
    usePioneroLiveKitRoom.mockReturnValue(pioneroHook);

    const { getByText, getByLabelText, queryByText } = render(<BrowserVoiceCall />);

    expect(getByText("Three voice lanes")).toBeTruthy();
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

    fireEvent.click(getByText("Start Pionero realtime call"));
    expect(pioneroHook.connect).toHaveBeenCalledTimes(1);
    expect(queryByText("token-test")).toBeNull();

    fireEvent.click(getByText("Start speech bridge recording"));
    expect(hook.speechBridge.startRecording).toHaveBeenCalledTimes(1);

    fireEvent.click(getByText("Speak via speech bridge"));
    expect(hook.speechBridge.speakText).toHaveBeenCalledWith("Salam");

    fireEvent.click(getByText("Refresh readiness"));
    await waitFor(() => {
      expect(getVoiceSpeechGatewayReadiness).toHaveBeenCalledTimes(2);
    });
  });

  it("uses stop controls when voice lanes are active", () => {
    const hook = buildHook({
      status: "live",
      speechBridge: {
        ...buildHook().speechBridge,
        recording: true,
        status: "recording",
      },
    });
    const pioneroHook = buildPioneroHook({
      status: "live",
      roomName: "pionero-browser-test",
      identity: "user-test",
      participants: [{ identity: "agent-1" }],
      localMicEnabled: true,
    });
    useBrowserVoiceCall.mockReturnValue(hook);
    usePioneroLiveKitRoom.mockReturnValue(pioneroHook);

    const { getByText } = render(<BrowserVoiceCall />);

    fireEvent.click(getByText("End GPT Realtime call"));
    expect(hook.stopCall).toHaveBeenCalledTimes(1);

    fireEvent.click(getByText("End Pionero realtime call"));
    expect(pioneroHook.disconnect).toHaveBeenCalledTimes(1);

    fireEvent.click(getByText("Stop speech bridge recording"));
    expect(hook.speechBridge.stopRecording).toHaveBeenCalledTimes(1);
  });
});
