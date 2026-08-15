
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

## 2026-08-01 RSS 阅读空状态次要文字样式

- 根据用户反馈，将 `EmptyState` 的无未读提示改为次要文字颜色、普通字重和非标题字号。
- 执行 `npm run build` 通过，已还原本地生成的 `dist/RSS阅读.scripting`；`git diff --check` 通过。

## 2026-08-01 RSS 阅读小中号顶部对齐与空状态简化

- 执行 `git pull --ff-only origin dev`，结果：Fast-forward，同步远端构建产物。
- 读取 `scripting-app-development` 技能、官方 Widget 文档和 `scripts/RSS阅读/widget.tsx`；确认小号、中号缺少大号已有的底部 `Spacer`。
- 修改 `scripts/RSS阅读/widget.tsx`：为小号和中号补充 `Spacer minLength={2}`，并将空状态改为单行文本。
- 执行 `npm run build` 通过；按仓库约定还原本地生成的 `dist/RSS阅读.scripting`。
- `npx tsc --noEmit` 因仓库缺少 `scripting` 类型声明失败；`git diff --check` 通过。

## 2026-08-01 RSS δ���������Զ��Ѷ�
- ִ���ߣ�Codex��
- �Ѷ�ȡ scripting-app-development ���ܼ���Ŀ�������ڡ�iOS ҳ�桢��֤�淶��
- ��ִ�� sequential thinking�������������߲����ã��ڲ���������Ϊ rg��
- ��ִ�� git pull --ff-only origin dev���򱾵���Զ�˸���һ���ύ�޷���������������ύ������� origin/dev��
- �Ѳ��Ĺٷ� llms.txt��ScrollView �ɼ���׷�ٺ� LazyVStack �ĵ���ȷ�� onScrollTargetVisibilityChange��scrollTargetLayout��key��threshold �÷���
- �޸� scripts/RSS�Ķ�/index.tsx������δ��ɸѡ����������Ѷ��������ɼ��Դ������������������ϼ��б�����ͬ����
- npm run build ǿ�����ܳɹ������������ѻָ��������뱾��Դ������
- npx tsc --noEmit --pretty false ��ȱ�� dts/scripting.d.ts ʧ�ܣ�������ҪΪ����ʱģ��� JSX ����ȱʧ���Ѽ�¼����֤�ļ���

## 2026-08-01 RSS �����Ⲽ������
- �û��������������������δ�������ضϡ�
- �޸� scripts/RSS�Ķ�/index.tsx��Դ���������ʾ 10 ���ַ�������ʹ��ʡ�Ժţ�δ����ʼ�������ź�׺��ʾ��
- ���ֿ�����ͬ�� origin/dev��npm run build �ɹ���dist �����ѻָ���

## 2026-08-01 RSS �����б�������������
- �û�������״̬��ʾ�ͷ�ҳ�ؼ�����Ļ��Ե��
- Ϊ��״̬ VStack �ͷ�ҳ HStack ���� 16 �� leading/trailing padding�������¿�Ƭ����һ�¡�
- npm run build �ɹ���dist �����ѻָ���

## 2026-08-01 RSS ������ʾ��������
- �û�����������ʾ������Ļ��Ե��
- ��������ʾ�ͼ�����ʾͳһ������ 16 ��ˮƽ�ڱ߾�� VStack �С�
- npm run build �ɹ���dist �����ѻָ���

## 2026-08-01 RSS 文章已读标识与筛选菜单

- 执行者：Codex。
- 在编辑前已执行 `git pull --ff-only origin dev`，当前修改基于最新远端分支。
- 按用户反馈增加文章 `isRead` 状态：读取 Reader stream 条目的 read category，并在“已读/全部”筛选下显示“已读/未读”标识。
- 增加“未读/已读/全部”筛选菜单，默认筛选未读；切换筛选时重置当前分页和可见性状态。
- 未读筛选继续使用 Reader `xt=read` 查询；已读筛选在客户端从连续分页中筛出已读文章；全部筛选读取原始文章列表。
- 复用官方 `toolbar.topBarTrailing` 与 `Menu` 组件模式，参考：https://scriptingapp.github.io/guide/Views/Toolbars/、https://scriptingapp.github.io/guide/Views/Menu/index_example。

## 2026-08-01 RSS 未读数实时刷新修正

- 执行者：Codex。
- 执行前已执行 `git pull --ff-only origin dev`，同步远端自动构建提交。
- 修正 `scripts/RSS阅读/index.tsx`：标记文章已读请求发起时立即乐观扣减详情页标题和源列表未读数，`edit-tag` 失败时回滚。
- 父子页面未读数回调改为 delta 语义，支持成功扣减和失败恢复；不再等待翻页触发重新渲染。
- 官方可见性回调文档确认 `onScrollTargetVisibilityChange` 在滚动中同步回调，继续用于识别滚出屏幕的文章：https://scriptingapp.github.io/TestFlight/zh/guide/Views/Scroll%20views/。

