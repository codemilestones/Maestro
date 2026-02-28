## MODIFIED Requirements

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
- **THEN** 显示帮助弹窗，列出所有快捷键

### Requirement: 预览区实时输出
系统 SHALL 在预览区显示选中 Agent 的实时输出。

#### Scenario: 输出更新
- **WHEN** 选中的 Agent 产生新输出
- **THEN** 预览区实时追加显示新内容

#### Scenario: 输出限制
- **WHEN** 输出超过预览区容量
- **THEN** 自动滚动显示最新内容，保留最近 100 行

#### Scenario: 无输出时显示等待
- **WHEN** 选中的 Agent 尚无输出
- **THEN** 预览区显示 "Waiting for output..." 提示

#### Scenario: 有输出时停止等待提示
- **WHEN** Agent 产生首次输出
- **THEN** 立即替换 "Waiting for output..." 显示实际内容

## ADDED Requirements

### Requirement: TUI 退出状态保留
系统 SHALL 在 TUI 退出时保留所有 Agent 状态。

#### Scenario: q 键退出后状态保留
- **WHEN** 用户按 q 键退出 TUI
- **THEN** 所有 Agent 的状态保持在 `.maestro/state/agents.json` 中不变

#### Scenario: Ctrl+C 退出后状态保留
- **WHEN** 用户按 Ctrl+C 强制退出 TUI
- **THEN** 所有 Agent 的状态保持不变

#### Scenario: 重新进入 TUI 恢复状态
- **WHEN** 用户退出后再次运行 `maestro attach`
- **THEN** 看到之前所有的 Agent，包括运行中和已完成的

### Requirement: Agent 列表点击支持
系统 SHALL 支持鼠标点击选择 Agent（如果终端支持）。

#### Scenario: 点击 Agent 行
- **WHEN** 用户鼠标点击 Agent 列表中的某一行
- **THEN** 该 Agent 被选中，预览区显示其输出

#### Scenario: 双击 Agent 行
- **WHEN** 用户鼠标双击 Agent 列表中的某一行
- **THEN** 进入该 Agent 的全屏会话模式
