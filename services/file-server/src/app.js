const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const uploadRouter = require('./routes/upload');
const downloadRouter = require('./routes/download');
const { authMiddleware } = require('./middleware/auth');

const app = express();

app.use(helmet({
  // Les fichiers sont servis directement — pas de frameguard agressif
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST', 'DELETE'],
}));

app.use(express.json({ limit: '1kb' })); // JSON minimal — les fichiers passent par multipart

// Rate limiting global
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message: 'Trop de requêtes.' } },
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'file-server' });
});

// Toutes les routes fichiers nécessitent un JWT valide
app.use('/files', authMiddleware);
app.use('/files/upload', uploadRouter);
app.use('/files', downloadRouter);

// 404
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ressource introuvable.' } });
});

// Erreurs
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[file-server:error]', err.message);
  const status = err.httpStatus || 500;
  res.status(status).json({
    error: { code: err.code || 'SERVER_ERROR', message: err.message },
  });
});

module.exports = app;
