# Secrets (non versionnés)

Déposez ici les fichiers secrets nécessaires au backend. Ce dossier est monté
en lecture seule dans le conteneur sous `/run/secrets/`.

## Clé de service Firebase

1. Firebase Console → Paramètres du projet → Comptes de service →
   **Générer une nouvelle clé privée** (télécharge un fichier `.json`).
2. Copiez ce fichier ici, par exemple :
   `backend/secrets/palable-320b4-firebase-adminsdk-fbsvc-76c8806392.json`
3. Dans `backend/.env`, renseignez son nom exact :
   `FIREBASE_SERVICE_ACCOUNT_PATH=/run/secrets/palable-320b4-firebase-adminsdk-fbsvc-76c8806392.json`
4. Recréez le conteneur pour que le nouveau montage soit pris en compte :
   `./palabre.sh restart backend`
