## ADDED Requirements

### Requirement: PR 创建
系统 SHALL 支持为 Agent 的工作成果自动创建 PR。

#### Scenario: 创建标准 PR
- **WHEN** 用户为已完成的 Agent 创建 PR
- **THEN** 系统自动 commit 未提交更改、push 分支、调用 `gh pr create`

#### Scenario: 草稿 PR
- **WHEN** 用户指定 `--draft` 参数
- **THEN** 创建的 PR 为草稿状态

#### Scenario: 指定审阅者
- **WHEN** 用户指定 `--reviewers user1,user2`
- **THEN** PR 自动添加指定审阅者

### Requirement: 自动提交
系统 SHALL 在创建 PR 前自动提交 Agent 的所有更改。

#### Scenario: 提交未暂存更改
- **WHEN** Worktree 有未暂存的更改
- **THEN** 系统执行 `git add -A` 然后 commit

#### Scenario: 提交消息格式
- **WHEN** 系统自动创建 commit
- **THEN** commit 消息格式为 `feat: {agent_prompt 前 50 字符摘要}`

### Requirement: 架构契约清单
系统 SHALL 生成 PR 描述中的架构契约清单。

#### Scenario: 检测接口变更
- **WHEN** 分析 diff 中的 TypeScript 文件
- **THEN** 识别新增、修改、删除的 export 接口/类型

#### Scenario: 检测依赖变更
- **WHEN** package.json 有变更
- **THEN** 列出新增的 dependencies 和 devDependencies

#### Scenario: 文件变更列表
- **WHEN** 生成契约清单
- **THEN** 包含所有修改文件的路径和变更类型（新增/修改/删除）

### Requirement: PR 描述模板
系统 SHALL 使用模板生成结构化的 PR 描述。

#### Scenario: 默认模板
- **WHEN** 生成 PR 描述
- **THEN** 包含概述、变更类型、架构契约清单、Agent 执行摘要等章节

#### Scenario: 自定义模板
- **WHEN** 用户在 `.maestro/templates/pr-template.md` 提供自定义模板
- **THEN** 使用自定义模板生成 PR 描述

#### Scenario: Agent 元信息
- **WHEN** 生成 PR 描述
- **THEN** 包含 Agent ID、执行时长、Token 消耗、工具调用次数

### Requirement: 标签自动添加
系统 SHALL 根据变更类型自动添加 PR 标签。

#### Scenario: feat 类型
- **WHEN** commit 消息以 `feat:` 开头
- **THEN** 自动添加 `enhancement` 标签

#### Scenario: fix 类型
- **WHEN** commit 消息以 `fix:` 开头
- **THEN** 自动添加 `bug` 标签

#### Scenario: 禁用自动标签
- **WHEN** 配置 `pr.autoLabels` 为 false
- **THEN** 不自动添加任何标签
