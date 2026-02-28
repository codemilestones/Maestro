## ADDED Requirements

### Requirement: Agent 归档能力
系统 SHALL 允许用户将已完成的 Agent 归档，从主列表隐藏但保留数据。

#### Scenario: 归档已完成的 Agent
- **WHEN** 用户选中一个状态为 finished 的 Agent 并按下 a 键
- **THEN** 该 Agent 被标记为已归档，从主列表中隐藏

#### Scenario: 归档已失败的 Agent
- **WHEN** 用户选中一个状态为 failed 的 Agent 并按下 a 键
- **THEN** 该 Agent 被标记为已归档，从主列表中隐藏

#### Scenario: 尝试归档运行中的 Agent
- **WHEN** 用户选中一个状态为 running/starting/waiting_input/pending 的 Agent 并按下 a 键
- **THEN** 操作被拒绝，Agent 保持不变

#### Scenario: 归档后列表更新
- **WHEN** Agent 被成功归档
- **THEN** Agent 列表立即刷新，选中项移动到相邻的 Agent

### Requirement: 归档数据保留
系统 SHALL 在归档 Agent 时保留所有数据。

#### Scenario: 归档标记持久化
- **WHEN** Agent 被归档
- **THEN** `.maestro/state/agents.json` 中该 Agent 的 `archived` 字段被设置为 `true`

#### Scenario: 日志文件保留
- **WHEN** Agent 被归档
- **THEN** `.maestro/logs/{agentId}.stdout.jsonl` 文件保持不变

### Requirement: AgentController 归档接口
AgentController SHALL 暴露归档方法供 TUI 调用。

#### Scenario: 调用归档方法
- **WHEN** 调用 `controller.archive(agentId)`
- **THEN** 将该 Agent 的 `archived` 字段设置为 `true` 并持久化

#### Scenario: 归档不存在的 Agent
- **WHEN** 调用 `controller.archive()` 传入不存在的 agentId
- **THEN** 方法静默返回，不抛出异常

### Requirement: 归档 Agent 列表过滤
系统 SHALL 在主列表中默认过滤掉已归档的 Agent。

#### Scenario: listAll 默认过滤
- **WHEN** 调用 `controller.listAll()`
- **THEN** 返回的列表不包含 `archived: true` 的 Agent

#### Scenario: 恢复时过滤归档 Agent
- **WHEN** TUI 重新启动并恢复 Agent
- **THEN** 主列表不显示已归档的 Agent
