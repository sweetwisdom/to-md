#!/usr/bin/env node

/**
 * web2md - Convert web pages to clean Markdown
 * Uses Playwright for page loading + Defuddle for content extraction
 */
import { Command } from 'commander';
import { writeFileSync } from 'node:fs';
import { fetchPage } from '../lib/browser.mjs';
import { htmlToMarkdown, formatMarkdown } from '../lib/converter.mjs';

const program = new Command();

program
  .name('web2md')
  .description('Convert web pages to clean Markdown using Playwright + Defuddle')
  .version('1.0.0')
  .argument('<url>', 'URL to convert')
  .option('-o, --output <file>', 'Output to file instead of stdout')
  .option('--headless', 'Run browser in headless mode (default)', true)
  .option('--no-headless', 'Show browser window')
  .option('--wait <ms>', 'Extra wait time for dynamic content', '0')
  .option('--timeout <ms>', 'Page load timeout in ms', '30000')
  .option('--browser <name>', 'Browser to use: chrome, msedge', 'chrome')
  .option('--profile <dir>', 'Chrome profile directory (keeps login sessions)')
  .option('--no-frontmatter', 'Skip YAML frontmatter')
  .option('--json', 'Output as JSON with metadata')
  .action(async (url, options) => {
    try {
      // Validate URL
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      console.error(`Fetching: ${url}`);

      // Load page with Playwright
      const { html, title } = await fetchPage(url, {
        headless: options.headless,
        timeout: parseInt(options.timeout, 10),
        wait: parseInt(options.wait, 10),
        profile: options.profile,
        browser: options.browser,
      });

      console.error(`Page loaded: ${title} (${html.length} bytes)`);

      // Convert to Markdown with Defuddle
      const result = await htmlToMarkdown(html, url);

      console.error(`Extracted: ${result.title} (${result.wordCount} words)`);

      let output;

      if (options.json) {
        output = JSON.stringify({ ...result, url }, null, 2);
      } else {
        output = options.frontmatter !== false
          ? formatMarkdown(result, url)
          : result.content;
      }

      // Output
      if (options.output) {
        writeFileSync(options.output, output, 'utf-8');
        console.error(`Saved to ${options.output}`);
      } else {
        process.stdout.write(output + '\n');
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program.parse();
