// Where every "Bestel je ticket" button points, based on evenement.json.
// Before the sale opens, the buttons go to the ticket block on the homepage.
import { readFileSync } from "node:fs";

export default function () {
  const { tickets } = JSON.parse(
    readFileSync(new URL("./evenement.json", import.meta.url), "utf8"),
  );
  const open = tickets.verkoopOpen === true;
  return {
    verkoopOpen: open,
    link: open ? tickets.link : "/#tickets",
    tekst: open ? "Bestel je ticket" : "Tickets",
  };
}
