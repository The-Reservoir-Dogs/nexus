"""Read-only Lakebase (Postgres) access for the agent's context tools.

Local dev: set PGPASSWORD in the environment (start.sh does this).
Deployed on Databricks Apps with a bound Database resource: PG* are injected;
mint a short-lived credential token via the Databricks SDK.
"""
import os
import time
from contextlib import contextmanager

import psycopg

_cached = {"pw": None, "exp": 0.0}
_INSTANCE = os.environ.get("LAKEBASE_INSTANCE", "nexus-db")


def _password() -> str:
    pw = os.environ.get("PGPASSWORD")
    if pw:
        return pw
    now = time.time()
    if _cached["pw"] and now < _cached["exp"]:
        return _cached["pw"]
    from databricks.sdk import WorkspaceClient

    w = WorkspaceClient()
    cred = w.database.generate_database_credential(instance_names=[_INSTANCE])
    _cached["pw"] = cred.token
    _cached["exp"] = now + 50 * 60
    return cred.token


def _conninfo() -> str:
    return (
        f"host={os.environ['PGHOST']} "
        f"port={os.environ.get('PGPORT','5432')} "
        f"dbname={os.environ.get('PGDATABASE','databricks_postgres')} "
        f"user={os.environ['PGUSER']} "
        f"password={_password()} "
        f"sslmode={os.environ.get('PGSSLMODE','require')}"
    )


@contextmanager
def connection():
    conn = psycopg.connect(_conninfo(), row_factory=psycopg.rows.dict_row)
    try:
        yield conn
    finally:
        conn.close()


def fetch_all(sql: str, params: tuple = ()) -> list[dict]:
    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall()
