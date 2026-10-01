require('dotenv').config();
const http      = require('http');
const app       = require('./app');
const scheduler = require('./modules/videoconference/scheduler.service');
const { attachTunnelGateway } = require('./modules/tenant-provisioning/tunnel.gateway');
const { markInactiveTenants } = require('./modules/tenant-provisioning/tenant-provisioning.service');
const { attachSupportGateway } = require('./modules/support/support.gateway');

const PORT = process.env.PORT || 4000;

// Créer le serveur HTTP explicitement pour pouvoir y attacher le WebSocket
const server = http.createServer(app);

// Attacher le gateway WebSocket tunnel sur /tunnel/socket
attachTunnelGateway(server);

// Attacher le gateway WebSocket du service client sur /support/socket
attachSupportGateway(server);

server.listen(PORT, () => {
  console.log(`[palabre-backend] démarré sur le port ${PORT}`);
  console.log(`[palabre-backend] documentation API : http://localhost:${PORT}/docs`);
  console.log(`[palabre-backend] tunnel WebSocket : ws://localhost:${PORT}/tunnel/socket`);
  console.log(`[palabre-backend] support WebSocket : ws://localhost:${PORT}/support/socket`);

  // Scheduler vidéoconférence (activation automatique des rooms planifiées)
  scheduler.start();

  // Nettoyage périodique des tenants inactifs (toutes les 5 minutes)
  setInterval(markInactiveTenants, 5 * 60_000);
});
