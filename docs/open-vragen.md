# Open vragen en te regelen

Afgevinkt? Zet een `x` tussen de haken en noteer de beslissing in [beslissingen.md](beslissingen.md).

## Vóór livegang (de bouw kan zonder)

De bouw begint lokaal en met testaccounts. Deze punten moeten geregeld zijn voordat iets live gaat (zie besluit 18).

- [ ] GitHub-organisatie aanmaken. De naam `bonisa` is bezet: nagaan of dat een oud account van Bonisa is (wachtwoord-reset via een Bonisa-adres proberen), anders bijvoorbeeld `stichting-bonisa`.
- [ ] Iemand van kantoor met een eigen GitHub-account toevoegen aan de organisatie.
- [ ] Algemeen mailadres van de stichting voor alle accounts (bijvoorbeeld web@bonisa.nl).
- [x] Technisch aanspreekpunt: Hugo (4 nov 2026). Opvolgers staan op Hugo's lijst; voorwaarde is dat alles in deze repository gedocumenteerd is.
- [ ] Cloudflare-account op naam van de stichting.
- [x] Bevestigen: sitegenerator Eleventy (4 nov 2026, besluit 23).
- [ ] Betalingen: navragen bij kantoor welke betaaldienst bonisa.nl nu gebruikt (giften gaan via pay.ideal.nl; webshop en events.bonisa.nl nog navragen). Is dat Mollie, dan een extra websiteprofiel in hetzelfde account. Zo niet: keuze heroverwegen. Tijdens de bouw: Mollie-testmodus.
- [ ] Supabase-account (regio Frankfurt) en MailerSend-account op naam van de stichting.

## Voor de ticketverkoop

- [ ] Startdatum van de ticketverkoop.
- [ ] Maximum aantal tickets (capaciteit van de kerk) en maximum per bestelling.
- [ ] Ticketmail: MailerSend of een andere dienst; navragen waar MailerSend de mailgegevens bewaart.
- [ ] Domein jongerenzang.nl (in eigen beheer) bij livegang naar Cloudflare laten wijzen. Let op: neem bestaande mailinstellingen (MX-records) mee, anders stopt de mail op dat domein.
- [ ] Toestemming voor foto's van herkenbare jongeren op de site (onder 16: ouders).
- [ ] Privacyverklaring en voorwaarden laten nakijken en aanpassen (apart nieuwsbriefvakje).
- [ ] Bewaartermijn van bestellingen vaststellen.
- [ ] Afgeschermde back-upmap in de EU kiezen (zie back-up.md); nagaan waar die opslag staat.
- [ ] Supabase tijdens de verkoop: Pro voor die maanden, of gratis met een automatische dagelijkse controle (zie besluit 20).
- [ ] Wie meldt een eventueel datalek bij de Autoriteit Persoonsgegevens?
- [ ] Claude Team-abonnement aanvragen met non-profitkorting.

## Ontwerp en inhoud

- [ ] Huisstijl aanleveren: Bonisa-logo als .svg, officiële kleuren en lettertypen.
- [ ] BYC-oranje bevestigen (nu voorlopig `#F28C1E`).
- [ ] Citaat bezoeker: naam en leeftijd, met toestemming.
- [ ] Collecteproject 2027 en gegevens van Project 9 (2025).
- [ ] Kingfisher: winkellink, en of de shirts tijdens de avond te koop zijn.

## Fase 2 (bonisa.nl)

- [ ] Hoe worden giften en donateurs nu bijgehouden? Bekend (4 nov 2026): doneren loopt nu via betaallinks van iDEAL | Wero (pay.ideal.nl); de administratie daarvan is omslachtig. Nog uitzoeken: hoe kantoor giften nu koppelt aan projecten en donateurs, wat het kost, en naar welk systeem de gegevens gaan.
- [ ] Is periodiek doneren nodig?
- [ ] Webshop: bonisa.nl heeft nu WooCommerce (in WordPress). Uitzoeken: welke producten en hoeveel, verzending en voorraad, en welke betaalplugin WooCommerce gebruikt. Is dat Mollie, dan heeft Bonisa al een Mollie-account.
- [ ] Welke webshopdienst bouwen we in, of volstaat bij weinig producten een eenvoudig bestelformulier op basis van het ticketsysteem?

## Na de bouw van fase 1 (website)

- [ ] Pages CMS zelf hosten in de EU (bijvoorbeeld op een kleine server of bij een Europese hostingdienst). Tot die tijd kan het bewerkscherm niet gebruikt worden: de online versie op pagescms.org draait niet aantoonbaar in de EU.
- [ ] Bonisa-logo aanleveren (vak op de site blijft weg zolang het leeg is).
- [ ] Bij livegang: in het bewerkscherm "Zichtbaar in Google" aanzetten.
