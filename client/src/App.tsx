import { useEffect, useState } from 'react';
import { calculateTrips, type ReferenceData } from '@shop-in-sweden/shared';

const dkk = new Intl.NumberFormat('da-DK', {
  style: 'currency',
  currency: 'DKK',
  maximumFractionDigits: 0,
});

export function App() {
  const [reference, setReference] = useState<ReferenceData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/reference-data')
      .then((res) => (res.ok ? (res.json() as Promise<ReferenceData>) : Promise.reject(res.status)))
      .then(setReference)
      .catch(() => setError(true));
  }, []);

  const comparison = reference ? calculateTrips({}, reference) : null;

  return (
    <main>
      <h1>Kan det betale sig at handle i Sverige?</h1>
      <p className="intro">Sammenlign overfarten til Sverige: Øresundsbroen eller færgen.</p>
      {error && <p role="alert">Kunne ikke hente priserne. Prøv igen senere.</p>}
      {!comparison && !error && <p>Henter priser …</p>}
      {comparison && (
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
