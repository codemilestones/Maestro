## Why

Agent 执行完成后，Preview 框和详情页（Attached Mode）都无法显示任何内容，用户无法查看已完成 Agent 的输出结果。此外，Agent 列表会随着使用不断增长，用户无法清理历史 Agent，导致列表越来越长难以管理。

## What Changes

- **修复 Preview 输出显示**：确保已完成（finished/failed）状态的 Agent 也能正确加载和显示其历史输出
- **修复 Attached Mode 输出显示**：确保进入详情模式后能正确显示 Agent 的完整输出历史
- **新增归档 Agent 功能**：允许用户通过快捷键将已完成的 Agent 归档，从主列表中隐藏但保留数据

## Capabilities

### New Capabilities
- `agent-archive`: 提供归档 Agent 的能力，归档后的 Agent 从主列表隐藏但数据保留

### Modified Capabilities
- `tui-interface`: 新增归档快捷键（a 键），并修复 Preview 区和 Attached Mode 的输出显示逻辑

## Impact

- **代码影响**:
  - `src/tui/App.tsx`: 添加归档快捷键处理逻辑
  - `src/tui/hooks/useOutput.ts`: 修复已完成 Agent 输出加载逻辑
  - `src/tui/hooks/useAgents.ts`: 过滤掉已归档的 Agent
  - `src/tui/components/HelpModal.tsx`: 更新帮助信息
  - `src/agent/AgentController.ts`: 暴露归档方法给 TUI 调用
  - `src/shared/types.ts`: 在 AgentInfo 中添加 archived 字段
- **数据影响**: 归档操作在 `agents.json` 中标记 `archived: true`，数据保留
- **用户体验**: 用户可以管理 Agent 列表长度，保持界面整洁，同时保留历史记录
