import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../components/feedback/SurfaceBanner.jsx", () => ({
  default: () => <div>surface-banner</div>,
}));

vi.mock("../../../components/ui/Button.jsx", () => ({
  default: ({
    children,
    onClick,
    disabled,
    ariaLabel,
    "aria-label": ariaLabelProp,
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabelProp || ariaLabel}
    >
      {children}
    </button>
  ),
}));

import InboxComposer from "../../../components/inbox/InboxComposer.jsx";

function renderComposer(props = {}) {
  const baseProps = {
    selectedThread: { id: "thread_1", handoff_active: false },
    surface: {
      saveSuccess: "",
      saveError: "",
      unavailable: false,
      error: "",
    },
    actionState: {
      isActionPending: vi.fn().mockReturnValue(false),
    },
    replyText: "",
    setReplyText: vi.fn(),
    onSend: vi.fn(),
    onReleaseHandoff: vi.fn(),
    embedded: true,
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
      replyText: "Hello there",
      onSend,
    });

    fireEvent.keyDown(screen.getByLabelText(/reply to conversation/i), {
      key: "Enter",
    });

    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("does not send on Shift+Enter", () => {
    const onSend = vi.fn();

    renderComposer({
      replyText: "Hello there",
      onSend,
    });

    fireEvent.keyDown(screen.getByLabelText(/reply to conversation/i), {
      key: "Enter",
      shiftKey: true,
    });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("does not send while IME composition is active", () => {
    const onSend = vi.fn();

    renderComposer({
      replyText: "こんにちは",
      onSend,
    });

    const textarea = screen.getByLabelText(/reply to conversation/i);

    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, {
      key: "Enter",
      nativeEvent: { isComposing: true },
    });
    fireEvent.compositionEnd(textarea);

    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables send when surface is unavailable", () => {
    const onSend = vi.fn();

    renderComposer({
      replyText: "Blocked reply",
      onSend,
      surface: {
        saveSuccess: "",
        saveError: "",
        unavailable: true,
        error: "",
      },
    });

    const sendButton = screen.getByRole("button", {
      name: /send operator reply/i,
    });

    expect(sendButton).toBeDisabled();

    fireEvent.click(sendButton);

    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows release AI when handoff is active", () => {
    const onReleaseHandoff = vi.fn();

    renderComposer({
      selectedThread: { id: "thread_1", handoff_active: true },
      onReleaseHandoff,
    });

    const button = screen.getByRole("button", { name: /release ai/i });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(onReleaseHandoff).toHaveBeenCalledTimes(1);
  });
});