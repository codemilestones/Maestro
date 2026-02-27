# 多 Agent 编排 CLI 工具设计

## 核心命题：人与多 Agent 协作效率

**目标**：构建一个基于 CLI 的编排工具，极大化提升**单个人类开发者与多个 Claude Code 实例**的并行协作效率。

---

## 系统架构设计

### 1. 核心定位：人类中枢

摒弃复杂的"Agent 间自主通信"，回归最可靠的 **Human-to-Agents** 辐射状结构。你作为唯一的架构师和决策者（Reduce），多 Agent 负责纯粹的实现（Map）。

### 2. 上下文隔离：Git Worktree

- **机制**：每个被调度的 Claude Code 实例在一个独立的 `git worktree` 下运行。
- **优势**：物理级别的目录隔离，彻底杜绝多 Agent 读写同一文件的冲突。共享本地仓库缓存，创建速度极快。
- **生命周期**：任务下发 -> 创建 Worktree 分支 -> Agent 执行 -> 提交 PR -> 销毁/归档 Worktree。

### 3. 人机交互：原生保留

- **介入时机**：完全继承 Claude Code 原有的 Human-in-the-loop 机制。
- **控制台体验**：CLI 提供类似 Tmux 的会话管理。主视图显示所有 Agent 的运行状态（如：`Running`, `Waiting for Input`, `Finished`）。你可以随时通过快捷键切入特定 Agent 的会话进行答疑或纠偏。

### 4. 交付与集成：PR 驱动

- 放弃在编排层做代码 Diff 的深度集成。
- 所有 Agent 的最终产出以 **Pull Request** 形式汇聚到主分支。你在代码托管平台（如 GitHub/GitLab）或你习惯的 IDE 中进行 Code Review 和合并。

---

## 技术栈选型

| 层级 | 选型 | 理由 |
| --- | --- | --- |
| 语言 | TypeScript | 与 Claude Code 同生态，类型安全，开发效率高 |
| CLI 框架 | Commander.js | 成熟稳定，社区活跃 |
| TUI 框架 | Ink (React for CLI) | 组件化开发，状态管理友好 |
| 进程管理 | Node.js child_process + execa | 原生支持，execa 提供更好的 API |
| Git 操作 | simple-git | 轻量封装，Promise API |
| 状态持久化 | lowdb (JSON) | 轻量级，无需外部数据库 |
| PR 创建 | GitHub CLI (gh) | 官方工具，功能完整 |

---

## 模块详细设计

### 模块一：CLI 入口 (cli/)

#### 1.1 职责

- 解析命令行参数
- 路由到对应的命令处理器
- 全局错误处理与日志

#### 1.2 命令清单

| 命令 | 参数 | 说明 |
| --- | --- | --- |
| `maestro init` | `--force` | 初始化项目配置 |
| `maestro spawn <prompt>` | `--branch`, `--base`, `--name` | 创建新 Agent 执行任务 |
| `maestro status` | `--json`, `--watch` | 查看所有 Agent 状态 |
| `maestro attach` | `--agent <id>` | 进入 TUI 或切换到特定 Agent |
| `maestro logs <id>` | `--follow`, `--tail` | 查看 Agent 日志 |
| `maestro kill <id>` | `--force` | 终止 Agent |
| `maestro cleanup` | `--all`, `--dry-run` | 清理已完成的 worktree |
| `maestro config` | `--get`, `--set` | 配置管理 |

#### 1.3 目录结构

```
src/cli/
├── index.ts          # 入口，注册所有命令
├── commands/
│   ├── init.ts
│   ├── spawn.ts
│   ├── status.ts
│   ├── attach.ts
│   ├── logs.ts
│   ├── kill.ts
│   ├── cleanup.ts
│   └── config.ts
└── utils/
    ├── logger.ts     # 日志工具
    └── validator.ts  # 参数校验
```

#### 1.4 核心接口

