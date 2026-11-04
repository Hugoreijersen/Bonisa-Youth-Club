# Back-up van bestellingen

Voor kantoor en het technisch aanspreekpunt. Laatst bijgewerkt: 4 november 2026.

## Waarom

Zolang Supabase op het gratis plan staat, maakt Supabase **zelf geen back-ups**. Gaat er iets mis, dan zijn de bestellingen alleen terug te halen uit onze eigen export. Mollie is een tweede vangnet: daar staat elke betaling met naam, e-mailadres en bedrag, maar niet het aantal tickets of de ticketcodes.

## Wanneer

| Periode | Hoe vaak |
| --- | --- |
| Tijdens de ticketverkoop | Elke maandag |
| De dag vóór het evenement | Extra export, ook als printbare lijst voor de deur |
| Direct na het evenement | Laatste export (inclusief wie gescand is) |
| Buiten de verkoop | Niet nodig |

## Hoe (ongeveer 5 minuten)

1. Log in op de beheerpagina (jongerenzang.nl/beheer/).
2. Klik bij Bestellingen op **Exporteer (CSV)**. Je krijgt twee bestanden in je map Downloads, met de datum in de naam: `2027-03-08_jongerenzang-2027_orders.csv` en `..._tickets.csv`.
3. Zet ze in de afgeschermde back-upmap: **[map nog vaststellen]**. Die map moet in de EU staan en alleen toegankelijk zijn voor kantoor en het technisch aanspreekpunt.
4. Verwijder ze uit je map Downloads.
5. Noteer de export in het logboek onderaan dit bestand of in de back-upmap.

## Regels

- De exports bevatten persoonsgegevens. **Nooit** in GitHub, nooit in Claude, nooit per mail rondsturen.
- Alleen bewaren in de afgeschermde back-upmap.
- Verwijder de exports als de bewaartermijn van de bestellingen voorbij is ([X] maanden na het evenement, zie `beveiliging.md`).

## Terugzetten

Moet er een back-up terug? Neem contact op met het technisch aanspreekpunt. Die zet de CSV-bestanden terug in een (nieuw) Supabase-project. Werkt de site niet op tijd, dan is de geprinte lijst de terugvaloptie bij de deur.

## Logboek

| Datum | Door | Bestanden | Opmerking |
| --- | --- | --- | --- |
| | | | |
