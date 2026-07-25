import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SplitView } from "./SplitView";
import { characters } from "@/mocks/data";

describe("SplitView", () => {
  it("shows both panels, driving comment, alternate content, callout and score chip", () => {
    render(
      <SplitView
        drivingComment="what if she killed him instead?"
        originalTitle="The Spared Blade"
        originalContent="He lowered the sword."
        alternateTitle="The Fallen Blade"
        alternateContent="The blade fell without hesitation."
        streaming={false}
        consistentCharacter={characters[0]}
      />
    );
    expect(screen.getByText("Original Timeline")).toBeInTheDocument();
    expect(screen.getByText("Alternate Timeline")).toBeInTheDocument();
    expect(screen.getByText(/what if she killed him instead/)).toBeInTheDocument();
    expect(screen.getByTestId("alt-content").textContent).toContain("The blade fell");
    // character-consistency callout
    expect(screen.getByText(/stays consistent/)).toBeInTheDocument();
    // score chip
    expect(screen.getByTestId("score-chip").textContent).toMatch(/Continuity/);
  });
});
