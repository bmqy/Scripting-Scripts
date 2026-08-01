
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
- 执行 `npm run build` 通过，重新生成本地 `dist/RSS阅读.scripting`。## 2026-07-31 Codex RSS 阅读设置页布局优化

- 执行 `git pull --ff-only origin dev`，结果：Fast-forward，同步远端 `dist/*.scripting` 更新。
- 读取 `scripting-app-development` 技能、`references/project-development.md`、官方 `https://scriptingapp.github.io/zh/llms.txt` 与 Toolbar 文档。
- `tool_search` 未暴露 code-index 或 shrimp-task-manager 的可调用工具，改用 `rg --files`、`git diff` 和本地文件读取收集上下文。
- 修改 `scripts/RSS阅读/index.tsx`：新增 `Toolbar`/`ToolbarItem`，将预览按钮放入 `topBarTrailing`，按钮文案简化为“预览”并保留系统图标。
- 将 iOS 刷新调度提示移动到“刷新频率”Picker 后方，删除组件配置 Section 内原“预览小组件”行。
- 执行 `npm run build` 通过；按仓库约定还原本地生成的 `dist/RSS阅读.scripting`，只保留源码和审计记录变更。

## 2026-07-31 Codex RSS 阅读设置页二次布局优化

- 执行 `git pull --ff-only origin dev`，Fast-forward 同步远端构建产物。
- 在 `scripts/RSS阅读/index.tsx` 中显式设置 `navigationBarTitleDisplayMode="large"`，保持 RSS 阅读大标题与右侧预览入口的标题栏布局关系。
- 将 iOS 刷新调度提示改为 `footnote` 字号和 `secondaryLabel` 系统次要文本色。
- 执行 `npm run build` 通过，并还原本地生成的 `dist/RSS阅读.scripting`。
## 2026-07-31 Codex RSS 阅读标题与预览图标同行对齐

- 根据用户截图确认：`topBarTrailing` 位于大标题上方，无法与 RSS 阅读文字同一水平线。
- 将页面标题和预览按钮改为 Form 首行的自定义 `HStack`，使用 `largeTitle`、`Spacer`、`listRowInsets` 和隐藏分隔线保持原生表单布局。
- 移除系统 `navigationTitle`、`navigationBarTitleDisplayMode` 和 Toolbar 标题栏按钮，避免重复标题或图标错位。
- 执行 `npm run build` 通过，并还原本地生成的 `dist/RSS阅读.scripting`。
## 2026-07-31 Codex RSS 设置页背景与预览入口简化

- 根据用户反馈，将 `Form` 的默认滚动内容背景隐藏并设置为透明，避免设置页出现额外背景色。
- 将预览按钮从带标题和 `systemImage` 的形式改为自定义 `Image` 子节点，仅保留 `rectangle.grid.1x2` 图标。
- 预览动作和账号配置条件保持不变。
- 执行 `npm run build` 通过，并还原本地生成的 `dist/RSS阅读.scripting`。


## 2026-07-31 Codex RSS 文章链接跳转

- 重新执行 git pull --ff-only origin dev，通过 fast-forward 同步远端分支。
- 读取 scripting-app-development 技能、项目参考文档和官方 Scripting 文档，确认 Link 组件支持小组件中的可点击 URL。
- 检查 scripts/RSS阅读/widget.tsx：复用 StreamEntry.alternate[].href，在 ReaderArticle 和 ArticleRow 中接入文章链接。
- 已完成源码替换，待执行 npm run build、git diff 和构建产物状态检查。

## 2026-08-01 RSS 阅读小中号顶部对齐与空状态简化

- 执行 `git pull --ff-only origin dev`，结果：Fast-forward，同步远端构建产物。
- 读取 `scripting-app-development` 技能、官方 Widget 文档和 `scripts/RSS阅读/widget.tsx`；确认小号、中号缺少大号已有的底部 `Spacer`。
- 修改 `scripts/RSS阅读/widget.tsx`：为小号和中号补充 `Spacer minLength={2}`，并将空状态改为单行文本。
- 执行 `npm run build` 通过；按仓库约定还原本地生成的 `dist/RSS阅读.scripting`。
- `npx tsc --noEmit` 因仓库缺少 `scripting` 类型声明失败；`git diff --check` 通过。

## 2026-08-01 RSS 阅读小中号顶部对齐与空状态简化

- 执行 `git pull --ff-only origin dev`，结果：Fast-forward，同步远端构建产物。
- 读取 `scripting-app-development` 技能、官方 Widget 文档和 `scripts/RSS阅读/widget.tsx`；确认小号、中号缺少大号已有的底部 `Spacer`。
- 修改 `scripts/RSS阅读/widget.tsx`：为小号和中号补充 `Spacer minLength={2}`，并将空状态改为单行文本。
- 执行 `npm run build` 通过；按仓库约定还原本地生成的 `dist/RSS阅读.scripting`。
- `npx tsc --noEmit` 因仓库缺少 `scripting` 类型声明失败；`git diff --check` 通过。
