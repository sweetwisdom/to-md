/**
 * HTML to Markdown converter using Turndown
 */

import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

/**
 * Create a configured TurndownService instance
 */
export function createConverter() {
  const turndown = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**',
  });

  // Enable GFM plugin (tables, strikethrough, task lists)
  turndown.use(gfm);

  // Custom rule: preserve lazy-loaded images
  turndown.addRule('lazyImages', {
    filter: 'img',
    replacement(_content, node) {
      const src = node.getAttribute('src') ||
                  node.getAttribute('data-src') ||
                  node.getAttribute('data-original') ||
                  '';
      const alt = node.getAttribute('alt') || '';
      if (!src) return '';
      return `![${alt}](${src})`;
    },
  });

  // Custom rule: remove empty links
  turndown.addRule('emptyLinks', {
    filter(node) {
      return node.nodeName === 'A' && !node.textContent.trim();
    },
    replacement() {
      return '';
    },
  });

  // Custom rule: clean up sr- prefixed elements (SimpRead custom tags)
  turndown.addRule('simpreadTags', {
    filter(node) {
      return node.nodeName && node.nodeName.toLowerCase().startsWith('sr-');
    },
    replacement(content) {
      return content;
    },
  });

  return turndown;
}

/**
 * Convert HTML to Markdown
 * @param {string} html
 * @returns {string} markdown
 */
export function toMarkdown(html) {
  if (!html) return '';
  return createConverter().turndown(html);
}

/**
 * Convert extracted result to a complete Markdown document
 * @param {{ title: string, desc: string, content: string, url?: string }}
 * @returns {string} markdown document
 */
export function toDocument({ title, desc, content, url }) {
  const parts = [];

  if (title) {
    parts.push(`# ${title}\n`);
  }

  if (desc) {
    parts.push(`> ${desc}\n`);
  }

  if (url) {
    parts.push(`> 原文：${url}\n`);
  }

  parts.push(toMarkdown(content));

  return parts.join('\n');
}
