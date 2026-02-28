## MODIFIED Requirements

### Requirement: Preview panel rendering
系统 SHALL 将 Preview 面板从日志文本渲染改为终端输出缓冲区渲染。

#### Scenario: Render PTY buffer in preview
- **WHEN** 用户在列表中选中一个 Agent
- **THEN** Preview 面板显示该 Agent 的 PTY 输出缓冲区
- **AND** 保留 ANSI 颜色和基本格式

#### Scenario: Real-time preview update
- **WHEN** 选中的 Agent PTY 产生新输出
- **THEN** Preview 面板实时更新
- **AND** 自动滚动到最新输出

### Requirement: Attach mode transition
系统 SHALL 支持从列表视图无缝切换到全屏 attach 模式。

#### Scenario: Enter attach mode from TUI
- **WHEN** 用户在选中 Agent 时按 Enter 键
- **THEN** TUI 暂停渲染
- **AND** 系统进入全屏 PTY attach 模式

#### Scenario: Return to TUI from attach
- **WHEN** 用户在 attach 模式下按 `Ctrl+]`（Prefix Key）
- **THEN** 系统退出全屏模式
- **AND** TUI 恢复渲染并刷新状态

### Requirement: Status indicator display
系统 SHALL 在列表中显示基于启发式检测的 Agent 状态。

#### Scenario: Show detected status
- **WHEN** 状态检测器更新 Agent 状态
- **THEN** TUI 列表中对应 Agent 的状态指示器更新
- **AND** 使用颜色区分：idle=绿色, running=蓝色, waiting_input=黄色

#### Scenario: Show attach indicator
- **WHEN** 一个 Agent 正在被 attach
- **THEN** 列表中显示 `[attached]` 标记

### Requirement: Tool selector
系统 SHALL 在 spawn 界面支持选择使用的 AI 工具。

#### Scenario: Select tool on spawn
- **WHEN** 用户打开 spawn 对话框
- **THEN** 显示已注册工具列表（来自配置）
- **AND** 默认选中 `defaultTool`

#### Scenario: Show tool in agent list
- **WHEN** Agent 列表显示时
- **THEN** 每个 Agent 显示其使用的工具名称
- **AND** 不同工具可使用不同图标区分
