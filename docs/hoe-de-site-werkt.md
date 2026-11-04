# Hoe de site werkt

Voor het technisch aanspreekpunt (Hugo) en een opvolger. Laatst bijgewerkt: 4 november 2026.

Dit document legt uit hoe jongerenzang.nl in elkaar zit, waarom het zo gebouwd is, en wat je moet doen bij de meest voorkomende klussen. Voor kantoor is er [beheer-met-claude.md](beheer-met-claude.md).

## 1. Het idee in één alinea

De site is een **statische site**: kant-en-klare HTML-bestanden, zonder database en zonder server die bij elk bezoek iets uitrekent. Eleventy maakt die bestanden één keer, bij het bouwen, uit drie soorten bronnen: **sjablonen** (de opmaak), **datafiles** (de inhoud) en **assets** (stijl, foto's, lettertypen). Cloudflare zet het resultaat online. Daardoor is er weinig dat kapot kan gaan, weinig dat bijgewerkt moet worden en weinig om aan te vallen.

```
site/_data/*.json  (inhoud)    ─┐
site/_includes/*.njk (opmaak)  ─┼──>  Eleventy  ──>  _site/  (HTML, CSS, foto's)  ──>  Cloudflare
site/assets/ (css, foto's...)  ─┘      (bouwen)        (wordt niet bewaard in git)        (online)
```

## 2. De mappen

```
/
├── eleventy.config.js     instellingen van Eleventy (filters, foto's, mappen)
├── package.json           welke pakketten nodig zijn en de opdrachten npm start / npm run build
├── package-lock.json      de exacte versies van die pakketten (niet met de hand aanpassen)
├── .node-version          welke Node-versie Cloudflare gebruikt (22)
├── .pages.yml             welke velden kantoor ziet in het bewerkscherm
├── wrangler.jsonc         instellingen voor Cloudflare: serveer de map _site (zie hieronder)
├── .gitignore             wat níet in git komt
├── site/                  alles waar de website uit gemaakt wordt
│   ├── index.njk          de homepage: zet de blokken onder elkaar
│   ├── 404.njk            pagina "bestaat niet"
│   ├── robots.njk         robots.txt (zoekmachines aan of uit)
│   ├── _headers.njk       beveiligingsregels voor Cloudflare (wordt _headers)
│   ├── tickets/           bestelpagina, bedankpagina en ticketpagina (zie ticketsysteem.md)
│   ├── scan.njk           scanpagina voor de deur (/scan/)
│   ├── beheer.njk         beheerpagina voor kantoor (/beheer/)
│   ├── _includes/
│   │   ├── base.njk       het basissjabloon: <head>, menu, footer, ronde knop
│   │   ├── iconen.njk     de iconen van de themakaarten
│   │   └── blokken/       één bestand per onderdeel van de homepage
│   ├── _data/             de inhoud, één JSON-bestand per onderdeel
│   └── assets/
│       ├── css/site.css   alle opmaak, met de kleuren als variabelen bovenaan
│       ├── js/            menu.js (uitklapmenu) en de scripts van de ticketpagina's; vendor/jsQR.js leest QR-codes
│       ├── fonts/         Bricolage Grotesque en DM Sans (+ licenties)
│       ├── img/           de originele foto's (worden nooit zo gepubliceerd)
│       └── docs/          de pdf's (voorwaarden, privacy, disclaimer)
├── supabase/              het ticketsysteem: database, functies, tests (zie ticketsysteem.md)
├── design/                het ontwerp, alleen ter referentie
└── docs/                  documentatie
```

`_site/`, `node_modules/` en `.cache/` staan in `.gitignore`. Die maak je altijd opnieuw: `node_modules/` met `npm install`, `_site/` en `.cache/` met `npm run build`. Waarom de gebouwde site niet in git hoort: Cloudflare bouwt hem zelf uit de bronbestanden bij elke wijziging. Zou je `_site/` ook bewaren, dan heb je twee versies van dezelfde site die uit elkaar kunnen lopen, en elke foto drie keer in de geschiedenis.

### Cloudflare

Cloudflare bouwt de site bij elke push naar GitHub (`npm run build`) en zet de map `_site/` online (`npx wrangler deploy`). `wrangler.jsonc` vertelt Cloudflare welke map dat is, dat `/beheer` doorstuurt naar `/beheer/`, en dat onbekende adressen de 404-pagina krijgen. Er draait geen eigen code bij Cloudflare.

Variabelen voor het bouwen (`FUNCTIES_URL`, `SUPABASE_PUBLIEKE_SLEUTEL`, eventueel `EVENEMENT`) staan in Cloudflare onder **Settings → Build → Build variables and secrets**. Na het wijzigen ervan: opnieuw bouwen.

Zelf controleren hoe Cloudflare de site serveert, met de beveiligingsregels: `npm run build` en daarna `npx wrangler dev`.

## 3. Zelf draaien

Eenmalig: Node.js (versie 20 of hoger) installeren, dan in de map Website:

```
npm install
```

Daarna, elke keer:

```
npm start
```

De site staat dan op http://localhost:8080 en ververst vanzelf als je een bestand opslaat. `Ctrl+C` stopt hem. `npm run build` bouwt de site eenmalig in `_site/` zonder testserver; dat is precies wat Cloudflare doet.

## 4. Van datafile naar pagina

Elk JSON-bestand in `site/_data/` is in de sjablonen beschikbaar onder zijn bestandsnaam. Een voorbeeld:

`site/_data/evenement.json`:
```json
{ "titel": "Gods Koninkrijk komt!", "datum": "2027-05-21", ... }
```

`site/_includes/blokken/hero.njk`:
```html
<h1>{{ evenement.titel }}</h1>
<strong>D.V. {{ evenement.datum | datumLang }}</strong>
```

wordt:
```html
<h1>Gods Koninkrijk komt!</h1>
<strong>D.V. vrijdag 21 mei 2027</strong>
```

`{{ ... }}` zet een waarde in de pagina. Het stuk na `|` is een **filter** die de waarde omzet. De eigen filters staan in `eleventy.config.js`:

| Filter | Doet | Voorbeeld |
| --- | --- | --- |
| `datumLang` | datum voluit, Nederlands | `2027-05-21` → vrijdag 21 mei 2027 |
| `datumKort` | zonder jaar | → vrijdag 21 mei |
| `euro` | bedrag | `4.5` → € 4,50 |
| `klein` | kleine letters | `Recht` → recht |
| `renderContent("md")` | markdown naar HTML (van Eleventy zelf) | `**vet**` → **vet** |

Verder gebruiken de sjablonen `{% if %}` (iets alleen tonen als het ingevuld is) en `{% for %}` (een lijst herhalen, zoals de hosts of de shirts). Daardoor kan kantoor bijvoorbeeld een musicus toevoegen zonder dat iemand de opmaak aanraakt.

Waarom datum en prijs als "kale" waarde (`2027-05-21`, `4.5`) en niet als tekst? Dan rekent de site zelf de weekdag en de notatie uit. Volgend jaar vult kantoor alleen `2028-05-19` in en klopt "vrijdag" vanzelf, ook in de oranje balk onderaan.

Eén afgeleide waarde staat in een JavaScript-datafile: `site/_data/ticketknop.js`. Die kijkt naar de schakelaar `tickets.verkoopOpen` en bepaalt waar alle ticketknoppen heen gaan:

| Verkoop open? | Knoppen | Ronde knop rechtsonder |
| --- | --- | --- |
| Nee | "Tickets", naar het ticketblok op de homepage | Verborgen |
| Ja | "Bestel je ticket", naar `tickets.link` | Zichtbaar |

## 5. Opmaak

Alle opmaak staat in `site/assets/css/site.css`. Het ontwerp gebruikte inline `style="..."` op elk element; dat is omgezet naar klassen met Nederlandse namen (`.knop`, `.kaart`, `.mozaiek`). Twee redenen: één plek om iets te veranderen, en de beveiligingsregel (CSP) staat geen inline stijlen toe.

Bovenaan staan de **ontwerpwaarden** als variabelen. Alleen groen en oranje zijn echte kleuren; de tinten worden daaruit berekend met `color-mix()`, net als in het ontwerp. Wordt het BYC-oranje straks officieel een andere kleur, dan pas je alleen `--oranje` aan en volgen alle tinten.

Maten die op een telefoon te groot zijn (de titel van 88 px bijvoorbeeld) gebruiken `clamp(min, voorkeur, max)`: ze schalen mee met de schermbreedte en blijven tussen een minimum en het ontwerpmaximum.

**Contrast** (gecontroleerd, WCAG): gewone tekst minstens 4,5:1. Eén uitzondering uit het ontwerp: witte tekst op BYC-groen is 4,1:1. Dat mag alleen voor grote tekst (de Bijbeltekst, 26–38 px), want daarvoor is 3:1 genoeg. Gebruik wit op `--groen` dus niet voor kleine tekst; gebruik dan `--groen-donker` (6,4:1).

Het **menu** klapt op schermen smaller dan 1080 px in achter een knop "Menu". Dat doet `menu.js`. Zonder JavaScript staat het menu gewoon open, zodat de site altijd werkt.

## 6. Foto's

Je zet in een sjabloon gewoon `<img src="/assets/img/foto.jpg" alt="...">`. Bij het bouwen vervangt Eleventy Image (`@11ty/eleventy-img`) elke `<img>` automatisch door:

- drie formaten (480, 960 en 1600 pixels breed), zodat een telefoon geen foto van 1600 pixels hoeft te laden;
- elk formaat in WebP (klein) en in het oorspronkelijke formaat (voor oude browsers);
- **zonder metagegevens**: EXIF, GPS-plek, cameramerk en naam van de fotograaf gaan eruit.

Het `sizes`-attribuut vertelt de browser hoe breed de foto op het scherm wordt, zodat hij het juiste formaat kiest. De originelen in `site/assets/img/` komen nooit zelf online.

Twee dingen om op te letten:

1. Laat nooit de map `site/assets/img` met `addPassthroughCopy` meekopiëren. Dan staan de originelen, mét GPS-gegevens, alsnog online.
2. De verkleinde foto's worden bewaard in `.cache/`, zodat de volgende bouw sneller is.

## 7. Het bewerkscherm (Pages CMS)

Pages CMS is een bewerkscherm dat rechtstreeks in de GitHub-repository werkt. Het leest `.pages.yml` en toont per datafile een formulier. Slaat kantoor op, dan maakt Pages CMS een commit in GitHub, en Cloudflare bouwt en publiceert de site opnieuw.

In `.pages.yml`:

- `media`: waar geüploade foto's en pdf's terechtkomen (`site/assets/img`, `site/assets/docs`).
- `components`: velden die vaker voorkomen (een foto, een fotobeschrijving, een persoon).
- `content`: per datafile de velden, met een Nederlands label en waar nodig een uitleg.

Een fotobeschrijving (`alt`) is verplicht: zonder kan kantoor niet opslaan. Tijden worden gecontroleerd op de vorm `19:45`.

**Regel:** voeg je een veld toe aan een datafile, voeg het dan ook toe aan `.pages.yml`. Anders ziet kantoor het niet. Andersom: een veld in `.pages.yml` dat niet in het sjabloon gebruikt wordt, doet niets.

We gebruiken de online versie op [app.pagescms.org](https://app.pagescms.org) (besluit 48). Daar draait niets van onszelf, dus er is geen server om bij te houden.

**Eenmalig instellen** (door de beheerder van de GitHub-repository):

1. Ga naar app.pagescms.org en kies **Sign in with GitHub**.
2. Installeer de GitHub-app van Pages CMS en geef hem **alleen** toegang tot de repository `Bonisa-Youth-Club` ("Only select repositories").
3. Open de repository en kies de branch `main`. Links staan nu de onderdelen uit `.pages.yml`.
4. Collega's van kantoor nodig je uit onder **Settings → Collaborators**, met hun e-mailadres. Zij hebben geen GitHub-account nodig.

**Hoe een wijziging online komt:** kantoor klikt op **Save**. Pages CMS maakt dan een commit op `main` met een bericht als `chore(inhoud): evenement.json aangepast via Pages CMS` (`settings.commit` in `.pages.yml`). Cloudflare bouwt de site opnieuw; na ongeveer een minuut staat de wijziging online. Inhoud gaat dus wel rechtstreeks naar `main`; code gaat altijd via een pull request.

**Let op bij nieuwe velden:** Pages CMS schrijft bij het opslaan alleen de velden die in `.pages.yml` staan. Een veld dat wel in een datafile staat maar niet in `.pages.yml`, verdwijnt bij de eerste keer opslaan. Zet een nieuw veld dus altijd in allebei.

## 8. Beveiliging en privacy van de site zelf

- `site/_headers.njk` (wordt `_headers`) geeft Cloudflare beveiligingsregels mee. De belangrijkste is de **Content-Security-Policy**: de browser laadt alleen bestanden van de eigen site. Komt er ooit een ingesloten video, kaart of formulier van een andere dienst bij, dan moet die dienst hier worden toegestaan, en eerst in `beveiliging.md` staan.
- De lettertypen staan in de eigen site in plaats van bij Google Fonts. Google Fonts zou het IP-adres van elke bezoeker naar Google sturen.
- Tot livegang staat `zichtbaarVoorZoekmachines` uit: elke pagina krijgt `noindex` en `robots.txt` weert alle zoekmachines. Bij livegang zet kantoor of Hugo dit aan in het bewerkscherm.

## 9. Veelvoorkomende klussen

| Klus | Hoe |
| --- | --- |
| Tekst, foto, datum of prijs aanpassen | Bewerkscherm, of het JSON-bestand in `site/_data/` |
| Ticketverkoop openzetten | Bewerkscherm → Evenement → Tickets → "Ticketverkoop is open" aan, met als link `/tickets/`. Het evenement moet ook in de database staan (ticketsysteem.md §5) |
| Nieuw jaar | Evenement (label, thema, datum), Thema (Bijbeltekst, kaarten), Terugblik (foto's), Bonisa (collecteproject, projecten), Hosts en musici |
| Kleur aanpassen | `--groen` of `--oranje` bovenaan `site.css` |
| Nieuw blok op de homepage | Nieuw bestand in `site/_includes/blokken/`, een `{% include %}` in `site/index.njk`, een datafile in `site/_data/`, en de velden in `.pages.yml` |
| Pakketten bijwerken | `npm outdated` laat zien wat er nieuw is. `npm update` voor kleine updates; bij een nieuwe hoofdversie (bijv. Eleventy 4) eerst de release notes lezen en lokaal testen |

## 10. Afhankelijkheden

Bewust zo weinig mogelijk (besluit 24):

| Pakket | Waarvoor |
| --- | --- |
| `@11ty/eleventy` | Bouwt de site |
| `@11ty/eleventy-img` | Verkleint foto's en haalt EXIF/GPS eruit |

Er draait geen JavaScript-framework in de browser. Scripts: `menu.js` (ruim 20 regels) en op de ticketpagina's `bestellen.js`, `bedankt.js`, `mijn-tickets.js`, `inloggen.js`, `scan.js` en `beheer.js`. Eén bibliotheek in eigen beheer: `vendor/jsQR.js` (besluit 40). Het ticketsysteem zelf gebruikt geen npm-pakketten (besluit 31); de Supabase CLI start je met `npx` (besluit 36).
