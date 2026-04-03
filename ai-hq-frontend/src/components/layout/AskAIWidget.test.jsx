import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../test/vitest.setup.js";
import AskAIWidget from "./AskAIWidget.jsx";

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

describe("AskAIWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens from the premium trigger and submits on Enter", async () => {
    render(
      <MemoryRouter initialEntries={["/workspace"]}>
        <AskAIWidget
          shellSection={{ label: "Workspace" }}
          activeContextItem={{ label: "Workspace overview" }}
          shellStats={{ inboxUnread: 2, leadsOpen: 1, wsState: "ready" }}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /open ask ai/i }));

    const input = await screen.findByPlaceholderText(
      /ask ai for a route, brief, or action/i
    );
    fireEvent.change(input, { target: { value: "what needs attention" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("Top attention area")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/2 unread inbox items are still waiting on review/i)
    ).toBeInTheDocument();
  });

  it("routes direct navigation requests with quick suggestions", async () => {
    render(
      <MemoryRouter initialEntries={["/workspace"]}>
        <AskAIWidget
          shellSection={{ label: "Workspace" }}
          activeContextItem={{ label: "Workspace overview" }}
          shellStats={{ inboxUnread: 0, leadsOpen: 0, wsState: "idle" }}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /open ask ai/i }));
    fireEvent.click(screen.getByRole("button", { name: /open inbox/i }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/inbox");
    });
  });

  it("supports multiline composition with shift enter", async () => {
    render(
      <MemoryRouter initialEntries={["/workspace"]}>
        <AskAIWidget
          shellSection={{ label: "Workspace" }}
          activeContextItem={{ label: "Workspace overview" }}
          shellStats={{ inboxUnread: 0, leadsOpen: 0, wsState: "idle" }}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /open ask ai/i }));

    const input = await screen.findByPlaceholderText(
      /ask ai for a route, brief, or action/i
    );
    fireEvent.change(input, { target: { value: "draft reply" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter", shiftKey: true });

    expect(input.value).toBe("draft reply");
  });
});
