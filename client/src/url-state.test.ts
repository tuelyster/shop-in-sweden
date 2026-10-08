import { describe, expect, it } from 'vitest';
import { inputs, nextSaturday } from './inputs';
import {
  defineInput,
  readValues,
  resolveInitialValues,
  saveStored,
  writeSearch,
  type StorageLike,
} from './url-state';

const litres = defineInput<number>({
  name: 'l',
  defaultValue: () => 40,
  parse: (raw) => {
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  },
  serialise: String,
});
const city = defineInput<string>({
  name: 'by',
  defaultValue: () => 'Malmö',
  parse: (raw) => raw || undefined,
  serialise: (v) => v,
});
const registry = { litres, city };

const memoryStorage = (): StorageLike => {
  const data: Record<string, string> = {};
  return {
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => void (data[k] = v),
  };
};
const throwingStorage = (): StorageLike => {
  throw new Error('SecurityError');
};

describe('url-state', () => {
  it('round-trips values through the query string', () => {
    const search = writeSearch(registry, { litres: 12.5, city: 'Åhus & co' });
    expect(readValues(registry, search)).toEqual({ litres: 12.5, city: 'Åhus & co' });
  });

  it('falls back to defaults for missing, invalid and unknown values', () => {
    expect(readValues(registry, '?l=abc&x=1')).toEqual({ litres: 40, city: 'Malmö' });
    expect(readValues(registry, '?l=-3')).toEqual({ litres: 40, city: 'Malmö' });
    expect(readValues(registry, '')).toEqual({ litres: 40, city: 'Malmö' });
  });

  it('treats a throwing parser as invalid', () => {
    const bad = defineInput<number>({
      ...litres,
      parse: () => {
        throw new Error('x');
      },
    });
    expect(readValues({ bad }, '?l=1')).toEqual({ bad: 40 });
  });

  it('prefers the URL over storage', () => {
    const storage = memoryStorage();
    saveStored(() => storage, '?l=10&by=Lund');
    expect(resolveInitialValues(registry, '?l=20', () => storage)).toEqual({ litres: 20, city: 'Malmö' });
  });

  it('restores from storage when the URL has no registered inputs', () => {
    const storage = memoryStorage();
    saveStored(() => storage, '?l=10&by=Lund');
    expect(resolveInitialValues(registry, '?utm=1', () => storage)).toEqual({ litres: 10, city: 'Lund' });
  });

  it('keeps working when storage throws', () => {
    expect(resolveInitialValues(registry, '', throwingStorage)).toEqual({ litres: 40, city: 'Malmö' });
    expect(() => saveStored(throwingStorage, '?l=1')).not.toThrow();
  });
});

describe('Trip Date input', () => {
  it('defaults to the coming Saturday, or today when it is Saturday', () => {
    expect(nextSaturday(new Date(2026, 9, 8))).toBe('2026-10-10'); // Thursday
    expect(nextSaturday(new Date(2026, 9, 10))).toBe('2026-10-10'); // Saturday
    expect(nextSaturday(new Date(2026, 9, 11))).toBe('2026-10-17'); // Sunday
  });

  it('rejects malformed and impossible dates', () => {
    expect(readValues(inputs, '?dato=2026-12-24').tripDate).toBe('2026-12-24');
    expect(readValues(inputs, '?dato=2026-02-30').tripDate).toBe(nextSaturday());
    expect(readValues(inputs, '?dato=i-morgen').tripDate).toBe(nextSaturday());
  });
});
