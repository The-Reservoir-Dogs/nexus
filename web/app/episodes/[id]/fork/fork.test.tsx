import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "@/components/AuthProvider";
import { ForkProvider } from "@/components/ForkProvider";
import ForkPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/episodes/1003/fork",
}));

function setup() {
  localStorage.setItem("nexus_session", "1");
  return render(
    <AuthProvider>
      <ForkProvider>
        <ForkPage params={{ id: "1003" }} />
      </ForkProvider>
    </AuthProvider>
  );
}

describe("Fork context page", () => {
  beforeEach(() => localStorage.clear());

  it("assembles the decision point, driving comment, and character chips", async () => {
    setup();
    await waitFor(() =>
      expect(screen.getByText("ORIGINAL DECISION")).toBeInTheDocument()
    );
    // original decision text
    expect(screen.getByText("The hero spares the villain")).toBeInTheDocument();
    // driving comment preselected in the dropdown
    expect(screen.getByText(/reader_amy:/)).toBeInTheDocument();
    // character chip present
    expect(screen.getByText("Lady Corvin")).toBeInTheDocument();
    // generate CTA
    expect(
      screen.getByRole("button", { name: /generate alternate future/i })
    ).toBeInTheDocument();
  });
});
