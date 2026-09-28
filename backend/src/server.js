require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`[palabre-backend] démarré sur le port ${PORT}`);
  console.log(`[palabre-backend] documentation API : http://localhost:${PORT}/docs`);
});
