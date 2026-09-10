import { site } from '../site.mjs';

export const GET = () => new Response(`User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap.xml', site.url)}\n`, {
	headers: { 'Content-Type': 'text/plain; charset=utf-8' },
});
