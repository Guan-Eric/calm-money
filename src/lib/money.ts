import * as Localization from 'expo-localization';

export function formatMoney(
  amountMinor: number,
  currency: string,
  locale?: string,
): string {
  const loc = locale ?? Localization.getLocales()[0]?.languageTag ?? 'en-US';
  const amount = amountMinor / 100;
  try {
    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function parseAmountToMinor(text: string): number | null {
  const cleaned = text.replace(/[^0-9.,]/g, '').replace(',', '.');
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function deviceCountryCode(): string {
  return Localization.getLocales()[0]?.regionCode ?? 'US';
}

export function deviceCurrencyCode(): string {
  const region = deviceCountryCode();
  const map: Record<string, string> = {
    US: 'USD',
    CA: 'CAD',
    GB: 'GBP',
    AU: 'AUD',
    NZ: 'NZD',
    EU: 'EUR',
    DE: 'EUR',
    FR: 'EUR',
    ES: 'EUR',
    IT: 'EUR',
    NL: 'EUR',
    IE: 'EUR',
    JP: 'JPY',
    MX: 'MXN',
  };
  return map[region] ?? 'USD';
}

export function deviceLocale(): string {
  return Localization.getLocales()[0]?.languageTag ?? 'en-US';
}
