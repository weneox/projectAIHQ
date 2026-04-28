import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import InboxComposer from "../../../components/inbox/InboxComposer.jsx";

function renderComposer(props = {}) {
  const baseProps = {
    value: "",
    onChange: vi.fn(),
    onSend: vi.fn(),
    onVoice: vi.fn(),
    disabled: false,
    sending: false,
    submitLabel: "Send",
    voiceLabel: "Voice message",
  };

  const merged = { ...baseProps, ...props };

  return {
    ...render(<InboxComposer {...merged} />),
    props: merged,
  };
}

describe("InboxComposer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends on Enter when ready", () => {
    const onSend = vi.fn();

    renderComposer({
      value: "Hello there",
      onSend,
    });

    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
    });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith("Hello there");
  });

  it("does not send on Shift+Enter", () => {
    const onSend = vi.fn();

    renderComposer({
      value: "Hello there",
      onSend,
    });

    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      shiftKey: true,
    });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send when the composer value is blank", () => {
    const onSend = vi.fn();

    renderComposer({
      value: "   ",
      onSend,
    });

    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
    });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables send when the composer is disabled", () => {
    const onSend = vi.fn();

    renderComposer({
      value: "Blocked reply",
      onSend,
      disabled: true,
    });

    const sendButton = screen.getByRole("button", {
      name: /^send$/i,
    });

    expect(sendButton).toBeDisabled();

    fireEvent.click(sendButton);

    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows voice action when the composer is empty", () => {
    const onVoice = vi.fn();

    renderComposer({
      value: "",
      onVoice,
      voiceLabel: "Voice message",
    });

    const button = screen.getByRole("button", { name: /voice message/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(onVoice).toHaveBeenCalledTimes(1);
  });
});