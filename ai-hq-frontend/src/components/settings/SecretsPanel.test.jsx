import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./hooks/useSecretsSurface.js", () => ({
  useSecretsSurface: () => ({
    provider: "meta",
    setProvider: vi.fn(),
    presetKeys: ["api_key"],
    secretKey: "",
    setSecretKey: vi.fn(),
    secretValue: "",
    setSecretValue: vi.fn(),
    secrets: [
      {
        id: "secret-1",
        provider: "meta",
        secret_key: "api_key",
        masked_value: "***",
        version: 1,
      },
    ],
    surface: {
      loading: false,
      error: "",
      unavailable: true,
      ready: false,
      saving: false,
      saveError: "",
      saveSuccess: "meta.api_key saved.",
      refresh: vi.fn(),
      clearSaveState: vi.fn(),
    },
    refreshSecrets: vi.fn(),
    saveSecret: vi.fn(),
    removeSecret: vi.fn(),
  }),
}));

import SecretsPanel from "./SecretsPanel.jsx";

afterEach(() => {
  cleanup();
});

describe("SecretsPanel", () => {
  it("renders shared surface banner feedback for admin secret async state", () => {
    render(<SecretsPanel canManage />);

    expect(screen.getByText(/meta\.api_key saved/i)).toBeInTheDocument();
    expect(screen.getByText(/secret management is temporarily unavailable/i)).toBeInTheDocument();
  });

  it("renders provider secret access as read-only for insufficient roles", () => {
    render(
      <SecretsPanel
        canManage={false}
        permissionMessage="Provider secret changes stay behind owner/admin access."
      />
    );

    expect(
      screen.getByText(/provider secret changes stay behind owner\/admin access/i)
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save secret/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /use key/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /delete/i })).toBeDisabled();
  });
});
