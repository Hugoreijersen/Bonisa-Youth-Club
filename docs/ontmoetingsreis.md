# Ontmoetingsreis: sponsorpagina's

Voor kantoor, het technisch aanspreekpunt en een opvolger. Laatst bijgewerkt: 10 november 2026.

De Ontmoetingsreis is de jongerenreis van Bonisa naar Azië, D.V. in de zomer van 2027. Elke deelnemer haalt minimaal € 5.000 aan sponsorgeld op, voor projecten van Bonisa en voor de reis. De deelnemers gebruiken deze pagina's om sponsors te vragen.

## Wat er staat

| Adres | Wat |
| --- | --- |
| `/ontmoetingsreis/` | Uitleg over de reis, de stand van de hele groep en een kaart per deelnemer |
| `/ontmoetingsreis/<vaste naam>/` | De pagina van één deelnemer: foto, eigen tekst, teller tot € 5.000, geefformulier (iDEAL) en een knop om de pagina te delen |

De pagina's horen bij bonisa.nl. Ze worden, net als de geefpagina's, alleen gebouwd met de bouwvariabele `GIFTEN_PAGINAS=aan` en staan dus niet op jongerenzang.nl. Lokaal bekijken: `npm run start:giften` en dan http://localhost:8080/ontmoetingsreis/.

## Veiligheid: wat nooit op de pagina mag

De veiligheid van werkers en partners gaat voor (zie ook [beveiliging.md](beveiliging.md), "Bescherming van partners in Azië"). Daarom:

- **Nooit het land noemen.** Ook geen steden, bezienswaardigheden, taal, munt of andere dingen waaraan je het land herkent. Schrijf alleen "Azië". Dit geldt ook voor namen van foto's, de beschrijving van foto's, commitberichten en pull requests.
- **Geen precieze datums.** Schrijf "zomer 2027".
- **Geen namen of foto's van partners en werkers**, en geen foto's van de reis zonder toestemming van Bonisa.
- **Deelnemers alleen met voornaam.** Een foto is van de deelnemer zelf, gemaakt in Nederland.
- **Niet in zoekmachines.** De pagina's vragen zoekmachines altijd om ze over te slaan, ook als de rest van de site wel zichtbaar is. Deelnemers delen zelf de link.
- Controleer de persoonlijke tekst van elke deelnemer op deze punten voordat je hem plaatst.

## Voor kantoor

Alles staat in Pages CMS onder **Ontmoetingsreis (sponsorpagina)**.

- **Deelnemer toevoegen**: bij Deelnemers een nieuwe regel met voornaam, vaste naam (kleine letters, bijvoorbeeld `anna`), eventueel een foto, één zin voor het overzicht en een persoonlijke tekst. De pagina staat er na een paar minuten.
- **Vaste naam niet meer wijzigen** zodra er giften binnenkomen: giften zijn eraan gekoppeld.
- **Giften via de bank en acties**: geld dat buiten de site om binnenkomt (overschrijving, opbrengst van een actie) vul je per deelnemer in als totaal. De teller telt dat op bij de giften via de site. Giften via de site niet nog eens invullen.
- **Deelnemer weghalen**: zet "Toon deze deelnemer en neem giften aan" uit. De pagina verdwijnt en er komen geen giften meer binnen.
- **Overzicht en export**: `/beheer/` → **Giften**. Elke deelnemer staat daar als project "Ontmoetingsreis: <voornaam>".
- De twee deelnemers die er nu staan (Anna en Daan) zijn voorbeelden. Vervang ze door de echte deelnemers.

## Hoe het werkt (techniek)

Er is niets nieuws gebouwd aan de achterkant: de sponsorpagina's gebruiken het geefsysteem uit [giften.md](giften.md).

- Inhoud: `site/_data/ontmoetingsreis.json`. Sjablonen: `site/ontmoetingsreis/`. Opmaak: onderaan `site/assets/css/site.css`.
- `site/_data/giften.js` maakt van elke open deelnemer een geefproject met de vaste naam `reis-<vaste naam>` en de naam "Ontmoetingsreis: <voornaam>". Die projecten staan ook in `/geven/projecten.json`, zodat `create-gift` ze accepteert. Ze staan niet in het overzicht op `/geven/`.
- Het geefformulier stuurt naar `create-gift`, altijd als eenmalige gift. Daarna loopt alles zoals bij elke gift: Mollie, nacontrole, bedankmail, `/geven/bedankt/`.
- De tellers komen uit `giftinfo` (`geven.js`). De teller van de groep telt de deelnemers bij elkaar op.
- Persoonsgegevens van gevers staan alleen in Supabase (Frankfurt). Namen van gevers komen niet op de site.
- Gaat er bij het betalen iets mis zonder JavaScript, dan komt de gever op `/geven/` uit met de foutmelding, niet op de pagina van de deelnemer.
