const crypto = require('crypto');
const { pool } = require('../../config/db');
const { generateDraftToken, hashDraftToken, verifyDraftToken } = require('./draftToken');
const { sendMail } = require('../../config/mailer');
const { wrapEmail, calloutBox, button } = require('../../emails/brand');
const { convessaSend } = require('../auth/otp.service');

const INVITATION_CODE_LENGTH = 8;
const INVITATION_TTL_HOURS = 72;

const FIELD_LABELS = {
  'step1_organization.name': 'Nom de l\'organisation',
  'step1_organization.headquarters': 'Siège',
  'step1_organization.country': 'Pays',
  'step1_organization.city': 'Ville',
  'step1_organization.address': 'Adresse complète',
  'step1_organization.sector': 'Secteur d\'activité',
  'step1_organization.ifuNumber': 'Numéro IFU',
  'step2_leader.fullName': 'Nom complet du dirigeant',
  'step2_leader.gender': 'Sexe',
  'step2_leader.email': 'E-mail du dirigeant',
  'step2_leader.phone': 'Téléphone du dirigeant',
  'step3_documents.rccm': 'RCCM',
  'step3_documents.ifuAttestation': 'Attestation IFU',
  'step3_documents.leaderId': 'Pièce d\'identité du dirigeant',
  'step3_documents.logo': 'Logo de l\'organisation',
};

/**
 * ======================================================================
 * ÉTAPE 1-4 - SAISIE DE LA DEMANDE (section 8)
 * ======================================================================
 */

async function createDraft() {
  const draftToken = generateDraftToken();
  const { rows } = await pool.query(
    `INSERT INTO organization_requests (draft_token_hash) VALUES ($1) RETURNING id, status, created_at`,
    [hashDraftToken(draftToken)]
  );
  // Le jeton n'est renvoyé qu'ICI, une seule fois - comme le code QR
  // technique (section 10.3), il n'est ni stocké en clair ni récupérable
  // après coup : à l'appelant de le conserver côté client (navigateur).
  return { ...rows[0], draftToken };
}

async function getRequestForApplicant(id, draftToken) {
  const { rows } = await pool.query('SELECT * FROM organization_requests WHERE id = $1', [id]);
  const request = rows[0];
  if (!request || !verifyDraftToken(draftToken, request.draft_token_hash)) {
    const err = new Error('Demande introuvable ou jeton invalide.');
    err.code = 'REQUEST_NOT_FOUND';
    err.httpStatus = 404;
    throw err;
  }
  return request;
}

const STEP_COLUMNS = {
  step1: 'step1_organization',
  step2: 'step2_leader',
  step3: 'step3_documents',
  step4: 'step4_certification',
};

/**
 * Reprise de saisie sans perte de données : chaque étape se met à jour
 * indépendamment (fusion superficielle avec ce qui existe déjà), possible
 * tant que la demande est en brouillon.
 */
async function updateStep(id, draftToken, stepKey, data) {
  const request = await getRequestForApplicant(id, draftToken);
  if (request.status !== 'draft') {
    const err = new Error('Cette demande n\'est plus modifiable librement (déjà soumise). Utilisez la correction si elle a été rejetée.');
    err.code = 'REQUEST_NOT_EDITABLE';
    err.httpStatus = 409;
    throw err;
  }
  const column = STEP_COLUMNS[stepKey];
  if (!column) {
    const err = new Error('Étape inconnue.');
    err.code = 'INVALID_STEP';
    throw err;
  }

  const { rows } = await pool.query(
    `UPDATE organization_requests SET ${column} = ${column} || $1::jsonb, updated_at = now()
     WHERE id = $2 RETURNING *`,
    [JSON.stringify(data || {}), id]
  );
  return rows[0];
}

async function attachDocument(id, draftToken, docType, fileUrl) {
  const request = await getRequestForApplicant(id, draftToken);
  if (request.status !== 'draft') {
    const err = new Error('Cette demande n\'accepte plus de nouveaux documents.');
    err.code = 'REQUEST_NOT_EDITABLE';
    err.httpStatus = 409;
    throw err;
  }
  const { rows } = await pool.query(
    `UPDATE organization_requests
     SET step3_documents = step3_documents || $1::jsonb, updated_at = now()
     WHERE id = $2 RETURNING *`,
    [JSON.stringify({ [docType]: fileUrl }), id]
  );
  return rows[0];
}

