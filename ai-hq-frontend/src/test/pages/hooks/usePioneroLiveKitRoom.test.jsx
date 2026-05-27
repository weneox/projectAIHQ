import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockLiveKit = vi.hoisted(() => {
  const RoomEvent = {
    ParticipantConnected: "participantConnected",
    ParticipantDisconnected: "participantDisconnected",
  };
  const rooms = [];
  const createLocalAudioTrack = vi.fn();

  class MockRoom {
    constructor() {
      this.handlers = new Map();
      this.localParticipant = {
        publishTrack: vi.fn().mockResolvedValue({ ok: true }),
      };
      this.remoteParticipants = new Map();
      this.connect = vi.fn().mockResolvedValue(undefined);
      this.disconnect = vi.fn().mockResolvedValue(undefined);
    }

    on(eventName, handler) {
      const handlers = this.handlers.get(eventName) || new Set();
      handlers.add(handler);
      this.handlers.set(eventName, handlers);
      return this;
    }

    off(eventName, handler) {
      this.handlers.get(eventName)?.delete(handler);
      return this;
    }

    emit(eventName, participant) {
      this.handlers.get(eventName)?.forEach((handler) => handler(participant));
    }
  }

  const Room = vi.fn(function createMockRoom() {
    const room = new MockRoom();
    rooms.push(room);
    return room;
  });

  return {
    createLocalAudioTrack,
    Room,
    RoomEvent,
    rooms,
  };
});

vi.mock("livekit-client", () => ({
  Room: mockLiveKit.Room,
  RoomEvent: mockLiveKit.RoomEvent,
  createLocalAudioTrack: mockLiveKit.createLocalAudioTrack,
}));

import usePioneroLiveKitRoom, {
  readPioneroMonitorOnlyMode,
} from "../../../pages/hooks/usePioneroLiveKitRoom.js";

function buildSession(overrides = {}) {
  return {
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
    ...overrides,
  };
}

function buildAgentPlan(overrides = {}) {
  return {
    ok: true,
    version: "pionero_livekit_agent_runner.v1",
    provider: "livekit",
    status: "planned",
    networkIo: false,
    reasonCode: "livekit_room_client_not_configured",
    roomName: "pionero-browser-test",
    audioIngest: {
      enabled: false,
      status: "idle",
      framesObserved: 0,
      bytesObserved: 0,
      lastObservedAt: "",
      reasonCode: "livekit_room_client_not_configured",
    },
    stt: {
      provider: "soniox",
      enabled: false,
      status: "idle",
      transcriptsObserved: 0,
      lastTranscript: "",
      lastObservedAt: "",
      reasonCode: "stt_session_not_started",
      networkIo: false,
    },
    llm: {
      provider: "fast_text_llm",
      enabled: false,
      status: "planned",
      turnsPlanned: 0,
      lastInputTranscript: "",
      lastPlannedResponse: "",
      lastObservedAt: "",
      reasonCode: "llm_not_started",
      networkIo: false,
    },
    tts: {
      provider: "cartesia",
      enabled: false,
      status: "planned",
      speechPlansCreated: 0,
      synthesesAttempted: 0,
      synthesesSucceeded: 0,
      synthesesFailed: 0,
      audioByteLength: 0,
      audioChunkCount: 0,
      lastInputText: "",
      lastAudioPlan: "",
      lastObservedAt: "",
      reasonCode: "tts_not_started",
      networkIo: false,
    },
    readiness: {
      agentParticipantReady: false,
      reasonCode: "pionero_agent_runner_not_started",
    },
    ...overrides,
  };
}

function buildSynthesizedAgentPlan(overrides = {}) {
  return buildAgentPlan({
    status: "connected",
    tts: {
      provider: "soniox",
      enabled: true,
      status: "speech_synthesized",
      speechPlansCreated: 1,
      synthesesAttempted: 1,
      synthesesSucceeded: 1,
      synthesesFailed: 0,
      audioByteLength: 12,
      audioChunkCount: 1,
      lastInputText: "Salam",
      lastAudioPlan: "soniox_tts_audio_ready",
      lastObservedAt: "2026-01-02T03:04:08.000Z",
      reasonCode: "",
      networkIo: true,
    },
    ...overrides,
  });
}

function buildAgentAudioPayload(overrides = {}) {
  const audioBase64 = window.btoa("RIFFxxxxWAVE");

  return {
    ok: true,
    audioId: "agent-audio-1",
    audioBase64,
    audioByteLength: 12,
    audioChunkCount: 1,
    mimeType: "audio/wav",
    contentType: "audio/wav",
    audioFormat: "wav",
    sampleRateHz: 24000,
    synthesizedAt: "2026-01-02T03:04:08.000Z",
    ...overrides,
  };
}

function buildAgentAudioNotFoundError() {
  const err = new Error("pionero_agent_tts_audio_not_found");
  err.status = 404;
  err.code = "pionero_agent_tts_audio_not_found";
  err.payload = {
    error: "pionero_agent_tts_audio_not_found",
    reasonCode: "pionero_agent_tts_audio_not_found",
  };
  return err;
}

