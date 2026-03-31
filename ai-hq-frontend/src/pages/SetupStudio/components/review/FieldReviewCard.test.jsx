/* @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import FieldReviewCard from "./FieldReviewCard.jsx";

globalThis.React = React;

afterEach(() => {
  cleanup();
});

describe("FieldReviewCard", () => {
  it("renders weak source honesty cues without pretending the field is strong", () => {
    render(
      <FieldReviewCard
        label="Primary phone"
        value=""
        observedValue="+15550001111"
        placeholder="Primary phone"
        needsAttention
        evidence={[{ label: "Website", value: "+15550001111", note: "Homepage footer" }]}
        honesty={{
          tone: "warn",
          label: "Weak signal",
          provenanceLabel: "Source-derived suggestion",
          note: "The current source support for this field is weak or incomplete, so the draft should be treated cautiously.",
        }}
        onChange={() => {}}
      />
    );

    expect(screen.getByText(/review-session draft/i)).toBeTruthy();
    expect(screen.getByText(/source-derived evidence/i)).toBeTruthy();
    expect(screen.getByText(/weak signal/i)).toBeTruthy();
    expect(screen.getByText(/source-derived suggestion/i)).toBeTruthy();
    expect(screen.getByText(/should be treated cautiously/i)).toBeTruthy();
    expect(screen.getAllByText("+15550001111").length).toBeGreaterThan(1);
    expect(screen.getByText(/homepage footer/i)).toBeTruthy();
  });
});
