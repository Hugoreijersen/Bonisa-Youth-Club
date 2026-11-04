// Gift pages: progress bars, the "other amount" field and error messages.
// Without JavaScript the form still works (normal post to create-gift).
(() => {
  const pagina = document.getElementById("geven");
  if (!pagina) return;
  const functies = pagina.dataset.functies;
  const euro = (cent) => new Intl.NumberFormat("nl-NL", {
    style: "currency", currency: "EUR", minimumFractionDigits: cent % 100 === 0 ? 0 : 2,
  }).format(cent / 100);

  // --- Error code from create-gift (?fout=...) -----------------------------
  const MELDINGEN = {
    onbekend_project: "Dit project staat op dit moment dicht voor giften.",
    ongeldig_bedrag: "Kies een bedrag tussen € 1 en € 10.000.",
    ongeldige_soort: "Kies eenmalig of maandelijks.",
    ongeldige_gegevens: "Niet alle verplichte velden zijn goed ingevuld.",
    te_veel_giften: "U heeft het afgelopen uur al vaak gegeven. Probeer het later opnieuw.",
    betaling_mislukt: "Het betalen kon niet worden gestart. Probeer het opnieuw.",
    fout: "Er ging iets mis. Probeer het opnieuw of mail ons.",
  };
  const melding = document.getElementById("melding");
  const fout = new URLSearchParams(location.search).get("fout");
  if (fout && melding) {
    melding.textContent = MELDINGEN[fout] ?? MELDINGEN.fout;
    melding.hidden = false;
  }

  // --- Progress bars: online gifts (ticket system) + gifts via the bank ----
  const balken = pagina.querySelectorAll("[data-voortgang]");
  if (balken.length) {
    fetch(`${functies}/giftinfo?projecten=1`, { headers: { "x-region": "eu-central-1" } })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}))
      .then((standen) => {
        balken.forEach((blok) => {
          const online = standen[blok.dataset.voortgang]?.opgehaald_cent ?? 0;
          const totaal = online + Number(blok.dataset.bankCent || 0);
          const balk = blok.querySelector("progress");
          if (balk) balk.value = Math.min(totaal, Number(balk.max));
          blok.querySelector('[data-veld="opgehaald"]').textContent = euro(totaal);
          blok.hidden = false;
        });
      });
  }

  // --- Form ----------------------------------------------------------------
  const form = document.getElementById("geefformulier");
  if (!form) return;
  const anders = form.querySelector(".keuzes__anders");
  const andersVeld = form.querySelector("#bedrag_anders");
  const uitleg = form.querySelector('[data-uitleg="maandelijks"]');
  const knop = document.getElementById("geefknop");

  const werkBij = () => {
    const keuze = form.querySelector('input[name="bedrag"]:checked')?.value;
    anders.hidden = keuze !== "anders";
    const maandelijks = form.querySelector('input[name="frequentie"]:checked')?.value === "maandelijks";
    uitleg.hidden = !maandelijks;
    knop.textContent = maandelijks ? "Start maandelijkse gift met iDEAL" : "Geef met iDEAL";
  };
  form.addEventListener("change", werkBij);
  andersVeld.addEventListener("focus", () => { form.querySelector('input[name="bedrag"][value="anders"]').checked = true; werkBij(); });
  werkBij();

  form.addEventListener("submit", (e) => {
    if (!form.checkValidity()) {
      e.preventDefault();
      melding.textContent = MELDINGEN.ongeldige_gegevens;
      melding.hidden = false;
      form.reportValidity();
      return;
    }
    knop.disabled = true; // no double gifts on a double click
  });
})();
