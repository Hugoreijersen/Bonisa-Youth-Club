// "Deel deze pagina": the share sheet of the phone, or else copy the link.
// The button is hidden until this script runs (without JavaScript: no button).
(() => {
  const knop = document.querySelector("[data-delen]");
  if (!knop) return;
  const melding = document.querySelector("[data-delen-melding]");
  const zeg = (tekst) => { if (melding) { melding.textContent = tekst; melding.hidden = false; } };
  const adres = location.origin + location.pathname;
  if (!navigator.share && !navigator.clipboard) return;
  knop.hidden = false;
  knop.addEventListener("click", async () => {
    try {
      if (navigator.share) await navigator.share({ title: knop.dataset.titel, url: adres });
      else { await navigator.clipboard.writeText(adres); zeg("De link is gekopieerd."); }
    } catch (fout) {
      if (fout?.name !== "AbortError") zeg(`Kopieer deze link: ${adres}`);
    }
  });
})();
