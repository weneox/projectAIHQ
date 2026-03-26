import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./hooks/useAdminTenantsSurface.js", () => ({
  useAdminTenantsSurface: () => ({
    items: [],
    filtered: [],
    selected: null,
    selectedKey: "",
    setSelectedKey: vi.fn(),
    query: "",
    setQuery: vi.fn(),
    form: {
      tenant_key: "",
      company_name: "",
      owner_email: "",
      owner_password: "",
    },
    patchForm: vi.fn(),
    surface: {
      loading: false,
      error: "",
      unavailable: true,
      ready: false,
      saving: false,
      saveError: "",
      saveSuccess: "tenant-a tenant created.",
      refresh: vi.fn(),
      clearSaveState: vi.fn(),
    },
    actionState: {
      pendingAction: "",
      isActionPending: vi.fn().mockReturnValue(false),
    },
    createTenantRecord: vi.fn(),
    exportJson: vi.fn(),
    exportCsv: vi.fn(),
    exportZip: vi.fn(),
  }),
}));

import AdminTenants from "./AdminTenants.jsx";

afterEach(() => {
  cleanup();
});

describe("AdminTenants", () => {
  it("renders shared surface banner feedback", () => {
    render(<AdminTenants />);

    expect(screen.getByText(/tenant-a tenant created/i)).toBeInTheDocument();
    expect(screen.getByText(/tenant administration is temporarily unavailable/i)).toBeInTheDocument();
  });
});
