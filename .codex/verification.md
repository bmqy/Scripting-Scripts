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
## 2026-07-30 RSS 阅读两条文章优化

- 可执行验证：`npm run build` 通过。
- 代码核对：`Header` 中固定标题名称已移除；更新时间保留在右侧并增加缩放余量；文章显示数量统一使用 `DISPLAY_ARTICLE_COUNT = 2`。
- 仍需验证：本地 Node 构建不能渲染 Scripting 原生 Widget，最终视觉效果需在 Scripting App/iOS 的 systemSmall、systemMedium、systemLarge 预览中确认。
## 2026-07-30 RSS 阅读配置页按钮空图标位修复

- 可执行验证：`npm run build` 通过。
- 代码核对：`登录并保存账号` 与 `保存组件配置` 按钮已移除 `systemImage`，避免蓝色按钮左侧空白。
- 仍需验证：本地构建不能渲染 Scripting 原生表单，需要在 iOS/Scripting App 配置页确认按钮文字居中显示。## 2026-07-31 RSS 阅读设置页布局优化

- 可执行验证：`npm run build` 通过。
- 代码核对：`Form` 已增加 `toolbar`；账号已配置时右上角显示“预览”按钮并调用 `Widget.preview({ family: 'systemMedium' })`；组件配置 Section 内原预览按钮已删除。
- 代码核对：刷新调度提示 `小组件的实际刷新时间由 iOS 系统调度，可能晚于所选频率。` 已移动到“刷新频率”Picker 后。
- 仍需验证：本地 Node 构建不能渲染 Scripting 原生设置页，最终导航栏按钮位置和 Form 行距需在 iOS/Scripting App 中确认。

## 2026-07-31 RSS 阅读设置页二次布局优化

- 已确认：`Form` 显式使用 `navigationBarTitleDisplayMode="large"`，预览按钮仍位于 `topBarTrailing`。
- 已确认：刷新调度提示位于刷新频率 Picker 后，并使用 `font="footnote" foregroundStyle="secondaryLabel"`。
- 已完成：`npm run build` 和 `git diff --check` 均通过。
- 遗留风险：本地 Node 构建无法渲染 Scripting 原生设置页，导航栏实际视觉对齐仍需在 Scripting App/iOS 中确认。
## 2026-07-31 RSS 阅读标题与预览图标同行对齐

- 已确认：页面标题和预览按钮位于同一 `HStack`，按钮只在账号配置完成时显示。
- 已确认：预览动作仍调用 `Widget.preview({ family: 'systemMedium' })`。
- 已完成：`npm run build` 和 `git diff --check` 均通过。
- 遗留风险：本地 Node 构建无法渲染 Scripting 原生 Form，首行的最终间距仍需在 Scripting App/iOS 设备端确认。
## 2026-07-31 RSS 设置页背景与预览入口简化

- 已确认：`Form` 使用 `scrollContentBackground="hidden" background="clear"`。
- 已确认：预览入口仅渲染 `rectangle.grid.1x2` 图标，仍调用 `Widget.preview({ family: 'systemMedium' })`。
- 已完成：`npm run build` 和 `git diff --check` 均通过。
- 遗留风险：本地 Node 构建无法渲染 Scripting 原生 Form，透明背景在 Scripting App/iOS 上的最终显示效果仍需设备端确认。


## 2026-07-31 RSS 文章链接跳转

- 执行者：Codex
- 验证命令：npm run build
- 结果：通过；scripts/RSS阅读/widget.tsx 成功复制并打包为 dist/RSS阅读.scripting。
- 代码检查：git diff --check 通过；已恢复本地构建生成的 dist/RSS阅读.scripting，避免将构建物作为源码变更保留。
- 未执行项：真实 iOS/Scripting App 点击行为无法在本地 Node.js 环境模拟，需要在 Scripting App 真机或预览中点按文章行确认跳转。

## 2026-08-01 RSS 阅读小中号顶部对齐与空状态简化

- 变更文件：`scripts/RSS阅读/widget.tsx`。
- 代码核对：SmallWidget、MediumWidget 均在主体后加入与 LargeWidget 相同的 `Spacer minLength={2}`，用于把主体推到顶部。
- 代码核对：EmptyState 仅保留一条单行文本；无未读时显示“没有未读文章”。
- 可执行验证：`npm run build` 通过；`git diff --check` 通过。
- 类型检查限制：本地缺少 `scripting` 类型声明，`npx tsc --noEmit` 失败；需在 Scripting App/同步类型环境中补充验证。
- 手工验证：需在 Scripting App 预览中分别检查 `systemSmall`、`systemMedium`、`systemLarge` 的顶部基线和空状态显示。

## 2026-08-01 RSS 阅读空状态次要文字样式

- 代码核对：`EmptyState` 不再使用 `title3` 或 `semibold`，改用 `secondaryText` 和 `caption2/callout`。
- 可执行验证：`npm run build`、`git diff --check` 均通过。
- 手工验证：需在 Scripting App 预览中确认三种尺寸的实际字号和颜色符合预期。