## 2026-08-01 RSS 文章连续滚动分页与源切换

- 执行者：Codex。
- 编辑前执行 `git pull --ff-only origin dev`，基于远端最新自动构建提交修改。
- 将 RSS 文章列表由页码按钮改为连续滚动：最后一条进入可视区域时自动加载 continuation 下一页，并连续渲染已加载页面。
- 当前源的最后一页最后一条文章滚出屏幕后，若存在下一个源则自动切换到下一个源；最后一个源显示结束提示。
- 可见性识别改为跨所有已加载页面按稳定 target ID 查找文章，滚出屏幕的未读文章统一调用标记已读逻辑。
- 依据官方滚动可见性文档确认 `scrollTargetLayout`、子节点 `key` 和 `onScrollTargetVisibilityChange` 的组合方式：https://scriptingapp.github.io/TestFlight/zh/guide/Views/Scroll%20views/。

## 2026-08-01 RSS 底部触发与文章状态视觉修正

- 执行者：Codex。
- 执行前执行 `git pull --ff-only origin dev`，同步远端自动构建产物。
- 增加固定的 `article-list-end` 滚动目标：底部目标可见时自动加载 continuation，并显示“继续上滑加载更多…”或“正在加载下一页…”。
- 没有 continuation 时，底部目标滑出屏幕后切换下一个源；最后一个源显示结束提示。
- 将加载触发从动态最后一篇文章 target 改为固定底部 target，并用 `useEffect` 处理底部目标在追加数据后仍保持可见的情况。
- 已读文章标题改为次要颜色并显示“已读”，未读文章保持蓝色并显示“未读”，便于区分状态。
- 依据官方 `useEffect` 与 ScrollView 可见性文档实现状态驱动的底部加载：https://scriptingapp.github.io/TestFlight/guide/Quick%20Start、https://scriptingapp.github.io/llms.txt。

## 2026-08-01 RSS 触底加载与文章卡片布局修正

- 执行者：Codex。
- 编辑前执行 `git pull --ff-only origin dev`，同步远端自动构建提交。
- 在底部 sentinel 可见性之外增加官方 `scrollPosition` 领先目标监听；当最后一条文章或底部目标成为 leading target 时触发 continuation 加载，避免仅依赖底部可见回调。
- 卡片布局调整为源名称单独一行、标题单独一行、摘要内容、时间置于摘要底部。
- 删除文章卡片中的“已读/未读”文字，仅使用已读标题次要颜色、未读标题蓝色区分状态。
- 依据官方 ScrollView 文档核对 `scrollPosition` 的 state/onChanged 绑定及 `scrollTargetLayout`/`key` 要求：https://scriptingapp.github.io/TestFlight/guide/Views/Scroll%20views/。

## 2026-08-01 RSS 触底加载再次修正与时间右对齐

- 执行者：Codex。
- 编辑前执行 `git pull --ff-only origin dev`，同步远端自动构建提交。
- 针对底部已显示 continuation 但未发起请求的问题，将自动加载条件扩大为最后 4 条文章 target、leading target 或底部 target 任一接近底部即加载。
- 底部 continuation 提示改为可点击的加载按钮，作为滚动回调未触发时的兜底入口；末尾文章离屏也纳入源切换条件。
- 时间改为摘要后独立一行，并通过 Spacer 右对齐；卡片不显示已读/未读状态文字。
- 依据官方 ScrollView 文档核对 scrollPosition、可见 target 和 key 的组合方式：https://scriptingapp.github.io/TestFlight/guide/Views/Scroll%20views/。

## 2026-08-01 RSS 分页回滚与下一个源按钮

- 执行者：Codex。
- 编辑前已执行 git pull --ff-only origin dev，基于远端最新代码修改。
- 将 RSS 文章列表从连续滚动/触底加载改回单页分页：只渲染当前页，底部提供“上一页 / 第 N 页 / 下一页”。
- 当前页没有 continuation 且存在后续源时显示“下一个源”按钮；没有后续源时显示“已经是最后一个源。”。
- 保留未读筛选默认值、已读样式区分、离屏/翻页时的已读标记、未读数量乐观刷新、源名独立一行和时间右对齐布局。
- 删除连续滚动专用的末尾 target 和 scrollPosition 状态，避免旧触底路径继续参与行为。
- 执行 npm run build 通过，并恢复本地生成的 dist/RSS阅读.scripting，未纳入提交。
## 2026-08-01 RSS 离屏已读 iOS 18/17 兼容修复

