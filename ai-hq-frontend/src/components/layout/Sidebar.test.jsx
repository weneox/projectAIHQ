import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import Sidebar from "./Sidebar.jsx";

describe("Sidebar", () => {
  it("keeps the visible navigation aligned to the core product surface", () => {
    render(
      <MemoryRouter>
        <Sidebar
          expanded
          setExpanded={() => {}}
          mobileOpen={false}
          setMobileOpen={() => {}}
          shellStats={{ inboxUnread: 3 }}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Truth Control Plane")).toBeInTheDocument();
    expect(screen.getByText("Setup Studio")).toBeInTheDocument();
    expect(screen.getByText("Inbox")).toBeInTheDocument();
    expect(screen.getByText("Incidents")).toBeInTheDocument();
    expect(screen.getByText("Business Truth")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();

    expect(screen.queryByText("Executive Command")).not.toBeInTheDocument();
    expect(screen.queryByText("Agents")).not.toBeInTheDocument();
    expect(screen.queryByText("Analytics")).not.toBeInTheDocument();
    expect(screen.queryByText("Threads")).not.toBeInTheDocument();
    expect(screen.queryByText(/command demo/i)).not.toBeInTheDocument();
  });
});
