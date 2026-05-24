import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BrowserVoiceCall from "../../pages/BrowserVoiceCall.jsx";
import useBrowserVoiceCall from "../../pages/hooks/useBrowserVoiceCall.js";

vi.mock("../../pages/hooks/useBrowserVoiceCall.js", () => ({
  default: vi.fn(),
}));

function buildHook(overrides = {}) {
  return {
    status: "idle",
    error: "",
    voice: "coral",
    runtimeMeta: null,
    events: [],
    remoteAudioRef: { current: null },
    speechBridge: {
      available: true,
      error: "",
      mode: "speech_bridge",
      playbackStatus: "idle",
      recording: false,
      speakText: vi.fn(),
      startRecording: vi.fn(),
      status: "idle",
      stopRecording: vi.fn(),
      text: "Salam",
    },
    startCall: vi.fn(),
    stopCall: vi.fn(),
    ...overrides,
  };
}

describe("BrowserVoiceCall", () => {
  beforeEach(() => {
    useBrowserVoiceCall.mockReset();
  });

  it("renders GPT Realtime and speech bridge test lanes together", () => {
    const hook = buildHook();
    useBrowserVoiceCall.mockReturnValue(hook);

    const { getByText, getByLabelText } = render(<BrowserVoiceCall />);

    expect(getByText("GPT Realtime WebRTC")).toBeTruthy();
    expect(getByText("Speech Bridge / Soniox lane")).toBeTruthy();
    expect(getByLabelText("Speech bridge text")).toBeTruthy();

    fireEvent.click(getByText("Start GPT Realtime call"));
    expect(hook.startCall).toHaveBeenCalledTimes(1);

    fireEvent.click(getByText("Start speech bridge recording"));
    expect(hook.speechBridge.startRecording).toHaveBeenCalledTimes(1);

    fireEvent.click(getByText("Speak via speech bridge"));
    expect(hook.speechBridge.speakText).toHaveBeenCalledWith("Salam");
  });

  it("uses stop controls when both voice lanes are active", () => {
    const hook = buildHook({
      status: "live",
      speechBridge: {
        ...buildHook().speechBridge,
        recording: true,
        status: "recording",
      },
    });
    useBrowserVoiceCall.mockReturnValue(hook);

    const { getByText } = render(<BrowserVoiceCall />);

    fireEvent.click(getByText("End GPT Realtime call"));
    expect(hook.stopCall).toHaveBeenCalledTimes(1);

    fireEvent.click(getByText("Stop speech bridge recording"));
    expect(hook.speechBridge.stopRecording).toHaveBeenCalledTimes(1);
  });
});
