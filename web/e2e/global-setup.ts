import { execFileSync } from "node:child_process";
import path from "node:path";

// Reseed the local Postgres before the e2e run so tests are deterministic
// (the approve flow writes a new episode each run).
const ROOT = path.resolve(__dirname, "../..");
const PORT = process.env.PGPORT ?? "5432";

function psql(db: string, args: string[]) {
  execFileSync("psql", ["-p", PORT, "-d", db, "-v", "ON_ERROR_STOP=1", ...args], {
    stdio: "pipe",
  });
}

export default function globalSetup() {
  // drop + recreate
  execFileSync("psql", ["-p", PORT, "-d", "postgres", "-c", "DROP DATABASE IF EXISTS nexus WITH (FORCE);", "-c", "CREATE DATABASE nexus;"], { stdio: "pipe" });
  // schema + seed
  psql("nexus", ["-f", path.join(ROOT, "schema.sql")]);
  psql("nexus", ["-f", path.join(ROOT, "seed.sql")]);
  // grants for the app role
  psql("nexus", ["-c",
    "GRANT USAGE ON SCHEMA public TO nexus_app;" +
    "GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO nexus_app;" +
    "GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO nexus_app;",
  ]);
  // eslint-disable-next-line no-console
  console.log("[e2e] local nexus DB reseeded");
}
