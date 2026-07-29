
## 2026-07-29 Codex

- 读取 `scripting-app-development` 技能、项目结构、RSS 阅读小组件与相似 Widget 实现。
- 参考截图将 `scripts/RSS阅读/widget.tsx` 从浅色信息面板调整为深色通知列表布局。
- 新增 RSS 内容首图提取与图片占位；保留原数据加载和缓存逻辑。
- 执行 `npm run build` 通过；执行 `npx tsc --noEmit` 因仓库缺少 Scripting 类型定义失败，已记录。
## 2026-07-29 Codex 图片撑开修复

- 根据用户提供的 systemMedium/systemLarge 预览截图，确认 RSS 网络缩略图 `imageUrl` 未被 frame 约束并撑开 Widget。
- 移除真实缩略图渲染路径，保留固定尺寸 `photo` 系统图标占位。
- 执行 `npm run build` 通过。
## 2026-07-29 Codex Header 被主体顶出修复

- 根据用户提供的预览截图，确认主体列表高度超过 Widget，导致顶部 Header 被裁剪。
- 将 ArticleRow 默认图片列关闭，medium 限制 2 条，large 限制 7 条，并压缩字体/行距。
- 执行 `npm run build` 通过。