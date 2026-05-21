/**
 * Playwright browser management - page loading with stealth mode
 */
import { chromium } from 'playwright';

const STEALTH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

const STEALTH_VIEWPORT = { width: 1920, height: 1080 };

/**
 * Inject stealth patches into browser context (before page scripts execute)
 */
async function injectStealthScripts(context) {
  await context.addInitScript(() => {
    // 1. WebDriver 标志
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // 2. window.chrome 对象
    window.chrome = {
      runtime: {},
      loadTimes: () => {},
      csi: () => {},
      app: {},
    };

    // 3. Plugins（非空数组）
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });

    // 4. Languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['zh-CN', 'zh', 'en-US', 'en'],
    });

    // 5. 屏幕尺寸
    Object.defineProperty(screen, 'width', { get: () => 1920 });
    Object.defineProperty(screen, 'height', { get: () => 1080 });
    Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
    Object.defineProperty(screen, 'availHeight', { get: () => 1040 });

    // 6. 焦点检测
    document.hasFocus = () => true;

    // 7. WebGL 渲染器伪装
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter) {
      if (parameter === 37445) return 'Intel Inc.';
      if (parameter === 37446) return 'Intel Iris OpenGL Engine';
      return getParameter.call(this, parameter);
    };

    // 8. Permissions API
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);

    // 9. 媒体设备
    Object.defineProperty(navigator, 'mediaDevices', {
      get: () => ({
        enumerateDevices: () =>
          Promise.resolve([
            { kind: 'audioinput', label: 'Microphone', deviceId: 'default' },
            { kind: 'videoinput', label: 'Camera', deviceId: 'default' },
          ]),
      }),
    });

    // 10. 清除 Playwright 痕迹
    delete window.__playwright__;
    delete window.__pwInitScripts;
  });
}

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
      viewport: STEALTH_VIEWPORT,
    };

    if (profile) {
      context = await chromium.launchPersistentContext(profile, {
        headless: false,
        channel: browserChannel,
        ...stealthArgs,
      });

      await injectStealthScripts(context);
    } else {
      browser = await chromium.launch({
        headless,
        channel: browserChannel,
        args: ['--disable-blink-features=AutomationControlled'],
      });
      context = await browser.newContext({
        userAgent: STEALTH_UA,
        viewport: STEALTH_VIEWPORT,
      });
      await injectStealthScripts(context);
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
