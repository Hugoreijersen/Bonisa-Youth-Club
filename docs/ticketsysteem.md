# Ticketsysteem

Voor het technisch aanspreekpunt en een opvolger. Laatst bijgewerkt: 4 november 2026.

Fase 2 (bestellen en betalen) en fase 3 (ticketmail, ticketpagina, scannen, beheer, nieuwsbrief) zijn gebouwd en lokaal getest. Handleiding voor kantoor: [beheer-tickets.md](beheer-tickets.md).

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

Na "betaald" (in dezelfde stap, via _shared/betaling.ts):
   ├─ ticketmail via MailerSend: één QR-code per ticket + link naar /tickets/mijn/#<geheim>
   └─ nieuwsbrief: alleen met het aparte vinkje, naar MailerLite

Bij de deur: /scan/ (inloggen) ── scan ──> scan_ticket(): elk ticket maar één keer
Kantoor:     /beheer/ (inloggen) ── beheer ──> cijfers, bestellingen, export, evenement, accounts
```

Lukt de ticketmail niet (MailerSend onbereikbaar), dan antwoordt de webhook met een fout en probeert Mollie het later opnieuw; de mail gaat dan alsnog. Een betaalde bestelling krijgt nooit twee keer automatisch een mail: een korte "claim" in de database voorkomt dat de webhook en de bedankpagina tegelijk mailen.

Afspraken uit `beveiliging.md` en hoe ze hier geregeld zijn:

| Afspraak | Zo geregeld |
| --- | --- |
| Bedragen op de server berekenen | `maak_bestelling()` rekent `aantal × prijs_cent` uit de tabel `events`. Wat het formulier meestuurt over prijzen wordt genegeerd (getest) |
| Mollie-meldingen nacontroleren | Mollie stuurt alleen een betaal-id. `mollie-webhook` vraagt de betaling zelf op met onze sleutel en vergelijkt ook het bedrag |
| Bezoekers kunnen niets lezen | Row Level Security op elke tabel, zonder regels voor bezoekers; ook de SQL-functies zijn alleen voor de functies (getest) |
| QR-codes niet te raden | Elke ticketcode is 128 willekeurige bits (32 tekens). De QR-code bevat alleen die code |
| Een ticket maar één keer binnen | `scan_ticket()` zet "gescand" in één databasestap; twee scanners tegelijk laten maar één persoon binnen (getest) |
| Ticketpagina alleen voor de koper | De link bevat een aparte geheime sleutel (`orders.toegang`, 128 bits) achter het `#`-teken; die gaat niet naar de server van de site. De pagina toont alleen de voornaam |
| Scannen en beheer alleen met login | Supabase Auth met wachtwoord; rol `scanner` of `kantoor` in de tabel `beheerders`. Zelf een account aanmaken kan niet (`enable_signup = false`); kantoor maakt accounts aan op de beheerpagina |
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
| `supabase/functions/mijn-tickets` | Ticketpagina: tickets met QR-code bij de geheime sleutel |
| `supabase/functions/scan` | Scanpagina: controleert een ticket (alleen met login) |
| `supabase/functions/beheer` | Beheerpagina: cijfers, bestellingen, export, ticketmail opnieuw, evenement instellen, accounts (alleen rol `kantoor`) |
| `supabase/functions/_shared/ticketmail.ts`, `mail.ts`, `nieuwsbrief.ts` | Ticketmail (MailerSend) en nieuwsbrief (MailerLite) |
| `supabase/functions/_shared/vendor/qrcode.mjs` | QR-codes maken (qrcode-generator 2.0.4, MIT), als GIF |
| `site/assets/js/vendor/jsQR.js` | QR-codes lezen met de camera (jsQR 1.4.0, Apache-2.0) |
| `site/tickets/mijn.njk`, `site/scan.njk`, `site/beheer.njk` | Ticketpagina, scanpagina, beheerpagina |
| `site/assets/js/inloggen.js` | Inloggen voor scan- en beheerpagina (sessie alleen in het geopende tabblad) |
| `supabase/functions/_shared` | Gedeelde code; geen externe pakketten |
| `supabase/config.toml` | Instellingen; de drie functies hebben geen Supabase-login nodig (ze controleren alles zelf) |
| `site/tickets/` | Bestelpagina en bedankpagina |
| `site/assets/js/bestellen.js`, `bedankt.js` | Teller, totaal, versturen, status tonen |
| `site/_data/ticketsysteem.js` | Adres van de functies (instelling `FUNCTIES_URL`) |
| `site/_headers.njk` | Beveiligingsregels; staat het ticketsysteem en Mollie toe |
| `supabase/tests/` | Automatische tests, en `nep-diensten.mjs`: een nagebootste Mollie, MailerSend en MailerLite |

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

