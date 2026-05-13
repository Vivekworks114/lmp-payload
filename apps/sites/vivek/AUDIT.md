# keukenfaqs.nl — Audit of Existing WordPress Site

_Audit date: 2026-04-21. Purpose: inventory the existing site before rebuilding in Astro._

## TL;DR — Total Inventory

| Content type                            | Count     |
| --------------------------------------- | --------- |
| Blog posts (`post-sitemap.xml`)         | **47**    |
| Pages (`page-sitemap.xml`)              | **22**    |
| Categories (`category-sitemap.xml`)     | **1**     |
| Authors (`author-sitemap.xml`)          | **1**     |
| Money pages — `zb_mp` (affiliate)       | **2,632** |
| **Grand total of indexed URLs**         | **~2,703** |

**The site is ~97% programmatically generated affiliate "money pages"** (top-10 product roundups) produced by a custom plugin with the `zbmp` / `zb_mp_` prefix. The editorial content (47 blog posts + 22 pages) is the small tail.

---

## 1. Homepage Overview (https://keukenfaqs.nl/)

- **Language:** Dutch (Nederlands).
- **Tagline / hero H1:** _"Al jouw vragen over keukens worden hier beantwoord!"_
- **Structure:**
  1. Hero with tagline
  2. Category grid — 8 tiles with image + CTA
  3. Tagline section — _"Samen kokkerellen in jouw perfecte keuken"_
  4. "Blogs over koken" — recent-posts grid
  5. Brand statement block
  6. Footer
- **Design:** Light theme, white background with navy / dark blue accents. Sans-serif typography. Clean, contemporary, minimalist. No display ads on the homepage.
- **Footer copyright:** _"© 2026 All rights reserved"_ (plain, no company name).
- **Social icons present:** Facebook, Instagram, Twitter, YouTube.
- **No newsletter signup, no display ads on homepage.**

### Main navigation (exact text)

Top-level items:

1. **Home**
2. **Keuken accessoires** (mega-menu)
3. **Keukenapparatuur** (mega-menu)
4. **Pannen** (mega-menu)
5. **Contact**
6. **Messen** (mega-menu)

Mega-menu sub-items:

- **Keuken accessoires:** Sous vide, Wafelijzer, Cakevorm, Pizzarette, Afdruiprek, Kaasschaaf, Keukentrolley, Zeepdispenser, Vershoudbakjes, Teppanyaki plaat
- **Keukenapparatuur:** Airfryer, Friteuse, Frituurpan, Snijmachine, Broodrooster, Tosti apparaat, Popcornmachine, Broodbakmachine, Broodsnijmachine, Vacumeermachine
- **Pannen:** Pan, Grillpan, Kookpan, Braadpan, Pannenset, Hapjespan, Koekenpan, Inductie pannenset, Gietijzeren koekenpan, Keramische koekenpan
- **Messen:** Magnetisch messenblok, Elektrische blikopener, Elektrische kaasschaaf, Keramisch messenset, Groente snijmachine, Messenset met blok, Japanse messenset, Laser snijmachine, Snijmachine vlees, Chinees hakmes

### Footer columns

- **General:** Sitemap, Blog, Keukenwinkel
- **Koelkasten:** Koelkast, Wijnkoeler, IJsmachine, Mini vriezer, Wijnkoelkast, Koelvriescombinatie, Amerikaanse koelkast
- **Koffiegerei:** Koffiebonen, Pistonmachine, Koffiezetapparaat, Nespresso machine, Cappuccino apparaat, Latte macchiato glazen, Volautomatische koffiemachine
- **Mixers:** Mixer, Blender, Handmixer, Mini blender, Keukenmixer, Smoothiemaker, Keukenmachine
- **Keukenwinkel (local business listings):** Au Four, Your Kitchen, GOV's Keuken, Keukens.nl B.V., MultiMartBonaire, Immanuel Design, Your New Kitchen, Total Home Concept, Divers Paradise Bonaire, Oasis Guesthouse Bonaire

---

## 2. Technology Stack

