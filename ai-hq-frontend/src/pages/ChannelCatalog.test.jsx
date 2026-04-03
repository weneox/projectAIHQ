import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

import ChannelCatalog from "./ChannelCatalog.jsx";

afterEach(() => {
  cleanup();
  navigate.mockReset();
});

describe("ChannelCatalog", () => {
  it("renders the channels framing and active runtime section", () => {
    render(
      <MemoryRouter>
        <ChannelCatalog />
      </MemoryRouter>
    );

    expect(
      screen.getByText("What is real in the current launch slice")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Real launch surfaces")
    ).toBeInTheDocument();
  });

  it("filters channels by search query", () => {
    render(
      <MemoryRouter>
        <ChannelCatalog />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("Search channels"), {
      target: { value: "telegram" },
    });

    expect(screen.getByText("Telegram")).toBeInTheDocument();
    expect(screen.queryByText("Instagram")).not.toBeInTheDocument();
  });

  it("switches catalog groups through filter pills", () => {
    render(
      <MemoryRouter>
        <ChannelCatalog />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Context and setup" }));

    expect(screen.getByText("Google Drive")).toBeInTheDocument();
    expect(screen.queryByText("Instagram")).not.toBeInTheDocument();
  });

  it("navigates when a channel action is selected", () => {
    render(
      <MemoryRouter>
        <ChannelCatalog />
      </MemoryRouter>
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Open Inbox" })[0]);

    expect(navigate).toHaveBeenCalledWith("/inbox");
  });
});
