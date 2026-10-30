/**
 * EU country currency data.
 * Non-eurozone countries have their own currency with approximate EUR exchange rate.
 * Rates are approximate (ECB reference rates, early 2026).
 */

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  /** How many units of this currency = 1 EUR */
  rateToEur: number;
}

const EUR: CurrencyInfo = { code: 'EUR', symbol: '\u20ac', name: 'Euro', rateToEur: 1 };

/** Non-eurozone EU country currencies (approximate ECB rates) */
const NON_EURO_CURRENCIES: Record<string, CurrencyInfo> = {
  PL: { code: 'PLN', symbol: 'z\u0142', name: 'Polish zloty', rateToEur: 4.26 },
  CZ: { code: 'CZK', symbol: 'K\u010d', name: 'Czech koruna', rateToEur: 25.1 },
  HU: { code: 'HUF', symbol: 'Ft', name: 'Hungarian forint', rateToEur: 408 },
  SE: { code: 'SEK', symbol: 'kr', name: 'Swedish krona', rateToEur: 11.2 },
  DK: { code: 'DKK', symbol: 'kr', name: 'Danish krone', rateToEur: 7.46 },
  RO: { code: 'RON', symbol: 'lei', name: 'Romanian leu', rateToEur: 4.97 },
  BG: { code: 'BGN', symbol: '\u043b\u0432', name: 'Bulgarian lev', rateToEur: 1.96 },
};

export function getCurrency(countryCode: string): CurrencyInfo {
  return NON_EURO_CURRENCIES[countryCode] || EUR;
}

export function isEurozone(countryCode: string): boolean {
  return !NON_EURO_CURRENCIES[countryCode];
}

/** Convert EUR amount to local currency */
export function eurToLocal(eurAmount: number, countryCode: string): number {
  const currency = getCurrency(countryCode);
  return Math.round(eurAmount * currency.rateToEur);
}

/** Format a value in local currency with EUR secondary */
export function formatLocalCurrency(
  eurValue: number,
  countryCode: string,
  period?: 'month' | 'year',
): { primary: string; secondary: string | null } {
  const currency = getCurrency(countryCode);
  const periodSuffix = period === 'month' ? '/mo' : period === 'year' ? '/yr' : '';

  if (isEurozone(countryCode)) {
    return {
      primary: `\u20ac${Math.round(eurValue).toLocaleString()}${periodSuffix}`,
      secondary: null,
    };
  }

  const localValue = eurToLocal(eurValue, countryCode);
  return {
    primary: `${localValue.toLocaleString()} ${currency.code}${periodSuffix}`,
    secondary: `\u20ac${Math.round(eurValue).toLocaleString()}${periodSuffix}`,
  };
}
