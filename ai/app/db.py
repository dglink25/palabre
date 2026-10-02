from contextlib import contextmanager
from pathlib import Path

import psycopg
from pgvector.psycopg import register_vector
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .config import settings

_pool: ConnectionPool | None = None


def init_schema() -> None:
    sql = (Path(__file__).parent.parent / "sql" / "schema.sql").read_text()
    sql = sql.replace("__DIM__", str(settings.embedding_dim))
    with psycopg.connect(settings.database_url, autocommit=True) as conn:
        conn.execute(sql)


def _configure(conn):
    register_vector(conn)


def init_pool() -> None:
    global _pool
    _pool = ConnectionPool(
        settings.database_url,
        min_size=1,
        max_size=10,
        kwargs={"row_factory": dict_row},
        configure=_configure,
        open=True,
    )


def close_pool() -> None:
    if _pool:
        _pool.close()


@contextmanager
def conn():
    """Connexion avec commit automatique en fin de bloc."""
    assert _pool is not None, "pool non initialisé"
    with _pool.connection() as c:
        yield c
