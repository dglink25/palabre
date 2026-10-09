FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# PyTorch CPU (plus léger - pour GPU remplacer par l'index cuda)
RUN pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
# Installer le reste sans torch (déjà installé)
RUN pip install fastapi "uvicorn[standard]" python-multipart faster-whisper chatterbox-tts

COPY app.py .

# Le dossier voices est monté en volume - ne pas copier dans l'image
# Placer ref.wav dans ai/voice_server/voices/ref.wav

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
