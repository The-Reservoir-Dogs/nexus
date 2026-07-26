import { defineConfig, devices } from "@playwright/test";

// E2E against the REAL backend + local Postgres (live mode).
// AGENT_URL="" forces the /api/generate dev fallback (canned SSE) so the
// fork→generate→approve loop is deterministic without the Databricks LLM.
const PORT = 3300;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  // next dev compiles on demand and can throw transient ChunkLoadError / cold-compile
  // timeouts; retry to absorb dev-server flakiness (assertions are deterministic).
  retries: 2,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    // next dev compiles routes on first hit; give navigations/actions headroom
    navigationTimeout: 30_000,
    actionTimeout: 20_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_MODE: "live",
      NEXT_PUBLIC_BASE_URL: "",
      DEV_USER: "sriman",
      AGENT_URL: "",
      PGHOST: "localhost",
      PGPORT: "5432",
      PGDATABASE: "nexus",
      PGUSER: "nexus_app",
      PGPASSWORD: "nexus_local_pw",
      PGSSLMODE: "disable",
    },
  },
});
