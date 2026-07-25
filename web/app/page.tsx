export const dynamic = "force-dynamic";
// Minimal dashboard — smoke test that /api + Lakebase are wired.
// Sriman replaces this with the real Netflix-style UI (dummy JSON first).
async function getSeries() {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const res = await fetch(`${base}/api/series`, { cache: "no-store" });
  if (!res.ok) return [];
  const { data } = await res.json();
  return data as any[];
}

export default async function Home() {
  const series = await getSeries().catch(() => []);
  return (
    <main style={{ padding: 32, maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 40, marginBottom: 4 }}>NEXUS</h1>
      <p style={{ opacity: 0.7, marginTop: 0 }}>A living story multiverse.</p>

      <h2 style={{ marginTop: 32 }}>Series</h2>
      {series.length === 0 && <p style={{ opacity: 0.6 }}>No series (or API not reachable yet).</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16 }}>
        {series.map((s) => (
          <div key={s.id} style={{ background: "#15151f", borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{s.title}</div>
            <div style={{ opacity: 0.7, fontSize: 13, margin: "6px 0" }}>{s.summary}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>
              {s.episodeCount} eps · {s.contributorCount} contributors · ★ {s.avgRating}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
