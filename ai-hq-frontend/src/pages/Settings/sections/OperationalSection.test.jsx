/* @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import OperationalSection from "./OperationalSection.jsx";

globalThis.React = React;

vi.mock("../../../api/settings.js", () => ({
  getMetaConnectUrl: vi.fn(async () => ({ ok: true })),
}));

afterEach(() => {
  cleanup();
});

describe("OperationalSection", () => {
  it("renders retention and backup honesty posture", () => {
    render(
      <OperationalSection
        canManage
        savingVoice={false}
        savingChannel={false}
        onSaveVoice={vi.fn()}
        onSaveChannel={vi.fn()}
        surface={{
          loading: false,
          error: "",
          unavailable: false,
          ready: true,
          refresh: vi.fn(),
        }}
        permissionState={{
          operationalSettingsWrite: { allowed: true, message: "" },
          providerSecretsMutation: { allowed: true, message: "" },
        }}
        data={{
          voice: {
            settings: {},
            operational: { ready: true, reasonCode: "" },
            missingFields: [],
            repair: { blocked: false, reasonCode: "", nextAction: null },
          },
          channels: {
            meta: {
              operational: { ready: true, reasonCode: "" },
              missingFields: [],
              repair: { blocked: false, reasonCode: "", nextAction: null },
              providerSecrets: {
                ready: true,
                presentSecretKeys: ["page_access_token"],
                missingSecretKeys: [],
              },
              channel: {},
            },
          },
          readiness: {
            status: "ready",
            blockers: [],
          },
          dataGovernance: {
            retention: {
              items: [
                {
                  key: "runtime_incidents",
                  label: "Runtime incident trail",
                  status: "bounded",
                  retainDays: 14,
                  maxRows: 5000,
                  pruneIntervalHours: 6,
                  message: "Recent runtime incidents are pruned automatically.",
                },
                {
                  key: "audit_log",
                  label: "Control-plane audit history",
                  status: "unbounded_in_repo",
                  message: "No repo-enforced retention window is currently defined for audit_log rows.",
                },
              ],
            },
            backupRestore: {
              status: "runbook_only",
              message:
                "This repo does not create backups or provide self-serve restore.",
              runbooks: [
                "docs/runbooks/schema-migration-safety.md",
                "docs/runbooks/production-rollback.md",
              ],
            },
          },
        }}
      />
    );

    expect(screen.getByText(/data retention & restore posture/i)).toBeTruthy();
    expect(screen.getByText(/runtime incident trail/i)).toBeTruthy();
    expect(screen.getByText(/retain 14 days · max 5000 rows · prune every 6h/i)).toBeTruthy();
    expect(screen.getByText(/control-plane audit history/i)).toBeTruthy();
    expect(screen.getByText(/backup and restore honesty/i)).toBeTruthy();
    expect(
      screen.getByText(/does not create backups or provide self-serve restore/i)
    ).toBeTruthy();
  });
});
