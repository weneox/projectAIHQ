import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAppAuthContext = vi.fn();
const getAppSessionContext = vi.fn();
const peekAppAuthContext = vi.fn();
const peekAppSessionContext = vi.fn();
const isLocalWorkspaceEntryEnabled = vi.fn();

vi.mock("../../../lib/appSession.js", () => ({
  getAppAuthContext: (...args) => getAppAuthContext(...args),
  getAppSessionContext: (...args) => getAppSessionContext(...args),
  peekAppAuthContext: (...args) => peekAppAuthContext(...args),
  peekAppSessionContext: (...args) => peekAppSessionContext(...args),
}));

vi.mock("../../../lib/appEntry.js", () => ({
  isLocalWorkspaceEntryEnabled: (...args) => isLocalWorkspaceEntryEnabled(...args),
}));

vi.mock("../../../components/loading/AppBootSurface.jsx", () => ({
  default: ({ label, detail }) => (
    <div>
      {label}
      {detail}
    </div>
  ),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }) => <div data-testid="navigate">{to}</div>,
  };
});

import OperatorRouteGuard from "../../../components/auth/OperatorRouteGuard.jsx";

describe("OperatorRouteGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isLocalWorkspaceEntryEnabled.mockReturnValue(false);
    peekAppAuthContext.mockReturnValue(null);
    peekAppSessionContext.mockReturnValue(null);
    getAppAuthContext.mockResolvedValue({
      authenticated: true,
      user: { role: "operator" },
      membership: { role: "operator" },
      workspace: { role: "operator" },
    });
  });

  it("renders operator routes when the session is authenticated and allowed", async () => {
    getAppSessionContext.mockResolvedValue({
      auth: { authenticated: true },
      viewerRole: "operator",
      bootstrap: { workspace: { tenantKey: "acme" } },
      bootstrapAvailable: true,
    });

    render(
      <MemoryRouter initialEntries={["/comments"]}>
        <OperatorRouteGuard>
          <div>Comments route</div>
        </OperatorRouteGuard>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Comments route")).toBeInTheDocument();
    });
  });

  it.each([
    ["/comments", "Comments route"],
    ["/voice", "Voice route"],
  ])(
    "keeps %s reachable when auth is valid but session composition fails",
    async (path, label) => {
      getAppSessionContext.mockRejectedValue(new Error("session unavailable"));

      render(
        <MemoryRouter initialEntries={[path]}>
          <OperatorRouteGuard>
            <div>{label}</div>
          </OperatorRouteGuard>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });

      expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
    }
  );

  it.each([
    ["/comments", "Comments route"],
    ["/voice", "Voice route"],
  ])(
    "keeps direct operator entry to %s reachable when bootstrap is unavailable but auth is valid",
    async (path, label) => {
      getAppSessionContext.mockResolvedValue({
        auth: { authenticated: true },
        viewerRole: "owner",
        bootstrap: {},
        bootstrapAvailable: false,
      });

      render(
        <MemoryRouter initialEntries={[path]}>
          <OperatorRouteGuard>
            <div>{label}</div>
          </OperatorRouteGuard>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });

      expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
    }
  );

  it("shows access denied instead of redirecting to login when auth is valid but role is insufficient", async () => {
    getAppAuthContext.mockResolvedValue({
      authenticated: true,
      user: { role: "member" },
      membership: { role: "member" },
      workspace: { role: "member" },
    });
    getAppSessionContext.mockRejectedValue(new Error("session unavailable"));

    render(
      <MemoryRouter initialEntries={["/voice"]}>
        <OperatorRouteGuard>
          <div>Voice route</div>
        </OperatorRouteGuard>
      </MemoryRouter>
    );

    expect(
      await screen.findByText("Operator access required")
    ).toBeInTheDocument();
    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
  });

  it.each([
    ["/comments", "Comments route"],
    ["/voice", "Voice route"],
  ])(
    "keeps %s reachable from cached operator auth when live auth refresh fails",
    async (path, label) => {
      peekAppAuthContext.mockReturnValue({
        authenticated: true,
        user: { role: "operator" },
        membership: { role: "operator" },
        workspace: { role: "operator" },
      });
      getAppAuthContext.mockRejectedValue(new Error("auth unavailable"));

      render(
        <MemoryRouter initialEntries={[path]}>
          <OperatorRouteGuard>
            <div>{label}</div>
          </OperatorRouteGuard>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });

      expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
    }
  );

  it("redirects to login only when the session is genuinely unauthenticated", async () => {
    getAppAuthContext.mockResolvedValue({
      authenticated: false,
    });

    render(
      <MemoryRouter initialEntries={["/voice"]}>
        <OperatorRouteGuard>
          <div>Voice route</div>
        </OperatorRouteGuard>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("navigate")).toHaveTextContent("/login");
    });
  });

  it("shows an unavailable surface instead of a login redirect when auth verification fails", async () => {
    getAppAuthContext.mockRejectedValue(new Error("auth unavailable"));

    render(
      <MemoryRouter initialEntries={["/voice"]}>
        <OperatorRouteGuard>
          <div>Voice route</div>
        </OperatorRouteGuard>
      </MemoryRouter>
    );

    expect(
      await screen.findByText((content) =>
        content.includes("Operator surface unavailable")
      )
    ).toBeInTheDocument();
    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
  });

  it.each([
    ["/comments", "Comments route"],
    ["/voice", "Voice route"],
    ["/leads", "Leads route"],
    ["/publish", "Publish route"],
    ["/proposals", "Proposals route"],
    ["/incidents", "Incidents route"],
    ["/truth", "Truth route"],
    ["/executions", "Executions route"],
  ])(
    "allows %s through the intended local workspace-entry path without auth revalidation",
    async (path, label) => {
      isLocalWorkspaceEntryEnabled.mockReturnValue(true);
      getAppAuthContext.mockRejectedValue(new Error("auth unavailable"));

      render(
        <MemoryRouter initialEntries={[path]}>
          <OperatorRouteGuard>
            <div>{label}</div>
          </OperatorRouteGuard>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });

      expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
      expect(
        screen.queryByText((content) =>
          content.includes("Operator surface unavailable")
        )
      ).not.toBeInTheDocument();
    }
  );
});
