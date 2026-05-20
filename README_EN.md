# to-md

> One command to turn any web page into clean Markdown. No copy-paste needed.

[中文](./README.md) | English

---

## The Problem

Ever run into these issues?

- Found a great article, tried to save it to your notes — **formatting breaks** after pasting, images disappear, code blocks get mangled
- Web pages are cluttered with ads, sidebars, and comment sections — **manual cleanup is tedious**
- Want to scrape content that **requires login** (e.g., members-only articles, paid columns) — regular scrapers can't access it
- Sites have **anti-scraping mechanisms** that block your scripts immediately
- SPA pages render content via JavaScript — **scraping returns blank**

`to-md` was built to solve all of these.

## Why to-md

| Feature | Description |
|---------|-------------|
| Anti-detection | Injects stealth scripts, removes `navigator.webdriver` flags, mimics real browser behavior |
| Reuse login sessions | `--profile` option points to existing Chrome profile directory, reusing cookies and login state |
| Pure Markdown output | Powered by Turndown + GFM plugin — standard Markdown with code blocks, tables, and image links intact |
| Precise extraction | Hundreds of built-in SimpRead site rules, automatically filtering ads, navigation, comments |
| Three-tier fallback | Rule matching → Readability → generic selectors — ensures content from any page |
| Lazy-loaded images | Auto-detects `data-src`, `data-original` attributes — no broken image links |

## Installation & Usage

### Option 1: Run with npx (try it out)

No installation needed:

```bash
npx playwright-to-md https://juejin.cn/post/7605416964510810139
npx playwright-to-md https://juejin.cn/post/7605416964510810139 -o article.md
```

### Option 2: Global install (recommended for frequent use)

```bash
npm install -g playwright-to-md

# Use directly after install
to-md https://juejin.cn/post/7605416964510810139
to-md https://juejin.cn/post/7605416964510810139 -o article.md
```

**Requirements:** Node.js >= 18, Chrome browser installed on the system.

## CLI Options

```
to-md <url> [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <file>` | Output to file | stdout |
| `-i, --include <selector>` | Custom content selector | auto-detect |
| `-t, --title <selector>` | Custom title selector | auto-detect |
| `--no-rule` | Skip rule matching, use Readability directly | - |
| `--wait <ms>` | Extra wait time for dynamic content | `0` |
| `--timeout <ms>` | Page load timeout | `30000` |
| `--profile <dir>` | Chrome profile directory (keeps login sessions) | none |

## Usage Examples

### Extract Technical Articles

```bash
# Juejin (Chinese dev community)
to-md https://juejin.cn/post/7605416964510810139 -o article.md

# Zhihu columns
to-md https://zhuanlan.zhihu.com/p/123456 -o article.md

# CSDN blog posts
to-md https://blog.csdn.net/user/article/details/123456 -o article.md
```

### Extract Pages Requiring Login

Use `--profile` to specify a Chrome user data directory, reusing existing login sessions:

```bash
# Windows
to-md https://example.com/member-only -o article.md --profile "C:\Users\YourName\AppData\Local\Google\Chrome\User Data"

# macOS
to-md https://example.com/member-only -o article.md --profile "~/Library/Application Support/Google/Chrome"

# Linux
to-md https://example.com/member-only -o article.md --profile "~/.config/google-chrome"
```

> Note: `--profile` mode launches a visible Chrome window (non-headless). Do not close the browser while the tool is running.

### Handle Dynamically Loaded Pages

Some sites render content via JavaScript and need extra wait time:

```bash
# Specify wait time manually
to-md https://example.com/spa-page -o article.md --wait 3000

# Increase timeout for slow-loading pages
to-md https://example.com/slow-page -o article.md --timeout 60000
```

### Custom Selectors

When built-in rules don't match, use `-i` to specify the content area:

```bash
# CSS selector
to-md https://example.com/article -i ".post-content"

# Compound selector
to-md https://example.com/article -i "article .entry-content"

# Specify both title and content selectors
to-md https://example.com/article -t "h1.title" -i ".article-body"
```

## How It Works

to-md uses a **three-tier extraction strategy** with automatic fallback to ensure content extraction from any web page:

