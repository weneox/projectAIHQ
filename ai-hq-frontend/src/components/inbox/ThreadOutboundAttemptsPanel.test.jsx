import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useThreadOutboundAttemptsSurface = vi.fn();

vi.mock("./hooks/useThreadOutboundAttemptsSurface.js", () => ({
  useThreadOutboundAttemptsSurface: (...args) => useThreadOutboundAttemptsSurface(...args),
}));

let ThreadOutboundAttemptsPanel;

beforeEach(async () => {
  vi.resetModules();
  ({ default: ThreadOutboundAttemptsPanel } = await import("./ThreadOutboundAttemptsPanel.jsx"));
});

describe("ThreadOutboundAttemptsPanel", () => {
  it("renders shared banner feedback", () => {
    useThreadOutboundAttemptsSurface.mockReturnValue({
      attempts: [],
      surface: {
        loading: false,
        error: "",
        unavailable: true,
        ready: false,
        saving: false,
        saveError: "",
        saveSuccess: "Retry accepted. Waiting for outbound attempt status to move.",
        refresh: vi.fn(),
      },
      actionState: {
        isActionPending: vi.fn().mockReturnValue(false),
      },
      handleResend: vi.fn(),
      handleMarkDead: vi.fn(),
    });

    render(<ThreadOutboundAttemptsPanel selectedThread={{ id: "thread-1" }} actor="operator" />);

    expect(screen.getByText(/thread delivery attempts are temporarily unavailable/i)).toBeInTheDocument();
  });

  it("renders explicit attempt-lineage copy without flattening retry state", () => {
    useThreadOutboundAttemptsSurface.mockReturnValue({
      attempts: [
        {
          id: "attempt-1",
          status: "retrying",
          attempt_count: 2,
          max_attempts: 5,
          message_text: "Checking in with your booking options.",
          updated_at: "2026-03-30T08:00:00.000Z",
          next_retry_at: "2026-03-30T08:05:00.000Z",
          provider: "meta",
        },
      ],
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
      actionState: {
        isActionPending: vi.fn().mockReturnValue(false),
      },
      handleResend: vi.fn(),
      handleMarkDead: vi.fn(),
    });

    render(<ThreadOutboundAttemptsPanel selectedThread={{ id: "thread-1" }} actor="operator" />);

    expect(screen.getByText(/per-attempt outbound lineage/i)).toBeInTheDocument();
    expect(screen.getAllByText(/retrying/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/retry lineage is active after attempt 2 of 5/i)).toBeInTheDocument();
    expect(screen.getAllByText(/attempt 2 of 5/i).length).toBeGreaterThan(0);
  });
});
