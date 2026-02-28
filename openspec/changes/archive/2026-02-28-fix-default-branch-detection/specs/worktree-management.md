## MODIFIED Requirements

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

### Requirement: Worktree 状态同步
系统 SHALL 支持同步 Worktree 状态。

#### Scenario: 无 Worktree 时同步
- **WHEN** 调用 sync() 且没有任何 Worktree 记录
- **THEN** 静默返回，不产生警告

#### Scenario: 状态文件不存在时同步
- **WHEN** 调用 sync() 且状态文件不存在
- **THEN** 静默返回，不产生警告
