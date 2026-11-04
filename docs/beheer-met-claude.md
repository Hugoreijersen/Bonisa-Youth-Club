# De website aanpassen

Voor kantoor. Er zijn twee manieren, afhankelijk van hoe groot de wijziging is.

> Deze handleiding wordt tijdens de bouw aangevuld met schermafbeeldingen en de echte links.

## 1. Kleine wijzigingen: zelf in het bewerkscherm

Voor: teksten, foto's, datums, hosts en musici, de prijs, een nieuw jaarthema.

1. Ga naar het bewerkscherm: [link volgt].
2. Log in met je eigen account.
3. Kies de pagina of het onderdeel, pas de velden aan en klik op **Opslaan**.
4. Na een paar minuten staat de wijziging online.

De opmaak (kleuren, indeling, lettertypen) kun je hier niet per ongeluk veranderen.

## 2. Grotere wijzigingen: met Claude

Voor: een nieuw blok, een nieuwe pagina, een andere indeling.

1. Open Claude met het account van Bonisa en kies de repository van de website.
2. Beschrijf wat je wilt, bijvoorbeeld: *"Zet op de homepage onder de terugblik een blok met het nieuwe collecteproject, met foto en knop Doneer."*
3. Claude maakt de wijziging als **voorstel** (pull request). Er verandert nog niets aan de live site.
4. Bekijk het voorstel op de **testversie**: Cloudflare maakt die automatisch en zet de link bij het voorstel in GitHub.
5. Klopt het? Keur het voorstel goed. Binnen een paar minuten staat het live.
6. Klopt het niet? Vraag Claude om het aan te passen, of wijs het voorstel af.

### Afspraken

- Bekijk altijd eerst de testsite. Ook Claude kan fouten maken.
- Deel nooit gegevens van bestellers, donateurs of partners met Claude.
- Twijfel je, of gaat het om betalen of tickets? Vraag het technisch aanspreekpunt: Hugo.

## Wie doet wat

| Taak | Waar |
| --- | --- |
| Teksten en foto's | Bewerkscherm |
| Bestellingen bekijken, ticket opnieuw sturen | Beheerpagina [link volgt] |
| Terugbetalen | Mollie-dashboard |
| Nieuwsbrief | MailerLite |
| Nieuw blok of nieuwe pagina | Claude, via de testsite |
| Storing | Technisch aanspreekpunt |