const REQUIRED_DOCS = ['ifuAttestation', 'leaderId', 'logo']; // rccm est facultatif (section 8, étape 3)

function buildStatusLink(requestId, draftToken) {
  const base = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
  return `${base}/onboarding/status?id=${requestId}&token=${draftToken}`;
}

function validateCompleteness(request) {
  const missing = [];
  const org = request.step1_organization || {};
  const leader = request.step2_leader || {};
  const docs = request.step3_documents || {};
  const cert = request.step4_certification || {};

  ['name', 'headquarters', 'country', 'city', 'address', 'sector'].forEach((f) => {
    if (!org[f]) missing.push(`step1_organization.${f}`);
  });
  ['fullName', 'gender', 'email', 'phone'].forEach((f) => {
    if (!leader[f]) missing.push(`step2_leader.${f}`);
  });
  REQUIRED_DOCS.forEach((f) => {
    if (!docs[f]) missing.push(`step3_documents.${f}`);
  });
  if (!cert.infoCertified) missing.push('step4_certification.infoCertified');
  if (!cert.termsAccepted) missing.push('step4_certification.termsAccepted');

  return missing;
}

async function submitRequest(id, draftToken) {
  const request = await getRequestForApplicant(id, draftToken);
  if (request.status !== 'draft') {
    const err = new Error('Cette demande a déjà été soumise.');
    err.code = 'ALREADY_SUBMITTED';
    err.httpStatus = 409;
    throw err;
  }

  const missing = validateCompleteness(request);
  if (missing.length > 0) {
    const err = new Error('Demande incomplète.');
    err.code = 'REQUEST_INCOMPLETE';
    err.httpStatus = 422;
    err.missingFields = missing;
    throw err;
  }

  const { rows } = await pool.query(
    `UPDATE organization_requests SET status = 'submitted', submitted_at = now(), updated_at = now()
     WHERE id = $1 RETURNING *`,
    [id]
  );
  const updated = rows[0];

  // Confirmation de réception, avec un lien d'accès direct au suivi du
  // dossier (le même jeton de brouillon reste valable - c'est l'applicant
  // lui-même qui vient de le fournir pour authentifier cet appel).
  const statusLink = buildStatusLink(id, draftToken);
  const leaderEmail = updated.step2_leader && updated.step2_leader.email;
  const leaderPhone = updated.step2_leader && updated.step2_leader.phone;
  const orgName = (updated.step1_organization && updated.step1_organization.name) || 'votre organisation';

  if (leaderEmail) {
    sendMail({
      to: leaderEmail,
      subject: 'Palabre - Demande d inscription recue',
      text: `Demande d inscription pour ${orgName} bien recue.\n\nSuivi de votre dossier : ${statusLink}`,
      html: wrapEmail({
        title: 'Demande bien recue',
        preheader: `Demande ${orgName} - en cours d instruction`,
        accent: 'primary',
        bodyHtml: `
          <p style="margin:0 0 8px 0;">Bonjour,</p>
          <p style="margin:0 0 16px 0;">Votre demande d inscription pour <strong>${orgName}</strong> a bien ete recue et va etre instruite par le super-administrateur de Palabre.</p>
          <p style="margin:0 0 8px 0;">Pour suivre son etat a tout moment :</p>
          ${button({ url: statusLink, label: 'Acceder a ma demande', accent: 'primary' })}
        `,
      }),
    }).catch((e) => console.error('[onboarding] echec e-mail de confirmation', e.message));
  }
  if (leaderPhone) {
    convessaSend(leaderPhone, `*Palabre - Demande reçue*\n\nVotre demande d'inscription pour *${orgName}* a bien été reçue et va être instruite.\n\nSuivi de votre dossier : ${statusLink}`)
      .catch((e) => console.error('[onboarding] échec WhatsApp de confirmation', e.message));
  }

  return updated;
}

