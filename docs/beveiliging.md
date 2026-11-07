# Beveiliging en locatie van gegevens

Laatst bijgewerkt: 4 november 2026.

**Uitgangspunt:** persoonsgegevens (bestellingen, tickets, giften, aanmeldingen) staan en draaien bij voorkeur in de EU; dat is nu zo. Voor diensten zonder persoonsgegevens weegt gemak zwaarder dan de plek (besluit 48). Alleen kopieën van de openbare pagina's (tekst en foto's, geen persoonsgegevens) staan wereldwijd via Cloudflare, ook in Azië. Dat is een bewuste keuze voor gemak (besluit 15).

Gevolg: alles wat op de site staat, kan overal ter wereld bekeken en bewaard worden. Wees dus extra zorgvuldig met wat je publiceert (zie *Bescherming van partners in Azië*).

## Waar staat wat

| Dienst | Wat | Waar | Afspraak |
| --- | --- | --- | --- |
| Cloudflare (Worker met alleen statische bestanden) | Openbare pagina's | Wereldwijd, ook in Azië | Alleen openbare pagina's. **Geen** Cloudflare-functies (Workers) of formulieren voor iets met persoonsgegevens: die draaien bij Supabase in Frankfurt |
| Supabase | Bestellingen, tickets, giften, aanmeldingen, functies | Frankfurt (`eu-central-1`) | Functies draaien standaard dicht bij de bezoeker. Altijd vastzetten op Frankfurt: `x-region: eu-central-1`, en voor Mollie-meldingen `?forceFunctionRegion=eu-central-1` |
| Mollie | Betalingen; voor maandelijkse giften ook een klant (naam, e-mail) en de machtiging | EU | Bank- en betaalgegevens komen nooit op onze eigen systemen (betalen gebeurt op de pagina van Mollie) |
| MailerLite | Nieuwsbriefadressen | Datacenter in de EU | |
| MailerSend | Ticketmails | Verzending vanuit Duitsland en België | Navragen waar de mailgegevens worden bewaard. Krijgt naam, e-mailadres en de ticketcodes |
| GitHub | Code en teksten | Verenigde Staten | Geen persoonsgegevens, geen wachtwoorden of sleutels. Europees alternatief: Codeberg (Berlijn) |
| Pages CMS (online versie, app.pagescms.org) | Bewerkscherm voor de teksten en foto's | Niet bekendgemaakt | Krijgt toegang tot deze ene repository (code en teksten, geen persoonsgegevens) en bewaart de inloggegevens van wie het bewerkscherm gebruikt. Alleen de repository van de site koppelen (besluit 48) |
| Claude | Hulp bij code en teksten | Verenigde Staten | Geen persoonsgegevens delen |

**Nieuwe dienst toevoegen?** Eerst nagaan waar die gegevens opslaat en code uitvoert, en dat in deze tabel zetten. Persoonsgegevens: bij voorkeur in de EU.

## Maatregelen

### Accounts
- Tweestapsverificatie op elk account.
- Iedereen een eigen account; nooit gedeelde logins.
- Alle accounts op een algemeen adres van de stichting, met minstens twee beheerders.
- Wachtwoorden in een gedeelde wachtwoordkluis.

### Sleutels en code
- Geheime sleutels (Mollie, Supabase service key, MailerSend, MailerLite) staan alleen in de instellingen van Supabase. Nooit in GitHub, nooit in de website-code.
- `.env`-bestanden staan in `.gitignore`.
- Automatische meldingen van GitHub over verouderde onderdelen (Dependabot) aanzetten; `.github/dependabot.yml` stelt maandelijks updates voor. Wie wat bijwerkt en welke meldingen aan moeten: [onderhoud.md](onderhoud.md).

### Website
- Geen bronnen van andere domeinen: lettertypen staan op de eigen site (niet Google Fonts), geen trackers of scripts van derden.
- Beveiligingsregels in `site/_headers.njk` (onder andere een Content-Security-Policy die alleen de eigen site toelaat, plus het ticketsysteem bij Supabase en het doorsturen naar Mollie). Cloudflare stuurt ze mee met elke pagina.
- Foto's: Eleventy Image haalt bij het bouwen alle EXIF-, GPS- en andere metagegevens uit elke foto (getest op 4 november 2026 met een foto met GPS-plek).
- Testversies zijn niet vindbaar in Google (`noindex`) tot livegang.
- De site stuurt `Strict-Transport-Security` mee (twee jaar, ook voor subdomeinen): browsers gebruiken daarna altijd https. Elk subdomein van jongerenzang.nl moet dus https hebben.

