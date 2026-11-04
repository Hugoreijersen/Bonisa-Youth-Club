# Plan: eigen websites Bonisa en Jongerenzang

Laatst bijgewerkt: 4 november 2026. Het overleg-exemplaar van dit plan staat als document in Claude; dit bestand is de versie in de repository.

## 1. Doel

- Een eigen website voor de Katwijkse Jongerenzang (21 mei 2027), met eigen ticketverkoop.
- Daarna (fase 2) de hele site van bonisa.nl op dezelfde basis, in de huidige huisstijl maar moderner.
- Kantoor past de inhoud zelf aan. Alleen voor groot onderhoud is iemand technisch nodig.
- Alles met persoonsgegevens staat en draait in de EU. Openbare pagina's mogen wereldwijd (ook in Azië) gecachet worden; zie [beveiliging.md](beveiliging.md).
- Zo min mogelijk afhankelijk van één bouwer: accounts, code en uitleg liggen bij de stichting.

## 2. Gemaakte keuzes

| Onderdeel | Keuze | Waarom |
| --- | --- | --- |
| Website | Sitegenerator Eleventy, gehost bij Cloudflare Pages | Gratis, snel, automatische testversie per wijziging, sterke bescherming tegen aanvallen |
| Aanpassen | Pages CMS (zelf gehost in de EU), gekoppeld aan deze repository | Kantoor wijzigt tekst en foto's in velden; de opmaak staat vast |
| Grotere wijzigingen | Claude (Team-abonnement, non-profitkorting), via de testsite | Geen bouwer nodig voor nieuwe blokken of pagina's |
| Tickets | Eigen systeem met QR-tickets, voor meerdere evenementen | Geen kosten per ticket aan een ticketplatform |
| Betalen | Mollie (iDEAL) | Nederlands, €0,32 per iDEAL-betaling, geen kosten per ticket |
| Database en functies | Supabase, regio Frankfurt | Postgres (standaard), ingebouwde login, functies vast te zetten op Frankfurt |
| Ticketmail | MailerSend (voorstel) | MailerLite verstuurt geen automatische mails per bestelling |
| Nieuwsbrief | MailerLite (huidig, kan wisselen) | Aanmeldingen staan in Supabase; overstappen = één koppeling aanpassen |

Zie [beslissingen.md](beslissingen.md) voor datum en reden per keuze.

## 3. Hoe het werkt

```
Kantoor ──> Pages CMS ──> GitHub (code + teksten) ──publiceert──> Cloudflare Pages (website)
                                                                        │
Bezoeker ──bekijkt en bestelt──────────────────────────────────────────┘
                                                                        │ bestelformulier
                                                                        v
                         Mollie (iDEAL) <──betaalt──> Functies (Supabase, Frankfurt)
                                                                        │
Scanpagina (deur) <──geldig?──> Database (Supabase, Frankfurt) ──stuurt──> MailerSend (ticketmail met QR)
                                                                        │
                                                    alleen met vinkje   v
                                                                   MailerLite (nieuwsbrief)
```

### Route van een bestelling

1. De bezoeker vult het formulier in: naam, e-mail, woonplaats, aantal tickets, eventueel het nieuwsbriefvakje.
2. Functie `create-order` (Supabase, Frankfurt) slaat de bestelling op als `open` en maakt een betaling aan bij Mollie.
3. De bezoeker betaalt met iDEAL bij Mollie.
4. Mollie meldt de betaling aan functie `mollie-webhook`. Die vraagt de status zelf na bij Mollie (nooit de melding blind vertrouwen), zet de bestelling op `betaald` en maakt per ticket een unieke QR-code.
5. MailerSend stuurt de bevestigingsmail met de QR-tickets.
6. Is het nieuwsbriefvakje aangevinkt, dan gaat het adres naar MailerLite.
7. Bij de deur scannen vrijwilligers de QR-code op de scanpagina (alleen na inloggen). Die controleert of het ticket geldig en nog ongebruikt is.

### Route van een tekstwijziging

