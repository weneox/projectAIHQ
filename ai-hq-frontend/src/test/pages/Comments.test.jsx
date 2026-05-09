import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Comments from "../../pages/Comments.jsx";

describe("Comments", () => {
  it("stays intentionally stripped while this legacy surface is frozen for v1", () => {
    const { container } = render(<Comments />);
    expect(container.innerHTML).toBe("");
  });
});
