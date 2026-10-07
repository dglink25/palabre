"""
Module IVR (Interactive Voice Response) - Service client Palabre
Gère le menu vocal interactif, le routage des options et l'agent de service client.

Flux :
  1. L'utilisateur appelle -> greeting() retourne le message d'accueil + options
  2. L'utilisateur saisit un chiffre -> route(key) valide et retourne la confirmation + prompt
  3. L'utilisateur pose sa question -> ask(session, key, message) répond via RAG ciblé
  4. Option 8 -> transfert vers conseiller humain (WebSocket backend)
  5. Option 0 -> fin de session
"""

import logging

from . import chat, db, memory

log = logging.getLogger("ivr")

# ── Récupération de la configuration active ───────────────────────────────────

def _get_config() -> dict:
    """Charge la configuration IVR active depuis la base de données."""
    with db.conn() as c:
        row = c.execute(
            "SELECT config FROM ivr_config WHERE is_active = true LIMIT 1"
        ).fetchone()
    if not row:
        return _default_config()
    return row["config"]


def _get_agent_config() -> dict:
    """Charge les paramètres de l'agent AI."""
    with db.conn() as c:
        row = c.execute(
            "SELECT agent_name, welcome_message, fallback_message, avatar_url, voice_enabled "
            "FROM ai_support_config LIMIT 1"
        ).fetchone()
    if not row:
        return {
            "agent_name": "Assistant Palabre",
            "welcome_message": (
                "Bonjour. Je suis l'assistant de la plateforme Palabre. "
                "Pour les questions liées a des problemes techniques, tapez 1. "
                "Pour la videoconference, tapez 2. "
                "Pour l'installation et les organisations, tapez 3. "
                "Pour l'espace developpeurs, tapez 4. "
                "Pour parler a un conseiller, tapez 8. "
                "Pour annuler, tapez 0."
            ),
            "fallback_message": (
                "Je n'ai pas trouve de reponse precise a votre question. "
                "Je vous transfere vers un conseiller."
            ),
            "avatar_url": None,
            "voice_enabled": False,
        }
    return dict(row)


def _default_config() -> dict:
    return {
        "options": [
            {"key": "1", "label": "Problemes techniques",        "type": "technique",      "description": "Problemes techniques sur la plateforme"},
            {"key": "2", "label": "Videoconference",             "type": "videoconference", "description": "Difficultes avec la videoconference"},
            {"key": "3", "label": "Installation et organisation","type": "installation",    "description": "Installation et creation d'organisation"},
            {"key": "4", "label": "Developpeurs",                "type": "developer",       "description": "Espace developeurs"},
            {"key": "8", "label": "Conseiller",                  "type": "human_agent",     "description": "Transfert vers un conseiller"},
            {"key": "0", "label": "Annuler",                     "type": "cancel",          "description": "Annuler et raccrocher"},
        ]
    }


# ── Récupération de l'utilisateur ─────────────────────────────────────────────

def _get_user_name(user_id: str | None) -> str | None:
    """Retourne le nom complet de l'utilisateur ou None."""
    if not user_id:
        return None
    try:
        with db.conn() as c:
            row = c.execute(
                "SELECT full_name FROM users WHERE id = %s",
                (user_id,)
            ).fetchone()
        return row["full_name"] if row else None
    except Exception:
        return None


# ── API principale ────────────────────────────────────────────────────────────

def greeting(user_id: str | None = None) -> dict:
    """
    Retourne le message d'accueil personnalisé et les options IVR disponibles.
    Appele au debut de chaque session de service client.
    """
    agent   = _get_agent_config()
    config  = _get_config()
    options = config.get("options", [])

    name     = _get_user_name(user_id)
    salut    = f"Bonjour {name}," if name else "Bonjour,"

    # Construire le message d'accueil à partir de la config ou utiliser le message stocke
    welcome  = agent["welcome_message"]

    # Si le message stocke ne commence pas par la salutation personnalisee, on l'ajoute
    if name and not welcome.startswith(f"Bonjour {name}"):
        # Remplacer "Bonjour." ou "Bonjour," au debut par la version personnalisee
        import re
        welcome = re.sub(r'^Bonjour[\.,]?\s*', f"{salut} ", welcome, flags=re.IGNORECASE)

    return {
        "type":        "greeting",
        "agent_name":  agent["agent_name"],
        "avatar_url":  agent["avatar_url"],
        "message":     welcome,
        "options":     [
            {
                "key":         opt["key"],
                "label":       opt["label"],
                "description": opt.get("description", ""),
            }
            for opt in options
            if opt.get("key") not in ("8", "0")  # les options speciales sont incluses mais separees
        ],
        "special_options": [
            opt for opt in options if opt.get("key") in ("8", "0")
        ],
        "voice_enabled": agent["voice_enabled"],
    }


