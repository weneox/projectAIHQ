import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import InboxComposer from "./InboxComposer.jsx";

describe("InboxComposer", () => {
  it("renders explicit composer surface feedback", () => {
    render(
      <InboxComposer
        selectedThread={{ id: "thread-1", handoff_active: true }}
        surface={{
          loading: false,
          error: "",
          unavailable: false,
          ready: true,
          saving: false,
          saveError: "",
          saveSuccess: "Operator reply sent.",
          refresh: vi.fn(),
        }}
        actionState={{ isActionPending: vi.fn().mockReturnValue(false) }}
        replyText=""
        setReplyText={vi.fn()}
        onSend={vi.fn()}
        onReleaseHandoff={vi.fn()}
      />
    );

    expect(screen.getByText(/operator reply sent/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send operator reply/i })).toBeInTheDocument();
  });
});