## 2026-08-01 ���α����֤����
- ������ͨ����npm run build ����� .build-cache.json �������ش�������ű���RSS �Ķ��������ɳɹ���
- ���죺ͨ����git diff --check �޿հ״������ս����� RSS Դ�뼰��������¼�����dist �����ѻָ���
- ����ʱ API���Ѱ��ٷ��ĵ��˶� ScrollView��LazyVStack��scrollTargetLayout��onScrollTargetVisibilityChange���ٷ�˵���ÿɼ��� API Ϊ iOS 18+��iOS 17 ����������������
- δ�����֤��δ������ʵ Scripting App/�豸���޷�֤�� iOS ����ʵ�ʻص��� Reader ����� edit-tag �����
- ���գ������������ʧ�ܣ�ҳ����ʾ������Ϣ������ֻ�ڳɹ����� edit-tag ����ټ�����

## 2026-08-01 �����Ⲽ�ֽ���
- ��ȷ�����������ʽΪ���ضϺ��Դ�� (δ����)����������ʾ��ƪδ������
- δ�����µ� Scripting API��������֤ͨ����
- ʣ����֤�����û���ͼ��Ӧ�豸��ȷ��ʡ�Ժź����ż������ɼ���

## 2026-08-01 �������׽���
- ��״̬��ʾ�ͷ�ҳ��ť�������¿�Ƭ���ұ߽���롣
- δ������ʵ�豸�������� iOS ҳ����Ŀ��ȷ��������Ⱦ��

## 2026-08-01 ������ʾ���׽���
- ������ʾ�ʹ�����ʾ�������¿�Ƭ���ұ߽���롣
- δ������ʵ�豸�������û���ҳ����Ŀ��ȷ�����ռ�ࡣ

## 2026-08-01 RSS 文章筛选与已读标识验证

- `npm run build`：通过。
- `git diff --check`：通过。
- 代码路径检查：`ArticleFilter` 覆盖未读、已读、全部；`toArticle` 读取 read category；筛选切换会重置分页；已读筛选遇到无已读文章时会继续请求 continuation，避免首屏全是未读时误报空状态。
- 未执行项：无法在本地模拟 Scripting App 的真实导航菜单和 Reader API 数据；需在 iOS 18+ Scripting App 中验证菜单交互、已读标识和离屏自动标记已读。
- 风险判断：构建与静态检查通过，剩余风险限于运行时 API/服务端返回数据的设备回归。

## 2026-08-01 RSS 未读数实时刷新验证

- `npm run build`：通过。
- `git diff --check`：通过。
- `npx tsc --noEmit --pretty false`：失败，原因是仓库当前没有 `dts/scripting.d.ts`；同时出现既有 Scripting JSX 类型级联错误。
- 代码路径检查：离屏回调、下一页按钮和手动标记入口均复用同一乐观计数逻辑；成功不会二次扣减，失败会恢复。
- 风险判断：构建验证通过，剩余风险限于 Scripting App 实际状态更新节奏和 Reader 网络失败场景的设备回归。

## 2026-08-01 RSS 文章连续滚动分页与源切换验证

- `npm run build`：通过。
- `git diff --check`：通过。
- 结构检查：文章 target ID 包含页面序号和文章 ID，跨页渲染后保持稳定；可见性回调会从全部已加载页面解析离屏文章。
- 分页检查：有 continuation 时自动追加下一页；无 continuation 且最后文章离屏时调用下一个源回调；无下一个源时显示结束提示。
- 未执行项：未在真实 Scripting App/Reader 服务中验证滚动回调和 API 标记请求。

## 2026-08-01 RSS 底部加载提示、离屏状态与源切换验证

- `npm run build`：通过。
- `git diff --check`：通过。
- 底部加载：固定 sentinel 作为 LazyVStack 直接子节点并设置 key，符合官方可见性回调的 scroll target 要求。
- 状态视觉：文章标题和“已读/未读”标签均由 `article.isRead` 驱动；标记成功后已有页面状态会同步变灰。
- 源切换：无 continuation 且底部 sentinel 离开可见集合时调用 `onNextFeed`，最后一个源不再继续切换。
- 未执行项：真实 Scripting App/Reader 服务的 UI 与网络回归。

## 2026-08-01 RSS 触底加载与文章卡片布局验证

- `npm run build`：通过。
- `git diff --check`：通过。
- 滚动加载：保持底部 sentinel 监听，并新增 `scrollPosition` leading target 监听；最后文章 target 或 sentinel 接近底部时请求下一页。
- 布局检查：源名称与时间不再同一行；时间位于摘要之后；状态仅通过标题颜色区分。
- 未执行项：真实 Scripting App/Reader API 的设备回归。

## 2026-08-01 RSS 触底加载再次修正与时间右对齐验证

- `npm run build`：通过。
- `git diff --check`：通过。
- 触底策略：可见文章尾部集合、scrollPosition leading target、底部 target 和按钮四条路径均复用 continuation 加载。
- 布局检查：时间位于摘要之后并右对齐，文章卡片不再出现“已读/未读”文字。
- 源切换：底部 target 或最后文章 target 离开可见集合且没有 continuation 时进入下一源。
- 未执行项：真实 Scripting App/Reader 服务设备回归。

