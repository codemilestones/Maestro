## ADDED Requirements

### Requirement: CLI 初始化命令
系统 SHALL 提供 `maestro init` 命令，在当前目录初始化 Maestro 配置。

#### Scenario: 首次初始化
- **WHEN** 用户在项目根目录执行 `maestro init`
- **THEN** 系统创建 `.maestro/` 目录，包含默认配置文件 `config.yaml`

#### Scenario: 自动检测默认分支
- **WHEN** 执行 `maestro init`
- **THEN** 系统自动检测 Git 仓库的默认分支（main/master）
- **AND** 将检测到的分支写入配置文件的 `worktree.defaultBase` 和 `pr.defaultBase`

#### Scenario: 显示检测结果
- **WHEN** 初始化完成
- **THEN** 显示检测到的默认分支名称

#### Scenario: 重复初始化
- **WHEN** 用户在已初始化的目录执行 `maestro init`
- **THEN** 系统提示配置已存在，除非使用 `--force` 标志

### Requirement: Agent 创建命令
系统 SHALL 提供 `maestro spawn <prompt>` 命令，创建新 Agent 执行任务。

#### Scenario: 创建带默认参数的 Agent
- **WHEN** 用户执行 `maestro spawn "实现用户登录功能"`
- **THEN** 系统创建新 Worktree、启动 Claude Code 进程、返回 Agent ID

#### Scenario: 创建带自定义分支的 Agent
- **WHEN** 用户执行 `maestro spawn "修复 bug" --branch feat/fix-bug --base develop`
- **THEN** 系统基于 `develop` 分支创建名为 `feat/fix-bug` 的 Worktree

#### Scenario: 创建带别名的 Agent
- **WHEN** 用户执行 `maestro spawn "任务描述" --name login-feature`
- **THEN** Agent 使用 `login-feature` 作为显示名称

### Requirement: 状态查询命令
系统 SHALL 提供 `maestro status` 命令，显示所有 Agent 状态。

#### Scenario: 查看状态列表
- **WHEN** 用户执行 `maestro status`
- **THEN** 系统以表格形式显示所有 Agent 的 ID、名称、状态、分支、运行时长

#### Scenario: JSON 格式输出
- **WHEN** 用户执行 `maestro status --json`
- **THEN** 系统输出 JSON 格式的状态数据

#### Scenario: 实时监控模式
- **WHEN** 用户执行 `maestro status --watch`
- **THEN** 系统持续刷新状态显示，直到用户中断

### Requirement: 会话附加命令
系统 SHALL 提供 `maestro attach` 命令，进入 TUI 界面或特定 Agent 会话。

#### Scenario: 进入 TUI 界面
- **WHEN** 用户执行 `maestro attach`
- **THEN** 系统进入全屏 TUI 界面，显示所有 Agent

#### Scenario: 直接附加到特定 Agent
- **WHEN** 用户执行 `maestro attach --agent <id>`
- **THEN** 系统直接进入该 Agent 的全屏会话

### Requirement: 日志查看命令
系统 SHALL 提供 `maestro logs <id>` 命令，查看 Agent 输出日志。

#### Scenario: 查看完整日志
- **WHEN** 用户执行 `maestro logs <agent-id>`
- **THEN** 系统显示该 Agent 的完整输出日志

#### Scenario: 实时跟踪日志
- **WHEN** 用户执行 `maestro logs <agent-id> --follow`
- **THEN** 系统持续输出新日志，直到用户中断

#### Scenario: 查看最近日志
- **WHEN** 用户执行 `maestro logs <agent-id> --tail 50`
- **THEN** 系统仅显示最后 50 行日志

### Requirement: Agent 终止命令
系统 SHALL 提供 `maestro kill <id>` 命令，终止运行中的 Agent。

#### Scenario: 优雅终止
- **WHEN** 用户执行 `maestro kill <agent-id>`
- **THEN** 系统发送 SIGTERM 信号，等待进程退出

#### Scenario: 强制终止
- **WHEN** 用户执行 `maestro kill <agent-id> --force`
- **THEN** 系统发送 SIGKILL 信号，立即终止进程

### Requirement: 清理命令
系统 SHALL 提供 `maestro cleanup` 命令，清理已完成的 Worktree。

#### Scenario: 清理所有已完成
- **WHEN** 用户执行 `maestro cleanup`
- **THEN** 系统删除所有状态为 `finished` 或 `failed` 的 Agent 对应的 Worktree

#### Scenario: 清理所有 Worktree
- **WHEN** 用户执行 `maestro cleanup --all`
- **THEN** 系统删除所有 Agent 的 Worktree（包括运行中的，需确认）

#### Scenario: 预览清理
- **WHEN** 用户执行 `maestro cleanup --dry-run`
- **THEN** 系统显示将被清理的 Worktree 列表，但不实际删除

### Requirement: 配置管理命令
系统 SHALL 提供 `maestro config` 命令，管理配置项。

#### Scenario: 获取配置值
- **WHEN** 用户执行 `maestro config --get agent.maxConcurrent`
- **THEN** 系统输出配置项的当前值

#### Scenario: 设置配置值
- **WHEN** 用户执行 `maestro config --set agent.maxConcurrent 10`
- **THEN** 系统更新配置文件中的对应值
