// Helpers for calling the Python agent (another Databricks App).
//
// On Databricks Apps the agent sits behind the workspace OAuth front door, so
// app-to-app calls must present a bearer token. The web app already receives a
// service-principal token (DATABRICKS_TOKEN) — the same one it uses for Lakebase
// and the Files API — so we forward it to the agent. The web app's SP must have
// "can use" on the agent app (granted at deploy time).
//
// Locally there is no front door and DATABRICKS_TOKEN is usually unset, so we
// simply omit the header.

export function agentAuthHeaders(): Record<string, string> {
  const token = process.env.DATABRICKS_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Content-Type: application/json plus the agent bearer token when available. */
export function agentJsonHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", ...agentAuthHeaders() };
}
