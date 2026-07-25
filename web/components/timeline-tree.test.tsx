import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimelineTree } from "./TimelineTree";
import { episodes } from "@/mocks/data";
import { rankTimelines } from "@/lib/logic";

describe("TimelineTree", () => {
  const canonical = episodes.filter((e) => e.isCanonical).sort((a, b) => a.orderIndex - b.orderIndex);
  const forks = rankTimelines(episodes.filter((e) => e.forkedFromEpisodeId === "1003"));

  it("renders the sacred timeline episodes and forks under the decision point", () => {
    render(<TimelineTree episodes={canonical} forksByEpisode={{ "1003": forks }} />);
    // canonical episode present
    expect(screen.getByText("The Spared Blade")).toBeInTheDocument();
    // both forks render, verified one first
    const fallen = screen.getByText("The Fallen Blade");
    const marsh = screen.getByText("The Marsh Bargain");
    expect(fallen).toBeInTheDocument();
    expect(marsh).toBeInTheDocument();
    // verified marker exists (title attr)
    expect(screen.getByTitle("Verified by author")).toBeInTheDocument();
  });
});
