import type { DataFreshness, ExchangeRateInfo } from '@shop-in-sweden/shared';

const longDate = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const rate = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

export function formatDate(iso: string): string {
  return longDate.format(new Date(`${iso}T00:00:00Z`));
}

/** "Priser opdateret i dag / i går / for X dage siden", or a note that nothing is imported yet. */
export function freshnessText(f: DataFreshness): string {
  if (f.daysOld === null) return 'Priserne er ikke hentet endnu.';
  if (f.daysOld === 0) return 'Priser opdateret i dag';
  if (f.daysOld === 1) return 'Priser opdateret i går';
  return `Priser opdateret for ${f.daysOld} dage siden`;
}

export const STALE_WARNING = 'Priserne er mere end 14 dage gamle – resultatet kan være upræcist.';

/** "Kurs: 1 SEK = 0,6660 DKK (ECB, 7. okt. 2026)". */
export function exchangeRateText(r: ExchangeRateInfo): string {
  const source = r.source.toLowerCase().startsWith('ecb') ? 'ECB' : r.source;
  return `Kurs: 1 SEK = ${rate.format(r.sekToDkk)} DKK (${source}, ${formatDate(r.date)})`;
}
