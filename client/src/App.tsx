import { useEffect, useMemo, useState } from 'react';
import {
  calculateTrips,
  type BasketItemGap,
  type BreakEvenSpend,
  type CategoryPriceGap,
  type PricePick,
  ENERGY_TYPES,
  type EnergyType,
  type CrossingId,
  MULTI_TRIP_BRACKETS,
  type MultiTripBracket,
  type ReferenceData,
} from '@shop-in-sweden/shared';

import { exchangeRateText, freshnessText, STALE_WARNING } from './freshness';
import { inputs } from './inputs';
import { useUrlInputs } from './useUrlInputs';

const dkk = new Intl.NumberFormat('da-DK', {
  style: 'currency',
  currency: 'DKK',
  maximumFractionDigits: 0,
});

const CATEGORY_LABELS: Record<string, string> = {
  groceries: 'Dagligvarer',
  'candy-snacks': 'Slik og snacks',
  'soft-drinks': 'Sodavand',
  'personal-care-household': 'Personlig pleje og husholdning',
};

const percent = new Intl.NumberFormat('da-DK', { style: 'percent', maximumFractionDigits: 0 });
const price = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "Du sparer 240 kr." or, when negative, "Du taber 240 kr." */
function savingText(amount: number): string {
  const rounded = Math.round(amount);
  if (rounded === 0) return 'Du går i nul';
  return `${rounded > 0 ? 'Du sparer' : 'Du taber'} ${dkk.format(Math.abs(rounded))}`;
}

function breakEvenText(spend: BreakEvenSpend): string {
  switch (spend.kind) {
    case 'amount':
      return dkk.format(Math.round(spend.dkk));
    case 'never':
      return 'Turen kan ikke betale sig med dette indkøb';
    case 'unknown':
      return 'Kan ikke beregnes endnu (mangler prisdata)';
  }
}

function pickText(pick: PricePick | null): string {
  if (!pick) return 'ingen pris';
  const own = `${price.format(pick.unitPrice)} ${pick.currency === 'SEK' ? 'SEK' : 'kr.'}/${pick.per}`;
  const converted = pick.currency === 'SEK' ? ` = ${price.format(pick.unitPriceDkk)} kr./${pick.per}` : '';
  const offer = pick.kind === 'offer' ? ` (tilbud${pick.validTo ? ` til ${pick.validTo}` : ''})` : ' (normalpris)';
  const deposit = pick.lostDeposit > 0 ? `, inkl. ${price.format(pick.lostDeposit)} SEK pant` : '';
  return `${pick.productName}, ${pick.seller}: ${own}${converted}${offer}${deposit}`;
}

function ItemRow({ item }: { item: BasketItemGap }) {
  return (
    <li data-testid="basket-item">
      <strong>{item.name}</strong> {item.gap !== null ? <span>{percent.format(item.gap)}</span> : <span>(udeladt)</span>}
      <br />
      <span className="hint">Danmark: {pickText(item.denmark)}</span>
      <br />
      <span className="hint">Sverige: {pickText(item.sweden)}</span>
    </li>
  );
}

function CategoryGap({ gap }: { gap: CategoryPriceGap }) {
  return (
    <details className="gap" data-testid="price-gap">
      <summary>
        {CATEGORY_LABELS[gap.categoryId] ?? gap.categoryId}:{' '}
        <strong data-testid="price-gap-value">
          {gap.priceGap === null ? 'ingen prisdata endnu' : percent.format(gap.priceGap)}
        </strong>
      </summary>
      <ul className="items">
        {gap.items.map((item) => (
          <ItemRow key={item.basketItemId} item={item} />
        ))}
      </ul>
      {gap.missingItems.length > 0 && gap.priceGap !== null && (
        <p className="hint">Ikke med i gennemsnittet (mangler pris i det ene land): {gap.missingItems.join(', ')}</p>
      )}
    </details>
  );
}

