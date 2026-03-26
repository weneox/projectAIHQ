import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useThreadOutboundAttemptsSurface = vi.fn();

vi.mock("./hooks/useThreadOutboundAttemptsSurface.js", () => ({
  useThreadOutboundAttemptsSurface: (...args) => useThreadOutboundAttemptsSurface(...args),
}));

import ThreadOutboundAttemptsPanel from "./ThreadOutboundAttemptsPanel.jsx";

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
        saveSuccess: "Delivery retry requested.",
        refresh: vi.fn(),
      },
      actionState: {
        isActionPending: vi.fn().mockReturnValue(false),
      },
      handleResend: vi.fn(),
      handleMarkDead: vi.fn(),
    });

    render(<ThreadOutboundAttemptsPanel selectedThread={{ id: "thread-1" }} actor="operator" />);

    expect(screen.getByText(/delivery retry requested/i)).toBeInTheDocument();
    expect(screen.getByText(/thread delivery attempts are temporarily unavailable/i)).toBeInTheDocument();
  });
});
