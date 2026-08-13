# 测试记录

- 日期：2026-07-29
- 执行者：Codex
- 命令：`npm run build`
- 结果：通过，已重新生成 `dist/RSS阅读.scripting`。
- 命令：`npx tsc --noEmit`
- 结果：失败。失败原因是仓库当前缺少 `scripting` 类型声明和 JSX factory 运行时配置，且既有 `限号` 文件也报同类错误；该结果不能定位为本次布局改动引入。
## 2026-07-29 图片撑开修复

- 命令：`npm run build`
- 结果：通过，已重新生成 `dist/RSS阅读.scripting`。
## 2026-07-29 Header 被主体顶出修复

- 命令：`npm run build`
- 结果：通过，已重新生成 `dist/RSS阅读.scripting`。
## 2026-07-30 RSS 阅读两条文章优化

- 执行者：Codex
- 命令：`npm run build`
- 结果：通过。构建脚本重新打包 `RSS阅读`，并跳过未变化的 `限号`。
- 产物影响：`dist/RSS阅读.scripting` 因本地构建被更新。
## 2026-07-30 RSS 阅读配置页按钮空图标位修复

- 执行者：Codex
- 命令：`npm run build`
- 结果：通过。构建脚本重新打包 `RSS阅读`。
- 包内容核对：`dist/RSS阅读.scripting` 内两个 `borderedProminent` 按钮不再带 `systemImage`；`预览小组件` 仍保留 `rectangle.grid.1x2`。## 2026-07-31 RSS 阅读设置页布局优化

- 执行者：Codex
- 命令：`npm run build`
- 结果：通过。构建脚本重新打包 `RSS阅读`，并跳过未变化的 `限号`。
- 产物处理：`dist/RSS阅读.scripting` 因本地构建被更新，随后按仓库约定还原，未保留为待提交变更。

## 2026-07-31 RSS 阅读设置页二次布局优化

- 执行者：Codex
- 命令：`npm run build`
- 结果：通过；RSS 阅读脚本成功打包，未修改限号脚本。
- 产物处理：按仓库约定还原本地生成的 `dist/RSS阅读.scripting`，未保留构建产物变更。
- 静态检查：`git diff --check` 通过。
## 2026-07-31 RSS 阅读标题与预览图标同行对齐

- 执行者：Codex
- 命令：`npm run build`
- 结果：通过；RSS 阅读脚本成功打包，未修改限号脚本。
- 产物处理：按仓库约定还原本地生成的 `dist/RSS阅读.scripting`。
- 静态检查：`git diff --check` 通过。
## 2026-07-31 RSS 设置页背景与预览入口简化

- 执行者：Codex
- 命令：`npm run build`
- 结果：通过；RSS 阅读脚本成功打包，未修改限号脚本。
- 产物处理：按仓库约定还原本地生成的 `dist/RSS阅读.scripting`。
- 静态检查：`git diff --check` 通过。


## 2026-07-31 RSS 文章链接跳转

- 执行者：Codex
- 单元测试：项目未配置 test 脚本；本次逻辑为纯数据映射与声明式视图组合，使用构建验证替代。
- 冒烟/功能验证：执行 npm run build，结果成功，RSS阅读脚本打包完成。
- 边界检查：无 alternate[].href 时不创建 Link；非 http/https 或无效 URL 被忽略，文章仍可正常渲染。

## 2026-08-01 RSS 阅读小中号顶部对齐与空状态简化

- 执行者：Codex
- 单元测试：项目未配置 test 脚本；本次修改为声明式布局和空状态文本，使用构建验证替代。
- 冒烟验证：`npm run build` 通过，RSS 阅读脚本成功打包。
- 静态检查：`git diff --check` 通过。
- 类型检查：`npx tsc --noEmit` 未通过，原因是仓库未提供 `scripting` 模块类型声明，且现有 JSX 全局类型解析失败。
- 产物处理：已还原 `dist/RSS阅读.scripting`，工作区仅保留源码变更。

## 2026-08-01 RSS 阅读空状态次要文字样式

- 执行者：Codex
- 冒烟验证：`npm run build` 通过。
- 样式核对：空状态使用 `secondaryText`、`caption2/callout` 和普通字重，仍保持单行限制。
- 静态检查：`git diff --check` 通过；构建产物已还原。

## 2026-08-01 RSS 阅读小中号顶部对齐与空状态简化

