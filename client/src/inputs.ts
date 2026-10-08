import { MULTI_TRIP_BRACKETS, type MultiTripBracket } from '@shop-in-sweden/shared';
import { defineInput } from './url-state';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toIsoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Today if it is a Saturday, otherwise the coming Saturday (local time). */
export function nextSaturday(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  return toIsoDate(d);
}

/** Trip Date: decides the ferry season and which Crossing Fees are valid. */
export const tripDate = defineInput<string>({
  name: 'dato',
  defaultValue: () => nextSaturday(),
  parse: (raw) => {
    const m = ISO_DATE.exec(raw);
    if (!m) return undefined;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(y, mo - 1, d);
    // Reject impossible dates such as 2026-02-30 (they would roll over).
    return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? raw : undefined;
  },
  serialise: (v) => v,
});

function yesNoInput(name: string) {
  return defineInput<boolean>({
    name,
    defaultValue: () => false,
    parse: (raw) => (raw === '1' ? true : raw === '0' ? false : undefined),
    serialise: (v) => (v ? '1' : '0'),
  });
}

/** Discount Agreement: ØresundGO (bridge). */
export const oresundGo = yesNoInput('oresundgo');

/** Discount Agreement: AutoBizz (ferry). */
export const autoBizz = yesNoInput('autobizz');

/** Discount Agreement: ferry multi-trip card bracket; `ingen` means no card. */
export const multiTripCard = defineInput<MultiTripBracket | null>({
  name: 'turkort',
  defaultValue: () => null,
  parse: (raw) =>
    raw === 'ingen' ? null : MULTI_TRIP_BRACKETS.find((b) => b === raw),
  serialise: (v) => v ?? 'ingen',
});

/** Registry of every shareable input. Later tickets add theirs here. */
export const inputs = { tripDate, oresundGo, autoBizz, multiTripCard };