De tests starten zelf de nagebootste diensten. Draait `npm run nep` nog, stop die dan eerst (Ctrl+C).

De tests gebruiken nagebootste diensten (`supabase/tests/nep-diensten.mjs`) en beginnen elke keer met een lege bestellijst voor het testevenement. Ze controleren onder andere: het bedrag komt uit de database, de webhook vertrouwt de melding niet, dubbele meldingen maken geen dubbele tickets of mails, uitverkocht en gelijktijdig bestellen, verkoop dicht, Mollie of MailerSend onbereikbaar, het maximum per e-mailadres, de ticketpagina, scannen (ook twee scanners tegelijk), de rechten op de beheerpagina, en dat bezoekers niets kunnen lezen. Stand op 4 november 2026: 22 geslaagd, 1 overgeslagen (CORS kan alleen online getest worden, omdat de lokale Supabase daar altijd `*` geeft).

Wil je alles zelf doorklikken, zet dan naast `npm run functies` nog twee vensters aan:

```
npm start      # de site
npm run nep    # nagebootste Mollie, MailerSend en MailerLite
```

1. Ga naar http://localhost:8080/tickets/ en bestel. Je komt op de betaalpagina van de nagebootste Mollie. Kies Betaald, Mislukt, Geannuleerd of Verlopen; je gaat terug naar de bedankpagina. (Lokaal kan Mollie de webhook niet bereiken; de bedankpagina vraagt de status daarom zelf na via `ticketinfo`, net als online wanneer de webhook laat is.)
2. De ticketmail zie je op http://localhost:54399/mails. De knop in de mail opent je ticketpagina.
3. Een account voor de beheerpagina maak je lokaal één keer in Supabase Studio: **Authentication → Add user** (vink "Auto Confirm" aan), en daarna in de **SQL Editor**:
   ```sql
   insert into public.beheerders (user_id, rol)
   select id, 'kantoor' from auth.users where email = 'jij@voorbeeld.nl';
   ```
   Daarna kun je inloggen op http://localhost:8080/beheer/ en daar verdere accounts (ook scanners) aanmaken.
4. Scannen: http://localhost:8080/scan/. De camera werkt op `localhost` en online (https); op een telefoon in je eigen netwerk niet, omdat dat geen https is. Lokaal kun je de code ook met de hand invoeren.

Na het wijzigen van `supabase/config.toml` (bijvoorbeeld na het binnenhalen van deze versie): `npm run db:stop` en `npm run db:start`. Nieuwe migraties zonder je testgegevens te wissen: `npx supabase@3.0.0 migration up`.

Wat er in de lokale database staat, zie je in Supabase Studio op http://localhost:54323 (Table Editor). Het adres http://127.0.0.1:54321 is geen pagina maar het adres waarmee de site en de functies met de database praten.

Testen met de echte Mollie-testomgeving: haal in `.env.local` de regel `MOLLIE_API_URL` weg en zet je `test_`-sleutel bij `MOLLIE_API_KEY`.

## 5. Online zetten (eenmalig)

