import { describe, expect, it } from 'vitest';
import { calculateTrips, type ReferenceData } from './index';

function reference(bridgeSingle: number, ferryRoundTrip: number): ReferenceData {
  return {
    crossings: [
      {
        id: 'bridge',
        name: 'Øresundsbron',
        destination: { id: 'hyllie', name: 'Hyllie/Emporia' },
        fees: [{ kind: 'single', priceDkk: bridgeSingle, validFrom: '2026-09-14', source: 'test' }],
      },
      {
        id: 'ferry',
        name: 'Helsingør–Helsingborg',
        destination: { id: 'vala', name: 'Väla Centrum' },
        fees: [{ kind: 'round-trip', priceDkk: ferryRoundTrip, validFrom: '2026-01-01', source: 'test' }],
      },
    ],
  };
}

describe('calculateTrips', () => {
  it('prices the bridge as 2 x the single ticket and the ferry as the round-trip ticket', () => {
    const { trips } = calculateTrips({}, reference(420, 595));
    expect(trips.find((t) => t.crossingId === 'bridge')?.crossingFeeDkk).toBe(840);
    expect(trips.find((t) => t.crossingId === 'ferry')?.crossingFeeDkk).toBe(595);
  });

  it('marks the ferry cheaper when it has the lower Crossing Fee', () => {
    const result = calculateTrips({}, reference(420, 595));
    expect(result.cheaperCrossingId).toBe('ferry');
    expect(result.trips.filter((t) => t.isCheaper).map((t) => t.crossingId)).toEqual(['ferry']);
  });

  it('marks the bridge cheaper when it has the lower Crossing Fee', () => {
    const result = calculateTrips({}, reference(250, 595));
    expect(result.cheaperCrossingId).toBe('bridge');
    expect(result.trips.filter((t) => t.isCheaper)).toHaveLength(1);
  });

  it('marks exactly one trip cheaper on a tie', () => {
    const result = calculateTrips({}, reference(300, 600));
    expect(result.trips.filter((t) => t.isCheaper)).toHaveLength(1);
  });

  it('keeps decimals unrounded', () => {
    const { trips } = calculateTrips({}, reference(100.255, 595));
    expect(trips[0]?.crossingFeeDkk).toBeCloseTo(200.51, 10);
  });
});
