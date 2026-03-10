## Why

新建 Agent 后缺乏实时反馈（无流式输出），用户无法感知运行状态；进入 Agent 详情页后无法继续对话（缺少输入框），且继续对话时未复用 sessionId 导致上下文断裂。这三个问题严重影响了 Agent 交互体验的连贯性和可用性。

## What Changes

- 在 TUI Agent 详情（attached）视图中增加流式输出的逐行渲染效果，让用户实时感知 Agent 运行进展
- 在 Agent 详情视图底部增加对话输入框，支持用户在查看 Agent 输出的同时发送新消息
- 对话输入时自动复用当前 Agent 的 sessionId，通过 `--resume` 参数传递给 Claude Code，保持上下文一致
- 当 Agent 处于 `waiting_input` 状态时，自动聚焦输入框并提示用户输入

## Capabilities

### New Capabilities
- `agent-streaming-output`: Agent 详情视图的流式输出渲染能力，包括逐行实时显示、状态指示器、自动滚动
- `agent-conversation-input`: Agent 详情视图的对话输入能力，包括输入框组件、消息发送、sessionId 复用

### Modified Capabilities
- `tui-interface`: 详情（attached）视图布局变更，从纯输出展示改为上方输出+下方输入的对话式布局
- `agent-controller`: 新增 sendInput / resume 的 TUI 集成路径，支持从详情视图直接发送输入

## Impact

- **TUI 组件**: `App.tsx`（attached 视图布局）、新增 `ConversationInput.tsx` 组件、`Preview.tsx`（流式渲染增强）
- **Hooks**: `useOutput.ts`（流式状态管理）、新增 `useConversation.ts`（输入与 sessionId 管理）
- **Agent 控制器**: `AgentController.ts`（sendInput 接口暴露给 TUI）
- **键盘处理**: `useKeyboard.ts`（attached 视图下的输入焦点管理）
