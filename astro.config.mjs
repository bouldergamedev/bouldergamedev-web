import { defineConfig } from 'astro/config';
import { site } from './src/site.mjs';
export default defineConfig({
  site: site.url,
  devToolbar: { enabled: false },
});
