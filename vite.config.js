import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

// Legacy scripts deliberately share browser globals and keep their HTML order.
// Vite serves them in dev; explicitly include them in production as well.
export default defineConfig({
  plugins: [{
    name: 'legacy-studio-scripts',
    generateBundle() {
      const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
      for (const match of html.matchAll(/<script src="([^"/]+\.js)"><\/script>/g)) {
        this.emitFile({ type: 'asset', fileName: match[1], source: readFileSync(new URL(match[1], import.meta.url), 'utf8') });
      }
    }
  }]
});
