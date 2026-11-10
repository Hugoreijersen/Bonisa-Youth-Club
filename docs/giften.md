# Giften voor bonisa.nl

Voor het technisch aanspreekpunt en een opvolger. Laatst bijgewerkt: 4 november 2026.

Giften zijn altijd voor een project. Gevers kiezen eenmalig of maandelijks, een vast bedrag of een eigen bedrag, en betalen met iDEAL via Mollie. Dit vervangt de losse betaallinks (besluiten 49 tot en met 55). De achterkant is gebouwd en lokaal getest; de voorkant komt mee met de bouw van bonisa.nl (vanaf 25 november). Tot die tijd staan er eenvoudige geefpagina's in `site/geven/` om mee te testen.

## 1. Hoe een gift loopt

```
Kantoor ── Pages CMS ──> site/_data/projecten.json ──bouwen──> /geven/<project>/  en  /geven/projecten.json

Gever op /geven/<project>/
   │  formulier: eenmalig of maandelijks, bedrag, naam, e-mail, eventueel nieuwsbrief
   v
create-gift  (Supabase-functie, Frankfurt)
   │  1. controleert de velden, het spamveld en het bedrag (€ 1 tot € 10.000)
   │  2. controleert het project tegen /geven/projecten.json: bestaat het en is het open?
   │  3. maak_gift() in de database
   │  4. maandelijks: eerst een klant bij Mollie (nodig voor de machtiging)
   │  5. maakt de betaling aan bij Mollie (maandelijks: als "eerste betaling")
   v
Mollie (iDEAL) ── betaald / mislukt / verlopen ──>  gift-webhook
   │                                                  │ vraagt de betaling zélf op bij Mollie
   │                                                  │ verwerk_gift_betaling(): status, bedrag controleren
   v                                                  v
/geven/bedankt/?gift=…  ── giftinfo ──>  status uit de database

Na "betaald" (_shared/giften.ts):
   ├─ maandelijks: abonnement bij Mollie starten (eerste afschrijving over een maand, daarna elke maand)
   ├─ bedankmail via MailerSend (eenmalig: na elke gift; maandelijks: alleen bij de start, met stoplink)
   └─ nieuwsbrief: alleen met het aparte vinkje, naar MailerLite

Elke maand: Mollie schrijft af ── gift-webhook ──> nieuwe rij in giften (soort "maandelijks"), geen mail
Stoppen:    stoplink /geven/stoppen/#<code> ── gift-stoppen ──> abonnement bij Mollie opgezegd
Kantoor:    /beheer/ → Giften: stand per project, export, maandelijkse gift stoppen
```

De eerste maand betaalt de gever met iDEAL. Daarmee geeft hij Mollie een machtiging (SEPA-incasso). Pas als die eerste betaling binnen is, start het abonnement; de eerste incasso volgt een maand later.

## 2. Afspraken en hoe ze geregeld zijn

| Afspraak | Zo geregeld |
| --- | --- |
| Bedragen op de server controleren | `maak_gift()` weigert alles onder € 1 en boven € 10.000. De functie rekent een eigen bedrag ("12,50") zelf om naar centen |
| Mollie-meldingen nacontroleren | Mollie stuurt alleen een betaal-id. `gift-webhook` vraagt de betaling zelf op met onze sleutel en vergelijkt het bedrag. Een maandelijkse afschrijving telt alleen als het abonnement van ons is én het bedrag precies klopt |
| Alleen bestaande, open projecten | De functie haalt de projectenlijst die de site publiceert (`/geven/projecten.json`, één minuut bewaard) en slaat naam en vaste naam van het project bij elke gift op |
| Bezoekers kunnen niets lezen | Row Level Security op `giften` en `periodieke_giften`, zonder regels voor bezoekers; alle SQL-functies alleen voor de functies (getest) |
| Nooit dubbel | Dubbele meldingen maken geen dubbele giften, abonnementen of mails; Mollie-verzoeken gaan met een `Idempotency-Key` |
| Stoppen altijd mogelijk | Stoplink met een geheime code (128 bits) in de bedankmail; kantoor kan ook stoppen op `/beheer/` |
| Terugbetaald of storno | Terugbetaald of teruggeboekt (incasso gestorneerd) bij Mollie → status `terugbetaald`, telt niet meer mee |
| Persoonsgegevens | Naam en e-mail in Supabase (Frankfurt) en, voor maandelijkse giften, als klant bij Mollie. Logs bevatten alleen id's |

