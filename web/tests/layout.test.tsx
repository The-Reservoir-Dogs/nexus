import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TopNav } from "@/components/layout/TopNav";
import { AuthProvider } from "@/components/AuthProvider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/series/10",
}));

describe("TopNav", () => {
  beforeEach(() => localStorage.setItem("nexus_session", "1"));

  it("has brand, global search, and logout", async () => {
    render(
      <AuthProvider>
        <TopNav />
      </AuthProvider>
    );
    expect(screen.getByText("nexus")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search the multiverse/i)).toBeInTheDocument();
    expect(screen.queryByText("Discover")).toBeNull();
    expect(screen.queryByText("Trending")).toBeNull();
    await waitFor(() => expect(screen.getByLabelText("Log out")).toBeInTheDocument());
  });
});