1. Kantoor past in Pages CMS een tekst of foto aan.
2. Pages CMS slaat dat op in GitHub.
3. Cloudflare Pages bouwt de site opnieuw met Eleventy en zet hem binnen een paar minuten online.

## 4. Gegevensmodel (eerste opzet)

| Tabel | Belangrijkste velden | Opmerking |
| --- | --- | --- |
| `events` | naam, datum, locatie, prijs (in centen), max_tickets, max_per_bestelling, verkoop_open_vanaf, verkoop_dicht_op | Meerdere evenementen mogelijk (later ook events.bonisa.nl) |
| `orders` | event_id, voornaam, achternaam, e-mail, telefoon, woonplaats, aantal, bedrag, status (`open`/`betaald`/`mislukt`/`terugbetaald`), mollie_payment_id, nieuwsbrief (ja/nee), aangemaakt_op | Persoonsgegevens: bewaartermijn instellen |
| `tickets` | order_id, code (lang en willekeurig), gescand_op, gescand_door | Eén rij per ticket |
| `beheerders` | gebruiker, rol (`kantoor`/`scanner`) | Koppeling met de ingebouwde login van Supabase |

Toegangsregels (Row Level Security) op alle tabellen: bezoekers kunnen niets lezen; alleen de functies schrijven.

## 5. Mappenstructuur

```
/
├── README.md
├── docs/                 documentatie (dit bestand e.d.)
├── design/               het goedgekeurde ontwerp (alleen ter referentie)
├── site/                 de website (Eleventy)
│   ├── _includes/        HTML-sjablonen en blokken
│   ├── _data/            alle inhoud die kantoor via Pages CMS aanpast (JSON, besluit 26)
│   └── assets/           foto's, css, js, lettertypen, pdf's
├── supabase/
│   ├── migrations/       database-opzet en toegangsregels
│   └── functions/        create-order, mollie-webhook, resend-ticket, check-in
├── beheer/               beheerpagina en scanpagina
└── .pages.yml            instellingen van het bewerkscherm (welke velden kantoor ziet)
```

## 6. Wat kantoor doet en wat technisch is

| Taak | Wie | Waar |
| --- | --- | --- |
| Teksten, foto's, hosts en musici aanpassen | Kantoor | Pages CMS |
| Nieuw jaar instellen: thema, datum, prijs, maximum tickets | Kantoor | Pages CMS + beheerpagina |
| Bestellingen bekijken en exporteren | Kantoor | Beheerpagina |
| Ticketmail opnieuw versturen | Kantoor | Beheerpagina |
| Terugbetalen | Kantoor | Mollie-dashboard |
| Nieuwsbrief versturen | Kantoor | MailerLite |
| Tickets scannen | Vrijwilligers | Scanpagina op de telefoon |
| Nieuw blok of andere opmaak | Kantoor met Claude | Zie [beheer-met-claude.md](beheer-met-claude.md) |
| Updates, storingen, nieuwe functies | Technisch aanspreekpunt | Een paar uur per jaar |

## 7. Fases

| Fase | Wanneer (voorstel) | Oplevering |
| --- | --- | --- |
| 1 | nov 2026 (gebouwd 4 nov) | Nieuwe jongerenzang-site met Pages CMS; documentatie |
| 2 | nov 2026 (gebouwd 4 nov) | Bestellen en betalen, database en functies; getest met een nagebootste Mollie (besluit 29, 30) |
| 3 | nov 2026 (gebouwd 4 nov) | QR-tickets, ticketmail, scanpagina, beheerpagina, koppeling met MailerLite |
| 4 | zodra Mollie van de stichting er is | Alles naar de accounts van de stichting; testbestellingen, daarna Mollie live |
| Verkoop | [startdatum] t/m 21 mei 2027 | Ticketverkoop open |
| bonisa.nl | vanaf 25 nov 2026 | Voorkant van bonisa.nl op dezelfde basis (zie §9) |

## 8. Kosten

