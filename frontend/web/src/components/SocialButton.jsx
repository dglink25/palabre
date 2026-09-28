/**
 * Bouton de connexion sociale avec logo officiel (SVG inline, aucun asset externe).
 *
 * Props :
 *  - provider : 'google' | 'github' | 'facebook' | 'apple' | 'tiktok'
 *  - label    : texte affiché (ex. "Continuer avec Google")
 *  - onClick  : handler
 *  - disabled : bool
 */

const PROVIDER_META = {
  google: {
    label: 'Continuer avec Google',
    // Logo officiel Google "G" multicolore
    logo: (
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
    ),
  },
  github: {
    label: 'Continuer avec GitHub',
    logo: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#181717" aria-hidden="true">
        <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.17c-3.2.69-3.88-1.36-3.88-1.36-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.17.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.13v3.16c0 .31.21.68.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/>
      </svg>
    ),
  },
  facebook: {
    label: 'Continuer avec Facebook',
    logo: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true">
        <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6.03 4.39 11.03 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.32l-.53 3.49h-2.79v8.44C19.61 23.1 24 18.1 24 12.07z"/>
      </svg>
    ),
  },
  apple: {
    label: 'Continuer avec Apple',
    logo: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#000000" aria-hidden="true">
        <path d="M16.36 12.78c-.02-2.48 2.03-3.67 2.12-3.73-1.16-1.69-2.96-1.92-3.6-1.95-1.53-.16-2.99.9-3.77.9-.79 0-1.98-.88-3.26-.85-1.68.03-3.23.98-4.09 2.48-1.75 3.04-.45 7.55 1.25 10.02.83 1.21 1.82 2.57 3.12 2.52 1.25-.05 1.72-.81 3.23-.81 1.5 0 1.93.81 3.25.79 1.34-.02 2.19-1.23 3.01-2.44.95-1.4 1.34-2.76 1.36-2.83-.03-.01-2.61-1-2.63-3.98-.02-.03-.01-.03-.01-.04zM13.88 5.3c.68-.83 1.14-1.98 1.01-3.13-.98.04-2.16.65-2.86 1.48-.63.73-1.18 1.9-1.03 3.02 1.09.09 2.2-.55 2.88-1.37z"/>
      </svg>
    ),
  },
  tiktok: {
    label: 'Continuer avec TikTok',
    logo: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#000000" d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.3 0 .58.04.86.13V9.4a6.33 6.33 0 0 0-5.4 10.74 6.33 6.33 0 0 0 10.86-4.43V8.7a8.16 8.16 0 0 0 4.77 1.52V6.75a4.85 4.85 0 0 1-.98-.06z"/>
        <path fill="#25F4EE" d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-2.13v11.86a2.89 2.89 0 0 1-5.2 1.74l-.02.03a2.89 2.89 0 0 1 2.31-4.64c.3 0 .58.04.86.13V9.4a6.33 6.33 0 0 0-5.4 10.74l.02-.03A6.33 6.33 0 0 0 13.69 22c3.5 0 6.33-2.83 6.33-6.33V8.7a8.16 8.16 0 0 0 4.77 1.52V6.75c-.34 0-.67-.02-.98-.06h-.22z" opacity=".35"/>
        <path fill="#FE2C55" d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-2.13v11.86a2.89 2.89 0 0 1-5.2 1.74l-.02.03A2.89 2.89 0 0 1 10.78 11c.3 0 .58.04.86.13V9.4a6.33 6.33 0 0 0-5.4 10.74l.02-.03a6.33 6.33 0 0 0 10.43-4.44V8.7a8.16 8.16 0 0 0 4.77 1.52V6.75c-.34 0-.67-.02-.98-.06h-.89z" opacity=".35"/>
      </svg>
    ),
  },
};

export default function SocialButton({ provider, label, onClick, disabled }) {
  const meta = PROVIDER_META[provider];
  if (!meta) return null;

  return (
    <button
      type="button"
      className={`social-btn social-btn-${provider}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label || meta.label}
    >
      <span className="social-btn-logo">{meta.logo}</span>
      <span className="social-btn-label">{label || meta.label}</span>
    </button>
  );
}

export { PROVIDER_META };