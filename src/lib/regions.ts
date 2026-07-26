/** Countries Tally / Plaid commonly support for bank link + formatting. */
export type RegionOption = {
  code: string;
  name: string;
  currency: string;
};

export const REGION_OPTIONS: RegionOption[] = [
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'CA', name: 'Canada', currency: 'CAD' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'AU', name: 'Australia', currency: 'AUD' },
  { code: 'NZ', name: 'New Zealand', currency: 'NZD' },
  { code: 'IE', name: 'Ireland', currency: 'EUR' },
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'FR', name: 'France', currency: 'EUR' },
  { code: 'ES', name: 'Spain', currency: 'EUR' },
  { code: 'IT', name: 'Italy', currency: 'EUR' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR' },
  { code: 'BE', name: 'Belgium', currency: 'EUR' },
  { code: 'AT', name: 'Austria', currency: 'EUR' },
  { code: 'PT', name: 'Portugal', currency: 'EUR' },
  { code: 'PL', name: 'Poland', currency: 'PLN' },
  { code: 'SE', name: 'Sweden', currency: 'SEK' },
  { code: 'NO', name: 'Norway', currency: 'NOK' },
  { code: 'DK', name: 'Denmark', currency: 'DKK' },
  { code: 'FI', name: 'Finland', currency: 'EUR' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF' },
  { code: 'MX', name: 'Mexico', currency: 'MXN' },
  { code: 'JP', name: 'Japan', currency: 'JPY' },
];

export const CURRENCY_OPTIONS: { code: string; name: string }[] = [
  { code: 'USD', name: 'US Dollar' },
  { code: 'CAD', name: 'Canadian Dollar' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'EUR', name: 'Euro' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'NZD', name: 'New Zealand Dollar' },
  { code: 'CHF', name: 'Swiss Franc' },
  { code: 'SEK', name: 'Swedish Krona' },
  { code: 'NOK', name: 'Norwegian Krone' },
  { code: 'DKK', name: 'Danish Krone' },
  { code: 'PLN', name: 'Polish Złoty' },
  { code: 'MXN', name: 'Mexican Peso' },
  { code: 'JPY', name: 'Japanese Yen' },
];

export function regionLabel(code: string): string {
  const hit = REGION_OPTIONS.find((r) => r.code === code);
  return hit ? `${hit.name} (${hit.code})` : code;
}

export function currencyLabel(code: string): string {
  const hit = CURRENCY_OPTIONS.find((c) => c.code === code);
  return hit ? `${hit.name} (${hit.code})` : code;
}

export function defaultCurrencyForCountry(countryCode: string): string {
  return REGION_OPTIONS.find((r) => r.code === countryCode)?.currency ?? 'USD';
}
