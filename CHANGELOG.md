# Changelog

## [1.0.5] - 2026-05-21

### Fixed
- **URL 规则匹配**：`patternToRegex` 中 `*` 从 `[^/]*` 改为 `.*`，修复多层路径无法匹配的问题（如微信 `/s/xxx`），影响所有含多层路径的站点规则
- **选择器解析**：`waitForContent` 现在会将角括号选择器（如 `<div id='js_content'>`）解析为标准 CSS 选择器后再查询，消除误报的 "selector not found" 警告

### Changed
- **页面加载策略**：`waitUntil` 从 `domcontentloaded` 改为 `networkidle`，等待 AJAX/动态内容加载完成后再提取
- **图片懒加载处理**：提取前自动滚动页面触发 IntersectionObserver 懒加载，并将 `data-src`/`data-original`/`data-actualsrc` 转换为 `src`，无需手动 `--wait`

## [1.0.4] - 2026-05-21

### Fixed
- 修复下载失败问题
