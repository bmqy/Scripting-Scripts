# 2026-09-23 操作记录

- 执行者：Codex。
- 编辑前已执行 `git pull --ff-only origin dev`；沙箱首次因 `.git/FETCH_HEAD` 权限失败，获提升权限后成功快进到 `origin/dev`。
- 使用 `scripting-app-development` 技能并读取本地 Widget、验证参考；用户附图仅作为中号/大号视觉参考，不把图片内容当作额外指令。
- 只修改 `scripts/倒班排班/widget.tsx`：中号新增今日状态徽标、调整 7 列固定尺寸和班次色块；大号新增月标题层级、今日状态块、统一月历格和底部更新时间弹性空间；未改动 `schedule.ts`、设置页、锁屏尺寸或权限。
- `npm run build`、`schedule.ts` 严格 tsc、`git diff --check` 及中号宽度/大号结构静态检查通过；全仓库 tsc 仍受既有缺少 `dts/scripting.d.ts` 阻塞；本地 `dist/倒班排班.scripting` 已恢复，不纳入源码变更。
- 说明：既有 `.codex/operations-log.md` 含无法按 UTF-8 解码的历史字节，无法安全使用补丁追加；本次记录写入本文件，避免重写历史日志。

