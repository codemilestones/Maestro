## Why

Agent 生命周期管理存在严重问题：spawn 创建的 Agent 立即被标记为 failed，TUI 交互行为不符合预期（x 键退出 TUI 而非 kill agent），输出不显示，状态无法持久化。这些问题导致 Maestro 基本不可用，需要紧急修复并增加测试覆盖。

## What Changes

**Agent 进程管理修复**:
- 修复 Agent spawn 后进程立即被标记为 failed 的问题
- 调查 `isProcessRunning()` 检查与实际进程状态的不一致
- 修复 `recovery.ts` 和 `AgentController.ts` 中的进程存活检测逻辑
- 确保进程 PID 正确记录和跟踪

**TUI 交互修复**:
- 修复 x 键行为：应该 kill 选中的 agent 而不是退出 TUI
- 修复输出显示：解决 "Waiting for output..." 一直不更新的问题
- 添加点击事件支持：点击 Agent 应展示详情
- 修复状态持久化：退出 TUI 后 agent 状态应保留

**测试覆盖增强**:
- 为 `AgentController` 添加单元测试（spawn、kill、sendInput、状态转换）
- 为状态持久化添加测试（save/load、恢复机制）
- 为进程生命周期添加集成测试
- 为 TUI 组件添加基本测试

## Capabilities

### New Capabilities
- `agent-lifecycle-tests`: AgentController 和进程管理的单元测试覆盖
- `tui-interaction-tests`: TUI 组件交互测试

### Modified Capabilities
- `agent-management`: 修复进程 spawn 和状态跟踪的核心逻辑
- `tui-interface`: 修复键盘快捷键行为和输出显示

## Impact

**代码影响**:
- `src/agent/AgentController.ts` - 进程管理和状态跟踪逻辑
- `src/agent/process/spawner.ts` - 进程 spawn 和存活检测
- `src/state/recovery.ts` - 状态恢复逻辑
- `src/tui/App.tsx` - 键盘快捷键处理
- `src/tui/hooks/useOutput.ts` - 输出订阅和显示
- `src/tui/hooks/useAgents.ts` - Agent 状态刷新
- `src/tui/components/AgentList.tsx` - 点击事件处理

**测试影响**:
- 新增 `tests/agent/controller.test.ts`
- 新增 `tests/agent/spawner.test.ts`
- 新增 `tests/state/recovery.test.ts`
- 新增 `tests/tui/` 目录

**依赖**:
- 可能需要添加测试工具库（如 mock 进程、mock stdin/stdout）
