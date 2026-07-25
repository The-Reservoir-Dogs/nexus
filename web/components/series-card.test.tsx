import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeriesCard } from "./SeriesCard";
import { series } from "@/mocks/data";

describe("SeriesCard", () => {
  it("renders title, metadata and links to the series page", () => {
    render(<SeriesCard series={series[0]} />);
    // title appears (poster + label)
    expect(screen.getAllByText("The Hollow Crown").length).toBeGreaterThan(0);
    // metadata line
    expect(screen.getByText(/4 eps/)).toBeInTheDocument();
    expect(screen.getByText(/4.3/)).toBeInTheDocument();
    // link target
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/series/10");
  });
});
