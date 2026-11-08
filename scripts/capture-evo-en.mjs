/* EN-кадры эволюции с локального билда :8099. */
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto('http://localhost:8099', { waitUntil: 'load', timeout: 20000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: 'assets-src/screens/evolution-online-en.png' });
console.log('меню EN ок');

// Имя + Create table
const inputs = await page.evaluate(() =>
  Array.from(document.querySelectorAll('input'))
    .filter((el) => el.getBoundingClientRect().width > 0)
    .map((el) => `${el.getAttribute('placeholder') || ''}|${el.value}`),
);
console.log('inputs:', JSON.stringify(inputs));
const nameInput = page.locator('input').first();
await nameInput.fill('Evo');
await page.waitForTimeout(400);
await page.getByRole('button', { name: /Create table/i }).click({ timeout: 5000 });
await page.waitForTimeout(2500);
console.log('=== лобби-кнопки ===');
const lobbyBtns = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button'))
    .filter((el) => el.getBoundingClientRect().width > 0)
    .map((el) => (el.textContent || '').trim().slice(0, 40))
    .filter(Boolean),
);
console.log(lobbyBtns.join(' | '));
// 6 игроков, старт: заполняем места ботами
await page.getByRole('button', { name: '6', exact: true }).click();
await page.waitForTimeout(600);
const seatDump = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button'))
    .filter((el) => el.getBoundingClientRect().width > 0 && /bot/i.test(el.textContent + ' ' + (el.getAttribute('aria-label') || '')))
    .map((el) => (el.textContent || el.getAttribute('aria-label')).trim().slice(0, 40)),
);
console.log('seat buttons:', JSON.stringify(seatDump));
// жмём все кнопки добавления ботов, пока Start не станет активным
for (let i = 0; i < 5; i += 1) {
  const addBot = page.getByRole('button', { name: 'Add a bot', exact: true }).first();
  try {
    await addBot.click({ timeout: 3000 });
    await page.waitForTimeout(400);
  } catch {
    console.warn('add bot fail на', i);
    break;
  }
}
console.log('seats filled');
await page.getByRole('button', { name: /Start year/i }).click({ timeout: 6000 });
await page.waitForTimeout(4000);

// Расставляем трёх животных
for (let i = 0; i < 3; i += 1) {
  const btn = page.getByRole('button', { name: /^Animal$/i }).first();
  try {
    await btn.click({ timeout: 4000 });
    await page.waitForTimeout(900);
  } catch {
    console.warn('animal fail', i);
    break;
  }
}
console.log('animals placed');

// Фаза еды: боты выкладывают своих
try {
  await page.getByRole('button', { name: /End development/i }).click({ timeout: 5000 });
} catch {}
await page.waitForTimeout(6000);
await page.screenshot({ path: 'assets-src/screens/evolution-online-2-en.png' });
console.log('стол EN снят');
const titled = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button'))
    .filter((el) => el.getBoundingClientRect().width > 0)
    .map((el) => `${el.getAttribute('title') || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 20)}`),
);
console.log('in-game buttons:', JSON.stringify(titled));

// Чат: вкладка Chat + фраза
try {
  await page.locator('button[title^="Journal"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Chat', exact: true }).click({ timeout: 4000 });
  await page.waitForTimeout(700);
  const hi = page.getByRole('button', { name: /^Hi!$/i }).first();
  if ((await hi.count()) > 0) {
    await hi.click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({ path: 'assets-src/screens/evolution-online-3-en.png' });
  console.log('чат EN снят');
} catch (e) {
  console.warn('чат fail:', String(e).slice(0, 150));
}

await browser.close();
console.log('DONE');
