import uuid

from psycopg.types.json import Jsonb

from . import db
from .config import settings


def get_or_create(conversation_id: str | None, user_id: str | None) -> str:
    with db.conn() as c:
        if conversation_id:
            row = c.execute("SELECT id FROM ai_conversations WHERE id = %s",
                            (conversation_id,)).fetchone()
            if row:
                return str(row["id"])
        new_id = str(uuid.uuid4())
        c.execute("INSERT INTO ai_conversations (id, user_id) VALUES (%s, %s)", (new_id, user_id))
        return new_id


def recent(conversation_id: str) -> list[dict]:
    """Les N derniers messages, du plus ancien au plus récent."""
    limit = settings.history_turns * 2
    with db.conn() as c:
        rows = c.execute(
            """SELECT role, content FROM ai_messages WHERE conversation_id = %s
               ORDER BY id DESC LIMIT %s""",
            (conversation_id, limit),
        ).fetchall()
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def add(conversation_id: str, role: str, content: str,
        used_kb_ids: list[int] | None = None, meta: dict | None = None) -> int:
    with db.conn() as c:
        row = c.execute(
            """INSERT INTO ai_messages (conversation_id, role, content, used_kb_ids, meta)
               VALUES (%s, %s, %s, %s::bigint[], %s) RETURNING id""",
            (conversation_id, role, content, used_kb_ids or [], Jsonb(meta or {})),
        ).fetchone()
        return row["id"]


def all_messages(conversation_id: str) -> list[dict]:
    with db.conn() as c:
        return c.execute(
            "SELECT id, role, content, created_at FROM ai_messages WHERE conversation_id = %s ORDER BY id",
            (conversation_id,),
        ).fetchall()
