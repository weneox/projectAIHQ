import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/incidents.js", () => ({
  listRuntimeIncidents: vi.fn(),
}));

import { listRuntimeIncidents } from "../../api/incidents.js";
import { useAdminIncidentsSurface } from "./useAdminIncidentsSurface.js";

describe("useAdminIncidentsSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads incidents through the shared surface contract", async () => {
    listRuntimeIncidents.mockResolvedValue({
      incidents: [
        {
          id: "incident-1",
          service: "ai-hq-backend",
          severity: "error",
          code: "voice_test_failed",
          reasonCode: "voice_test_failed",
        },
      ],
      retentionPolicy: {
        retainDays: 14,
        maxRows: 5000,
      },
      filters: {
        service: "",
        severity: "",
        reasonCode: "",
        sinceHours: 24,
        limit: 50,
      },
    });

    const { result } = renderHook(() => useAdminIncidentsSurface());

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    expect(result.current.incidents).toHaveLength(1);
    expect(result.current.retentionPolicy?.retainDays).toBe(14);
  });

  it("applies filters and refreshes incidents", async () => {
    listRuntimeIncidents
      .mockResolvedValueOnce({
        incidents: [],
        retentionPolicy: null,
        filters: {},
      })
      .mockResolvedValueOnce({
        incidents: [
          {
            id: "incident-2",
            service: "twilio-voice-backend",
            severity: "warn",
            code: "voice_sync_request_failed",
            reasonCode: "request_failed",
          },
        ],
        retentionPolicy: {
          retainDays: 14,
          maxRows: 5000,
        },
        filters: {
          service: "twilio-voice-backend",
          severity: "warn",
          reasonCode: "request_failed",
          sinceHours: 24,
          limit: 50,
        },
      });

    const { result } = renderHook(() => useAdminIncidentsSurface());

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    act(() => {
      result.current.patchFilter("service", "twilio-voice-backend");
      result.current.patchFilter("severity", "warn");
      result.current.patchFilter("reasonCode", "request_failed");
    });

    await act(async () => {
      await result.current.applyFilters();
    });

    expect(listRuntimeIncidents).toHaveBeenLastCalledWith(
      expect.objectContaining({
        service: "twilio-voice-backend",
        severity: "warn",
        reasonCode: "request_failed",
      })
    );
    expect(result.current.incidents[0]?.service).toBe("twilio-voice-backend");
  });
});