type PostcodeLookup =
  | { postcode: string; status: 'idle' | 'unknown' | 'error' }
  | { postcode: string; status: 'ok'; name: string; distanceKm: Record<CrossingId, number> };

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
    postcode,
    distanceBridge,
    distanceFerry,
    spendGroceries,
    spendCandySnacks,
    spendSoftDrinks,
    spendPersonalCare,
    fillUpLitres,
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

  // Postcode lookup: fills a distance only where no manual value is entered.
  const [lookup, setLookup] = useState<PostcodeLookup>({ postcode: '', status: 'idle' });
  useEffect(() => {
    if (!/^\d{4}$/.test(postcode)) return;
    let current = true;
    fetch(`/api/postcodes/${postcode}/distances`)
      .then(async (res) => {
        if (res.ok) {
          const body = (await res.json()) as { name: string; distanceKm: Record<CrossingId, number> };
          return { postcode, status: 'ok', name: body.name, distanceKm: body.distanceKm } as const;
        }
        return { postcode, status: res.status === 404 ? 'unknown' : 'error' } as const;
      })
      .catch(() => ({ postcode, status: 'error' }) as const)
      .then((result) => current && setLookup(result));
    return () => {
      current = false;
    };
  }, [postcode]);
  // Only trust a lookup that belongs to the postcode currently typed.
  const found = lookup.postcode === postcode ? lookup : null;
  const looked = found?.status === 'ok' ? found.distanceKm : null;
  const bridgeKm = distanceBridge ?? looked?.bridge ?? null;
  const ferryKm = distanceFerry ?? looked?.ferry ?? null;
  const postcodeProblem = found?.status === 'unknown' || found?.status === 'error' ? found.status : null;

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
          distanceKm: { bridge: bridgeKm, ferry: ferryKm },
          plannedSpend: {
            groceries: spendGroceries,
            'candy-snacks': spendCandySnacks,
            'soft-drinks': spendSoftDrinks,
            'personal-care-household': spendPersonalCare,
          },
          fillUpLitres,
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
    bridgeKm,
    ferryKm,
    spendGroceries,
    spendCandySnacks,
    spendSoftDrinks,
    spendPersonalCare,
    fillUpLitres,
  ]);

  const vehicleDefault = reference?.vehicleDefaults.find((v) => v.energyType === energyType);
  const petrol = energyType === 'petrol';
  const consumptionUnit = petrol ? 'L/100 km' : 'kWh/100 km';
  const priceUnit = petrol ? 'kr. pr. liter' : 'kr. pr. kWh';
  const distanceMissing = bridgeKm === null || ferryKm === null;

  const numberChange = (key: 'consumption' | 'energyPrice' | 'distanceBridge' | 'distanceFerry') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = e.target.value === '' ? null : Number(e.target.value);
      setInput(key, n !== null && Number.isFinite(n) && n >= 0 ? n : null);
    };

  const spendFields = [
    { key: 'spendGroceries', category: 'groceries', value: spendGroceries },
    { key: 'spendCandySnacks', category: 'candy-snacks', value: spendCandySnacks },
    { key: 'spendSoftDrinks', category: 'soft-drinks', value: spendSoftDrinks },
    { key: 'spendPersonalCare', category: 'personal-care-household', value: spendPersonalCare },
  ] as const;

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
          <span>Postnummer (hvor du kører fra)</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={4}
            value={postcode}
            aria-invalid={postcodeProblem !== null}
            onChange={(e) => setInput('postcode', e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </label>
        {found?.status === 'ok' && (
          <p className="hint" data-testid="postcode-found">
            {postcode} {found.name}: kørselsafstanden er udfyldt, men du kan rette den.
          </p>
        )}
        {postcodeProblem === 'unknown' && (
          <p role="alert" data-testid="postcode-error">
            Vi kender ikke postnummeret {postcode}. Tjek det, eller indtast kørselsafstanden selv. Øer uden
            vejforbindelse til Sverige, fx Bornholm, er ikke med.
          </p>
        )}
        {postcodeProblem === 'error' && (
          <p role="alert" data-testid="postcode-error">
            Kunne ikke slå postnummeret op. Prøv igen senere, eller indtast kørselsafstanden selv.
          </p>
        )}
        <label className="field">
          <span>Kørsel til Hyllie/Emporia (km, én vej)</span>
          <input type="number" min="0" step="any" inputMode="decimal" value={bridgeKm ?? ''} onChange={numberChange('distanceBridge')} />
        </label>
        <label className="field">
          <span>Kørsel til Väla Centrum (km, én vej)</span>
          <input type="number" min="0" step="any" inputMode="decimal" value={ferryKm ?? ''} onChange={numberChange('distanceFerry')} />
        </label>
        {petrol && (
          <label className="field">
            <span>Liter benzin du tanker i Sverige</span>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              data-testid="fill-up-litres"
              value={fillUpLitres === 0 ? '' : fillUpLitres}
              placeholder="0"
              onChange={(e) => {
                const n = e.target.value === '' ? 0 : Number(e.target.value);
                setInput('fillUpLitres', Number.isFinite(n) && n >= 0 ? n : 0);
              }}
            />
          </label>
        )}
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
      <fieldset className="field agreements">
        <legend>Det vil du købe (kr. til danske priser)</legend>
        {spendFields.map((f) => (
          <label className="field" key={f.key}>
            <span>{CATEGORY_LABELS[f.category]}</span>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={f.value === 0 ? '' : f.value}
              placeholder="0"
              onChange={(e) => {
                const n = e.target.value === '' ? 0 : Number(e.target.value);
                setInput(f.key, Number.isFinite(n) && n >= 0 ? n : 0);
              }}
            />
          </label>
        ))}
      </fieldset>
      {distanceMissing && !postcodeProblem && comparison && comparison !== 'no-prices' && (
        <p className="hint" data-testid="distance-prompt">
          Indtast kørselsafstanden til begge destinationer for at se, hvad turen koster i brændstof eller strøm.
        </p>
      )}
      {error && <p role="alert">Kunne ikke hente priserne. Prøv igen senere.</p>}
      {reference && (
        <div data-testid="data-freshness">
          <p className="hint" data-testid="freshness-line">
            {freshnessText(reference.freshness)}
            {reference.exchangeRate && <> · <span data-testid="exchange-rate">{exchangeRateText(reference.exchangeRate)}</span></>}
          </p>
          {reference.freshness.stale && (
            <p role="alert" data-testid="stale-warning" className="stale-warning">
              {STALE_WARNING}
            </p>
          )}
        </div>
      )}
      {!comparison && !error && <p>Henter priser …</p>}
      {comparison === 'no-prices' && <p role="alert">Vi har ingen priser for den valgte dato.</p>}
      {comparison && comparison !== 'no-prices' && !(postcodeProblem && distanceMissing) && (
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
              <dl className="breakdown">
                <dt>Besparelse (brutto)</dt>
                <dd data-testid="gross-saving">{dkk.format(trip.grossSavingDkk)}</dd>
                {petrol && fillUpLitres > 0 && (
                  <>
                    <dt>heraf billigere benzin</dt>
                    <dd data-testid="fill-up-saving">{savingText(trip.fillUpSavingDkk)}</dd>
                  </>
                )}
              </dl>
              <p className="fee-label">Nettobesparelse</p>
              <p className={trip.netSavingDkk < 0 ? 'fee loss' : 'fee'} data-testid="net-saving">
                {savingText(trip.netSavingDkk)}
              </p>
              <dl className="breakdown">
                <dt>Break-even indkøb</dt>
                <dd data-testid="break-even">{breakEvenText(trip.breakEvenSpend)}</dd>
              </dl>
              {trip.breakEvenExcludedCategoryIds.length > 0 && (
                <p className="hint" data-testid="break-even-excluded">
                  Break-even er beregnet uden: {trip.breakEvenExcludedCategoryIds.map((id) => CATEGORY_LABELS[id] ?? id).join(', ')} (ingen prisdata).
                </p>
              )}
              {trip.unknownGapCategoryIds.length > 0 && (
                <p className="hint" data-testid="unknown-gaps">
                  Ingen prisdata endnu for: {trip.unknownGapCategoryIds.map((id) => CATEGORY_LABELS[id] ?? id).join(', ')}.
                </p>
              )}
              <h3>Prisforskel i Sverige</h3>
              {reference?.priceGaps
                .find((g) => g.destinationId === trip.destination.id)
                ?.categories.map((c) => <CategoryGap key={c.categoryId} gap={c} />)}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
