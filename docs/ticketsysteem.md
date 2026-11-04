# Ticketsysteem

Voor het technisch aanspreekpunt en een opvolger. Laatst bijgewerkt: 4 november 2026.

Dit is fase 2: bestellen en betalen. QR-tickets per e-mail, de scanpagina en de beheerpagina volgen in fase 3.

## 1. Hoe een bestelling loopt

```
Bezoeker op /tickets/
   │  formulier (naam, e-mail, woonplaats, aantal, akkoord, nieuwsbrief)
   v
create-order  (Supabase-functie, Frankfurt)
   │  1. controleert de velden en het spamveld
   │  2. maak_bestelling() in de database: verkoop open? genoeg plaatsen? bedrag berekenen
   │  3. maakt een betaling aan bij Mollie
   v
Mollie (iDEAL)  ── betaald / mislukt / verlopen ──>  mollie-webhook
   │                                                  │ vraagt de betaling zélf op bij Mollie
   │                                                  │ verwerk_betaling(): status + tickets
   v                                                  v
/tickets/bedankt/?bestelling=…  ── ticketinfo ──>  status uit de database
```

Afspraken uit `beveiliging.md` en hoe ze hier geregeld zijn:

| Afspraak | Zo geregeld |
| --- | --- |
| Bedragen op de server berekenen | `maak_bestelling()` rekent `aantal × prijs_cent` uit de tabel `events`. Wat het formulier meestuurt over prijzen wordt genegeerd (getest) |
| Mollie-meldingen nacontroleren | Mollie stuurt alleen een betaal-id. `mollie-webhook` vraagt de betaling zelf op met onze sleutel en vergelijkt ook het bedrag |
| Bezoekers kunnen niets lezen | Row Level Security op elke tabel, zonder regels voor bezoekers; ook de SQL-functies zijn alleen voor de functies (getest) |
| QR-codes niet te raden | Elke ticketcode is 128 willekeurige bits (32 tekens) |
| Spam en misbruik | Verborgen spamveld; maximaal 5 bestellingen per e-mailadres per uur |
| Persoonsgegevens alleen in de EU | Functies en database bij Supabase in Frankfurt; de site vraagt `x-region: eu-central-1`, de webhook `forceFunctionRegion=eu-central-1` |
| Logboeken zonder persoonsgegevens | De functies loggen alleen id's en foutcodes |

## 2. Nooit te veel tickets

Bij elke bestelling wordt de rij van het evenement in de database even "op slot" gezet (`for update`). Twee mensen die tegelijk de laatste plaats kopen, worden zo na elkaar afgehandeld; de tweede krijgt "niet genoeg plaatsen". Getest met 8 gelijktijdige bestellingen voor 3 plaatsen.

Een bestelling die nog niet betaald is, houdt de plaatsen 30 minuten vast (de tijd om bij Mollie te betalen). Daarna komen ze vanzelf weer vrij. Lukt het aanmaken van de betaling bij Mollie niet, dan komen ze direct vrij.

## 3. De onderdelen

| Waar | Wat |
| --- | --- |
| `supabase/migrations/…_tickets.sql` | Tabellen `events`, `orders`, `tickets`, `beheerders`, de toegangsregels en de SQL-functies |
| `supabase/seed.sql` | Testevenement, alleen voor lokaal gebruik |
| `supabase/functions/create-order` | Bestelling opslaan en betaling starten. Werkt met en zonder JavaScript |
| `supabase/functions/mollie-webhook` | Betaalstatus verwerken |
| `supabase/functions/ticketinfo` | Openbare info: prijs en status van de verkoop, en de status van één bestelling voor de bedankpagina. Vraagt bij een open bestelling zelf bij Mollie na, voor als de webhook laat is |
| `supabase/functions/_shared` | Gedeelde code; geen externe pakketten |
| `supabase/config.toml` | Instellingen; de drie functies hebben geen Supabase-login nodig (ze controleren alles zelf) |
| `site/tickets/` | Bestelpagina en bedankpagina |
| `site/assets/js/bestellen.js`, `bedankt.js` | Teller, totaal, versturen, status tonen |
| `site/_data/ticketsysteem.js` | Adres van de functies (instelling `FUNCTIES_URL`) |
| `site/_headers.njk` | Beveiligingsregels; staat het ticketsysteem en Mollie toe |
| `supabase/tests/` | Automatische tests en een nagebootste Mollie |

