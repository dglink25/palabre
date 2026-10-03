require('dotenv').config();
const http      = require('http');
const app       = require('./app');
const scheduler = require('./modules/videoconference/scheduler.service');
const { attachTunnelGateway } = require('./modules/tenant-provisioning/tunnel.gateway');
const { markInactiveTenants } = require('./modules/tenant-provisioning/tenant-provisioning.service');
const { attachSupportGateway } = require('./modules/support/support.gateway');

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
});
