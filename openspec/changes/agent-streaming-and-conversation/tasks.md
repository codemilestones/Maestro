## 1. AgentController 扩展

- [x] 1.1 在 `AgentController` 中添加 `getWorktreePath(agentId)` 方法，通过 worktreeId 查找并返回 worktree 路径
- [x] 1.2 在 `AgentController` 中添加 `handleConversationInput(agentId, text)` 方法，根据 Agent 状态自动路由到 `sendInput` 或 `resume`

## 2. 流式输出状态指示器

- [x] 2.1 创建 `StatusIndicator` 组件（`src/tui/components/StatusIndicator.tsx`），根据 Agent 状态显示 spinner/文本/颜色
- [x] 2.2 在 attached 视图 header 中集成 `StatusIndicator`，替换当前的纯文本显示

## 3. 对话输入组件

- [x] 3.1 创建 `ConversationInput` 组件（`src/tui/components/ConversationInput.tsx`），包含 TextInput、状态感知的 placeholder 和 disabled 逻辑
- [x] 3.2 实现输入提交逻辑：根据 Agent 状态调用 `handleConversationInput`，提交后清空输入框

## 4. Attached 视图布局重构

- [x] 4.1 重构 `App.tsx` attached 视图为上下分栏布局（输出区 flexGrow + 输入区固定高度）
- [x] 4.2 集成 `StatusIndicator` 到 attached header
- [x] 4.3 集成 `ConversationInput` 到 attached 底部，传入 agent 状态、controller 和 agentId

## 5. 键盘焦点管理

- [x] 5.1 修改 `useKeyboard` hook 或 `App.tsx` 的 keyboardHandlers，当 viewMode 为 `attached` 时禁用全局导航快捷键（j/k/n/x/a/r），仅保留 Esc
- [x] 5.2 确保 ConversationInput 的 TextInput 在 attached 模式下获得焦点，Esc 能正确退出到 list 视图

## 6. 验证与边界情况

- [x] 6.1 验证 running 状态的 Agent 输入框正确 disabled
- [x] 6.2 验证无 sessionId 的 finished Agent 输入框显示 "No session available" 并 disabled
- [x] 6.3 验证 resume 后 Agent 状态正确更新、输出流重新连接
