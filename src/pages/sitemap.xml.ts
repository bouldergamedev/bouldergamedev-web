import { site } from '../site.mjs';

export const GET = () => new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${site.url}</loc></url></urlset>`, {
	headers: { 'Content-Type': 'application/xml; charset=utf-8' },
});
