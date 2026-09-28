/**
 * Pays d'Afrique (54), utilisés par le sélecteur de pays du composant
 * PhoneInput. Le drapeau est dérivé du code ISO (pas d'image ni de
 * dépendance), voir flagEmoji().
 */
export const AFRICAN_COUNTRIES = [
  { code: 'ZA', name: 'Afrique du Sud', dialCode: '27' },
  { code: 'DZ', name: 'Algérie', dialCode: '213' },
  { code: 'AO', name: 'Angola', dialCode: '244' },
  { code: 'BJ', name: 'Bénin', dialCode: '229' },
  { code: 'BW', name: 'Botswana', dialCode: '267' },
  { code: 'BF', name: 'Burkina Faso', dialCode: '226' },
  { code: 'BI', name: 'Burundi', dialCode: '257' },
  { code: 'CM', name: 'Cameroun', dialCode: '237' },
  { code: 'CV', name: 'Cap-Vert', dialCode: '238' },
  { code: 'CF', name: 'République centrafricaine', dialCode: '236' },
  { code: 'KM', name: 'Comores', dialCode: '269' },
  { code: 'CG', name: 'Congo-Brazzaville', dialCode: '242' },
  { code: 'CD', name: 'Congo-Kinshasa (RDC)', dialCode: '243' },
  { code: 'CI', name: "Côte d'Ivoire", dialCode: '225' },
  { code: 'DJ', name: 'Djibouti', dialCode: '253' },
  { code: 'EG', name: 'Égypte', dialCode: '20' },
  { code: 'ER', name: 'Érythrée', dialCode: '291' },
  { code: 'SZ', name: 'Eswatini', dialCode: '268' },
  { code: 'ET', name: 'Éthiopie', dialCode: '251' },
  { code: 'GA', name: 'Gabon', dialCode: '241' },
  { code: 'GM', name: 'Gambie', dialCode: '220' },
  { code: 'GH', name: 'Ghana', dialCode: '233' },
  { code: 'GN', name: 'Guinée', dialCode: '224' },
  { code: 'GQ', name: 'Guinée équatoriale', dialCode: '240' },
  { code: 'GW', name: 'Guinée-Bissau', dialCode: '245' },
  { code: 'KE', name: 'Kenya', dialCode: '254' },
  { code: 'LS', name: 'Lesotho', dialCode: '266' },
  { code: 'LR', name: 'Liberia', dialCode: '231' },
  { code: 'LY', name: 'Libye', dialCode: '218' },
  { code: 'MG', name: 'Madagascar', dialCode: '261' },
  { code: 'MW', name: 'Malawi', dialCode: '265' },
  { code: 'ML', name: 'Mali', dialCode: '223' },
  { code: 'MA', name: 'Maroc', dialCode: '212' },
  { code: 'MR', name: 'Mauritanie', dialCode: '222' },
  { code: 'MU', name: 'Maurice', dialCode: '230' },
  { code: 'MZ', name: 'Mozambique', dialCode: '258' },
  { code: 'NA', name: 'Namibie', dialCode: '264' },
  { code: 'NE', name: 'Niger', dialCode: '227' },
  { code: 'NG', name: 'Nigeria', dialCode: '234' },
  { code: 'UG', name: 'Ouganda', dialCode: '256' },
  { code: 'RW', name: 'Rwanda', dialCode: '250' },
  { code: 'ST', name: 'Sao Tomé-et-Principe', dialCode: '239' },
  { code: 'SN', name: 'Sénégal', dialCode: '221' },
  { code: 'SC', name: 'Seychelles', dialCode: '248' },
  { code: 'SL', name: 'Sierra Leone', dialCode: '232' },
  { code: 'SO', name: 'Somalie', dialCode: '252' },
  { code: 'SD', name: 'Soudan', dialCode: '249' },
  { code: 'SS', name: 'Soudan du Sud', dialCode: '211' },
  { code: 'TZ', name: 'Tanzanie', dialCode: '255' },
  { code: 'TD', name: 'Tchad', dialCode: '235' },
  { code: 'TG', name: 'Togo', dialCode: '228' },
  { code: 'TN', name: 'Tunisie', dialCode: '216' },
  { code: 'ZM', name: 'Zambie', dialCode: '260' },
  { code: 'ZW', name: 'Zimbabwe', dialCode: '263' },
];

export function flagEmoji(iso2) {
  return iso2
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function findCountry(code) {
  return AFRICAN_COUNTRIES.find((c) => c.code === code) || AFRICAN_COUNTRIES.find((c) => c.code === 'BJ');
}
