// Thank-you page after a gift: asks for the status and shows the matching
// block. Checks again for about a minute while the payment is still open.
(() => {
  const blok = document.getElementById("bedankt");
  if (!blok) return;

  const id = new URLSearchParams(location.search).get("gift") ?? "";
  const toon = (naam) => blok.querySelectorAll(".uitslag").forEach((u) => { u.hidden = u.dataset.toon !== naam; });
  const euro = (cent) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cent / 100);
  const vul = (s) => {
    blok.querySelectorAll('[data-veld="bedrag"]').forEach((e) => { e.textContent = euro(s.bedrag_cent); });
    blok.querySelectorAll('[data-veld="project"]').forEach((e) => { e.textContent = s.project_naam; });
  };

  let pogingen = 0;
  const opnieuw = () => { if (pogingen++ < 20) setTimeout(vraag, 3000); else toon("open"); };
  const vraag = async () => {
    try {
      const r = await fetch(`${blok.dataset.functies}/giftinfo?gift=${encodeURIComponent(id)}`, { headers: { "x-region": "eu-central-1" } });
      if (r.status === 404 || r.status === 400) return toon("onbekend");
      const s = await r.json();
      if (s.status === "betaald") {
        vul(s);
        if (s.soort !== "eerste") return toon("betaald");
        if (s.periodiek === "actief" || s.periodiek === "gestopt") return toon("maandelijks");
        toon("laden"); // paid, the monthly gift is being started
        return opnieuw();
      }
      if (s.status === "open") {
        toon(pogingen === 0 ? "laden" : "open");
        return opnieuw();
      }
      toon("mislukt");
    } catch {
      opnieuw();
    }
  };
  vraag();
})();
