/* @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ChangeHistorySection from "./ChangeHistorySection.jsx";

globalThis.React = React;

afterEach(() => {
  cleanup();
});

describe("ChangeHistorySection", () => {
  it("renders filtered safe audit history for authorized viewers", () => {
    render(
      <ChangeHistorySection
        viewerRole="admin"
        surface={{
          loading: false,
          error: "",
          unavailable: false,
          ready: true,
          refresh: () => {},
        }}
        history={{
          viewerRole: "admin",
          permissions: {
            auditHistoryRead: {
              allowed: true,
            },
          },
          filters: {
            availableAreas: [
              { key: "secrets", label: "Provider Secrets" },
              { key: "operational", label: "Operational" },
            ],
            availableOutcomes: [
              { key: "succeeded", label: "Succeeded" },
              { key: "blocked", label: "Blocked" },
            ],
          },
          summary: {
            total: 2,
            outcomes: {
              succeeded: 1,
              blocked: 1,
              failed: 0,
            },
            areaItems: [
              { key: "secrets", label: "Provider Secrets", count: 1 },
              { key: "operational", label: "Operational", count: 1 },
            ],
          },
          items: [
            {
              id: "audit-1",
              area: "secrets",
              areaLabel: "Provider Secrets",
              outcome: "succeeded",
              actionLabel: "Provider secret saved",
              actor: "owner@acme.test",
              tenantKey: "acme",
              createdAt: "2026-03-27T09:00:00.000Z",
              details: [{ label: "Provider", value: "meta" }],
            },
            {
              id: "audit-2",
              area: "operational",
              areaLabel: "Operational",
              outcome: "blocked",
              actionLabel: "Channel settings updated",
              actor: "admin@acme.test",
              tenantKey: "acme",
              createdAt: "2026-03-27T08:00:00.000Z",
              details: [{ label: "Channel", value: "instagram" }],
            },
          ],
        }}
      />
    );

    expect(screen.getByText(/change history/i)).toBeTruthy();
    expect(screen.getByText(/provider secret saved/i)).toBeTruthy();
    expect(screen.queryByText(/tokenvalue/i)).toBeNull();

    fireEvent.change(screen.getByDisplayValue(/all areas/i), {
      target: { value: "operational" },
    });

    expect(screen.queryByText(/provider secret saved/i)).toBeNull();
    expect(screen.getByText(/channel settings updated/i)).toBeTruthy();
  });

  it("shows a permission notice for insufficient roles", () => {
    render(
      <ChangeHistorySection
        viewerRole="operator"
        surface={{
          loading: false,
          error: "",
          unavailable: false,
          ready: true,
          refresh: () => {},
        }}
        history={{
          viewerRole: "operator",
          permissions: {
            auditHistoryRead: {
              allowed: false,
              message: "Only owner/admin/analyst can read control-plane audit history.",
            },
          },
          summary: {
            total: 0,
            outcomes: {},
            areaItems: [],
          },
          items: [],
        }}
      />
    );

    expect(screen.getByText(/only owner\/admin\/analyst can read control-plane audit history/i)).toBeTruthy();
  });
});
