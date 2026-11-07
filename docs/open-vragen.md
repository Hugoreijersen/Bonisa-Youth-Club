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
- [x] Betalingen: Bonisa heeft al een Mollie-account; alleen de webshop is eraan gekoppeld (4 nov 2026). Giften gaan nog via pay.ideal.nl. Gevolg: besluit 39.
- [ ] Supabase-account (regio Frankfurt) en MailerSend-account op naam van de stichting.

## Voor de ticketverkoop

- [ ] In het bestaande Mollie-account van Bonisa een websiteprofiel voor jongerenzang.nl aanmaken (besluit 39). Eerst de `test_`-sleutel daarvan in Supabase zetten om met de echte Mollie-testomgeving te testen, later de `live_`-sleutel (docs/ticketsysteem.md §5).
- [ ] Startdatum van de ticketverkoop.
- [ ] Maximum aantal tickets (capaciteit van de kerk) en maximum per bestelling (nu voorlopig 10, besluit 33; online staat het evenement op 50, aanpassen op `/beheer/`).
- [ ] Ticketmail: MailerSend-account (gratis tot 500 mails per maand), domein jongerenzang.nl daar verifiëren, en een afzender kiezen (voorstel: tickets@jongerenzang.nl, antwoorden naar het adres van de BYC). Navragen waar MailerSend de mailgegevens bewaart.
- [ ] MailerLite: API-sleutel en de groep waarin nieuwe aanmeldingen moeten komen.
- [ ] Domein jongerenzang.nl (in eigen beheer) bij livegang naar Cloudflare laten wijzen. Let op: neem bestaande mailinstellingen (MX-records) mee, anders stopt de mail op dat domein. (Volgens Hugo geen zorg; regelen bij livegang.)
- [ ] Toestemming voor foto's van herkenbare jongeren op de site (onder 16: ouders).
- [ ] Privacyverklaring en voorwaarden laten nakijken en aanpassen (apart nieuwsbriefvakje).
- [ ] Bewaartermijn van bestellingen vaststellen. Daarna bouwt Claude het anonimiseren na het evenement (beveiligingsreview T7) en komt de termijn in de privacyverklaring.
- [ ] Tweestapsverificatie (app met code) voor kantooraccounts? Advies van de beveiligingsreview (T6): ja, omdat kantoor alle kopersgegevens kan exporteren.
- [ ] Controle vóór livegang uit [beveiliging.md](beveiliging.md) afwerken (Supabase-instellingen, `SITE_ORIGINS`, verkoop dicht).
- [ ] Afgeschermde back-upmap in de EU kiezen (zie back-up.md); nagaan waar die opslag staat.
- [ ] Supabase tijdens de verkoop: Pro voor die maanden, of gratis met een automatische dagelijkse controle (zie besluit 20).
- [ ] Wie meldt een eventueel datalek bij de Autoriteit Persoonsgegevens?
- [ ] Claude Team-abonnement aanvragen met non-profitkorting.

## Ontwerp en inhoud

- [x] Huisstijl aangeleverd (5 november): kleuren, lettertypen en logo's staan in `design/bonisa-huisstijl/`.
- [ ] Echte lettertypen kopen (Aktiv Grotesk, Miller Text, Carrot Juice) voor de web, of de gratis lookalikes houden (besluit 56).
- [ ] Citaat bezoeker: naam en leeftijd, met toestemming.
- [x] Collecteproject 2027: Bonisa-project 11, Steun een evangelist, € 15.000 (5 november).
- [ ] Gegevens van Project 9 (2025).
- [ ] Kingfisher: winkellink, en of de shirts tijdens de avond te koop zijn.
- [ ] Notitieboekjes: waar te koop (tijdens de avond, webwinkel?), winkellink, en grotere foto's (nu 300 bij 200 pixels, wat onscherp is op telefoons).

## Fase 2 (bonisa.nl)

- [ ] Hoe worden giften en donateurs nu bijgehouden? Bekend (4 nov 2026): doneren loopt nu via betaallinks van iDEAL | Wero (pay.ideal.nl); de administratie daarvan is omslachtig. Nog uitzoeken: hoe kantoor giften nu koppelt aan projecten en donateurs, wat het kost, en naar welk systeem de gegevens gaan.
- [x] Is periodiek doneren nodig? Ja, maandelijks (4 nov 2026, besluit 50).
- [ ] Giften: in het Mollie-account een websiteprofiel voor bonisa.nl, met iDEAL en SEPA-incasso (nodig voor maandelijkse giften). Daarna de sleutel `MOLLIE_GIFTEN_API_KEY` in Supabase (docs/giften.md §5).
- [ ] Giften: afzender van de bedankmail (bijvoorbeeld giften@bonisa.nl) en bonisa.nl verifiëren in MailerSend.
- [ ] Giften: welke projecten komen erin, met doelbedrag en vaste bedragen, en hoeveel er al via de bank binnenkwam.
- [ ] Giften: bewaartermijn van gegevens van gevers, en of kantoor een jaaroverzicht per gever wil (voor de belastingaangifte van gevers).
- [ ] Webshop: bonisa.nl heeft nu WooCommerce (in WordPress). Uitzoeken: welke producten en hoeveel, verzending en voorraad, en welke betaalplugin WooCommerce gebruikt. Bekend (4 nov 2026): de webshop is gekoppeld aan het Mollie-account van Bonisa.
- [ ] Welke webshopdienst bouwen we in, of volstaat bij weinig producten een eenvoudig bestelformulier op basis van het ticketsysteem?

## Na de bouw van fase 1 (website)

- [ ] Bonisa-logo aanleveren (vak op de site blijft weg zolang het leeg is).
- [ ] Bij livegang: in het bewerkscherm "Zichtbaar in Google" aanzetten.
