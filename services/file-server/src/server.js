/**
 * Palabre File Server
 *
 * Architecture exacte de WhatsApp pour les médias :
 *
 *   1. Le client chiffre le fichier localement (AES-256-CBC) AVANT l'upload
 *   2. Il uploade le blob chiffré opaque sur ce serveur
 *   3. Le serveur stocke le blob sans jamais le déchiffrer
 *   4. Le serveur retourne une URL de téléchargement
 *   5. L'émetteur inclut dans son message :
 *        { type: "media_ref", url: "...", encKey: "<AES_key_chiffrée_avec_clé_Signal>" }
 *   6. Le destinataire télécharge le blob, déchiffre avec la clé Signal
 *
 * Ce serveur ne voit que des octets opaques.
 * Il ne peut PAS déchiffrer les contenus.
 */

require('dotenv').config();
const app = require('./app');

const PORT = process.env.FILE_SERVER_PORT || 4030;

app.listen(PORT, () => {
  console.log(`[file-server] Démarré sur le port ${PORT}`);
});