- 执行者：Codex
- 单元测试：项目未配置 test 脚本；本次修改为声明式布局和空状态文本，使用构建验证替代。
- 冒烟验证：`npm run build` 通过，RSS 阅读脚本成功打包。
- 静态检查：`git diff --check` 通过。
- 类型检查：`npx tsc --noEmit` 未通过，原因是仓库未提供 `scripting` 模块类型声明，且现有 JSX 全局类型解析失败。
- 产物处理：已还原 `dist/RSS阅读.scripting`，工作区仅保留源码变更。

## 2026-08-01 ���α����֤
- ��Ԫ���ԣ��ֿ�δ���� test �ű����޷�ִ�У�ͨ������·����鸲�ǿ��б��������� ID���ظ��ɼ��Իص�����������ͽӿ�ʧ����ʾ��
- ð�̲��ԣ�npm run build��ǿ��ɾ������������������У�RSS �Ķ����޺Žű����ɹ������
- ��̬��飺git diff --check ͨ����
- TypeScript��npx tsc --noEmit --pretty false δͨ����ԭ���ǲֿ⵱ǰȱ�� dts/scripting.d.ts��ͬʱ���� JSX ������������ʽ���ʹ��󣻲��Ǳ��ι�������ʹ�õļ�顣
- �豸��δִ�У���Ҫ�� iOS 18+ �� Scripting App �д� RSS Դ������������δ�����µ�Դ������ʹ������ȫ������ȷ��Դ����������ϼ��б������ݼ���

## 2026-08-01 �����Ⲽ����֤
- git diff --check ͨ����
- npm run build �ɹ���
- ��̬��鸲�Ǳ���ضϡ���Դ�����ˡ�δ�����Ǹ������ź�׺��
- ��������ʵ iOS �豸��ȷ�ϲ�ͬ��Ļ�����µ���������Ӿ�Ч����

## 2026-08-01 ����������֤
- git diff --check ͨ����
- npm run build �ɹ���
- ������ȷ�Ͽ�״̬�ͷ�ҳ�ؼ���ʹ�� 16 ��ˮƽ�ڱ߾ࡣ

## 2026-08-01 ������ʾ������֤
- git diff --check ͨ����
- npm run build �ɹ���
- ������ȷ�ϴ��󡢼��ء���״̬�ͷ�ҳ�������ˮƽ�ڱ߾ࡣ

## 2026-08-01 RSS 文章筛选与已读标识验证

- 执行者：Codex。
- 冒烟验证：`npm run build` 通过，RSS 阅读脚本成功打包。
- 静态验证：`git diff --check` 通过。
- 代码核对：默认筛选为未读；菜单包含未读、已读、全部；已读模式不会重复调用标记已读；已读/未读状态在文章元信息中显示。
- 类型检查：仓库仍缺少 `dts/scripting.d.ts`，未执行成功的 `npx tsc --noEmit` 原因与本次修改无关。
- 设备验证：未连接 Scripting App/iOS 预览环境，菜单展开、真实 Reader 分类返回和滚动效果仍需在设备上回归。
- 构建产物：已还原本地生成的 `dist/RSS阅读.scripting`，未纳入提交。

## 2026-08-01 RSS 未读数实时刷新验证

- 执行者：Codex。
- 冒烟验证：`npm run build` 通过，RSS 阅读脚本成功打包。
- 静态验证：`git diff --check` 通过。
- 类型检查：`npx tsc --noEmit --pretty false` 仍因仓库缺少 `dts/scripting.d.ts` 及其引发的 JSX 类型级联错误失败。
- 逻辑核对：标记请求开始立即扣减计数；请求失败恢复计数；成功后只同步文章已读状态，避免重复扣减。
- 设备验证：未连接 Scripting App/iOS 预览环境，仍需实际滚动文章确认离屏回调和网络失败回滚的视觉效果。
- 构建产物：已还原本地生成的 `dist/RSS阅读.scripting`，未纳入提交。

## 2026-08-01 RSS 文章连续滚动分页与源切换验证

- 执行者：Codex。
- 冒烟验证：`npm run build` 通过，RSS 阅读脚本成功打包。
- 静态验证：`git diff --check` 通过。
- 代码核对：不再渲染上一页/下一页按钮；最后文章进入可视区域加载 continuation；最后一条滚出屏幕后进入下一源；跨页面查找离屏文章并标记已读。
- TypeScript 诊断：`npx tsc --noEmit --pretty false` 受本机 Volta 无法创建 `C:\Users\88268\AppData\Local\Volta` 目录影响，未能启动诊断；项目此前也缺少 `dts/scripting.d.ts`。
- 设备验证：未连接 Scripting App/iOS 预览环境，仍需实际验证连续滚动触底、源切换和离屏已读请求。
- 构建产物：已还原本地生成的 `dist/RSS阅读.scripting`，未纳入提交。

