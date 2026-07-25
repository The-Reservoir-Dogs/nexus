import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "./AuthProvider";

// next/navigation stub
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/login",
}));

function Probe() {
  const { me, login, isOwner } = useAuth();
  return (
    <div>
      <span data-testid="me">{me?.username ?? "none"}</span>
      <span data-testid="owner">{String(isOwner({ authorId: "1" }))}</span>
      <button onClick={() => login("sriman")}>login</button>
    </div>
  );
}

describe("AuthProvider", () => {
  beforeEach(() => localStorage.clear());

  it("starts logged out and logs in the mocked user", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(screen.getByTestId("me").textContent).toBe("none");
    await userEvent.click(screen.getByText("login"));
    await waitFor(() => expect(screen.getByTestId("me").textContent).toBe("sriman"));
    // isOwner true for series authored by user id 1
    expect(screen.getByTestId("owner").textContent).toBe("true");
    expect(localStorage.getItem("nexus_session")).toBe("1");
  });
});
