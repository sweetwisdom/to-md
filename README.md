# to-md

> 告别复制粘贴，一行命令把网页变成干净的 Markdown。

[English](./README_EN.md) | 中文

---

## 痛点

你是否遇到过这些问题？

- 看到一篇好文章，想保存到笔记软件，**复制粘贴后格式全乱** — 图片丢失、代码块变形、多余样式干扰
- 网页上有大量广告、侧边栏、评论区等噪音，**手动清理费时费力**
- 想抓取**需要登录**才能看到的内容（付费专栏），普通爬虫拿不到
- 网站有**反爬机制**，脚本刚跑就被拦
- SPA 页面内容是 JS 动态渲染的，**抓下来是空白**

`to-md` 就是为了解决这些问题而生的。

## 为什么选择 to-md

| 特性 | 说明 |
|------|------|
| 反检测机制 | 注入反自动化脚本，移除 `navigator.webdriver` 标志，模拟真实浏览器行为 |
| 复用登录态 | `--profile` 参数指定已有 Chrome 配置目录，直接复用 cookies 和登录状态 |
| 纯 Markdown 输出 | 基于 Turndown + GFM 插件，输出标准 Markdown，代码块、表格、图片链接完整保留 |
| 精准提取 | 内置数百条 SimpRead 站点规则，自动过滤广告、导航、评论等无关内容 |
| 三级降级 | 规则匹配 → Readability → 通用选择器，确保任意网页都能提取到正文 |
| 懒加载图片 | 自动识别 `data-src`、`data-original` 等属性，图片链接不会丢失 |

## 安装与使用

### 方式一：npx 直接运行（推荐尝鲜）

无需安装，直接执行：

```bash
npx to-md https://juejin.cn/post/7605416964510810139
npx to-md https://juejin.cn/post/7605416964510810139 -o article.md
```

### 方式二：全局安装（推荐常用）

```bash
npm install -g to-md

# 安装后即可直接使用
to-md https://juejin.cn/post/7605416964510810139
to-md https://juejin.cn/post/7605416964510810139 -o article.md
```

**前置要求：** Node.js >= 18，系统已安装 Chrome 浏览器。

## 命令行选项

```
to-md <url> [options]
```

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-o, --output <file>` | 输出到文件 | 终端输出 |
| `-i, --include <selector>` | 自定义内容选择器 | 自动匹配 |
| `-t, --title <selector>` | 自定义标题选择器 | 自动匹配 |
| `--no-rule` | 跳过规则匹配，直接用 Readability | - |
| `--wait <ms>` | 额外等待时间（用于动态加载） | `0` |
| `--timeout <ms>` | 页面加载超时 | `30000` |
| `--profile <dir>` | Chrome 配置目录（保留登录态） | 无 |

## 使用场景

### 抓取技术文章

```bash
# 掘金
to-md https://juejin.cn/post/7605416964510810139 -o article.md

# 知乎专栏
to-md https://zhuanlan.zhihu.com/p/123456 -o article.md

# CSDN
to-md https://blog.csdn.net/user/article/details/123456 -o article.md
```

### 抓取需要登录的页面

使用 `--profile` 指定 Chrome 用户数据目录，复用已有的登录状态：

```bash
# Windows
to-md https://example.com/member-only -o article.md --profile "C:\Users\你的用户名\AppData\Local\Google\Chrome\User Data"

# macOS
to-md https://example.com/member-only -o article.md --profile "~/Library/Application Support/Google/Chrome"

# Linux
to-md https://example.com/member-only -o article.md --profile "~/.config/google-chrome"
```

> 注意：`--profile` 模式会启动可见的 Chrome 窗口（非 headless），请勿在运行期间关闭浏览器。

### 处理动态加载的页面

部分站点内容通过 JavaScript 动态渲染，需要额外等待：

```bash
# 手动指定等待时间
to-md https://example.com/spa-page -o article.md --wait 3000

# 遇到内容过短时，也可以加大超时
to-md https://example.com/slow-page -o article.md --timeout 60000
```

### 自定义选择器

当内置规则无法匹配时，可以用 `-i` 指定内容区域：

```bash
# CSS 选择器
to-md https://example.com/article -i ".post-content"

# 组合选择器
to-md https://example.com/article -i "article .entry-content"

