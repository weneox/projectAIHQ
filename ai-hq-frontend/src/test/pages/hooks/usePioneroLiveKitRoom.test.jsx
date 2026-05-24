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

describe("usePioneroLiveKitRoom", () => {
  beforeEach(() => {
    mockLiveKit.rooms.length = 0;
    mockLiveKit.Room.mockClear();
    mockLiveKit.createLocalAudioTrack.mockReset();
  });

  it("creates a Pionero LiveKit session, connects the room, and publishes mic audio", async () => {
    const localMicTrack = { stop: vi.fn() };
    const createPioneroLiveKitSession = vi.fn().mockResolvedValue(buildSession());
    mockLiveKit.createLocalAudioTrack.mockResolvedValue(localMicTrack);

    const { result } = renderHook(() =>
      usePioneroLiveKitRoom({ createPioneroLiveKitSession })
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
    expect(mockLiveKit.createLocalAudioTrack).toHaveBeenCalledTimes(1);
    expect(room.localParticipant.publishTrack).toHaveBeenCalledWith(localMicTrack);
    expect(result.current.status).toBe("live");
    expect(result.current.roomName).toBe("pionero-browser-test");
    expect(result.current.identity).toBe("user-test");
    expect(result.current.localMicEnabled).toBe(true);
    expect(result.current.session.token).toBeUndefined();
    expect(JSON.stringify(result.current.session)).not.toContain("token-test");
  });

  it("updates participants from LiveKit room events", async () => {
    const createPioneroLiveKitSession = vi.fn().mockResolvedValue(buildSession());
    mockLiveKit.createLocalAudioTrack.mockResolvedValue({ stop: vi.fn() });

    const { result } = renderHook(() =>
      usePioneroLiveKitRoom({ createPioneroLiveKitSession })
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
    mockLiveKit.createLocalAudioTrack.mockResolvedValue(localMicTrack);

    const { result } = renderHook(() =>
      usePioneroLiveKitRoom({ createPioneroLiveKitSession })
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
  });

  it("surfaces session creation failures without creating a room", async () => {
    const createPioneroLiveKitSession = vi
      .fn()
      .mockRejectedValue(new Error("session failed"));

    const { result } = renderHook(() =>
      usePioneroLiveKitRoom({ createPioneroLiveKitSession })
    );

    await act(async () => {
      await result.current.connect();
    });

    expect(mockLiveKit.Room).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatch(/session failed/i);
    expect(result.current.localMicEnabled).toBe(false);
  });
});
