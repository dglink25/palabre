import { useEffect, useRef, useState } from 'react';
import { AFRICAN_COUNTRIES, flagEmoji, findCountry } from '../lib/africanCountries';

function parseE164(value) {
  if (!value || !value.startsWith('+')) return null;
  const digits = value.slice(1);
  // Les indicatifs les plus longs d'abord, pour ne pas confondre par ex. +27 (Afrique du Sud) et +254 (Kenya).
  const sorted = [...AFRICAN_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  const match = sorted.find((c) => digits.startsWith(c.dialCode));
  if (!match) return null;
  return { country: match, local: digits.slice(match.dialCode.length) };
}

/**
 * Champ téléphone "comme sur les sites pro" : sélecteur de pays (drapeau +
 * indicatif) avec recherche, combiné à un champ pour le numéro local
 * uniquement - l'utilisateur ne compose jamais lui-même le préfixe
 * international. `onChange` reçoit directement le numéro complet au format
 * E.164 (ex. "+22961000000"), prêt à être envoyé à l'API.
 *
 * `defaultCountryCode` : code ISO2 présélectionné (ex. "BJ").
 */
export default function PhoneInput({ defaultCountryCode = 'BJ', defaultValue = '', onChange, autoFocus }) {
  const initial = parseE164(defaultValue) || { country: findCountry(defaultCountryCode), local: '' };
  const [country, setCountry] = useState(initial.country);
  const [localNumber, setLocalNumber] = useState(initial.local);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    const digits = localNumber.replace(/\D/g, '');
    onChange({
      e164: digits ? `+${country.dialCode}${digits}` : '',
      countryCode: country.code,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, localNumber]);

  const filtered = AFRICAN_COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.dialCode.includes(search)
  );

  return (
    <div className="phone-input" ref={wrapperRef}>
      <button type="button" className="phone-input-country" onClick={() => setOpen((v) => !v)}>
        <span className="flag">{flagEmoji(country.code)}</span>
        <span>+{country.dialCode}</span>
        <span className="chevron">▾</span>
      </button>
      <input
        type="tel"
        inputMode="numeric"
        className="phone-input-number"
        placeholder="61 00 00 00"
        value={localNumber}
        autoFocus={autoFocus}
        onChange={(e) => setLocalNumber(e.target.value)}
      />
      {open && (
        <div className="phone-country-dropdown">
          <input
            className="phone-country-search"
            placeholder="Rechercher un pays..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <ul>
            {filtered.map((c) => (
              <li key={c.code}>
                <button type="button" onClick={() => { setCountry(c); setOpen(false); setSearch(''); }}>
                  <span className="flag">{flagEmoji(c.code)}</span>
                  <span className="country-name">{c.name}</span>
                  <span className="text-secondary">+{c.dialCode}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="text-secondary" style={{ padding: '10px 14px' }}>Aucun pays trouvé.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
