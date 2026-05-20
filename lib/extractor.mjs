/**
 * Content extractor - runs selectors inside Playwright page.evaluate
 */

import {
  isSpecialSelector,
  isjQueryExpr,
  isjQueryObj,
  isTextRemoval,
  isRegexp,
  isXPath,
  classifySelector,
  parseAngleBracket,
  buildjQueryEvalCode,
  buildjQueryObjEvalCode,
  unwrapSpecial,
} from './selector.mjs';

/**
 * Check if any selector in the rule requires jQuery
 */
function needsjQuery(rule) {
  const fields = [rule.title, rule.desc, rule.include];
  if (rule.exclude) fields.push(...rule.exclude);
  return fields.some(f => f && isSpecialSelector(f));
}

/**
 * jQuery CDN injection snippet (jQuery 3.x slim min)
 * Wrapped in async IIFE since page.evaluate() doesn't support top-level await
 */
const JQUERY_INJECT = `(async function() {
  if (typeof window.jQuery === 'undefined') {
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.slim.min.js';
    document.head.appendChild(s);
    await new Promise(function(r) { s.onload = r; s.onerror = r; });
  }
})()`;

/**
 * Wait for jQuery to be available in the page
 */
const WAIT_JQUERY = `(async function() {
  await new Promise(function(resolve) {
    if (typeof window.jQuery !== 'undefined') return resolve();
    var tries = 0;
    var check = function() {
      if (typeof window.jQuery !== 'undefined') return resolve();
      if (++tries > 50) return resolve();
      setTimeout(check, 100);
    };
    check();
  });
})()`;

/**
 * Build evaluation code for a single selector
 * Returns JS code string that can run inside page.evaluate
 */
function buildSelectorCode(selector, mode = 'text') {
  if (!selector || selector.trim() === '') return '""';

  const classified = classifySelector(selector);

  switch (classified.type) {
    case 'empty':
      return '""';

    case 'jquery-expr':
      return buildjQueryEvalCode(selector);

    case 'jquery-obj':
      return buildjQueryObjEvalCode(selector);

    case 'text-removal':
      // Text removal is handled during exclude processing, not standalone
      return '""';

    case 'regexp':
      // Regexp is handled during exclude processing
      return '""';

    case 'xpath': {
      const xpath = unwrapSpecial(selector);
      return `(function() {
        var result = document.evaluate(${JSON.stringify(xpath)}, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        return result.singleNodeValue ? result.singleNodeValue.textContent || '' : '';
      })()`;
    }

    case 'css': {
      const css = classified.cssSelector;
      if (mode === 'html') {
        return `(function() {
          var el = document.querySelector(${JSON.stringify(css)});
          return el ? el.innerHTML || '' : '';
        })()`;
      }
      return `(function() {
        var el = document.querySelector(${JSON.stringify(css)});
        return el ? (el.textContent || '').trim() : '';
      })()`;
    }

    default:
      return '""';
  }
}

/**
 * Build the complete extraction script to run in page.evaluate
 */
function buildExtractionScript(rule) {
  const titleCode = buildSelectorCode(rule.title, 'text');
  const descCode = buildSelectorCode(rule.desc, 'text');
  const includeCode = buildSelectorCode(rule.include, 'html');

  // Build exclude processing
  const excludeSelectors = (rule.exclude || []).filter(Boolean);
  let excludeCode = '';

  if (excludeSelectors.length > 0) {
    const excludeParts = excludeSelectors.map(sel => {
      const classified = classifySelector(sel);

      switch (classified.type) {
        case 'jquery-obj': {
          const code = buildjQueryObjEvalCode(sel);
          return `(function() { var el = ${code}; if (el) el.remove(); })()`;
        }
        case 'text-removal': {
          const text = unwrapSpecial(sel);
          return `(function() {
            var all = document.querySelectorAll('*');
            for (var i = 0; i < all.length; i++) {
              if (all[i].textContent && all[i].textContent.indexOf(${JSON.stringify(text)}) !== -1) {
                all[i].remove();
              }
            }
          })()`;
        }
        case 'regexp': {
          const re = unwrapSpecial(sel);
          return `(function() {
            var re = new RegExp(${JSON.stringify(re)}, 'g');
            var html = document.body.innerHTML;
            document.body.innerHTML = html.replace(re, '');
          })()`;
        }
        case 'css': {
          const css = classified.cssSelector;
          return `(function() {
            var els = document.querySelectorAll(${JSON.stringify(css)});
            for (var i = 0; i < els.length; i++) els[i].remove();
          })()`;
        }
        default:
          return '';
      }
    });

    excludeCode = excludeParts.join('\n');
  }

  return `
    (function() {
      try {
        var result = { title: '', desc: '', content: '' };

        // Extract title
        try { result.title = ${titleCode}; } catch(e) {}

        // Extract desc
        try { result.desc = ${descCode}; } catch(e) {}

        // Extract content
        try {
          var contentEl = ${includeCode === '""' ? 'null' : includeCode};
          if (contentEl) {
            // Create temp container
            var tmp = document.createElement('div');
            tmp.innerHTML = typeof contentEl === 'string' ? contentEl : '';
            var root = tmp.firstChild || tmp;

            // Remove style and script tags
            var styles = tmp.querySelectorAll('style, script, link[rel="stylesheet"]');
            for (var i = 0; i < styles.length; i++) styles[i].remove();

            // Apply exclusions
            ${excludeCode}

            result.content = tmp.innerHTML || '';
          }
        } catch(e) {}

        return result;
      } catch(e) {
        return { title: '', desc: '', content: '', error: e.message };
      }
    })()
  `;
}

/**
 * Extract content from a page using a rule
 * @param {import('playwright').Page} page
 * @param {object} rule - site rule from website_list.json
 * @returns {{ title: string, desc: string, content: string }}
 */
export async function extractContent(page, rule) {
  const needsJQ = needsjQuery(rule);

  // Inject jQuery if needed
  if (needsJQ) {
    await page.evaluate(JQUERY_INJECT);
    await page.evaluate(WAIT_JQUERY);
  }

  // Run extraction
  const script = buildExtractionScript(rule);
  const result = await page.evaluate(script);

  return {
    title: result.title || '',
    desc: result.desc || '',
    content: result.content || '',
  };
}

/**
 * Extract content with custom selectors (no rule matching)
 * @param {import('playwright').Page} page
 * @param {object} options - { title, include }
 * @returns {{ title: string, desc: string, content: string }}
 */
export async function extractWithSelectors(page, options) {
  const rule = {
    title: options.title || '<title>',
    desc: '',
    include: options.include || '',
    exclude: [],
  };
  return extractContent(page, rule);
}
