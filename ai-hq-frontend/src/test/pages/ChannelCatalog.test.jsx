import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import ChannelCatalog from "../../pages/ChannelCatalog.jsx";

afterEach(() => {
  cleanup();
});

describe("ChannelCatalog", () => {
  function renderPage() {
    return render(
      <MemoryRouter initialEntries={["/channels"]}>
        <ChannelCatalog />
      </MemoryRouter>
    );
  }

  it("renders the current v1 channel catalog", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: /^channel catalog$/i })
    ).toBeInTheDocument();

    expect(document.body).toHaveTextContent(/website chat/i);
    expect(document.body).toHaveTextContent(/instagram/i);
    expect(document.body).toHaveTextContent(/facebook/i);
    expect(document.body).toHaveTextContent(/telegram/i);
    expect(document.body).toHaveTextContent(/whatsapp/i);
    expect(document.body).toHaveTextContent(/email/i);
  });

  it("opens a channel setup dialog from a channel card", () => {
    renderPage();

    const manageButtons = screen.getAllByRole("button", { name: /^manage$/i });
    fireEvent.click(manageButtons[0]);

    expect(document.body).toHaveTextContent(/channel setup/i);
    expect(document.body).toHaveTextContent(/setup note/i);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });
});
