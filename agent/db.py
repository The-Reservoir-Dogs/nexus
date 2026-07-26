"""Read-only Lakebase (Postgres) access for the agent's context tools.

Connection params are resolved in this order:
  1. Environment (local dev / start.sh sets PGHOST/PGUSER/PGPASSWORD/...).
  2. The Databricks secret scope (deployed: the agent app has no bound DB
     resource and no PG* in app.yaml, so we read pg_host/pg_port/pg_user/
     pg_db/pg_password from the scope, mirroring how the Gemini key is loaded).
  3. As a last resort for the password, mint a short-lived Lakebase credential
     token via the Databricks SDK.
"""
import base64
import os
import time
from contextlib import contextmanager

import psycopg

_cached = {"pw": None, "exp": 0.0}
_secret_cache: dict[str, str] = {}
_INSTANCE = os.environ.get("LAKEBASE_INSTANCE", "nexus-db")
_SECRET_SCOPE = os.environ.get("SECRET_SCOPE", "nexus")


def _secret(key: str) -> str | None:
    """Fetch + base64-decode a secret from the scope; cached. Returns None if the
    scope/key is unavailable (e.g. local dev without workspace auth)."""
    if key in _secret_cache:
        return _secret_cache[key]
    try:
        from databricks.sdk import WorkspaceClient

        raw = WorkspaceClient().secrets.get_secret(scope=_SECRET_SCOPE, key=key).value
        val = base64.b64decode(raw).decode()
        _secret_cache[key] = val
        return val
    except Exception:  # noqa: BLE001 — no scope/auth locally; fall back to env
        return None


def _param(env_key: str, secret_key: str, default: str | None = None) -> str | None:
    """Prefer the environment, then the secret scope, then a default."""
    return os.environ.get(env_key) or _secret(secret_key) or default


def _password() -> str:
    # 1) explicit env (local dev), 2) secret scope, 3) minted Lakebase credential.
    pw = os.environ.get("PGPASSWORD") or _secret("pg_password")
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
    host = _param("PGHOST", "pg_host")
    if not host:
        raise RuntimeError("No PGHOST in env or secret scope; cannot reach Lakebase.")
    return (
        f"host={host} "
        f"port={_param('PGPORT', 'pg_port', '5432')} "
        f"dbname={_param('PGDATABASE', 'pg_db', 'databricks_postgres')} "
        f"user={_param('PGUSER', 'pg_user')} "
        f"password={_password()} "
        f"sslmode={os.environ.get('PGSSLMODE', 'require')}"
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
