# Playwright 自动化检测与规避指南

> 适用环境：Node.js + Playwright（Chromium/Chrome）

---

## 一、检测方法总览

| 检测类别 | 检测手段 | 检测原理 |
|----------|----------|----------|
| WebDriver 标志 | `navigator.webdriver === true` | 自动化浏览器默认开启此标志 |
| 无头标志 | UA 中含 `HeadlessChrome` | Headless 模式 UA 与正常浏览器不同 |
| Chrome 对象 | `window.chrome` 缺失 | 真实 Chrome 有此对象，自动化环境没有 |
| 插件数量 | `navigator.plugins.length === 0` | 真实浏览器通常有多个插件 |
| 语言设置 | `navigator.languages` 为空 | 自动化环境常缺少语言配置 |
| 屏幕尺寸 | `screen.width/height === 0` | 无头模式下窗口尺寸可能为 0 |
| WebGL 渲染器 | Renderer 为 `SwiftShader` 等 | 无头模式使用软件渲染，与真实显卡不同 |
| Permissions API | `notifications` 权限返回值异常 | 自动化环境权限行为与真实浏览器不一致 |
| 焦点检测 | `document.hasFocus() === false` | 无头浏览器窗口通常无焦点 |
| 媒体设备 | `enumerateDevices()` 返回空 | 无头环境无摄像头/麦克风设备 |
| Canvas 指纹 | Canvas 渲染结果与真实浏览器有差异 | 字体渲染、抗锯齿等细节不同 |
| 事件可信度 | `event.isTrusted === false` | 脚本触发的事件与用户操作不同 |
| 鼠标轨迹 | 移动路径过于线性/完美 | 真实用户鼠标轨迹有抖动和加速度变化 |
| 硬件并发数 | `navigator.hardwareConcurrency` 异常 | 虚拟环境 CPU 核心数可能不合理 |

---

## 二、各类检测详细说明与规避方案

### 2.1 WebDriver 标志

**检测代码：**
```javascript
navigator.webdriver === true
```

**规避方案：**
```javascript
// 启动参数
args: ['--disable-blink-features=AutomationControlled']

// addInitScript 注入
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', {
    get: () => undefined,
  });
});
```

---

### 2.2 无头模式 / User-Agent

**检测代码：**
```javascript
/HeadlessChrome/.test(navigator.userAgent)
```

**规避方案：**
```javascript
// 方式一：使用真实 Chrome
const browser = await chromium.launch({ channel: 'chrome' });

// 方式二：覆盖 UA
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
});

// 方式三：注入覆盖
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'userAgent', {
    get: () => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
  });
});
```

---

### 2.3 window.chrome 对象缺失

**检测代码：**
```javascript
typeof window.chrome === 'undefined'
typeof window.chrome.runtime === 'undefined'
```

**规避方案：**
```javascript
await context.addInitScript(() => {
  window.chrome = {
    runtime: {},
    loadTimes: function() {},
    csi: function() {},
    app: {},
  };
});
```

---

### 2.4 Plugins / Languages

**检测代码：**
```javascript
navigator.plugins.length === 0
navigator.languages.length === 0
```

**规避方案：**
```javascript
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'plugins', {
    get: () => [1, 2, 3, 4, 5],
  });
  Object.defineProperty(navigator, 'languages', {
    get: () => ['zh-CN', 'zh', 'en-US', 'en'],
  });
});
```

---

### 2.5 屏幕尺寸异常

**检测代码：**
```javascript
screen.width === 0 || screen.height === 0
window.outerWidth === 0
```

**规避方案：**
```javascript
// 设置 viewport
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
});

// 注入修复
await context.addInitScript(() => {
  Object.defineProperty(screen, 'width', { get: () => 1920 });
  Object.defineProperty(screen, 'height', { get: () => 1080 });
  Object.defineProperty(window, 'outerWidth', { get: () => 1920 });
  Object.defineProperty(window, 'outerHeight', { get: () => 1080 });
});
```

---

### 2.6 WebGL 渲染器暴露

**检测代码：**
```javascript
const gl = canvas.getContext('webgl');
gl.getParameter(gl.RENDERER); // "Google SwiftShader" 表示软件渲染
```

**规避方案：**
```javascript
await context.addInitScript(() => {
  const getParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(parameter) {
    if (parameter === 37445) return 'Intel Inc.';                  // VENDOR
    if (parameter === 37446) return 'Intel Iris OpenGL Engine';   // RENDERER
    return getParameter.call(this, parameter);
  };
});
```

---

### 2.7 Permissions API 异常

**检测代码：**
```javascript
navigator.permissions.query({ name: 'notifications' }) // 返回值异常
```

**规避方案：**
```javascript
await context.addInitScript(() => {
  const originalQuery = window.navigator.permissions.query;
  window.navigator.permissions.query = (parameters) =>
    parameters.name === 'notifications'
      ? Promise.resolve({ state: Notification.permission })
      : originalQuery(parameters);
});
```

---

### 2.8 焦点 / 媒体设备

**规避方案：**
```javascript
await context.addInitScript(() => {
  // 焦点
  document.hasFocus = () => true;

  // 媒体设备
  Object.defineProperty(navigator, 'mediaDevices', {
    get: () => ({
      enumerateDevices: () => Promise.resolve([
        { kind: 'audioinput', label: 'Microphone', deviceId: 'default' },
        { kind: 'videoinput', label: 'Camera', deviceId: 'default' },
      ])
    })
  });
});
```

---

## 三、规避方案对比

| 方案 | 规避效果 | 难度 | 资源消耗 | 备注 |
|------|----------|------|----------|------|
| `headless: false` 有头模式 | ★★★★★ | 低 | 高 | 最彻底，但消耗资源 |
| `channel: 'chrome'` 真实浏览器 | ★★★★☆ | 低 | 中 | 需本机安装 Chrome |
| `--disable-blink-features=AutomationControlled` | ★★★★☆ | 低 | 低 | 必加参数 |
| `addInitScript` 手动注入 | ★★★☆☆ | 中 | 低 | 需持续维护更新 |
| `playwright-extra` + stealth 插件 | ★★★★☆ | 低 | 低 | 推荐，覆盖面广 |
| 模拟真实鼠标轨迹 | ★★★★☆ | 高 | 低 | 针对行为检测 |

---

## 四、推荐完整配置

```javascript
const { chromium } = require('playwright-extra');
const StealthPlugin = require('playwright-extra-plugin-stealth');

chromium.use(StealthPlugin());

const browser = await chromium.launch({
  channel: 'chrome',   // 使用真实 Chrome
  headless: true,
  args: [
    '--disable-blink-features=AutomationControlled',
    '--window-size=1920,1080',
    '--no-sandbox',
    '--disable-infobars',
  ]
});

const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  viewport: { width: 1920, height: 1080 },
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
});

// 全局注入补丁
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
  Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
  document.hasFocus = () => true;
  window.chrome = { runtime: {}, loadTimes: () => {} };
});

const page = await context.newPage();
await page.goto('https://example.com');
```

---

## 五、安装依赖

```bash
npm install playwright-extra playwright-extra-plugin-stealth
```

---

> **说明：** `addInitScript` 比 `page.evaluate` 更早执行（页面脚本之前），是注入规避代码的最佳时机。stealth 插件已覆盖大多数已知检测点，推荐作为基础方案使用。