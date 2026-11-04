# Websites Stichting Bonisa

Deze repository bevat de websites van Stichting Bonisa: eerst **jongerenzang.nl**, daarna **bonisa.nl**.
De sites zijn eigen code, zonder WordPress. Alles met persoonsgegevens staat en draait in de EU.

> Status (4 november 2026): **website en bestellen/betalen gebouwd, nog niet online.** De homepage staat in `site/`, het ticketsysteem in `supabase/`. QR-tickets en scannen volgen in fase 3.
>
> Zelf bekijken: `npm install` en daarna `npm start`, dan staat de site op http://localhost:8080.
>
> **Claude Code:** lees eerst [CLAUDE.md](CLAUDE.md).

## Waar vind je wat

| Document | Voor wie | Inhoud |
| --- | --- | --- |
| [docs/hoe-de-site-werkt.md](docs/hoe-de-site-werkt.md) | Technisch | Hoe de site in elkaar zit: mappen, bouwen, foto's, bewerkscherm |
| [docs/ticketsysteem.md](docs/ticketsysteem.md) | Technisch | Bestellen en betalen: database, functies, testen, online zetten |
| [docs/plan.md](docs/plan.md) | Iedereen | Het volledige plan: onderdelen, hoe het werkt, fases, kosten |
| [docs/beslissingen.md](docs/beslissingen.md) | Iedereen | Alle gemaakte keuzes, met datum en reden |
| [docs/beveiliging.md](docs/beveiliging.md) | Technisch + bestuur | Waar gegevens staan, maatregelen, bescherming van partners |
| [docs/beheer-met-claude.md](docs/beheer-met-claude.md) | Kantoor | Hoe je de site aanpast: zelf in het bewerkscherm, of met Claude |
| [docs/back-up.md](docs/back-up.md) | Kantoor | Wekelijkse back-up van de bestellingen tijdens de verkoop |
| [docs/open-vragen.md](docs/open-vragen.md) | Iedereen | Wat nog beslist of geregeld moet worden |
| [design/](design/) | Bouwers | Het goedgekeurde ontwerp van de jongerenzang-site 2027 |

## In het kort

- **Website:** gebouwd met Eleventy, gehost bij Cloudflare Pages.
- **Aanpassen:** kantoor werkt in het bewerkscherm Pages CMS; grotere wijzigingen via Claude, altijd eerst op een testsite.
- **Tickets:** eigen systeem met QR-tickets, betalen met iDEAL via Mollie.
- **Gegevens:** database en functies bij Supabase in Frankfurt.
- **Mail:** ticketmail via MailerSend, nieuwsbrief via MailerLite (alleen met apart vinkje).

## Belangrijkste regels

1. **Nooit wachtwoorden, sleutels of persoonsgegevens in deze repository.** Sleutels staan alleen in de instellingen van Supabase.
2. **Persoonsgegevens alleen in de EU:** opslag en verwerking van persoonsgegevens alleen in de EU (Supabase Frankfurt, Mollie, MailerLite). Geen Cloudflare-functies voor persoonsgegevens. Zie [docs/beveiliging.md](docs/beveiliging.md).
3. **Wijzigingen eerst op de testsite**, pas daarna live.
4. **Alle accounts op naam van de stichting**, met tweestapsverificatie.

## Ontwerp

Het ontwerp van de jongerenzang-site (2027, thema "Gods Koninkrijk komt!") staat in [design/](design/).
Kleuren: BYC-groen `#4C8C40` (uit het BYC-logo) en BYC-oranje `#F28C1E` (voorlopig, nog bevestigen).
Lettertypen: Bricolage Grotesque (koppen) en DM Sans (tekst).
