import { useEffect, useMemo, useState } from 'react';
import {
  calculateTrips,
  MULTI_TRIP_BRACKETS,
  type MultiTripBracket,
  type ReferenceData,
} from '@shop-in-sweden/shared';

import { inputs } from './inputs';
import { useUrlInputs } from './useUrlInputs';

const dkk = new Intl.NumberFormat('da-DK', {
  style: 'currency',
  currency: 'DKK',
  maximumFractionDigits: 0,
});

export function App() {
  const { values, setInput } = useUrlInputs(inputs);
  const { tripDate, oresundGo, autoBizz, multiTripCard } = values;

  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [error, setError] = useState(false);

  // The Crossing Fees that apply depend on the Trip Date, so refetch when it changes.
  useEffect(() => {
    let current = true;
    setError(false);
    fetch(`/api/reference-data?dato=${encodeURIComponent(tripDate)}`)
      .then((res) => (res.ok ? (res.json() as Promise<ReferenceData>) : Promise.reject(res.status)))
      .then((data) => current && setReference(data))
      .catch(() => current && setError(true));
    return () => {
      current = false;
    };
  }, [tripDate]);

  const comparison = useMemo(() => {
    if (!reference) return null;
    try {
      return calculateTrips({ tripDate, oresundGo, autoBizz, multiTripCard }, reference);
    } catch {
      return 'no-prices' as const;
    }
  }, [reference, tripDate, oresundGo, autoBizz, multiTripCard]);

  return (
    <main>
      <h1>Kan det betale sig at handle i Sverige?</h1>
      <p className="intro">Sammenlign overfarten til Sverige: Øresundsbroen eller færgen.</p>
      <label className="field">
        <span>Dato for turen</span>
        <input
          type="date"
          value={tripDate}
          onChange={(e) => {
            if (e.target.value) setInput('tripDate', e.target.value);
          }}
        />
      </label>
      <fieldset className="field agreements">
        <legend>Rabataftaler</legend>
        <label className="check">
          <input
            type="checkbox"
            checked={oresundGo}
            onChange={(e) => setInput('oresundGo', e.target.checked)}
          />
          <span>ØresundGO (Øresundsbroen)</span>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={autoBizz}
            onChange={(e) => setInput('autoBizz', e.target.checked)}
          />
          <span>AutoBizz (færgen)</span>
        </label>
        <label className="field">
          <span>Turkort til færgen</span>
          <select
            value={multiTripCard ?? 'ingen'}
            onChange={(e) =>
              setInput('multiTripCard', e.target.value === 'ingen' ? null : (e.target.value as MultiTripBracket))
            }
          >
            <option value="ingen">Intet turkort</option>
            {MULTI_TRIP_BRACKETS.map((b) => (
              <option key={b} value={b}>
                {b} ture
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      {error && <p role="alert">Kunne ikke hente priserne. Prøv igen senere.</p>}
      {!comparison && !error && <p>Henter priser …</p>}
      {comparison === 'no-prices' && <p role="alert">Vi har ingen priser for den valgte dato.</p>}
      {comparison && comparison !== 'no-prices' && (
        <ul className="trips">
          {comparison.trips.map((trip) => (
            <li
              key={trip.crossingId}
              className={trip.isCheaper ? 'trip cheaper' : 'trip'}
              data-testid="shopping-trip"
              data-cheaper={trip.isCheaper}
            >
              {trip.isCheaper && <span className="badge">Billigste tur</span>}
              <h2>{trip.crossingName}</h2>
              <p className="destination">til {trip.destination.name}</p>
              <p className="fee-label">Overfart tur/retur</p>
              <p className="fee">{dkk.format(trip.crossingFeeDkk)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
