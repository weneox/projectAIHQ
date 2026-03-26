import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useRetryQueueSurface = vi.fn();

vi.mock("./hooks/useRetryQueueSurface.js", () => ({
  useRetryQueueSurface: (...args) => useRetryQueueSurface(...args),
}));

import RetryQueuePanel from "./RetryQueuePanel.jsx";

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

    expect(screen.getByText(/retry queued/i)).toBeInTheDocument();
    expect(screen.getByText(/retry queue is temporarily unavailable/i)).toBeInTheDocument();
  });
});