```
                         ┌─────────────────────────┐
                         │   Playwright loads page   │
                         └────────────┬────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
            │   Tier 1     │  │   Tier 2     │  │   Tier 3     │
            │ Rule Match   │  │ Readability  │  │  Generic     │
            │              │  │              │  │  Selectors   │
            │ SimpRead     │  │ Injected     │  │              │
            │ rules from   │  │ into browser │  │ article      │
            │ website_list │  │ context      │  │ main         │
            │ .json        │  │              │  │ .content     │
            └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                   │                 │                 │
                   │    content < 100 chars?           │
                   ├────────────────►│                 │
                   │                 │  content < 100  │
                   │                 │  chars?         │
                   │                 ├────────────────►│
                   ▼                 ▼                 ▼
            ┌─────────────────────────────────────────────┐
            │          Turndown → Markdown                │
            │     (GFM, lazy images, tag cleanup)         │
            └─────────────────────────────────────────────┘
                                      │
                                      ▼
                               ┌────────────┐
                               │   Output    │
                               └────────────┘
```

### Tier 1: Rule Matching

Loads hundreds of site rules from `data/website_list.json` (sourced from [SimpRead](https://github.com/Kenshin/simpread)). Matches the URL against known patterns and uses the rule's selectors to precisely extract the title and body content.

Supported selector types:

| Syntax | Description | Example |
|--------|-------------|---------|
| `<tag class='x'>` | CSS selector | `<div class='article'>` |
| `[[{ code }]]` | jQuery expression | `[[{ $('article').text() }]]` |
| `[[[ code ]]]` | jQuery object (returns HTML) | `[[[$('.content')]]]` |
| `[['text']]` | Text removal | `[['Advertisement']]` |
| `[[/regexp/]]` | Regex removal | `[[/\d{4}-\d{2}/]]` |
| `` [[`xpath`]] `` | XPath selector | `` [[`//article`]] `` |
| `a \|\| b` | Pipe fallback | `<article> \|\| <main>` |

### Tier 2: Readability Fallback

When rule matching fails or extracted content is too short, [Mozilla Readability](https://github.com/mozilla/readability) is injected into the browser context for universal article extraction in the DOM environment.

### Tier 3: Generic Selectors

As a last resort, tries common CSS selectors (`article`, `main`, `.content`, `.post-body`, etc.) to extract the most likely content area from the page.

### Markdown Conversion

Uses [Turndown](https://github.com/mixmark-io/turndown) for HTML → Markdown conversion with GFM plugin support (tables, strikethrough, task lists). Additional processing:

- **Lazy-loaded images**: Automatically detects `data-src`, `data-original` attributes
- **SimpRead custom tags**: Strips `<sr-*>` tags while preserving content
- **Empty link filtering**: Removes links with no text content

## Site Compatibility

Built-in rules cover major Chinese tech platforms and common blog engines:

| Site | Method | Notes |
|------|--------|-------|
| Juejin | Rule match | - |
| Zhihu | Rule match | - |
| Sspai | Rule match | - |
| CSDN | Rule match | - |
| Jianshu | Rule match | - |
| Generic blogs | Readability | Auto-detects article areas |

> See `data/website_list.json` for the full rule list, sourced from [SimpRead](https://github.com/Kenshin/simpread).

## Local Development

```bash
# Clone the repository
git clone https://github.com/sweetwisdom/to-md.git
cd to-md

# Install dependencies
npm install

# Run a test extraction
node bin/cli.mjs https://example.com

# Output to file for inspection
node bin/cli.mjs https://juejin.cn/post/7605416964510810139 -o test_output.md
```

### Project Structure

```
to-md/
├── bin/
│   └── cli.mjs            # CLI entry point, orchestrates extraction
├── lib/
│   ├── rules.mjs           # Rule loading and URL matching
│   ├── selector.mjs        # SimpRead selector syntax parser
│   ├── extractor.mjs       # Playwright page content extraction
│   ├── readability.mjs     # Readability injection & generic selectors
│   └── converter.mjs       # Turndown HTML → Markdown conversion
├── data/
│   └── website_list.json   # SimpRead site rule library
└── package.json
```

## Related Projects

- [SimpRead](https://github.com/Kenshin/simpread) - Browser extension for immersive reading
- [Readability](https://github.com/mozilla/readability) - Mozilla's universal article extraction algorithm
- [Turndown](https://github.com/mixmark-io/turndown) - HTML to Markdown converter

## License

[MIT](./LICENSE)