- 执行者：Codex。
- 编辑前执行 git pull --ff-only origin dev，同步远端自动构建提交。
- 按官方 Scripting 文档保留 iOS 18+ 的 onScrollTargetVisibilityChange，并将可见集合差分改为 reducer 状态，避免快速回调因异步 state 更新漏掉离屏文章。
- 增加统一已读队列，对离屏事件和首个可见项事件进行合并去重，避免重复 edit-tag 请求和重复扣减未读数。
- 增加 scrollPosition 兼容路径：当首个可见文章向后移动时，把其之前已经离屏的文章加入已读队列，作为 iOS 17 的回退方案。
- 翻页、筛选和加载新页面时清理旧页面的可见性状态和首个可见项，避免新旧页面文章 ID 串联。
- npm run build 通过，构建产物已恢复，未纳入提交。
## 2026-08-01 RSS iOS17 已读兜底、分页条数和加载提示调整

- 执行者：Codex。
- 编辑前执行 git pull --ff-only origin dev。
- 保留 iOS18+ onScrollTargetVisibilityChange 主路径，给每个文章卡片增加官方生命周期 onDisappear 回调，iOS17 通过 LazyVStack 行离开视图时加入已读队列。
- 将 ARTICLE_PAGE_SIZE 从 20 调整为 10，分页接口和分页显示均按每页 10 条工作。
- 加载文章提示改为 caption 字体、居中对齐并保留左右留白。
- npm run build 和 git diff --check 通过，构建产物已恢复。
## 2026-08-02 RSS 空状态提示布局调整

- 执行者：Codex。
- 编辑前执行 git pull --ff-only origin dev。
- 将无未读/无已读/无文章提示统一为居中对齐、caption 小字号和最大宽度居中容器。
- npm run build 通过，构建产物已恢复。
## 2026-08-02 RSS 分页切换回到顶部

- 执行者：Codex。
- 编辑前执行 git pull --ff-only origin dev。
- 修复分页切换时仅将 scrollPosition 设为 null 导致新页继承底部滚动位置的问题。
- 新页数据渲染后，将 scrollPosition 指向当前页第一条文章的稳定 key；普通滚动不会触发该 effect。
- npm run build 和 git diff --check 通过，构建产物已恢复。
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

- 执行者：Codex。
- 编辑前确认工作区干净，并执行 git pull --ff-only origin main；按用户要求切换到 dev 后再次确认 dev 已同步远端。
- 阅读 Scripting App 官方 Home Screen UI 入口约定，确认新增 home_screen_default_ui.tsx，默认导出函数组件且不调用 Navigation.present/Script.exit。
- 新增 RSS 主页默认 UI，复用 widget.tsx 的数据加载、文章链接和调色板；widget.tsx 增加 Script.env === widget 守卫，避免被主页导入时调用 Widget.present。
- loadData 增加 forceRefresh 参数，主页手动刷新绕过新鲜缓存，小组件保持原缓存行为。
- 更新 RSS script.json 版本为 1.1.0 和描述，并补充 README 使用说明。
- npm run build 通过；构建包内确认包含 home_screen_default_ui.tsx；dist 构建产物已恢复，不纳入提交。
- npx tsc --noEmit 受仓库缺失 dts/scripting.d.ts 阻塞，产生的 scripting/JSX 相关错误也存在于原有文件；记录为环境限制。

## 2026-08-13 RSS 主页交互增强

- 执行者：Codex。
- 编辑前同步 origin/dev；main 未切换、未修改。
- 核查发现 index.tsx 已实现 RSS 源切换、continuation 分页、末页切换下一个源，以及基于 onDisappear 的离屏已读队列。
- 主页入口改为复用导出的 FeedManagementPage，避免复制请求、分页和已读状态逻辑。
- index.tsx 的 run() 增加 Script.env === index 守卫，避免主页导入时启动普通脚本生命周期。
- Widget.reloadAll() 统一增加 index/widget 环境守卫，主页环境只更新自身状态，不调用 Widget 专属刷新能力。
- script.json 版本更新为 1.2.0，README 补充主页交互说明。
- npm run build 通过，dist 构建产物已恢复，不纳入提交。
- npx tsc --noEmit 仍受仓库缺失 dts/scripting.d.ts 阻塞，属于既有环境限制。

## 2026-08-13 RSS 主页默认文章列表修正

