import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: image().optional(),
			categories: z.array(z.string()).optional(),
			tags: z.array(z.string()).optional(),
			author: z.string().optional(),
		}),
});

const pages = defineCollection({
	loader: glob({ base: './src/content/pages', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		pubDate: z.coerce.date().optional(),
		updatedDate: z.coerce.date().optional(),
	}),
});

// -----------------------------------------------------------------------------
// Money pages (scraped affiliate content).
// One JSON per page under src/data/money-pages/, shape follows the scraper
// output in migration/scrape-money-pages.mjs. Discriminated union on page_type.
// -----------------------------------------------------------------------------

const Top10ProductSchema = z.object({
	rank: z.number(),
	name: z.string(),
	image_url: z.string().nullable(),
	description: z.string().nullable(),
	affiliate_url: z.string().nullable(),
	affiliate_network: z.string().nullable(),
});

const FaqItemSchema = z.object({
	question: z.string(),
	answer_html: z.string(),
});

const Top10Schema = z.object({
	category_singular: z.string().nullable(),
	category_plural: z.string().nullable(),
	intro: z.string().nullable(),
	products: z.array(Top10ProductSchema),
	faq: z.array(FaqItemSchema),
	conclusion: z.string().nullable(),
});

const SpecSchema = z.object({
	label: z.string(),
	value: z.string(),
});

const ProductBlockSchema = z.object({
	category: z.string().nullable(),
	name: z.string().nullable(),
	intro: z.string().nullable(),
	rating: z.number().nullable(),
	rating_out_of: z.number().nullable(),
	image_url: z.string().nullable(),
	affiliate_url: z.string().nullable(),
	affiliate_network: z.string().nullable(),
	affiliate_cta: z.string().nullable(),
	specs: z.array(SpecSchema),
	description: z.string().nullable(),
	pros: z.array(z.string()),
	cons: z.array(z.string()),
});

const BusinessBlockSchema = z.object({
	name: z.string().nullable(),
	city: z.string().nullable(),
	address: z.string().nullable(),
	website_url: z.string().nullable(),
	google_maps_url: z.string().nullable(),
	intro: z.string().nullable(),
});

// Fields shared across every page_type. Merged into each variant below.
const commonMoneyPageFields = {
	url: z.string(),
	slug: z.string(),
	title: z.string(),
	h1: z.string().optional(),
	meta_description: z.string().nullable(),
	og_description: z.string().nullable(),
	// Dutch human-readable strings ("2 jan. 2026"), not ISO — keep as string.
	published_at: z.string().nullable(),
	last_updated: z.string().nullable(),
	raw_html_sample: z.string(),
	scrape: z.object({
		fetched_at: z.coerce.date(),
		http_status: z.number(),
		content_hash: z.string(),
		html_bytes: z.number(),
	}),
};

const moneyPages = defineCollection({
	loader: glob({ pattern: '**/*.json', base: './src/data/money-pages' }),
	schema: z.discriminatedUnion('page_type', [
		z.object({
			...commonMoneyPageFields,
			page_type: z.literal('top10'),
			top10: Top10Schema,
			product: z.null(),
			business: z.null(),
		}),
		z.object({
			...commonMoneyPageFields,
			page_type: z.literal('product'),
			top10: z.null(),
			product: ProductBlockSchema,
			business: z.null(),
		}),
		z.object({
			...commonMoneyPageFields,
			page_type: z.literal('business'),
			top10: z.null(),
			product: z.null(),
			business: BusinessBlockSchema,
		}),
		z.object({
			...commonMoneyPageFields,
			page_type: z.literal('unknown'),
			top10: z.null(),
			product: z.null(),
			business: z.null(),
		}),
	]),
});

export const collections = { blog, pages, moneyPages };
