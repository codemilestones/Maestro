# Maestro README

# Maestro 🎻

**The ultimate CLI orchestrator for your AI developer fleet.**

Transition from a solo developer to an AI fleet commander. Maestro orchestrates multiple Claude Code instances in parallel, utilizing `git worktree` for absolute context isolation and PR-driven workflows for seamless human-in-the-loop code reduction.

---

## 🚀 Core Philosophy: Map & Reduce

- **Map (AI)**: Distribute isolated, well-defined tasks to multiple Agents.
- **Reduce (Human)**: You act as the Chief Architect. You review Pull Requests, enforce design protocols, and resolve architectural conflicts.

## ✨ Key Features

- **Git Worktree Isolation**: Zero file-read/write conflicts. Each Agent operates in an isolated physical directory while sharing the same local repository cache.
- **PR-Driven Delivery**: Agents don't commit directly to the main branch. Every finished task is delivered as a structured Pull Request.
- **Tmux for AI (AImux)**: A unified CLI dashboard. Monitor fleet status (e.g., `Running`, `Waiting`, `Failed`), suspend tasks, and seamlessly hijack any session to provide manual guidance.
- **Master Supervisor (Roadmap)**: An optional supervisor layer that intercepts `stdout`/`stderr`. It provides confidence-based auto-correction for minor errors or escalates to the human commander to prevent infinite loops.

## 🛠 Quick Start (Conceptual)

Start the orchestrator and spawn tasks:

```bash
# Initialize Maestro in your git repository
maestro init

# Spawn agents for parallel features
maestro spawn "Build Login UI component" "Implement Auth API"

# Monitor fleet status in real-time
maestro top

# Hijack a specific agent's session for human intervention
maestro attach worker-1
```

## 🧠 Architecture

Maestro acts as the I/O hijacker and lifecycle manager for Claude Code. 

1. `Task -> maestro spawn`
2. `Git Worktree created -> Claude Code spawned`
3. `I/O Intercepted -> Maestro Dashboard`
4. `Task completed -> Git Commit & PR -> Worktree archived`
