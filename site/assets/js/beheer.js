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
    niet_jezelf: "Je eigen account kun je niet verwijderen of een andere rol geven.",
    ongeldige_rol: "Kies een geldige rol.",
    te_veel_mails: "Er zijn net te veel mails verstuurd. Probeer het over een uur opnieuw.",
    uitnodigen_mislukt: "De uitnodiging kon niet worden verstuurd. Controleer het e-mailadres en probeer het opnieuw.",
    al_aangemeld: "Dit account heeft al een wachtwoord gekozen.",
    ongeldig_slug: "De vaste naam mag alleen kleine letters, cijfers en streepjes bevatten.",
    ongeldige_periode: "Kies een geldige periode: de begindatum vóór de einddatum.",
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

  // --- The selected event: panel at the top and figures ----------------------
  const datumLang = (iso) => new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const veld = (naam) => root.querySelector(`[data-veld="${naam}"]`);
  let huidig = null; // the event as stored (all fields), from "overzicht"

  function toonPaneel(c) {
    const e = c.evenement;
    veld("naam").textContent = e.naam;
    veld("wanneer").textContent = `${datumLang(e.begint_op)} · ${e.locatie}`;
    veld("slug").textContent = e.slug;

    // Sales: one button that opens or closes, plus a plain explanation.
    const knop = $('[data-actie="verkoop"]');
    const pil = veld("verkoop");
    const uitleg = veld("verkoop-uitleg");
    const gepland = e.verkoop_open_vanaf && new Date(e.verkoop_open_vanaf) > new Date();
    const voorbij = new Date(e.begint_op) <= new Date();
    const status = {
      open: ["Open", "open", e.verkoop_dicht_op ? `Sluit automatisch op ${datumTijd(e.verkoop_dicht_op)}.` : "Sluit automatisch bij het begin."],
      uitverkocht: ["Uitverkocht", "open", "Alle tickets zijn verkocht. Verhoog het aantal tickets om weer te verkopen."],
      nog_niet_open: gepland ? ["Dicht", "dicht", `Opent automatisch op ${datumTijd(e.verkoop_open_vanaf)}.`] : ["Dicht", "dicht", "Bezoekers kunnen nu geen tickets bestellen."],
      gesloten: ["Dicht", "dicht", voorbij ? "Het evenement is begonnen of voorbij." : `Gesloten sinds ${datumTijd(e.verkoop_dicht_op)}.`],
    }[c.verkoop] ?? [c.verkoop, "dicht", ""];
    pil.textContent = status[0];
    pil.dataset.soort = status[1];
    uitleg.textContent = status[2];
    const isOpen = status[1] === "open";
    knop.textContent = isOpen ? "Verkoop sluiten" : "Verkoop openen";
    knop.className = isOpen ? "knop knop--klein" : "knop knop--klein knop--oranje";
    knop.hidden = voorbij;
    knop.dataset.open = isOpen ? "ja" : "nee";

    // Number of tickets
    const aantal = $("[data-aantalformulier]").elements.max_tickets;
    aantal.value = e.max_tickets;
    aantal.min = Math.max(1, c.verkocht);
    veld("verkocht").textContent = `${c.verkocht} verkocht, ${c.plaatsen_vrij} nog beschikbaar${c.gereserveerd ? `, ${c.gereserveerd} in betaling` : ""}.`;
    veld("voortgang").style.width = `${Math.min(100, Math.round((c.verkocht / e.max_tickets) * 100))}%`;
  }

  async function laadCijfers() {
    const c = await vraag("overzicht", { evenement: slug });
    huidig = c.evenement;
    toonPaneel(c);
    const rijen = [
      ["Verkocht", c.verkocht],
      ["Opbrengst", euro(c.opbrengst_cent)],
      ["Bestellingen", c.bestellingen],
      ["Binnen (gescand)", c.gescand],
      ["Nieuwsbrief", c.nieuwsbrief],
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
  const isoVan = (w) => (w ? new Date(w).toISOString() : "");
  const centen = (tekst) => {
    const [heel, deel = ""] = tekst.replace(",", ".").split(".");
    return Number(heel) * 100 + Number(deel.padEnd(2, "0"));
  };
  // The server always wants the whole event; start from what is stored.
  async function bewaar(wijzigingen, bericht) {
    const e = { ...huidig, ...wijzigingen };
    const [opgeslagen] = await vraag("evenement_opslaan", { evenement: {
      naam: e.naam, slug: e.slug, locatie: e.locatie, begint_op: e.begint_op,
      prijs_cent: e.prijs_cent, max_tickets: e.max_tickets, max_per_bestelling: e.max_per_bestelling,
      verkoop_open_vanaf: e.verkoop_open_vanaf ?? "", verkoop_dicht_op: e.verkoop_dicht_op ?? "",
    } });
    slug = opgeslagen.slug;
    await laadEvenementen();
    await laadCijfers();
    melding(bericht(opgeslagen), true);
  }

  const formulier = $("[data-evenementformulier]");
  function vulEvenementformulier(e) {
    const f = formulier.elements;
    f.naam.value = e.naam;
    f.begint_op.value = lokaal(e.begint_op);
    f.locatie.value = e.locatie;
    f.prijs.value = (e.prijs_cent / 100).toFixed(2).replace(".", ",");
    f.max_per_bestelling.value = e.max_per_bestelling;
    f.verkoop_open_vanaf.value = lokaal(e.verkoop_open_vanaf);
    f.verkoop_dicht_op.value = lokaal(e.verkoop_dicht_op);
  }
  formulier.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = formulier.elements;
    try {
      await bewaar({
        naam: f.naam.value, locatie: f.locatie.value, begint_op: isoVan(f.begint_op.value),
        prijs_cent: centen(f.prijs.value), max_per_bestelling: Number(f.max_per_bestelling.value),
        verkoop_open_vanaf: isoVan(f.verkoop_open_vanaf.value) || null, verkoop_dicht_op: isoVan(f.verkoop_dicht_op.value) || null,
      }, (e) => `De gegevens van "${e.naam}" zijn opgeslagen.`);
    } catch (e) { melding(e.message); }
  });

  // Open or close the sales with one button.
  $('[data-actie="verkoop"]').addEventListener("click", async (ev) => {
    const knop = ev.currentTarget;
    const openen = knop.dataset.open !== "ja";
    const nu = Date.now();
    knop.disabled = true;
    try {
      await bewaar(openen
        ? {
          // A minute back, so a slightly fast computer clock cannot keep it closed.
          verkoop_open_vanaf: new Date(nu - 60_000).toISOString(),
          verkoop_dicht_op: huidig.verkoop_dicht_op && new Date(huidig.verkoop_dicht_op) <= new Date(nu) ? null : huidig.verkoop_dicht_op,
        }
        : { verkoop_open_vanaf: null },
      () => (openen ? "De ticketverkoop is open." : "De ticketverkoop is dicht."));
    } catch (e) { melding(e.message); } finally { knop.disabled = false; }
  });

  // Change the number of tickets.
  const aantalformulier = $("[data-aantalformulier]");
  aantalformulier.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const max = Number(aantalformulier.elements.max_tickets.value);
    try { await bewaar({ max_tickets: max }, () => `Er zijn nu ${max} tickets.`); } catch (e) { melding(e.message); }
  });

  // New event: separate form, the selected event stays editable.
  const nieuwblok = $("[data-nieuwblok]");
  const nieuwformulier = $("[data-nieuwformulier]");
  $('[data-actie="nieuw-evenement"]').addEventListener("click", () => {
    nieuwblok.hidden = false;
    nieuwformulier.elements.naam.focus();
  });
  $('[data-actie="annuleer-nieuw"]').addEventListener("click", () => {
    nieuwformulier.reset();
    nieuwblok.hidden = true;
  });
  nieuwformulier.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = nieuwformulier.elements;
    if (evenementen.some((e) => e.slug === f.slug.value)) return melding("Er is al een evenement met deze vaste naam. Kies een andere.");
    try {
      const [nieuw] = await vraag("evenement_opslaan", { evenement: {
        naam: f.naam.value, slug: f.slug.value, locatie: f.locatie.value, begint_op: isoVan(f.begint_op.value),
        prijs_cent: centen(f.prijs.value), max_tickets: Number(f.max_tickets.value),
        max_per_bestelling: Number(f.max_per_bestelling.value), verkoop_open_vanaf: "", verkoop_dicht_op: "",
      } });
      slug = nieuw.slug;
      nieuwformulier.reset();
      nieuwblok.hidden = true;
      root.querySelectorAll("[data-paneel], [data-heeft-evenement], [data-actie='annuleer-nieuw']").forEach((el) => { el.hidden = false; });
      await laadEvenementen();
      await toonEvenement();
      melding(`"${nieuw.naam}" is aangemaakt. De verkoop staat nog dicht.`, true);
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
    try { await toonEvenement(); } catch (err) { melding(err.message); }
  });
  async function toonEvenement() {
    $("[data-zoek]").value = "";
    await Promise.all([laadCijfers(), laadBestellingen()]);
  }

  // --- Accounts --------------------------------------------------------------
  async function laadAccounts() {
    const lijst = await vraag("beheerders");
    $("[data-accounts]").replaceChildren(...lijst.map((a) => {
      const tr = document.createElement("tr");
      tr.append(cel(a.email), rolCel(a), cel(a.uitnodiging_open ? "Uitgenodigd, nog niet aangemeld" : datumTijd(a.laatst_ingelogd)));
      const actie = document.createElement("td");
      if (a.uitnodiging_open) {
        const opnieuw = document.createElement("button");
        opnieuw.type = "button";
        opnieuw.className = "tabel__knop";
        opnieuw.textContent = "Opnieuw uitnodigen";
        opnieuw.setAttribute("aria-label", `${a.email} opnieuw uitnodigen`);
        opnieuw.addEventListener("click", async () => {
          opnieuw.disabled = true;
          try { await vraag("uitnodiging_opnieuw", { user_id: a.user_id }); melding(`De uitnodiging is opnieuw verstuurd naar ${a.email}.`, true); }
          catch (e) { melding(e.message); }
          finally { opnieuw.disabled = false; }
        });
        actie.append(opnieuw, " ");
      }
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
  // The role of another account can be changed right in the table; your own not
  // (so you cannot lock yourself out). "Geen rol": the account exists but can
  // use neither page, for example after accepting an invitation.
  const ROLNAAM = { kantoor: "Kantoor", scanner: "Scanner" };
  function rolCel(a) {
    const td = document.createElement("td");
    if (a.ikzelf) { td.textContent = ROLNAAM[a.rol] ?? "Geen rol"; return td; }
    const keuze = document.createElement("select");
    keuze.className = "tabel__knop";
    keuze.setAttribute("aria-label", `Rol van ${a.email}`);
    for (const [waarde, naam] of [["geen", "Geen rol"], ["scanner", "Scanner"], ["kantoor", "Kantoor"]]) {
      keuze.append(new Option(naam, waarde, false, (a.rol ?? "geen") === waarde));
    }
    keuze.addEventListener("change", async () => {
      keuze.disabled = true;
      try {
        await vraag("rol_wijzigen", { user_id: a.user_id, rol: keuze.value });
        melding(keuze.value === "geen" ? `${a.email} heeft nu geen toegang meer.` : `${a.email} heeft nu de rol ${ROLNAAM[keuze.value]}.`, true);
        laadAccounts();
      } catch (e) { melding(e.message); keuze.value = a.rol ?? "geen"; }
      finally { keuze.disabled = false; }
    });
    td.append(keuze);
    return td;
  }

  const accountformulier = $("[data-accountformulier]");
  accountformulier.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = accountformulier.elements;
    try {
      const knop = accountformulier.querySelector("button");
      knop.disabled = true;
      const uit = await vraag("beheerder_toevoegen", { email: f.email.value, rol: f.rol.value }).finally(() => { knop.disabled = false; });
      melding(uit.uitgenodigd
        ? `Uitnodiging verstuurd naar ${f.email.value}. Diegene kiest via de link in de mail zelf een wachtwoord.`
        : `${f.email.value} had al een account en heeft nu de rol ${ROLNAAM[f.rol.value]}.`, true);
      accountformulier.reset();
      laadAccounts();
    } catch (e) { melding(e.message); }
  });

  // --- Gifts (bonisa.nl, docs/giften.md) ---------------------------------------
  const MAANDSTATUS = { actief: "Actief", gestopt: "Gestopt" };
  async function laadGiften() {
    const [overzicht, maand] = await Promise.all([vraag("giften_overzicht"), vraag("periodieke_giften")]);
    $("[data-giftenoverzicht]").replaceChildren(...(overzicht.length ? overzicht.map((p) => {
      const tr = document.createElement("tr");
      tr.append(cel(p.project_naam), cel(euro(p.opgehaald_cent)), cel(String(p.giften)), cel(String(p.maandelijks_actief)));
      return tr;
    }) : [Object.assign(document.createElement("tr"), { innerHTML: '<td colspan="4">Nog geen giften.</td>' })]));

    $("[data-maandgiften]").replaceChildren(...maand.map((m) => {
      const tr = document.createElement("tr");
      const status = m.status === "gestopt" && m.gestopt_op
        ? `Gestopt ${datumTijd(m.gestopt_op)} (${m.gestopt_door === "gever" ? "door gever" : "door kantoor"})`
        : MAANDSTATUS[m.status] ?? m.status;
      tr.append(cel(`${m.voornaam} ${m.achternaam}`), cel(m.email), cel(m.project), cel(euro(m.bedrag_cent)),
        cel(euro(m.betaald_cent)), cel(status));
      const actie = document.createElement("td");
      if (m.status === "actief") {
        const knop = document.createElement("button");
        knop.type = "button";
        knop.className = "tabel__knop";
        knop.textContent = "Stoppen";
        knop.setAttribute("aria-label", `Maandelijkse gift van ${m.voornaam} ${m.achternaam} stoppen`);
        knop.addEventListener("click", async () => {
          if (knop.dataset.zeker !== "ja") { knop.dataset.zeker = "ja"; knop.textContent = "Zeker weten?"; return; }
          try {
            await vraag("periodiek_stoppen", { id: m.id });
            melding(`De maandelijkse gift van ${m.voornaam} ${m.achternaam} is gestopt, ook bij Mollie.`, true);
            laadGiften();
          } catch (e) { melding(e.message); }
        });
        actie.append(knop);
      }
      tr.append(actie);
      return tr;
    }));
  }

  const giftenexport = $("[data-giftenexport]");
  {
    // Default period: the previous calendar month.
    const nu = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const eerste = new Date(nu.getFullYear(), nu.getMonth() - 1, 1);
    const laatste = new Date(nu.getFullYear(), nu.getMonth(), 0);
    giftenexport.elements.van.value = `${eerste.getFullYear()}-${p(eerste.getMonth() + 1)}-01`;
    giftenexport.elements.tot.value = `${laatste.getFullYear()}-${p(laatste.getMonth() + 1)}-${p(laatste.getDate())}`;
  }
  giftenexport.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const { van, tot } = giftenexport.elements;
    try {
      const rijen = await vraag("giften_export", { van: van.value, tot: tot.value });
      if (!rijen.length) return melding("Geen giften in deze periode.", true);
      download(`giften_${van.value}_tot_${tot.value}.csv`, csv(rijen));
      melding("De export staat in je map Downloads. Verwijder hem daar na gebruik.", true);
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
          // Nothing to show yet: only the form for a new event and the accounts.
          root.querySelectorAll("[data-paneel], [data-heeft-evenement]").forEach((el) => { el.hidden = true; });
          nieuwblok.hidden = false;
          $('[data-actie="annuleer-nieuw"]').hidden = true;
          await Promise.all([laadAccounts(), laadGiften()]);
          return melding("Er is nog geen evenement. Maak hieronder het eerste evenement aan.", true);
        }
        if (!evenementen.some((e) => e.slug === slug)) slug = evenementen[0].slug;
        await Promise.all([laadCijfers(), laadBestellingen(), laadAccounts(), laadGiften()]);
      } catch (e) { melding(e.message); }
    },
  });
})();
