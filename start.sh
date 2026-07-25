#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# NEXUS local dev spin-up.
# Starts the Python agent (port 8001) and the Next.js web app (port 3000),
# wiring both to Lakebase and the Databricks LLM endpoint.
#
# Prereqs: databricks CLI authenticated, node + npm, python3.
# Usage:   ./start.sh
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

WEB_PORT="${WEB_PORT:-3000}"
AGENT_PORT="${AGENT_PORT:-8001}"

# --- load optional .env overrides ---
if [ -f .env ]; then set -a; . ./.env; set +a; fi

# --- Databricks host + token (for LLM serving calls) ---
export DATABRICKS_HOST="${DATABRICKS_HOST:-https://dbc-60b5b94b-8e3e.cloud.databricks.com}"
if [ -z "${DATABRICKS_TOKEN:-}" ]; then
  export DATABRICKS_TOKEN="$(databricks auth token -o json | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')"
fi

# --- Lakebase connection ---
export PGHOST="${PGHOST:-ep-round-bar-d8cmwzqy.database.us-east-2.cloud.databricks.com}"
export PGPORT="${PGPORT:-5432}"
export PGDATABASE="${PGDATABASE:-databricks_postgres}"
export PGUSER="${PGUSER:-nexus_app}"
export PGSSLMODE="${PGSSLMODE:-require}"
if [ -z "${PGPASSWORD:-}" ]; then
  echo "Fetching nexus_app password from secret scope 'nexus'..."
  export PGPASSWORD="$(databricks secrets get-secret nexus pg_password -o json \
    | python3 -c 'import sys,json,base64;print(base64.b64decode(json.load(sys.stdin)["value"]).decode())')"
fi

# --- LLM endpoint + agent wiring ---
export DATABRICKS_SERVING_ENDPOINT="${DATABRICKS_SERVING_ENDPOINT:-databricks-claude-sonnet-5}"
export LLM_ENDPOINT="$DATABRICKS_SERVING_ENDPOINT"
export AGENT_URL="${AGENT_URL:-http://localhost:${AGENT_PORT}}"

cleanup() { echo; echo "Shutting down..."; kill 0; }
trap cleanup EXIT INT TERM

# --- Agent (Python / FastAPI) ---
echo "Starting agent on :${AGENT_PORT} ..."
(
  cd agent
  if [ ! -d .venv ]; then python3 -m venv .venv; fi
  # shellcheck disable=SC1091
  . .venv/bin/activate
  pip install -q -r requirements.txt
  exec uvicorn main:app --host 0.0.0.0 --port "${AGENT_PORT}"
) &

# --- Web (Next.js) ---
echo "Starting web on :${WEB_PORT} ..."
(
  cd web
  if [ ! -d node_modules ]; then npm install; fi
  DATABRICKS_APP_PORT="${WEB_PORT}" exec npm run dev
) &

wait
