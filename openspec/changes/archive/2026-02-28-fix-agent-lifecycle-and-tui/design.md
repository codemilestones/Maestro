## Context

Maestro 是一个 CLI 工具，用于管理多个 Claude Code Agent 的并发执行。当前实现存在以下问题：

**当前架构**:
- `AgentController` 管理所有 Agent 的生命周期
- Agent 状态存储在 `.maestro/state/agents.json`
- TUI 使用 Ink (React for CLI) 构建
- 进程使用 execa 库 spawn

**已知问题**:
1. Agent spawn 后立即被标记为 failed（进程存活检测时机问题）
2. TUI 中 x 键行为不符合预期（应 kill agent，实际可能有其他行为）
3. 输出一直显示 "Waiting for output..."（事件订阅或 stdout 处理问题）
4. 退出 TUI 后 Agent 状态丢失

**约束**:
- 必须保持向后兼容，不破坏现有 CLI 命令
- 测试必须可以独立运行，不依赖真实 Claude Code 进程

## Goals / Non-Goals

**Goals:**
- 修复 Agent spawn 后立即失败的问题
- 确保 TUI 键盘快捷键行为符合 README 文档描述
- 修复输出显示问题，确保 stdout 能正确流式传输到 TUI
- 增加关键模块的单元测试覆盖率到 80%+
- 所有修复都有对应的回归测试

**Non-Goals:**
- 重构整体架构
- 添加新功能（如多 Agent 批量操作）
- 修改 CLI 命令接口
- 支持其他 AI 模型

## Decisions

### 1. 进程存活检测时机修复

**问题分析**：`restoreAgents()` 在构造函数中同步调用，可能在 spawn 异步完成前就检测进程状态。

**决策**：将进程存活检测与恢复逻辑分离
- 新增 `isNewlySpawned` 标记，spawn 后 5 秒内不进行存活检测
- 或者：只在 CLI `status`/`recover` 命令时调用恢复逻辑，不在 controller 构造时

**替代方案**：
- A) 延迟 restoreAgents 调用 - 简单但不优雅
- B) 添加 spawn 时间戳检查 - 选择此方案，更精确

**实现**：在 `AgentInfo` 中添加 `spawnedAt` 时间戳，恢复时检查距离 spawn 是否超过 grace period（5秒）

### 2. TUI 键盘事件处理验证

**问题分析**：代码审查显示 x 键处理逻辑是正确的（调用 `controller.kill()`）。需要验证：
- `kill()` 是否正确执行
- 是否有其他代码拦截了 x 键

**决策**：添加日志和测试来验证 x 键流程
- 在 `useKeyboard` hook 中添加 debug 日志
- 验证 `controller.kill()` 是否成功调用

### 3. 输出流处理修复

**问题分析**：`useOutput` hook 订阅 `output` 事件，但 `onMessage` 回调可能未被触发。可能原因：
- stdout 未正确 pipe
- OutputParser 的 JSON 解析失败（Claude Code 输出格式变化）
- 事件订阅时机问题

**决策**：
- 在 `OutputParser` 中添加更详细的日志
- 添加原始 stdout 输出的备用显示（如果 JSON 解析失败）
- 在 `AgentController.startAgent()` 中验证 stdout 绑定

### 4. 状态持久化验证

**问题分析**：当前 `AgentStore.saveAgent()` 使用原子写入（.tmp + rename），理论上不会丢失数据。需要验证 TUI 退出时是否触发了清理逻辑。

**决策**：
- 确保 TUI 退出（q 键或 Esc）不会清除 Agent 状态
- 添加 `AgentStore` 的读写测试

### 5. 测试策略

**决策**：使用 mock 而非真实进程进行测试

**测试分层**：
```
单元测试:
  - AgentStateMachine (已有)
  - OutputParser (已有)
  - AgentController (新增 - mock spawner)
  - AgentStore (新增)

集成测试:
  - spawn → status → kill 流程 (mock Claude process)
  - TUI 组件键盘交互 (使用 ink-testing-library)
```

**Mock 策略**：
- 创建 `MockClaudeProcess` 类，模拟 stdout/stderr/exit 事件
- 使用 dependency injection 替换 `spawnClaude` 函数

## Risks / Trade-offs

**[Risk] Mock 测试可能与真实行为不一致**
→ 使用录制的真实 Claude Code 输出作为 mock 数据；保留少量端到端测试

**[Risk] Grace period (5秒) 可能不够长**
→ 使其可配置；记录 spawn 到 running 的实际耗时

**[Risk] TUI 测试可能不稳定**
→ 使用 ink-testing-library 的确定性渲染；避免依赖时间的断言

**[Trade-off] 添加日志会增加输出噪音**
→ 使用 DEBUG 级别，生产环境默认关闭

## Migration Plan

1. **Phase 1: 诊断和修复核心问题**
   - 添加诊断日志
   - 修复进程存活检测时机
   - 验证修复效果

2. **Phase 2: 添加测试覆盖**
   - 创建 mock 基础设施
   - 编写 AgentController 测试
   - 编写 TUI 组件测试

3. **Rollback**：所有改动都是 bug fix，回滚只需 revert commit
