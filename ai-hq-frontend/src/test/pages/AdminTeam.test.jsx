import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AdminTeam from "../../pages/AdminTeam.jsx";

describe("AdminTeam", () => {
  it("stays intentionally stripped while this legacy surface is frozen for v1", () => {
    const { container } = render(<AdminTeam />);
    expect(container.innerHTML).toBe("");
  });
});