| Layer                 | Detected                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------ |
| CMS                   | WordPress                                                                                  |
| Theme                 | **Hello Elementor** (seen in `/wp-content/themes/hello-elementor/` prefetch rules)         |
| Page builder          | **Elementor 4.0.3 + Elementor Pro**                                                        |
| Elementor add-ons     | **Essential Addons for Elementor Lite (EAEL) 6.6.2**                                       |
| SEO                   | **Yoast SEO** (sitemap index generator)                                                    |
| Performance / cache   | **WP Rocket** (`data-rocket-location-hash` attributes present)                             |
| Money-page plugin     | **Custom "ZBMP" plugin** (see §4)                                                          |
| Contact form          | **Elementor Pro Form widget** — no separate form plugin                                    |
| Bot protection        | **Google reCAPTCHA v2** (`data-sitekey="6LcFxPUkAAAAAN1pwdLaCJfCZGqVVbHpep5y0E0m"`)        |
| Analytics             | **Google Analytics 4** — measurement ID `G-43H5NMZVHK` (only analytics tool detected)      |
| Ad networks           | **None** — no AdSense / Ezoic / Mediavine tags seen                                        |
| Affiliate network     | **Bol.com Partner Programma** (publisher `s=1088790`)                                      |

### Verbatim GA4 snippet (homepage `<head>`)

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-43H5NMZVHK"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-43H5NMZVHK');
</script>
```

No Google Tag Manager, Facebook Pixel, Plausible, Fathom, Matomo, Clarity, Hotjar, or consent-management scripts were detected.

---

## 3. Sitemap Breakdown

Root index: **https://keukenfaqs.nl/sitemap_index.xml** (Yoast-generated)

| Sub-sitemap                | URL entries | Last modified           |
| -------------------------- | -----------: | ----------------------- |
| `post-sitemap.xml`         | 47           | 2025-11-14              |
| `page-sitemap.xml`         | 22           | 2025-12-22              |
| `category-sitemap.xml`     | 1            | 2025-11-14              |
| `author-sitemap.xml`       | 1            | 2022-07-29              |
| `zb_mp-sitemap.xml`        | **2,632**    | 2026-04-21              |

### Pages inventory (all 22)

```
/
/category/
/tips/
/sitemap/
/contact/
/zb_mp_title/
/keukenwinkel/
/pannen/
/keukenapparatuur/
/koelkasten/
/keuken-accessoires/
/elektrisch-koken/
/molens/
/ovens/
/koffiegerei/
/mixers/
/zb_mp_product-pannen/
/zb_mp_product-keukenapparatuur/
/messen/
/top-10-beste/
/best-geteste-zb_mp_product-2026/
/blog/
```

Note: several pages are category landing pages (`/pannen/`, `/messen/`, etc.). Two pages (`/zb_mp_title/`, `/best-geteste-zb_mp_product-2026/`) look like plugin-generated templates that shouldn't be public — investigate during migration.

### URL patterns

- Posts & money pages are flat: `/{slug}/` (no date or category prefix).
- Money-page slugs all follow `beste-{product}/` (e.g., `/beste-airfryer/`, `/beste-koekenpan/`).
- Category/taxonomy landing pages use `/{category}/` at the root.

---

## 4. The "ZBMP" Money-Page Plugin

The 2,632 money pages are generated by a **custom/private WordPress plugin** we will refer to as **ZBMP**.

**Fingerprints:**

- Custom post type: `zb_mp_*` (e.g., `/zb_mp_title/`, `/zb_mp_product-pannen/`)
- CSS class prefix: `zbmp-` (e.g., `zbmp-category-links`, `zbmp-breadcrumb`)
- Templated shortcodes in meta descriptions: `[zb_mp_mv]`, `[zb_mp_ev]` — likely "main variable" / "entity variable" placeholders that get substituted per-page (e.g., `mv` → "airfryer", plural; `ev` → "airfryer", singular).
- Pages use a consistent "Top 10 beste X van 2026" template.

**Not a recognizable public plugin** — no mentions in standard WP plugin directories. Most likely a **bespoke / SaaS-style affiliate-page generator** ("ZB" could be the vendor's initials; all 2,632 pages share `lastmod = 2026-04-21`, suggesting they are regenerated on a schedule). Worth asking the site owner for the plugin source or an export.

**Migration implication:** These pages are templated. For the Astro rebuild we do not need to migrate them as 2,632 hand-crafted articles — we can either re-template them from the same product database (if one exists) or drop them entirely and keep only the editorial content.

---

## 5. Sample Content Structures

### 5a. Sample blog post — `/de-keuken-als-sociale-hub-zo-maak-je-van-jouw-keuken-een-gezellige-ontmoetingsplek/`

- H1: _"De keuken als sociale hub: zo maak je van jouw keuken een gezellige ontmoetingsplek"_
- Heading hierarchy: three H2s only — _"Creëer een comfortabele zithoek"_, _"Voeg sfeerverlichting toe"_, _"Maak ruimte voor entertainment"_. No H3/H4.
- Word count: ~420–450 words.
- Images: **none** in article body.
- Tables / ratings: **none**.
- Affiliate links: **none** in body.
- Breadcrumbs: not detected.
- Sidebar: "Laatste tips" widget (recent posts, often unrelated celebrity/clickbait), plus "Koelkasten / Koffiegerei / Mixers / Keukenwinkel" product-category link lists (same as footer).

→ Blog posts are simple editorial, thin on media, with shared Elementor-rendered sidebar.

### 5b. Sample static page — `/contact/`

- H1: _"Contact"_
- Intro: _"Wil je contact met de redactie van Keukenfaqs.nl of zou je een samenwerking met ons aan willen gaan? Neem dan contact op middels onderstaand contact formulier. We streven er naar alle vragen binnen 24 uur te beantwoorden."_
- Form: **Elementor Pro Form widget** (`class="elementor-form"`, `data-widget_type="form.default"`). Not Contact Form 7 / WPForms / Gravity Forms.
  - Fields: `form_fields[name]` (text), `form_fields[email]` (email, required), `form_fields[message]` (textarea), reCAPTCHA v2 checkbox, `Versturen` submit button.
  - Submits via Elementor's AJAX endpoint (no `action` — handled by Elementor's JS).
  - reCAPTCHA v2 site key: `6LcFxPUkAAAAAN1pwdLaCJfCZGqVVbHpep5y0E0m`
- **No mailto, phone, or physical address on page.**

→ For the Astro rebuild, the contact form must be replaced with a serverless handler (e.g., a Cloudflare Worker endpoint) since Elementor's form is server-side WP.

### 5c. Sample money page — `/beste-airfryer/`

- H1: _"Top 10 beste airfryers van 2026"_
- H2 sections: _Top 3 airfryers van 2026_ · _Ontdek de top 10 airfryers_ · _Veelgestelde vragen over de top 10 airfryers_ · _Conclusie van deze top 10 best geteste airfryers_ · _airfryers vergelijking - Ons laatste woord_.
- 10 products, each as an H3 with a product name (e.g., _"KitchenBrothers Airfryer"_, _"Philips Airfryer Essential HD9252/90"_).
- **No comparison table, no price widget, no star ratings, no pros/cons lists.** Each product has: image + paragraph description + single CTA link.
- **CTA text:** _"Goedkoopste deal hier"_
- **Affiliate destination:** Bol.com Partner Programma, publisher ID `s=1088790`, format:
  ```
  https://partner.bol.com/click/click?p=2&t=url&s=1088790&f=TXL&url=<bol-product-url>
  ```
- **Product images are hotlinked** from `media.s-bol.com` (Bol.com's CDN) — **not** stored on keukenfaqs.nl. This is a copyright / availability risk.
- Breadcrumbs present — `<ol class="zbmp-breadcrumb">` with schema.org BreadcrumbList markup.
- Dates: _"Gepubliceerd op: 2 aug. 2022"_, _"Laatst bijgewerkt: 2 jan. 2026"_.
- FAQ section (H2 _"Veelgestelde vragen"_) — likely Elementor Accordion widget.
- Affiliate disclaimer in footer: _"Op deze pagina verwijzen we naar Bol.com... ontvangen wij een kleine commissie."_

→ Money pages are highly templated and monetized exclusively through Bol.com partner links.

---

## 6. Integrations Summary

| Integration                  | Status                                                                 |
| ---------------------------- | ---------------------------------------------------------------------- |
| Contact form                 | Elementor Pro Form widget + reCAPTCHA v2 → WP server-side              |
| Newsletter                   | **None** detected                                                      |
| Display ads                  | **None** (no AdSense, Ezoic, Mediavine, Raptive)                       |
| Affiliate network            | **Bol.com Partner Programma only** (publisher `1088790`)               |
| Social icons                 | Facebook, Instagram, Twitter, YouTube (footer)                         |
| Analytics                    | GA4 only (`G-43H5NMZVHK`)                                              |
| Tag manager / pixels         | **None**                                                               |
| Cookie / consent banner      | Not detected in HTML — may need to be added for GDPR compliance        |

---

## 7. Migration Implications (preview)

- **Editorial content is small** (47 posts + ~20 real pages) — trivially migrate via WP XML export.
- **Money pages are the main asset** but are templated. Decision needed: re-generate in Astro from the underlying product data, or drop entirely. Ask the owner for the ZBMP plugin/data.
- **Bol.com affiliate links** (`partner.bol.com/click/click?s=1088790`) must be preserved to keep revenue.
- **Hotlinked Bol.com product images** should be self-hosted (download + local serve) for reliability.
- **Contact form** needs a new implementation (e.g., Cloudflare Worker → email service) — no Elementor runtime on a static build.
- **GA4 tag** (`G-43H5NMZVHK`) can be dropped in unchanged.
- **URL structure** is flat (`/{slug}/`) — easy to preserve 1:1 in Astro.
- **Sidebar widgets** (repeated link lists) are structural, not content — re-build as Astro components.
- **404 handling** — Yoast sitemap confirms the site returns 404s (the wrangler `not_found_handling: "404-page"` setting we chose is correct).

---

## 8. Open Questions for the Site Owner

1. Do we have access to the ZBMP plugin and its underlying product database? If yes, can we export the product records (title, description, image URL, bol.com URL)?
2. Should the 2,632 money pages be preserved (regenerated in Astro) or pruned?
3. Where should contact-form submissions be delivered (which email / service)?
4. Which Google account owns the GA4 property — do we keep it or start fresh?
5. Is `G-43H5NMZVHK` the correct production GA4 ID to reuse?

---

## 9. Final Data Status (post-scrape, 2026-04-21)

The WordPress data has been fully extracted. Two inputs feed the Astro rebuild:

1. **WXR export** — `migration/wordpress-export.xml` (49 `post`, 23 `page`, 113 `attachment`, plus Elementor/nav artefacts). See §3 of this document.
2. **Scraped money pages** — `migration/scraped/money-pages/` (2,632 JSON files, one per `zb_mp` URL, produced by `migration/scrape-money-pages.mjs`). Gitignored; regenerable from the live site.

### Migratable totals

| Source                        | Count      |
| ----------------------------- | ---------: |
| Blog posts (WXR)              | 47         |
| Editorial pages (WXR)         | 22         |
| Money pages (scraped)         | 2,605      |
| **Total migratable**          | **2,674**  |

### Money-page template breakdown (scraped)

| Template  | Count | Content shape                                                       |
| --------- | ----: | ------------------------------------------------------------------- |
| `top10`   | 206   | "Top 10 beste X" roundup, 10 products, bol.com partner links, FAQ.  |
| `product` | 563   | Single-product review, star rating, specs, pros/cons, AWIN→Coolblue link. |
| `business`| 1,836 | Retailer directory entry, address + city + maps + website link.     |
| `unknown` | 27    | Dropped — see below.                                                |

### Dropped URLs (27)

The 27 pages classified as `unknown` during scraping are incomplete or placeholder entries — 23 are stub business listings (name + city only, no address/body) and 4 are broken plugin-template pages (`/vraag-mv/`, `/vraag-product-mv/`, etc.). The full list is in **`migration/dropped-urls.txt`** (TSV: `url<tab>title`).

**Decision:** drop these from the Astro rebuild. They will 404 on the new site. If SEO-preserving redirects are needed later, the TSV file is the source list and `/keukenwinkel/` is the sensible redirect target for the 23 business stubs.
