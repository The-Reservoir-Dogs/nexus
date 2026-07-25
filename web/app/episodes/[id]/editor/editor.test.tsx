import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "@/components/AuthProvider";
import { ForkProvider } from "@/components/ForkProvider";
import EditorPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/episodes/1003/editor",
}));

// Monaco can't run in jsdom — mock it with a textarea that mirrors value.
vi.mock("@monaco-editor/react", () => ({
  default: ({ value }: { value: string }) => (
    <textarea data-testid="manuscript" readOnly value={value} />
  ),
}));

function setup() {
  localStorage.setItem("nexus_session", "1");
  return render(
    <AuthProvider>
      <ForkProvider>
        <EditorPage params={{ id: "1003" }} />
      </ForkProvider>
    </AuthProvider>
  );
}

describe("Co-author editor", () => {
  beforeEach(() => localStorage.clear());

  it("streams the generated draft into the manuscript and chat, shows HITL buttons", async () => {
    setup();
    // HITL controls present immediately
    expect(await screen.findByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();

    // wait for streaming to fill the manuscript with the alternate text
    await waitFor(
      () => {
        const ta = screen.getByTestId("manuscript") as HTMLTextAreaElement;
        expect(ta.value).toContain("The blade fell");
      },
      { timeout: 8000 }
    );

    // chat shows an AI DRAFT bubble
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
  }, 10000);
});
