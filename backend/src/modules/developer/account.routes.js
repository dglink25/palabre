// backend/src/modules/developer/account.routes.js
// Routes GET /accounts/me et POST /accounts/me
// Protégées par requireAuth (SSO JWT), appliqué au niveau de developer.routes.js

const router = require('express').Router();
const { pool } = require('../../config/db');



router.post('/me', async (req, res) => {
  const userId = req.user.id;

  try {
    // Tentative d'insertion ; si le compte existe déjà la contrainte UNIQUE
    // (uq_developer_accounts_user) déclenche le ON CONFLICT DO NOTHING.
    const insertResult = await pool.query(
      `INSERT INTO developer_accounts (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING id, user_id, status, created_at, updated_at`,
      [userId]
    );

    if (insertResult.rowCount === 1) {
      // Compte créé à l'instant
      const account = insertResult.rows[0];
      return res.status(201).json({ account });
    }

    // Compte déjà existant - on le retourne tel quel
    const selectResult = await pool.query(
      `SELECT id, user_id, status, created_at, updated_at
       FROM developer_accounts
       WHERE user_id = $1`,
      [userId]
    );

    return res.status(200).json({ account: selectResult.rows[0] });
  } catch (err) {
    console.error('[account.routes] POST /me error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' } });
  }
});

router.get('/me', async (req, res) => {
  const userId = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT
         da.id,
         da.user_id,
         da.status,
         da.created_at,
         da.updated_at,
         u.full_name AS name,
         u.photo_url AS avatar
       FROM developer_accounts da
       JOIN users u ON u.id = da.user_id
       WHERE da.user_id = $1`,
      [userId]
    );

    if (!rows[0]) {
      return res.status(404).json({
        error: { code: 'ACCOUNT_NOT_FOUND', message: 'Aucun compte développeur trouvé pour cet utilisateur.' },
      });
    }

    // Vérification : le compte retourné appartient bien à l'utilisateur authentifié
    if (rows[0].user_id !== userId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Accès refusé.' },
      });
    }

    return res.status(200).json({ account: rows[0] });
  } catch (err) {
    console.error('[account.routes] GET /me error:', err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erreur interne du serveur.' } });
  }
});

module.exports = router;
