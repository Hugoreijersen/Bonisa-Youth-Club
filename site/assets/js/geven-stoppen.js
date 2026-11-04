// Stop page for a monthly gift. The code comes from the link in the mail
// (/geven/stoppen/#<code>); it is sent to the gift system only to stop.
(() => {
  const blok = document.getElementById("stoppen");
  if (!blok) return;
  const functies = blok.dataset.functies;
  const code = location.hash.slice(1).toLowerCase();
  const toon = (naam) => blok.querySelectorAll(".uitslag").forEach((u) => { u.hidden = u.dataset.toon !== naam; });
  const euro = (cent) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cent / 100);
  const kop = { "x-region": "eu-central-1" };

  if (!/^[0-9a-f]{32}$/.test(code)) return toon("onbekend");

  fetch(`${functies}/giftinfo?stopcode=${code}`, { headers: kop })
    .then((r) => (r.ok ? r.json() : null))
    .then((info) => {
      if (!info) return toon("onbekend");
      if (info.status !== "actief" && info.status !== "wacht_op_eerste") return toon(info.status === "gestopt" ? "gestopt" : "onbekend");
      blok.querySelector('[data-veld="bedrag"]').textContent = euro(info.bedrag_cent);
      blok.querySelector('[data-veld="project"]').textContent = info.project_naam;
      toon("actief");
    })
    .catch(() => toon("onbekend"));

  const knop = document.getElementById("stopknop");
  const melding = document.getElementById("melding");
  knop.addEventListener("click", async () => {
    knop.disabled = true;
    try {
      const r = await fetch(`${functies}/gift-stoppen`, {
        method: "POST", headers: { ...kop, "Content-Type": "application/json" }, body: JSON.stringify({ code }),
      });
      const uit = await r.json();
      if (r.ok && (uit.uitkomst === "gestopt" || uit.uitkomst === "al_gestopt")) return toon("gestopt");
      throw new Error(uit.fout ?? "fout");
    } catch {
      melding.textContent = "Het stoppen is niet gelukt. Probeer het opnieuw of mail ons.";
      melding.hidden = false;
      knop.disabled = false;
    }
  });
})();
