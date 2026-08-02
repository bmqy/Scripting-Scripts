# RSS 阅读未读列表刷新修复记录

- 日期：2026-08-02
- 执行者：Codex
- 目标：修复源未读计数减少后，重新进入文章列表仍显示旧文章的问题。

## 上下文与结论

- 位置：scripts/RSS阅读/index.tsx 的 ArticleListPage、FeedManagementPage。
- 现状：文章标记已读后，FeedManagementPage 会递减源未读数；ArticleListPage 的 pages 状态仍可能被导航复用。
- 根因：ArticleListPage 的 React key 只有源 ID，重新选择同一源时可能复用旧分页状态，未重新请求 unread 首屏。
- 修复：每次点击源递增 articleListSession，并将源 ID与会话号组合为 ArticleListPage key，重新进入时强制执行首屏 unread 请求。
- 补充：文章页销毁时提交尚未到定时器的已读队列，避免返回源列表时丢失已读状态。

## 验证

- 'git pull --ff-only origin dev'：通过，基于远端最新 dev 修改。
- 'npm run build'：通过，RSS阅读脚本成功打包。
- 'git diff --check'：通过。
- 'npx tsc --noEmit --pretty false'：未通过；仓库缺少 'dts/scripting.d.ts'，同时出现既有 Scripting JSX 类型错误；未发现构建失败。
- 构建产物：已恢复本地 'dist/RSS阅读.scripting'，未纳入源码变更。

## 手动回归

在 Scripting App 中：打开 36 氪源，确认 20 条未读；浏览/滚动已读 10 条并返回；再次进入 36 氪，首屏应显示剩余未读文章，且继续翻页不应回到已读的前 10 条。

## 官方资料
