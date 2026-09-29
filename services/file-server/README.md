# Service File Server — Palabre

Serveur de transfert de fichiers pour la messagerie. Stocke les fichiers chiffrés côté client (AES-256-GCM) — le serveur ne voit jamais le contenu en clair.

Technologie : **Node.js** (Express + multer).

## Responsabilités

- Accepter l'upload de fichiers déjà chiffrés (photos, vidéos, documents, audio)
- Générer des URLs de téléchargement signées (TTL configurable)
- Associer chaque fichier à une conversation et un message
- Nettoyer les fichiers expirés

## Port

- HTTP : **4030**

## Configuration — variables d'environnement

### Obligatoire — Secret JWT

**Même valeur que dans `backend/.env`.** Permet de vérifier que les requêtes viennent d'utilisateurs authentifiés.

```env
JWT_ACCESS_SECRET=<même valeur que backend>
```

Pas de génération séparée — copiez depuis `backend/.env`.

### Obligatoire — URL publique

```env
FILE_SERVER_PUBLIC_URL=http://localhost:4030
```

En production :
```env
FILE_SERVER_PUBLIC_URL=https://files.votre-domaine.com
```

Cette URL est incluse dans les messages pour que les destinataires puissent télécharger les fichiers. Elle est aussi exposée au frontend via `VITE_FILE_SERVER_URL` dans `docker/.env`.

### Optionnel

```env
FILE_SERVER_PORT=4030
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4020
# Séparées par virgule. * pour tout autoriser (déconseillé en production)
```

## Démarrage

```bash
# Via Docker
./palabre.sh start core

# Logs
./palabre.sh logs file-server

# Santé
curl http://localhost:4030/health
```

## Principe de chiffrement

Le client (web ou mobile) :
1. Génère une clé AES-256-GCM aléatoire
2. Chiffre le fichier localement avant l'upload
3. Envoie le fichier chiffré au file-server
4. Envoie la clé chiffrée (avec la clé Signal du destinataire) dans le message

Le serveur stocke uniquement des octets opaques. Seul le destinataire peut déchiffrer avec sa clé privée Signal.
