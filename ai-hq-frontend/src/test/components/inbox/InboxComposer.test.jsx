import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import InboxComposer from "../../../components/inbox/InboxComposer.jsx";

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
          saveSuccess:
            "Reply accepted. Waiting for outbound attempt status to confirm delivery.",
          refresh: vi.fn(),
        }}
        actionState={{ isActionPending: vi.fn().mockReturnValue(false) }}
        replyText=""
        setReplyText={vi.fn()}
        onSend={vi.fn()}
        onReleaseHandoff={vi.fn()}
      />
    );

    expect(screen.getByText(/reply accepted/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send operator reply/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add note or attachment/i })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /reply to conversation/i })).toBeInTheDocument();
  });
});