/**
 * Correction après rejet (section 9, point 3) : SEULS les champs listés
 * dans flagged_fields peuvent être modifiés - on refuse toute autre clé
 * pour empêcher un demandeur de changer des informations non signalées à
 * l'insu du super-administrateur.
 */
async function correctRequest(id, draftToken, patchByStep) {
  const request = await getRequestForApplicant(id, draftToken);
  if (request.status !== 'rejected') {
    const err = new Error('Cette demande n\'est pas en attente de correction.');
    err.code = 'NOT_REJECTED';
    err.httpStatus = 409;
    throw err;
  }

  const flagged = new Set(request.flagged_fields || []);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [stepKey, data] of Object.entries(patchByStep || {})) {
      const column = STEP_COLUMNS[stepKey];
      if (!column) continue;
      const disallowed = Object.keys(data).filter((field) => !flagged.has(`${column}.${field}`));
      if (disallowed.length > 0) {
        const err = new Error(`Champ(s) non signalé(s) pour correction : ${disallowed.join(', ')}`);
        err.code = 'FIELD_NOT_FLAGGED';
        err.httpStatus = 403;
        throw err;
      }
      await client.query(
        `UPDATE organization_requests SET ${column} = ${column} || $1::jsonb, updated_at = now() WHERE id = $2`,
        [JSON.stringify(data), id]
      );
    }
    const { rows } = await client.query(
      `UPDATE organization_requests
       SET status = 'submitted', flagged_fields = '[]'::jsonb, rejection_reason = NULL, submitted_at = now(), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * ======================================================================
 * INSTRUCTION PAR LE SUPER-ADMINISTRATEUR (section 9)
 * ======================================================================
 */

async function listRequests({ status, page = 1, pageSize = 20 }) {
  const conditions = [];
  const params = [];
  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(pageSize, (page - 1) * pageSize);
  const { rows } = await pool.query(
    `SELECT id, status, step1_organization, step2_leader, submitted_at, reviewed_at, created_at
     FROM organization_requests ${where}
     ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  const countResult = await pool.query(`SELECT COUNT(*) FROM organization_requests ${where}`, params.slice(0, conditions.length));
  return { items: rows, total: parseInt(countResult.rows[0].count, 10), page, pageSize };
}

async function getRequestForReviewer(id) {
  const { rows } = await pool.query('SELECT * FROM organization_requests WHERE id = $1', [id]);
  if (!rows[0]) {
    const err = new Error('Demande introuvable.');
    err.code = 'REQUEST_NOT_FOUND';
    err.httpStatus = 404;
    throw err;
  }
  return rows[0];
}

