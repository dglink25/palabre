FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DEFAULT_TIMEOUT=300 \
    PIP_RETRIES=5

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# Installer tout en une seule passe avec timeout long et retries
# --no-deps sur torch/torchaudio pour éviter les conflits de hash inter-registry
RUN pip install --timeout 300 --retries 5 \
        torch torchaudio \
        --index-url https://download.pytorch.org/whl/cpu \
        --no-deps \
    && pip install --timeout 300 --retries 5 \
        filelock typing_extensions sympy networkx jinja2 fsspec mpmath MarkupSafe \
    && pip install --timeout 300 --retries 5 \
        fastapi "uvicorn[standard]" python-multipart faster-whisper chatterbox-tts

COPY app.py .

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
