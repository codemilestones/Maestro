<p align="center">
  <img src="docs/images/maestro-logo.png" alt="Maestro Logo" width="120">
</p>

<h1 align="center">Maestro CLI</h1>

<p align="center">
  <img src="docs/images/maestro-concept.png" alt="Maestro - 人类指挥家指挥小龙虾乐队" width="600">
</p>

<p align="center">
  多 Agent 编排 CLI 工具 — 一位指挥，多个 Agent，协同演奏。
</p>

<p align="center">
  <a href="README.md">English</a>
</p>

## 概述

Maestro 采用 **Human-to-Agents 辐射式（Hub-Spoke）协作模型**，一个人类开发者作为中心节点，同时指挥多个 Claude Code Agent 并行工作。每个 Agent 在独立的 Git Worktree 中运行，确保物理隔离，避免代码冲突。

## 核心特性

- **Git Worktree 隔离** — 每个 Agent 在独立的 worktree 中工作，代码物理隔离
- **Human-in-the-Loop** — 开发者始终保持对所有 Agent 的完全控制
- **TUI 界面** — 类似 tmux 的多窗口终端界面，实时管理 Agent
- **PR 自动化** — 自动生成包含架构契约分析的 Pull Request
- **状态恢复** — 崩溃后自动恢复状态，持久化存储
- **Agent 生命周期** — 完整状态机（pending → running → finished/failed），支持自动重试

## 快速开始

### 安装

```bash
# 使用 npm
npm install -g maestro-cli

# 或从源码构建
git clone <repo>
cd Maestro
npm install
npm run build
npm link
```

### 1. 初始化项目

```bash
cd your-project
maestro init
```

这将创建 `.maestro/` 目录，包含配置文件和状态存储。

### 2. 创建 Agent

```bash
# 基本用法
maestro new -p "实现用户登录功能"

# 指定分支名
maestro new -p "修复 #123 bug" -b fix-123

# 继续已完成的 Agent，给予新提示
maestro continue <agent-id> -p "接着添加单元测试"
```

### 3. 查看状态

```bash
maestro status            # 查看所有 Agent 状态
maestro status --watch    # 实时监控
maestro status --json     # JSON 格式输出
```

### 4. 进入 TUI 界面

```bash
maestro attach
```

**TUI 快捷键：**

| 快捷键 | 功能 |
|--------|------|
| `↑/↓` 或 `j/k` | 上下选择 Agent |
| `1-9` | 按编号选择 Agent |
| `Enter` | 进入全屏会话 |
| `Esc` | 退出全屏 / 关闭弹窗 |
| `x` | 终止选中的 Agent |
| `r` | 刷新状态 |
| `?` | 显示帮助 |
| `q` | 退出 TUI |

### 5. 查看日志

```bash
maestro logs <agent-id>             # 查看 Agent 日志
maestro logs <agent-id> --follow    # 实时跟踪
maestro logs <agent-id> --tail 100  # 显示最后 100 行
```

### 6. 管理 Agent

```bash
maestro kill <agent-id>       # 终止 Agent
maestro cleanup               # 清理已完成的 worktree
maestro cleanup --dry-run     # 预览清理（不实际执行）
maestro pr <agent-id>         # 为已完成的 Agent 创建 PR
```

## 架构

### Agent 状态机

```
pending → starting → running ⇄ waiting_input
                   ↓
            finished / failed
```

### 项目结构

```
src/
├── cli/           # CLI 命令
│   ├── commands/  # 各子命令实现
│   └── index.ts   # 入口
├── agent/         # Agent 控制
│   ├── process/   # 进程管理
│   ├── output/    # 输出解析
│   └── state/     # 状态管理
├── worktree/      # Git Worktree 管理
├── tui/           # 终端 UI（React + Ink）
│   ├── components/
│   └── hooks/
├── pr/            # PR 自动化
│   ├── analyzers/ # 变更分析器
│   └── templates/ # PR 模板
├── state/         # 状态持久化
└── shared/        # 共享模块
```

### 运行时目录

```
.maestro/
├── config.yaml       # 配置文件
├── state/
│   ├── agents.json   # Agent 状态
│   └── worktrees.json
├── logs/
│   └── <agent-id>/   # Agent 日志
└── templates/
    └── pr-template.md
```

## 配置

配置文件位于 `.maestro/config.yaml`：

```bash
maestro config --list                        # 查看所有配置
maestro config --get agent.maxConcurrent     # 获取配置值
maestro config --set agent.maxConcurrent 10  # 设置配置值
```

主要配置项：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `worktree.defaultBase` | `main` | 默认基础分支 |
| `agent.maxConcurrent` | `5` | 最大并发 Agent 数 |
| `agent.defaultTimeout` | `1800000` | Agent 超时时间（毫秒） |
| `pr.draft` | `false` | 是否创建草稿 PR |
| `pr.contractAnalysis` | `true` | 是否启用架构契约分析 |

## 环境要求

- **Node.js** >= 18.0.0
- **Git** 仓库
- **Claude CLI** 已安装并配置

## 开发

```bash
npm install          # 安装依赖
npm run dev          # 开发模式
npm run build        # 构建
npm test             # 运行测试
npm run lint         # 代码检查
```

## License

MIT
