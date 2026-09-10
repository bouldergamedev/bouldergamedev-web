# Boulder Game Dev

A static Astro splash page for [bouldergame.dev](https://bouldergame.dev), with an optional pixel-art grappling game.

## Development

Requires Node.js 22.12+ and Bun 1.3+. `bun.lock` is the dependency lockfile.

```sh
bun install --frozen-lockfile
bun run dev
bun run check
bun run test
bun run build
bun run preview
```

The production output in `dist/` can be deployed to any static host. The app has no server runtime or client UI framework.

## Structure

- `src/site.mjs`: shared copy, canonical URL, community links, and social metadata.
- `src/pages/`: the homepage, `robots.txt`, and `sitemap.xml`.
- `src/layouts/Layout.astro`: document metadata and organization structured data.
- `src/components/Mountain.astro`: static artwork, accessible instructions, and viewport-triggered game loading.
- `src/game/`: shared controls, fixed-step physics, cached sprite rendering, and input/animation lifecycle.
- `src/assets/landscape.webp`: the original pixel-art background, losslessly compressed and served as a fingerprinted asset.
- `public/og-image.png`: the 1200 × 630 social-sharing image.
- `tests/`: physics regressions and SEO endpoint checks.

## Game controls

- **Left / Right** or **A / D**: move and swing.
- **Up**: jump; retract the rope while attached.
- **Down**: extend the rope.
- **Space**: fire a hook 45° upward in the facing direction; launch with current momentum while attached.
- **S**: release the rope.

The game starts when it enters the viewport. Animation stops offscreen and in hidden tabs. Static artwork is visible even without JavaScript. Rendering is capped at 60 FPS and a 900 × 800 backing store; physics runs at a fixed 120 Hz with reusable platform buffers. Fonts are self-hosted, and reduced-motion preferences disable decorative trails and flag motion.

## SEO and assets

Update `src/site.mjs` when changing the production domain or community links. Canonical URLs, Open Graph/Twitter cards, structured data, robots, and the sitemap all use this configuration. Keep the social image synchronized with branding changes. The reference image is not used by the site.
