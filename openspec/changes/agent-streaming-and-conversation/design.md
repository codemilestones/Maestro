## Context

当前 Maestro TUI 的 attached（详情）视图（`App.tsx:194-209`）仅展示最近 30 行输出文本，没有流式输出的视觉反馈，也没有对话输入能力。

现有基础设施：
- `AgentController.sendInput()` 已实现，可向 `waiting_input` 状态的 Agent 发送输入
- `AgentController.resume()` 已实现，可通过 sessionId 恢复已完成 Agent 的对话
- `useOutput` hook 已通过事件订阅实现实时输出追踪
- `OutputParser` 已能解析 `input_request` 事件并触发状态转换

核心问题：TUI attached 视图缺少输入 UI 和流式状态指示。

## Goals / Non-Goals

**Goals:**
- 在 attached 视图中实时渲染 Agent 流式输出，带运行状态指示
- 在 attached 视图底部提供对话输入框，支持发送消息
- 输入框对 `waiting_input` 和已完成 Agent 使用不同交互模式（sendInput vs resume）
- 自动复用 Agent 的 sessionId 保持上下文一致

**Non-Goals:**
- 不改变 Agent 的生命周期或状态机逻辑
- 不实现完整的聊天历史滚动/搜索功能
- 不支持 attached 视图以外的对话输入（list view 不变）
- 不改变 `maestro new` / `maestro continue` CLI 命令的行为

## Decisions

### 1. Attached 视图布局：上方输出 + 下方输入

采用固定布局：输出区域占据主体空间（flexGrow），输入区域固定在底部（3 行高度）。

**理由**：这是终端对话 UI 的标准模式（如 chat 应用），用户无需学习新交互范式。

**替代方案**：模态弹窗输入——被否决，因为会遮挡输出，且与 `NewAgentModal` 模式不一致。

### 2. 输入模式区分：sendInput vs resume

根据 Agent 状态自动切换输入行为：
- `waiting_input` → 调用 `controller.sendInput(id, text)`，Agent 继续当前进程
- `finished` / `failed` → 调用 `controller.resume(id, text, worktreePath)`，基于 sessionId 重启

**理由**：两种场景在底层实现完全不同（stdin pipe vs 新进程），但用户无需关心区别，统一输入框体验。

### 3. 流式输出状态指示器

在输出区域顶部 header 中显示 Agent 当前状态：
- `running` → 显示旋转动画 spinner + "Running..."
- `waiting_input` → 高亮提示 "Waiting for input..."
- `finished` → "Completed" 绿色
- `failed` → "Failed" 红色

**理由**：利用 Ink 框架内置的 `<Spinner>` 组件，最小成本实现流式感知。

### 4. 新增 ConversationInput 组件

创建独立的 `ConversationInput.tsx` 组件，使用 Ink 的 `<TextInput>` 处理用户输入。

**理由**：与 `NewAgentModal` 的输入逻辑解耦，因为 ConversationInput 需要感知 Agent 状态和 sessionId。

### 5. 键盘焦点管理

当 viewMode 为 `attached` 时：
- 默认焦点在输入框上（允许直接打字）
- Esc 键退出 attached 视图回到 list
- 输入框仅在 Agent 接受输入时可用（running 状态时输入框 disabled 但仍显示）

**理由**：避免键盘事件冲突——当前 `useKeyboard` hook 在 attached 模式下仍监听按键，需要条件性禁用全局快捷键。

## Risks / Trade-offs

- **[Ink TextInput 焦点冲突]** → 当 TextInput 获得焦点时，需要通过 `isFocused` prop 或条件渲染禁用 `useKeyboard` 中的全局按键监听，避免输入字符触发快捷键（如输入 "k" 触发列表上移）
- **[Resume 需要 worktreePath]** → `controller.resume()` 需要 worktreePath 参数，但当前 `AgentInfo` 不直接存储 worktreePath。需要通过 `worktreeId` 查找 worktree path，或在 AgentInfo 中缓存 worktreePath
- **[Detached 进程的 sendInput 限制]** → 通过 detached 模式启动的 Agent（`stdio: ['ignore', ...]`）stdin 为 ignore，无法通过 pipe 发送输入。需确认当前 TUI 创建的 Agent 使用 pipe 模式
