/**
 * ======================================================================
 * GABARIT D'E-MAIL — CHARTE GRAPHIQUE PALABRE V1.0
 * ======================================================================
 * Couleurs EXACTES de la charte, aucune autre teinte, aucun dégradé,
 * aucun emoji. HTML en tableaux avec styles en ligne (compatibilité
 * clients mail). Règle 60-30-10 : fond neutre dominant (blanc / gris
 * clair), texte structurant en gris foncé, et une seule couleur vive par
 * e-mail pour guider l'attention (bandeau + accent contextuel).
 */

const COLORS = {
  primaryBlue: '#1A73E8',   // Bleu Réseau Primaire — CTA, liens, en-tête
  successGreen: '#34A853',  // Vert Émeraude — succès, statut opérationnel
  warningAmber: '#FBBC05',  // Jaune Ambre — vigilance, transition
  alertRed: '#EA4335',      // Rouge Énergie — urgence, arrêt critique
  white: '#FFFFFF',         // Blanc Pur — fond principal
  offWhite: '#F8F9FA',      // Gris Banquise — fond secondaire
  border: '#E0E0E0',        // Gris Filet — séparateurs / contours
  textSecondary: '#5F6368', // Gris Média — texte secondaire
  textPrimary: '#202124',   // Anthracite Sombre — texte principal
};

const FONT_STACK = "Arial, Helvetica, 'Segoe UI', sans-serif";

/**
 * `accent` détermine la couleur du bandeau et du bloc de mise en avant :
 * - 'primary' (bleu)  : vérifications, codes de connexion, actions courantes
 * - 'success' (vert)  : approbation, confirmation positive
 * - 'warning' (ambre) : demande de correction, action requise sans urgence critique
 * - 'alert' (rouge)   : sécurité critique (tentative de connexion suspecte)
 */
function accentColor(accent) {
  return {
    primary: COLORS.primaryBlue,
    success: COLORS.successGreen,
    warning: COLORS.warningAmber,
    alert: COLORS.alertRed,
  }[accent] || COLORS.primaryBlue;
}

/**
 * Bloc de mise en avant (code, motif, information clé) — fond blanc,
 * bordure fine dans la couleur d'accent, jamais de remplissage dégradé.
 */
function calloutBox({ label, value, accent = 'primary' }) {
  const color = accentColor(accent);
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="background-color:${COLORS.white}; border:2px solid ${color}; padding:18px 20px;">
          ${label ? `<div style="font-family:${FONT_STACK}; font-size:12px; letter-spacing:0.5px; text-transform:uppercase; color:${COLORS.textSecondary}; margin-bottom:6px;">${label}</div>` : ''}
          <div style="font-family:${FONT_STACK}; font-size:22px; font-weight:bold; color:${COLORS.textPrimary}; letter-spacing:1px;">${value}</div>
        </td>
      </tr>
    </table>`;
}

function button({ url, label, accent = 'primary' }) {
  const color = accentColor(accent);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="background-color:${color};">
          <a href="${url}" style="display:inline-block; padding:14px 28px; font-family:${FONT_STACK}; font-size:15px; font-weight:bold; color:${COLORS.white}; text-decoration:none;">${label}</a>
        </td>
      </tr>
    </table>`;
}

/**
 * Emballage complet du message. `bodyHtml` est le contenu déjà composé
 * (paragraphes, calloutBox, button...). `accent` colore le bandeau
 * d'en-tête, cohérent avec le contexte de l'e-mail.
 */
function wrapEmail({ title, preheader = '', bodyHtml, accent = 'primary' }) {
  const color = accentColor(accent);
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:${COLORS.offWhite}; font-family:${FONT_STACK};">
  <span style="display:none; max-height:0; overflow:hidden;">${preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.offWhite}; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:${COLORS.white}; border:1px solid ${COLORS.border}; max-width:600px;">
          <tr>
            <td style="background-color:${color}; padding:16px 32px;">
              <img src="${process.env.APP_BASE_URL || ''}/brand/logo.png" alt="Palabre" width="36" height="36" style="vertical-align:middle; display:inline-block;" />
              <span style="font-family:${FONT_STACK}; font-size:20px; font-weight:bold; color:${COLORS.white}; letter-spacing:1px; vertical-align:middle; margin-left:10px;">PALABRE</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px 0; font-family:${FONT_STACK}; font-size:19px; font-weight:bold; color:${COLORS.textPrimary};">${title}</h1>
              <div style="font-family:${FONT_STACK}; font-size:15px; line-height:1.6; color:${COLORS.textPrimary};">
                ${bodyHtml}
              </div>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid ${COLORS.border}; padding:20px 32px;">
              <p style="margin:0; font-family:${FONT_STACK}; font-size:12px; line-height:1.5; color:${COLORS.textSecondary};">
                Cet e-mail vous a été envoyé automatiquement par Palabre, votre plateforme de communication d'entreprise.
                Si vous n'êtes pas à l'origine de cette action, ignorez ce message ou contactez le support.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { COLORS, wrapEmail, calloutBox, button };
