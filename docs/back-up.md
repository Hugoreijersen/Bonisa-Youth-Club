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

1. Log in bij Supabase (eigen account, met tweestapsverificatie) en open het project van de websites.
2. Ga naar **Table Editor**.
3. Open de tabel `orders` en kies **Export → CSV**.
4. Doe hetzelfde voor de tabel `tickets`.
5. Geef de bestanden een naam met de datum: `2027-03-08_orders.csv` en `2027-03-08_tickets.csv`.
6. Zet ze in de afgeschermde back-upmap: **[map nog vaststellen]**. Die map moet in de EU staan en alleen toegankelijk zijn voor kantoor en het technisch aanspreekpunt.
7. Noteer de export in het logboek onderaan dit bestand of in de back-upmap.

> Later (beheerpagina): er komt een knop **Exporteer bestellingen** die beide bestanden in één keer maakt. Dan vervallen stap 1 tot en met 4.

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
