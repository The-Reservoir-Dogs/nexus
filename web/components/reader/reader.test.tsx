import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RatingStars } from "./RatingStars";
import { CommentThread, CommentComposer } from "./Comments";
import { nestReviews } from "@/lib/logic";
import { reviews } from "@/mocks/data";

describe("RatingStars", () => {
  it("shows average + count and fires onRate with the clicked score", async () => {
    const onRate = vi.fn();
    render(<RatingStars avg={4.5} count={22} onRate={onRate} />);
    expect(screen.getByTestId("rating-summary").textContent).toContain("4.5");
    expect(screen.getByTestId("rating-summary").textContent).toContain("22");
    await userEvent.click(screen.getByRole("radio", { name: "5 stars" }));
    expect(onRate).toHaveBeenCalledWith(5);
  });
});

describe("Comments", () => {
  it("marks the driving comment and nests replies", () => {
    const nested = nestReviews(reviews.filter((r) => r.episodeId === "1003").map((r) => ({ ...r })));
    render(<CommentThread reviews={nested} drivingId="5001" />);
    expect(screen.getByText("DRIVING COMMENT")).toBeInTheDocument();
    // reply text is rendered under its parent
    expect(screen.getByText(/explore the darker path/)).toBeInTheDocument();
  });

  it("composer posts trimmed text and clears", async () => {
    const onPost = vi.fn();
    render(<CommentComposer onPost={onPost} />);
    const box = screen.getByLabelText("Write a comment");
    await userEvent.type(box, "  great chapter  ");
    await userEvent.click(screen.getByRole("button", { name: /post comment/i }));
    expect(onPost).toHaveBeenCalledWith("great chapter");
    expect((box as HTMLTextAreaElement).value).toBe("");
  });
});
