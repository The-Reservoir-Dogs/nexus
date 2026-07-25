import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider } from "@/components/AuthProvider";
import BranchesPage from "@/app/series/[id]/branches/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/series/10/branches",
}));

function setup() {
  localStorage.setItem("nexus_session", "1");
  return render(
    <AuthProvider>
      <BranchesPage params={{ id: "10" }} />
    </AuthProvider>
  );
}

describe("Author branches / verify + rerank", () => {
  beforeEach(() => localStorage.clear());

  it("verifies the unverified branch → canonizes it and removes its Verify button", async () => {
    setup();
    await waitFor(() => expect(screen.getByText("The Marsh Bargain")).toBeInTheDocument());

    // Only the unverified branch (Marsh) has a Verify button; Fallen is pre-verified.
    const verifyButtons = screen.getAllByRole("button", { name: /verify/i });
    expect(verifyButtons).toHaveLength(1);
    expect(screen.getAllByText("Canonized")).toHaveLength(1);

    await userEvent.click(verifyButtons[0]);

    // now both are canonized, no Verify buttons remain (rerank keeps verified-first)
    await waitFor(() => expect(screen.getAllByText("Canonized")).toHaveLength(2));
    expect(screen.queryAllByRole("button", { name: /verify/i })).toHaveLength(0);
  });
});