## 3. De onderdelen

| Onderdeel | Wat het doet |
| --- | --- |
| `supabase/migrations/20261104170000_giften.sql` | Tabellen `giften` (één rij per betaling) en `periodieke_giften` (één rij per maandelijkse gift), en alle SQL-functies |
| `supabase/functions/create-gift` | Gift aanmaken en naar Mollie sturen. Werkt ook zonder JavaScript |
| `supabase/functions/gift-webhook` | Meldingen van Mollie, ook voor de maandelijkse afschrijvingen |
| `supabase/functions/giftinfo` | Openbaar, zonder persoonsgegevens: stand per project, status voor de bedankpagina, gegevens voor de stoppagina |
| `supabase/functions/gift-stoppen` | Maandelijkse gift stoppen met de code uit de mail |
| `supabase/functions/_shared/giften.ts` | Mollie (klant, betaling, abonnement), verwerken, stoppen, bedankmail |
| `supabase/functions/beheer` | Acties `giften_overzicht`, `giften_export`, `periodieke_giften`, `periodiek_stoppen` (alleen rol kantoor) |
| `site/_data/projecten.json` | De projecten (Pages CMS: **Projecten (giften)**) |
| `site/geven/` | Overzicht, pagina per project, bedankpagina, stoppagina en `projecten.json` |
| `site/assets/js/geven*.js` | Voortgangsbalk, "ander bedrag", bedank- en stoppagina |

### Statussen

Een gift (`giften.status`) heeft dezelfde statussen als een ticketbestelling: `open`, `betaald`, `mislukt`, `verlopen`, `terugbetaald`. Soorten: `eenmalig`, `eerste` (eerste betaling van een maandelijkse gift) en `maandelijks`.

Een maandelijkse gift (`periodieke_giften.status`): `wacht_op_eerste` → `actief` → `gestopt`, of `mislukt` als de eerste betaling niet lukt.

### Voortgangsbalk

Online giften telt de database (`projectstanden()`): alle betaalde giften per project. Giften die per bankoverschrijving binnenkomen, vult kantoor per project in bij **Giften via de bank** in Pages CMS. De balk telt die twee op. Giften via de site komen ook op de bankrekening (Mollie betaalt ze uit); die niet nog eens invullen.

### Ontmoetingsreis

De deelnemers van de Ontmoetingsreis zijn ook geefprojecten (`reis-<vaste naam>`), met eigen sponsorpagina's op `/ontmoetingsreis/`. Ze staan in `site/_data/ontmoetingsreis.json`, niet in `projecten.json`. Zie [ontmoetingsreis.md](ontmoetingsreis.md).

## 4. Lokaal draaien en testen

Zoals bij het ticketsysteem ([ticketsysteem.md](ticketsysteem.md) §4): `npm run db:start`, `.env.example` kopiëren naar `.env.local` (daar staan ook de instellingen voor giften), `npm run functies`, en dan:

```
npm run test:giften
```

De tests (`supabase/tests/giften.test.mjs`) controleren onder andere: bedrag uit het formulier en de grenzen, onbekende en gesloten projecten, werken zonder JavaScript, een melding met een verkeerd bedrag, mislukt/verlopen/terugbetaald, de bedankpagina als de webhook laat is, het maximum van 5 giften per e-mailadres per uur, de nieuwsbrief, de hele route van een maandelijkse gift (klant, eerste betaling, abonnement, maandelijkse afschrijving, storno), stoppen (ook twee keer, en vóór de start), de voortgang per project, de export en dat bezoekers niets kunnen lezen. Stand op 4 november 2026: 22 geslaagd. Draai `test:tickets` en `test:giften` na elkaar, niet tegelijk: beide starten de nagebootste diensten op dezelfde poort.

