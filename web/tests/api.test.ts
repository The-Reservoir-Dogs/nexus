import { describe, it, expect } from "vitest";
import {
  getSeries,
  getEpisode,
  getEpisodeTimelines,
  getReviews,
  forkEpisode,
  generate,
  approveEpisode,
  verifyEpisode,
  chat,
  narrateEpisode,
} from "@/lib/api";

describe("api client (mock mode)", () => {
  it("getSeries returns the seeded universe and filters by query", async () => {
    const all = await getSeries();
    expect(all.find((s) => s.title === "The Hollow Crown")).toBeTruthy();
    const filtered = await getSeries({ q: "neon" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe("Neon Requiem");
  });

  it("getEpisode(1003) exposes the decision point", async () => {
    const ep = await getEpisode("1003");
    expect(ep?.decisionPoint).toBe("The hero spares the villain");
  });

  it("getEpisodeTimelines(1003) returns 2 forks, verified ranked first", async () => {
    const forks = await getEpisodeTimelines("1003");
    expect(forks).toHaveLength(2);
    expect(forks[0].verifiedByAuthor).toBe(true);
    expect(forks[0].id).toBe("2001");
  });

  it("getReviews(1003) nests replies under their parent", async () => {
    const roots = await getReviews("1003");
    const driving = roots.find((r) => r.id === "5001");
    expect(driving?.replies?.[0]?.id).toBe("5003");
  });

  it("forkEpisode assembles context with driving comment + characters", async () => {
    const ctx = await forkEpisode("1003", "5001");
    expect(ctx.decisionPoint).toBe("The hero spares the villain");
    expect(ctx.drivingComment?.id).toBe("5001");
    expect(ctx.characters.length).toBeGreaterThan(0);
  });

  it("generate streams tokens then returns the final draft", async () => {
    const gen = generate({ sourceEpisodeId: "1003", decisionPoint: "What if she killed him?" });
    let streamed = "";
    let res = await gen.next();
    while (!res.done) {
      streamed += res.value;
      res = await gen.next();
    }
    expect(streamed.length).toBeGreaterThan(20);
    expect(res.value.title).toBe("The Fallen Blade");
    expect(streamed).toContain("The blade fell");
  });

  it("mock chat answers slash commands with episode-grounded plain text", async () => {
    const events: string[] = [];
    const gen = chat({ episodeId: "1003", message: "/characters" }, (e) => events.push(e.type));
    let streamed = "";
    let res = await gen.next();
    while (!res.done) {
      streamed += res.value;
      res = await gen.next();
    }
    expect(streamed).toContain("Characters in The Hollow Crown");
    expect(streamed).toContain("Lady Corvin");
    expect(streamed).not.toContain("Readers loved the tension but wanted the decision to land sooner");
    expect(streamed).not.toMatch(/\*\*/);
    expect(events).toContain("tool_call");
    expect(events).toContain("tool_result");
  });

  it("mock narration returns a playable audio URL", async () => {
    const out = await narrateEpisode("1003");
    expect(out.audioUrl).toMatch(/^(data:audio\/wav|\/narration|\/api\/episodes)/);
    expect(out.durationMs).toBeGreaterThan(0);
  });

  it("approve adds a fork and verify flips the flag", async () => {
    const created = await approveEpisode({
      seriesId: "10",
      seasonId: "100",
      forkedFromEpisodeId: "1003",
      decisionPoint: "test path",
      title: "Test Branch",
      content: "body",
      summary: "s",
    });
    expect(created.isCanonical).toBe(false);
    expect(created.coAuthorId).toBe("1");
    const verified = await verifyEpisode(created.id, true);
    expect(verified.verifiedByAuthor).toBe(true);
  });
});
