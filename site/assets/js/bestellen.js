// Order page: ticket counter, live total and sending the order.
// Without JavaScript the form still works (normal post to create-order).
(() => {
  const form = document.getElementById("bestelformulier");
  if (!form) return;

  const functies = form.dataset.functies;
  const evenement = form.dataset.evenement;
  let prijsCent = Number(form.dataset.prijsCent);
  let max = Number(form.dataset.max);

  const aantal = form.querySelector("#aantal");
  const totaal = document.getElementById("totaal");
  const totaalRegel = document.getElementById("totaal-regel");
  const melding = document.getElementById("melding");
  const knop = document.getElementById("bestelknop");
  const euro = (cent) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cent / 100);

  const MELDINGEN = {
    verkoop_gesloten: "De ticketverkoop is op dit moment gesloten.",
    nog_niet_open: "De ticketverkoop is nog niet begonnen.",
    uitverkocht: "De tickets zijn uitverkocht.",
    niet_genoeg_plaatsen: "Er zijn niet genoeg tickets meer. Kies een kleiner aantal.",
    ongeldig_aantal: "Kies een geldig aantal tickets.",
    ongeldige_gegevens: "Niet alle verplichte velden zijn goed ingevuld.",
    geen_akkoord: "Ga akkoord met de voorwaarden en de privacyverklaring.",
    te_veel_bestellingen: "Je hebt het afgelopen uur al vaak besteld. Probeer het later opnieuw.",
    betaling_mislukt: "Het betalen kon niet worden gestart. Probeer het opnieuw.",
    fout: "Er ging iets mis. Probeer het opnieuw of mail ons.",
  };

  const toonMelding = (tekst) => {
    melding.textContent = tekst;
    melding.hidden = !tekst;
    if (tekst) melding.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const werkBij = () => {
    const n = Math.min(max, Math.max(1, Number(aantal.value) || 1));
    totaalRegel.textContent = `${n} × ${euro(prijsCent)}`;
    totaal.textContent = euro(n * prijsCent);
  };

  // Counter buttons (hidden until JavaScript runs)
  form.querySelectorAll(".teller__knop").forEach((b) => {
    b.hidden = false;
    b.addEventListener("click", () => {
      aantal.value = Math.min(max, Math.max(1, (Number(aantal.value) || 1) + Number(b.dataset.stap)));
      werkBij();
    });
  });
  aantal.addEventListener("input", werkBij);

  // Error code from a form post without JavaScript (?fout=...)
  const foutUitUrl = new URLSearchParams(location.search).get("fout");
  if (foutUitUrl) toonMelding(MELDINGEN[foutUitUrl] ?? MELDINGEN.fout);

  // Current price and sale status from the ticket system
  fetch(`${functies}/ticketinfo?evenement=${encodeURIComponent(evenement)}`, { headers: { "x-region": "eu-central-1" } })
    .then((r) => (r.ok ? r.json() : null))
    .then((info) => {
      if (!info) return;
      prijsCent = info.prijs_cent;
      max = Math.max(1, Math.min(info.max_per_bestelling, info.plaatsen_vrij || 1));
      aantal.max = String(max);
      werkBij();
      if (info.verkoop !== "open") {
        toonMelding(MELDINGEN[info.verkoop] ?? MELDINGEN.verkoop_gesloten);
        knop.disabled = true;
      }
    })
    .catch(() => {});

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    toonMelding("");
    if (!form.reportValidity()) return;

    knop.disabled = true;
    knop.textContent = "Even geduld…";
    try {
      const gegevens = Object.fromEntries(new FormData(form));
      const r = await fetch(`${functies}/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-region": "eu-central-1" },
        body: JSON.stringify(gegevens),
      });
      const data = await r.json();
      if (r.ok && data.checkoutUrl) {
        location.href = data.checkoutUrl; // to Mollie
        return;
      }
      toonMelding(data.melding ?? MELDINGEN[data.fout] ?? MELDINGEN.fout);
    } catch {
      toonMelding(MELDINGEN.fout);
    }
    knop.disabled = false;
    knop.textContent = "Bestel je ticket";
  });

  werkBij();
})();
