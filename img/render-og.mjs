// Render img/og-template.html to img/og-image.png at 1200x630.
// Reuses the Puppeteer install from playbook-pdf/ to avoid a second install.
// Usage (from repo root):
//     node img/render-og.mjs

import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// Load puppeteer from playbook-pdf/node_modules so we don't duplicate the install.
const require = createRequire(path.join(repoRoot, 'playbook-pdf', 'package.json'));
const puppeteer = require('puppeteer');

const htmlPath = path.join(__dirname, 'og-template.html');
const outputPath = path.join(__dirname, 'og-image.png');

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

// deviceScaleFactor=2 renders crisp text; we clip back to 1200x630 for the saved PNG.
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });

await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluateHandle('document.fonts.ready');

await page.screenshot({
  path: outputPath,
  clip: { x: 0, y: 0, width: 1200, height: 630 },
  omitBackground: false,
});

console.log(`Rendered ${outputPath} at 1200x630`);
await browser.close();