- 执行者：Codex。
- 编辑前同步 origin/dev；main 未修改。
- 修正主页入口：不再直接显示 FeedManagementPage 源管理列表，新增 HomeReaderPage，初始化后优先选择 settings.feedId 默认源并直接显示 ArticleListPage。
- ArticleListPage 右上角增加主页专用的切换源菜单和刷新按钮；普通脚本源管理页保持原有工具栏。
- 切换源通过 key/session 重挂载文章页，刷新通过重新加载源列表、未读数并重挂载当前文章页。
- 底部分页、末页切换下一个源和 onDisappear 离屏已读逻辑继续复用既有实现。
- script.json 版本更新为 1.3.0，README 同步修正文案。
- 强制 npm run build 通过；dist 构建产物已恢复，不纳入提交。
- npx tsc --noEmit 受仓库缺失 dts/scripting.d.ts 阻塞，属于既有环境限制。

## 2026-08-14 RSS 主页工具栏显示修正

- 执行者：Codex。
- 编辑前同步 origin/dev；main 未修改，版本号保持 1.0.0。
- 根因：主页默认 UI 直接挂载 HomeReaderPage，没有 NavigationStack，ArticleListPage 的 navigationTitle/toolbar 没有导航容器承载。
- 修复：home_screen_default_ui.tsx 为配置页和文章页增加 NavigationStack 包装。
- npm run build、包构建和 git diff --check 通过；dist 已恢复，不纳入提交。
- 未连接 Scripting App/iOS，仍需设备确认主页顶部工具栏真实显示。

## 2026-08-14 RSS 标题切换源调整

- 执行者：Codex。
- 编辑前已同步 origin/dev；main 未修改，RSS script.json 与 package.json 版本均保持 1.0.0。
- 依据 Scripting 官方 toolbar 文档，将主页模式的源选择 Menu 从 topBarTrailing 移至 toolbar.principal，使当前源标题本身承担切换入口。
- 右侧保留文章筛选与刷新；普通脚本源管理页面行为不变。
- npm run build 与 git diff --check 通过；dist 构建产物已恢复，不纳入提交。

## 2026-08-14 RSS 标题可点击指示图标

- 执行者：Codex。
- 编辑前已同步 origin/dev；main 未修改，版本号保持 1.0.0。
- 依据 Scripting 官方 Menu 文档，将 sourceMenu 改为自定义 label，在当前源标题右侧增加 chevron.down 图标。
- npm run build 与 git diff --check 通过；dist 构建产物已恢复，不纳入提交。

## 2026-08-15 RSS 滚动触底加载下一页

- 执行者：Codex。
- 编辑前已同步 origin/dev；main 未修改，版本号保持 1.0.0。
- 依据 Scripting ScrollView/LazyVStack 的滚动目标与生命周期行为，将页尾哨兵 onAppear 作为触底触发点。
- 文章页改为连续渲染已加载页面，触底按 continuation 自动追加下一页；删除上一页/下一页按钮，保留最后一页切换下一个源。
- npm run build 与 git diff --check 通过；dist 构建产物已恢复，不纳入提交。

## 2026-08-15 RSS 已读队列与下拉刷新优化

- 执行者：Codex。
- 编辑前已同步 origin/dev；main 未修改，版本号保持 1.0.0。
- 修复快速滚动时触底加载清空待读队列的问题；已读队列提交改为 250ms 批量、防重复引用集合和可等待的操作集合。
- 文章页、默认源加载页和 RSS 源管理页移除右侧刷新按钮，改用 Scripting refreshable 下拉刷新；刷新前等待已读提交完成并校准未读数。
- npm run build 与 git diff --check 通过；dist 构建产物已恢复，不纳入提交。

## 2026-08-15 RSS 源筛选入口移至左侧

- 执行者：Codex。
- 编辑前已同步 origin/dev；main 未修改，版本号保持 1.0.0。
- 依据 Scripting 官方 toolbar 文档，将主页源菜单从 principal 调整为 topBarLeading；主页导航标题固定为 RSS 阅读。
- 普通源管理详情页继续显示当前源标题，避免改变非主页场景。
- npm run build 与 git diff --check 通过；dist 构建产物已恢复，不纳入提交。

## 2026-08-15 RSS 源筛选显示未读数

- 执行者：Codex。
- 编辑前已同步 origin/dev；main 未修改，版本号保持 1.0.0。
- 复用 FeedOverview.unreadCount，在左侧源筛选 Menu 的每个选项中显示源名称与未读数；当前源保留勾选标记。
- npm run build 与 git diff --check 通过；dist 构建产物已恢复，不纳入提交。

## 2026-08-15 RSS App 内网页手势关闭

- 执行者：Codex。
- 编辑前已同步 origin/dev；main 未修改，版本号保持 1.0.0。
- 依据 Scripting 官方 Safari.present 文档，将 App 内网页从 fullscreen=true 改为 fullscreen=false，以保留系统可交互关闭的模态呈现。
- 文章列表与组件文章链接共用 presentInAppBrowser，因此两条入口同步生效。
- npm run build 与 git diff --check 通过；dist 构建产物已恢复，不纳入提交。
