const dateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Copenhagen',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * The calendar date (YYYY-MM-DD) of a moment in Danish and Swedish local time. Leaflets run in local
 * time but Tjek reports UTC, e.g. 2026-10-04T22:00Z is 5 October.
 */
export function localDate(moment: Date): string {
  return dateFormat.format(moment);
}

/** Today if it is a Saturday, otherwise the coming Saturday; the Trip Date a command-line run assumes. */
export function nextSaturday(now: Date): string {
  const [y, m, d] = localDate(now).split('-').map(Number) as [number, number, number];
  const day = new Date(Date.UTC(y, m - 1, d));
  day.setUTCDate(day.getUTCDate() + ((6 - day.getUTCDay() + 7) % 7));
  return day.toISOString().slice(0, 10);
}
