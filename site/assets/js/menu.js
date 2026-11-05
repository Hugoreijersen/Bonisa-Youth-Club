// Opens and closes the main menu on narrow screens.
// Without JavaScript the menu is simply always visible.
document.documentElement.classList.replace("geen-js", "js");

document.addEventListener("DOMContentLoaded", () => {
  // Hide the round ticket button while the big ticket button at the top is on screen.
  const groteKnop = document.querySelector(".hero .knop--oranje");
  if (groteKnop && document.querySelector(".zwevend") && "IntersectionObserver" in window) {
    // Show the round button only once the big hero button has scrolled out above the screen.
    new IntersectionObserver(([e]) => {
      const nogNietVoorbij = e.isIntersecting || e.boundingClientRect.top > 0;
      document.body.classList.toggle("grote-ticketknop-niet-voorbij", nogNietVoorbij);
    }).observe(groteKnop);
  }

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
