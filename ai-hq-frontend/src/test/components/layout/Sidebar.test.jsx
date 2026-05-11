import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import Sidebar from "../../../components/layout/Sidebar.jsx";

describe("Sidebar", () => {
  it("shows the product navigation and keeps legacy/internal surfaces out of the shell", () => {
    render(
      <MemoryRouter initialEntries={["/inbox"]}>
        <Sidebar
          mobileOpen={false}
          setMobileOpen={() => {}}
          shellStats={{ inboxUnread: 3, leadsOpen: 5 }}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("link", { name: /^home$/i })).toHaveAttribute(
      "href",
      "/home"
    );
    expect(screen.getByRole("link", { name: /inbox 3/i })).toHaveAttribute(
      "href",
      "/inbox"
    );
    expect(screen.getByRole("link", { name: /^channels$/i })).toHaveAttribute(
      "href",
      "/channels"
    );
    expect(
      screen.getByRole("link", { name: /^business info$/i })
    ).toHaveAttribute("href", "/truth");
    expect(screen.getByRole("link", { name: /^contacts$/i })).toHaveAttribute(
      "href",
      "/customers"
    );
    expect(screen.getByRole("link", { name: /^leads$/i })).toHaveAttribute(
      "href",
      "/leads"
    );
    expect(screen.getByRole("link", { name: /^knowledge$/i })).toHaveAttribute(
      "href",
      "/knowledge"
    );
    expect(screen.getByRole("link", { name: /^reports$/i })).toHaveAttribute(
      "href",
      "/reports"
    );
    expect(screen.getByRole("link", { name: /^team$/i })).toHaveAttribute(
      "href",
      "/team"
    );
    expect(screen.getByRole("link", { name: /^settings$/i })).toHaveAttribute(
      "href",
      "/settings"
    );

    const expectedVisibleHrefs = [
      "/home",
      "/inbox",
      "/channels",
      "/truth",
      "/customers",
      "/leads",
      "/knowledge",
      "/reports",
      "/team",
      "/settings",
    ];

    for (const href of expectedVisibleHrefs) {
      expect(document.querySelector(`a[href="${href}"]`)).toBeTruthy();
    }

    for (const href of [
      "/home?assistant=setup",
      "/setup",
      "/comments",
      "/voice",
      "/workspace",
      "/launch",
      "/publish",
      "/proposals",
      "/executions",
      "/incidents",
      "/admin",
    ]) {
      expect(document.querySelector(`a[href="${href}"]`)).toBeNull();
    }

    const linkOrder = Array.from(document.querySelectorAll("a[href]")).map(
      (link) => link.getAttribute("href")
    );

    for (let i = 0; i < expectedVisibleHrefs.length - 1; i += 1) {
      expect(linkOrder.indexOf(expectedVisibleHrefs[i])).toBeLessThan(
        linkOrder.indexOf(expectedVisibleHrefs[i + 1])
      );
    }
  });
});
