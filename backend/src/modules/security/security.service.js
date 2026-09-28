const crypto = require('crypto');
const { pool } = require('../../config/db');

/**
 * ======================================================================
 * QUESTIONS DE SÉCURITÉ (utilisées pour la récupération de compte)
 * ======================================================================
 */
async function listAvailableQuestions() {
  const { rows } = await pool.query('SELECT id, code, label_fr FROM security_questions ORDER BY label_fr');
  return rows;
}

function hashAnswer(answer) {
  const normalized = answer.trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

async function setSecurityAnswers(userId, answers) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { questionId, answer } of answers) {
      await client.query(
        `INSERT INTO user_security_answers (user_id, security_question_id, answer_hash)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, security_question_id) DO UPDATE SET answer_hash = EXCLUDED.answer_hash`,
        [userId, questionId, hashAnswer(answer)]
      );
    }
    await client.query(
      `INSERT INTO account_recovery_methods (user_id, method_type, verified)
       VALUES ($1, 'security_questions', true)
       ON CONFLICT DO NOTHING`,
      [userId]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function verifySecurityAnswers(userId, answers) {
  for (const { questionId, answer } of answers) {
    const { rows } = await pool.query(
      'SELECT answer_hash FROM user_security_answers WHERE user_id = $1 AND security_question_id = $2',
      [userId, questionId]
    );
    if (!rows[0] || rows[0].answer_hash !== hashAnswer(answer)) {
      return false;
    }
  }
  return true;
}

module.exports = { listAvailableQuestions, setSecurityAnswers, verifySecurityAnswers };
