import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import Sidebar from "./Sidebar.jsx";

describe("Sidebar", () => {
  it("keeps visible navigation aligned to the four primary product surfaces", () => {
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

    expect(screen.getByText("İdarə Mərkəzi")).toBeInTheDocument();
    expect(screen.getByText("Yazışmalar")).toBeInTheDocument();
    expect(screen.getByText("Yayım Mərkəzi")).toBeInTheDocument();
    expect(screen.getByText("Dərin İdarə")).toBeInTheDocument();

    expect(screen.queryByText("Setup Studio")).not.toBeInTheDocument();
    expect(screen.queryByText("Business Truth")).not.toBeInTheDocument();
    expect(screen.queryByText("Truth Control Plane")).not.toBeInTheDocument();
    expect(screen.queryByText("Incidents")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    expect(screen.queryByText("Operations")).not.toBeInTheDocument();

    expect(screen.queryByText("Agents")).not.toBeInTheDocument();
    expect(screen.queryByText("Analytics")).not.toBeInTheDocument();
    expect(screen.queryByText("Threads")).not.toBeInTheDocument();
    expect(screen.queryByText(/command demo/i)).not.toBeInTheDocument();
  });
});
