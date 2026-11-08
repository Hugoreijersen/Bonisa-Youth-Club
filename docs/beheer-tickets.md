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
| **Accounts** | Mensen uitnodigen als scanner (alleen de scanpagina) of kantoor (alles); zie hieronder. Bij elk account kies je de **rol**: Geen rol, Scanner of Kantoor. Verwijder accounts na het evenement |

**Let op:** de knop **Ticketverkoop** hier regelt of bestellen kan. De knop "Bestel je ticket" op de homepage zet je apart aan of uit in het bewerkscherm van de site ("Ticketverkoop is open"). Zet ze samen open en dicht.

Terugbetalen gaat in het dashboard van **Mollie** (Betalingen → de betaling → Terugbetalen). De bestelling staat daarna vanzelf op "Terugbetaald" en de tickets werken niet meer bij de deur.

## Iemand uitnodigen

Nieuwe mensen nodig je uit per mail. Diegene kiest zelf een wachtwoord; jij hoeft geen wachtwoord te bedenken of door te geven.

1. Ga op de beheerpagina naar **Accounts → Iemand uitnodigen**. Vul het e-mailadres in, kies de rol (**Scanner** of **Kantoor**) en klik **Uitnodiging versturen**.
2. Diegene krijgt een mail met een link, komt op de pagina **Welkom** (`/welkom/`) en kiest daar een wachtwoord van minstens 10 tekens, met letters en cijfers. Daarna kan diegene meteen inloggen.
3. Zolang de link nog niet gebruikt is, staat er bij het account "Uitgenodigd, nog niet aangemeld". Geen mail gekregen, of is de link verlopen? Klik **Opnieuw uitnodigen** (en laat in de spammap kijken).

Bestaat het e-mailadres al als account? Dan krijgt dat account alleen de gekozen rol, zonder nieuwe mail.

Je kunt ook iemand uitnodigen via het Supabase-dashboard (**Authentication → Users → Add user → Send invitation**). Dat account staat daarna met **Geen rol** in de lijst: kies dan bij **Rol** voor **Kantoor** of **Scanner**. Zonder rol kan een account niets: de beheerpagina en de scanpagina blijven dicht.

Je eigen rol kun je niet veranderen; vraag dat aan iemand anders van kantoor.

## Inloggen met een code uit je app (kantoor)

Kantoor kan de gegevens van alle kopers zien. Daarom vraagt de beheerpagina na je wachtwoord ook een code van 6 cijfers uit een app op je telefoon (besluit 67). Scanners hebben dat niet nodig.

1. **De eerste keer:** installeer een app voor inlogcodes, bijvoorbeeld Google Authenticator, Microsoft Authenticator of op een iPhone de app Wachtwoorden. Log in op `/beheer/`, scan met de app de QR-code die de pagina toont, en vul de 6 cijfers in.
2. **Daarna:** na je wachtwoord vul je steeds de code in die de app op dat moment toont (hij verandert elke 30 seconden).
3. **Telefoon kwijt of nieuw?** Vraag een ander kantooraccount om bij **Accounts** op **App opnieuw instellen** te klikken. Bij de volgende keer inloggen zie je weer een QR-code. Is er geen ander kantooraccount, dan kan de beheerder van Supabase het doen: Authentication → Users → het account → bij MFA de factor verwijderen.

In de lijst **Accounts** zie je in de kolom **Code-app** wie het al heeft ingesteld.

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
