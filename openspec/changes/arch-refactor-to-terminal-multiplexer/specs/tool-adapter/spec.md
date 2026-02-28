## ADDED Requirements

### Requirement: ToolAdapter interface
系统 SHALL 定义统一的工具适配器接口，抽象不同 AI 工具的启动和交互协议。

#### Scenario: Adapter interface contract
- **WHEN** 开发者实现一个新的工具适配器
- **THEN** 适配器 MUST 实现以下方法：
  - `name: string` - 工具标识符
  - `spawn(options: SpawnOptions): PTYProcess` - 启动 PTY 进程
  - `detectStatus(output: string): AgentStatus` - 从输出推断状态
  - `getDefaultArgs(prompt: string): string[]` - 构建启动参数
  - `healthCheck(): Promise<boolean>` - 检测工具可用性

### Requirement: Built-in Claude Code adapter
系统 SHALL 提供内置的 Claude Code 适配器作为默认实现。

#### Scenario: Claude Code spawn
- **WHEN** 用户使用默认工具 spawn
- **THEN** 系统执行 `claude` 命令（交互模式，不带 `-p`）
- **AND** 初始 prompt 通过 stdin 发送

#### Scenario: Claude Code health check
- **WHEN** 系统启动时检查工具可用性
- **THEN** 执行 `claude --version` 验证安装
- **AND** 返回 true 如果命令成功执行

### Requirement: Adapter registry
系统 SHALL 维护已注册适配器的注册表，支持按名称查找。

#### Scenario: Register custom adapter
- **WHEN** 用户在配置文件中定义自定义工具
- **THEN** 系统加载并注册对应适配器
- **AND** 适配器可通过 `--tool <name>` 参数选择

#### Scenario: List available adapters
- **WHEN** 用户执行 `maestro config --list-tools`
- **THEN** 系统显示所有已注册的工具适配器
- **AND** 标记哪个是默认工具

### Requirement: Adapter configuration
系统 SHALL 支持通过配置文件自定义适配器参数。

#### Scenario: Configure tool command path
- **WHEN** 用户在 `.maestro/config.yaml` 中设置 `tools.claude-code.command: /custom/path/claude`
- **THEN** 系统使用指定路径启动 Claude Code

#### Scenario: Configure status patterns
- **WHEN** 用户定义自定义状态正则表达式
- **THEN** 适配器使用用户定义的模式进行状态检测
