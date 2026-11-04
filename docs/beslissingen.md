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
