## ADDED Requirements

### Requirement: Agent 进程启动
系统 SHALL 支持启动 Claude Code 子进程执行任务。

#### Scenario: 正常启动
- **WHEN** 系统创建新 Agent
- **THEN** 系统使用 `claude --print --output-format stream-json --verbose -p <prompt>` 启动进程，工作目录为对应 Worktree

#### Scenario: 跳过权限确认
- **WHEN** 配置 `agent.skipPermissions` 为 true
- **THEN** 启动命令包含 `--dangerously-skip-permissions` 参数

#### Scenario: 设置超时
- **WHEN** 配置了 `agent.defaultTimeout`
- **THEN** 进程运行超过超时时间后自动终止

### Requirement: Agent 状态机
系统 SHALL 维护每个 Agent 的状态机，状态包括 pending、starting、running、waiting_input、finished、failed。

#### Scenario: 状态转换 - 正常流程
- **WHEN** Agent 依次经历启动、运行、完成
- **THEN** 状态依次变为 pending → starting → running → finished

#### Scenario: 状态转换 - 等待输入
- **WHEN** Claude Code 输出包含 `subtype: input_request`
- **THEN** 状态变为 waiting_input

#### Scenario: 状态转换 - 用户响应
- **WHEN** 用户通过 TUI 或命令行提供输入
- **THEN** 状态从 waiting_input 变回 running

#### Scenario: 状态转换 - 失败
- **WHEN** 进程异常退出或超时
- **THEN** 状态变为 failed，记录错误信息

### Requirement: 输出流解析
系统 SHALL 解析 Claude Code 的 JSON 流输出。

#### Scenario: 解析 assistant 消息
- **WHEN** 收到 `type: assistant` 的输出
- **THEN** 提取 message.content 作为 Agent 输出

#### Scenario: 解析工具调用
- **WHEN** 收到包含 `tool_use` 的输出
- **THEN** 记录工具名称和参数到 Agent metrics

#### Scenario: 检测输入请求
- **WHEN** 收到 `subtype: input_request`
- **THEN** 触发状态变更和用户通知

### Requirement: Agent 终止控制
系统 SHALL 支持优雅和强制终止 Agent。

#### Scenario: 优雅终止
- **WHEN** 调用 kill(id) 不带 force 参数
- **THEN** 发送 SIGTERM，等待最多 10 秒，记录最终状态

#### Scenario: 强制终止
- **WHEN** 调用 kill(id, force=true)
- **THEN** 直接发送 SIGKILL，状态变为 failed

### Requirement: 输入传递
系统 SHALL 支持向等待输入的 Agent 发送用户响应。

#### Scenario: 发送输入
- **WHEN** Agent 处于 waiting_input 状态且用户提供输入
- **THEN** 系统将输入写入 Agent 进程的 stdin

#### Scenario: 非等待状态发送输入
- **WHEN** Agent 不在 waiting_input 状态时尝试发送输入
- **THEN** 系统返回错误提示

### Requirement: 并发限制
系统 SHALL 限制同时运行的 Agent 数量。

#### Scenario: 达到并发上限
- **WHEN** 运行中的 Agent 数达到 `agent.maxConcurrent`
- **THEN** 新创建的 Agent 进入 pending 状态排队

#### Scenario: 有空位时自动启动
- **WHEN** 运行中 Agent 完成或失败，且有 pending Agent
- **THEN** 自动启动队列中的下一个 Agent

### Requirement: Agent 指标收集
系统 SHALL 收集每个 Agent 的运行指标。

#### Scenario: 记录基础指标
- **WHEN** Agent 运行过程中
- **THEN** 系统持续更新 tokensUsed、toolCalls、filesModified、duration

#### Scenario: 最终指标
- **WHEN** Agent 完成或失败
- **THEN** 指标包含完整的运行时长和资源消耗统计
