import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import Sidebar from "./Sidebar.jsx";

describe("Sidebar", () => {
  it("makes the launch product primary and keeps support surfaces secondary", () => {
    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <Sidebar
          mobileOpen={false}
          setMobileOpen={() => {}}
          shellStats={{ inboxUnread: 3, leadsOpen: 5 }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Launch product")).toBeInTheDocument();
    expect(screen.getByText("Support and backoffice")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /^home$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^inbox/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^comments$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^voice$/i })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /^workspace$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /launch scope/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^pipeline/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^content$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^truth$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^expert$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^settings$/i })).toBeInTheDocument();
  });
});
