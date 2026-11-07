# Onderhoud en beveiliging op lange termijn

Laatst bijgewerkt: 7 november 2026.

Doel: zo weinig mogelijk zelf hoeven bijwerken. Het meeste werk ligt bij Cloudflare, Supabase en Mollie. Dit document zegt wat zij doen, wat bij ons blijft, en wanneer je wat moet nakijken.

## Wie patcht wat

| Onderdeel | Wie houdt het veilig | Wat wij doen |
| --- | --- | --- |
| Servers, netwerk, DDoS-bescherming, HTTPS-certificaten van de site | Cloudflare, automatisch | Niets. Er draait geen eigen servercode bij Cloudflare, alleen statische bestanden. Er is dus geen server om bij te werken |
| Node.js tijdens het bouwen | Cloudflare levert de versie die in `.node-version` staat | Eens per jaar het nummer ophogen (zie hieronder) |
| Eleventy en Eleventy Image (npm) | De makers | Dependabot stelt maandelijks een update voor; samenvoegen na een blik op de testversie |
| Database (Postgres), inloggen (Auth), servers van de functies, Deno | Supabase, automatisch | Grote Postgres-upgrades zelf starten in het dashboard als Supabase daarom vraagt (mail) |
| Onze functies in `supabase/functions/` | Wij | Gebruiken geen npm-pakketten (besluit 31), dus er is niets bij te werken. Alleen aanpassen als Mollie, MailerSend of MailerLite hun API veranderen; zij mailen dat ruim van tevoren |
| Betaalpagina, bankgegevens | Mollie | Niets; bankgegevens komen nooit bij ons |
| `jsQR.js` (QR lezen op de scanpagina) en `qrcode.mjs` (QR maken voor de mail) | Wij, maar vrijwel geen risico | Niets. Beide werken alleen met onze eigen QR-codes, praten met niemand en hebben geen bekende lekken. jsQR 1.4.0 is de laatste versie (sinds 2018 af). Alleen vervangen als er ooit een lek gemeld wordt |
| Supabase CLI (`npx supabase@3.0.0`) | Alleen lokaal voor testen | Ophogen als iets lokaal niet meer werkt; komt nooit online |

**Kort gezegd:** het enige dat echt veroudert, zijn Node en Eleventy, en die draaien alleen tijdens het bouwen, niet bij bezoekers. Een lek daarin raakt bezoekers dus vrijwel nooit.

## Node-versie

Cloudflare bouwt met de versie in `.node-version`: nu **24** (LTS, ondersteund tot april 2028). Node 22 stopt in april 2027, vóór de Jongerenzang; daarom is overgestapt (besluit 62).

