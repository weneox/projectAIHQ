import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getVoiceOverview = vi.fn();
const listVoiceCalls = vi.fn();
const getVoiceCall = vi.fn();
const listVoiceCallEvents = vi.fn();
const listVoiceCallSessions = vi.fn();
const joinVoiceCall = vi.fn();

vi.mock("../../api/voice.js", () => ({
  getVoiceOverview: (...args) => getVoiceOverview(...args),
  listVoiceCalls: (...args) => listVoiceCalls(...args),
  getVoiceCall: (...args) => getVoiceCall(...args),
  listVoiceCallEvents: (...args) => listVoiceCallEvents(...args),
  listVoiceCallSessions: (...args) => listVoiceCallSessions(...args),
  joinVoiceCall: (...args) => joinVoiceCall(...args),
}));

import { useVoiceSurface } from "./useVoiceSurface.js";

describe("useVoiceSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getVoiceOverview.mockResolvedValue({ liveCalls: 1, totalCalls: 4, totalMinutes: 12 });
    listVoiceCalls.mockResolvedValue([
      {
        id: "call-1",
        from: "+15550001",
        status: "live",
        durationSec: 120,
      },
    ]);
    getVoiceCall.mockResolvedValue({ id: "call-1", from: "+15550001", status: "live", durationSec: 120 });
    listVoiceCallEvents.mockResolvedValue([{ id: "event-1", type: "joined" }]);
    listVoiceCallSessions.mockResolvedValue([{ id: "session-1" }]);
    joinVoiceCall.mockResolvedValue({ ok: true });
  });

  it("exposes the shared surface contract and join success state", async () => {
    const { result } = renderHook(() => useVoiceSurface());

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
      expect(result.current.selectedId).toBe("call-1");
    });

    await waitFor(() => {
      expect(result.current.detailSurface.loading).toBe(false);
      expect(result.current.sessions).toHaveLength(1);
    });

    await act(async () => {
      await result.current.joinSelectedCall();
    });

    expect(joinVoiceCall).toHaveBeenCalledWith("call-1", {
      sessionId: "session-1",
      joinMode: "live",
    });
    expect(result.current.surface.saveSuccess).toMatch(/operator join requested/i);
    expect(result.current.actionState.pendingAction).toBe("");
  });
});
