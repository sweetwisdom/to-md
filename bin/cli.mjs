#!/usr/bin/env node

import { Command } from 'commander';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { loadRules, matchRule } from '../lib/rules.mjs';
import { extractContent, extractWithSelectors } from '../lib/extractor.mjs';
import { extractWithReadability, extractWithGenericSelector, needsFallback } from '../lib/readability.mjs';
import { isSpecialSelector, classifySelector } from '../lib/selector.mjs';
import { toMarkdown, toDocument } from '../lib/converter.mjs';

/**
 * Wait for content to be available with retry logic
 * Inspired by SimpRead's verifyContent approach
 */
async function waitForContent(page, selector, options = {}) {
  const { timeout = 5000, minLength = 100 } = options;
  const startTime = Date.now();

  // Parse angle-bracket selectors to standard CSS
  const classified = classifySelector(selector);
  const cssSelector = classified.cssSelector || selector;

  while (Date.now() - startTime < timeout) {
    try {
      const result = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return { found: false, length: 0 };
        return {
          found: true,
          length: el.textContent.trim().length,
          html: el.innerHTML.substring(0, 200),
        };
      }, cssSelector);

      if (result.found && result.length >= minLength) {
        return result;
      }
    } catch {}

    // Wait a bit before retrying
    await page.waitForTimeout(500);
  }

  return { found: false, length: 0 };
}

const program = new Command();

program
  .name('to-md')
  .description('Extract web content using SimpRead rules and convert to Markdown')
  .version('1.0.0')
  .argument('<url>', 'URL to extract')
  .option('-t, --title <selector>', 'Custom title selector')
  .option('-i, --include <selector>', 'Custom content selector')
  .option('-o, --output <file>', 'Output to file')
  .option('--no-rule', 'Skip rule matching')
  .option('--timeout <ms>', 'Page load timeout in ms', '30000')
  .option('--wait <ms>', 'Extra wait time for dynamic content in ms (0 = auto)', '0')
  .option('--headless', 'Run browser in headless mode')
  .option('--profile <dir>', 'Chrome profile directory (keeps login sessions)')
  .action(async (url, options) => {
    let browser, context;
    try {
      // Load rules
      const rules = options.rule !== false ? loadRules() : [];
      const rule = options.rule !== false ? matchRule(url, rules) : null;

      if (options.rule !== false && !rule && !options.include) {
        console.warn(`No matching rule found for: ${url}`);
        console.warn('Falling back to Readability...');
      }

      // Launch browser (use user-installed Chrome)
      const profileDir = options.profile;
      let page;

      // Anti-detection options
      const stealthOptions = {
        args: ['--disable-blink-features=AutomationControlled'],
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      };

      const headless = !!options.headless;

      if (profileDir) {
        // Use persistent context with existing Chrome profile (keeps login sessions)
        // --profile always forces non-headless (persistent context requires visible window)
        context = await chromium.launchPersistentContext(profileDir, {
          headless: false,
          channel: 'chrome',
          viewport: null,
          ...stealthOptions,
        });

        // Remove webdriver detection flags
        await context.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
          });
          delete window.__playwright__;
          delete window.__pwInitScripts;
        });

        page = context.pages()[0] || await context.newPage();
      } else {
        browser = await chromium.launch({
          headless,
          channel: 'chrome',
          ...stealthOptions,
        });
        page = await browser.newPage();
      }

      // Navigate - networkidle waits for AJAX/dynamic content to finish loading
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: parseInt(options.timeout, 10),
      });

      // Determine wait strategy
      const contentSelector = options.include || (rule ? rule.include : null);
      const userWait = parseInt(options.wait, 10);

      if (userWait > 0) {
        await page.waitForTimeout(userWait);
      }

      // If we have a CSS content selector, wait for it to appear with content
      // Skip for jQuery/special selectors (they need jQuery injection first)
      if (contentSelector && !isSpecialSelector(contentSelector)) {
        const waitTimeout = userWait > 0 ? userWait : 5000;
        const content = await waitForContent(page, contentSelector, {
          timeout: waitTimeout,
          minLength: 50,
        });

        if (!content.found) {
          console.warn(`Warning: Content selector "${contentSelector}" not found or empty`);
        }
      }

      // Scroll page to trigger lazy-loaded images, then fix data-src → src
      await page.evaluate(async () => {
        // Scroll to bottom in steps to trigger IntersectionObserver lazy loading
        const step = window.innerHeight;
        const max = document.body.scrollHeight;
        for (let y = 0; y < max; y += step) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 100));
        }
        window.scrollTo(0, 0);
        // Convert lazy-load attributes to src
        document.querySelectorAll('img').forEach(img => {
          const realSrc = img.getAttribute('data-src') ||
                          img.getAttribute('data-original') ||
                          img.getAttribute('data-actualsrc') || '';
          if (realSrc && img.src.startsWith('data:')) {
            img.setAttribute('src', realSrc);
          }
        });
      });

      let result = { title: '', desc: '', content: '' };
      let method = 'rule';

      // Tier 1: Rule-based or custom selector extraction
      if (rule || options.include) {
        const effectiveRule = rule || {
          title: options.title || '<title>',
          desc: '',
          include: options.include,
          exclude: [],
        };
        if (options.title) effectiveRule.title = options.title;
        if (options.include) effectiveRule.include = options.include;

        result = await extractContent(page, effectiveRule);
      }

      // Tier 2: Readability fallback
      if (needsFallback(result)) {
        if (rule) {
          console.warn(`Rule matched but content too short, trying Readability...`);
        }
        const readabilityResult = await extractWithReadability(page);
        if (readabilityResult && !needsFallback({ content: readabilityResult.content })) {
          result = {
            title: readabilityResult.title,
            desc: readabilityResult.excerpt,
            content: readabilityResult.content,
          };
          method = 'readability';
        }
      }

      // Tier 3: Generic selector fallback
      if (needsFallback(result)) {
        console.warn('Readability failed, trying generic selectors...');
        const genericResult = await extractWithGenericSelector(page);
        if (genericResult) {
          result = genericResult;
          method = 'generic';
        }
      }

      // Final check
      if (needsFallback(result)) {
        console.warn(`Warning: Extracted content is short (${(result.content || '').length} chars)`);
        console.warn('Try using --wait <ms> to wait longer for dynamic content');
      } else {
        console.warn(`Extracted via: ${method}`);
      }

      // Convert to Markdown
      const markdown = toDocument({
        ...result,
        url,
      });

      // Output
      if (options.output) {
        writeFileSync(options.output, markdown, 'utf-8');
        console.log(`Saved to ${options.output}`);
      } else {
        process.stdout.write(markdown);
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    } finally {
      if (context) await context.close();
      else if (browser) await browser.close();
    }
  });

program.parse();
