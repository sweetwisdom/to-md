---
name: to-md
description: |
  Web content extraction and Markdown conversion tool using SimpRead rules and Playwright.
  Use this skill when:
  - User wants to scrape/extract web pages to Markdown
  - User mentions "抓取网页", "网页转Markdown", "to-md", "playwright-to-md"
  - User needs to add site-specific extraction rules for new websites
  - User is debugging extraction issues with specific URLs
  - User wants to understand or modify the to-md project architecture
  - User asks about SimpRead selector syntax or website_list.json format
---

# to-md Skill

CLI tool for extracting web content using SimpRead rules and converting to Markdown via Playwright.

## Quick Start

```bash
# Basic usage
npx playwright-to-md <url>

# With output file
npx playwright-to-md <url> -o output.md

# Using Chrome profile (keeps login sessions)
npx playwright-to-md <url> --profile "C:\Users\<user>\AppData\Local\Google\Chrome\User Data"

# Custom selector
npx playwright-to-md <url> -i ".article-content"

# Skip rule matching, use Readability directly
npx playwright-to-md <url> --no-rule

# Wait for dynamic content
npx playwright-to-md <url> --wait 3000
```

## Architecture

### Three-Tier Extraction Strategy

```
URL → Playwright loads page
  ├─ Tier 1: Rule match (website_list.json) → extractor.mjs
  ├─ Tier 2: Readability.js injection (readability.mjs)
  └─ Tier 3: Generic CSS selectors (article, main, .content etc.)
→ converter.mjs (Turndown) → Markdown output
```

Each tier auto-falls back to next if content < 100 chars.

### Module Map

| File | Purpose |
|------|---------|
| `bin/cli.mjs` | CLI entry, orchestration, browser launch with anti-detection |
| `lib/rules.mjs` | Load `data/website_list.json`, URL pattern matching (glob + regex) |
| `lib/selector.mjs` | Parse SimpRead selector syntax (CSS, jQuery, XPath, regex, text removal, pipe fallback) |
| `lib/extractor.mjs` | Execute selectors in Playwright `page.evaluate`, inject jQuery on demand |
| `lib/readability.mjs` | Inject Readability.js into browser context as fallback |
| `lib/converter.mjs` | Turndown config (GFM, lazy-load images, clean sr-* tags) |
| `data/website_list.json` | SimpRead site rules (~130KB, hundreds of rules) |

## SimpRead Selector Syntax

The `[[...]]` wrapped selectors in `website_list.json`:

| Syntax | Meaning | Example |
|--------|---------|---------|
| `<tag class='x'>` | Angle-bracket CSS | `<div class='article'>` |
| `[[{ code }]]` | jQuery expression (returns text) | `[[{ $('article').text() }]]` |
| `[[[ code ]]]` | jQuery object (returns HTML) | `[[[$('.content')]]]` |
| `[['text']]` | Text removal directive | `[['广告']]` |
| `[[/regexp/]]` | Regex removal | `[[/\d{4}-\d{2}/]]` |
| `` [[`xpath`]] `` | XPath selector | `` [[`//article`]] `` |
| `a \|\| b` | Pipe fallback (try a, fallback to b) | `<article> \|\| <main>` |

## Adding Site Rules

To add support for a new website:

1. **Find the site's content selectors** using browser DevTools
2. **Add rule to `data/website_list.json`** in the `sites` array:

```json
{
  "name": "Site Name",
  "url": "http*://*.example.com/path/*",
  "title": "<h1 class='title'>",
  "desc": "",
  "include": "<div class='article-body'>",
  "exclude": [
    "<div class='ad'>",
    "[['广告']]"
  ]
}
```

3. **Test the rule**:
```bash
node bin/cli.mjs https://example.com/article -o test.md
```

### URL Pattern Format

- `http*://` matches both http and https
- `*` matches any non-slash chars
- `**` matches anything including slashes
- `[[/regex/]]` for regex patterns
- Trailing `/` means prefix match

### Rule Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Display name |
| `url` | string | URL pattern to match |
| `title` | string | Title selector |
| `desc` | string | Description/excerpt selector |
| `include` | string | Content selector |
| `exclude` | string[] | Selectors for elements to remove |

## Common Tasks

### Debug extraction for a URL

```bash
# Step 1: Try with rule matching
node bin/cli.mjs <url> -o debug.md

# Step 2: If content is wrong, try without rules
node bin/cli.mjs <url> --no-rule -o debug.md

# Step 3: Try custom selector
node bin/cli.mjs <url> -i ".specific-content" -o debug.md

# Step 4: Add wait for dynamic content
node bin/cli.mjs <url> --wait 5000 -o debug.md
```

### Handle login-required pages

```bash
# Windows
node bin/cli.mjs <url> --profile "C:\Users\<user>\AppData\Local\Google\Chrome\User Data"

# macOS
node bin/cli.mjs <url> --profile "~/Library/Application Support/Google/Chrome"
```

Note: `--profile` launches visible Chrome (non-headless). Don't close the browser during extraction.

### Site-specific delays

Some sites need extra wait for dynamic content. Add to `cli.mjs` `SITE_DELAYS` config if needed.

## Development

```bash
# Install dependencies
npm install

# Run CLI
node bin/cli.mjs <url>

# Project uses ES Modules ("type": "module")
```

## Key Implementation Details

- Anti-detection: injects script to remove `navigator.webdriver` flag
- jQuery injected on-demand only when rule requires it (CDN: jquery@3.7.1 slim)
- Readability.js source read from node_modules and injected into browser context (runs in browser, not Node)
- URL normalized before matching (strip www., unify protocol to http://)
