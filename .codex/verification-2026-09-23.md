# 2026-09-23 倒班排班中号/大号美化验证报告

- 执行者：Codex。
- 需求覆盖：中号突出未来 7 天与今日班次，大号突出当前月份与今日状态，并保持原有排班数据、刷新策略和其他尺寸行为。
- 组件结构：改动集中在 `scripts/倒班排班/widget.tsx`；复用现有 `Widget.family` 分流、`PALETTE`、`ShapeStyle`、`modifiers` 和 `schedule.ts` 数据结构。
- 构建证据：`npm run build` 成功；包内仍包含 `index.tsx`、`schedule.ts`、`script.json`、`widget.tsx`；构建产物随后恢复。
- 静态证据：`schedule.ts` 严格类型检查、`git diff --check`、中号 7 列宽度计算和大号底部弹性空间检查通过。
- API依据：已读取本地 `scripting-app-development` 的 Widget、验证参考；本次未新增未经确认的 Scripting API。
- 遗留风险：未连接 Scripting App/iOS，不能把本地构建等同于真实 Widget Host 预览；需在设备端重点确认中号列是否完整、大号 5/6 周月份是否溢出、长班次文本是否截断合理。

