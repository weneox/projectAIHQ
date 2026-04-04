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

import ChannelCatalog from "../../pages/ChannelCatalog.jsx";

afterEach(() => {
  cleanup();
  navigate.mockReset();
});

describe("ChannelCatalog", () => {
  it("renders the compact channels overview", () => {
    render(
      <MemoryRouter>
        <ChannelCatalog />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Channels" })).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
    expect(screen.getByText("Voice")).toBeInTheDocument();
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

  it("switches channel groups through the overview filters", () => {
    render(
      <MemoryRouter>
        <ChannelCatalog />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("Filter channels"), {
      target: { value: "context" },
    });

    expect(screen.getByText("Business Context")).toBeInTheDocument();
    expect(screen.queryByText("Instagram")).not.toBeInTheDocument();
  });

  it("opens the focused detail drawer", () => {
    render(
      <MemoryRouter>
        <ChannelCatalog />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Inspect Instagram" }));

    expect(screen.getByText("Quick controls")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close channel details" })
    ).toBeInTheDocument();
  });

  it("navigates when a channel action is selected", () => {
    render(
      <MemoryRouter>
        <ChannelCatalog />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Instagram" }));

    expect(navigate).toHaveBeenCalledWith("/inbox");
  });
});
