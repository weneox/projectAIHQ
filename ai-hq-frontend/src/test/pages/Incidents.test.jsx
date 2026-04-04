import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../pages/hooks/useAdminIncidentsSurface.js", () => ({
  useAdminIncidentsSurface: () => ({
    incidents: [
      {
        id: "incident-1",
        service: "ai-hq-backend",
        severity: "error",
        code: "voice_test_failed",
        reasonCode: "voice_test_failed",
        detailSummary: "Voice test route failed",
        occurredAt: "2026-03-26T10:00:00.000Z",
        tenantKey: "acme",
        requestId: "req-1",
        correlationId: "corr-1",
      },
    ],
    filters: {
      service: "",
      severity: "",
      reasonCode: "",
      sinceHours: "24",
      limit: "50",
    },
    patchFilter: vi.fn(),
    applyFilters: vi.fn(),
    clearFilters: vi.fn(),
    retentionPolicy: {
      retainDays: 14,
      maxRows: 5000,
    },
    summary: {
      status: "degraded",
      total: 1,
      errorCount: 1,
      warnCount: 0,
      latestOccurredAt: "2026-03-26T10:00:00.000Z",
      sinceHours: 24,
      services: ["ai-hq-backend"],
      reasonCodes: ["voice_test_failed"],
    },
    surface: {
      loading: false,
      error: "",
      unavailable: false,
      ready: true,
      saving: false,
      saveError: "",
      saveSuccess: "",
      refresh: vi.fn(),
    },
  }),
}));

import Incidents from "../../pages/Incidents.jsx";

afterEach(() => {
  cleanup();
});

describe("Incidents", () => {
  it("renders recent incidents and retention badges", () => {
    render(<Incidents />);

    expect(screen.getByRole("heading", { name: "Incident Trail" })).toBeInTheDocument();
    expect(screen.getByText(/retain 14 days/i)).toBeInTheDocument();
    expect(screen.getByText(/max 5000 incidents/i)).toBeInTheDocument();
    expect(screen.getByText(/current incident posture/i)).toBeInTheDocument();
    expect(screen.getByText(/degraded over the last 24h/i)).toBeInTheDocument();
    expect(screen.getByText(/voice test route failed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/voice_test_failed/i).length).toBeGreaterThan(0);
  });

  it("renders filter actions", () => {
    render(<Incidents />);

    expect(screen.getByRole("button", { name: /apply filters/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /refresh incidents/i }));
  });
});
