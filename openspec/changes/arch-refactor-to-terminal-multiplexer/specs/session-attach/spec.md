## ADDED Requirements

### Requirement: Full-screen PTY attach
系统 SHALL 支持全屏接管模式，将 PTY 直接透传到用户终端。

#### Scenario: Attach to running session
- **WHEN** 用户执行 `maestro attach <agent-id>` 或在 TUI 中按 Enter
- **THEN** 系统进入全屏模式
- **AND** PTY 的 stdout 直接渲染到用户终端
- **AND** 用户的 stdin 直接写入 PTY

#### Scenario: Show buffer on attach
- **WHEN** 用户 attach 到一个已运行的会话
- **THEN** 系统首先清屏并渲染输出缓冲区的最近内容
- **AND** 然后切换到实时透传

### Requirement: Prefix key to detach
系统 SHALL 使用 Prefix Key 机制（默认 `Ctrl+]`）从 attach 模式执行命令，避免与 Claude Code 按键冲突。

#### Scenario: Detach with prefix key
- **WHEN** 用户在 attach 模式下按 `Ctrl+]`
- **THEN** 系统退出全屏模式
- **AND** 返回 TUI 列表视图
- **AND** PTY 会话继续在后台运行

#### Scenario: Prefix key passthrough
- **WHEN** 用户需要向 PTY 发送 `Ctrl+]` 本身
- **THEN** 用户按两次 `Ctrl+]`（`Ctrl+]` `Ctrl+]`）
- **AND** 一个 `Ctrl+]` 被传递给 PTY

#### Scenario: Extended prefix commands
- **WHEN** 用户按 `Ctrl+]` 后在 500ms 内按其他键
- **THEN** 系统根据后续按键执行对应命令：
  - `d` - detach（与单独按 `Ctrl+]` 效果相同）
  - `n` - 切换到下一个会话
  - `p` - 切换到上一个会话
  - `k` - kill 当前会话
  - `?` - 显示快捷键帮助

#### Scenario: Prefix key timeout
- **WHEN** 用户按 `Ctrl+]` 后 500ms 内没有按其他键
- **THEN** 系统执行默认操作（detach）

### Requirement: Configurable prefix key
系统 SHALL 支持通过配置文件自定义 Prefix Key。

#### Scenario: Custom prefix key
- **WHEN** 用户在 `.maestro/config.yaml` 中设置 `session.escapeKey: "ctrl+b"`
- **THEN** 系统使用 `Ctrl+B` 作为 Prefix Key 替代默认的 `Ctrl+]`

### Requirement: Terminal state preservation
系统 SHALL 在 attach/detach 时正确保存和恢复终端状态。

#### Scenario: Restore terminal on detach
- **WHEN** 用户从 attach 模式 detach
- **THEN** 系统恢复原终端设置（raw mode、echo 等）
- **AND** TUI 正常渲染

#### Scenario: Handle terminal resize in attach mode
- **WHEN** 用户在 attach 模式下调整终端窗口
- **THEN** 系统将新尺寸传递给 PTY
- **AND** PTY 子进程适应新尺寸

### Requirement: Exclusive attach mode
系统 SHALL 在 M1 阶段实现独占 attach 模式，防止冲突。

#### Scenario: Block concurrent attach
- **WHEN** 会话已被 attach
- **THEN** 其他 attach 请求返回错误 "Session already attached"

#### Scenario: Force attach
- **WHEN** 用户执行 `maestro attach --force <agent-id>`
- **THEN** 系统断开现有 attach 连接
- **AND** 新请求获得 attach 权限
