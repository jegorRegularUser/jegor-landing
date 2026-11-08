/* Разведка демо: печатаем интерактивные элементы, чтобы построить сценарии съёмки. */
import { chromium } from 'playwright';

const browser = await chromium.launch();

for (const [name, url] of [
  ['trails-map-add', 'https://jegors-intelligent-trails.vercel.app/map'],
]) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(5000);
  // открыть блок «+ Добавить место» и вкладку «Категория»
  try {
    await page.getByRole('button', { name: /\+ Добавить место/i }).click({ timeout: 4000 });
    await page.waitForTimeout(800);
  } catch {}
  try {
    await page.getByRole('button', { name: /Категория/i }).first().click({ timeout: 4000 });
    await page.waitForTimeout(800);
  } catch {}
  const items = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button, a[href], input, [role="button"]'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .slice(0, 40)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '')
          .trim()
          .slice(0, 60),
        href: el.getAttribute('href') || undefined,
      })),
  );
  console.log(`=== ${name} ===`);
  for (const it of items) console.log(JSON.stringify(it));
  await page.close();
}
await browser.close();
