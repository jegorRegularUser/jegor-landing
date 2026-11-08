/* Финальные кадры эволюции: 6 игроков (5 ботов), быстрая скорость,
   разыгрываем животных, фаза еды со всеми на столе, журнал. */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('https://evolution-online.vercel.app/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(3000);

// Настройки: 6 участников (ты + 5 ботов), быстрая скорость, полная колода.
await page.getByRole('button', { name: '6', exact: true }).click();
await page.getByRole('button', { name: 'Быстро' }).click().catch(() => {});
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Начать год' }).click();
await page.waitForTimeout(4000);

// Расставляем трёх животных.
for (let i = 0; i < 3; i += 1) {
  const btn = page.getByRole('button', { name: 'Животное', exact: true }).first();
  try {
    await btn.click({ timeout: 4000 });
    await page.waitForTimeout(900);
  } catch {
    break;
  }
}
console.log('животные расставлены');

// Фаза еды: боты выставляют своих — богатый стол.
try {
  await page.getByRole('button', { name: 'Закончить развитие' }).click({ timeout: 4000 });
} catch {
  /* уже в еде */
}
await page.waitForTimeout(6000);
await page.screenshot({ path: 'assets-src/screens/evolution-online-2.png' });
console.log('стол с животными снят');

// Журнал: вкладка «Чат» (пункт 11 — чат в матче).
try {
  await page.locator('button[title="Журнал"]').first().click({ timeout: 4000 });
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Чат', exact: true }).click({ timeout: 4000 });
  await page.waitForTimeout(600);
  // Если в чате есть поле ввода — напишем сообщение.
  const chatInput = page.locator('input[placeholder]:visible, textarea:visible').last();
  if ((await chatInput.count()) > 0) {
    await chatInput.fill('Всем привет с лендинга!');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(900);
  }
  await page.screenshot({ path: 'assets-src/screens/evolution-online-4.png' });
  console.log('чат снят');
} catch (e) {
  console.warn('чат не открылся:', String(e).slice(0, 150));
}

await browser.close();
console.log('DONE');
