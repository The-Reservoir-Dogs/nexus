#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Apply idempotent SQL migrations in migrations/ in filename order.
#
# Uses whatever PG* env is already set:
#   - Local dev:  PGDATABASE=nexus (see README "Provision the DB").
#   - Lakebase:   source the same env start.sh exports (PGHOST/PGUSER/... and a
#                 minted PGPASSWORD), then run this.
#
# Every migration is written to be safe to re-run, so this is safe to run any
# number of times.
#
# Usage:
#   PGDATABASE=nexus ./scripts/apply_migrations.sh          # local
#   ./scripts/apply_migrations.sh                            # inherit env
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")/.."

PGDATABASE="${PGDATABASE:-nexus}"
PSQL=(psql -v ON_ERROR_STOP=1 -d "$PGDATABASE")

echo "Applying migrations to database '$PGDATABASE' on ${PGHOST:-localhost}:${PGPORT:-5432} ..."
for f in migrations/*.sql; do
  echo "  -> $f"
  "${PSQL[@]}" -f "$f"
done
echo "Migrations applied."
