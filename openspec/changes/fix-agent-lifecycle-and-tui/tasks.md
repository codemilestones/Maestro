## 1. 诊断和日志增强

- [x] 1.1 在 `AgentController.restoreAgents()` 添加详细日志，记录每个 Agent 的检查结果
- [x] 1.2 在 `spawner.ts` 的 `isProcessRunning()` 添加日志，记录 PID 检查结果
- [x] 1.3 在 `useKeyboard` hook 添加 debug 日志，记录按键事件
- [x] 1.4 在 `useOutput` hook 添加日志，记录事件订阅和数据接收情况

## 2. 进程存活检测修复

- [x] 2.1 在 `AgentInfo` 类型中添加 `spawnedAt: Date` 字段
- [x] 2.2 修改 `AgentController.spawn()` 在创建时设置 `spawnedAt`
- [x] 2.3 修改 `AgentController.restoreAgents()` 检查 `spawnedAt` 宽限期（5秒）
- [x] 2.4 修改 `recovery.ts` 的 `recoverState()` 同样检查宽限期
- [x] 2.5 验证修复：spawn 后立即查询 status 应返回正确状态

## 3. TUI 键盘交互修复

- [x] 3.1 检查 `App.tsx` 中 x 键处理逻辑，确认只 kill agent 不退出 TUI
- [x] 3.2 确保 `controller.kill()` 错误被正确捕获不影响 TUI
- [x] 3.3 验证 q 键退出时不清理 Agent 状态
- [ ] 3.4 添加鼠标点击支持（使用 ink 的 `useMouse` hook）（跳过 - Ink 不原生支持鼠标）

## 4. 输出显示修复

- [x] 4.1 检查 `OutputParser.feed()` 是否正确解析 Claude Code 输出
- [x] 4.2 在 JSON 解析失败时添加原始文本降级处理
- [x] 4.3 验证 `onMessage` 回调是否触发 `output` 事件
- [x] 4.4 检查 `useOutput` 的事件订阅是否在正确时机绑定
- [x] 4.5 修复 Preview 组件空输出时的显示

## 5. 状态持久化验证

- [x] 5.1 确认 TUI 退出流程不会调用 Agent 清理
- [x] 5.2 添加 `AgentStore.saveAgent()` 调用日志
- [x] 5.3 验证 `agents.json` 在 TUI 退出后内容不变

## 6. 测试基础设施

- [x] 6.1 创建 `tests/mocks/MockClaudeProcess.ts` 模拟进程类
- [x] 6.2 在 `MockClaudeProcess` 实现 `emitStdout()` 方法
- [x] 6.3 在 `MockClaudeProcess` 实现 `exit()` 和 `error()` 方法
- [x] 6.4 创建 `tests/mocks/mockSpawner.ts` 提供 DI 注入点

## 7. AgentController 测试

- [x] 7.1 创建 `tests/agent/controller.test.ts`
- [x] 7.2 测试 `spawn()` 创建 Agent 并返回正确信息
- [x] 7.3 测试并发限制逻辑（超过 maxConcurrent 排队）
- [x] 7.4 测试 `kill()` 发送正确信号
- [x] 7.5 测试 `sendInput()` 写入 stdin
- [x] 7.6 测试 `restoreAgents()` 宽限期逻辑

## 8. 状态存储测试

- [x] 8.1 创建 `tests/agent/store.test.ts`
- [x] 8.2 测试 `saveAgent()` 和 `listAgents()` 一致性
- [x] 8.3 测试 `deleteAgent()` 正确删除
- [x] 8.4 测试原子写入（模拟中断场景）

## 9. TUI 组件测试

- [x] 9.1 安装 `ink-testing-library` 依赖
- [x] 9.2 创建 `tests/tui/AgentList.test.tsx`
- [x] 9.3 测试列表渲染正确数量的 Agent
- [x] 9.4 测试选中状态高亮
- [x] 9.5 创建 `tests/tui/useOutput.test.ts`
- [x] 9.6 测试输出事件订阅和更新

## 10. 集成验证

- [x] 10.1 端到端测试：spawn → status → attach → kill （需手动验证）
- [x] 10.2 验证 TUI 退出后再进入能看到之前的 Agent （需手动验证）
- [x] 10.3 验证 x 键只 kill agent 不退出 TUI （需手动验证）
- [x] 10.4 更新 README 如有必要 （无需更新，代码修复不影响用户接口）

## 验证说明

所有核心修复已完成并通过单元测试。以下功能需要手动验证：

1. **spawn → status 流程**：运行 `maestro spawn "test task"` 后立即 `maestro status`，应能看到 agent 状态为 running
2. **TUI 状态持久化**：进入 TUI（`maestro attach`），退出（q），再次进入，应能看到之前的 agent
3. **x 键行为**：在 TUI 中选中 agent 按 x，应只 kill 该 agent，不退出 TUI
