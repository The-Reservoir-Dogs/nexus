import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Footer } from "./Footer";
import { TopNav } from "./TopNav";
import { AuthProvider } from "@/components/AuthProvider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/series/10",
}));

describe("Footer", () => {
  it("renders brand, link columns and a working newsletter join", async () => {
    render(<Footer />);
    expect(screen.getAllByText("nexus").length).toBeGreaterThan(0);
    expect(screen.getByText("Start a series")).toBeInTheDocument();
    const input = screen.getByLabelText("Email");
    await userEvent.type(input, "me@story.com");
    await userEvent.click(screen.getByRole("button", { name: /join/i }));
    expect(screen.getByText(/You’re in/)).toBeInTheDocument();
  });
});

describe("TopNav", () => {
  beforeEach(() => localStorage.setItem("nexus_session", "1"));

  it("has NO search box, shows nav links and logout (no back button)", async () => {
    render(
      <AuthProvider>
        <TopNav />
      </AuthProvider>
    );
    // no search input anywhere
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByPlaceholderText(/search/i)).toBeNull();
    // no back button in the nav (per design)
    expect(screen.queryByLabelText("Go back")).toBeNull();
    // nav links present
    expect(screen.getByText("Discover")).toBeInTheDocument();
    // logout appears once the mocked user loads
    await waitFor(() => expect(screen.getByLabelText("Log out")).toBeInTheDocument());
  });
});
