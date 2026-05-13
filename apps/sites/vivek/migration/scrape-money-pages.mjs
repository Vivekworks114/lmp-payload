#!/usr/bin/env node
// One-off scraper for the 2,632 ZBMP pages on keukenfaqs.nl.
// 3 workers × 500ms pause. Writes migration/scraped/money-pages/{slug}.json.

import { mkdir, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRAPED_DIR = path.join(__dirname, "scraped");
const OUT_DIR = path.join(SCRAPED_DIR, "money-pages");
const ERROR_LOG = path.join(SCRAPED_DIR, "errors.log");
const SITEMAP_URL = "https://keukenfaqs.nl/zb_mp-sitemap.xml";
const CONCURRENCY = 3;
const WORKER_PAUSE_MS = 500;
const MAX_HTML_SAMPLE = 50_000;
const UA = "keukenfaqs-migration/1.0 (site rebuild scrape)";
const RETRY_DELAY_MS = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decodeEntities = (s) =>
  (s ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#x27;/g, "'")
    .replace(/&hellip;/g, "…")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8220;|&#8221;/g, '"');

const stripTags = (html) =>
  decodeEntities((html ?? "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const firstMatch = (html, re) => {
  const m = html.match(re);
  return m ? m[1] : null;
};

const extractMeta = (html, name) =>
  decodeEntities(
    firstMatch(
      html,
      new RegExp(
        `<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`,
        "i"
      )
    ) || ""
  ) || null;

function detectType(html, title) {
  if (title && /\[zb_mp_/.test(title)) return "unknown";
  if (/<h1[^>]*>\s*Top 10 beste /i.test(html)) return "top10";
  if (/elementor-widget-star-rating/.test(html)) return "product";
  if (/is een [A-Z][a-zA-Z]+ gelegen aan/.test(html)) return "business";
  return "unknown";
}

function extractFaqFromJsonLd(html) {
  const blocks = [...html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )];
  for (const b of blocks) {
    const raw = b[1].trim();
    try {
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const graph = item["@graph"] || [item];
        for (const node of graph) {
          if (node && node["@type"] === "FAQPage" && Array.isArray(node.mainEntity)) {
            return node.mainEntity.map((q) => ({
              question: decodeEntities(q.name || ""),
              answer_html: decodeEntities(q.acceptedAnswer?.text || ""),
            }));
          }
        }
      }
    } catch {
      // non-JSON or nested — try loose regex fallback below
    }
  }
  return [];
}

function extractPublishedAndUpdated(html) {
  const pub = firstMatch(html, /Gepubliceerd op:\s*([^<]+?)(?=<|\|)/i);
  const upd = firstMatch(html, /Laatst bijgewerkt:\s*([^<]+?)(?=<|\|)/i);
  return {
    published_at: pub ? pub.trim() : null,
    last_updated: upd ? upd.trim() : null,
  };
}

function extractTop10(html) {
  // Intro: text of the first text-editor widget after the H1 but before product 1.
  const h1End = html.search(/<\/h1>/);
  const afterH1 = h1End >= 0 ? html.slice(h1End) : html;
  const introMatch = afterH1.match(
    /<div class="elementor-widget-container">\s*<p>([\s\S]*?)<\/p>/
  );
  const intro = introMatch ? stripTags(introMatch[1]) : null;

  // Each product block is bounded by a numbered H2 and the button that follows it.
  const products = [];
  const h2Re =
    /<h2 class="elementor-heading-title elementor-size-default">(?:<span>)?\s*(\d+)\.\s*([\s\S]*?)(?:<\/span>)?\s*<\/h2>/g;
  let match;
  while ((match = h2Re.exec(html)) !== null) {
    const rank = parseInt(match[1], 10);
    if (rank < 1 || rank > 10) continue;
    const name = stripTags(match[2]);
    const start = match.index + match[0].length;
    // Find bounds to the next numbered H2 (or end)
    h2Re.lastIndex = start;
    const nextMatch = h2Re.exec(html);
    const end = nextMatch ? nextMatch.index : Math.min(start + 5000, html.length);
    h2Re.lastIndex = match.index + match[0].length;
    const block = html.slice(start, end);

    const imgUrl =
      firstMatch(block, /<img[^>]*src=["']([^"']+)["']/i) || null;
    const affiliateUrl = firstMatch(
      block,
      /<a[^>]*class=["'][^"']*elementor-button[^"']*["'][^>]*href=["']([^"']+)["']/i
    );
    const descMatch = block.match(
      /<div[^>]*id=["']omschrijving-tab["'][^>]*>([\s\S]*?)<\/div>/
    );
    const description = descMatch ? stripTags(descMatch[1]) : null;

    const affiliate_network = affiliateUrl?.includes("partner.bol.com")
      ? "bol"
      : affiliateUrl?.includes("awin1.com")
      ? "awin"
      : affiliateUrl
      ? "other"
      : null;

    products.push({
      rank,
      name,
      image_url: imgUrl,
      description,
      affiliate_url: affiliateUrl,
      affiliate_network,
    });
  }

  // Dedupe by rank (regex may match the numbered spans twice across span/no-span forms)
  const seen = new Set();
  const uniq = [];
  for (const p of products) {
    if (seen.has(p.rank)) continue;
    seen.add(p.rank);
    uniq.push(p);
  }

  // Category names: pulled from meta description pattern
  // "Ontdek hier de TOP 10 van de beste X. Complete X vergelijking om de BESTE Y te vinden"
  const metaDesc = extractMeta(html, "description") || "";
  const catPluralMatch = metaDesc.match(/TOP 10 van de beste ([^.]+?)\./i);
  const catSingularMatch = metaDesc.match(/om de BESTE ([^.]+?) te vinden/i);

  return {
    category_singular: catSingularMatch ? catSingularMatch[1].trim() : null,
    category_plural: catPluralMatch ? catPluralMatch[1].trim() : null,
    intro,
    products: uniq.sort((a, b) => a.rank - b.rank),
    faq: extractFaqFromJsonLd(html),
    conclusion: null, // the "Conclusie" section text — optional, leave null
  };
}

function extractProduct(html) {
  const h1Raw = firstMatch(html, /<h1[^>]*class=["'][^"']*elementor-heading-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/);
  const h1 = stripTags(h1Raw || "");
  // Try "Categorie Name…" split: first space-delimited word before a brand/spec
  const catSplit = h1.match(/^(\S+)\s+(.+)$/);
  const category = catSplit ? catSplit[1] : null;
  const name = catSplit ? catSplit[2] : h1;

  const ratingMatch = html.match(
    /<span itemprop=["']ratingValue["'][^>]*>\s*Waardering\s+(\d+(?:[.,]\d+)?)\s+van\s+(\d+)/i
  );
  const rating = ratingMatch ? parseFloat(ratingMatch[1].replace(",", ".")) : null;
  const rating_out_of = ratingMatch ? parseInt(ratingMatch[2], 10) : null;

  // Intro: first text-editor <p> after the rating widget (or after H1 if no rating)
  const anchor = ratingMatch
    ? html.indexOf(ratingMatch[0]) + ratingMatch[0].length
    : (html.search(/<\/h1>/) + 5) || 0;
  const afterAnchor = html.slice(anchor);
  const introMatch = afterAnchor.match(
    /<div class="elementor-widget-container">\s*<p>([\s\S]*?)<\/p>/
  );
  const intro = introMatch ? stripTags(introMatch[1]) : null;

  // Affiliate CTA button: "Bekijk de prijs"
  const btnMatch = html.match(
    /<a[^>]*class=["'][^"']*elementor-button[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<span class=["']elementor-button-text["']>([^<]+)<\/span>/
  );
  const affiliate_url = btnMatch ? btnMatch[1] : null;
  const affiliate_cta = btnMatch ? decodeEntities(btnMatch[2]).trim() : null;
  const affiliate_network = affiliate_url?.includes("partner.bol.com")
    ? "bol"
    : affiliate_url?.includes("awin1.com")
    ? "awin"
    : affiliate_url
    ? "other"
    : null;

  // Image: first product image (hotlinked from images.myfreeimagehost.com)
  const imageMatch = html.match(
    /<img[^>]*src=["'](https:\/\/images\.myfreeimagehost\.com\/[^"']+)["']/
  );
  const image_url = imageMatch ? imageMatch[1] : null;

  // Specs: sibling 2-cell rows in the Elementor spec grid.
  // Each row is an inner-section with two columns, each column is a text-editor <p>Label</p> / <p>Value</p>.
  // Collect every text-editor <p>…</p> in order within the body area and pair up.
  const specsHtml = (() => {
    const omsrijIdx = html.search(/>Omschrijving van de /);
    const region = html.slice(0, omsrijIdx >= 0 ? omsrijIdx : html.length);
    return region;
  })();
  const specCells = [...specsHtml.matchAll(
    /<div class=["']elementor-element[^"']*elementor-widget elementor-widget-text-editor["'][\s\S]*?<div class="elementor-widget-container">\s*<p>([\s\S]*?)<\/p>\s*<\/div>/g
  )].map((m) => stripTags(m[1]));
  // Drop the intro cell (already captured)
  const specCellsFiltered = intro
    ? specCells.filter((v) => v && v !== intro)
    : specCells;
  const specs = [];
  for (let i = 0; i + 1 < specCellsFiltered.length; i += 2) {
    const label = specCellsFiltered[i];
    const value = specCellsFiltered[i + 1];
    if (!label || !value) continue;
    // Drop obvious non-spec text (long descriptions)
    if (label.length > 40) continue;
    specs.push({ label, value });
  }

  // Description: <h2>Omschrijving van de …</h2> + next <p>
  const descMatch = html.match(
    />Omschrijving van de [^<]+<\/h2>\s*<\/div>\s*<\/div>\s*<div[^>]*widget-text-editor[^>]*>\s*<div class="elementor-widget-container">\s*<p>([\s\S]*?)<\/p>/
  );
  const description = descMatch ? stripTags(descMatch[1]) : null;

  // Pluspunten / Minpunten lists
  const pros = extractBulletList(html, "Pluspunten");
  const cons = extractBulletList(html, "Minpunten");

  return {
    category,
    name,
    intro,
    rating,
    rating_out_of,
    image_url,
    affiliate_url,
    affiliate_network,
    affiliate_cta,
    specs,
    description,
    pros,
    cons,
  };
}

function extractBulletList(html, label) {
  const re = new RegExp(
    `>${label}</span>[\\s\\S]*?<ul>([\\s\\S]*?)</ul>`
  );
  const m = html.match(re);
  if (!m) return [];
  return [...m[1].matchAll(/<li>([\s\S]*?)<\/li>/g)]
    .map((x) => stripTags(x[1]))
    .filter(Boolean);
}

function extractBusiness(html) {
  const h1 = stripTags(
    firstMatch(html, /<h1[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/) ||
      firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/) ||
      ""
  );

  // Intro paragraph: "X is een [A-Z][a-zA-Z]+ gelegen aan ADDRESS in CITY."
  const introMatch = html.match(
    /<p>([^<]*?is een [A-Z][a-zA-Z]+ gelegen aan[^<]+?)<\/p>/
  );
  const intro = introMatch ? stripTags(introMatch[1]) : null;

  let address = null;
  let city = null;
  if (intro) {
    const m = intro.match(/gelegen aan\s+(.+?)\s+in\s+([^.]+?)\.?$/);
    if (m) {
      address = m[1].trim();
      city = m[2].trim();
    }
  }

  // External business website (non-affiliate, non-maps, non-keukenfaqs)
  const websiteMatch = html.match(
    /<a[^>]*href=["'](https?:\/\/(?!(?:www\.)?google\.com\/maps|keukenfaqs\.nl|gmpg\.org|partner\.bol\.com|www\.awin1\.com)[^"']+)["'][^>]*target=["']_blank["']/
  );
  const website_url = websiteMatch ? websiteMatch[1] : null;

  // Google Maps URL with coordinates
  const mapsMatch = html.match(
    /<a[^>]*href=["'](https:\/\/www\.google\.com\/maps\/place\/[^"']+)["']/
  );
  const google_maps_url = mapsMatch ? mapsMatch[1] : null;

  return { name: h1, city, address, website_url, google_maps_url, intro };
}

async function fetchWithRetry(url) {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, "accept-language": "nl,en;q=0.8" },
      redirect: "follow",
    });
    return res;
  } catch (err) {
    await sleep(RETRY_DELAY_MS);
    return fetch(url, {
      headers: { "user-agent": UA, "accept-language": "nl,en;q=0.8" },
      redirect: "follow",
    });
  }
}

async function scrapeOne(url) {
  let res = await fetchWithRetry(url);
  if (!res.ok) {
    await sleep(RETRY_DELAY_MS);
    res = await fetchWithRetry(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }
  const html = await res.text();

  const u = new URL(url);
  const slug = u.pathname.replace(/^\/+|\/+$/g, "");
  const title = decodeEntities(firstMatch(html, /<title>([\s\S]*?)<\/title>/) || "").trim();
  const h1 = stripTags(firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/) || "");
  const page_type = detectType(html, title);
  const { published_at, last_updated } = extractPublishedAndUpdated(html);

  const data = {
    url,
    slug,
    page_type,
    title,
    h1,
    meta_description: extractMeta(html, "description"),
    og_description: extractMeta(html, "og:description"),
    published_at,
    last_updated,
    top10: page_type === "top10" ? extractTop10(html) : null,
    product: page_type === "product" ? extractProduct(html) : null,
    business: page_type === "business" ? extractBusiness(html) : null,
    raw_html_sample: html.slice(0, MAX_HTML_SAMPLE),
    scrape: {
      fetched_at: new Date().toISOString(),
      http_status: res.status,
      content_hash: "sha256:" + createHash("sha256").update(html).digest("hex"),
      html_bytes: Buffer.byteLength(html, "utf8"),
    },
  };

  const safeSlug = slug.length ? slug : "root";
  const outFile = path.join(OUT_DIR, `${safeSlug}.json`);
  await writeFile(outFile, JSON.stringify(data, null, 2));
  return data;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let urls;
  const urlListPath = process.env.SCRAPE_URL_LIST;
  if (urlListPath) {
    const { readFile } = await import("node:fs/promises");
    const text = await readFile(urlListPath, "utf8");
    urls = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    // Retry mode: do NOT truncate errors.log — append only.
  } else {
    await writeFile(ERROR_LOG, "");
    const sitemapRes = await fetch(SITEMAP_URL, {
      headers: { "user-agent": UA },
    });
    const xml = await sitemapRes.text();
    urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  }
  const limit = parseInt(process.env.SCRAPE_LIMIT || "0", 10);
  if (limit > 0) {
    // Sample: first, last, and middle slice so smoke-tests hit all templates.
    const step = Math.max(1, Math.floor(urls.length / limit));
    urls = urls.filter((_, i) => i % step === 0).slice(0, limit);
  }
  console.log(`[start] ${urls.length} URLs, concurrency=${CONCURRENCY}, pause=${WORKER_PAUSE_MS}ms`);

  const state = {
    done: 0,
    success: 0,
    errors: 0,
    types: { top10: 0, product: 0, business: 0, unknown: 0 },
  };
  const queue = urls.slice();

  async function worker(id) {
    while (queue.length) {
      const url = queue.shift();
      if (!url) break;
      try {
        const { page_type } = await scrapeOne(url);
        state.success++;
        state.types[page_type] = (state.types[page_type] || 0) + 1;
      } catch (err) {
        state.errors++;
        await appendFile(
          ERROR_LOG,
          `${new Date().toISOString()}\t${url}\t${err.message}\n`
        );
      }
      state.done++;
      if (state.done % 100 === 0) {
        console.log(
          `[progress] ${state.done}/${urls.length} | ok=${state.success} err=${state.errors} | ${JSON.stringify(state.types)}`
        );
      }
      await sleep(WORKER_PAUSE_MS);
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1));
  await Promise.all(workers);

  console.log(`\n[done] total=${state.done} success=${state.success} errors=${state.errors}`);
  console.log(`[done] by type: ${JSON.stringify(state.types)}`);
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
