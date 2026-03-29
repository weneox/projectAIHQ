import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import OperationsPanel from "./OperationsPanel.jsx";

describe("OperationsPanel", () => {
  it("renders secondary operator surfaces and closes on navigation", () => {
    const onNavigate = vi.fn();

    render(
      <MemoryRouter initialEntries={["/truth"]}>
        <OperationsPanel open onClose={() => {}} onNavigate={onNavigate} />
      </MemoryRouter>
    );

    expect(screen.getByText(/secondary operator tools/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /incidents/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /voice/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: /comments/i }));
    expect(onNavigate).toHaveBeenCalled();
  });
});
