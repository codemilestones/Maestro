## ADDED Requirements

### Requirement: PTY process spawning
系统 SHALL 使用 `node-pty` 创建真实的伪终端进程，保留完整终端能力（颜色、光标、ANSI 序列）。

#### Scenario: Spawn interactive Claude Code session
- **WHEN** 用户执行 `maestro spawn "实现登录功能"`
- **THEN** 系统启动 `claude`（不带 `-p` 参数）在 PTY 中运行
- **AND** PTY 配置为 xterm-256color，120 列 x 40 行

#### Scenario: PTY inherits environment
- **WHEN** 系统 spawn 一个新的 PTY 会话
- **THEN** PTY 继承父进程的环境变量
- **AND** 工作目录设置为指定的 worktree 路径

### Requirement: Bidirectional PTY data flow
系统 SHALL 支持 PTY 的双向数据流，stdin 写入和 stdout 读取同时进行。

#### Scenario: Write user input to PTY
- **WHEN** 用户在 attach 模式下输入文本
- **THEN** 输入实时写入 PTY 的 stdin
- **AND** PTY 输出反映用户输入的效果

#### Scenario: Read PTY output
- **WHEN** PTY 子进程产生输出
- **THEN** 系统实时接收 stdout 数据
- **AND** 数据保留完整的 ANSI 转义序列

### Requirement: PTY output buffering
系统 SHALL 维护 PTY 输出缓冲区，用于 Preview 和会话恢复。

#### Scenario: Buffer recent output
- **WHEN** PTY 产生输出
- **THEN** 系统将输出追加到环形缓冲区
- **AND** 缓冲区保留最近 10000 行

#### Scenario: Restore session from buffer
- **WHEN** 用户 attach 一个已运行的会话
- **THEN** 系统首先渲染缓冲区内容
- **AND** 然后切换到实时透传模式

### Requirement: PTY resize handling
系统 SHALL 支持动态调整 PTY 尺寸以匹配终端窗口。

#### Scenario: Terminal resize propagation
- **WHEN** 用户调整终端窗口大小
- **THEN** 系统调用 `pty.resize(cols, rows)`
- **AND** PTY 子进程收到 SIGWINCH 信号
