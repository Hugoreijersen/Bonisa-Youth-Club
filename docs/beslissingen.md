# Beslissingen

Elke keuze met datum, wie besliste en waarom. Nieuwe beslissing? Voeg onderaan een regel toe; verander oude regels niet, maar zet er een nieuwe onder die de oude vervangt.

Status: **besloten** of **voorstel** (nog bevestigen).

| # | Datum | Beslissing | Status | Waarom | Door |
| --- | --- | --- | --- | --- | --- |
| 1 | 2026-11-03 | Weg van WordPress; eigen code met een sitegenerator | besloten | Minder afhankelijk van één bouwer | Hugo |
| 2 | 2026-11-03 | Kantoor past inhoud aan via een bewerkscherm (Pages CMS) | besloten | Zelfstandig teksten en foto's wijzigen zonder code | Hugo |
| 3 | 2026-11-03 | Eigen ticketsysteem met QR-tickets en scannen bij de deur | besloten | Geld besparen op ticketplatform | Hugo |
| 4 | 2026-11-03 | Betalen via Mollie (iDEAL) | besloten | Nederlands, Nederlandstalige support, alleen kosten per betaling | Hugo |
| 5 | 2026-11-03 | Nieuwsbrief blijft voorlopig MailerLite | besloten | Wordt al gebruikt; kan later wisselen | Hugo |
| 6 | 2026-11-03 | Database en functies: Supabase, regio Frankfurt; Pro ($25/mnd) zodra nodig | besloten | Standaard Postgres, ingebouwde login, functies vast te zetten op de EU | Hugo |
| 7 | 2026-11-03 | Niets in Azië: hosting volledig Europees (statichost.eu, Zweden) | besloten | Geen opslag of uitvoering in Azië, ook geen kopieën van pagina's | Hugo |
| 8 | 2026-11-03 | Ticketsysteem geschikt voor meerdere evenementen | besloten | Later ook events.bonisa.nl | Hugo |
| 9 | 2026-11-03 | Bonisa neemt een Claude Team-abonnement (non-profitkorting) voor grotere wijzigingen | voorstel | Geen bouwer nodig voor nieuwe blokken en pagina's | Hugo |
| 10 | 2026-11-03 | Ticketprijs jongerenzang 2027: € 4,50 | besloten | | Hugo |
| 11 | 2026-11-03 | Sitegenerator: Astro | voorstel | Goed ondersteund door Pages CMS; zowel losse pagina's als overzichten (nieuws, projecten) | Claude |
| 12 | 2026-11-03 | Ticketmail via MailerSend | voorstel | MailerLite verstuurt geen mails per bestelling | Claude |
| 13 | 2026-11-03 | Webshop bonisa.nl (fase 2): bestaande Europese dienst inbouwen | voorstel | Zelf bouwen is het meeste werk en maakt afhankelijk | Claude |
| 14 | 2026-11-03 | Repository voorlopig lokaal in de map Website; later naar GitHub | besloten | De naam `bonisa` op GitHub is bezet | Hugo |
| 15 | 2026-11-04 | **Vervangt 7.** Hosting: Cloudflare Pages. Openbare pagina's mogen wereldwijd (ook Azië) gecachet worden; persoonsgegevens blijven alleen in de EU | besloten | Gemak: gratis, testversie per wijziging, bescherming tegen aanvallen. Openbare pagina's bevatten geen persoonsgegevens | Hugo |
| 16 | 2026-11-04 | **Vervangt 11.** Sitegenerator: Eleventy | voorstel | Sjablonen zijn gewone HTML, dicht bij het ontwerp; lichtst en minst onderhoud | Claude |
| 17 | 2026-11-04 | Geen Cloudflare-functies (Workers) voor persoonsgegevens; alle functies bij Supabase in Frankfurt | besloten | Gevolg van 15: persoonsgegevens alleen in de EU verwerken | Hugo |
| 18 | 2026-11-04 | Bouwen kan lokaal en met tijdelijke testaccounts; vóór livegang alles overzetten naar accounts en repositories op naam van de stichting | besloten | Accounts regelen hoeft de bouw niet op te houden. GitHub-repositories en Supabase-projecten kunnen naar een andere organisatie worden overgezet; Mollie moet altijd op naam van de stichting (geld gaat naar haar rekening) | Hugo |
| 19 | 2026-11-04 | Technisch aanspreekpunt: Hugo. Alles wordt zo gedocumenteerd dat een opvolger het zonder Hugo kan overnemen | besloten | | Hugo |
| 20 | 2026-11-04 | Supabase: tijdens de bouw gratis; Pro alleen in de maanden van de ticketverkoop; jaarrond Pro zodra bonisa.nl giften verwerkt. Eén Supabase-project voor alle Bonisa-sites | voorstel | Bespaart kosten: ca. $75 per jaar zolang alleen de jongerenzang draait | Claude |
| 21 | 2026-11-04 | Wekelijkse eigen export van bestellingen en tickets tijdens de verkoop, volgens docs/back-up.md | besloten | Het gratis plan maakt geen back-ups | Hugo |
| 22 | 2026-11-04 | Supabase-project tijdens de bouw in Hugo's eigen organisatie, alleen met testgegevens; vóór livegang overzetten naar een organisatie van Bonisa | besloten | Supabase kan projecten tussen organisaties overzetten; regio (Frankfurt) blijft gelijk | Hugo |
| 23 | 2026-11-04 | **Bevestigt 16.** Sitegenerator: Eleventy | besloten | Sjablonen blijven gewone HTML, dicht bij het ontwerp; weinig onderhoud | Hugo |
| 24 | 2026-11-04 | Twee npm-pakketten: `@11ty/eleventy` (bouwt de site) en `@11ty/eleventy-img` (verkleint foto's, maakt WebP en haalt EXIF/GPS eruit) | besloten | Foto's zonder locatiegegevens is een harde regel; dit doet het automatisch bij elke bouw, ook voor foto's die kantoor uploadt | Claude |
| 25 | 2026-11-04 | Lettertypen (Bricolage Grotesque, DM Sans) in eigen beheer in `site/assets/fonts`, niet via Google Fonts | besloten | Google Fonts stuurt het IP-adres van elke bezoeker naar Google (VS). Eigen bestanden: geen gegevens naar derden, en een strenge beveiligingsregel (CSP) is mogelijk. Licentie: SIL Open Font License | Claude |
| 26 | 2026-11-04 | Alle inhoud van de homepage staat als JSON in `site/_data/`, één bestand per onderdeel; geen map `site/content/` | besloten | Eén soort bestand is eenvoudiger voor kantoor en opvolger. Pages CMS bewerkt elk bestand als formulier | Claude |
| 27 | 2026-11-04 | Schakelaar "Ticketverkoop is open" in het bewerkscherm. Uit: knoppen gaan naar het ticketblok en de ronde knop is verborgen | besloten | De site kan online vóórdat het ticketsysteem (fase 2–4) klaar is | Claude |
| 28 | 2026-11-04 | Zoekmachines worden geweerd (`noindex`, `robots.txt`) tot de schakelaar "Zichtbaar in Google" aangaat bij livegang | besloten | Testversies mogen niet in Google komen | Claude |
| 29 | 2026-11-04 | Bestellen en betalen (fase 2) nu bouwen in plaats van januari, zodat de backend klaar is vóór de bouw van bonisa.nl (vanaf 25 november) | besloten | Daarna alleen nog een voorkant voor bonisa.nl; alles in één keer verhuizen naar de accounts van de stichting | Hugo |
| 30 | 2026-11-04 | Mollie later aansluiten. Tijdens de bouw test een nagebootste Mollie (`supabase/tests/nep-diensten.mjs`); aansluiten is daarna alleen de sleutel `MOLLIE_API_KEY` in Supabase | besloten | Een eigen Mollie-account lukte niet; het account moet toch op naam van de stichting | Hugo |
| 31 | 2026-11-04 | Functies gebruiken geen npm-pakketten (geen `supabase-js`, geen Mollie-pakket), alleen `fetch` | besloten | Niets om bij te werken of dat kan breken; de functies zijn klein genoeg | Claude |
| 32 | 2026-11-04 | Een onbetaalde bestelling houdt de plaatsen 30 minuten vast | besloten | Genoeg tijd om bij Mollie te betalen, zonder dat plaatsen lang bezet blijven | Claude |
| 33 | 2026-11-04 | Tegen misbruik: verborgen spamveld en maximaal 5 bestellingen per e-mailadres per uur. Maximum per bestelling instelbaar per evenement (nu 10) | voorstel | Geen captcha van een derde partij nodig | Claude |
| 34 | 2026-11-04 | De bestelpagina werkt ook zonder JavaScript (gewoon formulier dat doorstuurt naar Mollie) | besloten | Toegankelijk en robuust; JavaScript voegt alleen de teller en het totaal toe | Claude |
| 35 | 2026-11-04 | Het bedrag dat mensen betalen staat in de database (`events.prijs_cent`); de prijs in het bewerkscherm is alleen om te tonen | besloten | Bedragen altijd op de server (beveiliging.md). De bestelpagina toont de prijs uit de database | Claude |
| 36 | 2026-11-04 | Supabase CLI via `npx supabase@3.0.0`, vastgezet op één versie en niet als npm-pakket in de repository | besloten | Alleen nodig voor wie aan het ticketsysteem werkt; geen extra afhankelijkheid voor de site | Claude |
| 37 | 2026-11-04 | `_headers` wordt gebouwd uit `site/_headers.njk`, zodat het adres van de functies uit de instelling `FUNCTIES_URL` komt | besloten | Testsite en echte site gebruiken een ander Supabase-adres | Claude |
| 38 | 2026-11-04 | **Vult 18 en 22 aan.** De hele website wordt nu gebouwd zoals hij uiteindelijk moet worden, in accounts van Hugo (Cloudflare, Supabase, GitHub). Inrichten op naam van de stichting gebeurt achteraf. De ticketverkoop start later | besloten | Accounts kunnen achteraf goed worden ingericht; de bouw hoeft daar niet op te wachten | Hugo |
| 39 | 2026-11-04 | Mollie: het bestaande account van Bonisa (nu alleen de webshop) krijgt een extra websiteprofiel voor jongerenzang.nl; later ook een voor de giften op bonisa.nl | voorstel | Eén account voor de stichting: geld komt op dezelfde rekening, één overzicht voor kantoor. Per websiteprofiel een eigen sleutel | Claude |
| 40 | 2026-11-04 | Twee kleine bibliotheken in eigen beheer (geen npm-pakket): qrcode-generator 2.0.4 (MIT) maakt de QR-codes, jsQR 1.4.0 (Apache-2.0) leest ze met de camera | besloten | QR-codes zelf maken en lezen is foutgevoelig; beide zijn veelgebruikt, staan los in de repository en hoeven nooit bijgewerkt te worden | Claude |
| 41 | 2026-11-04 | QR-codes in de mail als GIF-afbeelding in de mail zelf, plus een link naar een persoonlijke ticketpagina (`/tickets/mijn/#<geheim>`) | besloten | Werkt in alle mailprogramma's en zonder internet bij de deur; de pagina is handig om tickets door te sturen of te printen | Claude |
| 42 | 2026-11-04 | Scan- en beheerpagina: inloggen met e-mail en wachtwoord (Supabase Auth). Accounts alleen via kantoor op `/beheer/`; zelf aanmelden staat uit | besloten | Geen mailkoppeling nodig voor inlogcodes; kantoor regelt zelf wie mag scannen | Claude |
| 43 | 2026-11-04 | De scanpagina toont alleen de voornaam en "ticket x van y" | besloten | Genoeg om bij de deur te helpen; zo min mogelijk persoonsgegevens op telefoons van vrijwilligers | Claude |
| 44 | 2026-11-04 | Evenement instellen (prijs, aantal tickets, start verkoop) op `/beheer/` in plaats van in de SQL Editor | besloten | Kantoor kan het zelf, zonder technische kennis | Claude |
