/**
 * Seeder de test — réinitialise la base et insère des données de démonstration
 * pour valider le workflow complet (étapes 1-10 du cahier des charges).
 *
 * Usage :
 *   docker compose -f docker/docker-compose.yml exec backend node src/db/seed.js
 *
 * ATTENTION : supprime toutes les données existantes avant d'insérer.
 * À utiliser uniquement en développement / test.
 */
require('dotenv').config();
const crypto = require('crypto');
const { pool } = require('../config/db');

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashCode(code) {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function generateDraftToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashDraftToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// ── Reset ─────────────────────────────────────────────────────────────────────

async function reset(client) {
  console.log('[seed] Nettoyage des donnees...');
  await client.query(`
    TRUNCATE TABLE
      org_admin_invitations,
      organization_requests,
      memberships,
      organizations,
      oauth_accounts,
      account_recovery_methods,
      sessions,
      devices,
      users,
      audit_logs
    RESTART IDENTITY CASCADE
  `);
  console.log('[seed] Tables videes.');
}

// ── Données ───────────────────────────────────────────────────────────────────

async function seed(client) {
  console.log('[seed] Insertion des donnees de test...\n');

  // ── 1. Rôles (si pas déjà présents) ─────────────────────────────────────────
  for (const [code, label] of [
    ['super_admin', 'Super-administrateur'],
    ['org_admin',   'Administrateur organisation'],
    ['org_agent',   'Agent'],
    ['org_member',  'Membre'],
  ]) {
    await client.query(
      'INSERT INTO roles (code, label) VALUES ($1,$2) ON CONFLICT (code) DO NOTHING',
      [code, label]
    );
  }
  console.log('[seed] Roles OK');

  // ── 2. Super-administrateur ──────────────────────────────────────────────────
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'dglink25@gmail.com';
  const { rows: saRows } = await client.query(
    `INSERT INTO users (full_name, email, phone_e164, is_super_admin, email_verified)
     VALUES ('Super Admin Palabre', $1, '+22961000000', true, true)
     ON CONFLICT (email) DO UPDATE SET is_super_admin = true RETURNING *`,
    [superAdminEmail]
  );
  const superAdmin = saRows[0];
  console.log(`[seed] Super-admin : ${superAdmin.email} (id: ${superAdmin.id})`);

  // ── 3. Demande soumise — organisation "DGLink Demo" ──────────────────────────
  const draftToken1 = generateDraftToken();
  const { rows: req1Rows } = await client.query(
    `INSERT INTO organization_requests
       (draft_token_hash, status, step1_organization, step2_leader, step3_documents, step4_certification, submitted_at)
     VALUES ($1, 'submitted', $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, now()) RETURNING *`,
    [
      hashDraftToken(draftToken1),
      JSON.stringify({
        name: 'DGLink Demo',
        headquarters: 'Cotonou',
        country: 'Benin',
        countryCode: 'BJ',
        city: 'Cotonou',
        address: '123 Avenue Jean-Paul II',
        sector: 'Technologies',
        ifuNumber: '3202300001234',
      }),
      JSON.stringify({
        fullName: 'Azer Reza',
        gender: 'male',
        email: 'azer.reza@dglink.bj',
        phone: '+22997000001',
      }),
      JSON.stringify({
        ifuAttestation: 'https://example.com/ifu.pdf',
        leaderId:       'https://example.com/id.pdf',
        logo:           'https://example.com/logo.png',
      }),
      JSON.stringify({ infoCertified: true, termsAccepted: true }),
    ]
  );
  const req1 = req1Rows[0];
  console.log(`[seed] Demande soumise : ${req1.id} (token: ${draftToken1})`);
  console.log(`       Lien suivi : ${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/onboarding/status?id=${req1.id}&token=${draftToken1}`);

  // ── 4. Demande approuvée — organisation "CarEasy Demo" ───────────────────────
  const draftToken2  = generateDraftToken();
  const INVITE_CODE  = 'TESTCODE';
  const TTL_HOURS    = 72;

  // Créer l'organisation
  const { rows: orgRows } = await client.query(
    `INSERT INTO organizations (name, headquarters, country, city, address, sector, ifu_number, status)
     VALUES ('CarEasy Demo', 'Cotonou', 'Benin', 'Cotonou', '456 Boulevard St Michel', 'Automobile', '3202300005678', 'pending')
     RETURNING *`
  );
  const org = orgRows[0];

  // Créer l'admin org
  const { rows: adminRows } = await client.query(
    `INSERT INTO users (full_name, email, phone_e164, email_verified)
     VALUES ('Houndokinnou Admin', 'admin@careasy.bj', '+22997000002', false)
     ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name RETURNING *`
  );
  const adminUser = adminRows[0];

  // Attacher le rôle
  const { rows: roleRows } = await client.query("SELECT id FROM roles WHERE code = 'org_admin'");
  await client.query(
    `INSERT INTO memberships (user_id, organization_id, role_id, status)
     VALUES ($1,$2,$3,'active') ON CONFLICT (user_id, organization_id) DO UPDATE SET status = 'active'`,
    [adminUser.id, org.id, roleRows[0].id]
  );

  // Créer l'invitation
  await client.query(
    `INSERT INTO org_admin_invitations (organization_id, user_id, code_hash, expires_at)
     VALUES ($1,$2,$3, now() + ($4 * interval '1 hour'))`,
    [org.id, adminUser.id, hashCode(INVITE_CODE), TTL_HOURS]
  );

  // Demande approuvée
  await client.query(
    `INSERT INTO organization_requests
       (draft_token_hash, status, step1_organization, step2_leader, step3_documents, step4_certification,
        organization_id, created_admin_user_id, reviewed_by, reviewed_at, submitted_at)
     VALUES ($1,'approved',$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb,$6,$7,$8,now(),now()) `,
    [
      hashDraftToken(draftToken2),
      JSON.stringify({ name: 'CarEasy Demo', headquarters: 'Cotonou', country: 'Benin', countryCode: 'BJ', city: 'Cotonou', address: '456 Boulevard St Michel', sector: 'Automobile' }),
      JSON.stringify({ fullName: 'Houndokinnou Admin', gender: 'male', email: 'admin@careasy.bj', phone: '+22997000002' }),
      JSON.stringify({ ifuAttestation: 'https://example.com/ifu2.pdf', leaderId: 'https://example.com/id2.pdf', logo: 'https://example.com/logo2.png' }),
      JSON.stringify({ infoCertified: true, termsAccepted: true }),
      org.id,
      adminUser.id,
      superAdmin.id,
    ]
  );

  console.log(`\n[seed] Organisation approuvee : ${org.name} (id: ${org.id})`);
  console.log(`[seed] Admin org : ${adminUser.email} (id: ${adminUser.id})`);
  console.log(`\n[seed] === CREDENTIALS D'ACTIVATION (a utiliser sur /activate) ===`);
  console.log(`       Identifiant organisation : ${org.id}`);
  console.log(`       Code d'activation        : ${INVITE_CODE}`);
  console.log(`[seed] ============================================================\n`);

  // ── 5. Demande rejetée — organisation "TestRejet" ────────────────────────────
  const draftToken3 = generateDraftToken();
  const newDraftToken3 = generateDraftToken();
  await client.query(
    `INSERT INTO organization_requests
       (draft_token_hash, status, step1_organization, step2_leader, step3_documents, step4_certification,
        rejection_reason, flagged_fields, reviewed_by, reviewed_at, submitted_at)
     VALUES ($1,'rejected',$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb,$6,$7::jsonb,$8,now(),now())`,
    [
      hashDraftToken(newDraftToken3),
      JSON.stringify({ name: 'TestRejet SA', headquarters: 'Parakou', country: 'Benin', countryCode: 'BJ', city: 'Parakou', address: 'Rue du Marche', sector: 'Commerce' }),
      JSON.stringify({ fullName: 'Jean Rejet', gender: 'male', email: 'jean.rejet@test.bj', phone: '+22997000003' }),
      JSON.stringify({ ifuAttestation: 'https://example.com/ifu3.pdf', leaderId: 'https://example.com/id3.pdf', logo: 'https://example.com/logo3.png' }),
      JSON.stringify({ infoCertified: true, termsAccepted: true }),
      'L\'adresse est incomplete et l\'attestation IFU est illisible.',
      JSON.stringify(['step1_organization.address', 'step3_documents.ifuAttestation']),
      superAdmin.id,
    ]
  );
  console.log(`[seed] Demande rejetee pour : TestRejet SA`);
  console.log(`       Lien correction : ${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/onboarding/status?id=...&token=${newDraftToken3}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await reset(client);
    await seed(client);
    await client.query('COMMIT');
    console.log('\n[seed] Terminé avec succes.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[seed] ECHEC :', e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
