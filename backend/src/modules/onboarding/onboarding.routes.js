const express = require('express');
const rateLimit = require('express-rate-limit');
const onboardingService = require('./onboarding.service');
const authService = require('../auth/auth.service');
const otpService = require('../auth/otp.service');
const emailService = require('../auth/email.service');
const { requireAuth, requireTwoFactorIfEnabled } = require('../../middleware/authMiddleware');
const { requireSuperAdmin } = require('../../middleware/rbac');
const writeConfirmationService = require('../security/writeConfirmation.service');
const { requireCaptcha } = require('../../middleware/captcha');
const { makeUploader, publicUrlFor } = require('../../middleware/upload');

const router = express.Router();
const docUpload = makeUploader('onboarding-documents', { maxSizeMB: 15, allowedMimePrefixes: ['image/', 'application/pdf'] });
const publicLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

function draftTokenFromRequest(req) {
  return req.headers['x-draft-token'] || req.body.draftToken;
}

/* ======================================================================
 * FORMULAIRE PUBLIC (section 8) - aucune authentification, protégé par
 * jeton de brouillon (voir draftToken.js) + limitation de débit.
 * ====================================================================== */

/**
 * @openapi
 * /onboarding/requests:
 *   post:
 *     tags: [Onboarding]
 *     summary: Démarre une nouvelle demande d'inscription d'organisation (brouillon vide).
 *     responses:
 *       201:
 *         description: >
 *           Brouillon créé. `draftToken` n'est renvoyé qu'ICI, une seule fois - à conserver côté client
 *           (ex. localStorage) pour reprendre la saisie plus tard sans perte de données.
 */
