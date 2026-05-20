/**
 * Readability fallback extractor
 * Injects @mozilla/readability into the browser context for fallback extraction
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load and wrap Readability source for browser injection
 * Combines Readability.js + Readability-readerable.js into a single script
 */
function loadReadabilitySource() {
  const basePath = join(__dirname, '..', 'node_modules', '@mozilla', 'readability');
  const readabilitySrc = readFileSync(join(basePath, 'Readability.js'), 'utf-8');
  const readerableSrc = readFileSync(join(basePath, 'Readability-readerable.js'), 'utf-8');

  return `
${readerableSrc}

${readabilitySrc}

// Expose to window for later use
if (typeof window !== 'undefined') {
  window.__Readability = Readability;
  window.__isProbablyReaderable = isProbablyReaderable;
}
`;
}

let _readabilitySource = null;

function getReadabilitySource() {
  if (!_readabilitySource) {
    _readabilitySource = loadReadabilitySource();
  }
  return _readabilitySource;
}

/**
 * Generic fallback selectors for content extraction
 */
const GENERIC_SELECTORS = [
  'article',
  '[itemprop="articleBody"]',
  '.article-content',
  '.article_body',
  '.post-content',
  '.post_body',
  '.entry-content',
  '.content',
  'main',
  '#content',
  '.markdown-body',
];

/**
 * Extract content using Readability.js in the browser context
 * @param {import('playwright').Page} page
 * @returns {{ title: string, content: string, excerpt: string, byline: string } | null}
 */
export async function extractWithReadability(page) {
  const source = getReadabilitySource();

  const result = await page.evaluate((src) => {
    try {
      // Inject Readability constructor into page
      (new Function(src))();

      if (typeof window.__Readability === 'undefined') {
        return null;
      }

      // Quick check: is the page readerable?
      if (typeof window.__isProbablyReaderable === 'function') {
        if (!window.__isProbablyReaderable(document)) {
          return null;
        }
      }

      // Clone document to avoid modifying the original
      const doc = document.cloneNode(true);
      const reader = new window.__Readability(doc, {
        charThreshold: 100,
      });
      const article = reader.parse();

      if (!article || !article.content) {
        return null;
      }

      return {
        title: article.title || '',
        content: article.content || '',
        excerpt: article.excerpt || '',
        byline: article.byline || '',
        length: article.length || 0,
      };
    } catch (e) {
      return null;
    }
  }, source);

  return result;
}

/**
 * Extract content using generic CSS selectors as last resort
 * @param {import('playwright').Page} page
 * @returns {{ title: string, content: string } | null}
 */
export async function extractWithGenericSelector(page) {
  const selectors = GENERIC_SELECTORS.join(', ');

  const result = await page.evaluate((sel) => {
    try {
      const el = document.querySelector(sel);
      if (!el) return null;

      const title = (document.querySelector('title') || {}).textContent || '';
      const content = el.innerHTML || '';

      if (content.trim().length < 50) return null;

      return { title: title.trim(), content };
    } catch {
      return null;
    }
  }, selectors);

  return result;
}

/**
 * Check if extracted content is too short (needs fallback)
 * @param {{ title: string, content: string }} result
 * @param {number} minLength
 * @returns {boolean}
 */
export function needsFallback(result, minLength = 100) {
  if (!result) return true;
  const contentLength = (result.content || '').replace(/<[^>]+>/g, '').trim().length;
  return contentLength < minLength;
}
