// Gift pages (/geven/ and /ontmoetingsreis/) are only built when the build
// variable GIFTEN_PAGINAS is "aan" (see eleventy.config.js): for bonisa.nl and
// for local testing, not for jongerenzang.nl. Locally: npm run start:giften.
// Docs: docs/giften.md and docs/ontmoetingsreis.md
import { readFileSync } from "node:fs";

const lees = (naam) => JSON.parse(readFileSync(new URL(`./${naam}.json`, import.meta.url), "utf8"));

export default function () {
  const { projecten } = lees("projecten");
  const reis = lees("ontmoetingsreis");
  // Every participant of the trip is a gift project of their own
  // ("reis-<slug>"), so gifts, progress and the export are per participant.
  const reisDeelnemers = reis.deelnemers.filter((d) => d.open).map((d) => ({
    ...d,
    project: {
      slug: `reis-${d.slug}`,
      naam: `${reis.titel}: ${d.voornaam}`,
      doel: reis.doelPerDeelnemer,
      bank: d.bank,
    },
  }));
  return {
    paginas: process.env.GIFTEN_PAGINAS === "aan",
    // Only open projects get a page and can receive gifts.
    openProjecten: projecten.filter((p) => p.open),
    reisDeelnemers,
    // The whole group together: one progress bar on /ontmoetingsreis/.
    reisGroep: {
      slug: reisDeelnemers.map((d) => d.project.slug).join(","),
      naam: reis.titel,
      doel: reis.doelPerDeelnemer * reisDeelnemers.length,
      bank: reisDeelnemers.reduce((som, d) => som + (Number(d.bank) || 0), 0),
    },
  };
}