def route(key: str, user_id: str | None = None) -> dict:
    """
    Valide la touche saisie par l'utilisateur et retourne la confirmation + prompt.
    Retourne aussi l'action a effectuer (chat, transfer, cancel).
    """
    config  = _get_config()
    options = {opt["key"]: opt for opt in config.get("options", [])}

    if key not in options:
        valid_keys = ", ".join(sorted(options.keys()))
        return {
            "type":    "invalid_key",
            "message": (
                f"L'option saisie n'est pas valide. "
                f"Veuillez choisir parmi les options disponibles : {valid_keys}."
            ),
            "action":  "reprompt",
        }

    opt = options[key]

    if opt["type"] == "human_agent":
        return {
            "type":    "transfer",
            "message": opt.get("prompt", "Transfert en cours vers un conseiller. Veuillez patienter."),
            "action":  "transfer_to_agent",
            "option":  opt,
        }

    if opt["type"] == "cancel":
        return {
            "type":    "cancel",
            "message": opt.get("prompt", "Merci de votre appel. Au revoir."),
            "action":  "end_session",
            "option":  opt,
        }

    return {
        "type":    "option_selected",
        "message": opt.get("prompt", f"Vous avez selectionne {opt['label']}. Posez votre question."),
        "action":  "start_chat",
        "option":  opt,
        "kb_type": opt.get("type"),  # filtrer la KB par ce type
    }


def ask(
    user_id:         str | None,
    conversation_id: str | None,
    message:         str,
    kb_type:         str | None = None,
    ivr_option:      str | None = None,
) -> dict:
    """
    Repond a la question de l'utilisateur en utilisant le RAG, filtre par le type IVR.
    Delègue à chat.answer() avec un prompt système enrichi.
    """
    # Construire le contexte IVR pour orienter l'agent
    context_hint = ""
    if kb_type and kb_type not in ("general", "human_agent", "cancel"):
        config  = _get_config()
        options = {opt["key"]: opt for opt in config.get("options", [])}
        if ivr_option and ivr_option in options:
            opt_label = options[ivr_option]["label"]
            context_hint = f"[Service client - Categorie : {opt_label}] "

    full_message = f"{context_hint}{message}" if context_hint else message

    result = chat.answer(user_id, conversation_id, full_message)

    agent = _get_agent_config()

    # Detecter si l'agent n'a pas trouve de reponse pertinente
    if not result.get("sources") and _is_uncertain(result.get("answer", "")):
        result["suggest_transfer"] = True
        result["transfer_message"] = agent["fallback_message"]
    else:
        result["suggest_transfer"] = False

    result["kb_type"]   = kb_type
    result["ivr_option"] = ivr_option
    return result


def _is_uncertain(answer: str) -> bool:
    """Detecte si la reponse de l'agent exprime une incertitude ou un manque d'information."""
    indicators = [
        "je n'ai pas",
        "je ne sais pas",
        "je n'ai pas d'information",
        "je ne dispose pas",
        "je ne trouve pas",
        "contacter un humain",
        "contacter le support",
        "pas de reponse",
        "information non disponible",
    ]
    lower = answer.lower()
    return any(ind in lower for ind in indicators)


def get_full_config() -> dict:
    """Retourne la configuration IVR complete et les parametres de l'agent (usage admin)."""
    return {
        "ivr":   _get_config(),
        "agent": _get_agent_config(),
    }


def update_agent_config(
    admin_user_id: str,
    agent_name:    str | None = None,
    welcome_msg:   str | None = None,
    fallback_msg:  str | None = None,
    avatar_url:    str | None = None,
    voice_enabled: bool | None = None,
) -> dict:
    """Met a jour les parametres de l'agent (super-admin uniquement)."""
    fields = {}
    if agent_name    is not None: fields["agent_name"]        = agent_name
    if welcome_msg   is not None: fields["welcome_message"]   = welcome_msg
    if fallback_msg  is not None: fields["fallback_message"]  = fallback_msg
    if avatar_url    is not None: fields["avatar_url"]        = avatar_url
    if voice_enabled is not None: fields["voice_enabled"]     = voice_enabled

    if not fields:
        return get_full_config()

    fields["updated_by"] = admin_user_id
    fields["updated_at"] = "now()"

    set_clause = ", ".join(
        f"{k} = {'now()' if v == 'now()' else '%s'}" for k, v in fields.items()
    )
    values = [v for v in fields.values() if v != "now()"]

    with db.conn() as c:
        existing = c.execute("SELECT id FROM ai_support_config LIMIT 1").fetchone()
        if existing:
            c.execute(
                f"UPDATE ai_support_config SET {set_clause}",
                values,
            )
        else:
            c.execute(
                "INSERT INTO ai_support_config (agent_name, welcome_message, fallback_message, avatar_url, voice_enabled, updated_by) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                [
                    fields.get("agent_name", "Assistant Palabre"),
                    fields.get("welcome_message", ""),
                    fields.get("fallback_message", ""),
                    fields.get("avatar_url"),
                    fields.get("voice_enabled", False),
                    admin_user_id,
                ],
            )

    return get_full_config()


def update_ivr_config(admin_user_id: str, options: list[dict]) -> dict:
    """Cree une nouvelle version de la configuration IVR et l'active (super-admin uniquement)."""
    import json

    with db.conn() as c:
        # Désactiver la config actuelle
        c.execute("UPDATE ivr_config SET is_active = false WHERE is_active = true")

        # Obtenir le prochain numero de version
        row = c.execute("SELECT COALESCE(MAX(version), 0) + 1 AS v FROM ivr_config").fetchone()
        version = row["v"]

        config_json = json.dumps({"options": options})
        c.execute(
            "INSERT INTO ivr_config (version, is_active, label, config, created_by) "
            "VALUES (%s, true, %s, %s::jsonb, %s) RETURNING id",
            (version, f"Version {version}", config_json, admin_user_id),
        )

    return get_full_config()
