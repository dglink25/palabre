require('dotenv').config();
const app = require('./app');
const scheduler = require('./modules/videoconference/scheduler.service');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`[palabre-backend] démarré sur le port ${PORT}`);
  console.log(`[palabre-backend] documentation API : http://localhost:${PORT}/docs`);
  // Démarrer le scheduler vidéoconférence (activation automatique des rooms planifiées)
  scheduler.start();
});