function stubAgentAudioPlayback({ play = vi.fn().mockResolvedValue(undefined) } = {}) {
  const originalCreateObjectURL = window.URL.createObjectURL;
  const originalRevokeObjectURL = window.URL.revokeObjectURL;
  const createdBlobs = [];
  const createObjectURL = vi.fn((blob) => {
    createdBlobs.push(blob);
    return `blob:pionero-agent-audio-${createdBlobs.length}`;
  });
  const revokeObjectURL = vi.fn();
  const pause = vi.fn();
  const AudioMock = vi.fn(function MockAudio() {
    return {
      onended: null,
      onerror: null,
      pause,
      play,
      preload: "",
      src: "",
    };
  });

  window.URL.createObjectURL = createObjectURL;
  window.URL.revokeObjectURL = revokeObjectURL;
  vi.stubGlobal("Audio", AudioMock);

  return {
    AudioMock,
    createObjectURL,
    createdBlobs,
    pause,
    play,
    revokeObjectURL,
    restore() {
      if (originalCreateObjectURL) {
        window.URL.createObjectURL = originalCreateObjectURL;
      } else {
        delete window.URL.createObjectURL;
      }

      if (originalRevokeObjectURL) {
        window.URL.revokeObjectURL = originalRevokeObjectURL;
      } else {
        delete window.URL.revokeObjectURL;
      }

      vi.unstubAllGlobals();
    },
  };
}

