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
    agentStatus: "idle",
    agentReasonCode: "",
    agentNetworkIo: false,
    agentReady: false,
    agentAudioIngestStatus: "idle",
    agentAudioFramesObserved: 0,
    agentAudioBytesObserved: 0,
    agentAudioLastObservedAt: "",
    agentAudioReasonCode: "",
    agentSttProvider: "soniox",
    agentSttStatus: "idle",
    agentSttEnabled: false,
    agentSttNetworkIo: false,
    agentSttTranscriptsObserved: 0,
    agentSttLastTranscript: "",
    agentSttLastObservedAt: "",
    agentSttReasonCode: "",
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

    const { getAllByText, getByText, getByLabelText, queryByText } = render(<BrowserVoiceCall />);

    expect(getByText("Three voice lanes")).toBeTruthy();
    expect(getByText("GPT Realtime WebRTC")).toBeTruthy();
    expect(getByText("Pionero LiveKit realtime lane")).toBeTruthy();
    expect(getByText("Agent start-plan, ingest skeleton, and STT skeleton only; full AI loop is not running yet.")).toBeTruthy();
    expect(getByText("Agent start-plan status")).toBeTruthy();
    expect(getByText("Agent reason code")).toBeTruthy();
    expect(getByText("Agent network IO")).toBeTruthy();
    expect(getByText("Audio ingest status")).toBeTruthy();
    expect(getByText("Frames observed")).toBeTruthy();
    expect(getByText("Bytes observed")).toBeTruthy();
    expect(getAllByText("Last observed").length).toBeGreaterThanOrEqual(2);
    expect(getByText("Audio reason code")).toBeTruthy();
    expect(getByText("STT skeleton")).toBeTruthy();
    expect(getByText("Transcripts observed")).toBeTruthy();
    expect(getByText("Last transcript")).toBeTruthy();
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
      agentStatus: "planned",
      agentReasonCode: "livekit_room_client_not_configured",
      agentNetworkIo: false,
      agentReady: false,
      agentAudioIngestStatus: "audio_observed",
      agentAudioFramesObserved: 3,
      agentAudioBytesObserved: 1024,
      agentAudioLastObservedAt: "2026-01-02T03:04:05.000Z",
      agentAudioReasonCode: "audio_observed_for_test",
      agentSttProvider: "soniox",
      agentSttStatus: "transcript_observed",
      agentSttEnabled: true,
      agentSttNetworkIo: true,
      agentSttTranscriptsObserved: 2,
      agentSttLastTranscript: "Salam Pionero",
      agentSttLastObservedAt: "2026-01-02T03:04:06.000Z",
      agentSttReasonCode: "stt_transcript_for_test",
    });
    useBrowserVoiceCall.mockReturnValue(hook);
    usePioneroLiveKitRoom.mockReturnValue(pioneroHook);

    const { getByText } = render(<BrowserVoiceCall />);

    expect(getByText("planned (not ready)")).toBeTruthy();
    expect(getByText("livekit_room_client_not_configured")).toBeTruthy();
    expect(getByText("audio_observed")).toBeTruthy();
    expect(getByText("3")).toBeTruthy();
    expect(getByText("1024")).toBeTruthy();
    expect(getByText("2026-01-02T03:04:05.000Z")).toBeTruthy();
    expect(getByText("audio_observed_for_test")).toBeTruthy();
    expect(getByText("transcript_observed")).toBeTruthy();
    expect(getByText("Salam Pionero")).toBeTruthy();
    expect(getByText("2026-01-02T03:04:06.000Z")).toBeTruthy();
    expect(getByText("stt_transcript_for_test")).toBeTruthy();

    fireEvent.click(getByText("End GPT Realtime call"));
    expect(hook.stopCall).toHaveBeenCalledTimes(1);

    fireEvent.click(getByText("End Pionero realtime call"));
    expect(pioneroHook.disconnect).toHaveBeenCalledTimes(1);

    fireEvent.click(getByText("Stop speech bridge recording"));
    expect(hook.speechBridge.stopRecording).toHaveBeenCalledTimes(1);
  });
});
