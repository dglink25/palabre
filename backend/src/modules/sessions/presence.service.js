const os = require('os');
const { redis } = require('../../config/redis');

/**
 * ======================================================================
 * PRÉSENCE TEMPS RÉEL (Redis) — distincte de la table `sessions` (Postgres)
 * ======================================================================
 * La table Postgres `sessions` reste la source de vérité pour "quels
 * appareils ont une session valide" (refresh tokens, révocation, historique
 * consultable dans /sessions). Redis, lui, répond à une question différente
 * et beaucoup plus fréquente : "cet appareil est-il connecté MAINTENANT ?"
 * — utile pour router un appel/message vers la bonne instance serveur, ou
 * afficher un indicateur "en ligne" sans jamais toucher Postgres.
 *
 * Clé :   session:{deviceId} → JSON { userId, serverId, lastSeen }
 * TTL :   renouvelé à chaque heartbeat envoyé par le client ; si aucun
 *         heartbeat n'arrive avant expiration, la clé disparaît toute
 *         seule (pas de job de nettoyage à faire tourner).
 *
 * Un index secondaire `presence:user:{userId}` (Set des deviceId) permet de
 * répondre vite à "quels appareils de cet utilisateur sont en ligne ?" sans
 * SCAN sur tout l'espace de clés.
 */

const HEARTBEAT_TTL_SECONDS = parseInt(process.env.HEARTBEAT_TTL_SECONDS || '90', 10);

// Identifiant de CETTE instance backend (utile en déploiement multi-instance
// pour router un appel/message WebSocket vers le bon serveur). À défaut
// d'INSTANCE_ID explicite (ex. injecté par l'orchestrateur), on retombe sur
// le hostname du conteneur.
const SERVER_ID = process.env.INSTANCE_ID || os.hostname();

function sessionKey(deviceId) {
  return `session:${deviceId}`;
}

function userDevicesKey(userId) {
  return `presence:user:${userId}`;
}

/**
 * Marque un appareil comme en ligne (connexion initiale) et démarre le TTL.
 */
async function setOnline(userId, deviceId) {
  const payload = JSON.stringify({ userId, serverId: SERVER_ID, lastSeen: Date.now() });
  await redis
    .multi()
    .set(sessionKey(deviceId), payload, 'EX', HEARTBEAT_TTL_SECONDS)
    .sadd(userDevicesKey(userId), deviceId)
    .exec();
}

/**
 * Heartbeat : renouvelle le TTL et met à jour `lastSeen`. Tant que le client
 * envoie ce heartbeat avant expiration, la session reste "active" — sans
 * limite de durée totale, contrairement au refresh token qui, lui, expire
 * à date fixe côté Postgres.
 */
async function touch(userId, deviceId) {
  const payload = JSON.stringify({ userId, serverId: SERVER_ID, lastSeen: Date.now() });
  await redis.set(sessionKey(deviceId), payload, 'EX', HEARTBEAT_TTL_SECONDS);
  return { ttlSeconds: HEARTBEAT_TTL_SECONDS };
}

/**
 * Déconnexion explicite (logout) : on ne veut pas attendre l'expiration du
 * TTL pour que l'appareil apparaisse "hors ligne".
 */
async function setOffline(userId, deviceId) {
  await redis
    .multi()
    .del(sessionKey(deviceId))
    .srem(userDevicesKey(userId), deviceId)
    .exec();
}

async function isOnline(deviceId) {
  const exists = await redis.exists(sessionKey(deviceId));
  return exists === 1;
}

async function getPresence(deviceId) {
  const raw = await redis.get(sessionKey(deviceId));
  return raw ? JSON.parse(raw) : null;
}

/**
 * Liste les appareils actuellement en ligne pour un utilisateur. Nettoie au
 * passage l'index des entrées dont le TTL a expiré (lazy cleanup — pas de
 * job cron nécessaire).
 */
async function listOnlineDevicesForUser(userId) {
  const deviceIds = await redis.smembers(userDevicesKey(userId));
  if (deviceIds.length === 0) return [];

  const pipeline = redis.pipeline();
  deviceIds.forEach((id) => pipeline.get(sessionKey(id)));
  const results = await pipeline.exec();

  const online = [];
  const stale = [];
  results.forEach(([, raw], idx) => {
    if (raw) {
      online.push({ deviceId: deviceIds[idx], ...JSON.parse(raw) });
    } else {
      stale.push(deviceIds[idx]);
    }
  });

  if (stale.length > 0) {
    await redis.srem(userDevicesKey(userId), ...stale);
  }
  return online;
}

module.exports = { setOnline, touch, setOffline, isOnline, getPresence, listOnlineDevicesForUser, HEARTBEAT_TTL_SECONDS };
