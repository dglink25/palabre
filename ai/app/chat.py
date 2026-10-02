from . import llm, memory, rag

SYSTEM = """Tu es l'assistant de la plateforme Palabre. Tu aides et guides les utilisateurs.
Règles :
- Réponds dans la langue de l'utilisateur (français par défaut), de façon naturelle, chaleureuse et CONCISE.
- Appuie-toi UNIQUEMENT sur les extraits de la base de connaissance ci-dessous.
- Si l'information n'y figure pas, dis-le honnêtement et propose de contacter un humain. N'invente jamais.
- Tiens compte de l'historique de la conversation pour rester dans le contexte."""


def _condense(history: list[dict], message: str) -> str:
    """Transforme une question de suivi (« et pour le prix ? ») en question autonome pour la recherche."""
    convo = "\n".join(f"{m['role']}: {m['content']}" for m in history[-6:])
    prompt = (
        "Reformule la dernière question de l'utilisateur pour qu'elle soit compréhensible sans "
        "l'historique. Réponds uniquement par la question reformulée.\n\n"
        f"Historique :\n{convo}\n\nDernière question : {message}"
    )
    try:
        return llm.chat([{"role": "user", "content": prompt}], temperature=0, max_tokens=120) or message
    except Exception:
        return message


def answer(user_id: str | None, conversation_id: str | None, message: str) -> dict:
    conv_id = memory.get_or_create(conversation_id, user_id)
    history = memory.recent(conv_id)
    standalone = _condense(history, message) if history else message

    hits = rag.search(standalone)
    if hits:
        context = "\n\n".join(
            f"[{i + 1}] (type: {h['type']})\nQuestion : {h['question']}\nRéponse : {h['response']}"
            for i, h in enumerate(hits)
        )
    else:
        context = "(aucun extrait pertinent trouvé)"

    messages = [{"role": "system", "content": f"{SYSTEM}\n\nBASE DE CONNAISSANCE :\n{context}"}]
    messages += history + [{"role": "user", "content": message}]
    reply = llm.chat(messages)

    memory.add(conv_id, "user", message)
    msg_id = memory.add(
        conv_id, "assistant", reply,
        used_kb_ids=[h["kb_id"] for h in hits],
        meta={"standalone_question": standalone,
              "top_sim": hits[0]["sim"] if hits else 0.0,
              "grounded": bool(hits)},
    )
    return {
        "conversation_id": conv_id,
        "message_id": msg_id,
        "answer": reply,
        "sources": [{"kb_id": h["kb_id"], "question": h["question"], "similarity": round(h["sim"], 3)}
                    for h in hits],
    }