async function writeAudit({ organizationId, actorUserId, action, targetType, targetId, metadata }) {
  await pool.query(
    `INSERT INTO audit_logs (organization_id, actor_user_id, action, target_type, target_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [organizationId || null, actorUserId || null, action, targetType || null, targetId || null, metadata ? JSON.stringify(metadata) : '{}']
  );
}

/**
 * Rejet avec motif obligatoire, envoyé par e-mail au demandeur (section 9,
 * points 2-3). `flaggedFields` liste précisément ce qui doit être corrigé.
 */
async function rejectRequest(id, { reason, flaggedFields }, reviewerId) {
  if (!reason || !reason.trim()) {
    const err = new Error('Le motif de rejet est obligatoire.');
    err.code = 'REASON_REQUIRED';
    err.httpStatus = 400;
    throw err;
  }
  const request = await getRequestForReviewer(id);
  if (request.status !== 'submitted') {
    const err = new Error('Seule une demande soumise peut être rejetée.');
    err.code = 'INVALID_STATUS';
    err.httpStatus = 409;
    throw err;
  }

  // Le jeton de brouillon est tourné à chaque rejet : le super-administrateur
  // n'a jamais accès au jeton en clair (seul son hash est stocké, comme un
  // mot de passe) - on en émet donc un nouveau pour permettre l'envoi d'un
  // lien d'accès direct fonctionnel, tout en invalidant l'ancien.
  const newDraftToken = generateDraftToken();
  const { rows } = await pool.query(
    `UPDATE organization_requests
     SET status = 'rejected', rejection_reason = $1, flagged_fields = $2::jsonb,
         draft_token_hash = $3, reviewed_by = $4, reviewed_at = now(), updated_at = now()
     WHERE id = $5 RETURNING *`,
    [reason, JSON.stringify(flaggedFields || []), hashDraftToken(newDraftToken), reviewerId, id]
  );
  const updated = rows[0];
  const statusLink = buildStatusLink(id, newDraftToken);

  const leaderEmail = updated.step2_leader && updated.step2_leader.email;
  const leaderPhone = updated.step2_leader && updated.step2_leader.phone;
  const orgName = (updated.step1_organization && updated.step1_organization.name) || 'votre organisation';

  if (leaderEmail) {
    const fieldsListHtml = (flaggedFields || []).length
      ? `<ul style="margin:8px 0 0 0; padding-left:20px; color:#202124;">${(flaggedFields || []).map((f) => `<li style="margin-bottom:4px;">${FIELD_LABELS[f] || f}</li>`).join('')}</ul>`
      : '';
    const html = wrapEmail({
      title: 'Correction requise pour votre dossier',
      preheader: `Dossier ${orgName} - action requise`,
      accent: 'warning',
      bodyHtml: `
        <p style="margin:0 0 8px 0;">Bonjour,</p>
        <p style="margin:0 0 16px 0;">Votre dossier <strong>${orgName}</strong> sur Palabre a ete examine et necessite une correction avant validation.</p>
        ${calloutBox({ label: 'Motif indique par le super-administrateur', value: reason, accent: 'warning' })}
        ${fieldsListHtml ? `<p style="margin:16px 0 4px 0; font-weight:bold;">Elements a corriger :</p>${fieldsListHtml}` : ''}
        <p style="margin:16px 0 8px 0;">Cliquez ci-dessous pour acceder directement a votre demande :</p>
        ${button({ url: statusLink, label: 'Acceder a mon dossier', accent: 'warning' })}
      `,
    });
    await sendMail({
      to: leaderEmail,
      subject: 'Palabre - Correction requise pour votre dossier',
      text: `Dossier ${orgName} - correction requise.\n\nMotif : ${reason}\n\nAccedez a votre demande : ${statusLink}`,
      html,
    }).catch((e) => console.error('[onboarding] echec envoi e-mail de rejet', e.message));
  }

  if (leaderPhone) {
    const whatsappText = `*Palabre - Demande d'inscription à corriger*\n\nVotre demande d'inscription pour *${orgName}* nécessite une correction avant validation.\n\n*Motif :* ${reason}\n\nPour tout complément de dossier, cliquez sur ce lien pour accéder directement à votre demande :\n${statusLink}`;
    convessaSend(leaderPhone, whatsappText).catch((e) => console.error('[onboarding] échec WhatsApp de rejet', e.message));
  }

  await writeAudit({ actorUserId: reviewerId, action: 'organization_request.rejected', targetType: 'organization_request', targetId: id, metadata: { reason, flaggedFields } });
  return updated;
}

function generateInvitationCode() {
  return crypto.randomBytes(INVITATION_CODE_LENGTH).toString('hex').slice(0, INVITATION_CODE_LENGTH).toUpperCase();
}
function hashInvitationCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Approbation (section 9, points 4-9) : crée l'organisation et son
 * administrateur, prépare le jeton de contrôle + le pairage VPN (section
 * 10.1), et envoie à l'administrateur son code d'activation (l'équivalent,
 * en système sans mot de passe, des "identifiants sécurisés envoyés par
 * e-mail" avec "changement imposé à la première connexion" : ici, la
 * première connexion doit obligatoirement passer par ce code - voir
 * `activateInvitation`). Ne couvre pas la génération d'APK ni les codes
 * USSD (section 9, points 10-12), qui relèvent de modules distincts.
 */
async function approveRequest(id, reviewerId) {
  const request = await getRequestForReviewer(id);
  if (request.status !== 'submitted') {
    const err = new Error('Seule une demande soumise peut être approuvée.');
    err.code = 'INVALID_STATUS';
    err.httpStatus = 409;
    throw err;
  }

  const org = request.step1_organization;
  const leader = request.step2_leader;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orgInsert = await client.query(
      `INSERT INTO organizations (name, headquarters, country, city, address, sector, ifu_number, logo_url, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING *`,
      [org.name, org.headquarters, org.country, org.city, org.address, org.sector, org.ifuNumber || null, request.step3_documents.logo || null]
    );
    const organization = orgInsert.rows[0];

    // Compte administrateur : créé directement par le super-administrateur
    // (le dirigeant n'a pas eu besoin de s'inscrire lui-même au préalable).
    // Conflit possible si ce téléphone/email a déjà un compte Palabre -
    // dans ce cas on rattache l'organisation à ce compte existant plutôt
    // que d'échouer, pour rester utilisable en conditions réelles.
    let adminUser;
    const existing = await client.query('SELECT * FROM users WHERE phone_e164 = $1 OR email = $2', [leader.phone, leader.email]);
    if (existing.rows[0]) {
      adminUser = existing.rows[0];
    } else {
      const userInsert = await client.query(
        `INSERT INTO users (full_name, email, phone_e164) VALUES ($1,$2,$3) RETURNING *`,
        [leader.fullName, leader.email, leader.phone]
      );
      adminUser = userInsert.rows[0];
    }

    const roleResult = await client.query(`SELECT id FROM roles WHERE code = 'org_admin'`);
    await client.query(
      `INSERT INTO memberships (user_id, organization_id, role_id, status) VALUES ($1,$2,$3,'active')
       ON CONFLICT (user_id, organization_id) DO NOTHING`,
      [adminUser.id, organization.id, roleResult.rows[0].id]
    );

    // Jeton de contrôle de tenant + pairage VPN (section 10.1) : le secret
    // en clair n'est renvoyé qu'une fois, ici, jamais stocké tel quel.
    const rawControlToken = crypto.randomBytes(32).toString('base64url');
    await client.query(
      `INSERT INTO tenant_control_tokens (organization_id, token_hash, qr_issued_at) VALUES ($1,$2,now())`,
      [organization.id, crypto.createHash('sha256').update(rawControlToken).digest('hex')]
    );
    const vpnPairingKey = crypto.randomBytes(32).toString('base64');
    await client.query(
      `INSERT INTO vpn_peers (organization_id, public_key, status) VALUES ($1,$2,'pending')`,
      [organization.id, vpnPairingKey]
    );

    // Code d'activation à usage unique (remplace "mot de passe imposé à la
    // première connexion" dans une architecture 100% sans mot de passe).
    const invitationCode = generateInvitationCode();
    await client.query(
      `INSERT INTO org_admin_invitations (organization_id, user_id, code_hash, expires_at)
       VALUES ($1,$2,$3, now() + interval '${INVITATION_TTL_HOURS} hours')`,
      [organization.id, adminUser.id, hashInvitationCode(invitationCode)]
    );

    await client.query(
      `UPDATE organization_requests
       SET status = 'approved', organization_id = $1, created_admin_user_id = $2,
           reviewed_by = $3, reviewed_at = now(), updated_at = now()
       WHERE id = $4`,
      [organization.id, adminUser.id, reviewerId, id]
    );

    await client.query('COMMIT');

    // Notifications best-effort (ne doivent pas faire échouer l'approbation
    // si l'envoi rate) : e-mail HTML de marque + WhatsApp si un numéro est disponible.
    if (leader.email) {
      const html = wrapEmail({
        title: 'Organisation approuvee',
        preheader: `${org.name} approuvee sur Palabre`,
        accent: 'success',
        bodyHtml: `
          <p style="margin:0 0 8px 0;">Bonjour,</p>
          <p style="margin:0 0 16px 0;">Votre dossier <strong>${org.name}</strong> a ete approuve. Votre compte administrateur est pret.</p>
          ${calloutBox({ label: 'Identifiant de votre organisation', value: organization.id, accent: 'success' })}
          ${calloutBox({ label: 'Code d activation (premiere connexion)', value: invitationCode, accent: 'success' })}
          <p style="margin:16px 0 4px 0; font-size:13px; color:#5F6368;">Conservez ces deux informations : elles sont toutes les deux necessaires pour activer votre compte administrateur.</p>
          <p style="margin:0 0 0 0; color:#5F6368; font-size:13px;">Le code expire dans ${INVITATION_TTL_HOURS} heures.</p>
        `,
      });
      sendMail({
        to: leader.email,
        subject: 'Palabre - Organisation approuvee',
        text: `Organisation ${org.name} approuvee.\n\nIdentifiant : ${organization.id}\nCode d activation (premiere connexion) : ${invitationCode}\n\nCe code expire dans ${INVITATION_TTL_HOURS}h.`,
        html,
      }).catch((e) => console.error('[onboarding] echec e-mail activation', e.message));
    }
    if (leader.phone) {
      const whatsappText = `*Palabre - Organisation approuvée*\n\nVotre organisation *${org.name}* est approuvée. Votre compte administrateur est prêt.\n\n*Identifiant de votre organisation :*\n${organization.id}\n\n*Code d'activation (première connexion) :*\n${invitationCode}\n\nConservez ces deux informations : elles sont toutes les deux nécessaires pour activer votre compte sur l'application Palabre.\nLe code expire dans ${INVITATION_TTL_HOURS} heures.`;
      convessaSend(leader.phone, whatsappText).catch((e) => console.error('[onboarding] échec WhatsApp activation', e.message));
    }

    await writeAudit({
      organizationId: organization.id,
      actorUserId: reviewerId,
      action: 'organization_request.approved',
      targetType: 'organization',
      targetId: organization.id,
    });

    return {
      organization,
      adminUser: { id: adminUser.id, fullName: adminUser.full_name, email: adminUser.email, phone: adminUser.phone_e164 },
      // Payload de démarrage à encoder en QR par le client (section 10.1) -
      // ces secrets bruts ne sont plus jamais récupérables après cette réponse.
      qrPayload: {
        tenantId: organization.id,
        controlToken: rawControlToken,
        vpnPairingKey,
        heartbeatUrl: `${process.env.APP_BASE_URL || ''}/api/v1/tenants/heartbeat`,
      },
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Première connexion de l'administrateur nouvellement créé : consomme le
 * code d'activation puis ouvre une session, comme un login classique.
 */
async function activateInvitation({ organizationId, code, device }) {
  const { rows } = await pool.query(
    `SELECT * FROM org_admin_invitations
     WHERE organization_id = $1 AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId]
  );
  const invitation = rows[0];
  if (!invitation) {
    const err = new Error('Invitation introuvable ou déjà utilisée.');
    err.code = 'INVITATION_NOT_FOUND';
    err.httpStatus = 404;
    throw err;
  }
  if (new Date(invitation.expires_at) < new Date()) {
    const err = new Error('Ce code d\'activation a expiré.');
    err.code = 'INVITATION_EXPIRED';
    err.httpStatus = 410;
    throw err;
  }
  if (hashInvitationCode(code) !== invitation.code_hash) {
    const err = new Error('Code d\'activation incorrect.');
    err.code = 'INVITATION_INVALID';
    err.httpStatus = 401;
    throw err;
  }

  await pool.query('UPDATE org_admin_invitations SET consumed_at = now() WHERE id = $1', [invitation.id]);
  const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [invitation.user_id]);

  const deviceService = require('../auth/device.service');
  const deviceRow = await deviceService.getOrCreateDevice(device);

  return { user: userResult.rows[0], deviceRow };
}

module.exports = {
  createDraft,
  getRequestForApplicant,
  updateStep,
  attachDocument,
  submitRequest,
  correctRequest,
  listRequests,
  getRequestForReviewer,
  rejectRequest,
  approveRequest,
  activateInvitation,
};
