# Maestro CLI

多 Agent 编排 CLI 工具，用于管理多个 Claude Code 实例并行工作。

## 概述

Maestro 采用 Human-to-Agents 的辐射式（Hub-Spoke）协作模型，一个人类开发者作为中心节点，同时指挥多个 Claude Code Agent。每个 Agent 在独立的 Git Worktree 中工作，确保物理隔离，避免代码冲突。

### 核心特性

- **Git Worktree 隔离**：每个 Agent 在独立的 worktree 中工作
- **Human-in-the-Loop**：人类保持对所有 Agent 的控制
- **TUI 界面**：类似 tmux 的多窗口管理界面
- **PR 自动化**：自动生成包含架构契约的 PR

## 安装

```bash
# 使用 npm
npm install -g maestro-cli

# 或者从源码构建
git clone <repo>
cd maestro
npm install
npm run build
npm link
```

## 快速开始

### 1. 初始化项目

```bash
cd your-project
maestro init
```

这将创建 `.maestro/` 目录，包含配置文件和状态存储。

### 2. 启动 Agent

```bash
# 基本用法
maestro spawn -p "实现用户登录功能"

# 指定分支名
maestro spawn -p "修复 #123 bug" -b fix-123

# 在后台运行
maestro spawn -p "添加单元测试" --background
```

### 3. 查看状态

```bash
# 查看所有 Agent 状态
maestro status

# 实时监控
maestro status --watch

# JSON 格式输出
maestro status --json
```

### 4. 进入 TUI 界面

```bash
maestro attach
```

### 5. 查看日志

```bash
# 查看指定 Agent 的日志
maestro logs <agent-id>

# 实时跟踪
maestro logs <agent-id> --follow

# 显示最后 100 行
maestro logs <agent-id> --tail 100
```

### 6. 管理 Agent

```bash
# 终止 Agent
maestro kill <agent-id>

# 清理已完成的 worktree
maestro cleanup

# 预览清理（不实际执行）
maestro cleanup --dry-run
```

## TUI 操作指南

进入 TUI 后的快捷键：

| 快捷键 | 功能 |
|--------|------|
| `↑/↓` 或 `j/k` | 上下选择 Agent |
| `1-9` | 按编号选择 Agent |
| `Enter` | 进入选中 Agent 的全屏会话 |
| `Esc` | 退出全屏会话 / 关闭弹窗 |
| `x` | 终止选中的 Agent |
| `r` | 刷新状态 |
| `?` | 显示帮助 |
| `q` | 退出 TUI |

> **注意**: 创建新 Agent、创建 PR、查看日志等操作请使用对应的 CLI 命令 (`maestro spawn`, `maestro pr`, `maestro logs`)。

## 配置

配置文件位于 `.maestro/config.yaml`：

```yaml
# Worktree 配置
worktree:
  baseDir: ./worktrees          # Worktree 存放目录
  defaultBase: main             # 默认基础分支
  branchPrefix: maestro/        # 分支前缀
  autoCleanup: true             # 自动清理已完成的 worktree
  cleanupDelay: 3600            # 清理延迟（秒）

# Agent 配置
agent:
  maxConcurrent: 5              # 最大并发 Agent 数
  defaultTimeout: 1800000       # 默认超时（毫秒）
  claudePath: claude            # Claude CLI 路径
  skipPermissions: false        # 是否跳过权限确认
  autoRetry: true               # 失败时自动重试
  maxRetries: 2                 # 最大重试次数

# PR 配置
pr:
  template: default             # PR 模板名称
  defaultBase: main             # PR 目标分支
  draft: false                  # 是否创建草稿 PR
  autoLabels: true              # 自动添加标签
  labelMapping:                 # 类型到标签的映射
    feat: enhancement
    fix: bug
    docs: documentation
  contractAnalysis: true        # 启用架构契约分析
```

### 配置命令

```bash
# 获取配置值
maestro config --get agent.maxConcurrent

# 设置配置值
maestro config --set agent.maxConcurrent 10

# 查看所有配置
maestro config --list
```

## 架构

```
.maestro/
├── config.yaml      # 配置文件
├── state/
│   ├── agents.json  # Agent 状态
│   └── worktrees.json # Worktree 状态
├── logs/
│   └── <agent-id>/  # Agent 日志
└── templates/
    └── pr-template.md # 自定义 PR 模板
```

## 状态机

Agent 的状态转换：

```
pending → starting → running ⇄ waiting_input
                   ↓
            finished / failed
```

- `pending`: 等待启动
- `starting`: 正在启动
- `running`: 正在执行
- `waiting_input`: 等待用户输入
- `finished`: 成功完成
- `failed`: 执行失败

## PR 自动化

Maestro 可以自动创建包含架构契约的 PR：

```bash
# Agent 完成后自动创建 PR（在 TUI 中操作）

# 或手动触发
maestro pr <agent-id>
```

PR 内容包含：
- 变更概述
- 修改的核心接口
- 新增的依赖
- 修改的文件列表
- Agent 执行摘要

## 状态恢复

Maestro 支持在意外退出后恢复状态：

```bash
# 检查和恢复状态
maestro recover

# 同时清理旧状态
maestro recover --cleanup

# 验证状态一致性
maestro recover --validate

# 执行日志维护
maestro recover --logs
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 运行测试
npm test

# 代码检查
npm run lint
```

## 目录结构

```
src/
├── cli/           # CLI 命令
│   ├── commands/  # 各子命令实现
│   └── index.ts   # 入口
├── worktree/      # Worktree 管理
├── agent/         # Agent 控制
│   ├── process/   # 进程管理
│   ├── output/    # 输出解析
│   └── state/     # 状态管理
├── tui/           # TUI 界面
│   ├── components/# React 组件
│   └── hooks/     # React Hooks
├── pr/            # PR 自动化
│   ├── analyzers/ # 变更分析器
│   └── templates/ # PR 模板
├── state/         # 状态持久化
└── shared/        # 共享模块
```

## 注意事项

1. **Git 仓库要求**：项目必须是一个 Git 仓库
2. **Claude CLI**：需要预先安装并配置 Claude CLI
3. **权限**：首次运行时 Claude 可能需要确认权限
4. **并发限制**：建议不超过 5 个并发 Agent

## License

MIT
