## Why

当前单个开发者与 Claude Code 的协作是 1:1 模式，无法充分利用 AI 的并行能力。我们需要一个 CLI 编排工具，让单个人类开发者能够同时管理多个 Claude Code 实例，通过 Git Worktree 实现物理隔离，以 PR 为单位交付成果，极大提升人机协作效率。

## What Changes

- 新增 `maestro` CLI 工具，提供完整的多 Agent 编排能力
- 新增基于 Git Worktree 的任务隔离机制
- 新增 Claude Code 进程生命周期管理
- 新增类 Tmux 的 TUI 会话管理界面
- 新增自动化 PR 生成与架构契约清单

## Capabilities

### New Capabilities

- `cli-commands`: CLI 命令入口，包括 init、spawn、status、attach、logs、kill、cleanup、config 等命令
- `worktree-management`: Git Worktree 生命周期管理，创建/删除/列表/状态查询
- `agent-controller`: Claude Code 子进程控制，启动/监控/终止/状态机管理
- `tui-interface`: 基于 Ink 的交互式终端界面，多 Agent 状态面板与会话切换
- `pr-automation`: PR 自动生成，包含架构契约清单、变更分析、模板填充
- `state-persistence`: 状态持久化，Agent 和 Worktree 元信息存储与恢复

### Modified Capabilities

(无现有能力需要修改 - 这是全新项目)

## Impact

- **代码**: 新建 `src/` 目录，包含 cli、worktree、agent、tui、pr 等模块
- **依赖**: 引入 Commander.js、Ink、simple-git、execa、lowdb 等 npm 包
- **配置**: 新增 `.maestro/` 目录存储配置、状态和日志
- **外部系统**: 依赖 Git、GitHub CLI (gh)、Claude Code CLI
