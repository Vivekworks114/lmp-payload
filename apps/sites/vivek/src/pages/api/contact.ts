import type { APIRoute } from 'astro';

// SSR contact-form endpoint. Replaces the WP/Elementor server-side form. The
// payload is forwarded to the tenant's configured webhook (set in the
// Cloudflare Worker env as CONTACT_WEBHOOK_URL — could be Mailgun, Resend,
// a Discord webhook, etc.). Runs on Cloudflare Workers at request time.
//
// This is the "hybrid" SSR slice of an otherwise static tenant site.

export const prerender = false;

interface ContactPayload {
	name?: string;
	email?: string;
	message?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
	const contentType = request.headers.get('content-type') ?? '';
	let body: ContactPayload = {};
	try {
		if (contentType.includes('application/json')) {
			body = (await request.json()) as ContactPayload;
		} else {
			const form = await request.formData();
			body = {
				name: form.get('name')?.toString(),
				email: form.get('email')?.toString(),
				message: form.get('message')?.toString(),
			};
		}
	} catch {
		return new Response(JSON.stringify({ error: 'invalid body' }), {
			status: 400,
			headers: { 'content-type': 'application/json' },
		});
	}

	if (!body.email || !body.message) {
		return new Response(JSON.stringify({ error: 'email and message are required' }), {
			status: 400,
			headers: { 'content-type': 'application/json' },
		});
	}

	// Cloudflare runtime env (Wrangler vars / secrets) is available on locals.runtime.env.
	const env = (locals as { runtime?: { env?: Record<string, string> } }).runtime?.env ?? {};
	const webhookUrl = env.CONTACT_WEBHOOK_URL ?? import.meta.env.CONTACT_WEBHOOK_URL;
	if (!webhookUrl) {
		console.warn('[contact] CONTACT_WEBHOOK_URL is not configured');
		return new Response(JSON.stringify({ ok: true, delivered: false }), {
			status: 202,
			headers: { 'content-type': 'application/json' },
		});
	}

	try {
		await fetch(webhookUrl, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: body.name ?? null,
				email: body.email,
				message: body.message,
				submittedAt: new Date().toISOString(),
				userAgent: request.headers.get('user-agent') ?? null,
			}),
		});
	} catch (err) {
		console.error('[contact] webhook dispatch failed', err);
		return new Response(JSON.stringify({ error: 'delivery failed' }), {
			status: 502,
			headers: { 'content-type': 'application/json' },
		});
	}

	return new Response(JSON.stringify({ ok: true, delivered: true }), {
		status: 200,
		headers: { 'content-type': 'application/json' },
	});
};
