// Gift pages (/geven/) are only built when the build variable GIFTEN_PAGINAS
// is "aan" (see eleventy.config.js): for bonisa.nl and for local testing,
// not for jongerenzang.nl. Locally: npm run start:giften. Docs: docs/giften.md
import { readFileSync } from "node:fs";

export default function () {
  const { projecten } = JSON.parse(readFileSync(new URL("./projecten.json", import.meta.url), "utf8"));
  return {
    paginas: process.env.GIFTEN_PAGINAS === "aan",
    // Only open projects get a page and can receive gifts.
    openProjecten: projecten.filter((p) => p.open),
  };
}
