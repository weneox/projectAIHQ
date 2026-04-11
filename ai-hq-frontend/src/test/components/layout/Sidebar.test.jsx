import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import Sidebar from "../../../components/layout/Sidebar.jsx";

describe("Sidebar", () => {
  it("shows the simplified launch navigation and keeps hidden surfaces out of the shell", () => {
    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <Sidebar
          mobileOpen={false}
          setMobileOpen={() => {}}
          shellStats={{ inboxUnread: 3, leadsOpen: 5 }}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /ai hq home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /inbox 3/i })).toHaveAttribute(
      "href",
      "/inbox"
    );
    expect(screen.getByRole("link", { name: /channels/i })).toHaveAttribute(
      "href",
      "/channels"
    );
    expect(screen.getByRole("link", { name: /truth/i })).toHaveAttribute(
      "href",
      "/truth"
    );

    for (const href of ["/home", "/inbox", "/channels", "/truth"]) {
      expect(document.querySelector(`a[href="${href}"]`)).toBeTruthy();
    }

    for (const href of [
      "/comments",
      "/voice",
      "/workspace",
      "/publish",
      "/leads",
      "/proposals",
      "/executions",
    ]) {
      expect(document.querySelector(`a[href="${href}"]`)).toBeNull();
    }

    const linkOrder = Array.from(document.querySelectorAll('a[href]')).map(
      (link) => link.getAttribute("href")
    );

    expect(linkOrder.indexOf("/home")).toBeLessThan(linkOrder.indexOf("/inbox"));
    expect(linkOrder.indexOf("/inbox")).toBeLessThan(linkOrder.indexOf("/channels"));
    expect(linkOrder.indexOf("/channels")).toBeLessThan(linkOrder.indexOf("/truth"));
  });
});
