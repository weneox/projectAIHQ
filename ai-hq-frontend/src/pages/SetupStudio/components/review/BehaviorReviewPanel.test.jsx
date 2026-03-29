/* @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import BehaviorReviewPanel from "./BehaviorReviewPanel.jsx";

globalThis.React = React;

afterEach(() => {
  cleanup();
});

describe("BehaviorReviewPanel", () => {
  it("updates behavior and channel preview controls through the shared behavior object", () => {
    const onChange = vi.fn();

    render(
      <BehaviorReviewPanel
        value={{
          businessType: "clinic",
          conversionGoal: "book_consultation",
          primaryCta: "Book your consultation",
          leadQualificationMode: "service_booking_triage",
          qualificationQuestions: ["What treatment are you interested in?"],
          handoffTriggers: ["human_request"],
          disallowedClaims: ["diagnosis_or_treatment_guarantees"],
          toneProfile: "professional",
          channelBehavior: {
            inbox: {
              primaryAction: "qualify_and_capture",
              qualificationDepth: "guided",
              handoffBias: "conditional",
            },
          },
        }}
        observedValue={{
          nicheBehavior: {
            toneProfile: "warm_reassuring",
            handoffTriggers: ["human_request"],
            channelBehavior: {
              comments: {
                primaryAction: "qualify_then_move_to_dm",
              },
            },
          },
        }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /^warm$/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        toneProfile: "warm_reassuring",
      })
    );

    fireEvent.click(screen.getByRole("button", { name: /book or route/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        channelBehavior: expect.objectContaining({
          voice: expect.objectContaining({
            primaryAction: "book_or_route_call",
          }),
        }),
      })
    );

    expect(screen.getByText(/observed suggestion/i)).toBeTruthy();
    expect(screen.getByText(/review-session behavior evidence/i)).toBeTruthy();
    expect(screen.getAllByText(/cta direction/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tone and style/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/qualification behavior/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/handoff bias/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/safety posture/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/book your consultation/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/starts by asking "what treatment are you interested in\?"/i).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/avoids diagnosis or treatment guarantees claims/i).length).toBeGreaterThan(0);
  });
});