Zelf doorklikken: naast `npm run functies` ook `npm run nep` en

```
npm run start:giften     # de site mét de geefpagina's
```

Ga naar http://localhost:8080/geven/. De nagebootste diensten kennen een eigen testlijst van projecten. Wil je de projecten uit `site/_data/projecten.json` gebruiken, zet dan in `.env.local` `PROJECTEN_URL=http://host.docker.internal:8080/geven/projecten.json`. Een maandelijkse afschrijving nabootsen: `curl -X POST http://localhost:54399/__abonnement/<sub_...>/betaling` en daarna die betaling melden aan `gift-webhook` (zie de tests).

De geefpagina's worden alleen gebouwd met de bouwvariabele `GIFTEN_PAGINAS=aan`. Zo komen ze niet op jongerenzang.nl.

## 5. Online zetten (eenmalig)

Er is één Supabase-project voor alle sites (besluit 20); de giften gebruiken hetzelfde project als de tickets.

1. **Database**: `npx supabase@3.0.0 db push --remote` (let op `--remote`).
2. **Mollie**: in het Mollie-account van de stichting een websiteprofiel voor bonisa.nl (besluit 39), met **iDEAL** en **SEPA-incasso** aan. SEPA-incasso is nodig voor maandelijkse giften; Mollie moet dat soms eerst goedkeuren.
3. **Geheimen** (Hugo of zijn opvolger zet ze zelf; nooit in een bestand of chat):
   ```
   npx supabase@3.0.0 secrets set MOLLIE_GIFTEN_API_KEY=test_... GIFTEN_SITE_URL=https://<site van bonisa.nl>
   npx supabase@3.0.0 secrets set GIFTEN_MAIL_FROM=<afzender op bonisa.nl> GIFTEN_MAIL_FROM_NAAM="Stichting Bonisa" GIFTEN_MAIL_REPLY_TO=<adres van kantoor>
   ```
   Voeg het adres van bonisa.nl ook toe aan `SITE_ORIGINS` (komma's ertussen), anders mag de site de functies niet aanroepen. `PROJECTEN_URL` online leeg laten. MailerSend verstuurt alleen vanaf een geverifieerd domein: bonisa.nl daar ook verifiëren.
4. **Functies**: `npx supabase@3.0.0 functions deploy`.
5. **Cloudflare** (site van bonisa.nl): bouwvariabele `GIFTEN_PAGINAS=aan`, plus `FUNCTIES_URL` zoals bij de jongerenzang.
6. **Testen** met de `test_`-sleutel en de testomgeving van Mollie; daarna de `live_`-sleutel. Eerst een eenmalige en een maandelijkse gift van € 1 doen, terugbetalen en de maandelijkse stoppen.

## 6. Voor kantoor

- **Project toevoegen of wijzigen**: Pages CMS → **Projecten (giften)**. De vaste naam niet meer wijzigen zodra er giften binnenkomen; zet een afgerond project op "Open voor giften: uit".
- **Giften via de bank**: per project het totaal bijhouden in **Giften via de bank**.
- **Overzicht en export**: `/beheer/` → **Giften**. De export (CSV) geeft per gift datum, project, soort, bedrag, status, naam en e-mail, voor de administratie.
- **Maandelijkse gift stoppen** op verzoek van een gever: `/beheer/` → **Maandelijkse giften** → Stoppen (twee keer klikken). Dit zegt ook het abonnement bij Mollie op.
- **Terugbetalen**: in het Mollie-dashboard. De site ziet dat bij de volgende melding van Mollie.
- Wordt een abonnement in het Mollie-dashboard gestopt in plaats van op `/beheer/`, dan blijft het hier op "Actief" staan. Stop maandelijkse giften daarom altijd via `/beheer/`.
