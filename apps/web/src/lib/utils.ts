
const localeCurrencyMap: Record<string, string> = {
  en: "USD",
  "pt-BR": "BRL",
};

export type CurrencyCode = "USD" | "BRL" | "LBP";

function resolveLocale(locale?: string) {
  return locale ?? "en";
}

function resolveCurrency(locale: string, overrideCurrency?: CurrencyCode) {
  if (overrideCurrency) return overrideCurrency;
  return localeCurrencyMap[locale] ?? "USD";
}

export function formatDate(date: Date | string, locale?: string) {
  if (typeof date === 'string') {
    date = new Date(date)
  }
  return new Intl.DateTimeFormat(resolveLocale(locale)).format(date)
}

/** Format an integer amount in cents as a currency string. Converts to target currency if a rate is provided. */
export function formatCurrency(
  cents: number,
  locale?: string,
  currency?: CurrencyCode,
  rate?: number
) {
  const loc = resolveLocale(locale);
  const targetCurrency = resolveCurrency(loc, currency);
  
  let amount = cents / 100;
  
  // If target currency is LBP and a rate is provided, convert from base (USD) to LBP
  // FinOpenPOS assumes base currency is USD/BRL 1:1 for generic storage. 
  // If displaying LBP, we multiply base amount by LBP exchange rate.
  if (targetCurrency === "LBP" && rate && rate > 0) {
    amount = amount * rate;
  }

  // LBP doesn't use decimal fractions due to inflation
  const fractionDigits = targetCurrency === "LBP" ? 0 : 2;

  return new Intl.NumberFormat(loc, {
    style: "currency",
    currency: targetCurrency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}

/** Format an ISO date string to a short label like "Jan 5". */
export function formatShortDate(dateStr: string, locale?: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(resolveLocale(locale), { month: "short", day: "numeric" });
}
