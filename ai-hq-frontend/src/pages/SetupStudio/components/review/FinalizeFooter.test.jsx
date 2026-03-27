/* @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import FinalizeFooter from "./FinalizeFooter.jsx";

globalThis.React = React;

afterEach(() => {
  cleanup();
});

describe("FinalizeFooter", () => {
  it("shows uncertainty-focused finalize guidance when weak evidence remains", () => {
    render(
      <FinalizeFooter
        savingBusiness={false}
        honestyMessage="Weak or partial source signals remain in this draft. Finalize only after reviewing those fields against visible evidence."
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByText(/weak or partial source signals remain/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /finalize reviewed truth/i })).toBeTruthy();
  });
});
