const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.MAIL_HOST) {
    console.warn('[mailer] MAIL_HOST non défini — les e-mails seront seulement journalisés en console (mode dev).');
    transporter = {
      sendMail: async (opts) => {
        console.log('[mailer:dev] e-mail simulé →', { to: opts.to, subject: opts.subject });
        return { messageId: 'dev-simulated' };
      },
    };
    return transporter;
  }

  const port = parseInt(process.env.MAIL_PORT || '465', 10);
  // Port 465 = SSL implicite (Gmail) ; 587 = STARTTLS. MAIL_SECURE permet
  // de forcer explicitement si un autre fournisseur SMTP est utilisé.
  const secure = process.env.MAIL_SECURE ? process.env.MAIL_SECURE === 'true' : port === 465;

  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port,
    secure,
    auth: process.env.MAIL_USERNAME
      ? { user: process.env.MAIL_USERNAME, pass: process.env.MAIL_PASSWORD }
      : undefined,
  });
  return transporter;
}

async function sendMail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM || 'Palabre <no-reply@palabre.app>';
  return getTransporter().sendMail({ from, to, subject, text, html });
}

module.exports = { sendMail };
