import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useVoiceSurface = vi.fn();

vi.mock("./hooks/useVoiceSurface.js", () => ({
  useVoiceSurface: () => useVoiceSurface(),
}));

import Voice from "./Voice.jsx";

describe("Voice", () => {
  it("renders shared banner state through the admin shell", () => {
    useVoiceSurface.mockReturnValue({
      overviewData: {},
      calls: [],
      liveCount: 0,
      totalCount: 0,
      totalMinutes: 0,
      selectedId: "",
      setSelectedId: vi.fn(),
      selectedCall: null,
      selectedStatus: "idle",
      selectedLive: false,
      events: [],
      sessions: [],
      surface: {
        loading: false,
        error: "",
        unavailable: true,
        ready: false,
        saving: false,
        saveError: "",
        saveSuccess: "Join accepted.",
        refresh: vi.fn(),
      },
      detailSurface: {
        loading: false,
        error: "",
        unavailable: false,
      },
      actionState: {
        isActionPending: vi.fn().mockReturnValue(false),
      },
      joinSelectedCall: vi.fn(),
    });

    render(<Voice />);

    expect(screen.getByText(/voice center/i)).toBeInTheDocument();
    expect(screen.getByText(/voice operations are temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/join accepted/i)).toBeInTheDocument();
  });
});
