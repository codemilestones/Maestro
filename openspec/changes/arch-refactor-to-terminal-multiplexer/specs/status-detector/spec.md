## ADDED Requirements

### Requirement: Heuristic status detection
系统 SHALL 从 PTY 原始输出中启发式推断 Agent 状态，而非依赖结构化协议。

#### Scenario: Detect idle state
- **WHEN** PTY 输出匹配空闲提示符模式（如 `❯ ` 或 `> `）
- **THEN** 系统将 Agent 状态设置为 `idle`

#### Scenario: Detect running state
- **WHEN** PTY 输出包含 spinner 字符（如 ⠋⠙⠹⠸⠼⠴⠦⠧）
- **THEN** 系统将 Agent 状态设置为 `running`

#### Scenario: Detect waiting_input state
- **WHEN** PTY 输出包含权限确认提示（如 `(y/n)` 或 `[Y/n]`）
- **THEN** 系统将 Agent 状态设置为 `waiting_input`

### Requirement: StatusDetector interface
系统 SHALL 定义状态检测器接口，支持流式输入和状态变更通知。

#### Scenario: Feed output data
- **WHEN** PTY 产生新输出
- **THEN** 系统调用 `detector.feed(data)` 处理输出
- **AND** 检测器更新内部状态

#### Scenario: Status change callback
- **WHEN** 检测器推断出状态变更
- **THEN** 系统通过 `onStatusChange` 回调通知订阅者
- **AND** 回调包含新状态值

### Requirement: Pattern-based detection rules
系统 SHALL 支持基于正则表达式的检测规则配置。

#### Scenario: Custom idle pattern
- **WHEN** 用户定义自定义 idle 正则 `^\\$ $`
- **THEN** 检测器使用该模式判断 idle 状态

#### Scenario: Multiple pattern matching
- **WHEN** 输出同时匹配多个状态模式
- **THEN** 检测器按优先级选择：waiting_input > running > idle

### Requirement: Detection debouncing
系统 SHALL 对状态检测进行防抖处理，避免频繁状态切换。

#### Scenario: Debounce rapid transitions
- **WHEN** 检测器在 100ms 内检测到多次状态变更
- **THEN** 系统仅触发最终稳定状态的回调
- **AND** 中间状态被忽略

### Requirement: Manual status override
系统 SHALL 支持用户手动纠正错误的状态推断。

#### Scenario: Override detected status
- **WHEN** 用户执行 `maestro status <agent-id> --set running`
- **THEN** 系统强制设置 Agent 状态为 `running`
- **AND** 暂停自动检测 30 秒
