from psycopg import sql

from . import db
from .config import settings

S = settings
KNOWN_THRESHOLD = 0.85  # au-dessus : la question est déjà couverte, inutile de la dupliquer


def submit(message_id: int, rating: int, comment: str | None) -> dict:
    with db.conn() as c:
        msg = c.execute("SELECT * FROM ai_messages WHERE id = %s AND role = 'assistant'",
                        (message_id,)).fetchone()
        if not msg:
            raise LookupError("message introuvable")
        if c.execute("SELECT 1 FROM ai_feedback WHERE message_id = %s", (message_id,)).fetchone():
            raise FileExistsError("feedback déjà enregistré")

        c.execute("INSERT INTO ai_feedback (message_id, rating, comment) VALUES (%s, %s, %s)",
                  (message_id, rating, comment))

        positive, negative = rating >= 4, rating <= 2
        kb_ids = msg["used_kb_ids"] or []
        if kb_ids and (positive or negative):
            c.execute(
                """INSERT INTO ai_kb_stats (kb_id, up, down)
                   SELECT unnest(%s::bigint[]), %s, %s
                   ON CONFLICT (kb_id) DO UPDATE
                   SET up = ai_kb_stats.up + EXCLUDED.up, down = ai_kb_stats.down + EXCLUDED.down""",
                (kb_ids, 1 if positive else 0, 1 if negative else 0),
            )

        promoted = None
        meta = msg["meta"] or {}
        # Réponse appréciée, appuyée sur la base, mais question formulée différemment :
        # on propose cette formulation comme nouvelle entrée (après validation).
        if positive and meta.get("grounded") and meta.get("top_sim", 1) < KNOWN_THRESHOLD:
            cand = c.execute(
                """INSERT INTO ai_kb_candidates (question, response, source_message_id)
                   VALUES (%s, %s, %s)
                   ON CONFLICT (question) DO UPDATE SET votes = ai_kb_candidates.votes + 1
                   RETURNING id, votes, status""",
                (meta.get("standalone_question"), msg["content"], message_id),
            ).fetchone()
            if (S.auto_approve_votes and cand["votes"] >= S.auto_approve_votes
                    and cand["status"] == "pending"):
                promoted = _promote(c, cand["id"])
    return {"ok": True, "promoted_kb_id": promoted}


def _promote(c, candidate_id: int):
    cand = c.execute("SELECT * FROM ai_kb_candidates WHERE id = %s AND status = 'pending'",
                     (candidate_id,)).fetchone()
    if not cand:
        return None
    q = sql.SQL("INSERT INTO {tbl} ({q}, {a}, {t}) VALUES (%s, %s, %s) RETURNING {id} AS id").format(
        tbl=sql.Identifier(S.kb_table), q=sql.Identifier(S.kb_question_col),
        a=sql.Identifier(S.kb_answer_col), t=sql.Identifier(S.kb_type_col),
        id=sql.Identifier(S.kb_id_col),
    )
    new_id = c.execute(q, (cand["question"], cand["response"], cand["type"])).fetchone()["id"]
    c.execute("UPDATE ai_kb_candidates SET status = 'approved' WHERE id = %s", (candidate_id,))
    return new_id  # l'index vectoriel sera mis à jour au prochain sync


def approve(candidate_id: int):
    with db.conn() as c:
        return _promote(c, candidate_id)


def reject(candidate_id: int) -> None:
    with db.conn() as c:
        c.execute("UPDATE ai_kb_candidates SET status = 'rejected' WHERE id = %s", (candidate_id,))


def candidates(status: str = "pending") -> list[dict]:
    with db.conn() as c:
        return c.execute("SELECT * FROM ai_kb_candidates WHERE status = %s ORDER BY votes DESC, id",
                         (status,)).fetchall()


def negatives(limit: int = 50) -> list[dict]:
    """Réponses mal notées à relire/corriger par un humain."""
    with db.conn() as c:
        return c.execute(
            """SELECT f.id, f.rating, f.comment, m.id AS message_id, m.content AS answer,
                      m.meta->>'standalone_question' AS question, m.used_kb_ids
               FROM ai_feedback f JOIN ai_messages m ON m.id = f.message_id
               WHERE f.rating <= 2 ORDER BY f.id DESC LIMIT %s""",
            (limit,),
        ).fetchall()
