# 验证记录

- 日期：2026-07-29
- 执行者：Codex
- 可执行验证：`npm run build` 成功完成 RSS阅读 打包。
- 产物：`dist/RSS阅读.scripting` 已更新。
- 未完成验证：未在真实 iOS/Scripting App 主屏幕 Widget 中做视觉截图验证；本地 Node 构建无法渲染 Scripting 原生 UI。
## 2026-07-29 图片撑开修复

- 修复点：移除 RSS 网络缩略图的 `imageUrl` 直接渲染，改为固定尺寸系统图片占位，避免真实图片按原始尺寸撑开 Widget。
- 可执行验证：`npm run build` 通过。
- 仍需验证：在 Scripting App 的 systemMedium/systemLarge 预览中确认列表内容恢复显示。
## 2026-07-29 Header 被主体顶出修复

- 修复点：默认隐藏文章图片列；systemMedium 从 3 条降为 2 条，systemLarge 从 8 条降为 7 条，并压缩行距与字号，避免主体列表高度超过 Widget 可视区域。
- 可执行验证：`npm run build` 通过。
- 仍需验证：在 Scripting App 预览里确认顶部 RSS 阅读标题栏完整显示。