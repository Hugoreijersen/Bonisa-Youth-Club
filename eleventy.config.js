// Eleventy configuration for jongerenzang.nl.
// Explanation in Dutch: docs/hoe-de-site-werkt.md
import { EleventyRenderPlugin } from "@11ty/eleventy";
import Image, { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const TIMEZONE = "Europe/Amsterdam";

export default function (eleventyConfig) {
  // Files copied as-is to the built site.
  eleventyConfig.addPassthroughCopy({
    "site/assets/css": "assets/css",
    "site/assets/js": "assets/js",
    "site/assets/fonts": "assets/fonts",
    "site/assets/docs": "assets/docs",
    // Video and sound (look-back). Max. 25 MB per file (Cloudflare limit).
    "site/assets/media": "assets/media",
  });

  // Every <img> in the output is resized, converted to WebP and stripped of
  // all metadata (EXIF, GPS). Originals in site/assets/img are never published.
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["webp", "auto"],
    widths: [480, 960, 1600],
    urlPath: "/assets/img/",
    outputDir: "_site/assets/img/",
    failOnError: true,
    // Logos stay vector files (no webp copies).
    svgShortCircuit: true,
    htmlOptions: {
      imgAttributes: { loading: "lazy", decoding: "async", sizes: "100vw" },
    },
  });

  // URL of the image shown when the site is shared (WhatsApp, social media).
  eleventyConfig.addAsyncShortcode("deelfoto", async (src) => {
    const meta = await Image(`site${src}`, {
      widths: [1200],
      formats: ["jpeg"],
      urlPath: "/assets/img/",
      outputDir: "_site/assets/img/",
    });
    return meta.jpeg[0].url;
  });

  // Adds the filter `renderContent`, used to turn the markdown text from the
  // content files into HTML: {{ tekst | renderContent("md") | safe }}
  eleventyConfig.addPlugin(EleventyRenderPlugin);

  // Dates are stored as "2027-05-21" and shown as "vrijdag 21 mei 2027".
  const datum = (iso, opties) =>
    new Intl.DateTimeFormat("nl-NL", { timeZone: TIMEZONE, ...opties })
      .format(new Date(`${iso}T12:00:00Z`));
  eleventyConfig.addFilter("datumLang", (iso) =>
    datum(iso, { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  eleventyConfig.addFilter("datumKort", (iso) =>
    datum(iso, { weekday: "long", day: "numeric", month: "long" }));

  // 4.5 -> "€ 4,50"
  eleventyConfig.addFilter("euro", (bedrag) =>
    new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" })
      .format(Number(bedrag)));

  // 25 -> "€ 25", 12.5 -> "€ 12,50" (amount buttons on the gift pages)
  eleventyConfig.addFilter("euroKort", (bedrag) =>
    new Intl.NumberFormat("nl-NL", {
      style: "currency", currency: "EUR", minimumFractionDigits: Number.isInteger(Number(bedrag)) ? 0 : 2,
    }).format(Number(bedrag)));

  // Gift pages (/geven/, bonisa.nl) only with the build variable
  // GIFTEN_PAGINAS=aan; jongerenzang.nl is built without them. docs/giften.md
  // The same goes for the sponsor pages of the Ontmoetingsreis.
  if (process.env.GIFTEN_PAGINAS !== "aan") {
    eleventyConfig.ignores.add("site/geven/**");
    eleventyConfig.ignores.add("site/ontmoetingsreis/**");
  }

  // "Recht" -> "recht" (for the theme words in the hero)
  // Adds ?v=<hash of the file> to /assets/ links. Those files are cached for a
  // year (site/_headers.njk), so a changed file needs a new address.
  eleventyConfig.addFilter("versie", (pad) => {
    const inhoud = readFileSync(`site${pad}`);
    return `${pad}?v=${createHash("sha256").update(inhoud).digest("hex").slice(0, 10)}`;
  });
  eleventyConfig.addFilter("klein", (s) => String(s ?? "").toLocaleLowerCase("nl-NL"));

  return {
    dir: { input: "site", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk",
  };
}
