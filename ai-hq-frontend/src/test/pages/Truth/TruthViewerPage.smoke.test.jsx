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
      screen.getByRole("heading", { name: /business info/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/approved business truth/i)).toBeInTheDocument();
    expect(screen.getByText(/company identity/i)).toBeInTheDocument();
    expect(screen.getByText(/services/i)).toBeInTheDocument();
    expect(screen.getByText(/pricing & offer/i)).toBeInTheDocument();
    expect(screen.getByText(/policies/i)).toBeInTheDocument();
    expect(screen.getByText(/contact & handoff/i)).toBeInTheDocument();
    expect(screen.getByText(/assistant boundaries/i)).toBeInTheDocument();
  });

  it("keeps truth fields locked by default", () => {
    renderPage();

    expect(screen.getAllByText(/^locked$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/company name/i)).toBeInTheDocument();
    expect(screen.getByText(/neosentic/i)).toBeInTheDocument();
  });

  it("opens the edit dialog for a business section", () => {
    renderPage();

    const editButtons = screen.getAllByRole("button", { name: /^edit$/i });
    fireEvent.click(editButtons[0]);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/edit business truth/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("saves edited business information back into the read-only surface", () => {
    renderPage();

    const editButtons = screen.getAllByRole("button", { name: /^edit$/i });
    fireEvent.click(editButtons[0]);

    const input = screen.getByDisplayValue("Neosentic");
    fireEvent.change(input, { target: { value: "Neosentic Group" } });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText(/neosentic group/i)).toBeInTheDocument();
  });
});
