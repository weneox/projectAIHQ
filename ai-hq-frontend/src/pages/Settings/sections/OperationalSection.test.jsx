/* @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import OperationalSection from "./OperationalSection.jsx";

globalThis.React = React;

afterEach(() => {
  cleanup();
});

describe("OperationalSection", () => {
  it("keeps the normal settings surface focused on launch-slice runtime controls", () => {
    render(
      <MemoryRouter>
        <OperationalSection
          canManage
          savingVoice={false}
          onSaveVoice={vi.fn()}
          surface={{
            loading: false,
            error: "",
            unavailable: false,
            ready: true,
            refresh: vi.fn(),
          }}
          permissionState={{
            operationalSettingsWrite: { allowed: true, message: "" },
          }}
          data={{
            voice: {
              settings: {
                enabled: true,
                defaultLanguage: "en",
                supportedLanguages: ["en", "az"],
                twilioPhoneNumber: "+15550001111",
                operatorPhone: "+15550002222",
                twilioConfig: {
                  callerId: "+15550001111",
                },
                instructions: "Handle receptionist calls politely.",
              },
              operational: { ready: false, reasonCode: "voice_phone_number_missing" },
            },
            channels: {
              meta: {
                operational: {
                  ready: false,
                  reasonCode: "channel_identifiers_missing",
                },
              },
            },
          }}
        />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: /voice runtime/i })
    ).toBeTruthy();
    expect(screen.getByText(/inbox & comments/i)).toBeTruthy();
    expect(screen.getByText(/business line/i)).toBeTruthy();
    expect(screen.getByText(/open integrations/i)).toBeTruthy();
    expect(screen.getByText(/voice runtime controls/i)).toBeTruthy();
    expect(screen.getByText(/receptionist instructions/i)).toBeTruthy();

    expect(screen.queryByText(/data retention & restore posture/i)).toBeNull();
    expect(screen.queryByText(/provider secret readiness/i)).toBeNull();
    expect(screen.queryByText(/backup and restore honesty/i)).toBeNull();
    expect(screen.queryByText(/save channel identifiers/i)).toBeNull();
  });
});