### Database
- Toegangsregels (Row Level Security) op elke tabel: bezoekers kunnen niets lezen; alleen de functies schrijven. Ook de SQL-functies zijn alleen voor de functies te gebruiken (getest, zie [ticketsysteem.md](ticketsysteem.md)).
- Dat geldt ook voor wie is ingelogd (scanners, kantoor, uitgenodigden zonder rol): de rollen `anon` en `authenticated` hebben geen enkel recht op tabellen of functies in `public`, ook niet op tabellen die later worden toegevoegd (migratie `20261107120000_rechten_dichtzetten.sql`, getest). Alleen de functies (service role) lezen en schrijven. Een nieuwe tabel via het dashboard (Table Editor) krijgt wel weer rechten van Supabase zelf: maak tabellen daarom alleen met een migratie.
- Wachtwoorden: minstens 10 tekens, met letters en cijfers. Supabase controleert dat zelf (Authentication → Password), `/welkom/` en `/beheer/` ook.
- De beheer- en scanpagina werken alleen na inloggen (Supabase Auth, wachtwoord), met rollen `kantoor` en `scanner` in de tabel `beheerders`. Zelf een account aanmaken kan niet; kantoor nodigt mensen uit per mail vanaf de beheerpagina (of via het Supabase-dashboard). Een uitgenodigd account heeft geen rol en kan dus niets, tot kantoor een rol kiest. De uitnodigingsmail verstuurt Supabase zelf; stel daar eigen SMTP van MailerSend in (zie ticketsysteem.md), zodat ook deze mail via MailerSend gaat. Alleen het e-mailadres gaat mee. Op `/welkom/` haalt de pagina de inlogcode meteen uit de adresbalk. Het inloggen blijft alleen bewaard in het geopende tabblad.
- De scanpagina toont alleen voornaam en "ticket x van y". Alle andere gegevens alleen op de beheerpagina.

### Betalingen en tickets
- Een melding van Mollie wordt altijd nagecontroleerd door de betaling zelf bij Mollie op te vragen. Alleen bedrag én valuta (euro) van Mollie tellen; klopt dat niet met de bestelling, dan verandert er niets.
- Een terugbetaling of storno (chargeback) van het hele bedrag maakt de tickets ongeldig bij de scanner.
- Kent Mollie de betaling niet, dan antwoordt de functie toch 200, zodat Mollie niet blijft proberen.
- Bedragen worden altijd op de server berekend, nooit overgenomen uit het formulier.
- QR-codes zijn lange, willekeurige codes (minstens 128 bits), niet te raden.
- Een ticket kan maar één keer gescand worden (getest, ook met twee scanners tegelijk).
- De persoonlijke ticketpagina werkt met een aparte geheime sleutel van 128 bits achter het `#`-teken in de link. Die sleutel komt niet in de logboeken van de site.

### Formulieren
- Een verborgen veld tegen spam. Komt er toch veel spam, dan een Europese botcontrole (bijvoorbeeld Friendly Captcha).
- Maximaal 5 bestellingen per e-mailadres per uur.

### Back-ups en logboeken
- Gratis plan: geen back-ups door Supabase. Daarom tijdens de verkoop een wekelijkse export volgens [back-up.md](back-up.md).
- Zodra bonisa.nl giften verwerkt: Supabase Pro met dagelijkse back-up, plus een maandelijkse eigen export.
- Logbestanden bevatten geen persoonsgegevens.

### Bewaartermijn
- Bestellingen: verwijderen of anonimiseren [X] maanden na het evenement (nog vaststellen).
- Giften: naam en e-mail bewaren zolang de administratie dat vraagt (fiscaal meestal 7 jaar); daarna anonimiseren. Termijn nog vaststellen. Gestopte maandelijkse giften: ook bij Mollie de klant verwijderen.
- Nieuwsbriefadressen: tot iemand zich afmeldt.

### Controle vóór livegang (beveiligingsreview 7 november 2026)
In het Supabase-dashboard en bij de secrets van de functies; Claude kan dit niet zelf:
1. **SQL Editor:** de drie controlevragen uit de review draaien (zie de pull request "Beveiligingsreview"). Verwacht: geen rechten voor `anon`/`authenticated`, overal RLS aan.
2. **Project Settings → Data API → Exposed schemas:** alleen `public` (de functies hebben die nodig). `graphql_public` mag eruit.
3. **Authentication → Providers → Email → Password:** minimale lengte 10, eisen "Letters and digits". Ook "Prevent use of leaked passwords" aan (alleen op Pro).
4. **Authentication → Rate limits:** niet hoger dan de standaard.
5. **Authentication → URL Configuration:** Site URL `https://jongerenzang.nl`; Redirect URLs `https://jongerenzang.nl/welkom/` en `https://www.jongerenzang.nl/welkom/` (en het workers.dev-adres alleen zolang dat nog gebruikt wordt).
6. **Secret `SITE_ORIGINS`** (komma's ertussen, zonder `/` op het eind): `https://jongerenzang.nl,https://www.jongerenzang.nl`, later ook `https://bonisa.nl,https://www.bonisa.nl`. `SITE_URL` op `https://jongerenzang.nl`.
7. **Verkoop dicht** tot de startdatum: op `/beheer/` bij het evenement "Verkoop open vanaf" leegmaken of op het startmoment zetten.

### Datalek
- Binnen 72 uur melden bij de Autoriteit Persoonsgegevens.
- Verantwoordelijke: [naam, nog vaststellen].

## Bescherming van partners in Azië

- Publiceer geen namen, herkenbare gezichten of precieze plaatsen van lokale partners en ontvangers, tenzij zeker is dat dat veilig is.
- Foto's bevatten vaak de GPS-plek waar ze gemaakt zijn. De site haalt die gegevens (EXIF) bij het bouwen automatisch uit elke foto.
- Noem op projectpagina's waar nodig een regio in plaats van een plaats.

## Privacy

Dit is geen juridisch advies; laat het nakijken.

- Het nieuwsbriefvakje staat los van het akkoord met de voorwaarden en is standaard niet aangevinkt.
- De privacyverklaring moet worden aangepast: de huidige tekst gaat ervan uit dat wie gegevens invult akkoord is met mailings.
- Verwerkersovereenkomsten afsluiten met Supabase, Mollie, MailerSend, MailerLite en Cloudflare.
