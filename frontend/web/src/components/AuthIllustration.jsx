/**
 * Illustration décorative abstraite (nœuds reliés, écho du tourbillon du
 * logo), utilisée dans le panneau de droite des pages d'authentification.
 * Uniquement les 4 couleurs vives de la charte, en aplats - aucun dégradé.
 */
export default function AuthIllustration() {
  return (
    <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
      <circle cx="200" cy="200" r="150" fill="#FFFFFF" fillOpacity="0.08" />
      <line x1="200" y1="200" x2="90" y2="120" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" />
      <line x1="200" y1="200" x2="320" y2="110" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" />
      <line x1="200" y1="200" x2="80" y2="290" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" />
      <line x1="200" y1="200" x2="310" y2="300" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" />
      <line x1="200" y1="200" x2="200" y2="60" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2" />

      <circle cx="200" cy="200" r="34" fill="#FFFFFF" />
      <circle cx="200" cy="200" r="14" fill="#1A73E8" />

      <circle cx="90" cy="120" r="22" fill="#34A853" />
      <circle cx="320" cy="110" r="18" fill="#EA4335" />
      <circle cx="80" cy="290" r="16" fill="#FBBC05" />
      <circle cx="310" cy="300" r="20" fill="#1A73E8" />
      <circle cx="200" cy="60" r="12" fill="#FFFFFF" fillOpacity="0.7" />
    </svg>
  );
}
