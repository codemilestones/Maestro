## 1. 修复 Preview 输出显示

- [x] 1.1 在 AgentController 中添加 `loadOutputFromLog(agentId)` 方法，从 `.maestro/logs/{id}.stdout.jsonl` 解析历史输出
- [x] 1.2 修改 `getOutput()` 方法：如果 outputBuffer 为空且 Agent 是 terminal state，调用 loadOutputFromLog 加载
- [x] 1.3 测试已完成 Agent 的 Preview 显示

## 2. 实现归档功能

- [x] 2.1 在 `src/shared/types.ts` 的 AgentInfo 接口中添加 `archived?: boolean` 字段
- [x] 2.2 在 AgentController 中添加 `archive(agentId)` 方法
- [x] 2.3 archive 方法需设置 `info.archived = true` 并调用 store.saveAgent() 持久化
- [x] 2.4 修改 `listAll()` 方法，默认过滤掉 `archived: true` 的 Agent

## 3. TUI 归档快捷键集成

- [x] 3.1 在 App.tsx 的 useInput 中添加 'a' 键处理逻辑
- [x] 3.2 'a' 键只对 terminal state Agent 生效，其他状态忽略
- [x] 3.3 归档后刷新 Agent 列表
- [x] 3.4 更新 HelpModal 添加 'a - Archive agent' 说明

## 4. 测试验证

- [x] 4.1 测试运行 Agent 后 Preview 正常显示输出
- [x] 4.2 测试 Agent 完成后重新进入 TUI Preview 仍能显示历史
- [x] 4.3 测试 a 键归档已完成 Agent
- [x] 4.4 测试 a 键对运行中 Agent 无效
- [x] 4.5 验证归档后 agents.json 中 archived 字段为 true
- [x] 4.6 验证重启 TUI 后已归档 Agent 不在列表中显示
