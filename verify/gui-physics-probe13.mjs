/* Состояние твинов под триггерами: progress, paused, общее число. */
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
    const list = ScrollTrigger.getAll().map((st, i) => {
      const t = st.trigger;
      const a = st.animation;
      return {
        i,
        id: t?.id || String(t?.className)?.slice(0, 20) || t?.tagName,
        start: Math.round(st.start),
        triggerProgress: +st.progress.toFixed(2),
        anim: a ? { progress: +a.progress().toFixed(2), paused: a.paused(), totalDur: +a.duration().toFixed(2) } : null,
      };
    });
    return { scrollY: Math.round(window.scrollY), triggers: ScrollTrigger.getAll().length, list };
  })()`);

console.log('AT LOAD:', JSON.stringify(await dump(), null, 1).slice(0, 3000));
for (let i = 0; i < 20; i += 1) {
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(90);
}
await page.waitForTimeout(800);
console.log('AFTER SCROLL:', JSON.stringify(await dump(), null, 1).slice(0, 3500));
await browser.close();
