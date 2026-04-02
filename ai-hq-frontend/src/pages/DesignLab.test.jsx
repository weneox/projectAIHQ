/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import DesignLab from "./DesignLab.jsx";

afterEach(() => {
  cleanup();
});

describe("DesignLab", () => {
  it("renders the internal note and typography review examples", () => {
    render(<DesignLab />);

    expect(
      screen.getByRole("heading", { name: /design lab/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/internal design sandbox/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/page title/i)).toBeInTheDocument();
    expect(screen.getByText(/section title/i)).toBeInTheDocument();
    expect(screen.getByText(/body copy/i)).toBeInTheDocument();
    expect(screen.getByText(/long paragraph/i)).toBeInTheDocument();
    expect(screen.getByText(/empty-state text/i)).toBeInTheDocument();
  });
});
