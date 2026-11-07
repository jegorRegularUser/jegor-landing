/* Дамп ScrollTrigger: старты/концы и прогресс по листам. */
import { chromium } from 'playwright';

const browser = await chromium.launch({
  headless: false,
  args: [
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-features=CalculateNativeWinOcclusion',
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.bringToFront();
await page.waitForSelector('[data-theme-stamp]', { timeout: 20000 });
await page.waitForTimeout(1500);

const dump = () =>
  page.evaluate(`(async () => {
    const { ScrollTrigger } = await import('/src/lib/gsap.ts');
    const list = ScrollTrigger.getAll().map((st) => {
      const t = st.trigger;
      const id = t?.id || t?.className?.toString?.().slice(0, 24) || String(t?.tagName);
      return {
        id,
        start: Math.round(st.start),
        end: Math.round(st.end),
        progress: +st.progress.toFixed(2),
        isActive: st.isActive,
      };
    });
    return { count: ScrollTrigger.getAll().length, scrollY: Math.round(window.scrollY), list: list.slice(0, 40) };
  })()`);
console.log('before scroll:', JSON.stringify(await dump(), null, 1).slice(0, 2200));

// колесо до низа
for (let i = 0; i < 20; i += 1) {
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(90);
}
console.log('after scroll:', JSON.stringify(await dump(), null, 1).slice(0, 2600));
await browser.close();
