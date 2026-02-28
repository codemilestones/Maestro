## MODIFIED Requirements

### Requirement: Agent 进程启动
系统 SHALL 支持启动 Claude Code 子进程执行任务，并确保进程状态正确跟踪。

#### Scenario: 正常启动
- **WHEN** 系统创建新 Agent
- **THEN** 系统使用 `claude --print --output-format stream-json --verbose -p <prompt>` 启动进程，工作目录为对应 Worktree

#### Scenario: 跳过权限确认
- **WHEN** 配置 `agent.skipPermissions` 为 true
- **THEN** 启动命令包含 `--dangerously-skip-permissions` 参数

#### Scenario: 设置超时
- **WHEN** 配置了 `agent.defaultTimeout`
- **THEN** 进程运行超过超时时间后自动终止

#### Scenario: 进程恢复宽限期
- **WHEN** Agent spawn 后 5 秒内执行状态恢复检查
- **THEN** 系统不将该 Agent 标记为 failed，即使进程检测暂时失败

#### Scenario: 进程恢复检测
- **WHEN** Agent spawn 超过 5 秒后执行状态恢复检查
- **THEN** 系统正常执行 `isProcessRunning(pid)` 检测，失败则标记为 failed

## ADDED Requirements

### Requirement: 进程存活检测时机
系统 SHALL 在进程恢复时考虑 spawn 时机，避免误判新启动的进程为失败。

#### Scenario: 新 spawn 的 Agent 不被误杀
- **WHEN** `AgentController` 实例化时有刚 spawn 的 Agent（spawnedAt < 5 秒前）
- **THEN** 跳过该 Agent 的进程存活检测

#### Scenario: 长时间运行的 Agent 正常检测
- **WHEN** `AgentController` 实例化时有运行中 Agent（spawnedAt > 5 秒前）
- **THEN** 执行进程存活检测，PID 不存在则标记为 failed

### Requirement: 输出流稳定性
系统 SHALL 确保 Agent 输出能稳定传输到订阅者。

#### Scenario: stdout 绑定验证
- **WHEN** Agent 进程启动成功
- **THEN** stdout 事件监听器正确绑定，数据能传输到 OutputParser

#### Scenario: JSON 解析失败降级
- **WHEN** stdout 输出非 JSON 格式内容
- **THEN** 系统将原始文本作为输出事件发送，不丢弃

#### Scenario: 空输出处理
- **WHEN** Agent 进程长时间无输出（> 10 秒）
- **THEN** TUI 显示 "等待输出..." 提示，不显示错误
