import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getVoiceActionRuntime = vi.fn();
const startCall = vi.fn();
const stopCall = vi.fn();

vi.mock("../../api/voice.js", () => ({
  getVoiceActionRuntime: (...args) => getVoiceActionRuntime(...args),
}));

vi.mock("../../pages/hooks/useBrowserVoiceCall.js", () => ({
  default: () => ({
    status: "idle",
    error: "",
    voice: "coral",
    runtimeMeta: {
      runtimeApplied: true,
      tenantKey: "acme",
      activeVoiceChannel: {
        provider: "browser_lab",
      },
      match: {
        provider: "browser_lab",
      },
      assistantPolicyVersion: "voice_assistant_brain.v1",
    },
    events: [],
    remoteAudioRef: { current: null },
    startCall,
    stopCall,
  }),
}));

import BrowserVoiceCall from "../../pages/BrowserVoiceCall.jsx";

describe("BrowserVoiceCall product surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getVoiceActionRuntime.mockResolvedValue({
      runtimeApplied: true,
      actionRuntime: {
        businessFamily: "clinic",
        availabilityMode: "disabled",
        orderingMode: "disabled",
        reservationMode: "disabled",
        appointmentMode: "request_only",
      },
      tools: [{ name: "create_appointment_request" }, { name: "end_call" }],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the real voice assistant call surface without evaluation UI", async () => {
    render(<BrowserVoiceCall />);

    expect(
      screen.getByRole("heading", { name: /^voice assistant$/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start call/i })).toBeInTheDocument();
    expect(screen.getAllByText(/tenant voice runtime/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/browser voice adapter/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/create_appointment_request, end_call/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/scenario/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/expected outcome/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/latest results/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/captured/i)).not.toBeInTheDocument();
  });
});
