import { act, renderHook } from "@testing-library/react";
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

import usePioneroLiveKitRoom from "../../../pages/hooks/usePioneroLiveKitRoom.js";

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
    readiness: {
      agentParticipantReady: false,
      reasonCode: "pionero_agent_runner_not_started",
    },
    ...overrides,
  };
}

describe("usePioneroLiveKitRoom", () => {
  beforeEach(() => {
    mockLiveKit.rooms.length = 0;
    mockLiveKit.Room.mockClear();
    mockLiveKit.createLocalAudioTrack.mockReset();
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
    expect(room.connect.mock.invocationCallOrder[0]).toBeLessThan(
      startPioneroLiveKitAgentPlan.mock.invocationCallOrder[0]
    );
    expect(mockLiveKit.createLocalAudioTrack).toHaveBeenCalledTimes(1);
    expect(room.localParticipant.publishTrack).toHaveBeenCalledWith(localMicTrack);
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

  it("disconnects the room, stops the mic track, and clears room state", async () => {
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

    await act(async () => {
      await result.current.connect();
    });

    const room = mockLiveKit.rooms[0];

    await act(async () => {
      await result.current.disconnect();
    });

    expect(room.disconnect).toHaveBeenCalledTimes(1);
    expect(localMicTrack.stop).toHaveBeenCalledTimes(1);
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
