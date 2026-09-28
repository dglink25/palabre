import { useEffect, useRef, useState } from 'react';
import { AFRICAN_COUNTRIES, flagEmoji, findCountry } from '../lib/africanCountries';

/**
 * Sélecteur de pays (drapeau + nom + indicatif) avec recherche,
 * même look & feel que le sélecteur du PhoneInput.
 *
 * Props :
 *  - value      : code ISO2 du pays sélectionné (ex. "BJ")
 *  - onChange   : (country) => void  - reçoit l'objet complet { code, name, dialCode }
 *  - defaultCountryCode : code ISO2 par défaut
 */
export default function CountrySelect({ value, onChange, defaultCountryCode = 'BJ', placeholder = 'Sélectionner un pays' }) {
  const initial = (value && findCountry(value)) || findCountry(defaultCountryCode);
  const [country, setCountry] = useState(initial);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef(null);

  // Sync si la prop `value` change de l'extérieur
  useEffect(() => {
    if (value && (!country || country.code !== value)) {
      const c = findCountry(value);
      if (c) setCountry(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function select(c) {
    setCountry(c);
    setOpen(false);
    setSearch('');
    if (onChange) onChange(c);
  }

  const filtered = AFRICAN_COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.dialCode.includes(search)
  );

  return (
    <div className="country-select" ref={wrapperRef}>
      <button type="button" className="country-select-trigger" onClick={() => setOpen((v) => !v)}>
        <span className="flag">{flagEmoji(country.code)}</span>
        <span className="country-select-name">{country.name || placeholder}</span>
        <span className="text-secondary">+{country.dialCode}</span>
        <span className="chevron">▾</span>
      </button>
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
                <button type="button" onClick={() => select(c)}>
                  <span className="flag">{flagEmoji(c.code)}</span>
                  <span className="country-name">{c.name}</span>
                  <span className="text-secondary">+{c.dialCode}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="text-secondary" style={{ padding: '10px 14px' }}>Aucun pays trouvé.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}