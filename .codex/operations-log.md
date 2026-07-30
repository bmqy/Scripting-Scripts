
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
## 2026-07-30 Codex RSS 阅读两条文章优化

- 执行 `git pull --ff-only origin dev`，结果：Already up to date。
- 读取 `scripting-app-development` 技能说明、官方 `https://scriptingapp.github.io/zh/llms.txt` 索引和 `scripts/RSS阅读/widget.tsx`。
- 修改 `Header`：移除固定标题名称 `RSS 阅读`，保留图标和更新时间，并为更新时间增加可用横向空间与 `minScaleFactor(0.7)`。
- 新增 `DISPLAY_ARTICLE_COUNT = 2`，统一 `systemSmall`、`systemMedium`、`systemLarge/systemExtraLarge` 显示前两条文章。
- 压缩小尺寸文章标题为单行，保证 `systemSmall` 有空间显示两条。
- 执行 `npm run build` 通过；构建重新生成 `dist/RSS阅读.scripting`。
## 2026-07-30 Codex RSS 阅读配置页按钮空图标位修复

- 根据用户截图确认蓝色主按钮左侧存在空白图标槽位。
- 读取 `scripts/RSS阅读/index.tsx`，确认 `登录并保存账号` 与 `保存组件配置` 两个 `borderedProminent` 按钮均传入 `systemImage`。
- 移除这两个主按钮的 `systemImage` 参数，避免 Scripting/iOS 未渲染图标时仍保留左侧空位。
- 保留 `预览小组件` 的 `rectangle.grid.1x2` 图标，因为截图中该列表行图标正常显示。
- 执行 `npm run build` 通过，重新生成本地 `dist/RSS阅读.scripting`。