import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AdminPageShell from "../../../components/admin/AdminPageShell.jsx";

describe("AdminPageShell", () => {
  it("renders page metadata, shared banners, and header actions", () => {
    const refresh = vi.fn();

    render(
      <AdminPageShell
        eyebrow="Ops"
        title="Execution Center"
        description="Run list"
        surface={{
          loading: false,
          error: "",
          unavailable: true,
          saving: false,
          saveError: "",
          saveSuccess: "Retry accepted.",
          refresh,
        }}
        refreshLabel="Refresh surface"
        unavailableMessage="Execution surface unavailable."
        actions={<button type="button">Custom action</button>}
      >
        <div>Page content</div>
      </AdminPageShell>
    );

    expect(screen.getByText("Execution Center")).toBeInTheDocument();
    expect(screen.getByText("Retry accepted.")).toBeInTheDocument();
    expect(screen.getByText("Execution surface unavailable.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /refresh surface/i })).toHaveLength(2);
    expect(screen.getByRole("button", { name: /custom action/i })).toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeInTheDocument();
  });
});
