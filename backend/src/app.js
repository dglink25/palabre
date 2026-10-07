const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');

const openapiSpec = require('./docs/swagger');
const authRoutes = require('./modules/auth/auth.routes');
const superAdminAuthRoutes = require('./modules/auth/superAdminAuth.routes');
const userRoutes = require('./modules/users/user.routes');
const securityRoutes = require('./modules/security/security.routes');
const passkeyRoutes = require('./modules/security/passkey.routes');
const sessionRoutes = require('./modules/sessions/session.routes');
const onboardingRoutes = require('./modules/onboarding/onboarding.routes');
const signalRoutes = require('./modules/messaging/signal.routes');
const conversationsRoutes = require('./modules/messaging/conversations.routes');
const turnRoutes   = require('./modules/calls/turn.routes');
const callsRoutes  = require('./modules/calls/calls.routes');
const orgRoutes    = require('./modules/org/org.routes');

const tenantRoutes = require('./modules/tenant/tenant.routes');
const videoconferenceRoutes = require('./modules/videoconference/videoconference.routes');
const tenantProvisioningRoutes = require('./modules/tenant-provisioning/tenant-provisioning.routes');
const supportRoutes = require('./modules/support/support.routes');
const developerRoutes = require('./modules/developer/developer.routes');
const aiRoutes = require('./modules/ai/ai.routes');
const reportRoutes = require('./modules/reports/report.routes');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors());
app.use(express.json());

// --- Fichiers uploadés (photos de profil, documents d'onboarding) ---
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
// Logo officiel, servi statiquement pour être référencé dans les e-mails
// par une URL publique absolue (voir emails/brand.js).
app.use('/brand', express.static(path.join(__dirname, 'brand')));

// --- Documentation API (Swagger) ---
app.get('/api/v1/openapi.json', (req, res) => res.json(openapiSpec));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
  customSiteTitle: 'Palabre API Docs',
}));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'palabre-backend' }));

// --- Routes API ---
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/auth/super-admin', superAdminAuthRoutes);
app.use('/api/v1/me', userRoutes);
app.use('/api/v1/security', securityRoutes);
app.use('/api/v1/security/passkeys', passkeyRoutes);
app.use('/api/v1/sessions', sessionRoutes);
app.use('/api/v1/onboarding', onboardingRoutes);
app.use('/api/v1/messaging/signal', signalRoutes);
app.use('/api/v1/conversations', conversationsRoutes);
// Alias /contacts → /conversations/contacts/list (pour les appels depuis CallsPage, ChatPage, etc.)
app.get('/api/v1/contacts', (req, res, next) => {
  req.url = '/contacts/list';
  conversationsRoutes(req, res, next);
});
app.use('/api/v1/calls', turnRoutes);
app.use('/api/v1/calls', callsRoutes);
app.use('/api/v1/org', orgRoutes);
// Routes internes multi-tenant (appelées uniquement par les agents tenant)
app.use('/api/v1/internal', tenantRoutes);
// Vidéoconférence (white-label Jitsi)
app.use('/api/v1/videoconference', videoconferenceRoutes);
// Provisionnement tenant local (DNS + tunnel + heartbeat)
app.use('/api/v1/tenants', tenantProvisioningRoutes);
// Service client (support) - Central_Server uniquement
app.use('/api/v1/support', supportRoutes);
// Plateforme développeur (comptes, projets, clés API, proxy, webhooks, stats)
app.use('/api/v1/developer', developerRoutes);
// Service AI (IVR service client, base de connaissance, config agent)
app.use('/api/v1/ai', aiRoutes);
// Rapports de sessions (vidéoconférences, appels P2P, support)
app.use('/api/v1/reports', reportRoutes);

// --- 404 ---
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ressource introuvable.' } });
});

// --- Gestion centralisée des erreurs ---
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[error]', err);
  const status = err.httpStatus || 400;
  res.status(status).json({
    error: { code: err.code || 'BAD_REQUEST', message: err.message || 'Erreur inattendue.' },
  });
});

module.exports = app;