## 2026-08-01 RSS 底部加载提示、离屏状态与源切换验证

- 执行者：Codex。
- 冒烟验证：`npm run build` 通过，RSS 阅读脚本成功打包。
- 静态验证：`git diff --check` 通过。
- 代码核对：底部 sentinel 有固定 key；可见时触发下一页请求；请求中有加载提示；无 continuation 时滑出触发下一个源；文章标题和状态标签按 isRead 区分颜色。
- TypeScript 诊断：本机 `npx tsc` 受 Volta 无法创建 `C:\Users\88268\AppData\Local\Volta` 目录影响，未能启动；项目仍缺少 `dts/scripting.d.ts`。
- 设备验证：未连接 Scripting App/iOS 预览环境，需实际确认可见性回调和菜单导航时序。
- 构建产物：已还原本地生成的 `dist/RSS阅读.scripting`，未纳入提交。

## 2026-08-01 RSS 触底加载与文章卡片布局验证

- 执行者：Codex。
- 冒烟验证：`npm run build` 通过，RSS 阅读脚本成功打包。
- 静态验证：`git diff --check` 通过。
- 代码核对：`scrollPosition` 和底部 sentinel 均可触发下一页；文章结构为源名称、标题、摘要、时间；卡片不再渲染已读/未读文字。
- TypeScript 诊断：本机 `npx tsc` 仍受 Volta 无法创建 `C:\Users\88268\AppData\Local\Volta` 目录影响，未能启动；项目还缺少 `dts/scripting.d.ts`。
- 设备验证：未连接 Scripting App/iOS 预览环境，需实际确认滚动到最后一条时的 continuation 请求。
- 构建产物：已还原本地生成的 `dist/RSS阅读.scripting`，未纳入提交。

## 2026-08-01 RSS 触底加载再次修正与时间右对齐验证

- 执行者：Codex。
- 冒烟验证：`npm run build` 通过，RSS 阅读脚本成功打包。
- 静态验证：`git diff --check` 通过。
- 逻辑核对：最后四条文章、leading target、底部 target 均可触发 continuation；底部有可点击加载按钮；时间使用 Spacer 右对齐；卡片状态文字已移除。
- TypeScript 诊断：本机 `npx tsc` 仍受 Volta 无法创建 `C:\Users\88268\AppData\Local\Volta` 目录影响，未能启动；项目还缺少 `dts/scripting.d.ts`。
- 设备验证：未连接 Scripting App/iOS 预览环境，需实际确认自动触底请求和按钮兜底。
- 构建产物：已还原本地生成的 `dist/RSS阅读.scripting`，未纳入提交。

## 2026-08-01 RSS 分页回滚验证

- 执行者：Codex。
- 构建验证：npm run build 通过，RSS 阅读脚本成功打包。
- 静态检查：git diff --check 通过。
- 源码检查：确认文章列表只渲染 currentPage，分页按钮根据 continuation 和是否存在下一个源切换行为；确认未读/已读/全部筛选仍保留。
- 设备验证：当前未连接 Scripting App/iOS 预览环境，未进行真机点击和视觉回归；需在设备上确认分页按钮、下一个源切换及未读数量更新。
- 构建产物：已恢复本地生成的 dist/RSS阅读.scripting，未提交。
## 2026-08-01 RSS 离屏已读兼容验证

- 执行者：Codex。
- 构建验证：npm run build 通过。
- 静态格式验证：git diff --check 通过。
- 逻辑检查：iOS 18+ 使用 onScrollTargetVisibilityChange；iOS 17 使用 scrollPosition 前导项变化作为兼容回退；两条路径共用已读队列并去重。
- TypeScript 诊断：npx tsc --noEmit 未通过，原因是仓库缺少 scripting 模块声明，产生连带 JSX/隐式 any 错误；该问题属于现有本地诊断环境限制，npm run build 未受影响。
- 设备验证：未连接 Scripting App/iOS 预览环境，尚未完成真机 iOS 17 和 iOS 18 的滚动回归。
- 构建产物：dist/RSS阅读.scripting 和 dist/限号.scripting 已恢复，未提交。
## 2026-08-01 RSS iOS17 已读兜底验证

