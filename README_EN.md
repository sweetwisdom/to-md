# to-md

> One command to turn any web page into clean Markdown. No copy-paste needed.
>
> Powered by the same extraction engine as [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper), available as a CLI tool.

[中文](./README.md) | English

---

 ![效果演示](./.imgs/recording-1779345809155-1.gif)

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
| JS Rendering | Playwright loads pages, handles SPA and dynamic content |
| Anti-detection | Injects stealth scripts, removes `navigator.webdriver` flags, mimics real browser |
| Smart Extraction | Defuddle auto-detects content area, removes ads, navigation, comments |
| Reuse Login Sessions | `--profile` option points to existing Chrome profile directory |
| YAML Frontmatter | Auto-generates title / author / date / source metadata |
| Lazy-loaded Images | Auto-scroll triggers + `data-src` attribute fixes |
| Dual Browser | Supports Chrome and Edge |

## Supported Sites

Uses the same Defuddle engine as Obsidian Web Clipper with intelligent content detection — **theoretically supports all article-based web pages**.

| Category | Sites |
|----------|-------|
| Tech Communities | Juejin, CSDN, CNBlogs, SegmentFault, V2EX |
| Knowledge Platforms | Zhihu Columns, Jianshu, Sspai, Yuque |
| Code Hosting | GitHub, GitLab, Gitee |
| Blog Systems | WordPress, Hexo, Hugo, Typecho, Ghost |
| News & Media | 36Kr, InfoQ, Huxiu, The Paper |
| International | Medium, Dev.to, Hashnode, Stack Overflow |
| Documentation | Various tech docs, Wiki |

> Sites not listed are also supported. Defuddle automatically identifies article content.

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
| `--browser <name>` | Browser: `chrome` or `msedge` | `chrome` |
| `--headless` / `--no-headless` | Headless mode / show browser window | headless |
| `--wait <ms>` | Extra wait time for dynamic content | `0` |
| `--timeout <ms>` | Page load timeout | `30000` |
| `--profile <dir>` | Chrome/Edge profile directory (keeps login sessions) | none |
| `--no-frontmatter` | Skip YAML frontmatter | - |
| `--json` | Output as JSON with metadata | - |

## Usage Examples

### Extract Technical Articles

```bash
# Juejin
to-md https://juejin.cn/post/7605416964510810139 -o article.md

# Zhihu columns
to-md --no-headless --browser msedge https://zhuanlan.zhihu.com/p/7314838716

# CSDN
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

## How It Works

to-md uses a simple two-step process: Playwright loads the page → Defuddle extracts the content.

```
    ┌─────────────────────────┐
    │   Playwright loads page  │
    │   (anti-detection +      │
    │    lazy load trigger)    │
    └────────────┬────────────┘
                 │
                 ▼
    ┌─────────────────────────┐
    │   Defuddle extraction    │
    │   (auto-detect content)  │
    │   (remove ads/nav/comments) │
    │   (direct Markdown output) │
    └────────────┬────────────┘
                 │
                 ▼
    ┌─────────────────────────┐
    │   Output                 │
    │   (Markdown / JSON)      │
    └─────────────────────────┘
```

### Content Extraction

Uses [Defuddle](https://github.com/kepano/defuddle) for intelligent content extraction:

- Auto-detects article content area, no manual selector configuration needed
- Removes ads, navigation bars, sidebars, and comment sections
- Directly outputs Markdown, no additional conversion step needed
- Supports mainstream blogs, news, and documentation sites

### Anti-Scraping Handling

Injects anti-detection scripts when launching the browser to mimic real browser environment:

- Removes `navigator.webdriver` flag
- Disguises `window.chrome` object and browser plugins
- Simulates real screen dimensions and WebGL renderer
- Hides Playwright traces

### Lazy-loaded Images

Automatically scrolls to trigger lazy-loaded images after page load, and fixes `data-src` attributes to ensure images display correctly.

## Special Notes

Most sites are supported directly. The following sites require special parameters:

| Site | Notes |
|------|-------|
| Zhihu | Requires `--no-headless --browser msedge` to bypass anti-scraping |
| Login-required sites | Use `--profile` to reuse Chrome login sessions |

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
│   ├── browser.mjs        # Playwright browser management, anti-detection, lazy loading
│   └── converter.mjs      # Defuddle content extraction + Markdown formatting
└── package.json
```

## Related Projects

- [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper) - Browser extension version, inspiration for this project
- [Defuddle](https://github.com/kepano/defuddle) - Smart web content extraction engine
- [Playwright](https://github.com/microsoft/playwright) - Browser automation framework

## License

[MIT](./LICENSE)
