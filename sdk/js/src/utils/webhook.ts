import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Vérifie la signature HMAC-SHA256 d'un payload webhook Palabre.
 *
 * L'en-tête `X-Palabre-Signature` envoyé par le serveur suit le format
 * `sha256=<hmac_hex>`. Cette fonction recalcule la signature côté serveur
 * et compare le résultat de façon sécurisée (timing-safe) pour éviter les
 * attaques par timing.
 *
 * @param body      - Corps brut de la requête webhook (chaîne UTF-8).
 * @param signature - Valeur de l'en-tête `X-Palabre-Signature` reçue.
 * @param secretKey - Clé secrète du projet Palabre (`sk_live_…`).
 * @returns `true` si la signature est valide, `false` sinon.
 *
 * @example
 * ```typescript
 * import { verifyWebhookSignature } from 'palabre-sdk';
 *
 * app.post('/webhook', (req, res) => {
 *   const rawBody = req.rawBody; // corps brut non parsé
 *   const sig     = req.headers['x-palabre-signature'] as string;
 *   const secret  = process.env.PALABRE_SECRET_KEY!;
 *
 *   if (!verifyWebhookSignature(rawBody, sig, secret)) {
 *     return res.status(401).send('Invalid signature');
 *   }
 *
 *   // traiter l'événement…
 *   res.sendStatus(200);
 * });
 * ```
 */
export function verifyWebhookSignature(
  body: string,
  signature: string,
  secretKey: string,
): boolean {
  // Le format attendu est "sha256=<hex>"
  const prefix = 'sha256=';
  if (!signature.startsWith(prefix)) {
    return false;
  }

  const receivedHex = signature.slice(prefix.length);

  // Calculer le HMAC-SHA256 attendu
  const expectedHex = createHmac('sha256', secretKey)
    .update(body, 'utf8')
    .digest('hex');

  // Les deux buffers doivent avoir la même longueur pour timingSafeEqual
  if (receivedHex.length !== expectedHex.length) {
    return false;
  }

  const receivedBuf = Buffer.from(receivedHex, 'hex');
  const expectedBuf = Buffer.from(expectedHex, 'hex');

  return timingSafeEqual(receivedBuf, expectedBuf);
}
