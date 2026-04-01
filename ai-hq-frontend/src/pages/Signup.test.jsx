import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const signupUser = vi.fn();
const clearAppSessionContext = vi.fn();

vi.mock("framer-motion", () => ({
  motion: {
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
  },
}));

vi.mock("../api/auth.js", () => ({
  signupUser: (...args) => signupUser(...args),
}));

vi.mock("../lib/appSession.js", () => ({
  clearAppSessionContext: (...args) => clearAppSessionContext(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

import Signup from "./Signup.jsx";

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={["/signup"]}>
      <Signup />
    </MemoryRouter>
  );
}

describe("Signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signupUser.mockResolvedValue({
      ok: true,
      authenticated: true,
      destination: { path: "/setup/studio" },
    });
    clearAppSessionContext.mockImplementation(() => {});
  });

  it("submits canonical signup data and routes into setup", async () => {
    renderSignup();

    fireEvent.change(screen.getByPlaceholderText("Jane Doe"), {
      target: { name: "fullName", value: "Jane Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("Acme Clinic"), {
      target: { name: "companyName", value: "Acme Clinic" },
    });
    fireEvent.change(screen.getByPlaceholderText("owner@acme.com"), {
      target: { name: "email", value: "owner@acme.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Create a password"), {
      target: { name: "password", value: "secret-pass" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create workspace/i }));

    await waitFor(() => {
      expect(signupUser).toHaveBeenCalledWith({
        fullName: "Jane Doe",
        companyName: "Acme Clinic",
        email: "owner@acme.com",
        password: "secret-pass",
      });
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/setup/studio", { replace: true });
    });
  });

  it("shows backend errors without swallowing them", async () => {
    signupUser.mockRejectedValueOnce(new Error("An account with this email already exists"));
    renderSignup();

    fireEvent.change(screen.getByPlaceholderText("Acme Clinic"), {
      target: { name: "companyName", value: "Acme Clinic" },
    });
    fireEvent.change(screen.getByPlaceholderText("owner@acme.com"), {
      target: { name: "email", value: "owner@acme.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Create a password"), {
      target: { name: "password", value: "secret-pass" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create workspace/i }));

    expect(
      await screen.findByText("An account with this email already exists")
    ).toBeInTheDocument();
  });
});
