# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

to-md 是一个 CLI 工具，使用 SimpRead（简悦）的网站适配规则抓取网页内容并转换为 Markdown。通过 Playwright 驱动浏览器加载页面，提取正文后用 Turndown 转为 Markdown 输出。

## 开发命令

```bash
# 安装依赖
npm install

# 运行 CLI（需要传入 URL）
node bin/cli.mjs <url>

# 带选项运行
node bin/cli.mjs <url> -o output.md              # 输出到文件
node bin/cli.mjs <url> --no-rule                   # 跳过规则匹配，直接用 Readability
node bin/cli.mjs <url> -i ".article-content"       # 自定义内容选择器
node bin/cli.mjs <url> --profile "C:\Users\user\AppData\Local\Google\Chrome\User Data"  # 使用已有 Chrome 配置（保留登录态）
node bin/cli.mjs <url> --wait 3000                 # 等待动态内容加载
```

注意：`--profile` 模式下使用 `launchPersistentContext`（非 headless），可访问需要登录的页面。

## 架构

### 技术栈

- ES Modules（`"type": "module"`）
- Playwright（浏览器自动化，使用系统已安装的 Chrome）
- Turndown + turndown-plugin-gfm（HTML → Markdown）
- @mozilla/readability（回退提取方案）
- Commander（CLI 框架）

### 核心流程（三级提取策略）

```
URL → Playwright 加载页面
  ├─ Tier 1: 规则匹配（website_list.json）→ extractor.mjs 提取
  ├─ Tier 2: Readability.js 注入浏览器提取（readability.mjs）
  └─ Tier 3: 通用 CSS 选择器（article, main, .content 等）
→ converter.mjs（Turndown）转 Markdown → 输出
```

每一级在内容过短（<100 字符）时自动降级到下一级。

### 模块职责

| 文件 | 职责 |
|------|------|
| `bin/cli.mjs` | CLI 入口，编排整个提取流程，处理浏览器启动和反检测 |
| `lib/rules.mjs` | 加载 `data/website_list.json`，URL 模式匹配（支持 glob 和正则） |
| `lib/selector.mjs` | 解析 SimpRead 的选择器语法（CSS、jQuery 表达式、XPath、正则、文本移除、管道回退） |
| `lib/extractor.mjs` | 在 Playwright page.evaluate 中执行选择器提取，按需注入 jQuery |
| `lib/readability.mjs` | 将 Readability.js 注入浏览器上下文作为回退方案，以及通用选择器兜底 |
| `lib/converter.mjs` | Turndown 配置（GFM 支持、懒加载图片、清理 sr- 自定义标签） |
| `data/website_list.json` | SimpRead 的网站适配规则库（~130KB，约数百条规则） |

### SimpRead 选择器语法（selector.mjs）

SimpRead 使用 `[[...]]` 包裹的特殊选择器格式：

| 语法 | 含义 | 示例 |
|------|------|------|
| `<tag class='x'>` | 角括号 CSS 选择器 | `<div class='article'>` |
| `[[{ code }]]` | jQuery 表达式（返回文本） | `[[{ $('article').text() }]]` |
| `[[[ code ]]]` | jQuery 对象（返回 HTML） | `[[[$('.content')]]]` |
| `[['text']]` | 文本移除指令 | `[['广告']]` |
| `[[/regexp/]]` | 正则移除 | `[[/\\d{4}-\\d{2}/]]` |
| `` [[`xpath`]] `` | XPath 选择器 | `` [[`//article`]] `` |
| `a \|\| b` | 管道回退（先尝试 a，失败用 b） | `<article> \|\| <main>` |

### 站点特定延迟

部分站点需要额外等待动态内容加载（`SITE_DELAYS` 配置），如掘金 2500ms、少数派 1000ms。

## 关键实现细节

- 浏览器启动时注入反检测脚本（移除 `navigator.webdriver` 标志）
- jQuery 仅在规则需要时按需注入（CDN 加载 jquery@3.7.1 slim）
- Readability.js 源码从 node_modules 读取后注入浏览器上下文执行（非 Node 端运行）
- URL 匹配时会标准化（去除 www.、统一协议为 http://）
