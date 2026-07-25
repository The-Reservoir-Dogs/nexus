import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Footer } from "./Footer";
import { TopNav } from "./TopNav";
import { AuthProvider } from "@/components/AuthProvider";

const back = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/series/10",
}));

describe("Footer", () => {
  it("renders brand, link columns and a working newsletter join", async () => {
    render(<Footer />);
    expect(screen.getAllByText("NEXUS").length).toBeGreaterThan(0);
    expect(screen.getByText("Start a series")).toBeInTheDocument();
    const input = screen.getByLabelText("Email");
    await userEvent.type(input, "me@story.com");
    await userEvent.click(screen.getByRole("button", { name: /join/i }));
    expect(screen.getByText(/You’re in/)).toBeInTheDocument();
  });
});

describe("TopNav", () => {
  beforeEach(() => localStorage.setItem("nexus_session", "1"));

  it("has NO search box, shows nav links, back and logout", async () => {
    render(
      <AuthProvider>
        <TopNav />
      </AuthProvider>
    );
    // no search input anywhere
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByPlaceholderText(/search/i)).toBeNull();
    // nav + controls
    expect(screen.getByText("Discover")).toBeInTheDocument();
    expect(screen.getByLabelText("Go back")).toBeInTheDocument();
    // logout appears once the mocked user loads
    await waitFor(() => expect(screen.getByLabelText("Log out")).toBeInTheDocument());
    await userEvent.click(screen.getByLabelText("Go back"));
    expect(back).toHaveBeenCalled();
  });
});
