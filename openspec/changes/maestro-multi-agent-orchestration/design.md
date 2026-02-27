## Context

当前项目是全新开发，没有现有代码基础。目标是构建一个 CLI 工具 Maestro，让单个开发者能够并行管理多个 Claude Code 实例。核心约束：

- 必须保持人类作为唯一决策者（Human-in-the-loop）
- 避免 Agent 间自主通信的复杂性
- 以 Git Worktree 实现物理级隔离
- 以 PR 作为最终交付单元

## Goals / Non-Goals

**Goals:**
- 提供完整的 CLI 命令集管理多 Agent 生命周期
- 实现基于 Git Worktree 的任务隔离，杜绝文件冲突
- 提供类 Tmux 的 TUI 界面，支持会话切换和实时监控
- 自动生成带架构契约清单的 PR
- 支持状态持久化和故障恢复

**Non-Goals:**
- 不实现 Agent 间自主通信
- 不做深度代码 Diff 集成（交给 GitHub/IDE）
- 不支持多仓库编排（后续迭代）
- 不引入外部数据库（使用 JSON 文件存储）

## Decisions

### D1: 技术栈选型

| 层级 | 选择 | 备选方案 | 决策理由 |
|------|------|---------|---------|
| 语言 | TypeScript | Go, Rust | 与 Claude Code 同生态，类型安全，团队熟悉 |
| CLI 框架 | Commander.js | Yargs, Oclif | 成熟稳定，API 简洁，社区活跃 |
| TUI 框架 | Ink (React for CLI) | Blessed, Enquirer | 组件化开发，React 范式，状态管理友好 |
| 进程管理 | execa + child_process | PM2 | 轻量，无需守护进程，原生控制 |
| Git 操作 | simple-git | nodegit, isomorphic-git | 轻量封装，Promise API，维护活跃 |
| 状态存储 | lowdb (JSON) | SQLite, Level | 零依赖，人类可读，足够满足需求 |

### D2: 模块架构

采用分层模块架构，职责清晰：

```
src/
├── cli/          # 命令入口层 - 解析参数，路由命令
├── worktree/     # Worktree 管理层 - Git 隔离
├── agent/        # Agent 控制层 - 进程生命周期
├── tui/          # TUI 展示层 - 用户交互
├── pr/           # PR 生成层 - 交付自动化
└── shared/       # 共享工具 - 配置、日志、类型
```

### D3: Agent 状态机设计

选择显式状态机而非隐式状态标记：

```
PENDING → STARTING → RUNNING ⇄ WAITING_INPUT → FINISHED
                ↓                    ↓
              FAILED ←──────────────┘
```

理由：状态转换明确，便于 TUI 展示和故障诊断。

### D4: Claude Code 调用方式

使用 `--print --output-format stream-json` 模式：
- 非交互模式，便于程序解析
- JSON 流输出，实时获取状态
- 保留 `subtype: input_request` 检测用户输入需求

备选方案（直接 PTY）被否决：复杂度高，跨平台问题多。

### D5: TUI 布局策略

采用三区域布局：
1. **Agent 列表区**: 显示所有 Agent 状态
2. **预览区**: 选中 Agent 的实时输出
3. **状态栏**: 快捷键提示

支持全屏 Attach 模式，类似 `tmux attach`。

### D6: PR 生成策略

自动提取架构契约：
- 解析 `git diff` 获取文件变更
- 检测接口签名变化（TypeScript AST 分析可选）
- 检测 package.json 依赖变更

使用 `gh pr create` 而非 API：减少认证复杂度，利用用户已有配置。

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|---------|
| Claude Code 进程崩溃 | 自动重试机制（最多 2 次），详细日志记录 |
| Git Worktree 分支冲突 | 创建前检查分支是否存在，提示用户处理 |
| TUI 渲染性能问题 | 输出缓冲限制，虚拟滚动（如需要） |
| JSON 状态文件损坏 | 写入前备份，原子写入 |
| 用户误操作 kill | `--force` 标志区分，默认优雅终止 |

## Migration Plan

不适用 - 全新项目，无需迁移。

首次使用流程：
1. `npm install -g maestro-cli`
2. `cd <project> && maestro init`
3. `maestro spawn "实现功能 X"`

## Open Questions

1. **权限跳过**: 是否默认启用 `--dangerously-skip-permissions`？建议：配置项，默认关闭
2. **并发限制**: 最大并发 Agent 数是否需要动态调整？建议：配置项，默认 5
3. **日志保留策略**: 日志文件保留多久？建议：配置项，默认 7 天