router.post('/requests', publicLimiter, async (req, res, next) => {
  try {
    res.status(201).json(await onboardingService.createDraft());
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /onboarding/requests/{id}:
 *   get:
 *     tags: [Onboarding]
 *     summary: Récupère l'état d'une demande (reprise de saisie), via le jeton de brouillon.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: header
 *         name: X-Draft-Token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: État actuel de la demande }
 *       404: { description: Demande introuvable ou jeton invalide }
 */
router.get('/requests/:id', publicLimiter, async (req, res, next) => {
  try {
    res.json(await onboardingService.getRequestForApplicant(req.params.id, draftTokenFromRequest(req)));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /onboarding/requests/{id}/steps/{stepKey}:
 *   patch:
 *     tags: [Onboarding]
 *     summary: >
 *       Met à jour une étape du formulaire (step1 = Organisation, step2 = Dirigeant, step4 = Certification).
 *       Fusion superficielle avec les données déjà saisies - reprise de saisie sans perte de données.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: stepKey
 *         required: true
 *         schema: { type: string, enum: [step1, step2, step4] }
 *       - in: header
 *         name: X-Draft-Token
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *     responses:
 *       200: { description: Étape mise à jour }
 *       409: { description: Demande déjà soumise (non modifiable librement) }
 */
router.patch('/requests/:id/steps/:stepKey', publicLimiter, async (req, res, next) => {
  try {
    const updated = await onboardingService.updateStep(req.params.id, draftTokenFromRequest(req), req.params.stepKey, req.body);
    res.json(updated);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /onboarding/requests/{id}/documents:
 *   post:
 *     tags: [Onboarding]
 *     summary: Étape 3 - Téléverse un document (RCCM, attestation IFU, pièce d'identité du dirigeant, logo).
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: header
 *         name: X-Draft-Token
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [type, file]
 *             properties:
 *               type: { type: string, enum: [rccm, ifuAttestation, leaderId, logo] }
 *               file: { type: string, format: binary }
 *     responses:
 *       200: { description: Document attaché à la demande }
 *       400: { description: Type de document manquant ou invalide }
 */
router.post('/requests/:id/documents', publicLimiter, docUpload.single('file'), async (req, res, next) => {
  try {
    const docType = req.body.type;
    if (!['rccm', 'ifuAttestation', 'leaderId', 'logo'].includes(docType)) {
      return res.status(400).json({ error: { code: 'INVALID_DOC_TYPE', message: 'Type de document invalide.' } });
    }
    if (!req.file) {
      return res.status(400).json({ error: { code: 'FILE_REQUIRED', message: 'Fichier manquant.' } });
    }
    const fileUrl = publicUrlFor('onboarding-documents', req.file.filename);
    const updated = await onboardingService.attachDocument(req.params.id, draftTokenFromRequest(req), docType, fileUrl);
    res.json(updated);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /onboarding/requests/{id}/submit:
 *   post:
 *     tags: [Onboarding]
 *     summary: Étape 4 - Soumet la demande complète pour instruction par le super-administrateur.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: header
 *         name: X-Draft-Token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Demande soumise }
 *       422: { description: Demande incomplète - voir `missingFields` dans la réponse d'erreur }
 */
router.post('/requests/:id/submit', publicLimiter, requireCaptcha, async (req, res, next) => {
  try {
    res.json(await onboardingService.submitRequest(req.params.id, draftTokenFromRequest(req)));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /onboarding/requests/{id}/correct:
 *   patch:
 *     tags: [Onboarding]
 *     summary: >
 *       Corrige UNIQUEMENT les champs signalés par le super-administrateur après un rejet
 *       (section 9, point 3) - sans recréer une nouvelle demande.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: header
 *         name: X-Draft-Token
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: "Clé = stepKey (step1/step2/step3/step4), valeur = champs corrigés"
 *             example: { "step1": { "address": "Nouvelle adresse complète" } }
 *     responses:
 *       200: { description: Demande corrigée et re-soumise automatiquement }
 *       403: { description: Un champ non signalé pour correction a été inclus }
 */
router.patch('/requests/:id/correct', publicLimiter, async (req, res, next) => {
  try {
    res.json(await onboardingService.correctRequest(req.params.id, draftTokenFromRequest(req), req.body));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /onboarding/invitations/activate:
 *   post:
 *     tags: [Onboarding]
 *     summary: >
 *       Première connexion de l'administrateur d'une organisation nouvellement approuvée, via le code
 *       d'activation reçu par e-mail/WhatsApp (équivalent sans mot de passe du "changement imposé à la
 *       première connexion").
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [organizationId, code, deviceFingerprint]
 *             properties:
 *               organizationId: { type: string }
 *               code: { type: string }
 *               deviceFingerprint: { type: string }
 *     responses:
 *       200: { description: Session ouverte pour l'administrateur }
 *       401: { description: Code invalide }
 *       410: { description: Code expiré }
 */
/**
 * @openapi
 * /onboarding/invitations/send-otp:
 *   post:
 *     tags: [Onboarding]
 *     summary: Envoie un OTP pour la liaison du moyen de connexion (téléphone ou email).
 */
router.post('/invitations/send-otp', publicLimiter, async (req, res, next) => {
  try {
    const { activationToken, method } = req.body;
    if (!activationToken || !['phone', 'email'].includes(method)) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'activationToken et method (phone|email) requis.' } });
    }

    // Décoder le token sans vérifier la signature complète pour obtenir userId
    const jwt = require('jsonwebtoken');
    const secret = process.env.SUPER_ADMIN_STEP_SECRET || `${process.env.JWT_ACCESS_SECRET}_activation`;
    let payload;
    try { payload = jwt.verify(activationToken, secret); }
    catch { return res.status(401).json({ error: { code: 'ACTIVATION_TOKEN_INVALID', message: 'Token invalide.' } }); }

    const { pool } = require('../../config/db');
    const userResult = await pool.query('SELECT phone_e164, email FROM users WHERE id = $1', [payload.userId]);
    const user = userResult.rows[0];
    if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'Utilisateur introuvable.' } });

    if (method === 'phone') {
      if (!user.phone_e164) return res.status(400).json({ error: { code: 'NO_PHONE', message: 'Aucun telephone associe a ce compte.' } });
      await otpService.sendOtp(user.phone_e164, 'login');
      res.json({ ok: true, hint: `${'*'.repeat(user.phone_e164.length - 2)}${user.phone_e164.slice(-2)}` });
    } else {
      if (!user.email) return res.status(400).json({ error: { code: 'NO_EMAIL', message: 'Aucun email associe a ce compte.' } });
      await emailService.sendVerification(user.email, 'link');
      const parts = user.email.split('@');
      const hint = `${'*'.repeat(Math.max(1, parts[0].length - 2))}${parts[0].slice(-2)}@${parts[1]}`;
      res.json({ ok: true, hint });
    }
  } catch (err) { next(err); }
});

/**
 * Renouvellement du code d'activation expire.
 * Genere un nouveau code et le renvoie par e-mail et WhatsApp.
 * Accessible uniquement si l'invitation precedente est expiree (pas consommee).
 */
router.post('/invitations/renew', publicLimiter, async (req, res, next) => {
  try {
    const { organizationId } = req.body;
    if (!organizationId) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'organizationId requis.' } });
    }

    // Verifier qu'il existe une invitation expiree non consommee
    const { pool } = require('../../config/db');
    const { rows: invRows } = await pool.query(
      `SELECT i.*, u.email, u.phone_e164, u.full_name, o.name as org_name
       FROM org_admin_invitations i
       JOIN users u ON u.id = i.user_id
       JOIN organizations o ON o.id = i.organization_id
       WHERE i.organization_id = $1 AND i.consumed_at IS NULL
       ORDER BY i.created_at DESC LIMIT 1`,
      [organizationId]
    );
    const inv = invRows[0];
    if (!inv) {
      return res.status(404).json({ error: { code: 'INVITATION_NOT_FOUND', message: 'Aucune invitation en attente pour cette organisation.' } });
    }
    if (new Date(inv.expires_at) > new Date()) {
      return res.status(409).json({ error: { code: 'NOT_EXPIRED', message: 'Le code actuel est encore valide.' } });
    }

    // Generer un nouveau code
    const crypto = require('crypto');
    const INVITATION_CODE_LENGTH = 8;
    const INVITATION_TTL_HOURS   = 72;
    const generateCode = () => crypto.randomBytes(INVITATION_CODE_LENGTH).toString('hex').slice(0, INVITATION_CODE_LENGTH).toUpperCase();
    const hashCode    = (c) => crypto.createHash('sha256').update(c).digest('hex');

    const newCode    = generateCode();
    const expiresAt  = new Date(Date.now() + INVITATION_TTL_HOURS * 3600 * 1000);

    await pool.query(
      `UPDATE org_admin_invitations
       SET code_hash = $1, expires_at = $2, attempts = 0
       WHERE id = $3`,
      [hashCode(newCode), expiresAt, inv.id]
    );

    // Envoyer par e-mail
    const { sendMail } = require('../../config/mailer');
    const { wrapEmail, calloutBox } = require('../../emails/brand');
    if (inv.email) {
      const html = wrapEmail({
        title: 'Nouveau code d activation',
        preheader: `${inv.org_name} - nouveau code`,
        accent: 'primary',
        bodyHtml: `
          <p style="margin:0 0 16px 0;">Voici votre nouveau code d activation pour <strong>${inv.org_name}</strong>.</p>
          ${calloutBox({ label: 'Identifiant organisation', value: organizationId, accent: 'primary' })}
          ${calloutBox({ label: 'Nouveau code d activation', value: newCode, accent: 'primary' })}
          <p style="margin:16px 0 0 0; color:#5F6368; font-size:13px;">Code valable ${INVITATION_TTL_HOURS}h.</p>
        `,
      });
      await sendMail({
        to: inv.email,
        subject: 'Palabre - Nouveau code d activation',
        text: `Identifiant : ${organizationId}\nNouveau code : ${newCode}\nExpire dans ${INVITATION_TTL_HOURS}h.`,
        html,
      }).catch((e) => console.error('[onboarding] echec renouvellement code', e.message));
    }

    // Envoyer par WhatsApp
    const { convessaSend } = require('../auth/otp.service');
    if (inv.phone_e164) {
      convessaSend(inv.phone_e164,
        `Palabre - Nouveau code activation\n\nOrganisation : ${inv.org_name}\nIdentifiant : ${organizationId}\nCode : ${newCode}\nExpire dans ${INVITATION_TTL_HOURS}h.`
      ).catch(() => {});
    }

    res.json({ ok: true, expiresAt });
  } catch (err) { next(err); }
});

router.post('/invitations/activate', publicLimiter, async (req, res, next) => {
  try {
    const { organizationId, code } = req.body;
    if (!organizationId || !code) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'organizationId et code sont requis.' } });
    }
    const result = await onboardingService.activateInvitation({ organizationId, code });
    res.json(result);
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /onboarding/invitations/link:
 *   post:
 *     tags: [Onboarding]
 *     summary: >
 *       Étape 2 de l'activation : vérifie le moyen de connexion (téléphone OTP, email OTP ou Google)
 *       et ouvre la session si valide.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [activationToken, method, deviceFingerprint]
 *             properties:
 *               activationToken: { type: string }
 *               method: { type: string, enum: [phone, email, google] }
 *               credential:
 *                 type: object
 *                 description: "{ code } pour phone/email, { idToken } pour google"
 *               deviceFingerprint: { type: string }
 *     responses:
 *       200: { description: Session ouverte }
 *       401: { description: Code incorrect, token expiré, ou moyen de connexion non correspondant }
 */
router.post('/invitations/link', publicLimiter, async (req, res, next) => {
  try {
    const { activationToken, method, credential, deviceFingerprint, platform, model } = req.body;
    if (!activationToken || !method) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'activationToken et method sont requis.' } });
    }
    const { user, deviceRow } = await onboardingService.linkActivationMethod({
      activationToken,
      method,
      credential: credential || {},
      device: { deviceFingerprint, platform, model },
    });
    const result = await authService.issueSessionForUser({ user, deviceRow, ip: req.ip, userAgent: req.headers['user-agent'] });
    res.json(result);
  } catch (err) { next(err); }
});

/* ======================================================================
 * INSTRUCTION - SUPER-ADMINISTRATEUR UNIQUEMENT (section 9)
 * ====================================================================== */

/**
 * @openapi
 * /onboarding/admin/requests:
 *   get:
 *     tags: [Onboarding - Super-admin]
 *     summary: Liste les demandes d'inscription (filtrage par statut, pagination).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, submitted, rejected, approved] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200: { description: Liste paginée }
 */
router.get('/admin/requests', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    const { status, page, pageSize } = req.query;
    res.json(await onboardingService.listRequests({
      status,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    }));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /onboarding/admin/requests/{id}:
 *   get:
 *     tags: [Onboarding - Super-admin]
 *     summary: Détail complet d'une demande (toutes étapes, documents, historique).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Détail de la demande }
 */
router.get('/admin/requests/:id', requireAuth, requireSuperAdmin, async (req, res, next) => {
  try {
    res.json(await onboardingService.getRequestForReviewer(req.params.id));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /onboarding/admin/requests/{id}/reject:
 *   post:
 *     tags: [Onboarding - Super-admin]
 *     summary: Rejette une demande avec motif obligatoire (envoyé par e-mail) et liste des champs à corriger.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string }
 *               flaggedFields:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["step1_organization.address", "step3_documents.rccm"]
 *     responses:
 *       200: { description: Demande rejetée }
 *       400: { description: Motif manquant }
 */
router.post('/admin/requests/:id/reject', requireAuth, requireSuperAdmin, requireTwoFactorIfEnabled, writeConfirmationService.requireWriteConfirmation, async (req, res, next) => {
  try {
    res.json(await onboardingService.rejectRequest(req.params.id, req.body, req.user.id));
  } catch (err) { next(err); }
});

/**
 * @openapi
 * /onboarding/admin/requests/{id}/approve:
 *   post:
 *     tags: [Onboarding - Super-admin]
 *     summary: >
 *       Approuve la demande : crée l'organisation et son administrateur, génère le jeton de contrôle de
 *       tenant et le pairage VPN, envoie le code d'activation à l'administrateur, et renvoie le payload
 *       à encoder en QR code (section 10.1) - ces secrets ne sont plus récupérables après cette réponse.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Organisation créée, payload QR renvoyé une seule fois }
 *       409: { description: Statut de la demande incompatible avec une approbation }
 */
router.post('/admin/requests/:id/approve', requireAuth, requireSuperAdmin, requireTwoFactorIfEnabled, writeConfirmationService.requireWriteConfirmation, async (req, res, next) => {
  try {
    res.json(await onboardingService.approveRequest(req.params.id, req.user.id));
  } catch (err) { next(err); }
});

module.exports = router;
