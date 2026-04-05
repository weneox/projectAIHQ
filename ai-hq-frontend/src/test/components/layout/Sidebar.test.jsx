import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import Sidebar from "../../../components/layout/Sidebar.jsx";

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

    expect(screen.getByRole("link", { name: /ai hq home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /inbox 3/i })).toHaveAttribute(
      "href",
      "/inbox"
    );
    expect(screen.getByRole("link", { name: /pipeline 5/i })).toHaveAttribute(
      "href",
      "/leads"
    );

    for (const href of [
      "/home",
      "/comments",
      "/voice",
      "/workspace",
      "/channels",
      "/publish",
      "/truth",
    ]) {
      expect(document.querySelector(`a[href="${href}"]`)).toBeTruthy();
    }

    const linkOrder = Array.from(document.querySelectorAll('a[href]')).map(
      (link) => link.getAttribute("href")
    );

    expect(linkOrder.indexOf("/inbox")).toBeLessThan(linkOrder.indexOf("/workspace"));
    expect(linkOrder.indexOf("/voice")).toBeLessThan(linkOrder.indexOf("/channels"));
  });
});
