const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Palabre API — Authentification, Profil, Sécurité, Sessions',
      version: '0.1.0',
      description:
        "Documentation des endpoints d'authentification sans mot de passe (OTP WhatsApp, connexion fédérée Google/GitHub/Facebook/Apple/TikTok), de gestion du profil, de sécurité (questions de sécurité, 2FA biométrique) et de gestion des sessions multi-appareils de Palabre.",
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.js'],
};

module.exports = swaggerJsdoc(options);
