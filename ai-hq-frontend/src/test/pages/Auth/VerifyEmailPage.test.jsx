import { MemoryRouter, Route, Routes } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

import VerifyEmailPage from "../../../pages/Auth/VerifyEmailPage.jsx";

describe("VerifyEmailPage", () => {
  it("shows the verification message and routes back to login", async () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/verify-email",
            state: { email: "owner@acme.com" },
          },
        ]}
      >
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /check your inbox/i })).toBeInTheDocument();
    expect(screen.getByText(/owner@acme.com/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /continue to sign in/i }));

    expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
  });
});
