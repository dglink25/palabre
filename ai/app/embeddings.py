import threading

import numpy as np

from .config import settings

_model = None
_lock = threading.Lock()


def _get():
    global _model
    with _lock:
        if _model is None:
            from sentence_transformers import SentenceTransformer

            _model = SentenceTransformer(settings.embedding_model)
        return _model


def embed(texts: list[str]) -> np.ndarray:
    vecs = _get().encode(texts, normalize_embeddings=True, batch_size=32)
    return np.asarray(vecs, dtype=np.float32)


def embed_one(text: str) -> np.ndarray:
    return embed([text])[0]
