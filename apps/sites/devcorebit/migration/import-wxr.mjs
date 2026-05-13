#!/usr/bin/env node
// Import WordPress WXR export into Astro content collections.
// - Posts → src/content/blog/{slug}.md
// - Pages → src/content/pages/{slug}.md
// - Images → src/assets/images/{blog|pages}/{year}/{month}/{filename}
//
// CLI:
//   node migration/import-wxr.mjs                       # full run
//   node migration/import-wxr.mjs --limit 3             # posts and pages: 3 each
//   node migration/import-wxr.mjs --limit-posts 3 --limit-pages 1

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser } from "fast-xml-parser";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WXR_PATH = path.join(__dirname, "wordpress-export.xml");
const OUT_BLOG = path.join(ROOT, "src/content/blog");
const OUT_PAGES = path.join(ROOT, "src/content/pages");
const IMAGE_ROOT = path.join(ROOT, "src/assets/images");
const IMAGE_ERROR_LOG = path.join(__dirname, "image-errors.log");

const args = process.argv.slice(2);
function getArg(name) {
	const eq = args.find((a) => a.startsWith(`${name}=`));
	if (eq) return eq.split("=")[1];
	const idx = args.indexOf(name);
	if (idx >= 0 && args[idx + 1]) return args[idx + 1];
	return null;
}
const LIMIT = parseInt(getArg("--limit") || "0", 10) || null;
const LIMIT_POSTS = parseInt(getArg("--limit-posts") || "0", 10) || LIMIT || Infinity;
const LIMIT_PAGES = parseInt(getArg("--limit-pages") || "0", 10) || LIMIT || Infinity;

// Slugs to exclude from the import. Extend as needed.
const SLUG_BLACKLIST = new Set([
	// WP homepage content — served at / on the old site
	"de-plek-voor-alles-over-je-keuken",
	// ZBMP plugin template pages (contain literal [zb_mp_*] placeholders)
	"zb_mp_title",
	"zb_mp_product-pannen",
	"zb_mp_product-keukenapparatuur",
	"top-10-beste",
	"best-geteste-zb_mp_product-2026",
	"tips",
	// WP auto-generated / empty pages
	"category",
	"sitemap",
	// Collide with static routes / placeholders in src/pages/
	"blog",
	"contact",
]);

// All migrated items use this author for now (ignores wp:dc:creator).
const AUTHOR = "keukenfaqs";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const cdata = (node) => {
	if (node == null) return "";
	if (typeof node === "string") return node;
	if (typeof node === "object") return node["#text"] ?? "";
	return String(node);
};
const arrayify = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

