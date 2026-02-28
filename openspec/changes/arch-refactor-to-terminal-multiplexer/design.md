## Context

Maestro 当前使用 `claude -p --output-format stream-json` 无头模式启动 Claude Code，通过解析 JSON 流获取状态和输出。这种模式存在根本性限制：

1. **单向 I/O**: 只能读取 stdout，无法实现真正的双向交互
2. **一次性执行**: Agent 执行完毕即退出，无法进行多轮对话
3. **工具绑定**: 深度耦合 Claude Code 的 JSON 协议，无法支持其他 AI 工具

目标是将 Maestro 重新定位为"通用 AI 终端复用器"（类似 tmux，但面向 AI 编码会话），核心特性是：
- 每个会话是一个真实的 PTY，保留完整终端能力
- 随时 attach 任意会话进行对话
- 支持多种 AI 工具（Claude Code / Codex / Kimi 等）

## Goals / Non-Goals

**Goals:**
- 用 `node-pty` 替换 `child_process`，实现双向 PTY 透传
- 实现 attach 全屏接管模式，用户可随时切入任意会话
- 建立工具适配器框架，支持可插拔的 AI 工具
- 从终端输出启发式推断 Agent 状态

**Non-Goals:**
- 内嵌终端仿真器分屏显示（方案 B，作为后续增强）
- 支持非终端类型的 AI 工具（如 API-only 服务）
- 自动化任务调度（保持手动 spawn）

## Decisions

### D1: 进程管理从 child_process 迁移到 node-pty

**选择**: 使用 `node-pty` 库

**理由**:
- 提供真实的 PTY（伪终端），支持完整终端仿真（颜色、光标、ANSI 序列）
- 支持双向数据流（stdin ↔ stdout）
- attach 时可直接透传用户输入

**备选方案**:
- `child_process` + stdin/stdout pipe: 无法保留终端特性（颜色丢失、光标控制失效）
- `ttys` 库: 功能较弱，社区维护不活跃

### D2: Preview 模式采用 attach 全屏接管

**选择**: 方案 A - attach 时全屏接管 PTY，Prefix Key（`Ctrl+]`）返回列表

**理由**:
- 实现简单，零损耗，完整还原原生终端体验
- 避免内嵌终端仿真器的复杂度
- 用户体验接近 tmux attach

**备选方案**:
- 方案 B - 内嵌终端仿真器（如 xterm.js headless）: 可分屏但实现复杂，作为 M2+ 增强

### D3: 状态检测从 JSON 解析改为启发式模式匹配

**选择**: 基于正则表达式的启发式状态检测器

**理由**:
- 无 JSON 结构化输出后的唯一可行方案
- 每个工具适配器可定义自己的检测规则
- 足够灵活以支持不同 AI 工具的输出格式

**检测模式示例（Claude Code）**:
```typescript
{
  idle: /^❯\s*$/m,                    // 空闲提示符
  running: /^⠋|⠙|⠹|⠸|⠼|⠴|⠦|⠧/m,    // spinner
  waiting: /\(y\/n\)|\[Y\/n\]/i,      // 权限确认
}
```

### D4: Attach 模式使用 Prefix Key 机制

**选择**: 使用 `Ctrl+]` 作为 Prefix Key，类似 tmux 的 `Ctrl+B`

**理由**:
- 避免与 Claude Code 的按键冲突（Escape、Ctrl+C 等都被 CC 使用）
- `Ctrl+]` 是 telnet 的经典 escape 字符，几乎没有 TUI 应用使用
- 支持扩展命令（`Ctrl+]` + `d/n/p/k/?`）

**备选方案**:
- 双击 Escape: 引入输入延迟，用户体验差
- `Ctrl+B`（tmux 风格）: 与 readline/Emacs 的"后退一字符"冲突

**配置化**: 允许用户通过 `session.escapeKey` 自定义 Prefix Key

### D5: 工具适配器接口设计

**选择**: 统一的 `ToolAdapter` 接口

```typescript
interface ToolAdapter {
  name: string;
  spawn(options: SpawnOptions): PTYProcess;
  detectStatus(output: string): AgentStatus;
  getDefaultArgs(prompt: string): string[];
  healthCheck(): Promise<boolean>;
}
```

**理由**:
- 抽象不同工具的启动方式和交互协议
- 内置 Claude Code 适配器，用户可添加自定义适配器
- `healthCheck()` 用于检测工具是否可用

## Risks / Trade-offs

### R1: 状态检测可靠性
[风险] 启发式模式匹配可能误判状态（如输出内容恰好匹配 idle 模式）
→ 缓解: 使用多信号组合判断，加入状态转换防抖，允许用户手动纠正状态

### R2: 工具兼容性
[风险] 不同 AI 工具的终端输出格式差异大，适配器维护成本高
→ 缓解: 优先确保 Claude Code 适配器稳定，其他工具采用社区贡献模式

### R3: 会话恢复
[风险] PTY 会话无法像 JSON 日志那样精确重放
→ 缓解: 保留 PTY 输出缓冲区（最近 N 行），恢复时显示历史上下文

### R4: 并发 attach
[风险] 多用户/多终端同时 attach 同一会话可能导致冲突
→ 缓解: M1 采用独占模式（一次只能有一个 attach），后续考虑只读观察模式

## 分阶段里程碑

**M1: PTY 基础**
- `node-pty` 启动 Claude Code（交互模式，不加 `-p`）
- attach 全屏接管 + `Ctrl+]` 返回（Prefix Key 机制）
- 基础状态显示

**M2: 多会话管理**
- 列表视图 + 会话切换
- Git Worktree 隔离（复用现有逻辑）

**M3: 适配器框架**
- `ToolAdapter` 接口
- Claude Code 内置适配器
- 配置文件工具注册

**M4: 状态检测**
- 启发式解析框架
- 状态面板 UI
