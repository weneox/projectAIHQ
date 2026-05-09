import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Voice from "../../pages/Voice.jsx";

describe("Voice", () => {
  it("stays intentionally stripped while this legacy surface is frozen for v1", () => {
    const { container } = render(<Voice />);
    expect(container.innerHTML).toBe("");
  });
});
