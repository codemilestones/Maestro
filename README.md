<p align="center">
  <img src="docs/images/maestro-logo.png" alt="Maestro Logo" width="120">
</p>

<h1 align="center">Maestro CLI</h1>

<p align="center">
  <img src="docs/images/maestro-concept.png" alt="Maestro - A human conductor directing a crawfish orchestra" width="600">
</p>

<p align="center">
  Multi-Agent orchestration CLI for Claude Code — one human, many agents, working in harmony.
</p>

<p align="center">
  <a href="README_CN.md">中文文档</a>
</p>

## Overview

Maestro implements a **Human-to-Agents hub-spoke collaboration model**, where a single developer acts as the central conductor, orchestrating multiple Claude Code agents working in parallel. Each agent operates in an isolated Git Worktree, preventing code conflicts and enabling true concurrent development.

## Core Features

- **Git Worktree Isolation** — Each agent works in its own worktree, ensuring physical code separation
- **Human-in-the-Loop** — The developer maintains full control over all agents at all times
- **TUI Interface** — A tmux-like multi-window terminal UI for real-time agent management
- **PR Automation** — Auto-generated pull requests with architecture contract analysis
- **State Recovery** — Crash-resilient state persistence with automatic recovery
- **Agent Lifecycle** — Full state machine (pending → running → finished/failed) with retry support

## Quick Start

### Installation

```bash
# Via npm
npm install -g maestro-cli

# Or build from source
git clone <repo>
cd Maestro
npm install
npm run build
npm link
```

### 1. Initialize

```bash
cd your-project
maestro init
```

This creates a `.maestro/` directory with configuration and state storage.

### 2. Create an Agent

```bash
# Basic usage
maestro new -p "Implement user login"

# With a custom branch name
maestro new -p "Fix bug #123" -b fix-123

# Continue a finished agent with a new prompt
maestro continue <agent-id> -p "Now add unit tests"
```

### 3. Check Status

```bash
maestro status            # View all agents
maestro status --watch    # Real-time monitoring
maestro status --json     # JSON output
```

### 4. Enter TUI

```bash
maestro attach
```

**TUI Keyboard Shortcuts:**

| Key | Action |
|-----|--------|
| `↑/↓` or `j/k` | Navigate agents |
| `1-9` | Select agent by number |
| `Enter` | Enter fullscreen session |
| `Esc` | Exit fullscreen / close popup |
| `x` | Kill selected agent |
| `r` | Refresh status |
| `?` | Show help |
| `q` | Quit TUI |

### 5. View Logs

```bash
maestro logs <agent-id>             # View agent logs
maestro logs <agent-id> --follow    # Stream in real-time
maestro logs <agent-id> --tail 100  # Last 100 lines
```

### 6. Manage Agents

```bash
maestro kill <agent-id>       # Terminate an agent
maestro cleanup               # Clean up completed worktrees
maestro cleanup --dry-run     # Preview cleanup
maestro pr <agent-id>         # Create PR for completed agent
```

## Architecture

### Agent State Machine

```
pending → starting → running ⇄ waiting_input
                   ↓
            finished / failed
```

### Project Structure

```
src/
├── cli/           # CLI commands
│   ├── commands/  # Subcommand implementations
│   └── index.ts   # Entry point
├── agent/         # Agent control
│   ├── process/   # Process management
│   ├── output/    # Output parsing
│   └── state/     # State management
├── worktree/      # Git worktree management
├── tui/           # Terminal UI (React + Ink)
│   ├── components/
│   └── hooks/
├── pr/            # PR automation
│   ├── analyzers/ # Change analyzers
│   └── templates/ # PR templates
├── state/         # State persistence
└── shared/        # Shared utilities
```

### Runtime Directory

```
.maestro/
├── config.yaml       # Configuration
├── state/
│   ├── agents.json   # Agent states
│   └── worktrees.json
├── logs/
│   └── <agent-id>/   # Per-agent logs
└── templates/
    └── pr-template.md
```

## Configuration

Configuration lives in `.maestro/config.yaml`:

```bash
maestro config --list                        # View all
maestro config --get agent.maxConcurrent     # Get a value
maestro config --set agent.maxConcurrent 10  # Set a value
```

Key settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `worktree.defaultBase` | `main` | Default base branch |
| `agent.maxConcurrent` | `5` | Max parallel agents |
| `agent.defaultTimeout` | `1800000` | Agent timeout (ms) |
| `pr.draft` | `false` | Create draft PRs |
| `pr.contractAnalysis` | `true` | Architecture analysis in PRs |

## Requirements

- **Node.js** >= 18.0.0
- **Git** repository
- **Claude CLI** installed and configured

## Development

```bash
npm install          # Install dependencies
npm run dev          # Watch mode
npm run build        # Build
npm test             # Run tests
npm run lint         # Lint check
```

## License

MIT
