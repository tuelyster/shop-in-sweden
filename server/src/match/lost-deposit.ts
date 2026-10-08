import { totalContent, type Quantity } from '@shop-in-sweden/shared';
import type { Db } from '../db/connection';
import { lostDeposits } from '../db/schema';

/** The only Category whose Swedish prices carry Lost Deposit. */
export const LOST_DEPOSIT_CATEGORY_ID = 'soft-drinks';

/** Lost Deposit per container, SEK, for containers up to `maxLitres` (null: no upper limit). */
export interface LostDepositRate {
  id: string;
  maxLitres: number | null;
  amountSek: number;
}

/** The seeded rates, smallest container first. */
export function readLostDepositRates(db: Db): LostDepositRate[] {
  return db
    .select()
    .from(lostDeposits)
    .all()
    .map((r) => ({ id: r.id, maxLitres: r.maxLitres, amountSek: r.amountSek }))
    .sort((a, b) => (a.maxLitres ?? Infinity) - (b.maxLitres ?? Infinity));
}

/**
 * The Lost Deposit in SEK inside a Swedish soft-drink price, for the whole pack. The deposit the source
 * reports (Willys) wins; otherwise it is derived from the container count (`pieces`) and the size of
 * one container, unless `derive` is false (e.g. juice in cartons, which carry no deposit).
 */
export function lostDepositFor(
  product: { quantity: Quantity | null; deposit?: number | null },
  rates: LostDepositRate[],
  derive = true,
): number {
  if (typeof product.deposit === 'number' && product.deposit > 0) return product.deposit;
  const q = product.quantity;
  if (!derive || !q) return 0;
  const one = totalContent({ pieces: 1, size: q.size, unit: q.unit });
  if (one.per !== 'l') return 0;
  const rate = rates.find((r) => r.maxLitres === null || one.amount <= r.maxLitres + 1e-9);
  return rate ? rate.amountSek * q.pieces : 0;
}
