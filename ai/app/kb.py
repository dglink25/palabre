"""
Module KB (Knowledge Base) - Gestion de la base de connaissance pour le super-admin.
Fournit les opérations CRUD sur la table connaissance_base.
"""

import logging
from typing import Optional

from . import db, rag

log = logging.getLogger("kb")

VALID_TYPES = ("general", "technique", "videoconference", "installation", "developer",
               "facturation", "compte", "autre")

VALID_IVR_OPTIONS = (None, 1, 2, 3, 4)


def _validate_type(kb_type: str) -> str:
    if kb_type not in VALID_TYPES:
        raise ValueError(f"Type invalide. Types acceptes : {', '.join(VALID_TYPES)}")
    return kb_type


def _validate_ivr_option(ivr_option) -> Optional[int]:
    if ivr_option is None:
        return None
    opt = int(ivr_option)
    if opt not in (1, 2, 3, 4):
        raise ValueError("L'option IVR doit etre 1, 2, 3 ou 4 (ou null pour une entree globale).")
    return opt


# ── Lecture ───────────────────────────────────────────────────────────────────

def list_entries(
    kb_type:    str | None  = None,
    ivr_option: int | None  = None,
    active:     bool | None = True,
    search:     str | None  = None,
    limit:      int         = 50,
    offset:     int         = 0,
) -> dict:
    """Liste les entrees de la base de connaissance avec filtres optionnels."""
    conditions = []
    params     = []
    idx        = 1

    if active is not None:
        conditions.append(f"active = ${idx}")
        params.append(active)
        idx += 1

    if kb_type:
        conditions.append(f"type = ${idx}")
        params.append(kb_type)
        idx += 1

    if ivr_option is not None:
        conditions.append(f"ivr_option = ${idx}")
        params.append(ivr_option)
        idx += 1

    if search:
        conditions.append(f"(question ILIKE ${idx} OR response ILIKE ${idx})")
        params.append(f"%{search}%")
        idx += 1

    where   = f"WHERE {' AND '.join(conditions)}" if conditions else ""
    count_q = f"SELECT COUNT(*) AS total FROM connaissance_base {where}"
    list_q  = (
        f"SELECT id, question, response, type, ivr_option, active, created_at, updated_at "
        f"FROM connaissance_base {where} "
        f"ORDER BY id DESC LIMIT ${idx} OFFSET ${idx + 1}"
    )
    params_paged = params + [limit, offset]

    with db.conn() as c:
        total = c.execute(count_q, params).fetchone()["total"]
        rows  = c.execute(list_q, params_paged).fetchall()

    return {
        "total":  total,
        "limit":  limit,
        "offset": offset,
        "items":  [dict(r) for r in rows],
    }


def get_entry(entry_id: int) -> dict | None:
    """Retourne une entree par son identifiant."""
    with db.conn() as c:
        row = c.execute(
            "SELECT id, question, response, type, ivr_option, active, created_at, updated_at "
            "FROM connaissance_base WHERE id = %s",
            (entry_id,)
        ).fetchone()
    return dict(row) if row else None


# ── Creation / Modification ───────────────────────────────────────────────────

def create_entry(
    question:   str,
    response:   str,
    kb_type:    str,
    ivr_option: int | None,
    created_by: str | None = None,
) -> dict:
    """Cree une nouvelle entree dans la base de connaissance."""
    _validate_type(kb_type)
    ivr_option = _validate_ivr_option(ivr_option)

    if not question.strip():
        raise ValueError("La question ne peut pas etre vide.")
    if not response.strip():
        raise ValueError("La reponse ne peut pas etre vide.")

    with db.conn() as c:
        row = c.execute(
            "INSERT INTO connaissance_base (question, response, type, ivr_option, created_by, updated_by) "
            "VALUES (%s, %s, %s, %s, %s, %s) "
            "RETURNING id, question, response, type, ivr_option, active, created_at, updated_at",
            (question.strip(), response.strip(), kb_type, ivr_option, created_by, created_by),
        ).fetchone()
        entry = dict(row)

    # Déclencher une re-synchronisation de l'index vectoriel
    try:
        rag.sync_kb()
    except Exception as e:
        log.warning("sync_kb apres create_entry: %s", e)

    return entry


