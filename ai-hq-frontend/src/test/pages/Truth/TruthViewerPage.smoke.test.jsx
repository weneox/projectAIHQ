/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import TruthViewerPage from "../../../pages/Truth/TruthViewerPage.jsx";

afterEach(() => {
  cleanup();
});

describe("Truth viewer smoke", () => {
  function renderPage() {
    return render(
      <MemoryRouter initialEntries={["/truth"]}>
        <TruthViewerPage />
      </MemoryRouter>
    );
  }

  it("renders the current v1 business info surface", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: /^business info$/i })
    ).toBeInTheDocument();

    expect(document.body).toHaveTextContent(/approved business truth/i);
    expect(screen.getAllByText(/^company identity$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^services$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^pricing & offer$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^policies$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^contact & handoff$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^assistant boundaries$/i).length).toBeGreaterThan(0);
  });

  it("keeps truth fields locked by default", () => {
    renderPage();

    expect(screen.getAllByText(/^locked$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^company name$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^neosentic$/i).length).toBeGreaterThan(0);
  });

  it("opens the edit dialog for a business section", () => {
    renderPage();

    const editButtons = screen.getAllByRole("button", { name: /^edit$/i });
    fireEvent.click(editButtons[0]);

    expect(document.body).toHaveTextContent(/edit business truth/i);
    expect(screen.getAllByRole("button", { name: /save changes/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /cancel/i }).length).toBeGreaterThan(0);
  });

  it("saves edited business information back into the read-only surface", () => {
    renderPage();

    const editButtons = screen.getAllByRole("button", { name: /^edit$/i });
    fireEvent.click(editButtons[0]);

    const input = screen.getByDisplayValue("Neosentic");
    fireEvent.change(input, { target: { value: "Neosentic Group" } });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(document.body).not.toHaveTextContent(/edit business truth/i);
    expect(screen.getByText(/neosentic group/i)).toBeInTheDocument();
  });
});
