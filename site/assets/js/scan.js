// Scan page: reads QR codes with the camera (jsQR) and checks each ticket.
// Green = let in. Red = do not let in (already scanned, unknown, refunded).
(() => {
  const root = document.querySelector("[data-inloggen]");
  if (!root || !window.jsQR) return;

  const evenement = root.dataset.evenement;
  const video = root.querySelector("[data-video]");
  const cameraKnop = root.querySelector('[data-actie="camera"]');
  const uitslag = root.querySelector("[data-uitslag]");
  const veld = (naam) => root.querySelector(`[data-veld="${naam}"]`);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const tijd = (iso) => new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const TEKSTEN = {
    geldig: (u) => ["Welkom! Ticket geldig", `${u.voornaam}, ticket ${u.volgnummer} van ${u.aantal}`],
    al_gescand: (u) => ["Al gescand", `Dit ticket is om ${tijd(u.gescand_op)} al gebruikt. Niet nog een keer binnenlaten.`],
    onbekend: () => ["Onbekende code", "Dit is geen ticket van ons. Vraag naar de ticketmail."],
    ongeldig: () => ["Ticket niet geldig", "De bestelling is terugbetaald of niet betaald."],
    ander_evenement: () => ["Ander evenement", "Dit ticket is niet voor deze avond."],
    fout: () => ["Controle mislukt", "Geen verbinding. Probeer het opnieuw."],
  };

  let bezig = false;
  let laatste = { code: "", tijd: 0 };

  function toon(soort, titel, details) {
    uitslag.dataset.soort = soort;
    veld("titel").textContent = titel;
    veld("details").textContent = details;
    if (navigator.vibrate) navigator.vibrate(soort === "goed" ? 80 : [200, 100, 200]);
  }

  async function controleer(code) {
    const schoon = code.trim().toLowerCase();
    // The same code twice in a row within 4 seconds: the camera saw it again.
    if (schoon === laatste.code && Date.now() - laatste.tijd < 4000) return;
    laatste = { code: schoon, tijd: Date.now() };
    bezig = true;
    try {
      const { ok, data } = await Inloggen.functie("scan", { evenement, code: schoon });
      const soort = ok ? data.resultaat : "fout";
      const [titel, details] = (TEKSTEN[soort] ?? TEKSTEN.fout)(data);
      toon(soort === "geldig" ? "goed" : "fout", titel, details);
      if (ok && data.binnen !== undefined) {
        veld("binnen").textContent = data.binnen;
        veld("verkocht").textContent = data.verkocht;
      }
    } catch (e) {
      if (e.message !== "niet_ingelogd") toon("fout", ...TEKSTEN.fout());
    } finally {
      bezig = false;
    }
  }

  function kijk() {
    if (video.readyState >= 2 && !bezig) {
      const breedte = Math.min(video.videoWidth, 720);
      const hoogte = Math.round(video.videoHeight * (breedte / video.videoWidth));
      canvas.width = breedte;
      canvas.height = hoogte;
      ctx.drawImage(video, 0, 0, breedte, hoogte);
      const beeld = ctx.getImageData(0, 0, breedte, hoogte);
      const qr = jsQR(beeld.data, breedte, hoogte, { inversionAttempts: "dontInvert" });
      if (qr?.data) controleer(qr.data);
    }
    setTimeout(() => requestAnimationFrame(kijk), 150);
  }

  cameraKnop.addEventListener("click", async () => {
    try {
      video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      await video.play();
      cameraKnop.hidden = true;
      kijk();
    } catch {
      toon("fout", "Camera werkt niet", "Geef de browser toestemming voor de camera, of voer de code met de hand in.");
    }
  });

  root.querySelector("[data-handmatig]").addEventListener("submit", (e) => {
    e.preventDefault();
    const invoer = e.target.elements.code;
    laatste = { code: "", tijd: 0 };
    controleer(invoer.value.replace(/\s+/g, ""));
    invoer.value = "";
  });

  Inloggen.start({ rollen: ["scanner", "kantoor"], klaar: () => {} });
})();
