## ADDED Requirements

### Requirement: Worktree 创建
系统 SHALL 支持创建独立的 Git Worktree 用于 Agent 任务隔离。

#### Scenario: 创建默认 Worktree
- **WHEN** 系统需要为新 Agent 创建 Worktree
- **THEN** 系统执行 `git worktree add ./worktrees/<task-id> -b <branch-name> <base>` 并记录元信息
- **AND** 如果配置的 base 分支不存在，自动检测并使用仓库的默认分支

#### Scenario: 自动检测默认分支
- **WHEN** 配置的 `defaultBase` 分支不存在
- **THEN** 系统依次尝试：从 remote origin 获取 HEAD branch → 检查 main/master/develop 是否存在 → 使用当前分支
- **AND** 使用检测到的分支作为 base

#### Scenario: 指定基准分支
- **WHEN** 用户指定 `--base develop`
- **THEN** Worktree 基于 `develop` 分支而非默认的 `main`

#### Scenario: 分支已存在
- **WHEN** 目标分支名已存在
- **THEN** 系统报错并提示用户选择其他分支名或删除已有分支

### Requirement: Worktree 删除
系统 SHALL 支持删除不再需要的 Worktree。

#### Scenario: 正常删除
- **WHEN** Agent 已停止且用户请求清理
- **THEN** 系统执行 `git worktree remove ./worktrees/<task-id>` 并清理元信息记录

#### Scenario: 强制删除
- **WHEN** 用户使用 `--force` 标志
- **THEN** 系统即使 Worktree 有未提交更改也执行删除

#### Scenario: 删除远程分支
- **WHEN** 用户使用 `--delete-remote` 标志
- **THEN** 系统同时执行 `git push origin --delete <branch>` 删除远程分支

### Requirement: Worktree 列表
系统 SHALL 提供查询所有 Worktree 信息的能力。

#### Scenario: 列出所有 Worktree
- **WHEN** 系统查询 Worktree 列表
- **THEN** 返回包含 ID、路径、分支、基准分支、创建时间、状态的列表

### Requirement: Worktree 路径管理
系统 SHALL 使用可配置的目录存放 Worktree。

#### Scenario: 使用默认路径
- **WHEN** 未配置 `worktree.baseDir`
- **THEN** Worktree 创建在 `./worktrees/` 目录下

#### Scenario: 使用自定义路径
- **WHEN** 配置 `worktree.baseDir` 为 `/tmp/maestro-worktrees`
- **THEN** Worktree 创建在 `/tmp/maestro-worktrees/` 目录下

### Requirement: 分支命名规范
系统 SHALL 使用统一的分支命名前缀。

#### Scenario: 自动添加前缀
- **WHEN** 用户未指定完整分支名
- **THEN** 系统自动添加 `maestro/` 前缀（如 `maestro/task-001`）

#### Scenario: 用户指定完整分支名
- **WHEN** 用户通过 `--branch` 指定完整分支名
- **THEN** 系统使用用户指定的分支名，不添加前缀

### Requirement: Worktree 状态同步
系统 SHALL 支持同步 Worktree 状态。

#### Scenario: 无 Worktree 时同步
- **WHEN** 调用 sync() 且没有任何 Worktree 记录
- **THEN** 静默返回，不产生警告

#### Scenario: 状态文件不存在时同步
- **WHEN** 调用 sync() 且状态文件不存在
- **THEN** 静默返回，不产生警告
