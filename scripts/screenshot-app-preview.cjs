const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'public', 'app-preview.png');
const URL = process.env.PREVIEW_URL || 'http://127.0.0.1:5174/?preview=app';

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT, type: 'png', fullPage: false });
  await browser.close();
  console.log('Wrote', OUT);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