Elk jaar in het voorjaar: kijk op [nodejs.org/en/about/previous-releases](https://nodejs.org/en/about/previous-releases) welke LTS-versie actueel is. Zet dat nummer in `.node-version`, maak een pull request en kijk of de testversie werkt.

## Automatische meldingen aanzetten (eenmalig)

| Waar | Wat aanzetten | Waarom |
| --- | --- | --- |
| GitHub → repository → Settings → Code security | **Dependabot alerts** en **Dependabot security updates** aan. Ook **Secret scanning / Push protection** als het er staat | Mail bij een lek in een npm-pakket, en een kant-en-klare pull request. `.github/dependabot.yml` stelt daarnaast maandelijks gewone updates voor |
| GitHub → je profiel → Settings → Notifications | Dependabot alerts per mail | Anders zie je ze alleen op de site van GitHub |
| Cloudflare → Notifications | Melding bij een mislukte bouw (Workers Builds) | Een update van kantoor in Pages CMS komt anders stil niet online |
| Supabase → Organization → Team | Minstens twee mensen met een eigen account | Supabase mailt over onderhoud, Postgres-upgrades en beveiligingsadvies alleen naar leden |
| Supabase → Advisors → Security Advisor | Eens per maand kijken (of na elke wijziging aan de database) | Waarschuwt bijvoorbeeld voor een tabel zonder toegangsregels |
| Mollie, MailerSend, MailerLite | Mailadres van de stichting als contact | Zij melden wijzigingen in hun API per mail |

Alle meldingen naar een algemeen adres van de stichting laten gaan, niet naar één persoon.

## Let op bij het gratis plan van Supabase

- Een gratis project wordt **gepauzeerd na een week zonder verkeer**. Buiten de ticketverkoop kan dat gebeuren; dan werken bestellen en de ticketpagina niet. Weer aanzetten kan in het dashboard. Met giften (bonisa.nl) gaan we toch naar Pro (besluit in [beveiliging.md](beveiliging.md)); dan speelt dit niet meer.
- Geen back-ups op het gratis plan: zie [back-up.md](back-up.md).
- Tweestapsverificatie (MFA) voor de inlog op `/beheer/` vraagt Supabase Pro.

## AVG: "passende maatregelen"

De AVG (artikel 32) vraagt maatregelen die passen bij het risico. Voor ons: namen, e-mailadressen, tickets en (later) giften. Geen bijzondere gegevens, maar giften aan een christelijke organisatie kunnen iets zeggen over geloof; wees daar dus extra zorgvuldig mee. De AVG geldt voor een stichting precies zoals voor een bedrijf. Wat telt: dat je de maatregelen hebt **en kunt laten zien** (artikel 5 lid 2). Dit document en [beveiliging.md](beveiliging.md) zijn dat bewijs.

**Al op orde:** gegevens in de EU, versleuteld verkeer, toegangsregels op elke tabel, alleen inloggen met uitnodiging en rol, betaalgegevens alleen bij Mollie, geen trackers, geheime sleutels alleen bij Supabase, foto's zonder GPS.

**Nog doen vóór livegang** (staat ook in beveiliging.md):

1. Verwerkersovereenkomsten afsluiten met Supabase, Mollie, MailerSend, MailerLite en Cloudflare (bij de meeste: een DPA in het dashboard accepteren).
2. Bewaartermijnen vaststellen (bestellingen, giften) en in de agenda zetten wanneer er opgeruimd wordt.
3. Een verantwoordelijke voor datalekken aanwijzen, met een vervanger.
4. Een kort verwerkingsregister: welke gegevens, waarom, hoe lang, bij wie. De tabel in beveiliging.md is een goed begin.
5. Privacyverklaring aanpassen.
6. Tweestapsverificatie op GitHub, Cloudflare, Supabase, Mollie, MailerSend en MailerLite. Juist deze accounts geven toegang tot alles.
7. In het Supabase-dashboard onder Authentication → Policies (of Providers → Email) de minimale wachtwoordlengte op **10** zetten, gelijk aan `/welkom/` en `supabase/config.toml`.

## Controlelijst per moment

**Elke maand (10 minuten)**
- Openstaande Dependabot-pull requests: testversie bekijken, samenvoegen.
- Supabase Security Advisor bekijken.

**Vóór elke ticketverkoop**
- Supabase-project actief (niet gepauzeerd)?
- Testbestelling doen met een echte betaling van een paar euro, en terugbetalen.
- Wie heeft er een beheer- of scanaccount? Oude accounts verwijderen.

**Na elk evenement**
- Bestellingen ouder dan de bewaartermijn verwijderen of anonimiseren.
- Scanaccounts van vrijwilligers verwijderen.

**Elk jaar (voorjaar)**
- Node-versie in `.node-version` bijwerken (zie boven).
- Accounts en beheerders nalopen: klopt de lijst nog? Werkt tweestapsverificatie?
- Dit document en beveiliging.md doorlezen en bijwerken.

## Waarom geen React

De interactieve delen (bestellen, scannen, beheer, giften) zijn nu ongeveer 1200 regels gewone JavaScript, zonder framework en zonder npm-pakketten in de browser. React zou betekenen: een bouwstap voor de scripts, tientallen tot honderden npm-pakketten erbij, en ieder jaar grote updates die Dependabot dan voorstelt en die soms code breken. Dat is precies het onderhoud dat we willen vermijden, en een opvolger moet dan ook React kennen.

React loont bij een app met veel schermen die steeds van elkaar afhangen. Dat hebben wij niet: het zijn losse formulieren en lijsten. Alles wat "reageert" (prijs bijwerken, tickets tonen, scannen, de beheerlijst) werkt al zonder framework. Besluit: geen React (besluit 63). Wordt een pagina ooit echt te ingewikkeld, kijk dan eerst naar een kleine oplossing voor alleen die pagina.