async function flushPromises() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("usePioneroLiveKitRoom", () => {
  beforeEach(() => {
    mockLiveKit.rooms.length = 0;
    mockLiveKit.Room.mockClear();
    mockLiveKit.createLocalAudioTrack.mockReset();
    window.history.replaceState({}, "", "/");
    window.localStorage.clear();
  });

  it("creates a Pionero LiveKit session, connects the room, and publishes mic audio", async () => {
    const localMicTrack = { stop: vi.fn() };
    const createPioneroLiveKitSession = vi.fn().mockResolvedValue(buildSession());
    const startPioneroLiveKitAgentPlan = vi
      .fn()
      .mockResolvedValue(
        buildAgentPlan({
          apiSecret: "agent-secret-test",
          token: "agent-token-test",
          rawAudio: "raw-audio-secret",
          audioIngest: {
            enabled: true,
            status: "audio_observed",
            framesObserved: 2,
            bytesObserved: 512,
            lastObservedAt: "2026-01-02T03:04:05.000Z",
            reasonCode: "",
            rawAudio: "nested-raw-audio-secret",
            token: "nested-agent-token-test",
          },
          stt: {
            provider: "soniox",
            enabled: true,
            status: "transcript_observed",
            transcriptsObserved: 1,
            lastTranscript: "Salam Pionero",
            lastObservedAt: "2026-01-02T03:04:06.000Z",
            reasonCode: "",
            networkIo: true,
            rawAudio: "stt-raw-audio-secret",
            token: "stt-agent-token-test",
            apiSecret: "stt-agent-secret-test",
          },
          llm: {
            provider: "fast_text_llm",
            enabled: true,
            status: "turn_plan_built",
            turnsPlanned: 1,
            lastInputTranscript: "Salam Pionero",
            lastPlannedResponse: "Turn plan pending real LLM.",
            lastObservedAt: "2026-01-02T03:04:07.000Z",
            reasonCode: "",
            networkIo: false,
            rawAudio: "llm-raw-audio-secret",
            token: "llm-agent-token-test",
            apiSecret: "llm-agent-secret-test",
          },
          tts: {
            provider: "cartesia",
            enabled: true,
            status: "speech_plan_built",
            speechPlansCreated: 1,
            lastInputText: "Turn plan pending real LLM.",
            lastAudioPlan: "TTS plan pending real synthesis.",
            lastObservedAt: "2026-01-02T03:04:08.000Z",
            reasonCode: "",
            networkIo: false,
            rawAudio: "tts-raw-audio-secret",
            token: "tts-agent-token-test",
            apiSecret: "tts-agent-secret-test",
          },
        })
      );
    mockLiveKit.createLocalAudioTrack.mockResolvedValue(localMicTrack);

    const { result } = renderHook(() =>
      usePioneroLiveKitRoom({
        createPioneroLiveKitSession,
        startPioneroLiveKitAgentPlan,
      })
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(createPioneroLiveKitSession).toHaveBeenCalledWith({
      roomName: "pionero-browser-test",
      mode: "pionero_realtime_agent",
      transport: "livekit",
      sttProvider: "soniox",
      llmProvider: "fast_text_llm",
      ttsProvider: "cartesia",
    });

    const room = mockLiveKit.rooms[0];
    expect(mockLiveKit.Room).toHaveBeenCalledTimes(1);
    expect(room.connect).toHaveBeenCalledWith(
      "wss://livekit.example.test",
      "token-test"
    );
    expect(startPioneroLiveKitAgentPlan).toHaveBeenCalledWith({
      roomName: "pionero-browser-test",
    });
    expect(startPioneroLiveKitAgentPlan.mock.invocationCallOrder[0]).toBeLessThan(
      room.connect.mock.invocationCallOrder[0]
    );
    expect(mockLiveKit.createLocalAudioTrack).toHaveBeenCalledTimes(1);
    expect(room.localParticipant.publishTrack).toHaveBeenCalledWith(localMicTrack, {
      source: "microphone",
    });
    expect(result.current.status).toBe("live");
    expect(result.current.roomName).toBe("pionero-browser-test");
    expect(result.current.identity).toBe("user-test");
    expect(result.current.localMicEnabled).toBe(true);
    expect(result.current.agentStatus).toBe("planned");
    expect(result.current.agentReasonCode).toBe(
      "livekit_room_client_not_configured"
    );
    expect(result.current.agentNetworkIo).toBe(false);
    expect(result.current.agentReady).toBe(false);
    expect(result.current.agentAudioIngestStatus).toBe("audio_observed");
    expect(result.current.agentAudioFramesObserved).toBe(2);
    expect(result.current.agentAudioBytesObserved).toBe(512);
    expect(result.current.agentAudioLastObservedAt).toBe(
      "2026-01-02T03:04:05.000Z"
    );
    expect(result.current.agentAudioReasonCode).toBe("");
    expect(result.current.agentSttProvider).toBe("soniox");
    expect(result.current.agentSttStatus).toBe("transcript_observed");
    expect(result.current.agentSttEnabled).toBe(true);
    expect(result.current.agentSttNetworkIo).toBe(true);
    expect(result.current.agentSttTranscriptsObserved).toBe(1);
    expect(result.current.agentSttLastTranscript).toBe("Salam Pionero");
    expect(result.current.agentSttLastObservedAt).toBe(
      "2026-01-02T03:04:06.000Z"
    );
    expect(result.current.agentSttReasonCode).toBe("");
    expect(result.current.agentLlmProvider).toBe("fast_text_llm");
    expect(result.current.agentLlmStatus).toBe("turn_plan_built");
    expect(result.current.agentLlmEnabled).toBe(true);
    expect(result.current.agentLlmNetworkIo).toBe(false);
    expect(result.current.agentLlmTurnsPlanned).toBe(1);
    expect(result.current.agentLlmLastInputTranscript).toBe("Salam Pionero");
    expect(result.current.agentLlmLastPlannedResponse).toBe(
      "Turn plan pending real LLM."
    );
    expect(result.current.agentLlmLastObservedAt).toBe(
      "2026-01-02T03:04:07.000Z"
    );
    expect(result.current.agentLlmReasonCode).toBe("");
    expect(result.current.agentTtsProvider).toBe("cartesia");
    expect(result.current.agentTtsStatus).toBe("speech_plan_built");
    expect(result.current.agentTtsEnabled).toBe(true);
    expect(result.current.agentTtsNetworkIo).toBe(false);
    expect(result.current.agentTtsSpeechPlansCreated).toBe(1);
    expect(result.current.agentTtsLastInputText).toBe("Turn plan pending real LLM.");
    expect(result.current.agentTtsLastAudioPlan).toBe(
      "TTS plan pending real synthesis."
    );
    expect(result.current.agentTtsLastObservedAt).toBe(
      "2026-01-02T03:04:08.000Z"
    );
    expect(result.current.agentTtsReasonCode).toBe("");
    expect(result.current.session.token).toBeUndefined();
    expect(JSON.stringify(result.current.session)).not.toContain("token-test");
    expect(JSON.stringify(result.current)).not.toContain("agent-token-test");
    expect(JSON.stringify(result.current)).not.toContain("agent-secret-test");
    expect(JSON.stringify(result.current)).not.toContain("raw-audio-secret");
    expect(JSON.stringify(result.current)).not.toContain("nested-raw-audio-secret");
    expect(JSON.stringify(result.current)).not.toContain("nested-agent-token-test");
    expect(JSON.stringify(result.current)).not.toContain("stt-raw-audio-secret");
    expect(JSON.stringify(result.current)).not.toContain("stt-agent-token-test");
    expect(JSON.stringify(result.current)).not.toContain("stt-agent-secret-test");
    expect(JSON.stringify(result.current)).not.toContain("llm-raw-audio-secret");
    expect(JSON.stringify(result.current)).not.toContain("llm-agent-token-test");
    expect(JSON.stringify(result.current)).not.toContain("llm-agent-secret-test");
    expect(JSON.stringify(result.current)).not.toContain("tts-raw-audio-secret");
    expect(JSON.stringify(result.current)).not.toContain("tts-agent-token-test");
    expect(JSON.stringify(result.current)).not.toContain("tts-agent-secret-test");
  });

  it("skips backend agent start-plan in query-enabled monitor-only mode while publishing mic", async () => {
    window.history.pushState({}, "", "/voice-assistant?pioneroMonitor=1");
    const localMicTrack = { stop: vi.fn() };
    const createPioneroLiveKitSession = vi.fn().mockResolvedValue(
      buildSession({
        apiSecret: "session-api-secret-test",
        rawAudio: "session-raw-audio-secret",
      })
    );
    const startPioneroLiveKitAgentPlan = vi
      .fn()
      .mockResolvedValue(buildAgentPlan());
    const stopPioneroLiveKitAgentPlan = vi
      .fn()
      .mockResolvedValue(buildAgentPlan({ status: "stopped" }));
    mockLiveKit.createLocalAudioTrack.mockResolvedValue(localMicTrack);

    const { result } = renderHook(() =>
      usePioneroLiveKitRoom({
        createPioneroLiveKitSession,
        startPioneroLiveKitAgentPlan,
        stopPioneroLiveKitAgentPlan,
      })
    );

    expect(readPioneroMonitorOnlyMode()).toBe(true);

    await act(async () => {
      await result.current.connect();
    });

    const room = mockLiveKit.rooms[0];
    expect(room.connect).toHaveBeenCalledWith(
      "wss://livekit.example.test",
      "token-test"
    );
    expect(mockLiveKit.createLocalAudioTrack).toHaveBeenCalledTimes(1);
    expect(room.localParticipant.publishTrack).toHaveBeenCalledWith(localMicTrack, {
      source: "microphone",
    });
    expect(startPioneroLiveKitAgentPlan).not.toHaveBeenCalled();
    expect(result.current.status).toBe("live");
    expect(result.current.localMicEnabled).toBe(true);
    expect(result.current.monitorOnlyMode).toBe(true);
    expect(result.current.agentStatus).toBe("monitor_only");
    expect(result.current.agentReasonCode).toBe(
      "pionero_monitor_only_browser_publish"
    );
    expect(result.current.agentNetworkIo).toBe(false);
    expect(result.current.agentReady).toBe(false);
    expect(result.current.agentAudioIngestStatus).toBe("idle");
    expect(result.current.agentSttStatus).toBe("idle");
    expect(result.current.agentLlmStatus).toBe("planned");
    expect(result.current.agentTtsStatus).toBe("planned");
    expect(result.current.session.token).toBeUndefined();
    expect(result.current.session.apiSecret).toBeUndefined();
    expect(result.current.session.rawAudio).toBeUndefined();
    expect(JSON.stringify(result.current.session)).not.toContain("token-test");
    expect(JSON.stringify(result.current)).not.toContain(
      "session-api-secret-test"
    );
    expect(JSON.stringify(result.current)).not.toContain(
      "session-raw-audio-secret"
    );

    await act(async () => {
      await result.current.disconnect();
    });

    expect(stopPioneroLiveKitAgentPlan).not.toHaveBeenCalled();
    expect(room.disconnect).toHaveBeenCalledTimes(1);
    expect(localMicTrack.stop).toHaveBeenCalledTimes(1);
  });

  it("skips backend agent start-plan when localStorage enables monitor-only mode", async () => {
    window.localStorage.setItem("PIONERO_LIVEKIT_MONITOR_ONLY", "true");
    const localMicTrack = { stop: vi.fn() };
    const createPioneroLiveKitSession = vi.fn().mockResolvedValue(buildSession());
    const startPioneroLiveKitAgentPlan = vi
      .fn()
      .mockResolvedValue(buildAgentPlan());
    mockLiveKit.createLocalAudioTrack.mockResolvedValue(localMicTrack);

    const { result } = renderHook(() =>
      usePioneroLiveKitRoom({
        createPioneroLiveKitSession,
        startPioneroLiveKitAgentPlan,
      })
    );

    expect(readPioneroMonitorOnlyMode()).toBe(true);

    await act(async () => {
      await result.current.connect();
    });

    const room = mockLiveKit.rooms[0];
    expect(room.connect).toHaveBeenCalledWith(
      "wss://livekit.example.test",
      "token-test"
    );
    expect(room.localParticipant.publishTrack).toHaveBeenCalledWith(localMicTrack, {
      source: "microphone",
    });
    expect(startPioneroLiveKitAgentPlan).not.toHaveBeenCalled();
    expect(result.current.status).toBe("live");
    expect(result.current.monitorOnlyMode).toBe(true);
    expect(result.current.agentStatus).toBe("monitor_only");
  });

  it("uses safe default STT values when the agent start-plan omits STT state", async () => {
    const createPioneroLiveKitSession = vi.fn().mockResolvedValue(buildSession());
    const startPioneroLiveKitAgentPlan = vi
      .fn()
      .mockResolvedValue(buildAgentPlan({ stt: undefined }));
    mockLiveKit.createLocalAudioTrack.mockResolvedValue({ stop: vi.fn() });

    const { result } = renderHook(() =>
      usePioneroLiveKitRoom({
        createPioneroLiveKitSession,
        startPioneroLiveKitAgentPlan,
      })
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.agentSttProvider).toBe("soniox");
    expect(result.current.agentSttStatus).toBe("idle");
    expect(result.current.agentSttEnabled).toBe(false);
    expect(result.current.agentSttNetworkIo).toBe(false);
    expect(result.current.agentSttTranscriptsObserved).toBe(0);
    expect(result.current.agentSttLastTranscript).toBe("");
    expect(result.current.agentSttLastObservedAt).toBe("");
    expect(result.current.agentSttReasonCode).toBe("");
  });

  it("uses safe default TTS values when the agent start-plan omits TTS state", async () => {
    const createPioneroLiveKitSession = vi.fn().mockResolvedValue(buildSession());
    const startPioneroLiveKitAgentPlan = vi
      .fn()
      .mockResolvedValue(buildAgentPlan({ tts: undefined }));
    mockLiveKit.createLocalAudioTrack.mockResolvedValue({ stop: vi.fn() });

    const { result } = renderHook(() =>
      usePioneroLiveKitRoom({
        createPioneroLiveKitSession,
        startPioneroLiveKitAgentPlan,
      })
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.agentTtsProvider).toBe("cartesia");
    expect(result.current.agentTtsStatus).toBe("idle");
    expect(result.current.agentTtsEnabled).toBe(false);
    expect(result.current.agentTtsNetworkIo).toBe(false);
    expect(result.current.agentTtsSpeechPlansCreated).toBe(0);
    expect(result.current.agentTtsLastInputText).toBe("");
    expect(result.current.agentTtsLastAudioPlan).toBe("");
    expect(result.current.agentTtsLastObservedAt).toBe("");
    expect(result.current.agentTtsReasonCode).toBe("");
  });

  it("uses safe default LLM values when the agent start-plan omits LLM state", async () => {
    const createPioneroLiveKitSession = vi.fn().mockResolvedValue(buildSession());
    const startPioneroLiveKitAgentPlan = vi
      .fn()
      .mockResolvedValue(buildAgentPlan({ llm: undefined }));
    mockLiveKit.createLocalAudioTrack.mockResolvedValue({ stop: vi.fn() });

    const { result } = renderHook(() =>
      usePioneroLiveKitRoom({
        createPioneroLiveKitSession,
        startPioneroLiveKitAgentPlan,
      })
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.agentLlmProvider).toBe("fast_text_llm");
    expect(result.current.agentLlmStatus).toBe("idle");
    expect(result.current.agentLlmEnabled).toBe(false);
    expect(result.current.agentLlmNetworkIo).toBe(false);
    expect(result.current.agentLlmTurnsPlanned).toBe(0);
    expect(result.current.agentLlmLastInputTranscript).toBe("");
    expect(result.current.agentLlmLastPlannedResponse).toBe("");
    expect(result.current.agentLlmLastObservedAt).toBe("");
    expect(result.current.agentLlmReasonCode).toBe("");
  });

  it("updates participants from LiveKit room events", async () => {
    const createPioneroLiveKitSession = vi.fn().mockResolvedValue(buildSession());
    const startPioneroLiveKitAgentPlan = vi
      .fn()
      .mockResolvedValue(buildAgentPlan());
    mockLiveKit.createLocalAudioTrack.mockResolvedValue({ stop: vi.fn() });

    const { result } = renderHook(() =>
      usePioneroLiveKitRoom({
        createPioneroLiveKitSession,
        startPioneroLiveKitAgentPlan,
      })
    );

    await act(async () => {
      await result.current.connect();
    });

    const room = mockLiveKit.rooms[0];
    const participant = {
      identity: "agent-1",
      name: "Pionero Agent",
      sid: "sid-agent",
    };

    act(() => {
      room.remoteParticipants.set(participant.identity, participant);
      room.emit(mockLiveKit.RoomEvent.ParticipantConnected, participant);
    });

    expect(result.current.participants).toEqual([participant]);

    act(() => {
      room.remoteParticipants.delete(participant.identity);
      room.emit(mockLiveKit.RoomEvent.ParticipantDisconnected, participant);
    });

    expect(result.current.participants).toEqual([]);
  });

  it("disconnects the room, stops the mic track, stops backend runtime, and clears room state", async () => {
    const localMicTrack = { stop: vi.fn() };
    const createPioneroLiveKitSession = vi.fn().mockResolvedValue(buildSession());
    const startPioneroLiveKitAgentPlan = vi
      .fn()
      .mockResolvedValue(buildAgentPlan());
    const stopPioneroLiveKitAgentPlan = vi
      .fn()
      .mockResolvedValue(buildAgentPlan({ status: "stopped" }));
    mockLiveKit.createLocalAudioTrack.mockResolvedValue(localMicTrack);

    const { result } = renderHook(() =>
      usePioneroLiveKitRoom({
        createPioneroLiveKitSession,
        startPioneroLiveKitAgentPlan,
        stopPioneroLiveKitAgentPlan,
      })
    );

    await act(async () => {
      await result.current.connect();
    });

    const room = mockLiveKit.rooms[0];

    await act(async () => {
      await result.current.disconnect();
    });

    expect(room.disconnect).toHaveBeenCalledTimes(1);
    expect(localMicTrack.stop).toHaveBeenCalledTimes(1);
    expect(stopPioneroLiveKitAgentPlan).toHaveBeenCalledWith({
      roomName: "pionero-browser-test",
    });
    expect(result.current.status).toBe("idle");
    expect(result.current.roomName).toBe("");
    expect(result.current.identity).toBe("");
    expect(result.current.participants).toEqual([]);
    expect(result.current.localMicEnabled).toBe(false);
    expect(result.current.agentStatus).toBe("idle");
    expect(result.current.agentReasonCode).toBe("");
    expect(result.current.agentNetworkIo).toBe(false);
    expect(result.current.agentReady).toBe(false);
    expect(result.current.agentAudioIngestStatus).toBe("idle");
    expect(result.current.agentAudioFramesObserved).toBe(0);
    expect(result.current.agentAudioBytesObserved).toBe(0);
    expect(result.current.agentAudioLastObservedAt).toBe("");
    expect(result.current.agentAudioReasonCode).toBe("");
    expect(result.current.agentSttProvider).toBe("soniox");
    expect(result.current.agentSttStatus).toBe("idle");
    expect(result.current.agentSttEnabled).toBe(false);
    expect(result.current.agentSttNetworkIo).toBe(false);
    expect(result.current.agentSttTranscriptsObserved).toBe(0);
    expect(result.current.agentSttLastTranscript).toBe("");
    expect(result.current.agentSttLastObservedAt).toBe("");
    expect(result.current.agentSttReasonCode).toBe("");
    expect(result.current.agentLlmProvider).toBe("fast_text_llm");
    expect(result.current.agentLlmStatus).toBe("idle");
    expect(result.current.agentLlmEnabled).toBe(false);
    expect(result.current.agentLlmNetworkIo).toBe(false);
    expect(result.current.agentLlmTurnsPlanned).toBe(0);
    expect(result.current.agentLlmLastInputTranscript).toBe("");
    expect(result.current.agentLlmLastPlannedResponse).toBe("");
    expect(result.current.agentLlmLastObservedAt).toBe("");
    expect(result.current.agentLlmReasonCode).toBe("");
  });

  it("refreshes backend runtime status for the active Pionero room", async () => {
    const createPioneroLiveKitSession = vi.fn().mockResolvedValue(buildSession());
    const getPioneroLiveKitAgentStatus = vi.fn().mockResolvedValue(
      buildAgentPlan({
        status: "connected",
        networkIo: true,
        reasonCode: "",
        readiness: {
          agentParticipantReady: true,
          reasonCode: "",
        },
        audioIngest: {
          enabled: true,
          status: "waiting_for_audio",
          framesObserved: 0,
          bytesObserved: 0,
          lastObservedAt: "",
          reasonCode: "",
        },
      })
    );
    const startPioneroLiveKitAgentPlan = vi
      .fn()
      .mockResolvedValue(buildAgentPlan());
    mockLiveKit.createLocalAudioTrack.mockResolvedValue({ stop: vi.fn() });

    const { result } = renderHook(() =>
      usePioneroLiveKitRoom({
        createPioneroLiveKitSession,
        getPioneroLiveKitAgentStatus,
        startPioneroLiveKitAgentPlan,
      })
    );

    await act(async () => {
      await result.current.connect();
    });

    await act(async () => {
      const refreshResult = await result.current.refreshAgentStatus();
      expect(refreshResult).toEqual({
        ok: true,
        status: "connected",
      });
    });

    expect(getPioneroLiveKitAgentStatus).toHaveBeenCalledWith({
      roomName: "pionero-browser-test",
    });
    expect(result.current.agentStatus).toBe("connected");
    expect(result.current.agentNetworkIo).toBe(true);
    expect(result.current.agentReady).toBe(true);
    expect(result.current.agentAudioIngestStatus).toBe("waiting_for_audio");
  });

  it("plays newly synthesized agent audio using the returned WAV content type", async () => {
    const playback = stubAgentAudioPlayback();

    try {
      const createPioneroLiveKitSession = vi
        .fn()
        .mockResolvedValue(buildSession());
      const startPioneroLiveKitAgentPlan = vi
        .fn()
        .mockResolvedValue(buildAgentPlan());
      const getPioneroLiveKitAgentStatus = vi.fn().mockResolvedValue(
        buildSynthesizedAgentPlan()
      );
      const audioPayload = buildAgentAudioPayload();
      const getPioneroLiveKitAgentAudio = vi.fn().mockResolvedValue(audioPayload);
      mockLiveKit.createLocalAudioTrack.mockResolvedValue({ stop: vi.fn() });

      const { result } = renderHook(() =>
        usePioneroLiveKitRoom({
          createPioneroLiveKitSession,
          getPioneroLiveKitAgentAudio,
          getPioneroLiveKitAgentStatus,
          startPioneroLiveKitAgentPlan,
        })
      );

      await act(async () => {
        await result.current.connect();
      });

      await act(async () => {
        await result.current.refreshAgentStatus();
      });

      await waitFor(() => {
        expect(getPioneroLiveKitAgentAudio).toHaveBeenCalledWith({
          roomName: "pionero-browser-test",
        });
      });
      await waitFor(() => expect(playback.play).toHaveBeenCalledTimes(1));

      expect(playback.createObjectURL).toHaveBeenCalledTimes(1);
      expect(playback.createdBlobs[0]).toBeInstanceOf(Blob);
      expect(playback.createdBlobs[0].type).toBe("audio/wav");
      await expect(playback.createdBlobs[0].text()).resolves.toBe("RIFFxxxxWAVE");
      expect(result.current.agentAudioPlaybackStatus).toBe("played");
      expect(result.current.agentAudioPlaybackAudioId).toBe("agent-audio-1");
      expect(result.current.agentAudioPlaybackByteLength).toBe(12);
      expect(JSON.stringify(result.current)).not.toContain("audioBase64");
      expect(JSON.stringify(result.current)).not.toContain(audioPayload.audioBase64);
    } finally {
      playback.restore();
    }
  });

  it("retries agent audio fetch when synthesized audio is not ready yet and eventually plays", async () => {
    vi.useFakeTimers();
    const playback = stubAgentAudioPlayback();
    let unmount = () => {};

    try {
      const createPioneroLiveKitSession = vi
        .fn()
        .mockResolvedValue(buildSession());
      const startPioneroLiveKitAgentPlan = vi
        .fn()
        .mockResolvedValue(buildAgentPlan());
      const getPioneroLiveKitAgentStatus = vi.fn().mockResolvedValue(
        buildSynthesizedAgentPlan()
      );
      const getPioneroLiveKitAgentAudio = vi
        .fn()
        .mockRejectedValueOnce(buildAgentAudioNotFoundError())
        .mockResolvedValue(buildAgentAudioPayload());
      mockLiveKit.createLocalAudioTrack.mockResolvedValue({ stop: vi.fn() });

      const rendered = renderHook(() =>
        usePioneroLiveKitRoom({
          createPioneroLiveKitSession,
          getPioneroLiveKitAgentAudio,
          getPioneroLiveKitAgentStatus,
          startPioneroLiveKitAgentPlan,
        })
      );
      unmount = rendered.unmount;

      await act(async () => {
        await rendered.result.current.connect();
      });

      await act(async () => {
        await rendered.result.current.refreshAgentStatus();
      });
      await flushPromises();

      expect(getPioneroLiveKitAgentAudio).toHaveBeenCalledTimes(1);
      expect(rendered.result.current.agentAudioPlaybackStatus).toBe("loading");
      expect(rendered.result.current.agentAudioPlaybackReasonCode).toBe(
        "pionero_agent_tts_audio_not_found"
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      await flushPromises();

      expect(getPioneroLiveKitAgentAudio).toHaveBeenCalledTimes(2);
      expect(playback.play).toHaveBeenCalledTimes(1);
      expect(rendered.result.current.agentAudioPlaybackStatus).toBe("played");
    } finally {
      unmount();
      vi.clearAllTimers();
      vi.useRealTimers();
      playback.restore();
    }
  });

  it("does not permanently fail playback on the first agent audio 404", async () => {
    vi.useFakeTimers();
    const playback = stubAgentAudioPlayback();
    let unmount = () => {};

    try {
      const createPioneroLiveKitSession = vi
        .fn()
        .mockResolvedValue(buildSession());
      const startPioneroLiveKitAgentPlan = vi
        .fn()
        .mockResolvedValue(buildAgentPlan());
      const getPioneroLiveKitAgentStatus = vi.fn().mockResolvedValue(
        buildSynthesizedAgentPlan()
      );
      const getPioneroLiveKitAgentAudio = vi
        .fn()
        .mockRejectedValueOnce(buildAgentAudioNotFoundError())
        .mockResolvedValue(buildAgentAudioPayload());
      mockLiveKit.createLocalAudioTrack.mockResolvedValue({ stop: vi.fn() });

      const rendered = renderHook(() =>
        usePioneroLiveKitRoom({
          createPioneroLiveKitSession,
          getPioneroLiveKitAgentAudio,
          getPioneroLiveKitAgentStatus,
          startPioneroLiveKitAgentPlan,
        })
      );
      unmount = rendered.unmount;

      await act(async () => {
        await rendered.result.current.connect();
      });

      await act(async () => {
        await rendered.result.current.refreshAgentStatus();
      });
      await flushPromises();

      expect(getPioneroLiveKitAgentAudio).toHaveBeenCalledTimes(1);
      expect(rendered.result.current.agentAudioPlaybackStatus).toBe("loading");
      expect(rendered.result.current.agentAudioPlaybackStatus).not.toBe("error");
      expect(playback.play).not.toHaveBeenCalled();
    } finally {
      unmount();
      vi.clearAllTimers();
      vi.useRealTimers();
      playback.restore();
    }
  });

  it("does not replay duplicate synthesized counts", async () => {
    const playback = stubAgentAudioPlayback();

    try {
      const createPioneroLiveKitSession = vi
        .fn()
        .mockResolvedValue(buildSession());
      const startPioneroLiveKitAgentPlan = vi
        .fn()
        .mockResolvedValue(buildAgentPlan());
      const getPioneroLiveKitAgentStatus = vi.fn().mockResolvedValue(
        buildSynthesizedAgentPlan()
      );
      const getPioneroLiveKitAgentAudio = vi
        .fn()
        .mockResolvedValue(buildAgentAudioPayload());
      mockLiveKit.createLocalAudioTrack.mockResolvedValue({ stop: vi.fn() });

      const { result } = renderHook(() =>
        usePioneroLiveKitRoom({
          createPioneroLiveKitSession,
          getPioneroLiveKitAgentAudio,
          getPioneroLiveKitAgentStatus,
          startPioneroLiveKitAgentPlan,
        })
      );

      await act(async () => {
        await result.current.connect();
      });

      await act(async () => {
        await result.current.refreshAgentStatus();
      });

      await waitFor(() => expect(playback.play).toHaveBeenCalledTimes(1));
      expect(getPioneroLiveKitAgentAudio).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.refreshAgentStatus();
      });
      await flushPromises();

      expect(getPioneroLiveKitAgentAudio).toHaveBeenCalledTimes(1);
      expect(playback.play).toHaveBeenCalledTimes(1);
    } finally {
      playback.restore();
    }
  });

  it("stops the agent audio retry loop when the Pionero room disconnects", async () => {
    vi.useFakeTimers();
    const playback = stubAgentAudioPlayback();
    let unmount = () => {};

    try {
      const createPioneroLiveKitSession = vi
        .fn()
        .mockResolvedValue(buildSession());
      const startPioneroLiveKitAgentPlan = vi
        .fn()
        .mockResolvedValue(buildAgentPlan());
      const stopPioneroLiveKitAgentPlan = vi
        .fn()
        .mockResolvedValue(buildAgentPlan({ status: "stopped" }));
      const getPioneroLiveKitAgentStatus = vi.fn().mockResolvedValue(
        buildSynthesizedAgentPlan()
      );
      const getPioneroLiveKitAgentAudio = vi
        .fn()
        .mockRejectedValue(buildAgentAudioNotFoundError());
      mockLiveKit.createLocalAudioTrack.mockResolvedValue({ stop: vi.fn() });

      const rendered = renderHook(() =>
        usePioneroLiveKitRoom({
          createPioneroLiveKitSession,
          getPioneroLiveKitAgentAudio,
          getPioneroLiveKitAgentStatus,
          startPioneroLiveKitAgentPlan,
          stopPioneroLiveKitAgentPlan,
        })
      );
      unmount = rendered.unmount;

      await act(async () => {
        await rendered.result.current.connect();
      });

      await act(async () => {
        await rendered.result.current.refreshAgentStatus();
      });
      await flushPromises();

      expect(getPioneroLiveKitAgentAudio).toHaveBeenCalledTimes(1);

      await act(async () => {
        await rendered.result.current.disconnect();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2_000);
      });
      await flushPromises();

      expect(getPioneroLiveKitAgentAudio).toHaveBeenCalledTimes(1);
      expect(playback.play).not.toHaveBeenCalled();
      expect(rendered.result.current.agentAudioPlaybackStatus).toBe("idle");
    } finally {
      unmount();
      vi.clearAllTimers();
      vi.useRealTimers();
      playback.restore();
    }
  });

  it("keeps the browser room live when the agent start-plan fails", async () => {
    const localMicTrack = { stop: vi.fn() };
    const createPioneroLiveKitSession = vi.fn().mockResolvedValue(buildSession());
    const startPioneroLiveKitAgentPlan = vi
      .fn()
      .mockRejectedValue(new Error("agent plan failed"));
    mockLiveKit.createLocalAudioTrack.mockResolvedValue(localMicTrack);

    const { result } = renderHook(() =>
      usePioneroLiveKitRoom({
        createPioneroLiveKitSession,
        startPioneroLiveKitAgentPlan,
      })
    );

    await act(async () => {
      await result.current.connect();
    });

    const room = mockLiveKit.rooms[0];
    expect(startPioneroLiveKitAgentPlan).toHaveBeenCalledWith({
      roomName: "pionero-browser-test",
    });
    expect(room.disconnect).not.toHaveBeenCalled();
    expect(result.current.status).toBe("live");
    expect(result.current.localMicEnabled).toBe(true);
    expect(result.current.agentStatus).toBe("warning");
    expect(result.current.agentReasonCode).toMatch(/agent plan failed/i);
    expect(result.current.agentNetworkIo).toBe(false);
    expect(result.current.agentReady).toBe(false);
    expect(result.current.agentAudioIngestStatus).toBe("error");
    expect(result.current.agentAudioFramesObserved).toBe(0);
    expect(result.current.agentAudioBytesObserved).toBe(0);
    expect(result.current.agentAudioLastObservedAt).toBe("");
    expect(result.current.agentAudioReasonCode).toBe(
      "pionero_agent_start_plan_failed"
    );
    expect(result.current.agentSttProvider).toBe("soniox");
    expect(result.current.agentSttStatus).toBe("error");
    expect(result.current.agentSttEnabled).toBe(false);
    expect(result.current.agentSttNetworkIo).toBe(false);
    expect(result.current.agentSttTranscriptsObserved).toBe(0);
    expect(result.current.agentSttLastTranscript).toBe("");
    expect(result.current.agentSttLastObservedAt).toBe("");
    expect(result.current.agentSttReasonCode).toBe(
      "pionero_agent_start_plan_failed"
    );
    expect(result.current.agentLlmProvider).toBe("fast_text_llm");
    expect(result.current.agentLlmStatus).toBe("error");
    expect(result.current.agentLlmEnabled).toBe(false);
    expect(result.current.agentLlmNetworkIo).toBe(false);
    expect(result.current.agentLlmTurnsPlanned).toBe(0);
    expect(result.current.agentLlmLastInputTranscript).toBe("");
    expect(result.current.agentLlmLastPlannedResponse).toBe("");
    expect(result.current.agentLlmLastObservedAt).toBe("");
    expect(result.current.agentLlmReasonCode).toBe(
      "pionero_agent_start_plan_failed"
    );
  });

  it("surfaces session creation failures without creating a room", async () => {
    const createPioneroLiveKitSession = vi
      .fn()
      .mockRejectedValue(new Error("session failed"));
    const startPioneroLiveKitAgentPlan = vi
      .fn()
      .mockResolvedValue(buildAgentPlan());

    const { result } = renderHook(() =>
      usePioneroLiveKitRoom({
        createPioneroLiveKitSession,
        startPioneroLiveKitAgentPlan,
      })
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(mockLiveKit.Room).not.toHaveBeenCalled();
    expect(startPioneroLiveKitAgentPlan).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatch(/session failed/i);
    expect(result.current.localMicEnabled).toBe(false);
  });
});
