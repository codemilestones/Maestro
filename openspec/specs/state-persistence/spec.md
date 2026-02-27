## ADDED Requirements

### Requirement: Agent 状态持久化
系统 SHALL 将 Agent 状态持久化到本地文件。

#### Scenario: 保存状态
- **WHEN** Agent 状态变更
- **THEN** 立即将状态写入 `.maestro/state/agents.json`

#### Scenario: 状态文件格式
- **WHEN** 写入状态文件
- **THEN** 包含版本号和所有 Agent 的完整信息（id、name、prompt、status、metrics 等）

#### Scenario: 原子写入
- **WHEN** 写入状态文件
- **THEN** 先写入临时文件再重命名，防止写入中断导致损坏

### Requirement: Worktree 元信息持久化
系统 SHALL 将 Worktree 元信息持久化到本地文件。

#### Scenario: 保存元信息
- **WHEN** Worktree 创建或删除
- **THEN** 更新 `.maestro/state/worktrees.json`

#### Scenario: 元信息内容
- **WHEN** 写入 Worktree 元信息
- **THEN** 包含 id、path、branch、baseBranch、createdAt、status

### Requirement: 状态恢复
系统 SHALL 支持从持久化文件恢复状态。

#### Scenario: 启动时恢复
- **WHEN** Maestro 启动
- **THEN** 读取 `.maestro/state/` 下的状态文件，恢复 Agent 和 Worktree 信息

#### Scenario: 进程恢复检测
- **WHEN** 恢复的 Agent 状态为 running 但进程已不存在
- **THEN** 将状态更新为 failed，记录 "进程意外终止"

### Requirement: 日志记录
系统 SHALL 记录 Agent 输出和系统日志。

#### Scenario: Agent 输出日志
- **WHEN** Agent 产生输出
- **THEN** 写入 `.maestro/logs/{agent-id}.log`

#### Scenario: 系统日志
- **WHEN** Maestro 执行操作
- **THEN** 关键操作记录到 `.maestro/logs/maestro.log`

#### Scenario: 日志轮转
- **WHEN** 日志文件超过配置的大小或时间限制
- **THEN** 自动轮转旧日志

### Requirement: 配置管理
系统 SHALL 支持通过 YAML 文件管理配置。

#### Scenario: 读取配置
- **WHEN** Maestro 启动或执行命令
- **THEN** 从 `.maestro/config.yaml` 读取配置

#### Scenario: 默认配置
- **WHEN** 配置项未设置
- **THEN** 使用内置默认值（如 maxConcurrent=5, defaultTimeout=1800000）

#### Scenario: 配置项列表
- **WHEN** 用户查询可用配置
- **THEN** 系统返回所有支持的配置项及其说明

### Requirement: 目录结构
系统 SHALL 使用规范的 `.maestro/` 目录结构。

#### Scenario: 初始化目录结构
- **WHEN** 执行 `maestro init`
- **THEN** 创建 `.maestro/` 及子目录 `state/`、`logs/`、`templates/`

#### Scenario: 目录权限
- **WHEN** 创建 `.maestro/` 目录
- **THEN** 目录权限为 700，防止其他用户访问
