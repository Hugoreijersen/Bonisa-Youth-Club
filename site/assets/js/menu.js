// Opens and closes the main menu on narrow screens.
// Without JavaScript the menu is simply always visible.
document.documentElement.classList.replace("geen-js", "js");

document.addEventListener("DOMContentLoaded", () => {
  const knop = document.querySelector(".menu-knop");
  const menu = document.getElementById("hoofdmenu");
  if (!knop || !menu) return;

  const zet = (open) => {
    menu.classList.toggle("is-open", open);
    knop.setAttribute("aria-expanded", String(open));
  };

  knop.addEventListener("click", () => zet(knop.getAttribute("aria-expanded") !== "true"));
  // Close after choosing a link, and with the Escape key.
  menu.addEventListener("click", (e) => { if (e.target.closest("a")) zet(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && knop.getAttribute("aria-expanded") === "true") { zet(false); knop.focus(); }
  });
});
