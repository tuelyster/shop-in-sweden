import type { ReferenceData } from '@shop-in-sweden/shared';

/** The hash that shows this page; the calculator is the page with no hash. */
export const HOW_WE_CALCULATE_HASH = '#/saadan-regner-vi';

/** Source strings as the reference-data API reports them, without duplicates. */
function reportedSources(reference: ReferenceData | null): string[] {
  if (!reference) return [];
  const all = [
    ...reference.crossings.flatMap((c) => c.fees.map((f) => f.source)),
    ...reference.seasons.map((s) => s.source),
    ...reference.vehicleDefaults.flatMap((v) => [v.consumptionSource, v.priceSource]),
    reference.petrolPrices.denmark?.source,
    reference.petrolPrices.sweden?.source,
    reference.exchangeRate?.source,
  ];
  return [...new Set(all.filter((s): s is string => Boolean(s)))];
}

export function HowWeCalculate({ reference }: { reference: ReferenceData | null }) {
  const sources = reportedSources(reference);
  return (
    <main className="how">
      <p>
        <a href="#" data-testid="back-to-calculator">
          ← Tilbage til beregneren
        </a>
      </p>
      <h1>Sådan regner vi</h1>
      <p className="intro">
        Her forklarer vi, hvordan vi kommer frem til tallene, og hvor de er usikre, så du selv kan vurdere, om du vil
        stole på dem.
      </p>

      <section>
        <h2>Det korte svar</h2>
        <p>
          For hver indkøbstur til Sverige trækker vi turens pris fra det, du sparer på varerne. Resultatet er
          nettobesparelsen. Vi sammenligner to ture på samme dag: over Øresundsbroen til Hyllie/Emporia i Malmø og
          med færgen Helsingør–Helsingborg til Väla Centrum. Den med den største nettobesparelse er den billigste tur.
          Din tid er ikke regnet med.
        </p>
        <ul>
          <li>
            <strong>Turens pris</strong> = overfartspris + kørselsudgift.
          </li>
          <li>
            <strong>Bruttobesparelse</strong> = for hver kategori dit planlagte indkøb × prisforskellen, plus eventuel
            tankbesparelse.
          </li>
          <li>
            <strong>Nettobesparelse</strong> = bruttobesparelse − turens pris.
          </li>
          <li>
            <strong>Break-even indkøb</strong> er det samlede indkøb, hvor nettobesparelsen er nul, for netop din
            blanding af kategorier. Hvis prisforskellen er nul eller negativ, kan turen aldrig betale sig på varerne.
          </li>
        </ul>
      </section>

      <section>
        <h2>Prisforskellen</h2>
        <p>
          Prisforskellen er, hvor meget billigere en kategori er i Sverige end i Danmark, som en procentdel af den
          danske pris. Er den negativ, er kategorien dyrere i Sverige. Der er fire kategorier: dagligvarer, slik og
          snacks, sodavand samt personlig pleje og husholdning.
        </p>
        <h3>Prøvekurven og kurvvarer</h3>
        <p>
          Hver kategori måles på en fast prøvekurv af kurvvarer, fx sødmælk eller spaghetti. En kurvvare er en slags
          vare, ikke et bestemt mærke. Vi finder produkter til den med en matchregel: søgeord, et interval for
          pakkestørrelse og ord, der udelukker et produkt. Reglerne er håndlavede og bliver finpudset løbende, så et
          enkelt match kan være skævt.
        </p>
        <p>
          Varerne sammenlignes på enhedspris (pris pr. kilo, liter eller stk.), så forskellige pakkestørrelser kan
          sammenlignes. Flerstykspriser som &quot;2 for 30 kr&quot; regnes pr. stk.
        </p>
        <h3>Billigste pris mod billigste pris</h3>
        <p>
          For hver kurvvare sammenligner vi den laveste svenske enhedspris i destinationens butikker med den laveste
          danske enhedspris hos de danske kæder. Prisforskellen for en kategori er det uvægtede gennemsnit af
          kurvvarernes forskelle: alle varer vejer lige meget, uanset hvor meget du køber af dem. Varer, der mangler
          en pris i det ene land, er udeladt, og det fremgår af oversigten under hver tur. Kan ingen vare i en kategori
          prissammenlignes, viser vi &quot;ingen prisdata endnu&quot; i stedet for 0 %.
        </p>
        <p>
          Kurven er lille og er ikke et officielt prisindeks. Den viser, hvordan prisforskellen ser ud for netop disse
          varer, ikke for alt, hvad du kan komme til at lægge i vognen.
        </p>
        <h3>Butikker i Sverige, kæder i Danmark</h3>
        <p>
          Hver overfart har en fast destination med en fast liste af butikker: Hyllie/Emporia i Malmø for broen og
          Väla Centrum ved Helsingborg for færgen. Danske priser kommer fra kæderne på landsplan, ikke fra bestemte
          butikker. En almindelig svensk pris fra fx Willys tæller i alle kædens butikker på destinationen; tilbud
          tæller kun i den butik, de gælder i. Prisforskellen kan derfor være lidt forskellig for de to destinationer.
        </p>
        <h3>Tilbud og medlemspriser</h3>
        <p>
          Hvis et tilbud fra ugens tilbudsavis er billigere end normalprisen, bruger vi tilbuddet, men kun hvis det er
          gyldigt på din turdato. Vælger du en dato langt ude i fremtiden, kender vi måske kun normalpriserne. Det
          fremgår af oversigten, om en pris er et tilbud (med slutdato) eller en normalpris.
        </p>
        <p>
          Tilbud, der kun gælder for medlemmer (fx Netto+, føtex plus, Bilka plus, Lidl Plus eller &quot;stammis&quot;
          i Sverige), tæller ikke med, fordi du ikke kan regne med at have adgangen. Vi genkender dem på ordlyden i
          tilbuddet, så et medlemstilbud uden tydelig markering kan slippe igennem.
        </p>
        <h3>Tabt pant og kurs</h3>
        <p>
          Svensk pant på dåser og flasker kan du ikke få udbetalt i Danmark. Derfor lægger vi det til den svenske pris
          på sodavand, før enhedsprisen regnes: 2 SEK pr. emballage op til 1 liter og 3 SEK over 1 liter. Oplyser
          butikken selv pantbeløbet, bruger vi det. Glas og plast skelnes ikke, og kartoner (fx juice) har ikke pant.
          Danske priser er uden pant.
        </p>
        <p>
          Svenske priser omregnes til kroner med den seneste kurs fra Den Europæiske Centralbank (ECB). Datoen vises
          på beregneren. Kursen svinger, og det gør prisforskellen også.
        </p>
      </section>

      <section>
        <h2>Hvad turen koster</h2>
        <h3>Overfartspris</h3>
        <p>
          Overfartsprisen er den billigste billet tur/retur, som alle kan købe uden abonnement, hvis du ikke har en
          rabataftale. Prisen afhænger af turdatoen: for færgen af sæsonen (højsæson er 1. juni–31. august), og en pris
          gælder først fra den dato, den træder i kraft.
        </p>
        <p>
          Har du en rabataftale, bruger vi den i stedet, selv hvis den skulle være dyrere end standardbilletten: ØresundGO
          til broen eller AutoBizz eller et turkort til færgen. Har du flere, vinder den billigste. Aftalens årlige gebyr
          eller kortets købspris tæller ikke med i turens pris.
        </p>
        <h3>Kørselsudgift</h3>
        <p>
          Kørselsudgiften er energien (benzin eller strøm) til at køre fra dit startsted til destinationen og tilbage.
          Overfarten er ikke med, for den ligger i overfartsprisen. Du angiver et postnummer, og vi slår kørselsafstanden
          op til begge destinationer. Standardforbrug og -pris kan rettes under &quot;Avanceret&quot;. Ud fra afstand ×
          forbrug × pris får du udgiften. Er afstanden ukendt, regner vi kørslen som 0 kr., og det siger vi.
        </p>
        <p>
          Afstandene er tilnærmede. De er beregnet fra et punkt i midten af postnummeret, så for store postnumre kan
          din egen adresse ligge længere fra eller tættere på. Du kan altid rette afstanden selv. 31 postnumre på øer
          uden vejforbindelse til Sverige (fx Bornholm, Ærø, Samsø, Læsø og Fanø) har ikke en afstand over vej, og her
          skal du selv indtaste kørselsafstanden.
        </p>
        <h3>Tankbesparelse</h3>
        <p>
          Kører du på benzin, kan du angive, hvor mange liter du vil tanke i Sverige. Tankbesparelsen er litrene gange
          forskellen mellem den danske og den svenske benzinpris, og den lægges til bruttobesparelsen. Er den svenske
          benzin dyrere, bliver den negativ. Mangler vi en benzinpris eller kursen, tæller tankbesparelsen som 0.
        </p>
        <h3>Billigere færgebilletter</h3>
        <p>
          Færgens Lavpris-billetter fra 199 kr pr. vej findes, hvis man bestiller i god tid. De er dynamiske, kan ikke
          refunderes og indgår ikke i beregningen. Færgen kan derfor være billigere end vist.
        </p>
      </section>

      <section>
        <h2>Det har vi ikke med</h2>
        <ul>
          <li>
            <strong>Alkohol, kød og snus/tobak.</strong> Alkohol og kød er dyrere i Sverige, så de er ikke en kategori og
            har intet felt. Vi vil ikke have, at en tur planlægges omkring dem. Der er også mængdegrænser for, hvor
            meget alkohol og tobak man må tage med hjem, og dem giver vi ikke vejledning om.
          </li>
          <li>
            <strong>ICA.</strong> ICAs tilbud på Tjek har ingen markering af, om de kun gælder for medlemmer (stammis).
            Vi kan derfor ikke holde medlemspriser ude og har valgt slet ikke at bruge ICA. Vi bruger Willys, Lidl, City
            Gross og Coop.
          </li>
          <li>
            <strong>Medlemspriser</strong>, se ovenfor.
          </li>
          <li>
            <strong>Din tid</strong> og slid på bilen.
          </li>
        </ul>
        <h3>Momsnedsættelsen i Sverige</h3>
        <p>
          Sverige har midlertidigt sænket momsen på fødevarer, til og med 31. december 2027. Det er med til at gøre
          svenske fødevarer billigere. Når nedsættelsen ophører, flytter prisforskellene sig, og tallene her passer så
          ikke længere uden en ny måling.
        </p>
      </section>

      <section>
        <h2>Hvor data kommer fra, og hvor aktuelle de er</h2>
        <p>
          Vi bruger offentligt tilgængelige data, ikke aftaler med butikkerne. Kilderne er uofficielle og kan ændre sig
          eller forsvinde. Priserne hentes manuelt, ikke automatisk hver dag, og kan derfor være forældede. Beregneren
          viser, hvor gamle de nyeste priser er, og advarer, når de er mere end 14 dage gamle. Alle hentede priser gemmes
          med dato og aldrig overskrevet.
        </p>
        <ul>
          <li>
            Svenske priser: Willys&apos; webshop (normalpriser) og Tjek (tilbud fra bl.a. Willys, Lidl, City Gross og
            Coop). Tjek er den tjeneste, der tidligere hed eTilbudsavis.
          </li>
          <li>Danske priser: REMA 1000 (normalpriser) og tilbud fra danske kæders tilbudsaviser via Tjek.</li>
          <li>
            Valutakurs: Den Europæiske Centralbank (ECB).
          </li>
          <li>Benzinpriser: EU-Kommissionens Weekly Oil Bulletin (Euro-super 95, inklusive afgifter).</li>
          <li>
            Overfartspriser: Øresundsbron (broen) og Øresundslinjen (færgen), som vi læser af på deres prissider.
          </li>
          <li>Pant: Pantamera (Sveriges pantsystem), satser fra 2025.</li>
        </ul>
        <h3>Afstande og kort</h3>
        <ul>
          <li>
            Postnumrenes midtpunkter kommer fra{' '}
            <a href="https://www.geonames.org/" rel="noreferrer">
              GeoNames
            </a>
            , licens{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/" rel="noreferrer">
              CC BY 4.0
            </a>
            .
          </li>
          <li>
            Kørselsafstande er beregnet med{' '}
            <a href="https://project-osrm.org/" rel="noreferrer">
              OSRM
            </a>{' '}
            på kortdata fra{' '}
            <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">
              OpenStreetMap
            </a>
            -bidragydere (© OpenStreetMap contributors, ODbL). Afstandene er hentet på forhånd, ikke mens du bruger siden.
          </li>
        </ul>
        {sources.length > 0 && (
          <>
            <h3>Kilder, som vores data opgiver</h3>
            <ul data-testid="reported-sources">
              {sources.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h2>Begreber</h2>
        <dl className="glossary">
          <dt>Indkøbstur</dt>
          <dd>En køretur på turdatoen fra dit startsted over én overfart til destinationen og hjem igen.</dd>
          <dt>Overfart</dt>
          <dd>Øresundsbroen eller færgen Helsingør–Helsingborg.</dd>
          <dt>Destination</dt>
          <dd>Det faste indkøbssted i Sverige for en overfart.</dd>
          <dt>Rabataftale</dt>
          <dd>ØresundGO, AutoBizz eller turkort, som sænker overfartsprisen.</dd>
          <dt>Kategori</dt>
          <dd>En gruppe varer med fælles prisforskel.</dd>
          <dt>Planlagt indkøb</dt>
          <dd>Det, du forventer at købe i en kategori, regnet i danske priser.</dd>
          <dt>Prisforskel</dt>
          <dd>Hvor meget billigere en kategori er i Sverige, i procent af den danske pris.</dd>
          <dt>Prøvekurv og kurvvare</dt>
          <dd>De varer, prisforskellen måles på.</dd>
          <dt>Enhedspris</dt>
          <dd>Pris pr. kilo, liter eller stk.</dd>
          <dt>Tilbud</dt>
          <dd>En midlertidig pris fra en tilbudsavis.</dd>
          <dt>Tabt pant</dt>
          <dd>Svensk pant, du ikke kan få udbetalt i Danmark.</dd>
          <dt>Bruttobesparelse, nettobesparelse</dt>
          <dd>Besparelsen på varerne, og besparelsen efter turens pris.</dd>
        </dl>
      </section>

      <p>
        <a href="#">← Tilbage til beregneren</a>
      </p>
    </main>
  );
}
