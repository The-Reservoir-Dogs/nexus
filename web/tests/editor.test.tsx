import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AuthProvider } from "@/components/AuthProvider";
import { ForkProvider } from "@/components/ForkProvider";
import EditorPage from "@/app/episodes/[id]/editor/page";

const push = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => new URLSearchParams(),
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
  beforeEach(() => {
    localStorage.clear();
    push.mockClear();
    replace.mockClear();
  });

  it("loads the source episode content into a new branch editor without auto-generating", async () => {
    setup();
    expect(await screen.findByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /discard/i })).toBeInTheDocument();

    const ta = screen.getByTestId("manuscript") as HTMLTextAreaElement;
    await waitFor(() => expect(ta.value).toContain("The blade hovered at Lady Corvin's throat"));
    expect(ta.value).toContain("Mercy changed everything.");

    // no auto-generate: generated alternate copy appears only after explicit /rewrite
    expect(ta.value).not.toContain("The blade fell");

    const input = screen.getByLabelText("Instruct the AI");
    fireEvent.change(input, { target: { value: "/rewrite" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(
      () => {
        expect((screen.getByTestId("manuscript") as HTMLTextAreaElement).value).toContain("The blade fell");
      },
      { timeout: 8000 }
    );

    expect(screen.getAllByText("AI Co-Author").length).toBeGreaterThan(0);
  }, 10000);

  it("publishes the current manuscript as a stored branch", async () => {
    setup();
    const ta = (await screen.findByTestId("manuscript")) as HTMLTextAreaElement;
    await waitFor(() => expect(ta.value).toContain("The blade hovered at Lady Corvin's throat"));

    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/episodes\/new-/)));
  });
});