```tsx
// src/cli/types.ts
interface SpawnOptions {
  prompt: string;
  branch?: string;
  base?: string;      // 基于哪个分支创建，默认 main
  name?: string;      // Agent 别名
  autoCommit?: boolean;
  autoPR?: boolean;
}

interface CommandContext {
  config: MaestroConfig;
  logger: Logger;
  agentController: AgentController;
  worktreeManager: WorktreeManager;
}
```

---

### 模块二：Git Worktree Manager (worktree/)

#### 2.1 职责

- 创建/删除 git worktree
- 分支生命周期管理
- worktree 状态查询

#### 2.2 核心流程

**创建 Worktree:**

```
1. 检查目标分支是否已存在
2. git worktree add ./worktrees/<task-id> -b <branch-name> <base>
3. 记录 worktree 元信息到 .maestro/worktrees.json
4. 返回 worktree 路径
```

**销毁 Worktree:**

```
1. 确认 Agent 已停止
2. git worktree remove ./worktrees/<task-id>
3. 可选：删除远程分支 (git push origin --delete <branch>)
4. 清理元信息记录
```

#### 2.3 目录结构

```
src/worktree/
├── index.ts
├── WorktreeManager.ts
├── types.ts
└── utils/
    └── git.ts        # git 命令封装
```

#### 2.4 核心接口

```tsx
// src/worktree/types.ts
interface WorktreeInfo {
  id: string;
  path: string;
  branch: string;
  baseBranch: string;
  createdAt: Date;
  status: 'active' | 'archived' | 'deleted';
}

interface WorktreeManager {
  create(options: CreateWorktreeOptions): Promise<WorktreeInfo>;
  remove(id: string, options?: RemoveOptions): Promise<void>;
  list(): Promise<WorktreeInfo[]>;
  get(id: string): Promise<WorktreeInfo | null>;
  exists(id: string): boolean;
  getPath(id: string): string;
}

interface CreateWorktreeOptions {
  branch: string;
  base?: string;       // 默认 'main'
  taskId?: string;     // 不提供则自动生成
}

interface RemoveOptions {
  force?: boolean;
  deleteRemoteBranch?: boolean;
}
```

#### 2.5 配置项

```yaml
# .maestro/config.yaml
worktree:
  baseDir: "./worktrees"        # worktree 存放目录
  defaultBase: "main"           # 默认基准分支
  branchPrefix: "maestro/"      # 分支前缀
  autoCleanup: true             # 任务完成后自动清理
  cleanupDelay: 3600            # 清理延迟(秒)
```

---

### 模块三：Agent Controller (agent/)

#### 3.1 职责

- 启动/停止 Claude Code 子进程
- 监控 Agent 状态
- 管理 Agent 输入/输出流
- 状态持久化与恢复

#### 3.2 Agent 状态机

```
┌─────────────────────────────────────────────────────────────┐
│                        Agent 状态机                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────┐      spawn()       ┌───────────┐            │
│   │ PENDING  │ ─────────────────> │ STARTING  │            │
│   └──────────┘                    └─────┬─────┘            │
│                                         │                   │
│                               process started               │
│                                         │                   │
│                                         ▼                   │
│   ┌──────────┐    needs input     ┌───────────┐            │
│   │ WAITING  │ <───────────────── │  RUNNING  │            │
│   │  INPUT   │                    └─────┬─────┘            │
│   └────┬─────┘                          │                   │
│        │                                │                   │
│        │ user responds                  │ task complete     │
│        │                                │                   │
│        ▼                                ▼                   │
│   ┌───────────┐                   ┌───────────┐            │
│   │  RUNNING  │                   │ FINISHED  │            │
│   └───────────┘                   └───────────┘            │
│                                                             │
│   Any State ──── error/kill() ────> ┌───────────┐          │
│                                      │  FAILED   │          │
│                                      └───────────┘          │
└─────────────────────────────────────────────────────────────┘
```

#### 3.3 目录结构

```
src/agent/
├── index.ts
├── AgentController.ts    # 单个 Agent 控制器
├── AgentPool.ts          # Agent 池管理
├── types.ts
├── process/
│   ├── spawner.ts        # 进程启动
│   └── monitor.ts        # 进程监控
├── output/
│   ├── parser.ts         # 输出解析 (JSON stream)
│   └── buffer.ts         # 输出缓冲
└── state/
    ├── store.ts          # 状态存储
    └── recovery.ts       # 状态恢复
```