### Statussen van een bestelling

| Status | Betekenis |
| --- | --- |
| `open` | Wacht op betaling |
| `betaald` | Betaald; de tickets zijn aangemaakt |
| `mislukt` | Geannuleerd of mislukt bij Mollie |
| `verlopen` | Niet op tijd betaald |
| `terugbetaald` | Volledig terugbetaald (via het Mollie-dashboard); tickets zijn niet meer geldig |

Een betaalde bestelling gaat nooit meer terug naar mislukt of verlopen.

## 4. Lokaal draaien en testen

Nodig: Docker Desktop (voor de lokale Supabase) en Node.

```
npm run db:start          # lokale Supabase met de tabellen en het testevenement
cp supabase/functions/.env.example supabase/functions/.env.local
npm run functies          # de functies (laat dit venster open)
npm run test:tickets      # in een tweede venster: alle tests
```

De tests gebruiken een nagebootste Mollie (`supabase/tests/mollie-nep.mjs`). Ze controleren onder andere: het bedrag komt uit de database, de webhook vertrouwt de melding niet, dubbele meldingen maken geen dubbele tickets, uitverkocht en gelijktijdig bestellen, verkoop dicht, Mollie onbereikbaar, het maximum per e-mailadres, en dat bezoekers niets kunnen lezen. Stand op 4 november 2026: 15 geslaagd, 1 overgeslagen (CORS kan alleen online getest worden, omdat de lokale Supabase daar altijd `*` geeft).

Wil je de bestelpagina zelf proberen: `npm start` in een derde venster, en ga naar http://localhost:8080/tickets/. Met de nagebootste Mollie kom je na "Bestel je ticket" op een adres dat niet bestaat; dat is goed.

Testen met de echte Mollie-testomgeving: haal in `.env.local` de regel `MOLLIE_API_URL` weg en zet je `test_`-sleutel bij `MOLLIE_API_KEY`.

## 5. Online zetten (eenmalig)

1. **Supabase-project** in regio Frankfurt (`eu-central-1`). Tijdens de bouw in je eigen organisatie (besluit 22).
2. Koppelen en de database opzetten, vanuit de map Website:
   ```
   npx supabase@3.0.0 login
   npx supabase@3.0.0 link --project-ref <project-ref>
   npx supabase@3.0.0 db push
   ```
3. **Geheimen** instellen (nooit in een bestand in de repository):
   ```
   npx supabase@3.0.0 secrets set MOLLIE_API_KEY=test_... SITE_URL=https://<testsite> SITE_ORIGINS=https://<testsite> PUBLIC_FUNCTIONS_URL=https://<project-ref>.supabase.co/functions/v1
   ```
4. **Functies** online zetten: `npx supabase@3.0.0 functions deploy`
5. **Evenement** aanmaken in de SQL Editor van Supabase:
   ```sql
   insert into public.events (slug, naam, begint_op, locatie, prijs_cent, max_tickets, max_per_bestelling, verkoop_open_vanaf)
   values ('jongerenzang-2027', 'Katwijkse Jongerenzang 2027', '2027-05-21 19:45+02', 'Nieuwe Kerk Katwijk', 450, <capaciteit>, 10, '<startdatum> 10:00+01');
   ```
6. **Cloudflare Pages**: zet de omgevingsvariabele `FUNCTIES_URL` op `https://<project-ref>.supabase.co/functions/v1` en bouw opnieuw.
7. Op de site: in het bewerkscherm "Ticketverkoop is open" aanzetten, met als link `/tickets/`.

Live gaan met echte betalingen: alleen de `MOLLIE_API_KEY` vervangen door de `live_`-sleutel van het Mollie-account van de stichting. Eerst een paar echte bestellingen van € 4,50 doen en terugbetalen (fase 4).

**Let op:** de prijs op de site (bewerkscherm) is alleen om te tonen. Het bedrag dat mensen betalen staat in `events.prijs_cent`. De bestelpagina haalt de echte prijs op en toont die, maar houd ze gelijk.
