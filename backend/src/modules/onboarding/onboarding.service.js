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
    await sendMail({
      to: leaderEmail,
      subject: 'Palabre - Demande recue',
      text: `Dossier ${orgName} recu et en cours d instruction.`,
      html: wrapEmail({
        title: 'Demande recue',
        preheader: `Dossier ${orgName} en cours d instruction`,
        accent: 'primary',
        bodyHtml: `
          <p style="margin:0 0 16px 0;">Dossier <strong>${orgName}</strong> recu et en cours d instruction.</p>
          ${button({ url: statusLink, label: 'Suivre mon dossier', accent: 'primary' })}
        `,
      }),
    }).catch((e) => console.error('[onboarding] echec e-mail de confirmation', e.message));
  }
  if (leaderPhone) {
    convessaSend(leaderPhone, `Palabre - Dossier recu\n\n${orgName} en cours d instruction.\n\nSuivi : ${statusLink}`)
      .catch((e) => console.error('[onboarding] echec WhatsApp de confirmation', e.message));
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
  const filterParams = [];
  if (status) {
    filterParams.push(status);
    conditions.push(`status = $${filterParams.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const paginationParams = [...filterParams, pageSize, (page - 1) * pageSize];
  const { rows } = await pool.query(
    `SELECT id, status, step1_organization, step2_leader, submitted_at, reviewed_at, created_at, organization_id
     FROM organization_requests ${where}
     ORDER BY created_at DESC LIMIT $${filterParams.length + 1} OFFSET $${filterParams.length + 2}`,
    paginationParams
  );
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM organization_requests ${where}`,
    filterParams
  );
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
      text: `Dossier ${orgName} - correction requise.\n\nMotif : ${reason}`,
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

    // Compte administrateur
    // Si un utilisateur avec ce téléphone OU cet email existe déjà,
    // on vérifie la cohérence avant de réutiliser — pas de réutilisation aveugle.
    let adminUser;
    const existing = await client.query(
      'SELECT * FROM users WHERE phone_e164 = $1 OR (email = $2 AND email IS NOT NULL)',
      [leader.phone, leader.email || null]
    );
    if (existing.rows[0]) {
      const found = existing.rows[0];
      // Vérifier qu'il n'y a pas de conflit email/téléphone sur deux utilisateurs différents
      if (existing.rows.length > 1) {
        const err = new Error(`Conflit : le telephone et l'email du dossier correspondent a deux comptes differents. Corrigez le dossier.`);
        err.code = 'USER_CONFLICT'; err.httpStatus = 409; throw err;
      }
      adminUser = found;
      // Mettre à jour les infos si le compte existant est incomplet
      if (!found.full_name || !found.email || !found.phone_e164) {
        const upd = await client.query(
          `UPDATE users SET
            full_name  = COALESCE(full_name, $1),
            email      = COALESCE(email, $2),
            phone_e164 = COALESCE(phone_e164, $3)
           WHERE id = $4 RETURNING *`,
          [leader.fullName, leader.email, leader.phone, found.id]
        );
        adminUser = upd.rows[0];
      }
    } else {
      const userInsert = await client.query(
        'INSERT INTO users (full_name, email, phone_e164) VALUES ($1,$2,$3) RETURNING *',
        [leader.fullName, leader.email, leader.phone]
      );
      adminUser = userInsert.rows[0];
    }

    const roleResult = await client.query("SELECT id FROM roles WHERE code = 'org_admin'");
    if (!roleResult.rows[0]) {
      const err = new Error("Role 'org_admin' introuvable en base. Verifiez la migration 001.");
      err.code = 'ROLE_NOT_FOUND'; err.httpStatus = 500; throw err;
    }
    // UPSERT : si membership existe déjà, s'assurer qu'il est actif avec le bon rôle
    await client.query(
      `INSERT INTO memberships (user_id, organization_id, role_id, status)
       VALUES ($1,$2,$3,'active')
       ON CONFLICT (user_id, organization_id)
       DO UPDATE SET role_id = EXCLUDED.role_id, status = 'active'`,
      [adminUser.id, organization.id, roleResult.rows[0].id]
    );

    // Jeton de contrôle de tenant + pairage VPN (section 10.1) : le secret
    // en clair n'est renvoyé qu'une fois, ici, jamais stocké tel quel.
    const rawControlToken = crypto.randomBytes(32).toString('base64url');
    await client.query(
      `INSERT INTO tenant_control_tokens (organization_id, token_hash, qr_issued_at) VALUES ($1,$2,now())`,
      [organization.id, crypto.createHash('sha256').update(rawControlToken).digest('hex')]
    );
    // Clé de pairing VPN WireGuard : paire Curve25519 générée côté serveur.
    // La clé privée est renvoyée UNE SEULE FOIS dans le qrPayload pour que
    // l'instance locale configure son interface WireGuard.
    // Le serveur central ne conserve que la clé publique pour configurer son peer.
    const { privateKey: wgPrivateKey, publicKey: wgPublicKey } = crypto.generateKeyPairSync('x25519', {
      publicKeyEncoding:  { type: 'spki',  format: 'der' },
      privateKeyEncoding: { type: 'pkcs8', format: 'der' },
    });
    // Encoder en base64 format WireGuard (32 octets raw Curve25519)
    // DER PKCS8 pour x25519 = 48 octets, les 16 derniers sont la clé raw
    const wgPrivateKeyB64 = wgPrivateKey.subarray(16).toString('base64');
    const wgPublicKeyB64  = wgPublicKey.subarray(12).toString('base64');

    await client.query(
      `INSERT INTO vpn_peers (organization_id, public_key, status) VALUES ($1,$2,'pending')`,
      [organization.id, wgPublicKeyB64]
    );

    // Code d'activation à usage unique (remplace "mot de passe imposé à la
    // première connexion" dans une architecture 100% sans mot de passe).
    const invitationCode = generateInvitationCode();
    await client.query(
      `INSERT INTO org_admin_invitations (organization_id, user_id, code_hash, expires_at)
       VALUES ($1, $2, $3, now() + ($4 * interval '1 hour'))`,
      [organization.id, adminUser.id, hashInvitationCode(invitationCode), INVITATION_TTL_HOURS]
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
    // si l'envoi rate) : e-mail HTML de marque + WhatsApp si un numero est disponible.
    if (leader.email) {
      const html = wrapEmail({
        title: 'Compte administrateur pret',
        preheader: `${org.name} - activation requise`,
        accent: 'success',
        bodyHtml: `
          <p style="margin:0 0 16px 0;">Dossier <strong>${org.name}</strong> valide. Votre compte administrateur est pret.</p>
          ${calloutBox({ label: 'Identifiant organisation', value: organization.id, accent: 'success' })}
          ${calloutBox({ label: 'Code activation', value: invitationCode, accent: 'success' })}
          <p style="margin:16px 0 0 0; color:#5F6368; font-size:13px;">Ces deux informations sont requises pour activer votre compte. Code valable ${INVITATION_TTL_HOURS}h.</p>
        `,
      });
      await sendMail({
        to: leader.email,
        subject: 'Palabre - Compte administrateur active',
        text: `Identifiant : ${organization.id}\nCode : ${invitationCode}\nExpire dans ${INVITATION_TTL_HOURS}h.`,
        html,
      }).catch((e) => console.error('[onboarding] echec e-mail activation', e.message));
    }
    if (leader.phone) {
      const whatsappText = `Palabre - Compte admin approuve\n\nOrganisation : ${org.name}\nIdentifiant : ${organization.id}\nCode activation : ${invitationCode}\nExpire dans ${INVITATION_TTL_HOURS}h.`;
      convessaSend(leader.phone, whatsappText).catch((e) => console.error('[onboarding] echec WhatsApp activation', e.message));
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
        tenantId:     organization.id,
        controlToken: rawControlToken,
        vpnPrivateKey: wgPrivateKeyB64,   // clé privée WireGuard de l'instance locale
        vpnPublicKey:  wgPublicKeyB64,    // clé publique (déjà stockée côté serveur)
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
 * Étape 1 de l'activation : valide le code d'invitation et retourne un
 * `activationToken` signé (TTL 10 min) contenant les informations masquées
 * du compte (téléphone et email partiellement cachés).
 *
 * L'administrateur DOIT ensuite lier son moyen de connexion via
 * `linkActivationMethod` — aucune session n'est émise ici.
 */
async function activateInvitation({ organizationId, code }) {
  const { rows } = await pool.query(
    `SELECT i.*, u.phone_e164, u.email, u.full_name, u.id as user_id
     FROM org_admin_invitations i
     JOIN users u ON u.id = i.user_id
     WHERE i.organization_id = $1 AND i.consumed_at IS NULL
     ORDER BY i.created_at DESC LIMIT 1`,
    [organizationId]
  );
  const invitation = rows[0];
  if (!invitation) {
    const err = new Error('Invitation introuvable ou deja utilisee.');
    err.code = 'INVITATION_NOT_FOUND'; err.httpStatus = 404; throw err;
  }

  // Vérifier le code AVANT l'expiration pour éviter l'énumération d'invitations actives
  if (hashInvitationCode(code) !== invitation.code_hash) {
    await pool.query('UPDATE org_admin_invitations SET attempts = attempts + 1 WHERE id = $1', [invitation.id]);
    const err = new Error('Code d\'activation incorrect.');
    err.code = 'INVITATION_INVALID'; err.httpStatus = 401; throw err;
  }
  if (new Date(invitation.expires_at) < new Date()) {
    const err = new Error('Ce code d\'activation a expire. Demandez un nouveau code.');
    err.code = 'INVITATION_EXPIRED'; err.httpStatus = 410; throw err;
  }
  if ((invitation.attempts || 0) >= (invitation.max_attempts || 10)) {
    const err = new Error('Trop de tentatives. Demandez un nouveau code.');
    err.code = 'INVITATION_LOCKED'; err.httpStatus = 429; throw err;
  }

  const jwt = require('jsonwebtoken');
  const secret = process.env.SUPER_ADMIN_STEP_SECRET || `${process.env.JWT_ACCESS_SECRET}_activation`;

  const phone = invitation.phone_e164 || '';
  const email = invitation.email || '';
  const phoneMask = phone.length > 2 ? `${'*'.repeat(phone.length - 2)}${phone.slice(-2)}` : '**';
  const emailParts = email.split('@');
  const emailMask = email
    ? `${'*'.repeat(Math.max(1, emailParts[0].length - 2))}${emailParts[0].slice(-2)}@${emailParts[1] || ''}`
    : '';

  const activationToken = jwt.sign(
    { purpose: 'org_admin_activation', invitationId: invitation.id, userId: invitation.user_id, organizationId },
    secret,
    { expiresIn: '10m' }
  );

  return { activationToken, organizationId, phoneHint: phoneMask, emailHint: emailMask, hasPhone: !!phone, hasEmail: !!email, fullName: invitation.full_name };
}

async function linkActivationMethod({ activationToken, method, credential, device }) {
  const jwt = require('jsonwebtoken');
  const secret = process.env.SUPER_ADMIN_STEP_SECRET || `${process.env.JWT_ACCESS_SECRET}_activation`;

  let payload;
  try { payload = jwt.verify(activationToken, secret); }
  catch {
    const err = new Error('Token d\'activation invalide ou expire. Recommencez depuis le debut.');
    err.code = 'ACTIVATION_TOKEN_INVALID'; err.httpStatus = 401; throw err;
  }
  if (payload.purpose !== 'org_admin_activation') {
    const err = new Error('Token invalide.'); err.code = 'ACTIVATION_TOKEN_INVALID'; err.httpStatus = 401; throw err;
  }

  const { rows: invRows } = await pool.query(
    'SELECT * FROM org_admin_invitations WHERE id = $1 AND consumed_at IS NULL', [payload.invitationId]
  );
  if (!invRows[0]) {
    const err = new Error('Invitation deja utilisee ou expiree.');
    err.code = 'INVITATION_NOT_FOUND'; err.httpStatus = 404; throw err;
  }

  const { rows: userRows } = await pool.query('SELECT * FROM users WHERE id = $1', [payload.userId]);
  const user = userRows[0];
  if (!user) {
    const err = new Error('Utilisateur introuvable.'); err.code = 'USER_NOT_FOUND'; err.httpStatus = 404; throw err;
  }

  if (method === 'phone') {
    if (!user.phone_e164) {
      const err = new Error('Aucun telephone associe a ce compte.'); err.code = 'NO_PHONE'; err.httpStatus = 400; throw err;
    }
    const otpService = require('../auth/otp.service');
    await otpService.verifyOtp(user.phone_e164, 'login', credential.code);

  } else if (method === 'email') {
    if (!user.email) {
      const err = new Error('Aucun email associe a ce compte.'); err.code = 'NO_EMAIL'; err.httpStatus = 400; throw err;
    }
    const emailService = require('../auth/email.service');
    await emailService.verifyCode(user.email, 'link', credential.code);

  } else if (method === 'google') {
    const { verifyFirebaseIdToken } = require('../../config/firebase');
    const identity = await verifyFirebaseIdToken(credential.idToken);

    if (!identity.email) {
      const err = new Error('Ce compte Google n\'a pas d\'adresse e-mail publique.');
      err.code = 'GOOGLE_NO_EMAIL'; err.httpStatus = 400; throw err;
    }
    const googleEmail = identity.email.toLowerCase();
    const userEmail   = (user.email || '').toLowerCase();
    if (googleEmail !== userEmail) {
      const maskedUser = userEmail.replace(/(.{2})([^@]*)(@.*)/, '$1***$3');
      const err = new Error(`Ce compte Google (${googleEmail}) ne correspond pas a l'email du compte organisation (${maskedUser}).`);
      err.code = 'EMAIL_MISMATCH'; err.httpStatus = 401; throw err;
    }

    // Vérifier conflit avec un autre user avant d'insérer
    const conflict = await pool.query(
      'SELECT user_id FROM oauth_accounts WHERE provider = $1 AND provider_uid = $2',
      ['google', identity.providerUid]
    );
    if (conflict.rows[0] && conflict.rows[0].user_id !== user.id) {
      // Réaffecter le lien Google vers ce compte (le bon)
      await pool.query(
        'UPDATE oauth_accounts SET user_id = $1, provider_email = $2 WHERE provider = $3 AND provider_uid = $4',
        [user.id, identity.email, 'google', identity.providerUid]
      );
    } else if (!conflict.rows[0]) {
      await pool.query(
        'INSERT INTO oauth_accounts (user_id, provider, provider_uid, provider_email) VALUES ($1,$2,$3,$4)',
        [user.id, 'google', identity.providerUid, identity.email]
      );
    }
    // Si déjà lié correctement à ce user : rien à faire

    // Marquer l'email vérifié
    await pool.query('UPDATE users SET email_verified = true WHERE id = $1', [user.id]);

  } else {
    const err = new Error('Methode non supportee. Utilisez phone, email ou google.');
    err.code = 'INVALID_METHOD'; err.httpStatus = 400; throw err;
  }

  // Marquer l'email comme vérifié pour email/google
  if (method === 'email') {
    await pool.query('UPDATE users SET email_verified = true WHERE id = $1', [user.id]);
  }

  // Consommer TOUTES les invitations non-consommées de cette organisation
  await pool.query(
    'UPDATE org_admin_invitations SET consumed_at = now() WHERE organization_id = $1 AND consumed_at IS NULL',
    [payload.organizationId]
  );

  const deviceService = require('../auth/device.service');
  const deviceRow = await deviceService.getOrCreateDevice(device);

  // Recharger l'utilisateur avec email_verified mis à jour
  const { rows: freshUser } = await pool.query('SELECT * FROM users WHERE id = $1', [user.id]);
  return { user: freshUser[0], deviceRow };
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
  linkActivationMethod,
};
