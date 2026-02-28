## Context

当前 TUI 存在两个核心问题：

1. **Preview 输出为空问题**：已完成的 Agent 在 TUI 中 Preview 框和 Attached Mode 都显示为空。根因是 `getOutput()` 只返回内存中的 `outputBuffer`，但恢复的 Agent（包括已完成的）其 `outputBuffer` 被初始化为空数组，不会从持久化的 stdout 日志文件加载历史输出。

2. **缺少归档功能**：Agent 列表会无限增长，用户无法整理已完成的任务。需要归档功能将已完成的 Agent 从主列表隐藏。

关键代码路径：
- 输出加载：`useOutput` hook → `controller.getOutput()` → `managedAgent.outputBuffer`（空）
- 输出持久化：日志保存在 `.maestro/logs/{agentId}.stdout.jsonl`
- Agent 列表：`useAgents` hook → `controller.listAll()` → 返回所有 Agent

## Goals / Non-Goals

**Goals:**
- 已完成 Agent 的 Preview 和 Attached Mode 能正确显示历史输出
- 用户可以通过快捷键归档已完成的 Agent
- 归档后的 Agent 从主列表隐藏，但数据保留

**Non-Goals:**
- 查看已归档 Agent 的功能（后续可加）
- 取消归档功能（后续可加）
- 批量归档功能

## Decisions

### Decision 1: 从 stdout 日志加载历史输出

**选择**：在 `AgentController.getOutput()` 中，如果 `outputBuffer` 为空且是 terminal state，则从 `.maestro/logs/{id}.stdout.jsonl` 加载并解析。

**备选方案**：
- A) 在 `restoreAgents()` 时预加载所有输出 → 内存占用过大
- B) 创建独立的输出存储文件 → 需要额外的持久化逻辑
- C) 按需从日志文件加载（选择此方案）→ 简单且内存高效

**理由**：按需加载避免了启动时的内存压力，且日志文件已经存在，只需要解析 JSONL 格式提取 message 内容。

### Decision 2: 归档快捷键选择 'a'

**选择**：使用 `a` 键触发归档。

**备选方案**：
- `d` 键 → 暗示 delete，不符合归档语义
- `a` 键 → archive 的首字母，直观

**理由**：'a' for archive 是直观的选择，且未被其他功能占用。

### Decision 3: 归档实现方式

**选择**：在 AgentInfo 中添加 `archived: boolean` 字段，归档时设置为 true。

**备选方案**：
- A) 新增 archived 状态到 AgentStatus → 会改变状态机逻辑
- B) 添加 archived 字段（选择此方案）→ 与状态正交，简单
- C) 移动到单独的归档文件 → 增加复杂度

**理由**：archived 是一个与 status 正交的属性，不应该混入状态机。简单的 boolean 字段足够。

### Decision 4: 归档范围

**选择**：只允许归档 terminal state 的 Agent（finished/failed）。

**理由**：运行中的 Agent 不应被归档，这与 kill 操作逻辑一致。

### Decision 5: 列表过滤

**选择**：在 `listAll()` 中默认过滤掉 `archived: true` 的 Agent。

**理由**：保持 API 向后兼容，主列表只显示活跃 Agent。

## Risks / Trade-offs

**[从日志解析输出可能较慢]** → 对于大日志文件，解析可能耗时。Mitigation: 限制最多加载最后 100 行。

**[无法查看归档 Agent]** → 暂时无法在 TUI 中查看已归档的历史。Mitigation: 数据保留，后续可添加归档列表视图。

**[日志文件格式依赖]** → 依赖 JSONL 格式中的 `type: "assistant"` 事件。Mitigation: 添加健壮的错误处理。
