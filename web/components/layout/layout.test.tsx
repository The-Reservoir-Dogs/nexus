import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TopNav } from "./TopNav";
import { AuthProvider } from "@/components/AuthProvider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/series/10",
}));

describe("TopNav", () => {
  beforeEach(() => localStorage.setItem("nexus_session", "1"));

  it("is clean: no search, no back, no nav links; has brand + working Start writing + logout", async () => {
    render(
      <AuthProvider>
        <TopNav />
      </AuthProvider>
    );
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByPlaceholderText(/search/i)).toBeNull();
    expect(screen.queryByLabelText("Go back")).toBeNull();
    expect(screen.queryByText("Discover")).toBeNull();
    expect(screen.queryByText("Trending")).toBeNull();
    expect(screen.queryByText("Studio")).toBeNull();
    expect(screen.getByText("nexus")).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /start writing/i });
    expect(cta).toHaveAttribute("href", "/series/10/branches");
    await waitFor(() => expect(screen.getByLabelText("Log out")).toBeInTheDocument());
  });
});
