import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import OperationsPanel from "./OperationsPanel.jsx";

describe("OperationsPanel", () => {
  it("keeps backoffice tools accessible without mixing in the primary launch loops", () => {
    const onNavigate = vi.fn();

    render(
      <MemoryRouter initialEntries={["/truth"]}>
        <OperationsPanel open onClose={() => {}} onNavigate={onNavigate} />
      </MemoryRouter>
    );

    expect(screen.getByText(/internal and backoffice tools/i)).toBeTruthy();
    expect(screen.getByRole("link", { name: /incidents/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /leads/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /proposals/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /executions/i })).toBeTruthy();

    expect(screen.queryByRole("link", { name: /^comments$/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /^voice$/i })).toBeNull();

    fireEvent.click(screen.getByRole("link", { name: /incidents/i }));
    expect(onNavigate).toHaveBeenCalled();
  });
});
