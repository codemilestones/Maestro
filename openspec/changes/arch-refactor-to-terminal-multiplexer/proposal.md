## Why

当前 Maestro 实现与预期目标存在**运行模型级别**的根本偏差：它被构建为一个"一次性批处理任务调度器"（使用 `claude -p` 无头模式），而非预期的"通用 AI 终端复用器"。这导致无法实现核心价值——随时 attach 进任意会话与 AI 直接对话。

## What Changes

- **BREAKING**: 移除 `--print` 无头模式，改用交互式 PTY 会话
- **BREAKING**: 用 `node-pty` 替换 `child_process`，实现双向终端透传
- **BREAKING**: 移除 JSON stream 解析，改用启发式终端输出状态检测
- 新增适配器架构，支持多种 AI 编程工具（Claude Code / Codex / Kimi 等）
- Preview 从只读日志变为完整终端仿真器
- 新增 attach 全屏接管模式（Prefix Key `Ctrl+]` 返回列表，避免与 Claude Code 按键冲突）

## Capabilities

### New Capabilities

- `pty-session`: PTY 进程管理，双向 stdin/stdout 透传，真实终端仿真
- `tool-adapter`: 工具适配器框架，抽象不同 AI 工具的启动、状态检测、参数构建
- `status-detector`: 启发式终端输出解析，从 PTY 原始输出推断 Agent 状态
- `session-attach`: 全屏 PTY 接管，Prefix Key（`Ctrl+]`）返回列表视图

### Modified Capabilities

- `agent-controller`: 从 child_process + JSON 流 → node-pty + 双向透传
- `tui-interface`: Preview 面板从日志渲染 → 终端仿真器或 attach 模式切换

## Impact

**代码变更**:
- `src/agent/process/spawner.ts`: 完全重写，使用 node-pty
- `src/agent/AgentController.ts`: 移除 OutputParser，改用 StatusDetector
- `src/agent/output/parser.ts`: 删除或重写为状态检测器
- `src/tui/`: Preview 组件重写

**新增依赖**:
- `node-pty`: PTY 进程管理

**配置变更**:
- `.maestro/config.yaml`: 新增 `tools` 和 `session` 配置节

**API 变更**:
- `spawn()` 不再接受 `--print` 相关参数
- 新增 `attach(agentId)` / `detach()` 方法
- 新增 `ToolAdapter` 接口用于工具注册
