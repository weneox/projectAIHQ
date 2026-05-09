import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AdminTenants from "../../pages/AdminTenants.jsx";

describe("AdminTenants", () => {
  it("stays intentionally stripped while this legacy surface is frozen for v1", () => {
    const { container } = render(<AdminTenants />);
    expect(container.innerHTML).toBe("");
  });
});
