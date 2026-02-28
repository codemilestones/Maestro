## 1. 依赖与项目准备

- [x] 1.1 安装 `node-pty` 依赖及其 TypeScript 类型定义
- [x] 1.2 更新 tsconfig.json 以支持 node-pty 的 native binding
- [x] 1.3 创建 `src/pty/` 模块目录结构

## 2. PTY 会话核心（pty-session）

- [x] 2.1 实现 `PTYSession` 类，封装 node-pty 的 spawn/write/resize
- [x] 2.2 实现 PTY 输出环形缓冲区（RingBuffer，10000 行容量）
- [x] 2.3 实现 PTY 尺寸动态调整（resize 方法）
- [x] 2.4 编写 PTYSession 单元测试

## 3. 工具适配器框架（tool-adapter）

- [x] 3.1 定义 `ToolAdapter` 接口（spawn/detectStatus/getDefaultArgs/healthCheck）
- [x] 3.2 实现 `AdapterRegistry` 类（注册、查找、列出适配器）
- [x] 3.3 实现 Claude Code 内置适配器 `ClaudeCodeAdapter`
- [x] 3.4 更新配置 schema 以支持 `tools` 配置节
- [x] 3.5 编写适配器框架单元测试

## 4. 状态检测器（status-detector）

- [x] 4.1 定义 `StatusDetector` 接口（feed/currentStatus/onStatusChange）
- [x] 4.2 实现基于正则的 `PatternStatusDetector`
- [x] 4.3 实现 Claude Code 状态检测规则（idle/running/waiting_input）
- [x] 4.4 实现状态变更防抖逻辑（100ms 防抖）
- [x] 4.5 编写状态检测器单元测试

## 5. AgentController 重构（agent-controller）

- [x] 5.1 移除 OutputParser 和 JSON 流解析逻辑（创建新的 AgentControllerPTY）
- [x] 5.2 将 `child_process` spawn 替换为 `PTYSession`
- [x] 5.3 集成 `StatusDetector` 进行状态跟踪
- [x] 5.4 重构 `spawn()` 方法以使用工具适配器
- [x] 5.5 实现 `attach(agentId)` 和 `detach()` 方法
- [x] 5.6 更新 Agent 事件发射（output 事件携带原始 PTY 数据）
- [x] 5.7 编写 AgentController 集成测试

## 6. 会话 Attach 功能（session-attach）

- [x] 6.1 实现全屏 PTY 透传模式（stdin/stdout 直连）
- [x] 6.2 实现 Prefix Key 机制（默认 `Ctrl+]`，支持 d/n/p/k/? 子命令）
- [x] 6.3 实现 Prefix Key 超时检测（500ms）和双击透传
- [x] 6.4 实现终端状态保存/恢复（raw mode 等）
- [x] 6.5 实现独占 attach 模式和 `--force` 选项
- [x] 6.6 更新 `maestro attach` CLI 命令

## 7. TUI 界面更新（tui-interface）

- [x] 7.1 重构 Preview 面板以渲染 PTY 缓冲区
- [x] 7.2 实现从列表视图 Enter 键进入 attach 模式
- [x] 7.3 实现 `Ctrl+]` 返回列表视图（集成 Prefix Key 处理）
- [x] 7.4 更新状态指示器显示检测到的状态
- [x] 7.5 添加 `[attached]` 标记显示
- [ ] 7.6 （可选）添加工具选择器到 spawn 对话框

## 8. 配置与文档

- [x] 8.1 更新 `.maestro/config.yaml` 示例以包含 tools 和 session.escapeKey 配置
- [x] 8.2 更新 `maestro spawn` 命令支持 `--tool` 参数
- [x] 8.3 实现 `maestro config --list-tools` 命令
- [x] 8.4 更新 README 说明新的架构和使用方式

## 9. 清理与迁移

- [x] 9.1 标记 `src/agent/output/parser.ts` 为废弃或删除
- [x] 9.2 移除 `--print` 和 `--output-format stream-json` 相关代码（标记为废弃，保持向后兼容）
- [x] 9.3 更新现有测试以适配新架构
- [x] 9.4 运行完整测试套件确保无回归（210 测试全部通过）
