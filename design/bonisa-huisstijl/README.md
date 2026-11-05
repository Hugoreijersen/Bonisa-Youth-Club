# Huisstijl van Bonisa

Aangeleverd door Hugo op 5 november 2026. De gids zelf: [BONISA_Huisstijl.pdf](BONISA_Huisstijl.pdf). Deze pagina vat samen hoe de website hem toepast. Alle waarden staan als variabelen bovenaan `site/assets/css/site.css`: pas ze alleen daar aan.

## Kleuren

| Naam in de CSS | Kleur | Gebruik op de site |
| --- | --- | --- |
| `--groen` | `#4d8b2c` | Primair. Grote groene banden met grote witte tekst (Bijbeltekst) |
| `--groen-vlak` | `#457d28` | Primair, een tikje donkerder: groene vlakken met kleine witte tekst (menubalk, Bonisa, ticketblok, beheer). Wit op `#4d8b2c` haalt maar 4,2:1, hier 5:1 |
| `--groen-donker` | `#475836` | Knoppen, links en kleine groene tekst, footer |
| `--olijf` | `#516724` | Reserve |
| `--rood` | `#982a29` | Foutmeldingen, "Dicht" in beheer, labels op zand |
| `--oranje` | `#d76b38` | Belangrijkste knop ("Tickets", "Doneer"), slotbalk. Altijd met donkere tekst, nooit wit |
| `--salie` | `#bbcca4` | Vlak "Wie zijn wij", themakaart Vrede |
| `--blauw` | `#a3c0cb` | Terugblik, themakaart Recht |
| `--roze` | `#e7a9a9` | Themakaart Blijdschap |
| `--zand` | `#e7c8a8` | Kingfisher, totaalbedrag bij bestellen |
| `--achtergrond` | `#E4EADB` | Achtergrond van de pagina (van de omslag van de gids) |

Contrast is gecontroleerd: alle tekst haalt minimaal 4,5:1.

## Lettertypen

De huisstijl gebruikt betaalde lettertypen. Op de site staan voorlopig gratis lookalikes (besluit 56), in eigen beheer in `site/assets/fonts/`:

| Huisstijl | Waarvoor | Nu op de site | Variabele |
| --- | --- | --- | --- |
| Aktiv Grotesk Cd Black | Koppen (in hoofdletters) | Archivo, smal (`--kop-breedte`) en extra vet | `--font-kop` |
| Aktiv Grotesk Regular | Platte tekst | Archivo | `--font-tekst` |
| Miller Text Bold | Inleidingen, Bijbeltekst, citaat | Gelasio | `--font-inleiding` |
| Carrot Juice | Streamers: korte labels ("Wie zijn wij", "Romeinen 14:17") | Patrick Hand SC | `--font-streamer` |

**Echte lettertypen gebruiken:** koop de webversie (`.woff2`) met een licentie voor websites, zet de bestanden in `site/assets/fonts/`, vervang de `@font-face`-regels bovenaan `site.css` en zet de namen in de variabelen. Verder hoeft niets te veranderen.

## Vormen

De gids gebruikt vlakken met **gescheurde randen**. Op de site gebruiken we die spaarzaam, zodat het strak blijft (keuze van Hugo, 5 november):

- `--rafel-rondom` alleen op **foto's** (hero, collecteprojecten, hosts en musici, shirts, bestelpagina, geefpagina's) en op de drie **themakaarten** (Recht, Vrede, Blijdschap).
- **Niet** op de foto's van de terugblik, en niet op banden, blokken, menubalk of footer: die hebben rechte randen.
- Overige hoeken zijn bijna recht (`--rond: 4px`).
- `--rafel-boven`, `--rafel-onder` en `--rafel-beide` staan klaar voor banden, maar worden nu niet gebruikt.

De randen zijn een `clip-path`. Wil je een andere scheurlijn, dan kun je de punten in die variabelen aanpassen.

## Logo's

In `logos/` staan de logo's als vector (`.svg`), uit de gids gehaald: Bonisa en BYC, zwart (op wit) en wit (op groen). Regels uit de gids: zwart logo op wit, wit logo op groen.

Op de site (`site/assets/img/`):

- `bonisa-logo-wit.svg`: footer en het Bonisa-blok op de homepage (wit op groen).
- `byc-logo.svg`: "Wie zijn wij", op een wit vlak.
- `bonisa-logo.svg`: zwarte versie, beschikbaar in het bewerkscherm.

Het BBC-logo (Bonisa Business Club) staat wel in de gids, maar wordt op de site nog niet gebruikt.
