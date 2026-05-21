# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

to-md 是一个 CLI 工具，通过 Playwright 驱动浏览器加载网页，再用 Defuddle 提取正文并转换为 Markdown。

## 开发命令

```bash
# 安装依赖
npm install

# 运行 CLI
node bin/cli.mjs <url>

# 带选项运行
node bin/cli.mjs <url> -o output.md                          # 输出到文件
node bin/cli.mjs <url> --no-frontmatter                       # 跳过 YAML frontmatter
node bin/cli.mjs <url> --json                                  # 输出 JSON（含元数据）
node bin/cli.mjs <url> --profile "C:\Users\user\AppData\Local\Google\Chrome\User Data"  # 使用 Chrome 配置（保留登录态）
node bin/cli.mjs <url> --wait 3000                             # 等待动态内容加载
node bin/cli.mjs <url> --no-headless                           # 显示浏览器窗口
node bin/cli.mjs <url> --browser msedge                        # 使用 Edge 浏览器
```

注意：`--profile` 模式下使用 `launchPersistentContext`（非 headless），可访问需要登录的页面。

## 架构

### 技术栈

- ES Modules（`"type": "module"`）
- Playwright（浏览器自动化，使用系统已安装的 Chrome/Edge）
- Defuddle（内容提取 + Markdown 转换，基于 linkedom 解析 DOM）
- Commander（CLI 框架）

### 核心流程

```
URL → Playwright 加载页面 → 获取完整 HTML
  → Defuddle 解析 DOM、提取正文、转 Markdown
  → 输出（Markdown / JSON）
```

Defuddle 内部使用 linkedom 解析 HTML，自动去除导航、广告、侧边栏等非正文内容，并直接输出 Markdown（无需额外的 Turndown 转换）。

### 模块职责

| 文件 | 职责 |
|------|------|
| [bin/cli.mjs](bin/cli.mjs) | CLI 入口，编排提取流程，处理参数和输出 |
| [lib/browser.mjs](lib/browser.mjs) | Playwright 浏览器管理：启动、反检测、滚动触发懒加载图片、获取渲染后的 HTML |
| [lib/converter.mjs](lib/converter.mjs) | 调用 Defuddle 进行内容提取和 Markdown 转换，以及 frontmatter 格式化 |

## 关键实现细节

- 浏览器启动时注入反检测脚本（移除 `navigator.webdriver` 标志，伪装 UA）
- 页面加载后自动滚动触发懒加载图片，并修复 `data-src` 等属性
- Defuddle 以 `markdown: true` 模式调用，直接返回 Markdown 文本
- 输出可选 YAML frontmatter（title / author / date / source / url）
- URL 自动补全 `https://` 前缀

## 已知站点行为

| 站点 | 问题 | 解决方案 |
|------|------|----------|
| 知乎 (zhihu.com) | headless 模式或 Chrome 浏览器大概率返回 403 | 使用 `--no-headless --browser msedge` |
