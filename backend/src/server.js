require('dotenv').config();
const http      = require('http');
const app       = require('./app');
const scheduler = require('./modules/videoconference/scheduler.service');
const { attachTunnelGateway } = require('./modules/tenant-provisioning/tunnel.gateway');
const { markInactiveTenants } = require('./modules/tenant-provisioning/tenant-provisioning.service');
const { attachSupportGateway } = require('./modules/support/support.gateway');
const statsService = require('./modules/developer/stats.service');

const PORT = process.env.PORT || 4000;

// Créer le serveur HTTP explicitement pour pouvoir y attacher les WebSockets
const server = http.createServer(app);

// ── Routage WebSocket ─────────────────────────────────────────────────────────
// Le package `ws` ne supporte pas bien deux WebSocketServer avec `path` distincts
// sur le même serveur HTTP (le premier consomme l'événement upgrade).
// Solution : chaque gateway crée son propre WSS en mode `noServer: true` et
// on route manuellement l'événement `upgrade` selon le path de la requête.

const tunnelWss  = attachTunnelGateway(server, { noServer: true });
const supportWss = attachSupportGateway(server, { noServer: true });

server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (pathname === '/tunnel/socket') {
    tunnelWss.handleUpgrade(request, socket, head, (ws) => {
      tunnelWss.emit('connection', ws, request);
    });
  } else if (pathname === '/support/socket') {
    supportWss.handleUpgrade(request, socket, head, (ws) => {
      supportWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`[palabre-backend] démarré sur le port ${PORT}`);
  console.log(`[palabre-backend] documentation API : http://localhost:${PORT}/docs`);
  console.log(`[palabre-backend] tunnel WebSocket  : ws://localhost:${PORT}/tunnel/socket`);
  console.log(`[palabre-backend] support WebSocket : ws://localhost:${PORT}/support/socket`);

  // Scheduler vidéoconférence (activation automatique des rooms planifiées)
  scheduler.start();

  // Nettoyage périodique des tenants inactifs (toutes les 5 minutes)
  setInterval(markInactiveTenants, 5 * 60_000);

  // Flush périodique des statistiques developer (Redis → PostgreSQL, toutes les 60s)
  statsService.startFlushLoop();

  // Purge automatique des statistiques developer (toutes les 24h, Requirement 12.4)
  // Supprime les developer_sdk_events de plus de 90 jours, en conservant les données
  // des projets supprimés jusqu'à deleted_at + 90 jours.
  const { pool } = require('./config/db');
  const STATS_RETENTION_DAYS = parseInt(process.env.DEVELOPER_STATS_RETENTION_DAYS || '90', 10);

  async function purgeOldStats() {
    try {
      const { rowCount } = await pool.query(
        `DELETE FROM developer_sdk_events
         WHERE created_at < now() - interval '${STATS_RETENTION_DAYS} days'
           AND project_id NOT IN (
             SELECT id FROM developer_projects
             WHERE deleted_at IS NOT NULL
               AND deleted_at > now() - interval '${STATS_RETENTION_DAYS} days'
           )`
      );
      if (rowCount > 0) {
        console.log(`[stats-purge] ${rowCount} entrées developer_sdk_events supprimées.`);
      }
    } catch (err) {
      console.error('[stats-purge] Erreur lors de la purge des statistiques:', err.message);
    }
  }

  // Lancer la purge immédiatement au démarrage, puis toutes les 24h
  purgeOldStats();
  setInterval(purgeOldStats, 24 * 60 * 60_000);
});
