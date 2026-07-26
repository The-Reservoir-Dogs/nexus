import { test, expect } from "@playwright/test";

// Full demo path against the real backend + local Postgres (live mode).
// Beats: login → home → reader → rate + comment → analytics (retention) →
// create branch → agent generates → approve & publish.

const DECISION_EP = "1003"; // "The Spared Blade" — the seeded decision point

test.describe.serial("NEXUS demo path", () => {
  test("login gateway lands on the series grid", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#username")).toHaveValue("sriman");
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Series" })).toBeVisible();
    await expect(page.getByText("The Hollow Crown")).toBeVisible();
  });

  test.describe("authenticated", () => {
    test.beforeEach(async ({ page }) => {
      // seed the client session so the app is authed (identity resolved via DEV_USER)
      await page.addInitScript(() => localStorage.setItem("nexus_session", "1"));
    });

    test("home → reader opens a series episode", async ({ page }) => {
      await page.goto("/");
      await page.getByText("The Hollow Crown").first().click();
      await expect(page).toHaveURL(/\/episodes\/\d+/);
      // script text is the hero
      await expect(page.locator("article h1")).toBeVisible();
    });

    test("reader: decision point shows author controls, rating + comments work", async ({ page }) => {
      await page.goto(`/episodes/${DECISION_EP}`);
      await expect(page.locator("article h1")).toContainText("The Spared Blade");

      // author (sriman) sees analytics + edit + the fork action on a decision point
      await expect(page.getByRole("button", { name: /create branch/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /analytics/i })).toBeVisible();
      await expect(page.getByRole("link", { name: "Edit" })).toBeVisible();

      // rate
      await page.getByRole("radiogroup", { name: /rate this episode/i })
        .getByRole("radio", { name: /5 stars/i })
        .click();

      // comment (persists via POST /api/episodes/:id/reviews)
      const text = `e2e comment ${Date.now()}`;
      await page.getByLabel("Write a comment").fill(text);
      await page.getByRole("button", { name: /post comment/i }).click();
      await expect(page.getByText(text)).toBeVisible();
    });

    test("analytics: retention curve + stats render from real data", async ({ page }) => {
      await page.goto(`/episodes/${DECISION_EP}/analytics`);
      await expect(page.getByText(/audience retention/i)).toBeVisible();
      await expect(page.getByText("Plays")).toBeVisible();
      await expect(page.getByText(/retention curve/i)).toBeVisible();
      await expect(page.getByText(/ai insight/i)).toBeVisible();
      // the curve is an SVG path
      await expect(page.locator("svg path").first()).toBeVisible();
    });

    test("fork → agent generates → approve & publish", async ({ page }) => {
      await page.goto(`/episodes/${DECISION_EP}`);
      await page.getByRole("button", { name: /create branch/i }).click();

      // lands in the editor; agent streams its THINKING (reasoning + tool calls) into
      // the chat while the draft streams into the manuscript editor.
      await expect(page).toHaveURL(/\/episodes\/\d+\/editor/);
      const chat = page.getByTestId("chat");
      await expect(chat).toContainText(/get_episode|gathering context/i, { timeout: 20_000 });

      // approve becomes enabled once generation completes, then persists the episode
      const approve = page.getByRole("button", { name: /approve/i });
      await expect(approve).toBeEnabled({ timeout: 20_000 });
      await approve.click();

      // navigates to the newly created alternate-timeline episode reader
      await expect(page).toHaveURL(/\/episodes\/\d+$/, { timeout: 20_000 });
      await expect(page.locator("article h1")).toContainText(/fallen blade/i);
    });
  });
});
