/**
 * Rule loader and URL matcher
 * Reuses SimpRead's website_list.json format
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let _rules = null;

/**
 * Load website_list.json from data directory
 * @returns {Array} sites array
 */
export function loadRules() {
  if (_rules) return _rules;
  const dataPath = join(__dirname, '..', 'data', 'website_list.json');
  const raw = readFileSync(dataPath, 'utf-8');
  _rules = JSON.parse(raw).sites;
  return _rules;
}

/**
 * Normalize URL for matching: strip www., trailing slash
 */
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    let path = u.pathname;
    if (path !== '/' && path.endsWith('/')) {
      path = path.replace(/\/$/, '');
    }
    // Normalize protocol to http:// for matching
    const protocol = u.protocol === 'https:' ? 'http:' : u.protocol;
    return `${protocol}//${host}${path}`;
  } catch {
    return url;
  }
}

/**
 * Convert SimpRead URL pattern to regex
 * Supports: http*://*.example.com/path/* , http://example.com/p/
 */
function patternToRegex(pattern) {
  let re = pattern
    // Escape special regex chars except * and ?
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    // * → match any chars (including /), SimpRead URL glob convention
    .replace(/\*/g, '.*')
    // ? → single char
    .replace(/\?/g, '.');

  return new RegExp(`^${re}$`, 'i');
}

/**
 * Match a URL against a single rule's url pattern
 */
function matchPattern(url, pattern) {
  const normalizedUrl = normalizeUrl(url);

  // Regex pattern: [[/regex/]]
  if (pattern.startsWith('[[/') && pattern.endsWith('/]]')) {
    const reStr = pattern.slice(3, -3);
    try {
      return new RegExp(reStr).test(normalizedUrl);
    } catch {
      return false;
    }
  }

  // Normalize pattern: http* → match both http and https
  let normalizedPattern = pattern.replace(/^http\*:/, 'https?:');
  // Normalize pattern protocol to match normalizedUrl (http://)
  normalizedPattern = normalizedPattern.replace(/^https:/, 'http:');

  // Exact prefix match (pattern without wildcards, ends with /)
  if (!normalizedPattern.includes('*') && normalizedPattern.endsWith('/')) {
    return normalizedUrl.startsWith(normalizedPattern);
  }

  // Glob pattern match
  const regex = patternToRegex(normalizedPattern);
  return regex.test(normalizedUrl);
}

/**
 * Find matching rule for a URL
 * @param {string} url
 * @param {Array} rules - sites array from website_list.json
 * @returns {object|null} matched rule or null
 */
export function matchRule(url, rules) {
  const sites = rules || loadRules();

  for (const site of sites) {
    if (matchPattern(url, site.url)) {
      return site;
    }
  }
  return null;
}
