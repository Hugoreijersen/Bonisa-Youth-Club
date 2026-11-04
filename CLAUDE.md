# CLAUDE.md

Context voor Claude (en andere bouwers) die in deze repository werken.

## Wat dit is

De websites van Stichting Bonisa, een christelijke zendingsorganisatie uit Lisse. Eerst **jongerenzang.nl** (Katwijkse Jongerenzang, D.V. vrijdag 21 mei 2027, thema "Gods Koninkrijk komt! – Met recht, vrede en blijdschap"), daarna **bonisa.nl**.

Opdrachtgever en technisch aanspreekpunt: Hugo (Bonisa Youth Club). Beheer na oplevering: kantoor van Bonisa, niet-technisch. Documenteer alles zo dat een opvolger van Hugo het zonder hem kan overnemen.

Tijdens de bouw: lokaal en met testaccounts (Mollie-testmodus). Accounts op naam van de stichting volgen vóór livegang (besluit 18).

## Lees eerst

1. `docs/plan.md`: het plan, gegevensmodel, mappenstructuur, fases
2. `docs/beslissingen.md`: gemaakte keuzes; nieuwe keuzes hier toevoegen
3. `docs/beveiliging.md`: harde regels over gegevens en locatie
4. `design/README.md`: het ontwerp en de ontwerpregels
5. `docs/open-vragen.md`: wat nog openstaat

## Techniek

- Sitegenerator: **Eleventy 3** (besluit 23). Sjablonen in gewone HTML (Nunjucks), zo dicht mogelijk bij `design/`. Uitleg van de opbouw: `docs/hoe-de-site-werkt.md`.
- Hosting: **Cloudflare Workers, alleen statische bestanden** (besluit 45). Instellingen in `wrangler.jsonc`; er draait geen Worker-code. Variabelen voor de bouw staan in Cloudflare onder Settings → Build → Build variables and secrets.
- Bewerkscherm: **Pages CMS**, configuratie in `.pages.yml`. Alles wat kantoor moet kunnen aanpassen (teksten, foto's, datum, prijs, hosts, musici, shirts) staat als JSON in `site/_data/` (één bestand per onderdeel, besluit 26), niet in sjablonen. Nieuw veld in een datafile? Voeg het ook toe aan `.pages.yml`.
- Database en functies: **Supabase, regio Frankfurt (`eu-central-1`)**. Functies altijd vastzetten op die regio. Code in `supabase/`; uitleg in `docs/ticketsysteem.md`. Functies zonder npm-pakketten (besluit 31).
- Betalen: **Mollie** (iDEAL), betalen op de pagina van Mollie.
- Mail: MailerSend (ticketmail), MailerLite (nieuwsbrief, alleen met vinkje). Beide via `fetch` in `supabase/functions/_shared/`.

## Opdrachten

- `npm install`: eenmalig, installeert Eleventy
- `npm start`: testversie op http://localhost:8080, ververst bij elke wijziging
- `npm run build`: bouwt de site in `_site/` (dit doet Cloudflare ook)
- `npm run db:start` / `db:stop` / `db:reset`: lokale Supabase (Docker nodig)
- `npm run functies`: de functies lokaal (eerst `supabase/functions/.env.example` kopiëren naar `.env.local`)
- `npm run nep`: nagebootste Mollie, MailerSend en MailerLite (mails op http://localhost:54399/mails)
- `npm run test:tickets`: alle tests van het ticketsysteem

## Harde regels

- **Persoonsgegevens alleen in de EU.** Geen Cloudflare Workers/Functions voor iets met persoonsgegevens. Geen nieuwe dienst zonder eerst de locatie in `docs/beveiliging.md` te zetten.
- **Geen geheimen in de repository.** Sleutels alleen in de instellingen van Supabase. `.env` staat in `.gitignore`.
- **Mollie-meldingen altijd nacontroleren** bij de Mollie API; bedragen altijd op de server berekenen.
- **Foto's:** EXIF/GPS-gegevens altijd verwijderen bij het bouwen (gebeurt automatisch voor elke `<img>` via Eleventy Image; nooit originele foto's los meekopiëren naar `_site`). Geen herkenbare partners in Azië publiceren.
- **Geen externe bronnen:** geen lettertypen, scripts of trackers van andere domeinen; de CSP in `site/_headers.njk` blokkeert ze. Geen `style=""` in sjablonen: alle opmaak in `site/assets/css/site.css`.
- **Toegankelijk:** echte `<button>`, `<a>`, `<label>`; contrast minimaal 4,5:1; aanraakdoelen ≥ 44 px; werkt op telefoonbreedte.
- **Eenvoud boven slimheid:** zo min mogelijk afhankelijkheden. Elke nieuwe npm-dependency moet een reden hebben in `docs/beslissingen.md`.

## Werkwijze

- Wijzigingen via een branch en pull request; Cloudflare maakt per pull request een testversie. Nooit direct op `main`.
- Documentatie bijwerken in dezelfde pull request als de code.
- Commitberichten volgens [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/): `type(scope): omschrijving`, bijvoorbeeld `feat(tickets): bestelformulier`, `fix(css): menu op telefoon`, `docs: uitleg back-up`. Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- Schrijf documentatie voor kantoor in eenvoudig Nederlands; code-commentaar mag Engels.
- Taal van de site: Nederlands. "D.V." voor toekomstige datums.

## Status

4 november 2026:
- Fase 1 gebouwd: de homepage van jongerenzang.nl in Eleventy, met `.pages.yml` voor Pages CMS.
- Fase 2 gebouwd en lokaal getest: bestellen en betalen (`supabase/`, `site/tickets/`), met een nagebootste Mollie. Nog geen echte Mollie (besluit 30).
- Fase 3 gebouwd en lokaal getest: ticketmail met QR-codes, ticketpagina `/tickets/mijn/`, scanpagina `/scan/`, beheerpagina `/beheer/`, nieuwsbrief naar MailerLite.
- Nog niets online. Volgende stap: online zetten in Hugo's accounts (besluit 38); vanaf 25 november de voorkant van bonisa.nl.