#### 3.4 核心接口

```tsx
// src/agent/types.ts
type AgentStatus = 
  | 'pending'
  | 'starting' 
  | 'running' 
  | 'waiting_input'
  | 'finished'
  | 'failed';

interface AgentInfo {
  id: string;
  name?: string;
  prompt: string;
  worktreeId: string;
  status: AgentStatus;
  pid?: number;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  exitCode?: number;
  error?: string;
  metrics: AgentMetrics;
}

interface AgentMetrics {
  tokensUsed: number;
  toolCalls: number;
  filesModified: string[];
  duration?: number;
}

interface AgentController {
  spawn(options: SpawnOptions): Promise<AgentInfo>;
  kill(id: string, force?: boolean): Promise<void>;
  sendInput(id: string, input: string): Promise<void>;
  getStatus(id: string): AgentStatus;
  getInfo(id: string): AgentInfo | null;
  listAll(): AgentInfo[];
  onStateChange(callback: (agent: AgentInfo) => void): void;
  getOutputStream(id: string): ReadableStream;
}

interface SpawnOptions {
  prompt: string;
  worktreePath: string;
  name?: string;
  env?: Record<string, string>;
  timeout?: number;
}
```

#### 3.5 Claude Code 调用方式

```tsx
// src/agent/process/spawner.ts
const claudeArgs = [
  '--print',                        // 非交互模式
  '--output-format', 'stream-json', // JSON 流输出
  '--verbose',                      // 详细日志
  '--dangerously-skip-permissions', // 跳过权限确认 (可选)
  '-p', prompt                      // 任务提示
];

const proc = spawn('claude', claudeArgs, {
  cwd: worktreePath,
  env: {
    ...process.env,
    CLAUDE_CODE_ENTRYPOINT: 'cli',
  }
});
```

#### 3.6 输出解析

```tsx
// Claude Code stream-json 输出格式
interface ClaudeStreamEvent {
  type: 'assistant' | 'user' | 'system' | 'result';
  message?: {
    content: string;
  };
  tool_use?: {
    name: string;
    input: Record<string, unknown>;
  };
  subtype?: 'input_request';  // 需要用户输入
}
```

#### 3.7 配置项

```yaml
# .maestro/config.yaml
agent:
  maxConcurrent: 5              # 最大并发 Agent 数
  defaultTimeout: 1800000       # 默认超时 30 分钟
  claudePath: "claude"          # Claude Code 路径
  skipPermissions: false        # 是否跳过权限确认
  autoRetry: true               # 失败自动重试
  maxRetries: 2                 # 最大重试次数
```

---

### 模块四：TUI Manager (tui/)

#### 4.1 职责

- 渲染多 Agent 状态面板
- 处理键盘快捷键
- 会话切换与透传
- 实时日志展示

#### 4.2 界面布局

