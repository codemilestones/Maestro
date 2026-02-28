## MODIFIED Requirements

### Requirement: 初始化命令
系统 SHALL 支持通过 `maestro init` 初始化项目。

#### Scenario: 自动检测默认分支
- **WHEN** 执行 `maestro init`
- **THEN** 系统自动检测 Git 仓库的默认分支（main/master）
- **AND** 将检测到的分支写入配置文件的 `worktree.defaultBase` 和 `pr.defaultBase`

#### Scenario: 显示检测结果
- **WHEN** 初始化完成
- **THEN** 显示检测到的默认分支名称
