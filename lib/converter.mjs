/**
 * HTML to Markdown converter using Defuddle
 */

let _Defuddle = null;

async function getDefuddle() {
  if (!_Defuddle) {
    const mod = await import('defuddle/node');
    _Defuddle = mod.Defuddle;
  }
  return _Defuddle;
}

/**
 * Convert rendered HTML to clean Markdown using Defuddle
 * @param {string} html - Full page HTML
 * @param {string} url - Page URL
 * @param {object} options
 * @returns {Promise<{ title: string, content: string, description: string, author: string, published: string, domain: string }>}
 */
export async function htmlToMarkdown(html, url, options = {}) {
  const Defuddle = await getDefuddle();
  const { markdown: _, ...rest } = options;

  // Suppress Defuddle's internal console.error for malformed URLs (e.g. protocol-relative "//...")
  const stderrWrite = process.stderr.write;
  process.stderr.write = () => true;
  let result;
  try {
    result = await Defuddle(html, url, { markdown: true, ...rest });
  } finally {
    process.stderr.write = stderrWrite;
  }

  return {
    title: result.title || '',
    content: result.content || '',
    description: result.description || '',
    author: result.author || '',
    published: result.published || '',
    domain: result.domain || '',
    wordCount: result.wordCount || 0,
    language: result.language || '',
  };
}

/**
 * Format result as a complete Markdown document with frontmatter
 * @param {object} result
 * @param {string} url
 * @returns {string}
 */
export function formatMarkdown(result, url) {
  const parts = [];

  // YAML frontmatter
  const meta = [];
  if (result.title) meta.push(`title: "${escapeYaml(result.title)}"`);
  if (result.author) meta.push(`author: "${escapeYaml(result.author)}"`);
  if (result.published) meta.push(`date: ${result.published}`);
  if (result.domain) meta.push(`source: "${result.domain}"`);
  if (url) meta.push(`url: "${url}"`);

  if (meta.length > 0) {
    parts.push('---');
    parts.push(...meta);
    parts.push('---');
    parts.push('');
  }

  // Title
  if (result.title) {
    parts.push(`# ${result.title}`);
    parts.push('');
  }

  // Description
  if (result.description) {
    parts.push(`> ${result.description}`);
    parts.push('');
  }

  // Content
  if (result.content) {
    parts.push(result.content);
  }

  return parts.join('\n');
}

function escapeYaml(str) {
  return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
}