1. **Supabase-project** in regio Frankfurt (`eu-central-1`). Tijdens de bouw in je eigen organisatie (besluit 22).
2. Koppelen en de database opzetten, vanuit de map Website:
   ```
   npx supabase@3.0.0 login
   npx supabase@3.0.0 link --project-ref <project-ref>
   npx supabase@3.0.0 db push --remote
   ```
   Let op `--remote`: zonder die vlag zet `db push` de tabellen in je lokale testdatabase, niet online. Controleren kan met `npx supabase@3.0.0 migration list --remote`. De commando's `secrets set` en `functions deploy` hieronder werken altijd op het online project.
3. **Geheimen** instellen (nooit in een bestand in de repository):
   ```
   npx supabase@3.0.0 secrets set MOLLIE_API_KEY=test_... SITE_URL=https://<testsite> SITE_ORIGINS=https://<testsite> PUBLIC_FUNCTIONS_URL=https://<project-ref>.supabase.co/functions/v1
   npx supabase@3.0.0 secrets set MAIL_API_KEY=<MailerSend-token> MAIL_FROM=tickets@jongerenzang.nl MAIL_FROM_NAAM="Katwijkse Jongerenzang" MAIL_REPLY_TO=<adres van de BYC>
   npx supabase@3.0.0 secrets set MAILERLITE_API_KEY=<MailerLite-token> MAILERLITE_GROEP=<id van de groep>
   ```
   MailerSend verstuurt alleen vanaf een domein dat je daar hebt geverifieerd (een paar DNS-records bij jongerenzang.nl). Zonder `MAILERLITE_API_KEY` staat de nieuwsbrief-aanmelding uit. Het vinkje blijft wel bewaard (kolom `nieuwsbrief` in de export), zodat je die adressen later zelf in MailerLite kunt zetten.
4. **Functies** online zetten: `npx supabase@3.0.0 functions deploy`
5. **Inloggen beveiligen** in het Supabase-dashboard, onder Authentication: "Allow new users to sign up" **uit**, en bij URL Configuration de Site URL op het adres van de site.
6. **Eerste kantooraccount**: Authentication → Add user (met "Auto Confirm"), daarna in de SQL Editor:
   ```sql
   insert into public.beheerders (user_id, rol)
   select id, 'kantoor' from auth.users where email = '<e-mailadres>';
   ```
   Alle volgende accounts maakt kantoor zelf aan op `/beheer/`.
7. **Evenement** aanmaken op `/beheer/` → **+ Nieuw evenement** (naam, vaste naam `jongerenzang-2027`, datum, prijs, aantal tickets). Daarna de verkoop openen met de knop in het groene blok.
8. **Cloudflare**: zet onder Settings → Build → **Build variables and secrets** de variabelen `FUNCTIES_URL` (`https://<project-ref>.supabase.co/functions/v1`) en `SUPABASE_PUBLIEKE_SLEUTEL` (de "publishable key" uit Project Settings → API Keys; die is openbaar bedoeld) en bouw opnieuw.
9. Op de site: in het bewerkscherm "Ticketverkoop is open" aanzetten, met als link `/tickets/`.

Live gaan met echte betalingen: alleen de `MOLLIE_API_KEY` vervangen door de `live_`-sleutel van het Mollie-account van de stichting. Eerst een paar echte bestellingen van € 4,50 doen en terugbetalen (fase 4).

**Let op:** de prijs op de site (bewerkscherm) is alleen om te tonen. Het bedrag dat mensen betalen staat in `events.prijs_cent` (op `/beheer/` bij Gegevens van dit evenement). De bestelpagina haalt de echte prijs op en toont die, maar houd ze gelijk.

## 6. Nieuw jaar

1. Op `/beheer/`: **+ Nieuw evenement**, bijvoorbeeld vaste naam `jongerenzang-2028`.
2. In Cloudflare (Settings → Build → Build variables and secrets) de variabele `EVENEMENT` op die vaste naam zetten en opnieuw bouwen. De bestel- en scanpagina gebruiken dan het nieuwe evenement.
3. Tickets van vorig jaar worden bij het scannen herkend als "ander evenement".
