## ADDED Requirements

### Requirement: AgentController 单元测试
系统 SHALL 具有 AgentController 的全面单元测试覆盖。

#### Scenario: 测试 spawn 创建 Agent
- **WHEN** 执行 `controller.spawn()` 测试
- **THEN** 验证 Agent 被创建、状态为 pending 或 running、PID 被记录

#### Scenario: 测试并发限制
- **WHEN** spawn 数量超过 maxConcurrent 配置
- **THEN** 额外的 Agent 进入 pending 状态，不立即启动

#### Scenario: 测试队列处理
- **WHEN** 运行中的 Agent 完成
- **THEN** pending 队列中的 Agent 自动启动

#### Scenario: 测试 kill 终止进程
- **WHEN** 执行 `controller.kill(id)`
- **THEN** 验证进程收到 SIGTERM，状态变为 failed

#### Scenario: 测试强制 kill
- **WHEN** 执行 `controller.kill(id, true)`
- **THEN** 验证进程收到 SIGKILL

#### Scenario: 测试 sendInput
- **WHEN** Agent 处于 waiting_input 状态，执行 `sendInput()`
- **THEN** 输入写入 stdin，状态变为 running

### Requirement: 进程 Mock 基础设施
系统 SHALL 提供进程 mock 工具用于测试。

#### Scenario: MockClaudeProcess 创建
- **WHEN** 测试需要模拟 Claude 进程
- **THEN** 可以创建 MockClaudeProcess 实例，支持模拟 stdout/stderr/exit

#### Scenario: 模拟 stdout 输出
- **WHEN** 调用 `mockProcess.emitStdout(data)`
- **THEN** 监听 stdout 的代码能收到该数据

#### Scenario: 模拟进程退出
- **WHEN** 调用 `mockProcess.exit(code)`
- **THEN** 触发 exit 事件，传递退出码

#### Scenario: 模拟进程错误
- **WHEN** 调用 `mockProcess.error(err)`
- **THEN** 触发 error 事件

### Requirement: 状态恢复测试
系统 SHALL 具有状态恢复逻辑的测试覆盖。

#### Scenario: 测试正常恢复
- **WHEN** agents.json 中有运行中的 Agent 且进程存在
- **THEN** 恢复后 Agent 仍为 running 状态

#### Scenario: 测试失败检测
- **WHEN** agents.json 中有运行中的 Agent 但进程不存在
- **THEN** 恢复后 Agent 变为 failed 状态

#### Scenario: 测试宽限期
- **WHEN** Agent 的 spawnedAt 在 5 秒内
- **THEN** 不执行进程存活检测

### Requirement: 状态持久化测试
系统 SHALL 具有 AgentStore 的读写测试。

#### Scenario: 测试保存和加载
- **WHEN** 执行 `store.saveAgent()` 后 `store.listAgents()`
- **THEN** 返回的 Agent 数据与保存时一致

#### Scenario: 测试原子写入
- **WHEN** 保存过程中模拟崩溃
- **THEN** agents.json 不会损坏（保留旧数据或完整新数据）

#### Scenario: 测试删除
- **WHEN** 执行 `store.deleteAgent(id)`
- **THEN** 该 Agent 不再出现在 listAgents 结果中
