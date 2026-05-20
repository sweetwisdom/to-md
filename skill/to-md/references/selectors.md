# SimpRead Selector Syntax Reference

Complete reference for the `[[...]]` wrapped selector format used in `website_list.json`.

## Selector Types

### 1. CSS Selectors (Angle Bracket)

Standard CSS selectors wrapped in angle brackets:

```
<div class='content'>      → div.content
<article id='main'>        → article#main
<title>                    → title
<h1>                       → h1
```

Parsing logic: extracts tag, optional class/id attribute.

### 2. jQuery Expressions

Execute jQuery code and return text content:

```
[[{ $('article').text() }]]
[[{ $('.post-content').eq(0).text() }]]
[[{ $('#main .article').text() || $('article').text() }]]
```

- Returns text only (not HTML)
- Supports `||` fallback within expression
- jQuery auto-injected when these selectors are present

### 3. jQuery Objects

Execute jQuery code and return HTML:

```
[[[$('.content')]]]
[[[$('#article-body').find('.entry')]]]
```

- Returns HTML string
- Used for content extraction where markup matters

### 4. Text Removal

Remove elements containing specific text:

```
[['广告']]
[['赞助']]
[['相关推荐']]
```

- Searches all elements for matching text
- Removes matching elements from DOM

### 5. Regex Removal

Remove content matching regex patterns:

```
[[/\d{4}-\d{2}-\d{2}/]]
[[/<script[^>]*>[\s\S]*?<\/script>/g]]
```

- Applied to `document.body.innerHTML`
- Use `g` flag for multiple matches

### 6. XPath Selectors

Use XPath for complex selections:

```
[[`//article`]]
[[`//div[@class='content']//p`]]
[[`//main//*[contains(@class, 'article')]`]]
```

- Uses `document.evaluate` with `FIRST_ORDERED_NODE_TYPE`
- Returns textContent of matched node

### 7. Pipe Fallback

Chain selectors with `||` for fallback:

```
<article> || <main>
<div class='post'> || <div class='article'> || <div class='content'>
[[{ $('article').text() }]] || <article>
```

- Tries first selector, falls back to next if empty
- Can mix selector types (CSS, jQuery, etc.)
- Depth-aware: `||` inside `[[{...}]]` is not split

## Building Extraction Scripts

The extractor builds JS code strings from selectors:

```javascript
// CSS selector → querySelector
`(function() {
  var el = document.querySelector("div.content");
  return el ? el.textContent.trim() : '';
})()`

// jQuery expr → inject jQuery, evaluate
`(function() {
  var result = $('article').text();
  return result != null ? String(result) : '';
})()`

// XPath → document.evaluate
`(function() {
  var result = document.evaluate("//article", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  return result.singleNodeValue ? result.singleNodeValue.textContent : '';
})()`
```

## Execution Context

All selectors execute inside Playwright's `page.evaluate()`:

- Runs in browser context (not Node.js)
- Has access to `document`, `window`, DOM APIs
- jQuery injected via CDN if needed
- Readability.js injected as fallback

## Common Patterns

### Standard blog

```json
{
  "title": "<h1>",
  "include": "<article>",
  "exclude": ["<div class='comments'>"]
}
```

### jQuery-heavy site

```json
{
  "title": "<h1 class='title'>",
  "include": "[[{ $('.article-content').html() }]]",
  "exclude": ["[['广告']]", "[['相关推荐']]"]
}
```

### Multi-structure fallback

```json
{
  "title": "<h1> || <h2 class='title'>",
  "include": "<article> || <main> || <div class='content'>",
  "exclude": []
}
```
