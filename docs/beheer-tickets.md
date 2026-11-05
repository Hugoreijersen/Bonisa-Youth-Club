# Tickets beheren

Voor kantoor en de vrijwilligers bij de deur. Laatst bijgewerkt: 5 november 2026.

Technische uitleg staat in [ticketsysteem.md](ticketsysteem.md).

## De beheerpagina: jongerenzang.nl/beheer/

Log in met je eigen account. Bovenaan staat een groen blok met het evenement waar je mee bezig bent. Heb je meer evenementen (bijvoorbeeld vorig jaar), kies dan bovenin dat blok een ander evenement. Alles op de pagina gaat over het gekozen evenement.

| Onderdeel | Wat je er doet |
| --- | --- |
| **Ticketverkoop** (groene blok) | Eén knop: **Verkoop openen** of **Verkoop sluiten**. Daarboven staat of de verkoop nu open of dicht is |
| **Aantal tickets** (groene blok) | Pas het getal aan en klik **Opslaan**. Lager dan wat al verkocht is kan niet |
| **Cijfers** | Verkocht, opbrengst, bestellingen, en op de avond zelf hoeveel mensen binnen zijn |
| **Bestellingen** | Zoeken op naam, e-mail of woonplaats. Kreeg iemand geen mail? Klik bij die bestelling op **Opnieuw** |
| **Exporteer (CSV)** | Twee bestanden voor de wekelijkse back-up (zie [back-up.md](back-up.md)). Opent in Excel |
| **Gegevens van dit evenement** | Naam, datum, locatie, prijs en maximum per bestelling. De prijs is wat mensen echt betalen: zet dezelfde prijs ook in het bewerkscherm van de site. Onder **Verkoop automatisch openen of sluiten** kun je de verkoop op een vast moment laten openen of sluiten |
| **+ Nieuw evenement** (bovenaan) | Opent een apart formulier. De **vaste naam** (bijvoorbeeld `jongerenzang-2028`) kies je één keer: de site zoekt het evenement daarmee op. Een nieuw evenement begint met de verkoop dicht |
| **Accounts** | Accounts toevoegen voor scanners (alleen de scanpagina) en voor kantoor (alles). Geef het wachtwoord persoonlijk door, niet per mail. Bij elk account kies je de **rol**: Geen rol, Scanner of Kantoor. Verwijder accounts na het evenement |

**Let op:** de knop **Ticketverkoop** hier regelt of bestellen kan. De knop "Bestel je ticket" op de homepage zet je apart aan of uit in het bewerkscherm van de site ("Ticketverkoop is open"). Zet ze samen open en dicht.

Terugbetalen gaat in het dashboard van **Mollie** (Betalingen → de betaling → Terugbetalen). De bestelling staat daarna vanzelf op "Terugbetaald" en de tickets werken niet meer bij de deur.

## Iemand uitnodigen

Je kunt iemand ook een uitnodiging per mail sturen. Diegene kiest dan zelf een wachtwoord, zodat je geen wachtwoord hoeft door te geven.

1. Ga in het Supabase-dashboard naar **Authentication → Users → Add user → Send invitation** en vul het e-mailadres in.
2. De nieuwe gebruiker klikt op de link in de mail en komt op de pagina **Welkom** (`/welkom/`). Daar kiest diegene een wachtwoord van minstens 10 tekens.
3. Op de beheerpagina staat het account nu onder **Accounts** met **Geen rol** (zolang de link nog niet gebruikt is: "Uitgenodigd, nog niet aangemeld"). Kies bij **Rol** voor **Kantoor** of **Scanner**. Dat geldt meteen.

De link in de mail werkt één keer en maar een beperkte tijd. Verlopen? Stuur een nieuwe uitnodiging. Zonder rol kan een account niets: de beheerpagina en de scanpagina blijven dicht.

Je eigen rol kun je niet veranderen; vraag dat aan iemand anders van kantoor.

## Bij de deur: jongerenzang.nl/scan/

Voor elke vrijwilliger een eigen account (rol **Scanner**), aan te maken op de beheerpagina.

1. Open de scanpagina op je telefoon en log in.
2. Tik op **Start de camera** en geef toestemming.
3. Houd de QR-code voor de camera.
   - **Groen, "Welkom! Ticket geldig"**: laat de persoon binnen.
   - **Rood, "Al gescand"**: dit ticket is al gebruikt. Niet nog een keer binnenlaten; vraag naar het juiste ticket.
   - **Rood, "Onbekende code" of "Niet geldig"**: geen geldig ticket. Verwijs naar de ticketmail of naar iemand van kantoor.
4. Werkt de camera niet? Typ de code onder de QR-code over in het veld **Code met de hand invoeren**.

Bovenaan zie je hoeveel mensen al binnen zijn.

**Tips voor de avond**
- Test de dag ervoor met een eigen ticket of een testbestelling.
- Zorg voor goede wifi of mobiel internet bij de ingang: elke scan wordt direct gecontroleerd.
- Print de dag ervoor een export als terugvaloptie (zie [back-up.md](back-up.md)).

## Vragen van bezoekers

| Vraag | Antwoord |
| --- | --- |
| "Ik heb geen mail gekregen" | Zoek de bestelling op de beheerpagina. Staat hij op Betaald: klik **Opnieuw**, en vraag om in de spammap te kijken. Staat hij op Open of Mislukt: de betaling is niet gelukt; laat opnieuw bestellen |
| "Ik heb verkeerd besteld" | Terugbetalen in Mollie; daarna opnieuw laten bestellen |
| "Mag ik mijn ticket doorgeven?" | Ja, door de QR-code of de link uit de mail door te sturen. Elke code werkt maar één keer |
