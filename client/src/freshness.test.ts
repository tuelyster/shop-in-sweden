import { describe, expect, it } from 'vitest';
import { exchangeRateText, freshnessText } from './freshness';

const f = (daysOld: number | null) => ({ newestObservationDate: null, daysOld, stale: false });

describe('freshnessText', () => {
  it('words 0, 1 and many days', () => {
    expect(freshnessText(f(0))).toBe('Priser opdateret i dag');
    expect(freshnessText(f(1))).toBe('Priser opdateret i går');
    expect(freshnessText(f(5))).toBe('Priser opdateret for 5 dage siden');
  });
  it('says prices are not imported yet instead of a number of days', () => {
    expect(freshnessText(f(null))).toBe('Priserne er ikke hentet endnu.');
  });
});

describe('exchangeRateText', () => {
  it('shows rate, source and date', () => {
    expect(exchangeRateText({ sekToDkk: 0.6659, date: '2026-10-07', source: 'ECB' })).toMatch(
      /^Kurs: 1 SEK = 0,6659 DKK \(ECB, 7\. okt\.? 2026\)$/,
    );
  });
});