## 2026-08-01 RSS 分页回滚验证报告

- npm run build：通过。
- git diff --check：通过。
- 分页路径：第一页禁用“上一页”；存在 continuation 时显示“下一页”；点击下一页请求并切换到下一页。
- 下一个源路径：当前页无 continuation 且源列表存在后续源时显示并启用“下一个源”；点击后复用既有源切换回调。
- 文章状态：翻页或切换源前调用当前页已读标记；文章标题继续通过已读/未读颜色区分，未增加状态文字。
- 布局：源名称单独一行，时间位于摘要底部并通过 Spacer 右对齐；空状态和分页区域保留左右留白。
- 未执行项：未连接真实 Scripting App/iOS 环境，无法完成设备端交互回归。
## 2026-08-01 RSS 离屏已读兼容验证报告

- iOS 18+ 路径：系统可见 ID 集合变化由 reducer 计算离开集合，再进入统一已读队列。
- iOS 17 路径：scrollPosition 报告首个可见文章 ID，当前导视文章之前的未读文章被标记为已读。
- 并发路径：已读队列使用 Set 合并 ID，markItemsAsRead 仍保留 pendingReadIds/markedReadIds 过滤和失败回滚。
- 页面边界：分页、筛选切换和新页加载都会重置旧可见集合，避免把旧页面事件映射到新页面。
- 构建和差异检查：npm run build、git diff --check 均通过。
- 未执行项：没有真实 Scripting App/iOS 环境，无法验证两个系统版本的实际回调行为和服务器端 edit-tag 结果。
## 2026-08-01 RSS iOS17 已读兜底验证报告

- 离屏标记：文章卡片 onDisappear、iOS18 可见性集合和分页离开整页三条路径共用已读队列。
- 分页：服务端请求 n=10，页面显示当前 continuation 的 10 条文章。
- 加载提示：文本字号改为 caption，外层 VStack 使用 maxWidth=infinity 且 alignment=center。
- 构建：npm run build 通过。
- 差异：git diff --check 通过。
- 未执行项：真实 iOS17/iOS18 设备交互回归，重点是 LazyVStack 回收触发 onDisappear 和 edit-tag 请求结果。
## 2026-08-02 RSS 空状态提示验证报告

- 无未读文章提示：居中显示。
- 字号：使用 caption，较原 body 字号更小。
- 留白：保留 leading/trailing 16 的左右内边距。
- 构建：npm run build 通过。
## 2026-08-02 RSS 分页回顶部验证报告

- 翻到下一页：新页渲染后定位第一条文章。
- 翻回上一页：同样定位上一页第一条文章。
- 普通滚动：不改变 pageIndex 或首条文章 ID，不会触发回顶部 effect。
- 构建：npm run build 通过。
## 2026-08-04 OPML SQLite 状态后端

- 执行者：Codex
- 先同步 dev 分支；远端快进更新仅包含既有构建产物。
- 新增 scripts/RSS阅读/opmlReadState.ts，提供 Storage 和 SQLite 两种 OPML 已读状态后端。
- 默认后端为 Storage；设置页可切换到 SQLite，切换时自动迁移已有状态。
- SQLite 使用 Scripting 全局 SQLite API，数据库位于 FileManager.appGroupDocumentsDirectory/rss-reader.sqlite。
- OPML 文章无 guid/id/url 时改用标题、发布时间和订阅源生成稳定 ID，避免刷新后状态错位。
- 主脚本、主屏组件、未读统计、已读/未读筛选和组件跳转共用同一状态键。
- 通过 npm run build；构建成功。
- npx tsc --noEmit --pretty false 受仓库缺失 dts/scripting.d.ts 影响失败，属于现有环境限制。
- 本次使用的内置补丁工具无法写入 Windows 工作区，改用等价的受控补丁写入流程；最终通过 git diff --check 检查。
## 2026-08-13 RSS 主页默认 UI 验证报告

- 入口：新增 scripts/RSS阅读/home_screen_default_ui.tsx，使用默认导出函数组件，符合官方主页默认 UI 入口约定。
- 复用：主页从 widget.tsx 复用数据类型、缓存读取、强制刷新、文章链接和主题调色板；导入主页时不会触发 Widget.present()。
- 交互：覆盖未配置、网络错误、有文章、无未读文章、手动刷新和文章链接场景；设置入口使用现有脚本 URL scheme。
- 构建：npm run build 通过；scripting 包确认包含新增文件。
- 元数据：script.json JSON 解析通过，版本 1.1.0，入口 index.tsx 未改变。
- 差异：git diff --check 通过；本地 dist 已恢复。
- 类型：仓库缺少 dts/scripting.d.ts，不能完成有效的 TypeScript 诊断；现有项目文件同样受影响。
- 遗留风险：需在 Scripting App 中从“主页”选择 RSS 阅读脚本，确认 ScrollView、按钮、链接和长列表在目标 iOS 版本上的实际渲染；主页默认 UI 依赖 RSS 组件已有网络/存储权限。
