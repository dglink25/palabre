import hashlib

from psycopg import sql

from . import db, embeddings
from .config import settings

S = settings


def _kb_select() -> sql.Composed:
    return sql.SQL("SELECT {id} AS id, {q} AS q, {a} AS a, {t} AS t FROM {tbl}").format(
        id=sql.Identifier(S.kb_id_col), q=sql.Identifier(S.kb_question_col),
        a=sql.Identifier(S.kb_answer_col), t=sql.Identifier(S.kb_type_col),
        tbl=sql.Identifier(S.kb_table),
    )


def _hash(row: dict) -> str:
    raw = f"{row['q']}|{row['a']}|{row['t']}"
    return hashlib.sha1(raw.encode()).hexdigest()


def sync_kb() -> dict:
    """Met à jour l'index vectoriel : nouvelles lignes, lignes modifiées, lignes supprimées.
    Appelé périodiquement => l'agent « lit et apprend en temps réel »."""
    with db.conn() as c:
        rows = c.execute(_kb_select()).fetchall()
        existing = {r["kb_id"]: r["content_hash"]
                    for r in c.execute("SELECT kb_id, content_hash FROM kb_embeddings").fetchall()}

        current_ids = {r["id"] for r in rows}
        removed = [k for k in existing if k not in current_ids]
        if removed:
            c.execute("DELETE FROM kb_embeddings WHERE kb_id = ANY(%s)", (removed,))

        todo = [r for r in rows if existing.get(r["id"]) != _hash(r)]
        for i in range(0, len(todo), 64):
            batch = todo[i:i + 64]
            vecs = embeddings.embed([r["q"] for r in batch])  # on indexe la QUESTION
            for r, v in zip(batch, vecs):
                c.execute(
                    """INSERT INTO kb_embeddings (kb_id, content_hash, embedding)
                       VALUES (%s, %s, %s)
                       ON CONFLICT (kb_id) DO UPDATE
                       SET content_hash = EXCLUDED.content_hash, embedding = EXCLUDED.embedding""",
                    (r["id"], _hash(r), v),
                )
    return {"indexed": len(todo), "removed": len(removed), "total": len(rows)}


def search(query: str, k: int | None = None) -> list[dict]:
    """Recherche sémantique + re-classement selon les feedbacks passés."""
    k = k or S.top_k
    qv = embeddings.embed_one(query)
    with db.conn() as c:
        cand = c.execute(
            """SELECT e.kb_id, 1 - (e.embedding <=> %s) AS sim,
                      COALESCE(s.up, 0) AS up, COALESCE(s.down, 0) AS down
               FROM kb_embeddings e LEFT JOIN ai_kb_stats s USING (kb_id)
               ORDER BY e.embedding <=> %s LIMIT %s""",
            (qv, qv, k * 3),
        ).fetchall()
        cand = [x for x in cand if x["sim"] >= S.min_similarity]
        if not cand:
            return []
        for x in cand:
            x["sim"] = float(x["sim"])
            vote = (x["up"] - x["down"]) / (x["up"] + x["down"] + 3)
            x["score"] = x["sim"] + 0.15 * vote
        cand.sort(key=lambda x: x["score"], reverse=True)
        cand = cand[:k]

        q = _kb_select() + sql.SQL(" WHERE {id} = ANY(%s)").format(id=sql.Identifier(S.kb_id_col))
        info = {r["id"]: r for r in c.execute(q, ([x["kb_id"] for x in cand],)).fetchall()}

    out = []
    for x in cand:
        r = info.get(x["kb_id"])
        if r:
            out.append({"kb_id": x["kb_id"], "sim": x["sim"], "score": x["score"],
                        "question": r["q"], "response": r["a"], "type": r["t"]})
    return out
