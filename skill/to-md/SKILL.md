---
name: to-md
description: |
  Web content extraction and Markdown conversion tool using Playwright + Defuddle.
  Use this skill when:
  - User wants to scrape/extract web pages to Markdown
  - User mentions "抓取网页", "网页转Markdown", "to-md", "playwright-to-md"
  - User is debugging extraction issues with specific URLs
  - User wants to understand or modify the to-md project architecture
---

# to-md Skill

CLI tool for extracting web content and converting to Markdown via Playwright + Defuddle.

## Quick Start

```bash
# Basic usage
npx playwright-to-md <url>

# With output file
npx playwright-to-md <url> -o output.md

# Output as JSON with metadata
npx playwright-to-md <url> --json

# Skip YAML frontmatter
npx playwright-to-md <url> --no-frontmatter

# Using Chrome profile (keeps login sessions)
npx playwright-to-md <url> --profile "C:\Users\<user>\AppData\Local\Google\Chrome\User Data"

# Show browser window
npx playwright-to-md <url> --no-headless

# Use Edge browser
npx playwright-to-md <url> --browser msedge

# Wait for dynamic content
npx playwright-to-md <url> --wait 3000
```

## Architecture

### Core Flow

```
URL → Playwright loads page → full HTML
  → Defuddle parses DOM, extracts content, converts to Markdown
  → Output (Markdown / JSON)
```

Defuddle uses linkedom internally to parse HTML, automatically strips navigation, ads, sidebars and other non-content elements, and outputs Markdown directly (no Turndown needed).

### Module Map

| File | Purpose |
|------|---------|
| `bin/cli.mjs` | CLI entry, parameter handling, output formatting |
| `lib/browser.mjs` | Playwright browser management: launch, anti-detection, lazy-load image scrolling, get rendered HTML |
| `lib/converter.mjs` | Defuddle invocation for content extraction + Markdown conversion, frontmatter formatting |

## CLI Options

| Option | Default | Description |
|--------|---------|-------------|
| `<url>` | required | URL to convert |
| `-o, --output <file>` | stdout | Output to file |
| `--headless / --no-headless` | headless | Show browser window |
| `--wait <ms>` | 0 | Extra wait for dynamic content |
| `--timeout <ms>` | 30000 | Page load timeout |
| `--browser <name>` | chrome | Browser: chrome, msedge |
| `--profile <dir>` | - | Chrome profile directory (keeps login sessions) |
| `--no-frontmatter` | - | Skip YAML frontmatter |
| `--json` | - | Output as JSON with metadata |

## Known Site Behaviors

| Site | Issue | Solution |
|------|-------|----------|
| zhihu.com | Headless or Chrome returns 403 | Use `--no-headless --browser msedge` |

## Common Tasks

### Debug extraction for a URL

```bash
# Step 1: Basic extraction
node bin/cli.mjs <url> -o debug.md

# Step 2: If content is wrong, try with wait
node bin/cli.mjs <url> --wait 5000 -o debug.md

# Step 3: Check raw metadata
node bin/cli.mjs <url> --json

# Step 4: Show browser to see what loads
node bin/cli.mjs <url> --no-headless
```

### Handle login-required pages

```bash
# Windows
node bin/cli.mjs <url> --profile "C:\Users\<user>\AppData\Local\Google\Chrome\User Data"

# macOS
node bin/cli.mjs <url> --profile "~/Library/Application Support/Google/Chrome"
```

Note: `--profile` launches visible Chrome (non-headless). Don't close the browser during extraction.

### Handle anti-bot sites

```bash
# Use Edge + visible browser to bypass detection
node bin/cli.mjs <url> --no-headless --browser msedge
```

## Development

```bash
# Install dependencies
npm install

# Run CLI
node bin/cli.mjs <url>

# Project uses ES Modules ("type": "module")
```

## Key Implementation Details

- Anti-detection: webdriver flag removal, window.chrome, plugins, languages, screen size, WebGL spoofing, Permissions API, media devices, focus detection
- Page auto-scrolls to trigger lazy-loaded images, fixes `data-src` / `data-original` / `data-actualsrc` attributes
- Defuddle called with `markdown: true`, returns Markdown directly
- Optional YAML frontmatter (title / author / date / source / url)
- URL auto-prepends `https://` if missing
