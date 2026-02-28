## ADDED Requirements

### Requirement: a 键归档 Agent
系统 SHALL 支持通过 a 键归档选中的 Agent。

#### Scenario: a 键归档终止状态 Agent
- **WHEN** 用户在列表视图按下 a 键且选中的 Agent 状态为 finished 或 failed
- **THEN** 调用 controller.archive() 归档选中的 Agent，列表立即刷新

#### Scenario: a 键忽略运行中 Agent
- **WHEN** 用户在列表视图按下 a 键且选中的 Agent 状态为 running/starting/waiting_input/pending
- **THEN** 无任何操作，Agent 保持不变

#### Scenario: a 键无选中时无操作
- **WHEN** 用户按下 a 键但无选中的 Agent
- **THEN** 无任何操作

## MODIFIED Requirements

### Requirement: 预览区实时输出
系统 SHALL 在预览区显示选中 Agent 的实时输出。

#### Scenario: 输出更新
- **WHEN** 选中的 Agent 产生新输出
- **THEN** 预览区实时追加显示新内容

#### Scenario: 输出限制
- **WHEN** 输出超过预览区容量
- **THEN** 自动滚动显示最新内容，保留最近 100 行

#### Scenario: 无输出时显示等待
- **WHEN** 选中的 Agent 尚无输出且状态为 running/starting/pending/waiting_input
- **THEN** 预览区显示 "Waiting for output..." 提示

#### Scenario: 有输出时停止等待提示
- **WHEN** Agent 产生首次输出
- **THEN** 立即替换 "Waiting for output..." 显示实际内容

#### Scenario: 已完成 Agent 显示历史输出
- **WHEN** 选中的 Agent 状态为 finished 或 failed
- **THEN** 从持久化日志加载并显示历史输出内容

#### Scenario: 已完成 Agent 无历史日志
- **WHEN** 选中已完成的 Agent 但日志文件不存在或为空
- **THEN** 预览区显示 "No output available" 提示

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

#### Scenario: x 键终止选中 Agent
- **WHEN** 用户在列表视图按下 x 键且有选中的 Agent
- **THEN** 调用 controller.kill() 终止选中的 Agent，界面保持在列表视图

#### Scenario: x 键无 Agent 时无操作
- **WHEN** 用户按下 x 键但无选中的 Agent
- **THEN** 无任何操作，界面保持不变

#### Scenario: a 键归档选中 Agent
- **WHEN** 用户在列表视图按下 a 键且有选中的终止状态 Agent
- **THEN** 调用 controller.archive() 归档选中的 Agent，列表刷新

#### Scenario: p 键创建 PR
- **WHEN** 用户按下 p 键
- **THEN** 为选中 Agent 创建 PR

#### Scenario: n 键新建
- **WHEN** 用户按下 n 键
- **THEN** 弹出输入框，输入 prompt 后创建新 Agent

#### Scenario: q 键退出
- **WHEN** 用户按下 q 键
- **THEN** 退出 TUI 界面，Agent 状态保留，Agent 进程继续后台运行

#### Scenario: ? 键帮助
- **WHEN** 用户按下 ? 键
- **THEN** 显示帮助弹窗，列出所有快捷键（包括 a 键归档）