| Dienst | Kosten | Let op |
| --- | --- | --- |
| Cloudflare Pages | Gratis | Inclusief testversie per wijziging |
| GitHub | Gratis | Organisatie op naam van de stichting |
| Pages CMS | Gratis, open source | Zelf hosten in de EU |
| Mollie | €0,32 per iDEAL-betaling | Per bestelling, niet per ticket |
| Supabase | Gratis; Pro $25 per maand | Gratis pauzeert na een week weinig activiteit en maakt geen back-ups. Voorstel (besluit 20): Pro alleen in de verkoopmaanden (ca. $75 per jaar), jaarrond zodra bonisa.nl giften verwerkt. Eén project voor alle sites |
| MailerSend | Gratis tot 500 mails/maand, max. 100 per dag | Voor de verkoopmaand mogelijk betaald plan |
| MailerLite | Huidig abonnement | |
| Claude Team | $20 per gebruiker per maand (jaarbetaling), min. 2 | Non-profitkorting tot 75%: ca. $10 per maand voor 2 gebruikers |

### Alternatieven voor de database

| Optie | Waarom niet gekozen |
| --- | --- |
| Neon (Postgres) | Geen plek voor functies; Europese regio nog bevestigen |
| Cloudflare D1 | Functies draaien wereldwijd, tenzij betaalde regio-uitbreiding; geen login en geen scherm voor kantoor |
| Eigen server in de EU | Zelf onderhouden: precies de afhankelijkheid die we willen voorkomen |

## 9. Fase 2: bonisa.nl

| Onderdeel | Wat er nodig is | Zwaarte |
| --- | --- | --- |
| Webshop (nu WooCommerce) | Advies: bestaande Europese webshopdienst inbouwen, niet zelf bouwen | Groot |
| Doneren: losse gift, per project, vaste bedragen | Nu: betaallinks via pay.ideal.nl, handmatige administratie. Straks: donatieformulier → Mollie (iDEAL \| Wero) → Supabase registreert alleen project, bedrag en status → automatische bedankmail, voortgangsbalk en export voor de bestaande administratie. Eventueel periodiek via machtiging | Middel |
| Projecten met voortgangsbalk | Projectenlijst in Pages CMS; giften via de bank kunnen bijtellen | Middel |
| Tickets (nu events.bonisa.nl) | Ticketsysteem van de jongerenzang | Klein |
| Nieuws, activiteiten, magazine, presentaties | Overzichten in Pages CMS | Middel |
| Formulieren (magazine, nodig ons uit, contact, vrijwilligers) | Opslag in Supabase + mail naar kantoor | Klein |
| Zoeken, ANBI, Schenken of nalaten, Sponsors | Zoeken zonder server; gewone pagina's | Klein |
| Overstap | Inhoud uit WordPress halen; oude links doorverwijzen; jongerenzang.nl en chinaindeles.nl mee | Middel |
| Huisstijl | Logo (.svg), kleuren, lettertypen in één stijlgids | Klein |

## 10. Bronnen

- [Mollie iDEAL-tarief](https://www.mollie.com/payments/ideal)
- [Supabase: pauzeren gratis projecten](https://supabase.com/kb/faqs/platform/free-project-pausing)
- [Supabase: functies vastzetten op een regio](https://supabase.com/docs/guides/functions/regional-invocation)
- [Supabase-prijzen (overzicht)](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)
- [MailerSend: plannen en limieten](https://mailersend.com/help/plans-features-and-limits)
- [MailerLite: waar staan de gegevens](https://www.mailerlite.com/help/is-my-data-safe-with-mailerlite)
- [Pages CMS](https://pagescms.org)
- [Cloudflare-netwerk](https://www.cloudflare.com/network/)
- [Cloudflare China Network FAQ](https://developers.cloudflare.com/china-network/faq/)
- [Neon-prijzen](https://neon.com/pricing)
- [Cloudflare D1-prijzen](https://developers.cloudflare.com/d1/platform/pricing/)
- [Claude for Nonprofits](https://www.anthropic.com/news/claude-for-nonprofits)
- [Claude Team-prijzen (okt. 2026)](https://krater.ai/blog/claude-team-plan-pricing)
