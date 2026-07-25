import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";

describe("UI kit", () => {
  it("Button renders text and the fork variant color class", () => {
    render(<Button variant="fork">Fork</Button>);
    const btn = screen.getByRole("button", { name: "Fork" });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain("bg-fork");
  });

  it("Button primary is the gold canon color by default", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" }).className).toContain("bg-canon");
  });

  it("Badge canon variant shows gold styling", () => {
    render(<Badge variant="canon">Canon</Badge>);
    expect(screen.getByText("Canon").className).toContain("text-canon");
  });

  it("Card renders a title", () => {
    render(
      <Card>
        <CardTitle>The Hollow Crown</CardTitle>
      </Card>
    );
    expect(screen.getByText("The Hollow Crown")).toBeInTheDocument();
  });
});
