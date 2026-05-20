/**
 * Selector parser for SimpRead's selector syntaxes
 *
 * Supported formats:
 * 1. CSS selectors: <div class='content'>, <title>, <article>
 * 2. jQuery expressions: [[{ $('selector').text() }]]
 * 3. jQuery objects: [[[$('selector')]]]
 * 4. Text removal: [['text']]
 * 5. Regexp: [[/regexp/]]
 * 6. XPath: [[`xpath`]]
 * 7. Pipe fallback: primary || fallback
 */

// Matches [[{...}]], [[['...']]], [[/.../]], [[`...`]]
const SPECIAL_RE = /^\[\[[\[{`'/][ \S]+[}`'/\]]\]\]$/;

/**
 * Check if raw string is a special [[...]] selector
 */
export function isSpecialSelector(raw) {
  if (!raw || typeof raw !== 'string') return false;
  return SPECIAL_RE.test(raw.trim());
}

/**
 * Check if raw string is a jQuery expression [[{...}]]
 */
export function isjQueryExpr(raw) {
  return /^\[\[\{.*\}\]\]$/.test(raw.trim());
}

/**
 * Check if raw string is a jQuery object expression [[[..]]]
 */
export function isjQueryObj(raw) {
  return /^\[\[\[.*\]\]\]$/.test(raw.trim());
}

/**
 * Check if raw string is a text removal directive [['text']]
 */
export function isTextRemoval(raw) {
  return /^\[\['.*'\]\]$/.test(raw.trim());
}

/**
 * Check if raw string is a regexp [[/regexp/]]
 */
export function isRegexp(raw) {
  return /^\[\[\/.*\/\]\]$/.test(raw.trim());
}

/**
 * Check if raw string is an XPath [[`xpath`]]
 */
export function isXPath(raw) {
  return /^\[\[`.*`\]\]$/.test(raw.trim());
}

/**
 * Convert angle bracket selector to CSS selector
 * <div class='content'> → div.content
 * <article id='main'> → article#main
 * <title> → title
 */
export function parseAngleBracket(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // Match <tag class='value'> or <tag id='value'> or <tag>
  // Handle both single and double quotes properly
  const match = trimmed.match(
    /<(\S+?)(?:\s+(class|id)=("([^"]*)"|'([^']*)'))?\s*\/?>?$/i
  );
  if (!match) return null;

  const [, tag, attrType, , doubleQuoted, singleQuoted] = match;
  const attrValue = doubleQuoted || singleQuoted;
  if (!attrType) return tag;
  if (attrType.toLowerCase() === 'class') return `${tag}.${attrValue}`;
  if (attrType.toLowerCase() === 'id') return `${tag}#${attrValue}`;
  return tag;
}

/**
 * Classify a raw selector string
 * @returns {{ type: string, value: string, cssSelector?: string }}
 */
export function classifySelector(raw) {
  if (!raw || typeof raw !== 'string') {
    return { type: 'empty', value: '' };
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    return { type: 'empty', value: '' };
  }

  if (isjQueryExpr(trimmed)) {
    return { type: 'jquery-expr', value: trimmed };
  }
  if (isjQueryObj(trimmed)) {
    return { type: 'jquery-obj', value: trimmed };
  }
  if (isTextRemoval(trimmed)) {
    return { type: 'text-removal', value: trimmed };
  }
  if (isRegexp(trimmed)) {
    return { type: 'regexp', value: trimmed };
  }
  if (isXPath(trimmed)) {
    return { type: 'xpath', value: trimmed };
  }

  // Try angle bracket CSS
  const css = parseAngleBracket(trimmed);
  if (css) {
    return { type: 'css', value: trimmed, cssSelector: css };
  }

  // Plain CSS selector fallback
  return { type: 'css', value: trimmed, cssSelector: trimmed };
}

/**
 * Parse pipe-separated fallback selectors
 * "primary || fallback" → [primary, fallback]
 */
export function parseFallbackSelectors(raw) {
  if (!raw || typeof raw !== 'string') return [raw];
  // Split on || but not inside [[{...}]]
  const parts = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '[' && raw[i + 1] === '[') depth++;
    if (ch === ']' && raw[i + 1] === ']') depth--;

    if (ch === '|' && raw[i + 1] === '|' && depth === 0) {
      parts.push(current.trim());
      current = '';
      i++; // skip second |
    } else {
      current += ch;
    }
  }
  parts.push(current.trim());
  return parts.filter(Boolean);
}

/**
 * Extract inner code from special selector wrappers
 * [[{code}]] → code
 * [[[code]]] → code
 * [['text']] → text
 * [[/regexp/]] → regexp
 * [[`xpath`]] → xpath
 */
export function unwrapSpecial(raw) {
  const trimmed = raw.trim();
  // Remove outer [[ and ]]
  const inner = trimmed.slice(2, -2);
  // Remove wrapping char: {, [, ', /, `
  return inner.slice(1, -1);
}

/**
 * Build the JS code to evaluate a jQuery expression in browser context
 * Handles || fallback within jQuery expressions
 */
export function buildjQueryEvalCode(raw) {
  const code = unwrapSpecial(raw);
  // The code is like: $('selector').text() || $('fallback').text()
  // We need to wrap it in a function that handles null/undefined
  return `(function() {
    var result = ${code};
    return result != null ? String(result) : '';
  })()`;
}

/**
 * Build JS code to evaluate a jQuery object expression (returns HTML)
 */
export function buildjQueryObjEvalCode(raw) {
  const code = unwrapSpecial(raw);
  return `(function() {
    var el = ${code};
    if (!el || el.length === 0) return '';
    return el.length === 1 ? el.html() || '' : el.map(function() { return this.outerHTML; }).get().join('');
  })()`;
}
