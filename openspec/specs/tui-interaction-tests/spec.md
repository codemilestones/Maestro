## ADDED Requirements

### Requirement: TUI 键盘交互测试
系统 SHALL 具有 TUI 键盘快捷键的测试覆盖。

#### Scenario: 测试 x 键 kill agent
- **WHEN** 模拟按下 x 键且有选中的 Agent
- **THEN** 验证 `controller.kill()` 被调用，参数为选中 Agent 的 ID

#### Scenario: 测试 x 键不退出 TUI
- **WHEN** 模拟按下 x 键
- **THEN** 验证 `exit()` 未被调用，viewMode 保持为 'list'

#### Scenario: 测试 q 键退出
- **WHEN** 模拟按下 q 键
- **THEN** 验证 `exit()` 被调用

#### Scenario: 测试 n 键打开新建对话框
- **WHEN** 模拟按下 n 键
- **THEN** 验证 viewMode 变为 'new_agent'

#### Scenario: 测试 Enter 键进入 attached 模式
- **WHEN** 模拟按下 Enter 键且有选中的 Agent
- **THEN** 验证 viewMode 变为 'attached'

#### Scenario: 测试 Esc 键返回列表
- **WHEN** viewMode 为 'attached' 时模拟按下 Esc
- **THEN** 验证 viewMode 变为 'list'

### Requirement: TUI 输出显示测试
系统 SHALL 具有输出显示逻辑的测试覆盖。

#### Scenario: 测试输出事件订阅
- **WHEN** useOutput hook 初始化
- **THEN** 验证正确订阅了 controller 的 output 事件

#### Scenario: 测试输出追加
- **WHEN** controller 发射 output 事件
- **THEN** 验证 lines 状态正确更新

#### Scenario: 测试输出限制
- **WHEN** 输出超过 100 行
- **THEN** 验证只保留最近 100 行

#### Scenario: 测试切换 Agent 清空输出
- **WHEN** agentId 参数变化
- **THEN** 验证 lines 被重置为新 Agent 的现有输出

### Requirement: TUI Agent 列表测试
系统 SHALL 具有 Agent 列表组件的测试覆盖。

#### Scenario: 测试列表渲染
- **WHEN** agents 数组有 3 个 Agent
- **THEN** 验证渲染 3 行 Agent 信息

#### Scenario: 测试选中高亮
- **WHEN** selectedIndex 为 1
- **THEN** 验证第 2 行有选中样式

#### Scenario: 测试空列表
- **WHEN** agents 数组为空
- **THEN** 验证显示 "No agents" 提示

#### Scenario: 测试状态图标
- **WHEN** Agent 状态为 running
- **THEN** 验证显示 ● 图标
- **WHEN** Agent 状态为 failed
- **THEN** 验证显示 ✗ 图标

### Requirement: useAgents Hook 测试
系统 SHALL 具有 useAgents hook 的测试覆盖。

#### Scenario: 测试初始加载
- **WHEN** hook 挂载
- **THEN** 调用 controller.listAll() 获取 Agent 列表

#### Scenario: 测试事件刷新
- **WHEN** controller 发射 status_change 事件
- **THEN** 自动刷新 Agent 列表

#### Scenario: 测试选择功能
- **WHEN** 调用 selectByIndex(2)
- **THEN** selectedIndex 变为 2，selectedAgent 为对应 Agent
