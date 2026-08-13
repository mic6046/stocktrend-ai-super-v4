/**
 * Generates Quantum Node PWA icons (192 / 512 / apple-touch) via Playwright.
 * Run: node scripts/generate-pwa-icons.cjs
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'public');

const html = (size) => `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<style>
  html,body{margin:0;width:${size}px;height:${size}px;background:#050505;overflow:hidden}
  .wrap{width:100%;height:100%;display:flex;align-items:center;justify-content:center}
  .badge{width:72%;height:72%;border-radius:22%;background:#10b981;display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 ${Math.round(size*0.08)}px rgba(16,185,129,0.45)}
  svg{width:55%;height:55%}
</style></head><body>
<div class="wrap"><div class="badge">
<svg viewBox="0 0 24 24" fill="none" stroke="#050505" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
</svg>
</div></div>
</body></html>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const sizes = [
    { name: 'pwa-192.png', size: 192 },
    { name: 'pwa-512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
  ];
  for (const { name, size } of sizes) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(html(size), { waitUntil: 'load' });
    await page.screenshot({
      path: path.join(OUT, name),
      type: 'png',
      omitBackground: false,
    });
    await page.close();
    console.log('Wrote', name);
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
