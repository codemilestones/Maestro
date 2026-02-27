## 1. 项目初始化

- [ ] 1.1 初始化 npm 项目，配置 TypeScript、ESLint、Prettier
- [ ] 1.2 安装核心依赖：commander、ink、react、simple-git、execa、lowdb、yaml
- [ ] 1.3 配置构建脚本和 npm bin 入口
- [ ] 1.4 创建 src/ 目录结构：cli/、worktree/、agent/、tui/、pr/、shared/

## 2. 共享基础设施 (shared/)

- [ ] 2.1 实现配置加载器 (config.ts)：读取 .maestro/config.yaml，提供默认值
- [ ] 2.2 实现日志工具 (logger.ts)：支持多级别日志、文件输出
- [ ] 2.3 定义核心类型 (types.ts)：AgentInfo、WorktreeInfo、AgentStatus 等
- [ ] 2.4 实现 ID 生成器 (id.ts)：生成 task-xxx 格式的唯一 ID

## 3. Worktree 管理模块 (worktree/)

- [ ] 3.1 封装 simple-git 操作 (git.ts)：worktree add/remove/list
- [ ] 3.2 实现 WorktreeManager 类：create、remove、list、get、exists 方法
- [ ] 3.3 实现 worktrees.json 元信息持久化
- [ ] 3.4 添加分支命名逻辑：自动添加 maestro/ 前缀
- [ ] 3.5 实现分支冲突检测和错误处理

## 4. Agent 控制模块 (agent/)

- [ ] 4.1 实现进程启动器 (spawner.ts)：构建 claude 命令参数、使用 execa 启动
- [ ] 4.2 实现输出解析器 (parser.ts)：解析 stream-json 格式、提取消息和工具调用
- [ ] 4.3 实现状态机 (state.ts)：定义状态转换逻辑
- [ ] 4.4 实现 AgentController 类：spawn、kill、sendInput、getStatus 方法
- [ ] 4.5 实现指标收集：tokensUsed、toolCalls、filesModified、duration
- [ ] 4.6 实现并发限制和队列管理
- [ ] 4.7 实现 agents.json 状态持久化
- [ ] 4.8 实现进程监控和超时处理

## 5. CLI 命令模块 (cli/)

- [ ] 5.1 创建 CLI 入口 (index.ts)：使用 Commander 注册所有命令
- [ ] 5.2 实现 init 命令：创建 .maestro/ 目录结构和默认配置
- [ ] 5.3 实现 spawn 命令：解析参数、创建 worktree、启动 agent
- [ ] 5.4 实现 status 命令：表格输出、--json、--watch 模式
- [ ] 5.5 实现 attach 命令：启动 TUI 或直接附加到 agent
- [ ] 5.6 实现 logs 命令：查看日志、--follow、--tail 选项
- [ ] 5.7 实现 kill 命令：优雅终止和强制终止
- [ ] 5.8 实现 cleanup 命令：清理已完成 worktree、--dry-run 预览
- [ ] 5.9 实现 config 命令：--get 和 --set 操作
- [ ] 5.10 添加全局错误处理和帮助信息

## 6. TUI 界面模块 (tui/)

- [ ] 6.1 创建 App 主组件：三区域布局框架
- [ ] 6.2 实现 AgentList 组件：渲染 agent 列表、状态图标
- [ ] 6.3 实现 Preview 组件：显示选中 agent 的实时输出
- [ ] 6.4 实现 StatusBar 组件：显示统计和快捷键提示
- [ ] 6.5 实现键盘快捷键处理 (useKeyboard hook)
- [ ] 6.6 实现 agent 状态订阅 (useAgents hook)
- [ ] 6.7 实现输出流订阅 (useOutput hook)
- [ ] 6.8 实现全屏会话模式：stdin 透传、Esc 返回
- [ ] 6.9 实现帮助弹窗和输入弹窗组件
- [ ] 6.10 优化渲染性能：输出缓冲、限制行数

## 7. PR 自动化模块 (pr/)

- [ ] 7.1 实现 diff 分析器 (diff.ts)：解析 git diff 输出
- [ ] 7.2 实现接口变更检测 (interface.ts)：识别 TypeScript export 变更
- [ ] 7.3 实现依赖变更检测 (dependency.ts)：解析 package.json 变更
- [ ] 7.4 实现 PR 模板填充：生成架构契约清单
- [ ] 7.5 实现 PRGenerator 类：自动 commit、push、gh pr create
- [ ] 7.6 支持自定义 PR 模板
- [ ] 7.7 实现自动标签添加逻辑

## 8. 状态持久化完善 (state/)

- [ ] 8.1 实现原子写入：临时文件 + 重命名
- [ ] 8.2 实现启动时状态恢复
- [ ] 8.3 实现进程恢复检测：检查 PID 是否存活
- [ ] 8.4 实现日志轮转

## 9. 集成测试与文档

- [ ] 9.1 编写核心模块单元测试
- [ ] 9.2 编写端到端集成测试
- [ ] 9.3 编写 README 使用文档
- [ ] 9.4 添加命令行帮助示例
