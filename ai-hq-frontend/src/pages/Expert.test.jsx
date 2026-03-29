import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const settingsController = vi.fn();

vi.mock("./Settings/SettingsController.jsx", () => ({
  default: (props) => {
    settingsController(props);
    return <div>Settings Controller</div>;
  },
}));

import Expert from "./Expert.jsx";

describe("Expert", () => {
  it("passes expert-specific framing into the shared settings surface", () => {
    render(<Expert />);

    expect(screen.getByText("Settings Controller")).toBeInTheDocument();
    expect(settingsController).toHaveBeenCalledWith(
      expect.objectContaining({
        shellEyebrow: "Advanced Controls",
        shellTitle: "Expert",
        navTitle: "Advanced Sections",
        showSectionContractCopy: false,
      }),
      undefined
    );
  });
});
