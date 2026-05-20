# Adding Site Rules Guide

Step-by-step guide for adding new website extraction rules to `data/website_list.json`.

## Workflow

### Step 1: Analyze the target page

Open the target URL in Chrome DevTools (F12) and identify:

1. **Title element** - Usually `<h1>`, may have specific class
2. **Content container** - The main article/body area
3. **Noise elements** - Ads, sidebars, comments, related posts to exclude

Common content selectors:
```css
article
.post-content
.article-body
.entry-content
[itemprop="articleBody"]
.markdown-body (GitHub)
#article_content (WeChat)
```

### Step 2: Determine URL pattern

The URL pattern needs to match all pages of the same type on the site:

| URL | Pattern |
|-----|---------|
| `https://example.com/post/12345` | `http*://*.example.com/post/*` |
| `https://blog.example.com/2024/title` | `http*://blog.example.com/*` |
| `https://example.com/article?id=123` | `http*://*.example.com/article*` |

Pattern rules:
- `http*://` - matches both http and https
- `*.domain.com` - matches subdomains
- `*` - matches any non-slash characters
- `**` - matches anything including slashes

### Step 3: Write the rule

```json
{
  "name": "Site Display Name",
  "url": "http*://*.example.com/post/*",
  "title": "<h1 class='post-title'>",
  "desc": "",
  "include": "<div class='post-content'>",
  "exclude": [
    "<div class='ad-container'>",
    "<div class='related-posts'>",
    "[['赞助']]"
  ]
}
```

### Step 4: Test the rule

```bash
# Test with the new rule
node bin/cli.mjs https://example.com/some-post -o test.md

# Check the output
cat test.md
```

Verify:
- Title is correct
- Content is complete (no missing paragraphs)
- Noise is removed (no ads, sidebars)
- Images have valid URLs
- Code blocks are preserved

### Step 5: Handle edge cases

**Dynamic content (SPA/React/Vue):**
```bash
# Add wait time
node bin/cli.mjs <url> --wait 3000 -o test.md
```

**Multiple content structures:**
Use pipe fallback:
```json
{
  "include": "<article> || <div class='content'> || <main>"
}
```

**jQuery-required sites:**
```json
{
  "include": "[[{ $('div.article').html() }]]"
}
```

## Rule Examples

### Standard blog (WordPress, Ghost)

```json
{
  "name": "WordPress Blog",
  "url": "http*://*.example.com/*",
  "title": "<h1 class='entry-title'>",
  "desc": "",
  "include": "<div class='entry-content'>",
  "exclude": [
    "<div class='sharedaddy'>",
    "<div class='jp-relatedposts'>"
  ]
}
```

### SPA with jQuery extraction

```json
{
  "name": "SPA Site",
  "url": "http*://*.example.com/article/*",
  "title": "[[{ $('h1.title').text() }]]",
  "desc": "",
  "include": "[[{ $('div.article-body').html() }]]",
  "exclude": [
    "[['广告']]",
    "[['下载APP']]"
  ]
}
```

### XPath for complex DOM

```json
{
  "name": "Complex Site",
  "url": "http*://*.example.com/*",
  "title": "<h1>",
  "desc": "",
  "include": "[[`//div[@id='content']//article`]]",
  "exclude": []
}
```

## Testing Checklist

- [ ] Title extracted correctly
- [ ] Full article content captured
- [ ] No duplicate content
- [ ] Ads/noise removed
- [ ] Images have valid src (check lazy-load)
- [ ] Code blocks preserved with syntax
- [ ] Tables rendered correctly
- [ ] Links are functional
- [ ] Works with both http and https URLs
- [ ] Handles pagination if applicable

## Debugging Tips

**Content too short:**
```bash
# Try without rules first
node bin/cli.mjs <url> --no-rule -o debug.md

# If Readability works, the rule needs fixing
# If Readability also fails, try custom selector
node bin/cli.mjs <url> -i ".specific-class" -o debug.md
```

**Wrong content extracted:**
```bash
# Use more specific selector
node bin/cli.mjs <url> -i "article .post-body" -o debug.md

# Or add exclude selectors to remove noise
```

**Dynamic content missing:**
```bash
# Increase wait time
node bin/cli.mjs <url> --wait 5000 -o debug.md

# Or increase timeout
node bin/cli.mjs <url> --timeout 60000 -o debug.md
```