- 构建验证：npm run build 通过。
- 静态格式验证：git diff --check 通过。
- 分页检查：ARTICLE_PAGE_SIZE=10，文章接口请求和 continuation 页边界共用该值。
- iOS17 检查：文章行使用 onDisappear 加入统一已读队列；iOS18 可见性回调继续保留，重复事件由队列去重。
- 布局检查：加载文章提示使用 caption 字体和最大宽度居中容器。
- 设备验证：未连接 Scripting App/iOS 设备，尚未实测 iOS17 onDisappear 是否在 LazyVStack 回收行时触发。
- 本仓库没有独立 test/lint/typecheck 脚本；构建是项目规定的自动验证入口。
## 2026-08-02 RSS 空状态提示验证

- npm run build：通过。
- git diff --check：通过。
- 源码检查：空状态使用 alignment=center、maxWidth=infinity 和 caption 字体；加载提示样式保持一致。
- 未连接 Scripting App/iOS 设备，未进行截图级视觉回归。
## 2026-08-02 RSS 分页回顶部验证

- npm run build：通过。
- git diff --check：通过。
- 源码检查：滚动定位 effect 依赖 pageIndex 和当前页第一条文章 ID，只在翻页/新页加载时定位顶部。
- 未连接 Scripting App/iOS 设备，未进行真机分页滚动视觉回归。
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
## 2026-08-13 RSS 主页默认 UI

- 单元测试：仓库未配置 test/lint/typecheck 脚本，也没有 Scripting 运行时测试夹具；未伪造测试结果。
- 冒烟构建：npm run build 通过，RSS 阅读和限号脚本均成功打包。
- 包内容检查：tar -tf dist/RSS阅读.scripting 确认包含 home_screen_default_ui.tsx、script.json 和 widget.tsx。
- 元数据检查：script.json 可被 PowerShell ConvertFrom-Json 解析，入口仍为 index.tsx，版本为 1.1.0。
- 差异检查：git diff --check 通过。
- 类型检查：npx tsc --noEmit 未通过，原因是仓库缺少 dts/scripting.d.ts；因此出现的 scripting 模块、JSX 工厂及既有文件类型错误属于当前环境限制。
- 设备验证：未连接 Scripting App/iOS 环境，尚未验证主页脚本选择、文章点击、刷新和系统浅色/深色主题的真机表现。

## 2026-08-13 RSS 主页交互增强

- 单元测试：仓库没有 test/lint/typecheck 脚本和 Scripting 运行时夹具，未伪造单元测试结果。
- 冒烟构建：npm run build 通过，RSS 阅读和限号脚本打包成功。
- 包内容：tar -tf dist/RSS阅读.scripting 确认包含 home_screen_default_ui.tsx、index.tsx 和 script.json。
- 源码检查：确认 FeedManagementPage、ArticleListPage、onDisappear、下一页和下一个源逻辑均被主页入口复用。
- 生命周期检查：确认 index.tsx 仅在 Script.env === index 时调用 run()。
- 差异检查：git diff --check 通过。
- 类型检查：npx tsc --noEmit 未通过，原因是缺少 dts/scripting.d.ts，且现有项目文件同样出现 scripting/JSX 运行时类型错误。
- 设备验证：未连接 Scripting App/iOS，尚未实测主页源切换、分页滚动、离屏回调和多源末页切换。

## 2026-08-13 RSS 主页默认文章列表修正

- 冒烟构建：强制 npm run build 通过，RSS 阅读和限号脚本均成功打包。
- 包内容检查：dist/RSS阅读.scripting 包含 home_screen_default_ui.tsx、index.tsx 和 script.json。
- 元数据检查：script.json JSON 解析通过，版本为 1.3.0，entry 仍为 index.tsx。
- 源码检查：HomeReaderPage 使用 settings.feedId 初始化默认源；ArticleListPage 右上角包含切换源和刷新；底部保留分页及末页下一个源；文章行保留 onDisappear。
- 差异检查：git diff --check 通过，dist 已恢复。
- 类型检查：npx tsc --noEmit 未通过，原因是缺少 dts/scripting.d.ts；同时现有文件出现 scripting 模块和 JSX 工厂错误。
- 设备验证：未连接 Scripting App/iOS，尚未实测主页默认源加载、顶部菜单、刷新重载和分页滚动。
