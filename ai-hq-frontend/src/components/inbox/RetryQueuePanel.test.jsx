import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useRetryQueueSurface = vi.fn();

vi.mock("./hooks/useRetryQueueSurface.js", () => ({
  useRetryQueueSurface: (...args) => useRetryQueueSurface(...args),
}));

let RetryQueuePanel;

beforeEach(async () => {
  vi.resetModules();
  ({ default: RetryQueuePanel } = await import("./RetryQueuePanel.jsx"));
});

describe("RetryQueuePanel", () => {
  it("renders shared banner feedback", () => {
    useRetryQueueSurface.mockReturnValue({
      attempts: [],
      cards: [["Failed", 0]],
      statusFilter: "",
      setStatusFilter: vi.fn(),
      surface: {
        loading: false,
        error: "",
        unavailable: true,
        ready: false,
        saving: false,
        saveError: "",
        saveSuccess: "Retry queued.",
        refresh: vi.fn(),
      },
      actionState: {
        isActionPending: vi.fn().mockReturnValue(false),
      },
      handleResend: vi.fn(),
      handleMarkDead: vi.fn(),
    });

    render(<RetryQueuePanel tenantKey="acme" actor="operator" />);

    expect(screen.getByText(/retry queue is temporarily unavailable/i)).toBeInTheDocument();
  });

  it("keeps failed and dead delivery states visible on the operator surface", () => {
    useRetryQueueSurface.mockReturnValue({
      attempts: [
        {
          id: "attempt-failed",
          status: "failed",
          attempt_count: 1,
          max_attempts: 3,
          customer_name: "Alex Morgan",
          message_text: "First follow-up",
          last_error: "Provider timeout",
          channel: "instagram",
          provider: "meta",
        },
        {
          id: "attempt-dead",
          status: "dead",
          attempt_count: 3,
          max_attempts: 3,
          customer_name: "Jordan Lee",
          message_text: "Second follow-up",
          last_error: "Attempts exhausted",
          channel: "instagram",
          provider: "meta",
        },
      ],
      cards: [
        ["Failed", 1],
        ["Dead", 1],
      ],
      statusFilter: "",
      setStatusFilter: vi.fn(),
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

    render(<RetryQueuePanel tenantKey="acme" actor="operator" />);

    expect(screen.getAllByText(/failed/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/dead/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/provider timeout/i)).toBeInTheDocument();
    expect(screen.getByText(/attempts exhausted/i)).toBeInTheDocument();
  });
});
