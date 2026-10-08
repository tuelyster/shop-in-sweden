import { describe, expect, it } from 'vitest';
import { unitPrice } from './index';

describe('unitPrice', () => {
  it('normalises a weight in grams to a price per kg', () => {
    expect(unitPrice(59.5, { pieces: 1, size: 500, unit: 'g' })).toEqual({ value: 119, per: 'kg' });
  });

  it('normalises a volume in cl to a price per litre', () => {
    const { value, per } = unitPrice(9.5, { pieces: 1, size: 33, unit: 'cl' });
    expect(per).toBe('l');
    expect(value).toBeCloseTo(28.79, 2);
  });

  it('multiplies pieces into the content for multipacks', () => {
    const { value, per } = unitPrice(99.9, { pieces: 15, size: 33, unit: 'cl' });
    expect(per).toBe('l');
    expect(value).toBeCloseTo(20.18, 2);
  });

  it('gives a price per piece for counted goods', () => {
    expect(unitPrice(59.9, { pieces: 24, size: 1, unit: 'pcs' })).toEqual({ value: 59.9 / 24, per: 'pcs' });
  });

  it('treats a multi-buy quantity as pieces', () => {
    // "2 for 40 kr" on 1 kg packs: 40 kr buys 2 kg
    expect(unitPrice(40, { pieces: 2, size: 1, unit: 'kg' })).toEqual({ value: 20, per: 'kg' });
  });
});
