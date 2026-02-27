## ADDED Requirements

### Requirement: 主界面布局
系统 SHALL 提供三区域布局的 TUI 主界面。

#### Scenario: 界面渲染
- **WHEN** 用户执行 `maestro attach`
- **THEN** 显示包含 Agent 列表区、预览区、状态栏的三区域界面

#### Scenario: 标题栏显示
- **WHEN** TUI 界面启动
- **THEN** 顶部显示版本信息和帮助/退出提示

### Requirement: Agent 列表展示
系统 SHALL 在列表区显示所有 Agent 的状态信息。

#### Scenario: 列表项信息
- **WHEN** Agent 列表区渲染
- **THEN** 每行显示序号、状态图标、分支名、状态文字、任务摘要、运行时长

#### Scenario: 状态图标
- **WHEN** Agent 状态为 running
- **THEN** 显示 ● 图标
- **WHEN** Agent 状态为 waiting_input
- **THEN** 显示 ◐ 图标
- **WHEN** Agent 状态为 finished
- **THEN** 显示 ✓ 图标
- **WHEN** Agent 状态为 failed
- **THEN** 显示 ✗ 图标

### Requirement: 预览区实时输出
系统 SHALL 在预览区显示选中 Agent 的实时输出。

#### Scenario: 输出更新
- **WHEN** 选中的 Agent 产生新输出
- **THEN** 预览区实时追加显示新内容

#### Scenario: 输出限制
- **WHEN** 输出超过预览区容量
- **THEN** 自动滚动显示最新内容，保留最近 N 行

### Requirement: 键盘快捷键
系统 SHALL 支持通过键盘快捷键操作界面。

#### Scenario: 数字键选择
- **WHEN** 用户按下 1-9 数字键
- **THEN** 选中对应序号的 Agent

#### Scenario: Enter 键附加
- **WHEN** 用户按下 Enter 键
- **THEN** 进入选中 Agent 的全屏会话模式

#### Scenario: Esc 键返回
- **WHEN** 用户在全屏会话模式按下 Esc
- **THEN** 返回列表视图

#### Scenario: k 键终止
- **WHEN** 用户按下 k 键
- **THEN** 终止选中的 Agent（需二次确认）

#### Scenario: p 键创建 PR
- **WHEN** 用户按下 p 键
- **THEN** 为选中 Agent 创建 PR

#### Scenario: n 键新建
- **WHEN** 用户按下 n 键
- **THEN** 弹出输入框，输入 prompt 后创建新 Agent

#### Scenario: q 键退出
- **WHEN** 用户按下 q 键
- **THEN** 退出 TUI 界面（Agent 继续后台运行）

#### Scenario: ? 键帮助
- **WHEN** 用户按下 ? 键
- **THEN** 显示帮助弹窗，列出所有快捷键

### Requirement: 全屏会话模式
系统 SHALL 支持进入单个 Agent 的全屏交互模式。

#### Scenario: 进入全屏
- **WHEN** 用户对选中 Agent 按 Enter 或使用 `attach --agent`
- **THEN** 界面切换为该 Agent 的全屏输出，stdin 透传到 Agent 进程

#### Scenario: 退出全屏
- **WHEN** 用户按下 Esc 或 Ctrl+A,D
- **THEN** 返回主列表视图

#### Scenario: 全屏中响应输入
- **WHEN** Agent 处于 waiting_input 且用户输入文本按 Enter
- **THEN** 输入发送到 Agent 进程

### Requirement: 状态栏
系统 SHALL 在底部显示状态栏。

#### Scenario: 显示统计
- **WHEN** 状态栏渲染
- **THEN** 显示总 Agent 数、运行中数量、等待输入数量

#### Scenario: 显示快捷键提示
- **WHEN** 状态栏渲染
- **THEN** 显示常用快捷键提示
