/**
 * Traduit un code d'erreur API (voir chaque *.service.js du backend) en un
 * message clair, professionnel et sans jargon technique. Si le code n'est
 * pas reconnu, on retombe sur le message du serveur (déjà en français) —
 * jamais sur une trace technique brute.
 */
const MESSAGES = {
  // Réseau / générique
  NETWORK_ERROR: "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",
  UNKNOWN: "Une erreur inattendue est survenue. Veuillez réessayer.",

  // Téléphone / OTP
  INVALID_PHONE: "Ce numéro de téléphone ne semble pas valide. Vérifiez l'indicatif du pays.",
  OTP_COOLDOWN: "Un code a déjà été envoyé récemment. Merci de patienter avant d'en redemander un.",
  OTP_NOT_FOUND: "Aucun code n'est en attente pour ce numéro. Demandez-en un nouveau.",
  OTP_EXPIRED: "Ce code a expiré. Demandez-en un nouveau.",
  OTP_LOCKED: "Trop de tentatives incorrectes. Demandez un nouveau code.",
  OTP_INVALID: "Le code saisi est incorrect.",

  // Comptes
  ACCOUNT_ALREADY_EXISTS: "Un compte existe déjà avec cet identifiant. Essayez de vous connecter plutôt.",
  ACCOUNT_NOT_FOUND: "Aucun compte n'est associé à cet identifiant. Essayez de créer un compte.",
  DEVICE_ALREADY_USED: "Cet appareil est déjà associé à un autre compte Palabre. Connectez-vous avec ce compte, ou utilisez un autre appareil.",
  PROVIDER_ALREADY_LINKED: "Ce moyen de connexion est déjà utilisé par un autre compte Palabre.",
  PROVIDER_ALREADY_LINKED_SELF: "Ce moyen de connexion est déjà associé à votre compte.",
  EMAIL_ALREADY_USED: "Cette adresse e-mail est déjà utilisée par un autre compte.",

  // Sécurité / verrouillage
  TOO_MANY_ATTEMPTS: "Trop de tentatives de connexion. Merci de patienter quelques minutes avant de réessayer.",
  TOKEN_INVALID: "Votre session a expiré. Merci de vous reconnecter.",
  NO_TOKEN: "Vous devez être connecté pour effectuer cette action.",
  REFRESH_FAILED: "Votre session a expiré. Merci de vous reconnecter.",
  CONFIRMATION_REQUIRED: "Cette action nécessite une double vérification.",
  CONFIRMATION_INVALID: "Le code de confirmation est incorrect ou a expiré.",
  SUPER_ADMIN_IDLE_TIMEOUT: "Votre session super-administrateur a expiré après 15 minutes d'inactivité. Merci de vous reconnecter.",

  // Super-admin (parcours renforcé)
  STEP_TOKEN_INVALID: "Cette vérification a expiré. Merci de reprendre la connexion depuis le début.",
  CHALLENGE_NOT_FOUND: "Aucun code n'est en attente. Recommencez la connexion.",
  CODE_EXPIRED: "Ce code a expiré. Recommencez la connexion.",
  CODE_INVALID: "Le code saisi est incorrect.",
  CODE_LOCKED: "Trop de tentatives incorrectes. Recommencez la connexion.",
  PHONE_MISMATCH: "Ce numéro ne correspond pas au numéro enregistré pour ce compte.",
  NOT_ENOUGH_ANSWERS: "Répondez à au moins deux questions de sécurité pour continuer.",
  RECOVERY_FAILED: "Compte introuvable ou réponses incorrectes.",

  // Passkeys
  PASSKEY_CHALLENGE_EXPIRED: "La vérification a expiré. Réessayez.",
  PASSKEY_VERIFICATION_FAILED: "La vérification du passkey a échoué.",
  PASSKEY_UNKNOWN: "Ce passkey n'est pas reconnu.",
  NO_PASSKEYS: "Aucun passkey n'est enregistré sur ce compte pour la vérification en deux étapes.",
  PASSKEY_CANCELLED: "Opération annulée ou expirée. Réessayez et validez la demande de votre navigateur.",
  PASSKEY_SECURITY_ERROR: "Cette page n'est pas autorisée à utiliser les passkeys sur ce domaine.",
  PASSKEY_ALREADY_REGISTERED: "Ce passkey est déjà enregistré sur cet appareil.",
  PASSKEY_NOT_SUPPORTED: "Ce navigateur ou cet appareil ne prend pas en charge les passkeys.",
  PASSKEY_CLIENT_ERROR: "La vérification du passkey a échoué sur cet appareil. Réessayez.",

  // Connexion fédérée (Google, GitHub, Facebook, Apple, TikTok)
  FEDERATED_CANCELLED: "Connexion annulée.",
  FEDERATED_POPUP_BLOCKED: "La fenêtre de connexion a été bloquée par votre navigateur. Autorisez les fenêtres pop-up pour ce site et réessayez.",
  FEDERATED_NETWORK_ERROR: "Impossible de joindre le service de connexion. Vérifiez votre connexion internet.",
  FEDERATED_ACCOUNT_EXISTS: "Un compte existe déjà avec cette adresse e-mail via un autre moyen de connexion.",
  FEDERATED_UNKNOWN: "La connexion a échoué. Réessayez.",
  FEDERATED_UNAVAILABLE: "Le service de connexion externe est momentanément indisponible. Utilisez le téléphone ou un passkey, ou réessayez plus tard.",

  // Anti-robot
  CAPTCHA_REQUIRED: "Merci de confirmer que vous n'êtes pas un robot.",
  CAPTCHA_INVALID: "La vérification anti-robot a échoué. Réessayez.",

  // Onboarding
  REQUEST_NOT_FOUND: "Cette demande est introuvable, ou le lien utilisé n'est plus valide.",
  REQUEST_NOT_EDITABLE: "Cette demande ne peut plus être modifiée à ce stade.",
  REQUEST_INCOMPLETE: "Votre demande est incomplète.",
  ALREADY_SUBMITTED: "Cette demande a déjà été soumise.",
  NOT_REJECTED: "Cette demande n'est pas en attente de correction.",
  FIELD_NOT_FLAGGED: "Seuls les éléments signalés par le super-administrateur peuvent être corrigés.",
  REASON_REQUIRED: "Un motif est obligatoire pour rejeter une demande.",
  INVALID_STATUS: "Cette action n'est pas possible dans l'état actuel de la demande.",
  INVITATION_NOT_FOUND: "Ce code d'activation est introuvable ou a déjà été utilisé.",
  INVITATION_EXPIRED: "Ce code d'activation a expiré.",
  INVITATION_INVALID: "Le code d'activation est incorrect.",
};

export function friendlyMessage(error) {
  if (!error) return '';
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error.message) return error.message;
  return MESSAGES.UNKNOWN;
}
