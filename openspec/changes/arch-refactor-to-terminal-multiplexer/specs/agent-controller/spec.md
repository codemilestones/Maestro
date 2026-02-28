## MODIFIED Requirements

### Requirement: Agent process spawning
系统 SHALL 使用 PTY 而非 child_process 启动 Agent 进程，支持交互式会话。

#### Scenario: Spawn interactive agent
- **WHEN** 用户执行 `maestro spawn "实现登录功能"`
- **THEN** 系统使用 `node-pty` 启动工具适配器指定的命令
- **AND** 初始 prompt 通过 PTY stdin 发送
- **AND** 不使用 `--print` 或 `--output-format` 参数

#### Scenario: Agent continues after prompt
- **WHEN** Agent 处理完初始 prompt
- **THEN** Agent 进入空闲状态等待下一次输入
- **AND** 会话保持活跃，不自动退出

### Requirement: Agent status tracking
系统 SHALL 使用状态检测器而非 JSON 解析跟踪 Agent 状态。

#### Scenario: Status from PTY output
- **WHEN** PTY 产生输出
- **THEN** 输出被送入状态检测器
- **AND** 状态检测器推断并更新 Agent 状态

#### Scenario: Terminal state detection
- **WHEN** PTY 进程退出
- **THEN** 系统根据退出码设置终止状态
- **AND** exit code 0 = finished, 非零 = failed

### Requirement: Agent input handling
系统 SHALL 支持向运行中的 Agent 发送任意输入，而非仅限于特定事件响应。

#### Scenario: Send follow-up message
- **WHEN** 用户在 attach 模式下输入新的 prompt
- **THEN** 输入直接写入 PTY stdin
- **AND** Agent 处理该输入并产生响应

#### Scenario: Answer permission prompt
- **WHEN** Agent 状态为 waiting_input（权限确认）
- **THEN** 用户输入 `y` 或 `n`
- **AND** 输入写入 PTY，Agent 继续执行

### Requirement: Agent lifecycle events
系统 SHALL 发出与现有 API 兼容的生命周期事件。

#### Scenario: Status change event
- **WHEN** Agent 状态发生变更
- **THEN** 系统发出 `status_change` 事件
- **AND** 事件包含 `from` 和 `to` 状态

#### Scenario: Output event
- **WHEN** PTY 产生输出
- **THEN** 系统发出 `output` 事件
- **AND** 事件包含原始输出数据（含 ANSI 序列）