```
┌─────────────────────────────────────────────────────────────────┐
│  Maestro v1.0.0                              [?] Help  [q] Quit │
├─────────────────────────────────────────────────────────────────┤
│  AGENTS (3 active, 1 waiting)                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ [1] ● feat/login     Running   "实现用户登录..."   2m 30s   ││
│  │ [2] ◐ feat/api       Waiting   "重构 API 模块"     5m 12s   ││
│  │ [3] ● feat/tests     Running   "添加单元测试..."   1m 05s   ││
│  │ [4] ✓ feat/docs      Finished  "更新文档"         Done      ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  PREVIEW [Agent #1: feat/login]                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ > Reading src/auth/login.ts                                 ││
│  │ > Analyzing authentication flow...                          ││
│  │ > Creating new file: src/auth/LoginForm.tsx                 ││
│  │ > Writing component code...                                 ││
│  │ █                                                           ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────┤
│  [1-9] Select Agent  [Enter] Attach  [k] Kill  [p] Create PR   │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.3 快捷键映射

| 快捷键 | 功能 |
| --- | --- |
| `1-9` | 选择对应序号的 Agent |
| `Enter` | 进入选中 Agent 的全屏会话 |
| `Esc` | 从全屏会话返回列表 |
| `k` | 终止选中的 Agent |
| `p` | 为选中 Agent 创建 PR |
| `r` | 刷新状态 |
| `n` | 新建 Agent (弹出输入框) |
| `l` | 查看选中 Agent 完整日志 |
| `?` | 显示帮助 |
| `q` | 退出 |

#### 4.4 目录结构

```
src/tui/
├── index.tsx
├── App.tsx               # 主应用
├── components/
│   ├── AgentList.tsx     # Agent 列表
│   ├── AgentItem.tsx     # 单个 Agent 行
│   ├── Preview.tsx       # 输出预览面板
│   ├── StatusBar.tsx     # 底部状态栏
│   ├── HelpModal.tsx     # 帮助弹窗
│   └── InputModal.tsx    # 输入弹窗
├── hooks/
│   ├── useAgents.ts      # Agent 状态 hook
│   ├── useKeyboard.ts    # 键盘事件 hook
│   └── useOutput.ts      # 输出流 hook
└── store/
    └── uiState.ts        # UI 状态管理
