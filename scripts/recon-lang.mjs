/* Разведка: есть ли у демок английский? */
import { chromium } from 'playwright';

const browser = await chromium.launch();

// evolution: все кнопки с title, html lang, localStorage, /en
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('https://evolution-online.vercel.app/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log('evo html lang:', await page.evaluate(() => document.documentElement.lang));
  console.log('evo localStorage:', await page.evaluate(() => JSON.stringify({ ...localStorage })));
  const titled = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[title], [aria-label]'))
      .map((el) => `${el.tagName}:${el.getAttribute('title') || el.getAttribute('aria-label')}`)
      .slice(0, 30),
  );
  console.log('evo titled:', titled.join(' | '));
  for (const u of ['https://evolution-online.vercel.app/en', 'https://evolution-online.vercel.app/?lang=en']) {
    const resp = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
    console.log(`evo ${u}:`, resp ? resp.status() : 'FAIL');
    if (resp && resp.status() === 200) {
      await page.waitForTimeout(2500);
      const t = await page.evaluate(() => document.body.innerText.slice(0, 200));
      console.log('  текст:', t.replace(/\n/g, ' | ').slice(0, 150));
    }
    await page.goto('https://evolution-online.vercel.app/', { waitUntil: 'load' });
    await page.waitForTimeout(1500);
  }
  await page.close();
}

// trails: переключатель языка в UI, localStorage, /en/map
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('https://jegors-intelligent-trails.vercel.app/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log('trails html lang:', await page.evaluate(() => document.documentElement.lang));
  console.log('trails localStorage:', await page.evaluate(() => JSON.stringify({ ...localStorage })));
  const titled = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[title], [aria-label]'))
      .map((el) => `${el.tagName}:${el.getAttribute('title') || el.getAttribute('aria-label')}`)
      .slice(0, 30),
  );
  console.log('trails titled:', titled.join(' | '));
  for (const u of [
    'https://jegors-intelligent-trails.vercel.app/en/map',
    'https://jegors-intelligent-trails.vercel.app/map?lang=en',
  ]) {
    const resp = await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => null);
    console.log(`trails ${u}:`, resp ? resp.status() : 'FAIL');
    if (resp && resp.status() === 200) {
      await page.waitForTimeout(3000);
      const t = await page.evaluate(() => document.body.innerText.slice(0, 300));
      console.log('  текст:', t.replace(/\n/g, ' | ').slice(0, 200));
    }
  }
  await page.close();
}

await browser.close();
console.log('DONE');
