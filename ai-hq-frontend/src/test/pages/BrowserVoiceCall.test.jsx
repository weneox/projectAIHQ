import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startCall = vi.fn();
const stopCall = vi.fn();

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
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a clean working browser voice call surface", () => {
    render(<BrowserVoiceCall />);

    expect(
      screen.getByRole("heading", { name: /^browser voice call$/i })
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /start call/i })).toBeInTheDocument();
    expect(screen.getByText(/openai realtime/i)).toBeInTheDocument();
    expect(screen.getByText(/browser webrtc/i)).toBeInTheDocument();
    expect(screen.getByText(/tenant runtime active/i)).toBeInTheDocument();
    expect(screen.getByText(/live call log/i)).toBeInTheDocument();

    expect(screen.queryByText(/scenario/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/expected outcome/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/latest results/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/enabled tools/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/availability/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/appointment/i)).not.toBeInTheDocument();
  });
});