def update_entry(
    entry_id:   int,
    question:   str | None      = None,
    response:   str | None      = None,
    kb_type:    str | None      = None,
    ivr_option: int | None      = None,
    active:     bool | None     = None,
    updated_by: str | None      = None,
    _ivr_option_explicit: bool  = False,
) -> dict:
    """Met a jour une entree existante. Seuls les champs fournis sont modifies."""
    existing = get_entry(entry_id)
    if not existing:
        raise LookupError(f"Entree {entry_id} introuvable.")

    fields  = {}
    if question   is not None: fields["question"]    = question.strip()
    if response   is not None: fields["response"]    = response.strip()
    if kb_type    is not None: fields["type"]        = _validate_type(kb_type)
    if active     is not None: fields["active"]      = active
    if updated_by is not None: fields["updated_by"]  = updated_by
    if _ivr_option_explicit:
        fields["ivr_option"] = _validate_ivr_option(ivr_option)

    if not fields:
        return existing

    fields["updated_at"] = "now()"
    set_parts  = [f"{k} = now()" if v == "now()" else f"{k} = %s" for k, v in fields.items()]
    set_values = [v for v in fields.values() if v != "now()"]
    set_values.append(entry_id)

    with db.conn() as c:
        row = c.execute(
            f"UPDATE connaissance_base SET {', '.join(set_parts)} WHERE id = %s "
            "RETURNING id, question, response, type, ivr_option, active, created_at, updated_at",
            set_values,
        ).fetchone()
        entry = dict(row)

    try:
        rag.sync_kb()
    except Exception as e:
        log.warning("sync_kb apres update_entry: %s", e)

    return entry


def delete_entry(entry_id: int) -> bool:
    """Supprime une entree (suppression physique)."""
    with db.conn() as c:
        result = c.execute(
            "DELETE FROM connaissance_base WHERE id = %s RETURNING id",
            (entry_id,)
        ).fetchone()

    if result:
        try:
            rag.sync_kb()
        except Exception as e:
            log.warning("sync_kb apres delete_entry: %s", e)
        return True
    return False


def toggle_active(entry_id: int, active: bool, updated_by: str | None = None) -> dict:
    """Active ou desactive une entree sans la supprimer."""
    return update_entry(entry_id, active=active, updated_by=updated_by)


# ── Import en masse ───────────────────────────────────────────────────────────

def bulk_import(entries: list[dict], created_by: str | None = None) -> dict:
    """
    Importe une liste d'entrees en masse.
    Format attendu : [{"question": str, "response": str, "type": str, "ivr_option": int|null}]
    """
    created = 0
    errors  = []

    for i, item in enumerate(entries):
        try:
            create_entry(
                question   = item.get("question", ""),
                response   = item.get("response", ""),
                kb_type    = item.get("type", "general"),
                ivr_option = item.get("ivr_option"),
                created_by = created_by,
            )
            created += 1
        except (ValueError, Exception) as e:
            errors.append({"index": i, "error": str(e), "data": item})

    # Une seule re-synchronisation a la fin
    try:
        rag.sync_kb()
    except Exception as e:
        log.warning("sync_kb apres bulk_import: %s", e)

    return {"created": created, "errors": errors, "total": len(entries)}


# ── Statistiques ──────────────────────────────────────────────────────────────

def stats() -> dict:
    """Retourne des statistiques sur la base de connaissance."""
    with db.conn() as c:
        total       = c.execute("SELECT COUNT(*) AS n FROM connaissance_base WHERE active = true").fetchone()["n"]
        by_type     = c.execute(
            "SELECT type, COUNT(*) AS n FROM connaissance_base WHERE active = true GROUP BY type ORDER BY n DESC"
        ).fetchall()
        by_ivr      = c.execute(
            "SELECT ivr_option, COUNT(*) AS n FROM connaissance_base WHERE active = true GROUP BY ivr_option ORDER BY ivr_option"
        ).fetchall()
        indexed     = c.execute("SELECT COUNT(*) AS n FROM kb_embeddings").fetchone()["n"]
        candidates  = c.execute("SELECT COUNT(*) AS n FROM ai_kb_candidates WHERE status = 'pending'").fetchone()["n"]

    return {
        "total_active_entries": total,
        "indexed_embeddings":   indexed,
        "pending_candidates":   candidates,
        "by_type":              [dict(r) for r in by_type],
        "by_ivr_option":        [dict(r) for r in by_ivr],
    }