function yamlScalar(s) {
	if (s == null) return '""';
	const str = String(s);
	if (!/[:#&*!|>'"%@`{}\[\],\n]/.test(str) && str.trim() === str && str !== "") {
		return str;
	}
	return `"${str.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function toFrontmatter(fields) {
	const lines = ["---"];
	for (const [k, v] of Object.entries(fields)) {
		if (v == null) continue;
		if (Array.isArray(v)) {
			if (v.length === 0) continue;
			lines.push(`${k}:`);
			for (const x of v) lines.push(`  - ${yamlScalar(x)}`);
		} else if (v instanceof Date) {
			lines.push(`${k}: ${v.toISOString()}`);
		} else {
			lines.push(`${k}: ${yamlScalar(v)}`);
		}
	}
	lines.push("---");
	return lines.join("\n");
}

function deriveDescription(html) {
	if (!html) return "";
	const text = html
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")
		.trim();
	if (text.length <= 160) return text;
	return text.slice(0, 157).trim() + "…";
}

// Strip WordPress artefacts that would pollute Markdown.
function cleanHtml(html) {
	if (!html) return "";
	let out = html
		.replace(/<!--\s*\/?wp:[^>]*-->/g, "") // WP block comments
		.replace(
			/\[\/?(?:caption|gallery|embed|video|audio|playlist|vc_\w+|et_pb_\w+|lmt-[\w-]+|fusion_\w+|su_\w+)(?:\s[^\]]*)?\]/gi,
			""
		) // common WP shortcodes
		.replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "") // empty paragraphs
		.replace(/\sstyle="[^"]*"/gi, "") // inline styles
		.replace(/\sclass="[^"]*"/gi, ""); // class attributes

	// Cascade-demote body headings so a post's <h1> becomes <h2> (matching the
	// layout's single <h1>) and each sub-heading drops one level in turn.
	// Only triggered if the body actually contains an <h1>.
	if (/<h1\b/i.test(out)) {
		out = out.replace(
			/<(\/?)h([1-5])(\s[^>]*)?>/gi,
			(_, slash, n, attrs = "") =>
				`<${slash}h${parseInt(n, 10) + 1}${attrs}>`
		);
	}
	return out;
}

function mapImageUrl(url, collection) {
	let u;
	try {
		u = new URL(url);
	} catch {
		return null;
	}
	const filename = path.basename(u.pathname);
	const m = u.pathname.match(/\/wp-content\/uploads\/(\d{4})\/(\d{2})\/(.+)$/);
	const subdir = m
		? path.join(collection, m[1], m[2])
		: path.join(collection, "misc");
	const name = m ? m[3] : filename;
	return {
		localPath: path.join(IMAGE_ROOT, subdir, name),
		relPath: `../../assets/images/${subdir.split(path.sep).join("/")}/${name}`,
	};
}

// -----------------------------------------------------------------------------
// Concurrency-limited image downloader (3 workers)
// -----------------------------------------------------------------------------

function makeLimit(n) {
	let active = 0;
	const queue = [];
	const runNext = () => {
		if (active >= n || queue.length === 0) return;
		const job = queue.shift();
		active++;
		Promise.resolve()
			.then(job.fn)
			.then(
				(v) => {
					active--;
					job.resolve(v);
					runNext();
				},
				(e) => {
					active--;
					job.reject(e);
					runNext();
				}
			);
	};
	return (fn) =>
		new Promise((resolve, reject) => {
			queue.push({ fn, resolve, reject });
			runNext();
		});
}
const imageLimit = makeLimit(3);

async function downloadImage(url, localPath) {
	return imageLimit(async () => {
		if (existsSync(localPath)) {
			const stat = await fs.stat(localPath);
			return { status: "skipped", bytes: stat.size };
		}
		await fs.mkdir(path.dirname(localPath), { recursive: true });
		const res = await fetch(url, {
			headers: {
				"user-agent": "keukenfaqs-import/1.0",
				"accept-language": "nl,en;q=0.8",
			},
			redirect: "follow",
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const buf = Buffer.from(await res.arrayBuffer());
		await fs.writeFile(localPath, buf);
		return { status: "ok", bytes: buf.length };
	});
}

async function logImageError(url, err) {
	await fs.appendFile(
		IMAGE_ERROR_LOG,
		`${new Date().toISOString()}\t${url}\t${err.message}\n`
	);
}

// -----------------------------------------------------------------------------
// Turndown setup
// -----------------------------------------------------------------------------

const turndown = new TurndownService({
	headingStyle: "atx",
	codeBlockStyle: "fenced",
	emDelimiter: "_",
	strongDelimiter: "**",
	linkStyle: "inlined",
	bulletListMarker: "-",
});
turndown.use(gfm);

// Unwrap divs so their content flows into markdown.
turndown.addRule("unwrap-div", {
	filter: "div",
	replacement: (content) => (content.trim() ? `\n\n${content}\n\n` : ""),
});

// Tidy figure wrappers — keep the caption as italic line after the image.
turndown.addRule("figure", {
	filter: "figure",
	replacement: (content) => `\n\n${content}\n\n`,
});

// -----------------------------------------------------------------------------
// Image extraction + HTML-to-markdown
// -----------------------------------------------------------------------------

async function rewriteAndDownloadImages(html, collection, stats) {
	const imgRegex = /<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi;
	const urlsToRewrite = new Map(); // originalSrc -> relPath
	const pending = [];

	let m;
	while ((m = imgRegex.exec(html)) !== null) {
		const src = m[1];
		if (urlsToRewrite.has(src)) continue; // dedupe
		const mapped = mapImageUrl(src, collection);
		if (!mapped) {
			urlsToRewrite.set(src, null);
			continue;
		}
		urlsToRewrite.set(src, mapped.relPath);
		pending.push(
			downloadImage(src, mapped.localPath)
				.then((r) => {
					if (r.status === "ok") {
						stats.imagesOk++;
						stats.imageBytes += r.bytes;
					} else {
						stats.imagesSkipped++;
					}
				})
				.catch(async (err) => {
					stats.imagesErr++;
					await logImageError(src, err);
					// On failure, leave original URL in markdown.
					urlsToRewrite.set(src, null);
				})
		);
	}
	await Promise.all(pending);

	// Rewrite srcs in the HTML (use only successful mappings)
	let rewritten = html;
	for (const [src, rel] of urlsToRewrite) {
		if (!rel) continue;
		// Escape regex special chars for literal replacement
		const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		rewritten = rewritten.replace(new RegExp(escaped, "g"), rel);
	}
	return rewritten;
}

async function htmlToMarkdown(html, collection, stats) {
	const cleaned = cleanHtml(html);
	const withLocalImages = await rewriteAndDownloadImages(cleaned, collection, stats);
	return turndown
		.turndown(withLocalImages)
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

// -----------------------------------------------------------------------------
// Item processing
// -----------------------------------------------------------------------------

function parsePostDate(item) {
	// Prefer GMT; WXR format is "YYYY-MM-DD HH:MM:SS" with no tz marker.
	const gmt = cdata(item["wp:post_date_gmt"]) || cdata(item["wp:post_date"]);
	if (!gmt) return null;
	return new Date(gmt.replace(" ", "T") + "Z");
}
function parseModifiedDate(item) {
	const gmt =
		cdata(item["wp:post_modified_gmt"]) || cdata(item["wp:post_modified"]);
	if (!gmt) return null;
	return new Date(gmt.replace(" ", "T") + "Z");
}

async function writeItem(item, collection, attachmentsById, stats) {
	const title = cdata(item.title).trim();
	const slug = cdata(item["wp:post_name"]).trim();
	if (!title || !slug) {
		const reason = !slug ? "missing slug" : "missing title";
		stats.skippedItems.push({ slug: slug || "(none)", collection, reason });
		stats.skipped++;
		return false;
	}
	if (SLUG_BLACKLIST.has(slug)) {
		stats.skippedItems.push({ slug, collection, reason: "blacklist" });
		stats.skipped++;
		return false;
	}

	const contentHtml = cdata(item["content:encoded"]);
	const excerpt = cdata(item["excerpt:encoded"]).trim();
	const description = excerpt || deriveDescription(contentHtml);

	const pubDate = parsePostDate(item);
	const modDate = parseModifiedDate(item);
	const updatedDate = modDate && pubDate && modDate > pubDate ? modDate : null;

	const cats = arrayify(item.category)
		.filter((c) => c && c["@_domain"] === "category")
		.map((c) => cdata(c).trim())
		.filter(Boolean);
	const tags = arrayify(item.category)
		.filter((c) => c && c["@_domain"] === "post_tag")
		.map((c) => cdata(c).trim())
		.filter(Boolean);

	// Hero image from _thumbnail_id postmeta
	let heroImagePath = null;
	if (collection === "blog") {
		const postmeta = arrayify(item["wp:postmeta"]);
		const thumb = postmeta.find(
			(m) => cdata(m["wp:meta_key"]) === "_thumbnail_id"
		);
		if (thumb) {
			const thumbId = String(cdata(thumb["wp:meta_value"])).trim();
			const attachment = attachmentsById.get(thumbId);
			if (attachment?.url) {
				const mapped = mapImageUrl(attachment.url, collection);
				if (mapped) {
					try {
						const r = await downloadImage(attachment.url, mapped.localPath);
						if (r.status === "ok") {
							stats.imagesOk++;
							stats.imageBytes += r.bytes;
						} else {
							stats.imagesSkipped++;
						}
						heroImagePath = mapped.relPath;
					} catch (err) {
						stats.imagesErr++;
						await logImageError(attachment.url, err);
					}
				}
			}
		}
	}

	const body = await htmlToMarkdown(contentHtml, collection, stats);

	const fields = { title, description };
	if (collection === "blog") {
		if (pubDate) fields.pubDate = pubDate;
		if (updatedDate) fields.updatedDate = updatedDate;
		if (heroImagePath) fields.heroImage = heroImagePath;
		if (cats.length) fields.categories = cats;
		if (tags.length) fields.tags = tags;
		fields.author = AUTHOR;
	} else {
		if (pubDate) fields.pubDate = pubDate;
		if (updatedDate) fields.updatedDate = updatedDate;
	}

	const fm = toFrontmatter(fields);
	const md = `${fm}\n\n${body}\n`;

	const outDir = collection === "blog" ? OUT_BLOG : OUT_PAGES;
	const outPath = path.join(outDir, `${slug}.md`);
	await fs.writeFile(outPath, md);
	return { outPath, slug };
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
	// Reset image error log for this run.
	await fs.writeFile(IMAGE_ERROR_LOG, "");
	await fs.mkdir(OUT_BLOG, { recursive: true });
	await fs.mkdir(OUT_PAGES, { recursive: true });

	const xml = await fs.readFile(WXR_PATH, "utf8");
	const parser = new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: "@_",
		parseTagValue: false,
		trimValues: false,
		isArray: (name) =>
			["item", "category", "wp:postmeta"].includes(name),
	});
	const data = parser.parse(xml);
	const items = data.rss?.channel?.item ?? [];
	console.log(`[index] ${items.length} items in WXR`);

	// Index attachments by post_id so we can resolve _thumbnail_id
	const attachmentsById = new Map();
	for (const item of items) {
		if (cdata(item["wp:post_type"]) !== "attachment") continue;
		const id = String(cdata(item["wp:post_id"]));
		const url = cdata(item["wp:attachment_url"]);
		if (!id || !url) continue;
		attachmentsById.set(id, {
			url,
			mime: cdata(item["wp:post_mime_type"]),
			title: cdata(item.title),
		});
	}

	const posts = items.filter(
		(i) =>
			cdata(i["wp:post_type"]) === "post" &&
			cdata(i["wp:status"]) === "publish"
	);
	const pages = items.filter(
		(i) =>
			cdata(i["wp:post_type"]) === "page" &&
			cdata(i["wp:status"]) === "publish"
	);

	console.log(
		`[index] attachments=${attachmentsById.size} posts(publish)=${posts.length} pages(publish)=${pages.length}`
	);

	const selectedPosts = posts.slice(0, LIMIT_POSTS);
	const selectedPages = pages.slice(0, LIMIT_PAGES);
	console.log(
		`[run] importing posts=${selectedPosts.length} pages=${selectedPages.length}`
	);

	const stats = {
		posts: 0,
		pages: 0,
		skipped: 0,
		skippedItems: [],
		imagesOk: 0,
		imagesSkipped: 0,
		imagesErr: 0,
		imageBytes: 0,
		written: [],
	};

	for (const p of selectedPosts) {
		const r = await writeItem(p, "blog", attachmentsById, stats);
		if (r) {
			stats.posts++;
			stats.written.push({ collection: "blog", ...r });
		}
	}
	for (const p of selectedPages) {
		const r = await writeItem(p, "pages", attachmentsById, stats);
		if (r) {
			stats.pages++;
			stats.written.push({ collection: "pages", ...r });
		}
	}

	console.log(
		`\n[done] posts=${stats.posts} pages=${stats.pages} skipped=${stats.skipped}`
	);
	console.log(
		`[images] downloaded=${stats.imagesOk} skipped-existing=${stats.imagesSkipped} errors=${stats.imagesErr} bytes=${stats.imageBytes}`
	);
	if (stats.skippedItems.length) {
		console.log(`[skipped items]`);
		for (const s of stats.skippedItems) {
			console.log(`  ${s.collection}/${s.slug} — ${s.reason}`);
		}
	}
}

main().catch((err) => {
	console.error("[fatal]", err);
	process.exit(1);
});
