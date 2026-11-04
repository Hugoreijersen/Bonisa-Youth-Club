// Management page for office. All data comes from the edge function "beheer";
// this page only shows it. Nothing is stored in the browser.
(() => {
  const root = document.querySelector("[data-inloggen]");
  if (!root) return;

  const $ = (sel) => root.querySelector(sel);
  const euro = (cent) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cent / 100);
  const datumTijd = (iso) => iso ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso)) : "–";
  const STATUS = { open: "Open", betaald: "Betaald", mislukt: "Mislukt", verlopen: "Verlopen", terugbetaald: "Terugbetaald" };
  const VERKOOP = { open: "Open", nog_niet_open: "Nog niet open", gesloten: "Gesloten", uitverkocht: "Uitverkocht" };
  const FOUTEN = {
    minder_dan_verkocht: "Het aantal tickets kan niet lager zijn dan wat al verkocht is.",
    niet_betaald_of_bezig: "Deze bestelling is niet betaald, of de mail wordt op dit moment al verstuurd.",
    wachtwoord_te_kort: "Kies een wachtwoord van minstens 10 tekens.",
    ongeldig_email: "Vul een geldig e-mailadres in.",
    niet_jezelf: "Je kunt je eigen account niet verwijderen.",
    ongeldig_slug: "De korte naam mag alleen kleine letters, cijfers en streepjes bevatten.",
    geen_toegang: "Dit account heeft geen toegang.",
  };

  let slug = root.dataset.evenement;
  let bestellingen = [];
  let evenementen = [];

  function melding(tekst, goed = false) {
    const m = $("[data-beheer-melding]");
    const b = $("[data-beheer-bevestiging]");
    m.hidden = goed || !tekst; b.hidden = !goed || !tekst;
    (goed ? b : m).textContent = tekst;
    if (tekst) (goed ? b : m).scrollIntoView({ block: "nearest" });
  }

  async function vraag(actie, extra = {}) {
    const { ok, data } = await Inloggen.functie("beheer", { actie, ...extra });
    if (!ok) {
      const tekst = FOUTEN[data.fout] ?? (data.fout?.startsWith("ongeldig_") ? `Controleer het veld "${data.fout.slice(9).replace(/_/g, " ")}".` : "Er ging iets mis. Probeer het opnieuw.");
      throw new Error(tekst);
    }
    return data;
  }

  const cel = (tekst) => { const td = document.createElement("td"); td.textContent = tekst; return td; };

  // --- Figures -------------------------------------------------------------
  async function laadCijfers() {
    const c = await vraag("overzicht", { evenement: slug });
    const rijen = [
      ["Verkocht", `${c.verkocht} van ${c.evenement.max_tickets}`],
      ["Nog beschikbaar", c.plaatsen_vrij],
      ["Bezig met betalen", c.gereserveerd],
      ["Opbrengst", euro(c.opbrengst_cent)],
      ["Bestellingen", c.bestellingen],
      ["Gescand (binnen)", c.gescand],
      ["Aangemeld voor nieuwsbrief", c.nieuwsbrief],
      ["Ticketverkoop", VERKOOP[c.verkoop] ?? c.verkoop],
    ];
    const dl = $("[data-cijfers]");
    dl.replaceChildren(...rijen.map(([k, w]) => {
      const div = document.createElement("div");
      const dt = document.createElement("dt"); dt.textContent = k;
      const dd = document.createElement("dd"); dd.textContent = w;
      div.append(dt, dd);
      return div;
    }));
    if (c.mail_niet_verstuurd > 0) melding(`Let op: bij ${c.mail_niet_verstuurd} betaalde bestelling(en) is de ticketmail nog niet verstuurd. Gebruik "Opnieuw" in de lijst.`);
    vulEvenementformulier(c.evenement);
  }

  // --- Orders --------------------------------------------------------------
  async function laadBestellingen() {
    bestellingen = await vraag("bestellingen", { evenement: slug });
    toonBestellingen();
  }

  function toonBestellingen() {
    const zoek = $("[data-zoek]").value.trim().toLowerCase();
    const status = $("[data-status]").value;
    const rijen = bestellingen.filter((o) =>
      (!status || o.status === status) &&
      (!zoek || `${o.voornaam} ${o.achternaam} ${o.email} ${o.woonplaats}`.toLowerCase().includes(zoek)));
    $("[data-aantal-rijen]").textContent = `${rijen.length} bestelling(en), ${rijen.reduce((n, o) => n + o.aantal, 0)} ticket(s)`;
    $("[data-bestellingen]").replaceChildren(...rijen.map((o) => {
      const tr = document.createElement("tr");
      tr.append(cel(datumTijd(o.aangemaakt_op)), cel(`${o.voornaam} ${o.achternaam}`), cel(o.email),
        cel(o.woonplaats), cel(o.aantal), cel(euro(o.bedrag_cent)), cel(STATUS[o.status] ?? o.status));
      const mail = cel(o.status === "betaald" ? (o.mail_verstuurd_op ? datumTijd(o.mail_verstuurd_op) : "Nog niet") : "–");
      if (o.status === "betaald") {
        const knop = document.createElement("button");
        knop.type = "button";
        knop.className = "tabel__knop";
        knop.textContent = "Opnieuw";
        knop.setAttribute("aria-label", `Ticketmail opnieuw sturen naar ${o.email}`);
        knop.addEventListener("click", async () => {
          knop.disabled = true;
          try {
            await vraag("mail_opnieuw", { order_id: o.id });
            melding(`De ticketmail is opnieuw verstuurd naar ${o.email}.`, true);
            await laadBestellingen();
          } catch (e) { melding(e.message); knop.disabled = false; }
        });
        mail.append(" ", knop);
      }
      tr.append(mail);
      return tr;
    }));
  }

  // --- Export (two CSV files, for the back-up) -------------------------------
  function csv(rijen) {
    if (!rijen.length) return "";
    const kolommen = Object.keys(rijen[0]);
    const waarde = (w) => {
      const s = w === null || w === undefined ? "" : String(w);
      // Excel would run text starting with = + - @ as a formula
      const veilig = /^[=+\-@]/.test(s) ? `'${s}` : s;
      return /[";\n]/.test(veilig) ? `"${veilig.replace(/"/g, '""')}"` : veilig;
    };
    return "﻿" + [kolommen.join(";"), ...rijen.map((r) => kolommen.map((k) => waarde(r[k])).join(";"))].join("\r\n");
  }
  function download(naam, inhoud) {
    const url = URL.createObjectURL(new Blob([inhoud], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = naam;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('[data-actie="export"]').addEventListener("click", async () => {
    try {
      const { orders, tickets } = await vraag("export", { evenement: slug });
      const vandaag = new Date().toISOString().slice(0, 10);
      download(`${vandaag}_${slug}_orders.csv`, csv(orders));
      download(`${vandaag}_${slug}_tickets.csv`, csv(tickets));
      melding("De export staat in je map Downloads. Zet hem in de afgeschermde back-upmap en verwijder hem daarna uit Downloads.", true);
    } catch (e) { melding(e.message); }
  });

  // --- Event settings --------------------------------------------------------
  const lokaal = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const formulier = $("[data-evenementformulier]");
  function vulEvenementformulier(e) {
    const f = formulier.elements;
    f.naam.value = e?.naam ?? "";
    f.slug.value = e?.slug ?? "";
    f.slug.readOnly = Boolean(e);
    f.begint_op.value = lokaal(e?.begint_op);
    f.locatie.value = e?.locatie ?? "";
    f.prijs.value = e ? (e.prijs_cent / 100).toFixed(2).replace(".", ",") : "";
    f.max_tickets.value = e?.max_tickets ?? "";
    f.max_per_bestelling.value = e?.max_per_bestelling ?? 10;
    f.verkoop_open_vanaf.value = lokaal(e?.verkoop_open_vanaf);
    f.verkoop_dicht_op.value = lokaal(e?.verkoop_dicht_op);
  }
  $('[data-actie="nieuw-evenement"]').addEventListener("click", () => {
    vulEvenementformulier(null);
    formulier.elements.naam.focus();
  });
  formulier.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = formulier.elements;
    const iso = (w) => (w ? new Date(w).toISOString() : "");
    const [heel, deel = ""] = f.prijs.value.replace(",", ".").split(".");
    try {
      const [opgeslagen] = await vraag("evenement_opslaan", { evenement: {
        naam: f.naam.value, slug: f.slug.value, locatie: f.locatie.value,
        begint_op: iso(f.begint_op.value),
        prijs_cent: Number(heel) * 100 + Number(deel.padEnd(2, "0")),
        max_tickets: Number(f.max_tickets.value), max_per_bestelling: Number(f.max_per_bestelling.value),
        verkoop_open_vanaf: iso(f.verkoop_open_vanaf.value), verkoop_dicht_op: iso(f.verkoop_dicht_op.value),
      } });
      slug = opgeslagen.slug;
      await laadEvenementen();
      await Promise.all([laadCijfers(), laadBestellingen()]);
      melding(`"${opgeslagen.naam}" is opgeslagen.`, true);
    } catch (e) { melding(e.message); }
  });

  async function laadEvenementen() {
    evenementen = await vraag("evenementen");
    const select = $("[data-evenementen]");
    select.replaceChildren(...evenementen.map((e) => new Option(e.naam, e.slug, false, e.slug === slug)));
  }
  $("[data-evenementen]").addEventListener("change", async (e) => {
    slug = e.target.value;
    melding("");
    try { await Promise.all([laadCijfers(), laadBestellingen()]); } catch (err) { melding(err.message); }
  });

  // --- Accounts --------------------------------------------------------------
  async function laadAccounts() {
    const lijst = await vraag("beheerders");
    $("[data-accounts]").replaceChildren(...lijst.map((a) => {
      const tr = document.createElement("tr");
      tr.append(cel(a.email), cel(a.rol === "kantoor" ? "Kantoor" : "Scanner"), cel(datumTijd(a.laatst_ingelogd)));
      const actie = document.createElement("td");
      if (!a.ikzelf) {
        const knop = document.createElement("button");
        knop.type = "button";
        knop.className = "tabel__knop";
        knop.textContent = "Verwijderen";
        knop.setAttribute("aria-label", `Account ${a.email} verwijderen`);
        knop.addEventListener("click", async () => {
          if (knop.dataset.zeker !== "ja") { knop.dataset.zeker = "ja"; knop.textContent = "Zeker weten?"; return; }
          try { await vraag("beheerder_verwijderen", { user_id: a.user_id }); melding(`${a.email} is verwijderd.`, true); laadAccounts(); }
          catch (e) { melding(e.message); }
        });
        actie.append(knop);
      } else {
        actie.textContent = "Jij";
      }
      tr.append(actie);
      return tr;
    }));
  }
  const accountformulier = $("[data-accountformulier]");
  accountformulier.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = accountformulier.elements;
    try {
      await vraag("beheerder_toevoegen", { email: f.email.value, wachtwoord: f.wachtwoord.value, rol: f.rol.value });
      melding(`${f.email.value} kan nu inloggen. Geef het wachtwoord persoonlijk door, niet per mail.`, true);
      accountformulier.reset();
      laadAccounts();
    } catch (e) { melding(e.message); }
  });

  $("[data-zoek]").addEventListener("input", toonBestellingen);
  $("[data-status]").addEventListener("change", toonBestellingen);

  Inloggen.start({
    rollen: ["kantoor"],
    klaar: async () => {
      try {
        await laadEvenementen();
        if (!evenementen.length) {
          vulEvenementformulier(null);
          await laadAccounts();
          return melding("Er is nog geen evenement. Vul hieronder het evenement in.", true);
        }
        if (!evenementen.some((e) => e.slug === slug)) slug = evenementen[0].slug;
        await Promise.all([laadCijfers(), laadBestellingen(), laadAccounts()]);
      } catch (e) { melding(e.message); }
    },
  });
})();