```

#### 4.5 核心组件接口

```tsx
// src/tui/components/types.ts
interface AgentListProps {
  agents: AgentInfo[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAttach: (id: string) => void;
  onKill: (id: string) => void;
}

interface PreviewProps {
  agent: AgentInfo | null;
  outputLines: string[];
  maxLines?: number;
}

// src/tui/App.tsx
const App: FC = () => {
  const { agents, selectedAgent, selectAgent } = useAgents();
  const { outputLines } = useOutput(selectedAgent?.id);
  
  useKeyboard({
    'q': () => process.exit(0),
    'enter': () => attachToAgent(selectedAgent?.id),
    // ...
  });

  return (
    <Box flexDirection="column">
      <Header />
      <AgentList 
        agents={agents} 
        selectedId={selectedAgent?.id}
        onSelect={selectAgent}
      />
      <Preview 
        agent={selectedAgent} 
        outputLines={outputLines}
      />
      <StatusBar />
    </Box>
  );
};
```

#### 4.6 全屏会话模式

```tsx
// 进入 Agent 全屏会话
// 类似 tmux attach -t <session>

interface AttachMode {
  agentId: string;
  // 透传 stdin 到 Agent 进程
  // 透传 Agent stdout/stderr 到终端
  // Ctrl+A, D 返回列表视图
}
```

---

### 模块五：PR Generator (pr/)

#### 5.1 职责

- 自动生成规范的 PR
- 提取架构契约清单
- 填充 PR 模板

#### 5.2 PR 模板

```markdown
## 概述
{agent_prompt}

## 变更类型
- [ ] 新功能 (feat)
- [ ] Bug 修复 (fix)
- [ ] 重构 (refactor)
- [ ] 文档 (docs)
- [ ] 测试 (test)

## 架构契约清单

### 修改的核心接口
{interface_changes}

### 新增的依赖
{new_dependencies}

### 修改的文件
{file_changes}

## Agent 执行摘要
- 执行时长: {duration}
- Token 消耗: {tokens_used}
- 工具调用: {tool_calls} 次

---
> 🤖 由 Maestro Agent `{agent_id}` 自动生成
```

#### 5.3 目录结构

```
src/pr/
├── index.ts
├── PRGenerator.ts
├── templates/
│   ├── default.md
│   └── contract.md       # 架构契约模板
├── analyzers/
│   ├── diff.ts           # Diff 分析
│   ├── interface.ts      # 接口变更检测
│   └── dependency.ts     # 依赖变更检测
└── types.ts
```

#### 5.4 核心接口

```tsx
// src/pr/types.ts
interface PROptions {
  agentId: string;
  title?: string;
  draft?: boolean;
  reviewers?: string[];
  labels?: string[];
  autoMerge?: boolean;
}

interface PRInfo {
  url: string;
  number: number;
  title: string;
  branch: string;
  baseBranch: string;
}

interface ArchitectureContract {
  interfaceChanges: InterfaceChange[];
  newDependencies: Dependency[];
  fileChanges: FileChange[];
}

interface InterfaceChange {
  file: string;
  type: 'added' | 'modified' | 'removed';
  name: string;
  signature?: string;
}

interface PRGenerator {
  create(options: PROptions): Promise<PRInfo>;
  analyzeChanges(worktreePath: string): Promise<ArchitectureContract>;
  generateDescription(
    agent: AgentInfo, 
    contract: ArchitectureContract
  ): string;
}
```

#### 5.5 实现流程

```
1. 获取 Agent 信息和 worktree 路径
2. 确保所有变更已提交
   - git add -A
   - git commit -m "feat: {agent_prompt 摘要}"
3. 推送分支到远程
   - git push -u origin {branch}
4. 分析变更生成架构契约
   - 解析 git diff
   - 检测接口变更
   - 检测依赖变更
5. 生成 PR 描述
6. 调用 gh pr create
   - gh pr create --title "..." --body "..." --base main
7. 返回 PR URL
```

#### 5.6 配置项

```yaml
# .maestro/config.yaml
pr:
  template: "default"           # PR 模板
  defaultBase: "main"           # 默认目标分支
  draft: false                  # 默认创建草稿
  autoLabels: true              # 自动添加标签
  labelMapping:                 # commit 类型到标签映射
    feat: "enhancement"
    fix: "bug"
    docs: "documentation"
  contractAnalysis: true        # 启用架构契约分析
```

---

## 数据持久化设计

### 存储结构

```
.maestro/
├── config.yaml               # 用户配置
├── state/
│   ├── agents.json           # Agent 状态
│   └── worktrees.json        # Worktree 元信息
├── logs/
│   ├── {agent-id}.log        # Agent 输出日志
│   └── maestro.log           # 主进程日志
└── templates/
    └── pr-template.md        # 自定义 PR 模板
```

### agents.json 结构

```json
{
  "version": 1,
  "agents": {
    "task-001": {
      "id": "task-001",
      "name": "login-feature",
      "prompt": "实现用户登录功能",
      "worktreeId": "task-001",
      "branch": "maestro/feat-login",
      "status": "running",
      "pid": 12345,
      "createdAt": "2024-01-15T10:00:00Z",
      "startedAt": "2024-01-15T10:00:05Z",
      "metrics": {
        "tokensUsed": 15000,
        "toolCalls": 23,
        "filesModified": ["src/auth/login.ts", "src/auth/LoginForm.tsx"]
      }
    }
  }
}
```

---

## 错误处理策略

| 错误类型 | 处理方式 |
| --- | --- |
| Git worktree 创建失败 | 检查分支冲突，提示用户 |
| Claude Code 进程崩溃 | 自动重试 (最多 2 次)，记录日志 |
| API 限流 | 指数退避重试，通知用户 |
| 网络中断 | 保存状态，支持恢复 |
| PR 创建失败 | 保留本地分支，提示手动创建 |

---

## 探索方向与下一步

<aside>
💡

如果强制 Agent 在提交 PR 时附带标准化的"架构契约清单"（说明修改了哪些核心接口、引入了哪些依赖），是否能让你在执行手动 Reduce（合并 PR）时效率翻倍？

</aside>

### 开发里程碑

- [ ]  **M1: 基础框架** - CLI 入口 + 配置管理
- [ ]  **M2: Worktree 管理** - 创建/销毁/列表
- [ ]  **M3: Agent 控制** - 启动/监控/终止 Claude Code
- [ ]  **M4: 简单状态展示** - 非 TUI 的 status 命令
- [ ]  **M5: TUI 界面** - 完整交互界面
- [ ]  **M6: PR 自动化** - PR 生成 + 架构契约

### 进阶机制 (后续迭代)

- [ ]  引入 Master Agent 监听机制，基于置信度实现"自动纠偏"或"人工兜底"
- [ ]  任务依赖图支持 (A 完成后自动触发 B)
- [ ]  自定义 Agent Prompt 模板
- [ ]  多仓库支持