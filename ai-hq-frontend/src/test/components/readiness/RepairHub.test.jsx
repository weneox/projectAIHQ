import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import RepairHub from "../../../components/readiness/RepairHub.jsx";

afterEach(() => {
  cleanup();
});

describe("RepairHub", () => {
  it("renders unified blocker language and safe repair actions", () => {
    const onRunAction = vi.fn();

    render(
      <RepairHub
        title="Repair Hub"
        readiness={{
          status: "blocked",
          reasonCode: "provider_secret_missing",
        }}
        blockers={[
          {
            blocked: true,
            category: "meta",
            dependencyType: "provider_secret",
            reasonCode: "provider_secret_missing",
            title: "Provider secret blocker",
            subtitle: "Secret-backed delivery is unavailable.",
            missing: ["page_access_token"],
            nextAction: {
              id: "open_provider_secrets",
              kind: "admin_route",
              label: "Open secure secrets",
              requiredRole: "admin",
              allowed: false,
              target: {
                path: "/admin/secrets",
              },
            },
          },
        ]}
        canManage
        onRunAction={onRunAction}
      />
    );

    expect(screen.getByText(/provider secret blocker/i)).toBeInTheDocument();
    expect(screen.getByText(/missing: page_access_token/i)).toBeInTheDocument();
    expect(screen.getByText(/requires admin access/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open secure secrets/i }));
    expect(onRunAction).not.toHaveBeenCalled();
  });
});
