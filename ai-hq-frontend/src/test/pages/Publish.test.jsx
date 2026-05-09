import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import PublishPage from "../../pages/Publish.jsx";

describe("PublishPage", () => {
  it("stays intentionally stripped while the publish surface is frozen for v1", () => {
    const { container } = render(
      <MemoryRouter>
        <PublishPage />
      </MemoryRouter>
    );

    expect(container.innerHTML).toBe("");
  });
});
