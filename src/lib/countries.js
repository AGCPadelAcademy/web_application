/** ISO 3166-1 alpha-2 codes used in the billing-address country picker. */
export const COUNTRY_CODES = [
  'AD', 'AE', 'AL', 'AM', 'AR', 'AT', 'AU', 'AZ', 'BA', 'BE', 'BG', 'BR', 'BY',
  'CA', 'CH', 'CL', 'CN', 'CO', 'CY', 'CZ', 'DE', 'DK', 'DZ', 'EE', 'EG', 'ES',
  'FI', 'FR', 'GB', 'GE', 'GR', 'HK', 'HR', 'HU', 'ID', 'IE', 'IL', 'IN', 'IS',
  'IT', 'JP', 'KR', 'LI', 'LT', 'LU', 'LV', 'MA', 'MC', 'MD', 'ME', 'MK', 'MT',
  'MX', 'MY', 'NL', 'NO', 'NZ', 'PE', 'PH', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE',
  'SG', 'SI', 'SK', 'TH', 'TN', 'TR', 'UA', 'US', 'VN', 'ZA',
];

const NAME_TO_CODE = {
  switzerland: 'CH', schweiz: 'CH', suisse: 'CH', svizzera: 'CH', swiss: 'CH',
  spain: 'ES', espanya: 'ES', 'españa': 'ES', espanol: 'ES',
  france: 'FR', francia: 'FR',
  germany: 'DE', deutschland: 'DE', allemagne: 'DE',
  italy: 'IT', italia: 'IT',
  austria: 'AT', österreich: 'AT', osterreich: 'AT',
  portugal: 'PT',
  'united kingdom': 'GB', uk: 'GB', 'great britain': 'GB', england: 'GB',
  'united states': 'US', usa: 'US',
};

export function countryLabel(code, locale = 'en') {
  if (!code) return '';
  try {
    return new Intl.DisplayNames([locale, 'en'], { type: 'region' }).of(code) || code;
  } catch {
    return code;
  }
}

export function guessCountryCode(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  return NAME_TO_CODE[trimmed.toLowerCase()] || '';
}

export function countriesForSelect(locale = 'en') {
  return COUNTRY_CODES
    .map((code) => ({ code, name: countryLabel(code, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
}
