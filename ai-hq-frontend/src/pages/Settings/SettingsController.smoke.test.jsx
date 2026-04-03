/* @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.React = React;

const navigateSpy = vi.fn();

vi.mock("react-router-dom", async () => {
  const ReactModule = await import("react");
  const React = ReactModule.default || ReactModule;

  const RouterContext = React.createContext({
    entry: { pathname: "/", search: "", hash: "", state: null },
    setEntry: () => {},
  });

  function splitEntry(input = "/") {
    const value = String(input || "/");
    const hashIndex = value.indexOf("#");
    const pathWithSearch = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
    const hash = hashIndex >= 0 ? value.slice(hashIndex) : "";
    const [pathnamePart, searchPart = ""] = pathWithSearch.split("?");

    return {
      pathname: pathnamePart || "/",
      search: searchPart ? `?${searchPart}` : "",
      hash,
      state: null,
    };
  }

  function MemoryRouter({ initialEntries = ["/"], children }) {
    const [entry, setEntry] = React.useState(() =>
      splitEntry(initialEntries[0] || "/")
    );

    const ctxValue = React.useMemo(
      () => ({
        entry,
        setEntry,
      }),
      [entry]
    );

    return (
      <RouterContext.Provider value={ctxValue}>
        {children}
      </RouterContext.Provider>
    );
  }

  function useSearchParams() {
    const { entry, setEntry } = React.useContext(RouterContext);

    const searchParams = React.useMemo(() => {
      const raw = entry.search.startsWith("?")
        ? entry.search.slice(1)
        : entry.search;
      return new URLSearchParams(raw);
    }, [entry.search]);

    const updateSearchParams = React.useCallback(
      (nextValue) => {
        setEntry((current) => {
          const currentParams = new URLSearchParams(
            current.search.startsWith("?")
              ? current.search.slice(1)
              : current.search
          );

          const resolved =
            typeof nextValue === "function"
              ? nextValue(currentParams)
              : nextValue;

          const nextParams = new URLSearchParams(resolved);
          const nextSearch = nextParams.toString();

          return {
            ...current,
            search: nextSearch ? `?${nextSearch}` : "",
          };
        });
      },
      [setEntry]
    );

    return [searchParams, updateSearchParams];
  }

  function useLocation() {
    const { entry } = React.useContext(RouterContext);
    return {
      pathname: entry.pathname,
      search: entry.search,
      hash: entry.hash || "",
      state: entry.state || null,
    };
  }

  function useNavigate() {
    return navigateSpy;
  }

  return {
    MemoryRouter,
    useLocation,
    useNavigate,
    useSearchParams,
  };
});

vi.mock("lucide-react", async () => {
  const ReactModule = await import("react");
  const React = ReactModule.default || ReactModule;

  function Icon(props) {
    return <svg data-testid="icon" aria-hidden="true" {...props} />;
  }

  return {
    BellRing: Icon,
    PhoneCall: Icon,
    RefreshCw: Icon,
    ShieldCheck: Icon,
    Users: Icon,
    Waypoints: Icon,
  };
});

vi.mock("../../lib/pushClient.js", () => ({
  askPermission: vi.fn().mockResolvedValue("default"),
  getNotificationPermission: vi.fn().mockResolvedValue("default"),
  subscribePush: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../../lib/controlPlanePermissions.js", () => ({
  getControlPlanePermissions: () => ({
    operationalSettingsWrite: {
      allowed: false,
      requiredRoles: ["owner", "admin"],
      message:
        "Only owner/admin can manage operational voice and channel settings.",
    },
  }),
}));

vi.mock("../../components/ui/Button.jsx", () => ({
  default: function Button({
    children,
    onClick,
    disabled = false,
    type = "button",
  }) {
    return (
      <button type={type} onClick={onClick} disabled={disabled}>
        {children}
      </button>
    );
  },
}));

vi.mock("../../components/ui/Badge.jsx", () => ({
  default: function Badge({ children }) {
    return <span>{children}</span>;
  },
}));

vi.mock("../../components/settings/SettingsShell.jsx", () => ({
  default: function SettingsShellMock({
    title,
    subtitle,
    items,
    activeKey,
    onChange,
    children,
  }) {
    return (
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <nav>
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              aria-pressed={activeKey === item.key}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div data-testid="active-section">{activeKey}</div>
        <div>{children}</div>
      </div>
    );
  },
}));

vi.mock("../../components/settings/ChannelsPanel.jsx", () => ({
  default: function ChannelsPanelMock({ canManage = true }) {
    return <div>{`Integrations panel ${canManage ? "write" : "read"}`}</div>;
  },
}));

vi.mock("../../components/settings/TeamPanel.jsx", () => ({
  default: function TeamPanelMock() {
    return <div>Team panel</div>;
  },
}));

vi.mock("../../components/settings/SettingsSaveBar.jsx", () => ({
  default: function SettingsSaveBarMock() {
    return <div>Settings save bar</div>;
  },
}));

vi.mock("./sections/AiPolicySection.jsx", () => ({
  default: function AiPolicySectionMock({ surface }) {
    return (
      <section>
        <h2>AI policy section</h2>
        <div>{surface?.saveSuccess || ""}</div>
      </section>
    );
  },
}));

vi.mock("./sections/OperationalSection.jsx", () => ({
  default: function OperationalSectionMock({ canManage }) {
    return (
      <section>
        <div>Operational section</div>
        <button type="button" disabled={!canManage}>
          Save voice settings
        </button>
      </section>
    );
  },
}));

vi.mock("./sections/NotificationsSection.jsx", () => ({
  default: function NotificationsSectionMock() {
    return <section>Notifications section</section>;
  },
}));

vi.mock("./hooks/useSettingsWorkspace.js", () => {
  const refresh = vi.fn().mockResolvedValue({ tenantKey: "tenant-a" });

  return {
    useSettingsWorkspace: () => ({
      surface: {
        loading: false,
        error: "",
        unavailable: false,
        ready: true,
        saving: false,
        saveError: "",
        saveSuccess: "Operational settings saved.",
        refresh,
        clearSaveState: vi.fn(),
      },
      workspace: {
        tenantKey: "tenant-a",
        viewerRole: "operator",
        aiPolicy: {},
        entitlements: {
          capabilities: {
            metaChannelConnect: { allowed: false },
          },
        },
      },
      dirty: false,
      dirtyMap: {},
      canManageSettings: true,
      tenantKey: "tenant-a",
      patchAi: vi.fn(),
      refreshWorkspace: refresh,
      onSaveWorkspace: vi.fn(),
      onResetWorkspace: vi.fn(),
    }),
  };
});

vi.mock("./hooks/useOperationalSettings.js", () => ({
  useOperationalSettings: () => ({
    surface: {
      loading: false,
      error: "",
      unavailable: false,
      ready: true,
      saving: false,
      saveError: "",
      saveSuccess: "",
      refresh: vi.fn().mockResolvedValue({}),
    },
    savingVoice: false,
    savingChannel: false,
    operationalData: {
      capabilities: {
        operationalSettingsWrite: {
          allowed: false,
          requiredRoles: ["owner", "admin"],
          message:
            "Only owner/admin can manage operational voice and channel settings.",
        },
      },
    },
    refreshOperationalSettings: vi.fn().mockResolvedValue({}),
    saveVoiceSettings: vi.fn().mockResolvedValue({}),
    saveChannelSettings: vi.fn().mockResolvedValue({}),
  }),
}));

import { MemoryRouter } from "react-router-dom";
import SettingsController from "./SettingsController.jsx";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  navigateSpy.mockReset();
  vi.stubGlobal("scrollTo", vi.fn());
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("Settings launch-slice smoke", () => {
  function renderPage(entry = "/settings") {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <SettingsController />
      </MemoryRouter>
    );
  }

  it("keeps only the launch-slice settings sections in normal navigation", async () => {
    renderPage();

    expect(await screen.findByText(/operator settings/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /ai policy/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /operational/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /integrations/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /team/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /notifications/i })).toBeTruthy();

    expect(
      screen.queryByRole("button", { name: /general/i })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /brand/i })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /truth governance/i })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /business facts/i })
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /agents/i })).toBeNull();

    expect(screen.getByTestId("active-section").textContent).toBe("ai_policy");
    expect(screen.getByText(/ai policy section/i)).toBeTruthy();
  });

  it("routes deprecated settings deep links to their proper product areas", async () => {
    renderPage("/settings?section=sources");
    expect(await screen.findByText(/operator settings/i)).toBeTruthy();
    expect(navigateSpy).toHaveBeenCalledWith("/truth", { replace: true });

    cleanup();
    navigateSpy.mockReset();

    renderPage("/settings?section=general");
    expect(await screen.findByText(/operator settings/i)).toBeTruthy();
    expect(navigateSpy).toHaveBeenCalledWith("/setup", { replace: true });
  });

  it("keeps plan-restricted integrations read-only", async () => {
    renderPage("/settings?section=channels");

    expect(await screen.findByText(/integrations panel read/i)).toBeTruthy();
  });
});
