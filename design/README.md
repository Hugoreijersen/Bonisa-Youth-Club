# Ontwerp

Hier staat het goedgekeurde ontwerp, **alleen als referentie**. Deze bestanden zijn niet de website zelf: de echte site wordt gebouwd in `site/` met Eleventy.

## jongerenzang-2027/

Gemaakt in Claude (ontwerpcanvas), geëxporteerd op 4 november 2026.

| Bestand | Wat |
| --- | --- |
| `website.html` | De hele jongerenzang-pagina, van boven naar beneden |
| `ticketformulier.html` | Het bestelformulier met teller en bevestiging |
| `instagram-post.html` | Post/poster, 1080 × 1350 px |
| `assets/` | Alle foto's, logo's en de drie juridische PDF's, met leesbare namen |

**Let op bij het lezen:** de HTML gebruikt het formaat van het ontwerpcanvas. `<x-dc>`, `<helmet>`, `<sc-if>`, `{{groenDonker}}` en het script onderaan zijn geen gewone HTML. Ze openen niet goed in een browser. Lees ze als specificatie: de inline `style`-attributen geven de exacte maten, kleuren en lettertypen.

## Ontwerpregels

| | Waarde |
| --- | --- |
| BYC-groen | `#4C8C40` (uit het BYC-logo) |
| BYC-oranje | `#F28C1E` (voorlopig, nog bevestigen) |
| Donkergroen (knoppen, tekst op licht) | groen 24% naar zwart ≈ `rgb(58,106,49)` |
| Lichtgroen vlak | groen 80% naar wit ≈ `rgb(219,232,217)` |
| Lichtoranje vlak | oranje 80% naar wit ≈ `rgb(252,232,210)` |
| Tekst | `#1C1F1A`, gedempt `#3D4639` |
| Achtergrond pagina | `#F3F8EF` |
| Koppen | Bricolage Grotesque, 700–800 |
| Tekst | DM Sans, 18 px, regelhoogte 1,6 |
| Afronding | knoppen volledig rond; kaarten 20–28 px |
| Knoppen | min. 44 px hoog (aanraakdoel) |

De tinten worden in het ontwerp berekend uit groen en oranje (functie `mix` in het script). Neem ze over als CSS-variabelen.

## Opbouw van de pagina (website.html)

1. Vaste menubalk met "Bestel je ticket"
2. Hero: titel, thema, datum, knoppen, foto 2025
3. Groene banner met Romeinen 14:17 (Statenvertaling)
4. Drie kaarten: Recht, Vrede, Blijdschap
5. Terugblik: fotomozaïek met citaat van een bezoeker
6. Stichting Bonisa: "Zingen in Katwijk, helpen in Azië" + collecteprojecten
7. Over de avond
8. Programma
9. Hosts & musici (één host nog geheim)
10. Tickets (€ 4,50) en locatie
11. Kingfisher-kleding (4 shirts)
12. Wie zijn wij (Bonisa Youth Club)
13. Oranje balk "Ben jij erbij op vrijdag 21 mei?"
14. Footer met Bonisa-contactgegevens en juridische PDF's
15. Zwevende ronde knop "Bestel je ticket" rechtsonder

Teksten tussen `[haken]` zijn nog in te vullen (zie `docs/open-vragen.md`).
