import { AFRICAN_COUNTRIES } from './africanCountries';

// Longueur minimale (en chiffres locaux) considérée comme valide pour chaque pays.
// Tu peux affiner progressivement ; ces valeurs couvrent les principaux cas.
const MIN_LOCAL_LENGTH = {
  BJ: 8, BF: 8, CI: 8, SN: 9, ML: 8, NE: 8, TG: 8, GH: 9, NG: 10,
  CM: 9, GA: 8, CG: 9, CD: 9, CF: 8, TD: 8, GN: 9, GW: 7, LR: 9,
  SL: 8, GM: 7, MR: 8, DZ: 9, MA: 9, TN: 8, LY: 9, EG: 10, ET: 9,
  KE: 9, TZ: 9, UG: 9, RW: 9, BI: 8, ZA: 9, MZ: 9, AO: 9, ZM: 9,
  ZW: 9, MW: 9, MG: 9, MU: 8, SC: 7, SO: 8, SD: 9, SS: 9, ER: 7,
  DJ: 8, KM: 7, CV: 7, ST: 7, GQ: 9, LR2: 9,
};

const DEFAULT_MIN = 7;

export function getMinLocalLength(countryCode) {
  return MIN_LOCAL_LENGTH[countryCode] || DEFAULT_MIN;
}

/**
 * Valide un numéro E.164 (ex. "+22961000000") en fonction du pays
 * et renvoie { valid: boolean, reason?: string }.
 */
export function validateE164(e164, countryCode) {
  if (!e164 || !e164.startsWith('+')) {
    return { valid: false, reason: 'Numéro de téléphone manquant.' };
  }
  const country = AFRICAN_COUNTRIES.find((c) => c.code === countryCode);
  if (!country) {
    return { valid: false, reason: 'Pays inconnu.' };
  }
  if (!e164.startsWith(`+${country.dialCode}`)) {
    return { valid: false, reason: "L'indicatif ne correspond pas au pays sélectionné." };
  }
  const local = e164.slice(country.dialCode.length + 1).replace(/\D/g, '');
  const min = getMinLocalLength(countryCode);
  if (local.length < min) {
    return { valid: false, reason: `Le numéro doit contenir au moins ${min} chiffres pour ${country.name}.` };
  }
  if (local.length > 15) {
    return { valid: false, reason: 'Numéro trop long.' };
  }
  return { valid: true };
}