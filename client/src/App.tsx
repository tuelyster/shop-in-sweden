import { useEffect, useMemo, useState } from 'react';
import {
  calculateTrips,
  ENERGY_TYPES,
  type EnergyType,
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
  const {
    tripDate,
    oresundGo,
    autoBizz,
    multiTripCard,
    energyType,
    consumption,
    energyPrice,
    distanceBridge,
    distanceFerry,
  } = values;

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
      return calculateTrips(
        {
          tripDate,
          oresundGo,
          autoBizz,
          multiTripCard,
          energyType,
          consumptionPer100Km: consumption,
          energyPriceDkk: energyPrice,
          distanceKm: { bridge: distanceBridge, ferry: distanceFerry },
        },
        reference,
      );
    } catch {
      return 'no-prices' as const;
    }
  }, [
    reference,
    tripDate,
    oresundGo,
    autoBizz,
    multiTripCard,
    energyType,
    consumption,
    energyPrice,
    distanceBridge,
    distanceFerry,
  ]);

  const vehicleDefault = reference?.vehicleDefaults.find((v) => v.energyType === energyType);
  const petrol = energyType === 'petrol';
  const consumptionUnit = petrol ? 'L/100 km' : 'kWh/100 km';
  const priceUnit = petrol ? 'kr. pr. liter' : 'kr. pr. kWh';
  const distanceMissing = distanceBridge === null || distanceFerry === null;

  const numberChange = (key: 'consumption' | 'energyPrice' | 'distanceBridge' | 'distanceFerry') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = e.target.value === '' ? null : Number(e.target.value);
      setInput(key, n !== null && Number.isFinite(n) && n >= 0 ? n : null);
    };

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
      <fieldset className="field agreements">
        <legend>Bil</legend>
        <label className="field">
          <span>Bilen kører på</span>
          <select value={energyType} onChange={(e) => setInput('energyType', e.target.value as EnergyType)}>
            {ENERGY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === 'petrol' ? 'Benzin' : 'El'}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Kørsel til Hyllie/Emporia (km, én vej)</span>
          <input type="number" min="0" step="any" inputMode="decimal" value={distanceBridge ?? ''} onChange={numberChange('distanceBridge')} />
        </label>
        <label className="field">
          <span>Kørsel til Väla Centrum (km, én vej)</span>
          <input type="number" min="0" step="any" inputMode="decimal" value={distanceFerry ?? ''} onChange={numberChange('distanceFerry')} />
        </label>
        <details className="advanced">
          <summary>Avanceret</summary>
          <label className="field">
            <span>Forbrug ({consumptionUnit})</span>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={consumption ?? ''}
              placeholder={vehicleDefault ? String(vehicleDefault.consumptionPer100Km) : ''}
              onChange={numberChange('consumption')}
            />
          </label>
          <label className="field">
            <span>Energipris ({priceUnit})</span>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={energyPrice ?? ''}
              placeholder={vehicleDefault ? String(vehicleDefault.energyPriceDkk) : ''}
              onChange={numberChange('energyPrice')}
            />
          </label>
          {vehicleDefault && (
            <p className="hint">
              Standardpris pr. {vehicleDefault.priceDate}: {vehicleDefault.energyPriceDkk} {priceUnit}. Kilde:{' '}
              {vehicleDefault.priceSource}
            </p>
          )}
        </details>
      </fieldset>
      {distanceMissing && comparison && comparison !== 'no-prices' && (
        <p className="hint" data-testid="distance-prompt">
          Indtast kørselsafstanden til begge destinationer for at se, hvad turen koster i brændstof eller strøm.
        </p>
      )}
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
              <dl className="breakdown">
                <dt>Overfart tur/retur</dt>
                <dd data-testid="crossing-fee">{dkk.format(trip.crossingFeeDkk)}</dd>
                <dt>Kørsel tur/retur</dt>
                <dd data-testid="driving-cost">{dkk.format(trip.drivingCostDkk)}</dd>
              </dl>
              <p className="fee-label">Turens pris</p>
              <p className="fee" data-testid="trip-cost">{dkk.format(trip.tripCostDkk)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
