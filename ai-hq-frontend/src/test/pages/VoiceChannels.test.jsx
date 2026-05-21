import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listVoiceChannels = vi.fn();
const createVoiceChannel = vi.fn();
const startVoiceChannelVerification = vi.fn();
const confirmVoiceChannelVerification = vi.fn();
const testVoiceChannelRouting = vi.fn();

vi.mock("../../api/voice.js", () => ({
  listVoiceChannels: (...args) => listVoiceChannels(...args),
  createVoiceChannel: (...args) => createVoiceChannel(...args),
  startVoiceChannelVerification: (...args) => startVoiceChannelVerification(...args),
  confirmVoiceChannelVerification: (...args) => confirmVoiceChannelVerification(...args),
  testVoiceChannelRouting: (...args) => testVoiceChannelRouting(...args),
}));

import VoiceChannels from "../../pages/VoiceChannels.jsx";

describe("VoiceChannels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listVoiceChannels.mockResolvedValue({
      channels: [
        {
          id: "browser_lab",
          provider: "browser_lab",
          activationMode: "browser_lab",
          label: "Pre-SIP call adapter",
          externalNumber: "browser_lab",
          routeKey: "default",
          connectionStatus: "live",
        },
      ],
      settings: { provider: "twilio" },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("does not expose Browser Lab as a production channel provider", async () => {
    render(<VoiceChannels />);

    expect(await screen.findByRole("heading", { name: /voice channels/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByText("Browser voice adapter").length).toBeGreaterThan(0);
    });

    expect(screen.queryByText("Browser Lab")).not.toBeInTheDocument();
    expect(screen.queryByText("Browser lab")).not.toBeInTheDocument();
  });
});
