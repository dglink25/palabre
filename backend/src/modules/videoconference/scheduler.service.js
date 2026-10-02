'use strict';

/**
 * Scheduler Service - Vidéoconférences planifiées
 *
 * Gère :
 * 1. L'activation automatique des rooms à l'heure prévue
 * 2. Les rappels 15 minutes avant
 * 3. Nettoyage des rooms expirées sans démarrage
 */

const { pool }    = require('../../config/db');
const { redis }   = require('../../config/redis');
const vcService   = require('./videoconference.service');

let schedulerInterval = null;

const TICK_MS     = 60_000; // polling toutes les 60 secondes
const ACTIVE_WINDOW_MS  = 2  * 60 * 1000; // activer 2 min avant l'heure
const REMINDER_WINDOW_MS = 15 * 60 * 1000; // rappel à 15 min

// ── Déduplication via Redis ───────────────────────────────────────────────
async function hasProcessed(key) {
  return (await redis.exists(key)) === 1;
}
async function markProcessed(key, ttlSeconds = 3600) {
  await redis.set(key, '1', 'EX', ttlSeconds);
}

// ── Activer les rooms planifiées ──────────────────────────────────────────
async function activateDueRooms() {
  const { rows } = await pool.query(
    `SELECT r.id, r.title, r.org_id, r.host_user_id, r.scheduled_at
     FROM video_rooms r
     WHERE r.status = 'scheduled'
       AND r.scheduled_at <= now() + interval '2 minutes'
       AND r.scheduled_at > now() - interval '10 minutes'`
  );

  for (const room of rows) {
    const key = `vc:activated:${room.id}`;
    if (await hasProcessed(key)) continue;
    await markProcessed(key, 3600);

    try {
      await pool.query(
        `UPDATE video_rooms
         SET status = 'active', started_at = now(), updated_at = now()
         WHERE id = $1 AND status = 'scheduled'`,
        [room.id]
      );

      // Notifier tous les participants invités
      const { rows: parts } = await pool.query(
        `SELECT vp.user_id
         FROM video_room_participants vp
         WHERE vp.room_id = $1 AND vp.status = 'invited'`,
        [room.id]
      );
      for (const p of parts) {
        await vcService.insertNotification({
          userId: p.user_id,
          type: 'video_room_started',
          payload: { roomId: room.id, title: room.title, orgId: room.org_id },
        });
      }

      // Pub/sub Redis pour les clients connectés
      await redis.publish('video:room_started', JSON.stringify({
        roomId: room.id, orgId: room.org_id, title: room.title,
      })).catch(() => {});

      await vcService.auditLog({
        orgId: room.org_id,
        actorUserId: room.host_user_id,
        action: 'VIDEO_SESSION_STARTED',
        roomId: room.id,
        metadata: { title: room.title, scheduledAt: room.scheduled_at },
      });

      console.log(`[scheduler] Room activée : ${room.id} - ${room.title}`);
    } catch (err) {
      console.error(`[scheduler] Erreur activation ${room.id}:`, err.message);
    }
  }
}

// ── Envoyer les rappels 15 min ─────────────────────────────────────────────
async function sendReminders() {
  const { rows } = await pool.query(
    `SELECT r.id, r.title, r.org_id, r.scheduled_at
     FROM video_rooms r
     WHERE r.status = 'scheduled'
       AND r.scheduled_at BETWEEN now() + interval '14 minutes' AND now() + interval '16 minutes'`
  );

  for (const room of rows) {
    const key = `vc:reminder:${room.id}`;
    if (await hasProcessed(key)) continue;
    await markProcessed(key, 3600);

    try {
      const { rows: parts } = await pool.query(
        `SELECT vp.user_id
         FROM video_room_participants vp
         WHERE vp.room_id = $1 AND vp.status IN ('invited','active')`,
        [room.id]
      );
      for (const p of parts) {
        await vcService.insertNotification({
          userId: p.user_id,
          type: 'video_room_reminder',
          payload: {
            roomId: room.id,
            title: room.title,
            scheduledAt: room.scheduled_at,
            minutesLeft: 15,
          },
        });
      }

      console.log(`[scheduler] Rappels envoyés pour room : ${room.id}`);
    } catch (err) {
      console.error(`[scheduler] Erreur rappel ${room.id}:`, err.message);
    }
  }
}

// ── Nettoyer les rooms actives sans participants ───────────────────────────
async function cleanupEmptyRooms() {
  // Rooms actives depuis plus de 12h sans aucun participant actif
  const { rows } = await pool.query(
    `SELECT r.id, r.org_id, r.host_user_id, r.title
     FROM video_rooms r
     WHERE r.status = 'active'
       AND r.started_at < now() - interval '12 hours'
       AND NOT EXISTS (
         SELECT 1 FROM video_room_participants p
         WHERE p.room_id = r.id AND p.status = 'active'
       )`
  );

  for (const room of rows) {
    try {
      await vcService.endRoom(room.id, room.host_user_id, room);
      console.log(`[scheduler] Room nettoyée (inactivité) : ${room.id}`);
    } catch (err) {
      console.error(`[scheduler] Erreur nettoyage ${room.id}:`, err.message);
    }
  }
}

// ── Tick principal ────────────────────────────────────────────────────────
async function tick() {
  try {
    await activateDueRooms();
    await sendReminders();
    // Nettoyage toutes les heures via Redis flag
    const cleanKey = 'vc:cleanup:last';
    const lastClean = await redis.get(cleanKey);
    if (!lastClean) {
      await redis.set(cleanKey, Date.now().toString(), 'EX', 3600);
      await cleanupEmptyRooms();
    }
  } catch (err) {
    console.error('[scheduler] Erreur tick:', err.message);
  }
}

function start() {
  if (schedulerInterval) return;
  console.log('[scheduler] Démarrage du scheduler vidéoconférence');
  // Premier tick immédiat
  tick();
  schedulerInterval = setInterval(tick, TICK_MS);
}

function stop() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

module.exports = { start, stop };
