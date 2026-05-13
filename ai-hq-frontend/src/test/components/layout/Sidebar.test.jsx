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

    expect(
      screen.getByRole("link", { name: /^müştəri mərkəzi$/i })
    ).toHaveAttribute("href", "/home");
    expect(screen.getByRole("link", { name: /gələnlər 3/i })).toHaveAttribute(
      "href",
      "/inbox"
    );
    expect(screen.getByRole("link", { name: /^kanallar$/i })).toHaveAttribute(
      "href",
      "/channels"
    );
    expect(
      screen.getByRole("link", { name: /^məlumatlar$/i })
    ).toHaveAttribute("href", "/truth");
    expect(screen.getByText("Əməliyyat")).toBeInTheDocument();
    expect(screen.getByText("CRM")).toBeInTheDocument();
    expect(screen.getByText("Analitika")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^müştərilər$/i })).toHaveAttribute(
      "href",
      "/customers"
    );
    expect(screen.getByRole("link", { name: /fürsətlər 5/i })).toHaveAttribute(
      "href",
      "/leads"
    );
    expect(screen.getByRole("link", { name: /^hesabat$/i })).toHaveAttribute(
      "href",
      "/reports"
    );
    expect(screen.getByRole("link", { name: /^baza$/i })).toHaveAttribute(
      "href",
      "/knowledge"
    );
    expect(screen.getByRole("link", { name: /^canlı yoxlama$/i })).toHaveAttribute(
      "href",
      "/launch"
    );
    expect(screen.getByRole("link", { name: /^komanda$/i })).toHaveAttribute(
      "href",
      "/team"
    );
    expect(screen.getByRole("link", { name: /^ayarlar$/i })).toHaveAttribute(
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
      "/reports",
      "/knowledge",
      "/launch",
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
