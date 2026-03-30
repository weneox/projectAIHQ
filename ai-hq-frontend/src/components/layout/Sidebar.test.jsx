import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import Sidebar from "./Sidebar.jsx";

describe("Sidebar", () => {
  it("renders the command rail and inbox contextual rail without exposing old dashboard navigation", () => {
    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <Sidebar
          mobileOpen={false}
          setMobileOpen={() => {}}
          shellStats={{ inboxUnread: 3, leadsOpen: 5 }}
        />
      </MemoryRouter>
    );

    expect(screen.getByLabelText("Workspace")).toBeInTheDocument();
    expect(screen.getByLabelText("Inbox")).toBeInTheDocument();
    expect(screen.getByLabelText("Contacts")).toBeInTheDocument();
    expect(screen.getByLabelText("Publish")).toBeInTheDocument();
    expect(screen.getByLabelText("Calls")).toBeInTheDocument();
    expect(screen.getByLabelText("Intelligence")).toBeInTheDocument();
    expect(screen.getByLabelText("Expert")).toBeInTheDocument();
    expect(screen.getByLabelText("Settings")).toBeInTheDocument();

    expect(screen.getByText("Conversation ops")).toBeInTheDocument();
    expect(screen.getByText("All conversations")).toBeInTheDocument();
    expect(screen.getByText("Voice queue")).toBeInTheDocument();
    expect(screen.getByText("Mine")).toBeInTheDocument();

    expect(screen.queryByText("İdarə Mərkəzi")).not.toBeInTheDocument();
    expect(screen.queryByText("Yazışmalar")).not.toBeInTheDocument();
    expect(screen.queryByText("Yayım Mərkəzi")).not.toBeInTheDocument();
    expect(screen.queryByText("Dərin İdarə")).not.toBeInTheDocument();
  });
});
