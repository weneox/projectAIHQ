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
          label: "Low confidence",
          provenanceLabel: "Detected from source",
          note: "This value was detected with limited support and should be reviewed carefully before saving.",
        }}
        onChange={() => {}}
      />
    );

    expect(screen.getByText(/your draft/i)).toBeTruthy();
    expect(screen.getAllByText(/detected from source/i).length).toBeGreaterThan(1);
    expect(screen.getByText(/low confidence/i)).toBeTruthy();
    expect(screen.getAllByText(/detected from source/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/should be reviewed carefully before saving/i)).toBeTruthy();
    expect(screen.getAllByText("+15550001111").length).toBeGreaterThan(1);
    expect(screen.getByText(/homepage footer/i)).toBeTruthy();
  });
});
