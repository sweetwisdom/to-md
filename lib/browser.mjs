/**
 * Playwright browser management - page loading with stealth mode
 */
import { chromium } from 'playwright';

const STEALTH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

/**
 * Launch browser and navigate to URL, returning rendered HTML
 * @param {string} url
 * @param {object} options
 * @returns {Promise<{ html: string, title: string }>}
 */
export async function fetchPage(url, options = {}) {
  const {
    headless = true,
    timeout = 30000,
    wait = 0,
    profile = null,
    browser: browserChannel = 'chrome',
  } = options;

  let browser, context;

  try {
    const stealthArgs = {
      args: ['--disable-blink-features=AutomationControlled'],
      userAgent: STEALTH_UA,
    };

    if (profile) {
      context = await chromium.launchPersistentContext(profile, {
        headless: false,
        channel: browserChannel,
        viewport: null,
        ...stealthArgs,
      });

      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        delete window.__playwright__;
        delete window.__pwInitScripts;
      });
    } else {
      browser = await chromium.launch({
        headless,
        channel: browserChannel,
        ...stealthArgs,
      });
      context = await browser.newContext();
    }

    const page = context.pages()[0] || await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout });

    if (wait > 0) {
      await page.waitForTimeout(wait);
    }

    // Scroll to trigger lazy-loaded images
    await page.evaluate(async () => {
      const step = window.innerHeight;
      const max = document.body.scrollHeight;
      for (let y = 0; y < max; y += step) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 100));
      }
      window.scrollTo(0, 0);

      // Fix lazy-load image attributes
      document.querySelectorAll('img').forEach(img => {
        const realSrc = img.getAttribute('data-src') ||
                        img.getAttribute('data-original') ||
                        img.getAttribute('data-actualsrc') || '';
        if (realSrc && (img.src.startsWith('data:') || !img.src)) {
          img.setAttribute('src', realSrc);
        }
      });
    });

    const html = await page.content();
    const title = await page.title();

    return { html, title };
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}
