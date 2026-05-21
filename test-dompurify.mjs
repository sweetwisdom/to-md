/**
 * 测试 DOMPurify 净化 HTML 对比
 * 通过 CDN 注入 DOMPurify，对比净化前后的 HTML
 */
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const STEALTH_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
const DOMPURIFY_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.4/purify.min.js';

async function test() {
  const url = 'https://juejin.cn/post/7605416964510810139';

  let browser;
  try {
    console.log('正在启动浏览器...');
    browser = await chromium.launch({ headless: false, channel: 'msedge', args: ['--disable-blink-features=AutomationControlled'] });
    const context = await browser.newContext({ userAgent: STEALTH_UA, viewport: { width: 1200, height: 680 } });
    const page = await context.newPage();

    console.log('正在加载页面...');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);

    // 获取原始 HTML
    const rawHtml = await page.content();
    console.log(`原始 HTML 大小: ${rawHtml.length} bytes`);

    // 通过 CDN 注入 DOMPurify
    console.log('正在注入 DOMPurify...');
    await page.addScriptTag({ url: DOMPURIFY_CDN });
    await page.waitForTimeout(1000);

    // 使用 DOMPurify 净化 HTML
    const cleanHtml = await page.evaluate(() => {
      const bodyContent = document.body.innerHTML;
      const clean = DOMPurify.sanitize(bodyContent, {
        ALLOWED_TAGS: [
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'p', 'br', 'hr', 'pre', 'blockquote',
          'ul', 'ol', 'li', 'dl', 'dt', 'dd',
          'table', 'thead', 'tbody', 'tr', 'th', 'td',
          'a', 'img', 'figure', 'figcaption',
          'strong', 'em', 'del', 'ins', 'mark', 'code', 'pre',
          'div', 'span', 'section', 'article', 'aside', 'header', 'footer',
          'main', 'nav', 'details', 'summary',
          'iframe', 'video', 'audio', 'source',
          'sup', 'sub', 'small', 'b', 'i', 'u',
        ],
        ALLOWED_ATTR: [
          'href', 'src', 'alt', 'title', 'width', 'height',
          'class', 'id', 'style', 'data-*',
          'target', 'rel', 'loading',
          'colspan', 'rowspan', 'cellpadding', 'cellspacing',
          'controls', 'autoplay', 'loop', 'muted', 'poster',
        ],
        ALLOW_DATA_ATTR: true,
        KEEP_CONTENT: true,
      });
      return clean;
    });

    console.log(`净化后 HTML 大小: ${cleanHtml.length} bytes`);

    // 保存文件
    writeFileSync('raw-page.html', rawHtml, 'utf-8');
    console.log('已保存: raw-page.html');

    writeFileSync('clean-page.html', cleanHtml, 'utf-8');
    console.log('已保存: clean-page.html');

    // 生成对比报告
    const diffReport = `# DOMPurify 净化对比报告

**测试 URL**: ${url}
**时间**: ${new Date().toISOString()}

## 统计信息

| 指标 | 原始 HTML | 净化后 HTML |
|------|-----------|-------------|
| 大小 (bytes) | ${rawHtml.length} | ${cleanHtml.length} |
| 减少比例 | - | ${((1 - cleanHtml.length / rawHtml.length) * 100).toFixed(1)}% |

## 文件说明

- \`raw-page.html\`: 原始完整页面 HTML
- \`clean-page.html\`: DOMPurify 净化后的内容 HTML
`;

    writeFileSync('dompurify-comparison.md', diffReport, 'utf-8');
    console.log('已保存: dompurify-comparison.md');
    console.log('\n完成!');
  } finally {
    if (browser) await browser.close();
  }
}

test().catch(console.error);