# 同时指定标题和内容
to-md https://example.com/article -t "h1.title" -i ".article-body"
```

## 工作原理

to-md 采用**三级提取策略**，逐级降级，确保任意网页都能提取到内容：

```
                         ┌─────────────────────────┐
                         │   Playwright 加载页面     │
                         └────────────┬────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
            │   Tier 1     │  │   Tier 2     │  │   Tier 3     │
            │  规则匹配     │  │ Readability  │  │ 通用选择器    │
            │              │  │              │  │              │
            │ website_list │  │ 注入浏览器    │  │ article      │
            │ .json 中的   │  │ 执行 Mozilla │  │ main         │
            │ SimpRead 规则│  │ Readability  │  │ .content     │
            └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                   │                 │                 │
                   │    内容 < 100 字符？               │
                   ├────────────────►│                 │
                   │                 │   内容 < 100 字符？
                   │                 ├────────────────►│
                   ▼                 ▼                 ▼
            ┌─────────────────────────────────────────────┐
            │              Turndown 转 Markdown            │
            │         (GFM 支持、懒加载图片处理)            │
            └─────────────────────────────────────────────┘
                                      │
                                      ▼
                               ┌────────────┐
                               │   输出结果   │
                               └────────────┘
```

### Tier 1：规则匹配

从 `data/website_list.json` 加载 SimpRead 的数百条站点规则，通过 URL 模式匹配找到对应规则，使用规则中定义的选择器精准提取标题和正文。

支持的选择器类型：

| 语法 | 说明 | 示例 |
|------|------|------|
| `<tag class='x'>` | CSS 选择器 | `<div class='article'>` |
| `[[{ code }]]` | jQuery 表达式 | `[[{ $('article').text() }]]` |
| `[[[ code ]]]` | jQuery 对象（返回 HTML） | `[[[$('.content')]]]` |
| `[['text']]` | 文本移除 | `[['广告']]` |
| `[[/regexp/]]` | 正则移除 | `[[/\d{4}-\d{2}/]]` |
| `` [[`xpath`]] `` | XPath | `` [[`//article`]] `` |
| `a \|\| b` | 管道回退 | `<article> \|\| <main>` |

### Tier 2：Readability 降级

当规则匹配失败或提取内容过短时，将 [Mozilla Readability](https://github.com/mozilla/readability) 注入浏览器上下文执行，在 DOM 环境中进行通用的文章提取。

### Tier 3：通用选择器兜底

最后尝试一组常见的 CSS 选择器（`article`、`main`、`.content`、`.post-body` 等），提取页面中最可能包含正文的区域。

### Markdown 转换

使用 [Turndown](https://github.com/mixmark-io/turndown) 进行 HTML → Markdown 转换，启用 GFM 插件支持表格、删除线、任务列表等语法。额外处理：

- 懒加载图片：自动识别 `data-src`、`data-original` 等属性
- SimpRead 自定义标签：清理 `<sr-*>` 标签，保留内容
- 空链接过滤：移除无文本内容的链接

## 站点适配

内置规则覆盖主流中文技术社区和博客平台：

| 站点 | 提取方式 | 备注 |
|------|---------|------|
| 掘金 | 规则匹配 | - |
| 知乎 | 规则匹配 | - |
| 少数派 | 规则匹配 | - |
| CSDN | 规则匹配 | - |
| 简书 | 规则匹配 | - |
| 通用博客 | Readability | 自动识别文章区域 |

> 完整规则列表见 `data/website_list.json`，来源于 [SimpRead](https://github.com/Kenshin/simpread)。

## 本地开发

```bash
# 克隆仓库
git clone https://github.com/sweetwisdom/to-md.git
cd to-md

# 安装依赖
npm install

# 运行测试
node bin/cli.mjs https://example.com

# 输出到文件查看效果
node bin/cli.mjs https://juejin.cn/post/7605416964510810139 -o test_output.md
```

### 项目结构

```
to-md/
├── bin/
│   └── cli.mjs            # CLI 入口，编排提取流程
├── lib/
│   ├── rules.mjs           # 规则加载与 URL 匹配
│   ├── selector.mjs        # SimpRead 选择器语法解析
│   ├── extractor.mjs       # Playwright 页面内容提取
│   ├── readability.mjs     # Readability 注入与通用选择器
│   └── converter.mjs       # Turndown HTML → Markdown 转换
├── data/
│   └── website_list.json   # SimpRead 站点规则库
└── package.json
```

## 相关项目

- [SimpRead](https://github.com/Kenshin/simpread) - 简悦，浏览器扩展，提供沉浸式阅读体验
- [Readability](https://github.com/mozilla/readability) - Mozilla 的通用文章提取算法
- [Turndown](https://github.com/mixmark-io/turndown) - HTML to Markdown 转换器

## License

[MIT](./LICENSE)
