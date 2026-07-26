import { test, expect } from "@playwright/test";

// Covers the write/continue/update/authoring flows added to the wireframe.
// Runs after demo-path.spec.ts (shared reseeded DB, serial worker).

const CANON = "1001";   // canonical episode (author can edit in place)
const DECISION = "1003"; // decision point (analytics + fork)
const BRANCH = "2001";   // an alternate-timeline episode (continue / sub-branch)

test.describe("NEXUS write flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("nexus_session", "1"));
  });

  test("update an episode in place (PUT) via the editor edit mode", async ({ page }) => {
    const newTitle = `The Gathering Storm ✎ ${Date.now()}`;
    await page.goto(`/episodes/${CANON}/editor?mode=edit`);
    const title = page.getByLabel("Episode title");
    // wait for the existing script to load before editing (don't race the fetch)
    await expect(title).not.toHaveValue("", { timeout: 20_000 });
    await title.fill(newTitle);
    await page.getByRole("button", { name: /save changes/i }).click();
    await expect(page).toHaveURL(new RegExp(`/episodes/${CANON}$`));
    await expect(page.locator("article h1")).toContainText(newTitle);
  });

  test("analytics drawer opens over the reader and streams AI insight", async ({ page }) => {
    await page.goto(`/episodes/${DECISION}`);
    await page.getByRole("button", { name: /analytics/i }).click();
    const drawer = page.getByRole("dialog", { name: /audience retention/i });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(/retention curve/i)).toBeVisible();
    // AI insight streams real numbers from the retention drop-off
    await expect(page.getByTestId("ai-insight")).toContainText("%", { timeout: 20_000 });
  });

  test("continue this timeline (N+1) chains a new episode", async ({ page }) => {
    await page.goto(`/episodes/${BRANCH}`);
    await page.getByRole("button", { name: /continue timeline/i }).click();
    await expect(page).toHaveURL(/\/episodes\/\d+\/editor\?mode=continue/);
    const chat = page.getByTestId("chat");
    await expect(chat).toContainText(/\w/, { timeout: 20_000 });
    const approve = page.getByRole("button", { name: /approve/i });
    await expect(approve).toBeEnabled({ timeout: 20_000 });
    await approve.click();
    await expect(page).toHaveURL(/\/episodes\/\d+$/, { timeout: 20_000 });
    await expect(page.locator("article h1")).toBeVisible();
  });

  test("sub-branch: fork from a branch episode", async ({ page }) => {
    await page.goto(`/episodes/${BRANCH}`);
    await page.getByRole("button", { name: /create branch/i }).click();
    await expect(page).toHaveURL(/\/episodes\/\d+\/editor/);
    const approve = page.getByRole("button", { name: /approve/i });
    await expect(approve).toBeEnabled({ timeout: 20_000 });
    await approve.click();
    await expect(page).toHaveURL(/\/episodes\/\d+$/, { timeout: 20_000 });
    await expect(page.locator("article h1")).toBeVisible();
  });

  test("author authors a new series + canonical episode + character", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /new series/i }).click();
    await expect(page).toHaveURL(/\/series\/new/);
    await page.getByLabel("Title").fill("Aetheria");
    await page.getByLabel("Genre").fill("SciFi");
    await page.getByRole("button", { name: /create series/i }).click();

    // lands on the new episode form — capture the new series id from the URL
    await expect(page).toHaveURL(/\/series\/\d+\/episode\/new/);
    const seriesId = page.url().match(/\/series\/(\d+)\/episode\/new/)![1];
    await page.getByLabel("Episode title").fill("Signal Zero");
    await page.getByLabel("Episode content").fill("The array woke at midnight, and something answered.");
    await page.getByRole("button", { name: /publish episode/i }).click();

    // lands on the reader for the new canonical episode
    await expect(page).toHaveURL(/\/episodes\/\d+$/);
    await expect(page.locator("article h1")).toContainText("Signal Zero");

    // add a character to the new series
    await page.goto(`/series/${seriesId}/characters`);
    await page.getByLabel("Name").fill("Vega");
    await page.getByLabel("Role").fill("protagonist");
    await page.getByRole("button", { name: /add character/i }).click();
    await expect(page.getByTestId("character-list")).toContainText("Vega");
  });
});
