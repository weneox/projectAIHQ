import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api/settings.js", () => ({
  getTenantBusinessFacts: vi.fn(),
  saveTenantBusinessFact: vi.fn(),
  deleteTenantBusinessFact: vi.fn(),
  getTenantChannelPolicies: vi.fn(),
  saveTenantChannelPolicy: vi.fn(),
  deleteTenantChannelPolicy: vi.fn(),
  getTenantLocations: vi.fn(),
  saveTenantLocation: vi.fn(),
  deleteTenantLocation: vi.fn(),
  getTenantContacts: vi.fn(),
  saveTenantContact: vi.fn(),
  deleteTenantContact: vi.fn(),
}));

import {
  getTenantBusinessFacts,
  getTenantChannelPolicies,
  getTenantContacts,
  getTenantLocations,
  saveTenantContact,
  saveTenantBusinessFact,
} from "../../../api/settings.js";
import { useBusinessBrain } from "./useBusinessBrain.js";

describe("useBusinessBrain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the unified surface contract on refresh", async () => {
    getTenantBusinessFacts.mockResolvedValue([{ id: "fact-1" }]);
    getTenantChannelPolicies.mockResolvedValue([{ id: "policy-1" }]);
    getTenantLocations.mockResolvedValue([{ id: "location-1" }]);
    getTenantContacts.mockResolvedValue([{ id: "contact-1" }]);

    const { result } = renderHook(() =>
      useBusinessBrain({
        canManageSettings: true,
        setWorkspace: vi.fn(),
        setInitialWorkspace: vi.fn(),
      })
    );

    await result.current.refreshBusinessBrain();

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    expect(result.current.businessFacts).toHaveLength(1);
    expect(result.current.channelPolicies).toHaveLength(1);
    expect(typeof result.current.surface.refresh).toBe("function");
  });

  it("uses the shared save-state vocabulary for business-brain saves", async () => {
    getTenantBusinessFacts.mockResolvedValue([]);
    getTenantChannelPolicies.mockResolvedValue([]);
    getTenantLocations.mockResolvedValue([]);
    getTenantContacts.mockResolvedValue([]);
    saveTenantBusinessFact.mockResolvedValue({ ok: true });

    const { result } = renderHook(() =>
      useBusinessBrain({
        canManageSettings: true,
        setWorkspace: vi.fn(),
        setInitialWorkspace: vi.fn(),
      })
    );

    await result.current.handleSaveBusinessFact({
      fact_key: "pricing_policy",
      title: "Pricing Policy",
    });

    await waitFor(() => {
      expect(result.current.surface.saveSuccess).toMatch(/business fact saved/i);
    });
  });

  it("uses a staged-review success message for governed business-fact changes", async () => {
    getTenantBusinessFacts.mockResolvedValue([]);
    getTenantChannelPolicies.mockResolvedValue([]);
    getTenantLocations.mockResolvedValue([]);
    getTenantContacts.mockResolvedValue([]);
    saveTenantBusinessFact.mockResolvedValue({
      ok: true,
      publishStatus: "review_required",
      reviewRequired: true,
    });

    const { result } = renderHook(() =>
      useBusinessBrain({
        canManageSettings: true,
        setWorkspace: vi.fn(),
        setInitialWorkspace: vi.fn(),
      })
    );

    await result.current.handleSaveBusinessFact({
      fact_key: "company_summary",
      title: "Company Summary",
    });

    await waitFor(() => {
      expect(result.current.surface.saveSuccess).toMatch(/staged for maintenance review/i);
    });
  });

  it("uses a staged-review success message for governed contact changes", async () => {
    getTenantBusinessFacts.mockResolvedValue([]);
    getTenantChannelPolicies.mockResolvedValue([]);
    getTenantLocations.mockResolvedValue([]);
    getTenantContacts.mockResolvedValue([]);
    saveTenantContact.mockResolvedValue({
      ok: true,
      publishStatus: "review_required",
      reviewRequired: true,
    });

    const { result } = renderHook(() =>
      useBusinessBrain({
        canManageSettings: true,
        setWorkspace: vi.fn(),
        setInitialWorkspace: vi.fn(),
      })
    );

    await result.current.handleSaveContact({
      contact_key: "main-phone",
      channel: "phone",
      value: "+15550001111",
    });

    await waitFor(() => {
      expect(result.current.surface.saveSuccess).toMatch(/staged for maintenance review/i);
    });
  });
});
