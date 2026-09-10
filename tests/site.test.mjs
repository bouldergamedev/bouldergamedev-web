import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { site } from '../src/site.mjs';
import { GET as robots } from '../src/pages/robots.txt.ts';
import { GET as sitemap } from '../src/pages/sitemap.xml.ts';

test('crawler endpoints expose the same HTTPS canonical origin', async () => {
	assert.equal(new URL(site.url).origin, 'https://bouldergame.dev');
	const rules = robots(), xml = sitemap();
	assert.match(rules.headers.get('Content-Type'), /text\/plain/);
	assert.ok((await rules.text()).includes(`Sitemap: ${new URL('sitemap.xml', site.url)}`));
	assert.match(xml.headers.get('Content-Type'), /application\/xml/);
	assert.ok((await xml.text()).includes(`<loc>${site.url}</loc>`));
});

test('the social card is a valid PNG matching its advertised 1200 × 630 dimensions', async () => {
	const image = await readFile(new URL(`../public${site.image}`, import.meta.url));
	assert.equal(image.subarray(1, 4).toString(), 'PNG');
	assert.equal(image.readUInt32BE(16), 1200);
	assert.equal(image.readUInt32BE(20), 630);
});
