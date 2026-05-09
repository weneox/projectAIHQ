import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Executions from "../../pages/Executions.jsx";

describe("Executions", () => {
  it("stays intentionally stripped while this legacy surface is frozen for v1", () => {
    const { container } = render(<Executions />);
    expect(container.innerHTML).toBe("");
  });
});
