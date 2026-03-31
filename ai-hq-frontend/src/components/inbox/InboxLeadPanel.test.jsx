import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import InboxLeadPanel from "./InboxLeadPanel.jsx";

describe("InboxLeadPanel", () => {
  it("renders explicit lead surface feedback", () => {
    render(
      <InboxLeadPanel
        selectedThread={{ id: "thread-1" }}
        surface={{
          loading: false,
          error: "",
          unavailable: true,
          ready: false,
          saving: false,
          saveError: "",
          saveSuccess: "",
          refresh: vi.fn(),
        }}
        relatedLead={null}
        openLeadDetail={vi.fn()}
      />
    );

    expect(screen.getByText(/related context is temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh context/i })).toBeInTheDocument();
  });
});
